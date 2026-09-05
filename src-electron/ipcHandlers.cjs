/**
 * Registers the Electron main-process IPC handler contract.
 *
 * Handler implementations are assembled by the composition root and passed
 * in as a map. Keeping channel registration here makes the IPC surface
 * independently testable without loading Electron or the main process.
 */
const IPC_HANDLER_CONTRACT = Object.freeze([
    Object.freeze(['callDotNetMethod', 'callDotNetMethod']),
    Object.freeze(['dialog:openFile', 'openFileDialog']),
    Object.freeze(['dialog:openDirectory', 'openDirectoryDialog']),
    Object.freeze(['notification:showNotification', 'showNotification']),
    Object.freeze(['app:restart', 'restartApp']),
    Object.freeze(['app:getOverlayWindow', 'getOverlayWindow']),
    Object.freeze(['app:updateVr', 'updateVr']),
    Object.freeze(['app:getArch', 'getArch']),
    Object.freeze(['app:getClipboardText', 'getClipboardText']),
    Object.freeze(['app:getNoUpdater', 'getNoUpdater']),
    Object.freeze(['app:setTrayIconNotification', 'setTrayIconNotification']),
    Object.freeze(['app:updateTrayNotifications', 'updateTrayNotifications']),
    Object.freeze([
        'app:setDesktopNotificationsEnabled',
        'setDesktopNotificationsEnabled'
    ]),
    Object.freeze(['app:setTraySilentMode', 'setTraySilentMode']),
    Object.freeze(['app:setVSleepMode', 'setVSleepMode'])
]);

function registerIpcHandlers({ ipcMain, handlers }) {
    for (const [channel, handlerName] of IPC_HANDLER_CONTRACT) {
        ipcMain.handle(channel, handlers[handlerName]);
    }
}

module.exports = { IPC_HANDLER_CONTRACT, registerIpcHandlers };
