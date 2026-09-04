/**
 * Creates the Linux game-state task.
 *
 * The legacy loop has two independent Linux-only countdowns: one for reading
 * VRChat log lines and one for polling game/SteamVR state. They stay separate
 * here so their trigger periods and ordering remain unchanged.
 *
 * @param {object} dependencies
 * @param {boolean} dependencies.isLinux
 * @param {() => string[] | undefined | Promise<string[] | undefined>} dependencies.getLogLines
 * @param {(logLine: string) => void} dependencies.addGameLogEvent
 * @param {() => Promise<boolean>} dependencies.getIsGameRunning
 * @param {() => Promise<boolean>} dependencies.getIsSteamVRRunning
 * @param {(isGameRunning: boolean, isSteamVRRunning: boolean) => Promise<void>} dependencies.updateIsGameRunning
 * @param {() => void} dependencies.initVr
 * @returns {{ tick: () => void | Promise<void> }}
 */
export function createGameStateTask({
    isLinux,
    getLogLines,
    addGameLogEvent,
    getIsGameRunning,
    getIsSteamVRRunning,
    updateIsGameRunning,
    initVr
}) {
    let nextGetLogCheck = 0;
    let nextGameRunningCheck = 0;

    return {
        tick() {
            if (!isLinux) {
                return;
            }

            const readLogLines = () => {
                nextGetLogCheck = 0.5;
                return Promise.resolve(getLogLines()).then((logLines) => {
                    if (logLines) {
                        logLines.forEach((logLine) => {
                            addGameLogEvent(logLine);
                        });
                    }
                    return checkGameState();
                });
            };

            const checkGameState = () => {
                if (--nextGameRunningCheck > 0) {
                    return;
                }

                nextGameRunningCheck = 1;
                return Promise.resolve(getIsGameRunning())
                    .then((isGameRunning) =>
                        Promise.resolve(getIsSteamVRRunning()).then(
                            (isSteamVRRunning) =>
                                Promise.resolve(
                                    updateIsGameRunning(
                                        isGameRunning,
                                        isSteamVRRunning
                                    )
                                )
                        )
                    )
                    .then(() => initVr());
            };

            if (--nextGetLogCheck <= 0) {
                return readLogLines();
            }

            return checkGameState();
        }
    };
}
