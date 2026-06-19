/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { contextBridge, ipcRenderer, app } = require('electron');

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
    getArch: () => ipcRenderer.invoke('app:getArch'),
    getClipboardText: () => ipcRenderer.invoke('app:getClipboardText'),
    getNoUpdater: () => ipcRenderer.invoke('app:getNoUpdater'),
    setTrayIconNotification: (notify) =>
        ipcRenderer.invoke('app:setTrayIconNotification', notify),
    setDesktopNotificationsEnabled: (enabled) =>
        ipcRenderer.invoke('app:setDesktopNotificationsEnabled', enabled),
    onDesktopNotificationsUpdated: (callback) =>
        registerManagedListener(
            'desktop-notifications-updated',
            (_event, enabled) => callback(enabled)
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
