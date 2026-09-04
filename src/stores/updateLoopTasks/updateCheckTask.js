export const APP_UPDATE_CHECK_SECONDS = 3600;

/**
 * Creates the periodic application update/backup task.
 *
 * @param {object} dependencies
 * @param {() => string} dependencies.getAutoUpdateMode
 * @param {() => void} dependencies.checkForVRCXUpdate
 * @param {() => void} dependencies.tryAutoBackupVrcRegistry
 * @param {number} [dependencies.interval=3600]
 * @returns {{ tick: () => void }}
 */
export function createUpdateCheckTask({
    getAutoUpdateMode,
    checkForVRCXUpdate,
    tryAutoBackupVrcRegistry,
    interval = APP_UPDATE_CHECK_SECONDS
}) {
    let nextCheck = interval;

    return {
        tick() {
            if (--nextCheck > 0) {
                return;
            }

            nextCheck = interval;
            if (getAutoUpdateMode() !== 'Off') {
                checkForVRCXUpdate();
            }
            tryAutoBackupVrcRegistry();
        }
    };
}
