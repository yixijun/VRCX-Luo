export const STEAMVR_START_STATUS = Object.freeze({
    STARTING: 'starting',
    RUNNING: 'running',
    TIMEOUT: 'timeout',
    ERROR: 'error',
    CANCELLED: 'cancelled'
});

export const STEAMVR_START_TIMEOUT_MS = 15_000;
export const STEAMVR_START_POLL_INTERVAL_MS = 500;

/**
 * Poll SteamVR's process state after a start command has been sent.
 *
 * @param {object} options
 * @param {() => Promise<boolean>} options.checkRunning
 * @param {number} [options.timeoutMs]
 * @param {number} [options.pollIntervalMs]
 * @param {(status: string) => void} [options.onStatus]
 * @returns {{ promise: Promise<{status: string, running: boolean, error?: unknown}>, cancel: () => void }}
 */
export function waitForSteamVRRunning({
    checkRunning,
    timeoutMs = STEAMVR_START_TIMEOUT_MS,
    pollIntervalMs = STEAMVR_START_POLL_INTERVAL_MS,
    onStatus
}) {
    if (typeof checkRunning !== 'function') {
        throw new TypeError('checkRunning must be a function');
    }

    let timerId = null;
    let settled = false;
    let resolveResult;
    const startedAt = Date.now();

    const promise = new Promise((resolve) => {
        resolveResult = resolve;
    });

    const finish = (result) => {
        if (settled) {
            return;
        }
        settled = true;
        if (timerId !== null) {
            clearTimeout(timerId);
            timerId = null;
        }
        onStatus?.(result.status);
        resolveResult(result);
    };

    const poll = async () => {
        if (settled) {
            return;
        }

        try {
            if (await checkRunning()) {
                finish({ status: STEAMVR_START_STATUS.RUNNING, running: true });
                return;
            }
        } catch (error) {
            finish({
                status: STEAMVR_START_STATUS.ERROR,
                running: false,
                error
            });
            return;
        }

        if (settled) {
            return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
            finish({ status: STEAMVR_START_STATUS.TIMEOUT, running: false });
            return;
        }
        timerId = setTimeout(poll, pollIntervalMs);
    };

    onStatus?.(STEAMVR_START_STATUS.STARTING);
    void poll();

    return {
        promise,
        cancel: () =>
            finish({ status: STEAMVR_START_STATUS.CANCELLED, running: false })
    };
}
