/**
 * Creates the Linux game-state task.
 *
 * The legacy loop has two independent Linux-only countdowns: one for reading
 * VRChat log lines and one for polling game/SteamVR state. They stay separate
 * here so their trigger periods and ordering remain unchanged.
 *
 * @param {object} dependencies
 * @param {boolean} dependencies.isLinux
 * @param {() => Promise<string[] | undefined>} dependencies.getLogLines
 * @param {(logLine: string) => void} dependencies.addGameLogEvent
 * @param {() => Promise<boolean>} dependencies.getIsGameRunning
 * @param {() => Promise<boolean>} dependencies.getIsSteamVRRunning
 * @param {(isGameRunning: boolean, isSteamVRRunning: boolean) => Promise<void>} dependencies.updateIsGameRunning
 * @param {() => void} dependencies.initVr
 * @returns {{ tick: () => Promise<void> }}
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
        async tick() {
            if (!isLinux) {
                return;
            }

            if (--nextGetLogCheck <= 0) {
                nextGetLogCheck = 0.5;
                const logLines = await getLogLines();
                if (logLines) {
                    logLines.forEach((logLine) => {
                        addGameLogEvent(logLine);
                    });
                }
            }

            if (--nextGameRunningCheck <= 0) {
                nextGameRunningCheck = 1;
                const isGameRunning = await getIsGameRunning();
                const isSteamVRRunning = await getIsSteamVRRunning();
                await updateIsGameRunning(isGameRunning, isSteamVRRunning);
                initVr();
            }
        }
    };
}
