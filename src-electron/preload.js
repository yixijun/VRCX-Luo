/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { contextBridge, ipcRenderer, app } = require('electron');
const { assertAllowedDotNetCall } = require('./dotnetCapabilityManifest.cjs');

const managedListeners = new Map();

function registerManagedListener(channel, callback, mapKey = channel) {
    const existingListener = managedListeners.get(mapKey);
    if (existingListener) {
        ipcRenderer.removeListener(channel, existingListener);
    }

    const listener = (event, ...args) => callback(event, ...args);
    managedListeners.set(mapKey, listener);
    ipcRenderer.on(channel, listener);

    return () => {
        const currentListener = managedListeners.get(mapKey);
        if (currentListener === listener) {
            ipcRenderer.removeListener(channel, listener);
            managedListeners.delete(mapKey);
        }
    };
}

contextBridge.exposeInMainWorld('interopApi', {
    callDotNetMethod: (className, methodName, args) => {
        assertAllowedDotNetCall(className, methodName, args);
        return ipcRenderer.invoke(
            'callDotNetMethod',
            className,
            methodName,
            args
        );
    }
});

const validChannels = ['launch-command'];

contextBridge.exposeInMainWorld('electron', {
    protectLocalSecret: (value) =>
        ipcRenderer.invoke('app:protectLocalSecret', value),
    unprotectLocalSecret: (value) =>
        ipcRenderer.invoke('app:unprotectLocalSecret', value),
    setVrWorkspaceCapture: (enabled) =>
        ipcRenderer.invoke('app:setVrWorkspaceCapture', enabled),
    sendVrWorkspaceInput: (input) =>
        ipcRenderer.invoke('app:sendVrWorkspaceInput', input),
    getArch: () => ipcRenderer.invoke('app:getArch'),
    setThemeSource: (source) =>
        ipcRenderer.invoke('app:setThemeSource', source),
    onSystemThemeChanged: (callback) =>
        registerManagedListener('systemThemeChanged', callback),
    getClipboardText: () => ipcRenderer.invoke('app:getClipboardText'),
    getNoUpdater: () => ipcRenderer.invoke('app:getNoUpdater'),
    setTrayIconNotification: (notify) =>
        ipcRenderer.invoke('app:setTrayIconNotification', notify),
    updateTrayNotifications: (snapshot) =>
        ipcRenderer.invoke('app:updateTrayNotifications', snapshot),
    onTrayNotificationAction: (callback) =>
        registerManagedListener('tray-notification-action', (_event, payload) =>
            callback(payload)
        ),
    setDesktopNotificationsEnabled: (enabled) =>
        ipcRenderer.invoke('app:setDesktopNotificationsEnabled', enabled),
    setTraySilentMode: (enabled) =>
        ipcRenderer.invoke('app:setTraySilentMode', enabled),
    setVSleepMode: (enabled) =>
        ipcRenderer.invoke('app:setVSleepMode', enabled),
    onDesktopNotificationsUpdated: (callback) =>
        registerManagedListener(
            'desktop-notifications-updated',
            (_event, enabled) => callback(enabled)
        ),
    onTraySilentModeUpdated: (callback) =>
        registerManagedListener('tray-silent-mode-updated', (_event, enabled) =>
            callback(enabled)
        ),
    onVSleepModeUpdated: (callback) =>
        registerManagedListener('v-sleep-mode-updated', (_event, enabled) =>
            callback(enabled)
        ),
    openFileDialog: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
    openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
    onWindowPositionChanged: (callback) =>
        registerManagedListener('setWindowPosition', callback),
    onWindowSizeChanged: (callback) =>
        registerManagedListener('setWindowSize', callback),
    onWindowStateChange: (callback) =>
        registerManagedListener('setWindowState', callback),
    onZoomLevelChanged: (callback) =>
        registerManagedListener('setZoomLevel', callback),
    onBrowserFocus: (callback) =>
        registerManagedListener('onBrowserFocus', callback),
    onBrowserBlur: (callback) =>
        registerManagedListener('onBrowserBlur', callback),
    desktopNotification: (title, body, icon, silent) =>
        ipcRenderer.invoke(
            'notification:showNotification',
            title,
            body,
            icon,
            silent
        ),
    restartApp: () => ipcRenderer.invoke('app:restart'),
    getOverlayWindow: () => ipcRenderer.invoke('app:getOverlayWindow'),
    updateVr: (active, hmdOverlay, wristOverlay, menuButton, overlayHand) =>
        ipcRenderer.invoke(
            'app:updateVr',
            active,
            hmdOverlay,
            wristOverlay,
            menuButton,
            overlayHand
        ),
    ipcRenderer: {
        on(channel, func) {
            if (validChannels.includes(channel)) {
                return registerManagedListener(
                    channel,
                    (_event, ...args) => func(...args),
                    `ipcRenderer:${channel}`
                );
            }

            return undefined;
        }
    }
});
