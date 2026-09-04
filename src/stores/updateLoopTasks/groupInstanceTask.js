export const GROUP_INSTANCE_REFRESH_SECONDS = 300;

/**
 * Creates the periodic Group instance refresh task.
 *
 * The game-running notification is kept here for this incremental extraction
 * because the legacy loop performs it in the same countdown branch. It is
 * injected and can be moved to the game-state task in a later, isolated step.
 *
 * @param {object} dependencies
 * @param {() => boolean} dependencies.isFriendsLoaded
 * @param {() => Promise<unknown>} dependencies.getUsersGroupInstances
 * @param {(args: unknown) => void} dependencies.handleGroupUserInstances
 * @param {() => void} dependencies.checkGameRunning
 * @param {number} [dependencies.interval=300]
 * @returns {{ tick: () => Promise<void>, reset: () => void, setNext: (value: number) => void }}
 */
export function createGroupInstanceTask({
    isFriendsLoaded,
    getUsersGroupInstances,
    handleGroupUserInstances,
    checkGameRunning,
    interval = GROUP_INSTANCE_REFRESH_SECONDS
}) {
    let nextRefresh = 0;

    return {
        async tick() {
            if (--nextRefresh <= 0) {
                if (isFriendsLoaded()) {
                    nextRefresh = interval;
                    const args = await getUsersGroupInstances();
                    handleGroupUserInstances(args);
                }
                checkGameRunning();
            }
        },

        reset() {
            nextRefresh = 0;
        },

        setNext(value) {
            nextRefresh = value;
        }
    };
}
