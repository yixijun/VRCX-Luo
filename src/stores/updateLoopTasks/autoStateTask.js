export const AUTO_STATE_CHANGE_SECONDS = 3;

/**
 * Creates the periodic automatic-state-change task.
 *
 * @param {object} dependencies
 * @param {() => void} dependencies.updateAutoStateChange
 * @param {number} [dependencies.interval=3]
 * @returns {{ tick: () => void }}
 */
export function createAutoStateTask({
    updateAutoStateChange,
    interval = AUTO_STATE_CHANGE_SECONDS
}) {
    let nextChange = 0;

    return {
        tick() {
            if (--nextChange <= 0) {
                nextChange = interval;
                updateAutoStateChange();
            }
        }
    };
}
