/**
 * Shared CEF/Electron host capability inventory.
 *
 * This is a data-only contract. It records the intentional differences in
 * bridge names, argument shapes, Electron IPC channels, and cancellation or
 * error semantics without changing either host implementation.
 */
export const HOST_CAPABILITY_CONTRACT = Object.freeze({
    clipboard: Object.freeze({
        result: 'string',
        cef: Object.freeze({
            bridge: 'AppApi',
            method: 'GetClipboard',
            arguments: Object.freeze([])
        }),
        electron: Object.freeze({
            bridge: 'window.electron',
            method: 'getClipboardText',
            channel: 'app:getClipboardText',
            arguments: Object.freeze([])
        }),
        errors: Object.freeze({ cef: 'empty-string', electron: 'propagate' })
    }),
    fileDialog: Object.freeze({
        result: 'path',
        cef: Object.freeze({
            bridge: 'AppApi',
            method: 'OpenFileSelectorDialog',
            arguments: Object.freeze([
                'defaultPath',
                'defaultExt',
                'defaultFilter'
            ]),
            cancel: ''
        }),
        electron: Object.freeze({
            bridge: 'window.electron',
            method: 'openFileDialog',
            channel: 'dialog:openFile',
            arguments: Object.freeze(['filters']),
            cancel: null
        })
    }),
    directoryDialog: Object.freeze({
        result: 'path',
        cef: Object.freeze({
            bridge: 'AppApi',
            method: 'OpenFolderSelectorDialog',
            arguments: Object.freeze(['defaultPath']),
            cancel: ''
        }),
        electron: Object.freeze({
            bridge: 'window.electron',
            method: 'openDirectoryDialog',
            channel: 'dialog:openDirectory',
            arguments: Object.freeze([]),
            cancel: null
        })
    }),
    desktopNotification: Object.freeze({
        result: 'void',
        cef: Object.freeze({
            bridge: 'AppApi',
            method: 'DesktopNotification',
            arguments: Object.freeze(['boldText', 'text', 'image', 'silent'])
        }),
        electron: Object.freeze({
            bridge: 'window.electron',
            method: 'desktopNotification',
            channel: 'notification:showNotification',
            arguments: Object.freeze(['boldText', 'text', 'image', 'silent'])
        })
    }),
    trayIconNotification: Object.freeze({
        result: 'void',
        cef: Object.freeze({
            bridge: 'AppApi',
            method: 'SetTrayIconNotification',
            arguments: Object.freeze(['notify'])
        }),
        electron: Object.freeze({
            bridge: 'window.electron',
            method: 'setTrayIconNotification',
            channel: 'app:setTrayIconNotification',
            arguments: Object.freeze(['notify'])
        })
    }),
    trayNotificationSnapshot: Object.freeze({
        result: 'void',
        cef: Object.freeze({
            bridge: 'AppApi',
            method: 'UpdateTrayNotifications',
            arguments: Object.freeze(['json'])
        }),
        electron: Object.freeze({
            bridge: 'window.electron',
            method: 'updateTrayNotifications',
            channel: 'app:updateTrayNotifications',
            arguments: Object.freeze(['snapshot'])
        })
    }),
    vrState: Object.freeze({
        result: 'void',
        cef: Object.freeze({
            bridge: 'AppApi',
            method: 'SetVR',
            arguments: Object.freeze([
                'active',
                'hmdOverlay',
                'wristOverlay',
                'menuButton',
                'overlayHand'
            ])
        }),
        electron: Object.freeze({
            bridge: 'window.electron',
            method: 'updateVr',
            channel: 'app:updateVr',
            arguments: Object.freeze([
                'active',
                'hmdOverlay',
                'wristOverlay',
                'menuButton',
                'overlayHand'
            ])
        })
    })
});
