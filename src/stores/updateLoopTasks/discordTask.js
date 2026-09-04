export const DISCORD_UPDATE_SECONDS = 3;

/**
 * Creates the periodic Discord presence task.
 *
 * @param {object} dependencies
 * @param {() => boolean} dependencies.isActive
 * @param {() => void} dependencies.updateDiscord
 * @param {number} [dependencies.interval=3]
 * @returns {{ tick: () => void, setNext: (value: number) => void }}
 */
export function createDiscordTask({
    isActive,
    updateDiscord,
    interval = DISCORD_UPDATE_SECONDS
}) {
    let nextUpdate = 0;

    return {
        tick() {
            if (--nextUpdate > 0) {
                return;
            }

            nextUpdate = interval;
            if (isActive()) {
                updateDiscord();
            }
        },

        setNext(value) {
            nextUpdate = value;
        }
    };
}
