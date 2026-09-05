/**
 * Creates the host clipboard capability used by direct-access actions.
 *
 * @param {object} dependencies
 * @param {boolean} dependencies.isLinux
 * @param {{getClipboardText: () => Promise<string>}} dependencies.electronApi
 * @param {{GetClipboard: () => Promise<string>}} [dependencies.appApi]
 * @param {(error: unknown) => void} [dependencies.logError]
 * @returns {() => Promise<string>}
 */
export function createClipboardAdapter({
    isLinux,
    electronApi,
    appApi,
    logError = console.log
}) {
    return async function getClipboardText() {
        if (isLinux) {
            return electronApi.getClipboardText();
        }

        return appApi.GetClipboard().catch((error) => {
            logError(error);
            return '';
        });
    };
}

/**
 * Reads clipboard text through the active host bridge.
 *
 * The host globals are resolved when called so tests and the renderer can
 * replace bridge implementations without rebuilding the store module.
 *
 * @returns {Promise<string>}
 */
export function getClipboardText() {
    return createClipboardAdapter({
        isLinux: LINUX,
        electronApi: window.electron,
        appApi: LINUX ? undefined : AppApi
    })();
}
