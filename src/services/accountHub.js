/**
 * accountHub – singleton that manages all AccountSession instances and
 * the current view mode (per-account vs merged).
 *
 * Design goals:
 *  - Zero coupling to existing global Stores (FriendStore, UserStore, etc.)
 *  - Reactive state so UI components can bind to it directly
 *  - Add / remove secondary sessions at any time without disturbing the primary
 */

import { reactive, watch } from 'vue';
import { AccountSession } from './accountSession.js';
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
        if (session) {
            Object.assign(session.userInfo, userInfo);
            session.label = (userInfo.displayName || _state.primaryId).slice(0, 2).toUpperCase();
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
     */
    switchToMerged() {
        _state.viewMode = 'merged';
    },

    /**
     * Switch to the scoped view for a specific account.
     * Pass the primary userId to go back to the normal primary view.
     * @param {string} userId
     */
    switchToAccount(userId) {
        if (!userId || userId === _state.primaryId) {
            _state.viewMode = 'primary';
        } else {
            _state.viewMode = `account:${userId}`;
        }
    },

    /**
     * Switch back to primary account view.
     */
    switchToPrimary() {
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
