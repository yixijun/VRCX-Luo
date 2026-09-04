export const CACHE_CLEANUP_INITIAL_SECONDS = 86400;

/**
 * Creates the periodic VRCX cache cleanup task.
 *
 * @param {object} dependencies
 * @param {() => number} dependencies.getFrequency
 * @param {() => void} dependencies.clearCache
 * @param {number} [dependencies.initial=86400]
 * @returns {{ tick: () => void, setNext: (value: number) => void }}
 */
export function createCacheCleanupTask({
    getFrequency,
    clearCache,
    initial = CACHE_CLEANUP_INITIAL_SECONDS
}) {
    let nextCheck = initial;

    return {
        tick() {
            if (--nextCheck <= 0 && getFrequency() > 0) {
                nextCheck = getFrequency() / 2;
                clearCache();
            }
        },

        setNext(value) {
            nextCheck = value;
        }
    };
}
