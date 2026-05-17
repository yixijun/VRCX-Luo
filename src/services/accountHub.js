/**
 * accountHub – singleton that manages all AccountSession instances and
 * the current view mode (per-account vs merged).
 *
 * Design goals:
 *  - Zero coupling to existing global Stores (FriendStore, UserStore, etc.)
 *  - Reactive state so UI components can bind to it directly
 *  - Add / remove secondary sessions at any time without disturbing the primary
 */

import { reactive, toRaw, watch } from 'vue';
import { AccountSession } from './accountSession.js';
import { dbVars } from './database/index.js';
import { watchState } from './watchState.js';

// ── Colour palette for account badges ──────────────────────────────────────────
const ACCOUNT_COLOURS = [
    '#4ade80', // green
    '#60a5fa', // blue
    '#fb923c', // orange
    '#f472b6', // pink
    '#a78bfa', // purple
    '#34d399', // teal
    '#fbbf24', // yellow
    '#f87171'  // red
];

// ── Hub state ──────────────────────────────────────────────────────────────────

const _state = reactive({
    /** @type {Map<string, import('./accountSession.js').AccountSession>} */
    sessions: new Map(),

    /** userId of the primary (main) account */
    primaryId: '',

    /**
     * Current view mode.
     *  'primary'            → only the primary account is displayed (default)
     *  'merged'             → aggregated view across all accounts
     *  'account:<userId>'   → scoped view for the specified secondary account
     */
    viewMode: 'primary',

    /** Map<userId, colour hex string> */
    accountColors: new Map(),

    _colorIndex: 0
});

/**
 * Snapshot of the primary account's global state.
 * Taken the first time we switch away from the primary view,
 * and restored when we switch back.
 *
 * @type {{
 *   dbUserId: string,
 *   dbUserPrefix: string,
 *   currentUser: object,
 *   friends: Map<string, object>,
 *   sortedFriends: object[]
 * } | null}
 */
let _primarySnapshot = null;

// ── Public reactive accessors ──────────────────────────────────────────────────

export const accountHub = {
    // --- reactive state (read-only from outside) ---

    get sessions() { return _state.sessions; },
    get primaryId() { return _state.primaryId; },
    get viewMode() { return _state.viewMode; },
    get accountColors() { return _state.accountColors; },

    get isMergedView() { return _state.viewMode === 'merged'; },

    /** All secondary sessions (excludes primary) */
    get secondarySessions() {
        const result = [];
        for (const [id, session] of _state.sessions) {
            if (id !== _state.primaryId) result.push(session);
        }
        return result;
    },

    /** True when there is at least one secondary session loaded */
    get hasSecondarySessions() {
        return _state.sessions.size > (_state.primaryId ? 1 : 0);
    },

    /** All user prefixes for all active sessions (including primary) */
    get allUserPrefixes() {
        const prefixes = [];
        for (const session of _state.sessions.values()) {
            prefixes.push(session.userPrefix);
        }
        return prefixes;
    },

    // --- mutators ---

    /**
     * Register the primary account.  Called once after the primary login succeeds.
     * @param {string} userId
     * @param {string} userPrefix  (computed from userId in database.js)
     */
    setPrimary(userId, userPrefix) {
        _state.primaryId = userId;
        if (!_state.sessions.has(userId)) {
            // Stub session for the primary – we don't create a real AccountSession
            // because the primary already has all global Store machinery.
            const stub = {
                userId,
                userPrefix,
                userInfo: { id: userId, displayName: '' },
                label: '★',
                friendsCache: new Map()
            };
            _state.sessions.set(userId, stub);
        }
        _assignColor(userId);
    },

    /**
     * Update the primary stub's user info (displayName, etc.) after login.
     * @param {{ id: string, displayName: string }} userInfo
     */
    updatePrimaryInfo(userInfo) {
        const session = _state.sessions.get(_state.primaryId);
        if (session && userInfo) {
            session.userInfo = userInfo;
            session.label = userInfo.displayName || _state.primaryId;
        }
    },

    /**
     * Add and start a secondary account session.
     * @param {object} savedEntry  Saved credential entry from configRepository.
     */
    async addSession(savedEntry) {
        const userId = savedEntry?.user?.id;
        if (!userId) throw new Error('savedEntry.user.id is required');
        if (_state.sessions.has(userId)) return;

        const session = new AccountSession(userId);
        _state.sessions.set(userId, session);
        _assignColor(userId);

        try {
            await session.login(savedEntry);
        } catch (e) {
            _state.sessions.delete(userId);
            _state.accountColors.delete(userId);
            throw e;
        }
    },

    /**
     * Remove and destroy a secondary account session.
     * @param {string} userId
     */
    removeSession(userId) {
        if (userId === _state.primaryId) return; // never remove primary via hub
        const session = _state.sessions.get(userId);
        if (session) {
            if (typeof session.destroy === 'function') session.destroy();
            _state.sessions.delete(userId);
            _state.accountColors.delete(userId);
        }
        if (_state.viewMode === `account:${userId}`) {
            _state.viewMode = 'primary';
        }
    },

    /**
     * Remove all secondary sessions.
     */
    removeAllSessions() {
        for (const [id] of [..._state.sessions]) {
            if (id !== _state.primaryId) this.removeSession(id);
        }
    },

    /**
     * Switch to the aggregated merged view.
     * Restores the primary context first so the merged view
     * can overlay secondary data on top of the primary Store.
     */
    switchToMerged() {
        _restorePrimary();
        _state.viewMode = 'merged';
    },

    /**
     * Switch to the scoped view for a specific account.
     * If the target is the primary account, restores from snapshot.
     * If the target is a secondary account, snapshots the primary and
     * hot-swaps dbVars / userStore / friendStore.
     * @param {string} userId
     */
    switchToAccount(userId) {
        if (!userId || userId === _state.primaryId) {
            _restorePrimary();
            _state.viewMode = 'primary';
            return;
        }

        const session = _state.sessions.get(userId);
        if (!session || !(session instanceof AccountSession)) {
            console.warn('[accountHub] switchToAccount: session not found', userId);
            return;
        }

        // Snapshot primary state once (idempotent)
        _snapshotPrimary();

        // Hot-swap dbVars so all SQL queries hit the secondary tables
        dbVars.userId = session.userId;
        dbVars.userPrefix = session.userPrefix;

        // Hot-swap global stores
        try {
            const { useUserStore } = require('../stores/user.js');
            const { useFriendStore } = require('../stores/friend.js');
            const userStore = useUserStore();
            const friendStore = useFriendStore();

            // Overwrite currentUser with the secondary's userInfo
            userStore.setCurrentUser({
                ...toRaw(userStore.currentUser),
                ...toRaw(session.userInfo),
                id: session.userId
            });

            friendStore.friends.clear();
            for (const [id, ctx] of session.friendsCache) {
                friendStore.friends.set(id, reactive({ ...ctx }));
            }
            if (typeof friendStore.updateSidebarFavorites === 'function') {
                friendStore.updateSidebarFavorites();
            }
            friendStore.rebuildSortedFriends();
            if (typeof friendStore.updateOnlineFriendCounter === 'function') {
                friendStore.updateOnlineFriendCounter();
            }

            try {
                const { useTrackedNonFriendsStore } = require('../stores/trackedNonFriends.js');
                useTrackedNonFriendsStore().loadTrackedNonFriends();
            } catch (e) {
                console.error('[accountHub] failed to swap trackedNonFriends', e);
            }
        } catch (e) {
            console.error('[accountHub] switchToAccount: store swap failed', e);
        }

        _state.viewMode = `account:${userId}`;
    },

    /**
     * Switch back to primary account view.
     */
    switchToPrimary() {
        _restorePrimary();
        _state.viewMode = 'primary';
    },

    /**
     * Get the badge colour for an account.
     * @param {string} userId
     * @returns {string}
     */
    getAccountColor(userId) {
        return _state.accountColors.get(userId) || '#888888';
    },

    /**
     * Full reset – called when the primary account logs out.
     */
    reset() {
        this.removeAllSessions();
        _state.sessions.clear();
        _state.primaryId = '';
        _state.viewMode = 'primary';
        _state.accountColors.clear();
        _state._colorIndex = 0;
        _primarySnapshot = null;
    }
};

// ── Internal helpers ───────────────────────────────────────────────────────────

function _assignColor(userId) {
    if (_state.accountColors.has(userId)) return;
    const color = ACCOUNT_COLOURS[_state._colorIndex % ACCOUNT_COLOURS.length];
    _state._colorIndex++;
    _state.accountColors.set(userId, color);
}

function _computeUserPrefix(userId) {
    let prefix = userId.replaceAll('-', '').replaceAll('_', '');
    if (/^\d/.test(prefix)) {
        prefix = '_' + prefix;
    }
    return prefix;
}

/**
 * Take a snapshot of the primary account's global state.
 * Safe to call multiple times – only the first call actually captures.
 */
function _snapshotPrimary() {
    if (_primarySnapshot) return; // already captured

    try {
        const { useUserStore } = require('../stores/user.js');
        const { useFriendStore } = require('../stores/friend.js');
        const userStore = useUserStore();
        const friendStore = useFriendStore();

        _primarySnapshot = {
            dbUserId: dbVars.userId,
            dbUserPrefix: dbVars.userPrefix,
            currentUser: JSON.parse(JSON.stringify(toRaw(userStore.currentUser))),
            friends: new Map(),
            sortedFriends: friendStore.sortedFriends.slice()
        };

        for (const [id, ctx] of friendStore.friends) {
            _primarySnapshot.friends.set(id, toRaw(ctx));
        }
    } catch (e) {
        console.error('[accountHub] _snapshotPrimary failed', e);
    }
}

/**
 * Restore the primary account's global state from the snapshot.
 * No-op if we are already in the primary state (no snapshot exists).
 */
function _restorePrimary() {
    if (!_primarySnapshot) return;

    try {
        const { useUserStore } = require('../stores/user.js');
        const { useFriendStore } = require('../stores/friend.js');
        const userStore = useUserStore();
        const friendStore = useFriendStore();

        // Restore dbVars
        dbVars.userId = _primarySnapshot.dbUserId;
        dbVars.userPrefix = _primarySnapshot.dbUserPrefix;

        // Restore currentUser
        userStore.setCurrentUser(_primarySnapshot.currentUser);

        // Restore friends
        friendStore.friends.clear();
        for (const [id, ctx] of _primarySnapshot.friends) {
            friendStore.friends.set(id, reactive({ ...ctx }));
        }
        if (typeof friendStore.updateSidebarFavorites === 'function') {
            friendStore.updateSidebarFavorites();
        }
        friendStore.rebuildSortedFriends();
        if (typeof friendStore.updateOnlineFriendCounter === 'function') {
            friendStore.updateOnlineFriendCounter();
        }

        try {
            const { useTrackedNonFriendsStore } = require('../stores/trackedNonFriends.js');
            useTrackedNonFriendsStore().loadTrackedNonFriends();
        } catch (e) {
            console.error('[accountHub] failed to restore trackedNonFriends', e);
        }
    } catch (e) {
        console.error('[accountHub] _restorePrimary failed', e);
    }

    _primarySnapshot = null;
}

/**
 * Set up watchers so the hub tracks primary login / logout automatically.
 * Call once from app.js after Pinia is initialised.
 */
export function initAccountHubWatcher() {
    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            if (isLoggedIn) {
                // Delay slightly so userStore.currentUser is available
                Promise.resolve().then(() => {
                    try {
                        const { useUserStore } = require('../stores/user.js');
                        const userStore = useUserStore();
                        const userId = userStore.currentUser?.id;
                        if (userId) {
                            accountHub.setPrimary(userId, _computeUserPrefix(userId));
                            accountHub.updatePrimaryInfo(userStore.currentUser);
                        }
                    } catch {
                        // store not ready yet – will be called again on next tick
                    }
                });
            } else {
                accountHub.reset();
            }
        },
        { flush: 'sync' }
    );
}
