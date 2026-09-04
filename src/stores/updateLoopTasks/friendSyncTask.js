export const FRIENDS_REFRESH_SECONDS = 3600;

/**
 * Creates the periodic friend synchronization task.
 *
 * All application services are supplied by the caller. This keeps the task
 * independent from Pinia and lets its timing and side effects be tested in
 * isolation.
 *
 * @param {object} dependencies
 * @param {() => void} dependencies.refreshFriends
 * @param {() => object} dependencies.getCurrentUser
 * @param {(user: object) => void} dependencies.updateStoredUser
 * @param {() => void} dependencies.refreshPlayerModerations
 * @param {() => number} dependencies.now
 * @param {number} [dependencies.interval=3600]
 * @returns {{ tick: () => void, reset: () => void }}
 */
export function createFriendSyncTask({
    refreshFriends,
    getCurrentUser,
    updateStoredUser,
    refreshPlayerModerations,
    now,
    interval = FRIENDS_REFRESH_SECONDS
}) {
    let nextRefresh = interval;

    return {
        tick() {
            if (--nextRefresh > 0) {
                return;
            }

            nextRefresh = interval;
            refreshFriends();

            const currentUser = getCurrentUser();
            updateStoredUser(currentUser);

            if (
                currentUser.last_activity &&
                new Date(currentUser.last_activity) >
                    new Date(now() - 3600 * 1000)
            ) {
                refreshPlayerModerations();
            }
        },

        reset() {
            nextRefresh = interval;
        }
    };
}
