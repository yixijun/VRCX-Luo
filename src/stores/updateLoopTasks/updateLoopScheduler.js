export const UPDATE_LOOP_INTERVAL_MS = 1000;

/**
 * Creates the recursive update-loop scheduler.
 *
 * The scheduler owns only execution order, login gating, timer wiring and
 * error forwarding. Individual tasks own their countdowns and side effects.
 *
 * @param {object} dependencies
 * @param {Array<{ tick: () => void | Promise<void> }>} dependencies.tasks
 * @param {() => boolean} dependencies.isLoggedIn
 * @param {(error: unknown) => void} dependencies.onError
 * @param {(callback: () => void, delay: number) => unknown} dependencies.setTimeout
 * @param {(timeoutId: unknown) => void} dependencies.clearTimeout
 * @param {number} [dependencies.intervalMs=1000]
 * @returns {{ start: () => Promise<void>, stop: () => void }}
 */
export function createUpdateLoopScheduler({
    tasks,
    isLoggedIn,
    onError,
    setTimeout,
    clearTimeout,
    intervalMs = UPDATE_LOOP_INTERVAL_MS
}) {
    let running = false;
    let timeoutId;

    async function runCycle() {
        try {
            if (isLoggedIn()) {
                for (const task of tasks) {
                    const result = task.tick();
                    if (result && typeof result.then === 'function') {
                        await result;
                    }
                }
            }
        } catch (error) {
            onError(error);
        }

        if (running) {
            timeoutId = setTimeout(() => {
                void runCycle();
            }, intervalMs);
        }
    }

    return {
        start() {
            running = true;
            return runCycle();
        },

        stop() {
            running = false;
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
            }
        }
    };
}
