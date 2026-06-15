/**
 * AccountSession - manages a single secondary VRChat account.
 *
 * Responsibilities:
 *  - Maintain an independent HTTP client (via WebApi secondary client)
 *  - Connect a WebSocket for real-time friend/user events
 *  - Keep a local friendsCache (Map<userId, ctx>) from the secondary account's perspective
 *  - Write GPS / Online / Offline feed events to the secondary account's DB tables
 *  - Run a lightweight periodic poll for friends list refresh
 *
 * Intentionally does NOT touch the global Stores (friendStore, userStore, etc.),
 * so the primary account's UI is completely unaffected.
 */

import { reactive } from 'vue';
import { parseLocation } from '../shared/utils';
import { AppDebug } from './appConfig';
import sqliteService from './sqlite.js';
import webApiService from './webapi.js';
import * as workerTimers from 'worker-timers';
import { useModalStore } from '../stores/modal';

// ── Utility ────────────────────────────────────────────────────────────────────

function isVagueLoc(loc) {
    return !loc || loc === 'private' || (typeof loc === 'string' && loc.startsWith('offline'));
}

function isDetailedLoc(loc) {
    return loc && loc !== 'private' && !(typeof loc === 'string' && loc.startsWith('offline')) && loc !== ':';
}

function nowIso() {
    return new Date().toJSON();
}

// ── AccountSession ─────────────────────────────────────────────────────────────

export class AccountSession {
    constructor(userId) {
        this.userId = userId;
        /** e.g. "usr1234abc" → "usr1234abc" (underscores/dashes stripped, leading digit → "_X") */
        this.userPrefix = computeUserPrefix(userId);
        this.userInfo = reactive({ id: userId, displayName: '' });
        this.label = '?';
        /**
         * @type {Map<string, {id: string, state: string, ref?: object, $accountIds?: string[]}>}
         */
        this.friendsCache = new Map();

        this._ws = null;
        this._pollTimer = null;
        this._destroyed = false;
    }

    // ── Session lifecycle ──────────────────────────────────────────────────────

    /**
     * Initialises the HTTP client and logs in using saved credentials.
     * @param {{ user: object, loginParams: { username: string, password: string, endpoint?: string, websocket?: string }, cookies?: string }} savedEntry
     */
    async login(savedEntry) {
        webApiService.createSecondaryClient(this.userId);

        // Apply saved cookies first (fast-path: skip full login)
        if (savedEntry.cookies) {
            try {
                webApiService.setSecondaryCookies(this.userId, savedEntry.cookies);
            } catch {
                // ignore – will try fresh login below
            }
        }

        // Try /auth/user with existing cookies
        let currentUser = null;
        try {
            currentUser = await this._requestRaw('auth/user');
            // Ensure the cookie actually belongs to this secondary account
            if (currentUser && !currentUser.error && currentUser.id !== this.userId) {
                console.warn(`[accountSession] Cookie mismatch for ${this.userId}, forcing fresh login.`);
                currentUser = null;
                // We should clear the bad cookies from the secondary client
                try {
                    webApiService.setSecondaryCookies(this.userId, '');
                } catch {}
            }
        } catch {
            currentUser = null;
        }

        // Fresh login if cookies expired / missing
        if (!currentUser || currentUser.error || currentUser.requiresTwoFactorAuth) {
            const { username, password, endpoint, websocket } = savedEntry.loginParams ?? {};
            if (!username || !password) {
                throw new Error(`Secondary account ${this.userId}: no credentials available`);
            }
            const endpointToUse = endpoint || AppDebug.endpointDomainVrchat;
            const wsToUse = websocket || AppDebug.websocketDomainVrchat;

            const auth = btoa(
                `${encodeURIComponent(username)}:${encodeURIComponent(password)}`
            );
            currentUser = await this._requestRaw('auth/user', {
                method: 'GET',
                headers: { Authorization: `Basic ${auth}` }
            });
            if (currentUser?.requiresTwoFactorAuth) {
                currentUser = await this._completeTwoFactorAuth(currentUser, savedEntry);
            }

            this._wsEndpoint = wsToUse;
            this._apiEndpoint = endpointToUse;
        } else {
            this._apiEndpoint = savedEntry.loginParams?.endpoint || AppDebug.endpointDomainVrchat;
            this._wsEndpoint = savedEntry.loginParams?.websocket || AppDebug.websocketDomainVrchat;
        }

        if (!currentUser || !currentUser.id) {
            throw new Error(`Secondary account ${this.userId}: login failed`);
        }

        this.userInfo = currentUser;
        this.label = currentUser.displayName || this.userId;
        this._initialized = true;

        // Initialise DB tables for this account
        await this._initTables();

        // Load friends list
        await this._loadFriends();

        // Connect WebSocket
        this._connectWS();

        // Start periodic poll (every 5 minutes)
        this._startPolling();
    }

    /**
     * Cleanly shut down this session.
     */
    destroy() {
        this._destroyed = true;
        if (this._pollTimer !== null) {
            workerTimers.clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        if (this._ws) {
            try { this._ws.close(); } catch { /* ignore */ }
            this._ws = null;
        }
        webApiService.destroySecondaryClient(this.userId);
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    /**
     * Makes an API request using this account's secondary HTTP client.
     * Returns the parsed JSON response body.
     */
    async _requestRaw(endpoint, options = {}) {
        const apiBase = this._apiEndpoint || AppDebug.endpointDomain;
        const init = {
            url: `${apiBase}/${endpoint}`,
            method: options.method || 'GET',
            ...options
        };

        // Build query string for GET
        if (init.method === 'GET' && init.params === Object(init.params)) {
            const url = new URL(init.url);
            for (const key in init.params) {
                url.searchParams.set(key, init.params[key]);
            }
            init.url = url.toString();
        } else if (init.method !== 'GET' && !options.uploadImage) {
            init.headers = { 'Content-Type': 'application/json;charset=utf-8', ...init.headers };
            init.body = init.params === Object(init.params) ? JSON.stringify(init.params) : '{}';
        }

        const response = await webApiService.executeAs(this.userId, init);
        if (!response || response.status === -1) {
            throw new Error(`Secondary request failed: ${endpoint}`);
        }

        try {
            return JSON.parse(response.data);
        } catch {
            return response.data;
        }
    }

    async _completeTwoFactorAuth(currentUser, savedEntry) {
        const methods = Array.isArray(currentUser.requiresTwoFactorAuth)
            ? currentUser.requiresTwoFactorAuth
            : [];
        const accountName =
            savedEntry?.user?.displayName ||
            savedEntry?.user?.username ||
            savedEntry?.loginParams?.username ||
            this.userId;

        if (methods.includes('emailOtp')) {
            await this._promptAndVerifyTwoFactor({
                mode: 'emailOtp',
                title: `Email 2FA - ${accountName}`,
                description: `Enter the email verification code for ${accountName}.`,
                endpoint: 'auth/twofactorauth/emailotp/verify'
            });
        } else {
            await this._promptAndVerifyTwoFactor({
                mode: 'totp',
                title: `Two-factor code - ${accountName}`,
                description: `Enter the two-factor code for ${accountName}.`,
                endpoint: 'auth/twofactorauth/totp/verify',
                cancelText: 'Use recovery code',
                fallback: {
                    mode: 'otp',
                    title: `Recovery code - ${accountName}`,
                    description: `Enter the recovery code for ${accountName}.`,
                    endpoint: 'auth/twofactorauth/otp/verify',
                    cancelText: 'Use two-factor code'
                }
            });
        }

        return this._requestRaw('auth/user');
    }

    async _promptAndVerifyTwoFactor(options) {
        const modalStore = useModalStore();
        const { ok, reason, value } = await modalStore.otpPrompt({
            title: options.title,
            description: options.description,
            mode: options.mode,
            cancelText: options.cancelText || 'Cancel',
            confirmText: 'Verify'
        });

        if (reason === 'cancel' && options.fallback) {
            return this._promptAndVerifyTwoFactor({
                ...options.fallback,
                fallback: options
            });
        }
        if (!ok) {
            throw new Error(`Secondary account ${this.userId}: two-factor authentication cancelled`);
        }

        const code = options.mode === 'otp'
            ? `${value.slice(0, 4)}-${value.slice(4)}`
            : value.trim();
        await this._requestRaw(options.endpoint, {
            method: 'POST',
            params: { code }
        });
    }

    // ── DB helpers ────────────────────────────────────────────────────────────

    async _initTables() {
        const p = this.userPrefix;
        await sqliteService.executeNonQuery(
            `CREATE TABLE IF NOT EXISTS ${p}_feed_gps (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, location TEXT, world_name TEXT, previous_location TEXT, time INTEGER, group_name TEXT)`
        );
        await sqliteService.executeNonQuery(
            `CREATE TABLE IF NOT EXISTS ${p}_feed_status (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, status TEXT, status_description TEXT, previous_status TEXT, previous_status_description TEXT)`
        );
        await sqliteService.executeNonQuery(
            `CREATE TABLE IF NOT EXISTS ${p}_feed_bio (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, bio TEXT, previous_bio TEXT)`
        );
        await sqliteService.executeNonQuery(
            `CREATE TABLE IF NOT EXISTS ${p}_feed_avatar (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, owner_id TEXT, avatar_name TEXT, current_avatar_image_url TEXT, current_avatar_thumbnail_image_url TEXT, previous_current_avatar_image_url TEXT, previous_current_avatar_thumbnail_image_url TEXT)`
        );
        await sqliteService.executeNonQuery(
            `CREATE TABLE IF NOT EXISTS ${p}_feed_online_offline (id INTEGER PRIMARY KEY, created_at TEXT, user_id TEXT, display_name TEXT, type TEXT, location TEXT, world_name TEXT, time INTEGER, group_name TEXT)`
        );
        await sqliteService.executeNonQuery(
            `CREATE INDEX IF NOT EXISTS ${p}_feed_online_offline_user_created_idx ON ${p}_feed_online_offline (user_id, created_at)`
        );
        await sqliteService.executeNonQuery(
            `CREATE TABLE IF NOT EXISTS ${p}_friend_log_current (user_id TEXT PRIMARY KEY, display_name TEXT, trust_level TEXT, friend_number INTEGER)`
        );
        await sqliteService.executeNonQuery(
            `CREATE TABLE IF NOT EXISTS ${p}_notifications (id TEXT PRIMARY KEY, created_at TEXT, type TEXT, sender_user_id TEXT, sender_username TEXT, receiver_user_id TEXT, message TEXT, world_id TEXT, world_name TEXT, image_url TEXT, invite_message TEXT, request_message TEXT, response_message TEXT, expired INTEGER)`
        );
    }

    _writeGPS(userId, displayName, location, worldName, previousLocation, groupName) {
        const p = this.userPrefix;
        sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${p}_feed_gps (created_at, user_id, display_name, location, world_name, previous_location, time, group_name) VALUES (@ca, @uid, @dn, @loc, @wn, @pl, @t, @gn)`,
            {
                '@ca': nowIso(),
                '@uid': userId,
                '@dn': displayName,
                '@loc': location || '',
                '@wn': worldName || '',
                '@pl': previousLocation || '',
                '@t': 0,
                '@gn': groupName || ''
            }
        );
    }

    _writeOnlineOffline(userId, displayName, type, location, worldName, groupName) {
        const p = this.userPrefix;
        sqliteService.executeNonQuery(
            `INSERT OR IGNORE INTO ${p}_feed_online_offline (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES (@ca, @uid, @dn, @t, @loc, @wn, @tm, @gn)`,
            {
                '@ca': nowIso(),
                '@uid': userId,
                '@dn': displayName,
                '@t': type,
                '@loc': location || '',
                '@wn': worldName || '',
                '@tm': 0,
                '@gn': groupName || ''
            }
        );
    }

    // ── Friends loading ────────────────────────────────────────────────────────

    async _loadFriends() {
        try {
            const online = await this._requestRaw('auth/user/friends', { params: { n: 100, offset: 0 } });
            if (Array.isArray(online)) {
                for (const user of online) {
                    this._applyFriendUser(user, 'online');
                }
            }
            const offline = await this._requestRaw('auth/user/friends', { params: { n: 100, offset: 0, offline: true } });
            if (Array.isArray(offline)) {
                for (const user of offline) {
                    this._applyFriendUser(user, 'offline');
                }
            }
        } catch (e) {
            console.warn(`[AccountSession:${this.userId}] _loadFriends error`, e);
        }
    }

    _applyFriendUser(user, defaultState) {
        if (!user || !user.id) return;
        const existing = this.friendsCache.get(user.id);
        const state = user.state || defaultState || 'offline';
        if (existing) {
            Object.assign(existing.ref, user);
            existing.state = state;
        } else {
            this.friendsCache.set(user.id, {
                id: user.id,
                name: user.displayName,
                state,
                ref: reactive({ ...user }),
                $accountIds: [this.userId],
                isVIP: false,
                memo: '',
                pendingOffline: false,
                $nickName: ''
            });
        }
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    _connectWS() {
        if (this._ws !== null || this._destroyed) return;

        this._requestRaw('auth').then((authData) => {
            if (!authData || !authData.token || this._destroyed) return;
            const wsBase = this._wsEndpoint || AppDebug.websocketDomain;
            const socket = new WebSocket(`${wsBase}/?auth=${authData.token}`);
            socket.onopen = () => {
                if (AppDebug.debugWebSocket) {
                    console.log(`[WS:secondary:${this.userId}] connected`);
                }
            };
            socket.onclose = () => {
                if (this._ws === socket) {
                    this._ws = null;
                }
                if (!this._destroyed) {
                    workerTimers.setTimeout(() => {
                        if (!this._destroyed && this._ws === null) {
                            this._connectWS();
                        }
                    }, 10000);
                }
            };
            socket.onerror = () => {
                socket.onclose(new CloseEvent('close', { code: 1006 }));
            };
            socket.onmessage = ({ data }) => {
                try {
                    let json;
                    try {
                        json = JSON.parse(data);
                        json.content = JSON.parse(json.content);
                    } catch { /* ignore */ }
                    if (json) {
                        this._handleWsMessage(json);
                    }
                } catch (e) {
                    console.error(`[WS:secondary:${this.userId}]`, e);
                }
            };
            this._ws = socket;
        }).catch((e) => {
            console.warn(`[AccountSession:${this.userId}] WS auth failed`, e);
        });
    }

    _handleWsMessage({ type, content }) {
        if (!content) return;

        switch (type) {
            case 'friend-online': {
                const user = {
                    id: content.userId,
                    platform: content.platform,
                    state: 'online',
                    location: content.location,
                    ...(content.user || {})
                };
                const prev = this.friendsCache.get(user.id);
                const prevLoc = prev?.ref?.location || '';
                this._applyFriendUser(user, 'online');
                if (isDetailedLoc(user.location)) {
                    this._writeGPS(user.id, user.displayName, user.location, '', prevLoc, '');
                }
                this._writeOnlineOffline(user.id, user.displayName || '', 'Online', user.location, '', '');
                break;
            }
            case 'friend-active': {
                const user = {
                    id: content.userId,
                    platform: content.platform,
                    state: 'active',
                    location: 'offline',
                    ...(content.user || {})
                };
                this._applyFriendUser(user, 'active');
                break;
            }
            case 'friend-offline': {
                const ctx = this.friendsCache.get(content.userId);
                if (ctx) {
                    const prevLoc = ctx.ref?.location || '';
                    ctx.state = 'offline';
                    ctx.ref.location = 'offline';
                    this._writeOnlineOffline(content.userId, ctx.ref?.displayName || '', 'Offline', prevLoc, '', '');
                }
                break;
            }
            case 'friend-update': {
                if (content.user) {
                    this._applyFriendUser(content.user, undefined);
                }
                break;
            }
            case 'friend-location': {
                const $loc = parseLocation(content.location);
                const user = {
                    id: content.userId,
                    location: content.location,
                    worldId: $loc.worldId,
                    ...(content.user || {})
                };
                const prev = this.friendsCache.get(user.id);
                const prevLoc = prev?.ref?.location || '';
                this._applyFriendUser(user, 'online');
                if (isDetailedLoc(user.location) && user.location !== prevLoc) {
                    this._writeGPS(user.id, user.displayName || user.id, user.location, '', prevLoc, '');
                }
                break;
            }
            case 'user-update': {
                if (content.user) {
                    Object.assign(this.userInfo, content.user);
                }
                break;
            }
            default:
                break;
        }
    }

    // ── Polling ───────────────────────────────────────────────────────────────

    _startPolling() {
        if (this._pollTimer !== null) return;
        // Poll friends list every 5 minutes
        this._pollTimer = workerTimers.setInterval(() => {
            if (!this._destroyed) {
                this._loadFriends().catch(() => {});
            }
        }, 5 * 60 * 1000);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeUserPrefix(userId) {
    let prefix = userId.replaceAll('-', '').replaceAll('_', '');
    if (/^\d/.test(prefix)) {
        prefix = '_' + prefix;
    }
    return prefix;
}
