export const NON_FRIEND_REFRESH_SECONDS = 3600;

/**
 * Creates the periodic tracked-non-friend refresh task.
 *
 * @param {object} dependencies
 * @param {() => void} dependencies.refreshTrackedNonFriends
 * @param {number} [dependencies.interval=3600]
 * @returns {{ tick: () => void, reset: () => void }}
 */
export function createNonFriendSyncTask({
    refreshTrackedNonFriends,
    interval = NON_FRIEND_REFRESH_SECONDS
}) {
    let nextRefresh = interval;

    return {
        tick() {
            if (--nextRefresh <= 0) {
                nextRefresh = interval;
                refreshTrackedNonFriends();
            }
        },

        reset() {
            nextRefresh = interval;
        }
    };
}
