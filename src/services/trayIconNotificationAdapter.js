/**
 * Creates the host capability for updating the tray notification indicator.
 *
 * @param {object} dependencies
 * @param {boolean} dependencies.isLinux
 * @param {{setTrayIconNotification: (enabled: boolean) => void}} [dependencies.electronApi]
 * @param {{SetTrayIconNotification: (enabled: boolean) => void}} [dependencies.appApi]
 * @returns {(enabled: boolean) => void}
 */
export function createTrayIconNotificationAdapter({
    isLinux,
    electronApi,
    appApi
}) {
    const electron = /** @type {{setTrayIconNotification: (enabled: boolean) => void}} */ (electronApi);
    const app = /** @type {{SetTrayIconNotification: (enabled: boolean) => void}} */ (appApi);

    return function setTrayIconNotification(enabled) {
        if (isLinux) {
            electron.setTrayIconNotification(enabled);
            return;
        }
        app.SetTrayIconNotification(enabled);
    };
}

/**
 * Updates the tray notification indicator through the active host bridge.
 *
 * @param {boolean} enabled
 * @returns {void}
 */
export function setTrayIconNotification(enabled) {
    return createTrayIconNotificationAdapter({
        isLinux: LINUX,
        electronApi: window.electron,
        appApi: LINUX ? undefined : AppApi
    })(enabled);
}
