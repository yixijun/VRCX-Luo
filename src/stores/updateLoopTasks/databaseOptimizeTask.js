export const DATABASE_OPTIMIZE_INITIAL_SECONDS = 3600;
export const DATABASE_OPTIMIZE_INTERVAL_SECONDS = 86400;

/**
 * Creates the periodic database optimization task.
 *
 * @param {object} dependencies
 * @param {() => Promise<unknown>} dependencies.optimize
 * @param {(error: unknown) => void} dependencies.onError
 * @param {number} [dependencies.initial=3600]
 * @param {number} [dependencies.interval=86400]
 * @returns {{ tick: () => void }}
 */
export function createDatabaseOptimizeTask({
    optimize,
    onError,
    initial = DATABASE_OPTIMIZE_INITIAL_SECONDS,
    interval = DATABASE_OPTIMIZE_INTERVAL_SECONDS
}) {
    let nextOptimize = initial;

    return {
        tick() {
            if (--nextOptimize <= 0) {
                nextOptimize = interval;
                optimize().catch(onError);
            }
        }
    };
}
