import { describe, expect, it, vi } from 'vitest';

import { IPC_HANDLER_CONTRACT } from '../../../src-electron/ipcHandlers.cjs';
import { createClipboardAdapter } from '../clipboardAdapter';
import {
    createDirectoryDialogAdapter,
    createFileDialogAdapter
} from '../fileDialogAdapter';
import { HOST_CAPABILITY_CONTRACT } from '../hostCapabilityContract';

describe('CEF/Electron host capability contract', () => {
    it('keeps method names, argument shapes, and Electron channels explicit', () => {
        expect(HOST_CAPABILITY_CONTRACT).toEqual({
            clipboard: {
                result: 'string',
                cef: {
                    bridge: 'AppApi',
                    method: 'GetClipboard',
                    arguments: []
                },
                electron: {
                    bridge: 'window.electron',
                    method: 'getClipboardText',
                    channel: 'app:getClipboardText',
                    arguments: []
                },
                errors: { cef: 'empty-string', electron: 'propagate' }
            },
            fileDialog: {
                result: 'path',
                cef: {
                    bridge: 'AppApi',
                    method: 'OpenFileSelectorDialog',
                    arguments: ['defaultPath', 'defaultExt', 'defaultFilter'],
                    cancel: ''
                },
                electron: {
                    bridge: 'window.electron',
                    method: 'openFileDialog',
                    channel: 'dialog:openFile',
                    arguments: ['filters'],
                    cancel: null
                }
            },
            directoryDialog: {
                result: 'path',
                cef: {
                    bridge: 'AppApi',
                    method: 'OpenFolderSelectorDialog',
                    arguments: ['defaultPath'],
                    cancel: ''
                },
                electron: {
                    bridge: 'window.electron',
                    method: 'openDirectoryDialog',
                    channel: 'dialog:openDirectory',
                    arguments: [],
                    cancel: null
                }
            },
            desktopNotification: {
                result: 'void',
                cef: {
                    bridge: 'AppApi',
                    method: 'DesktopNotification',
                    arguments: ['boldText', 'text', 'image', 'silent']
                },
                electron: {
                    bridge: 'window.electron',
                    method: 'desktopNotification',
                    channel: 'notification:showNotification',
                    arguments: ['boldText', 'text', 'image', 'silent']
                }
            },
            trayIconNotification: {
                result: 'void',
                cef: {
                    bridge: 'AppApi',
                    method: 'SetTrayIconNotification',
                    arguments: ['notify']
                },
                electron: {
                    bridge: 'window.electron',
                    method: 'setTrayIconNotification',
                    channel: 'app:setTrayIconNotification',
                    arguments: ['notify']
                }
            },
            trayNotificationSnapshot: {
                result: 'void',
                cef: {
                    bridge: 'AppApi',
                    method: 'UpdateTrayNotifications',
                    arguments: ['json']
                },
                electron: {
                    bridge: 'window.electron',
                    method: 'updateTrayNotifications',
                    channel: 'app:updateTrayNotifications',
                    arguments: ['snapshot']
                }
            },
            vrState: {
                result: 'void',
                cef: {
                    bridge: 'AppApi',
                    method: 'SetVR',
                    arguments: [
                        'active',
                        'hmdOverlay',
                        'wristOverlay',
                        'menuButton',
                        'overlayHand'
                    ]
                },
                electron: {
                    bridge: 'window.electron',
                    method: 'updateVr',
                    channel: 'app:updateVr',
                    arguments: [
                        'active',
                        'hmdOverlay',
                        'wristOverlay',
                        'menuButton',
                        'overlayHand'
                    ]
                }
            }
        });

        const registeredChannels = IPC_HANDLER_CONTRACT.map(
            ([channel]) => channel
        );
        for (const capability of Object.values(HOST_CAPABILITY_CONTRACT)) {
            if (capability.electron.channel) {
                expect(registeredChannels).toContain(
                    capability.electron.channel
                );
            }
        }
    });

    it("preserves both hosts' invocation and cancellation semantics", async () => {
        const cefGetClipboard = vi.fn().mockResolvedValue('cef clipboard');
        const electronGetClipboard = vi
            .fn()
            .mockResolvedValue('electron clipboard');
        await expect(
            createClipboardAdapter({
                isLinux: false,
                appApi: { GetClipboard: cefGetClipboard },
                electronApi: { getClipboardText: electronGetClipboard },
                logError: vi.fn()
            })()
        ).resolves.toBe('cef clipboard');
        await expect(
            createClipboardAdapter({
                isLinux: true,
                appApi: { GetClipboard: cefGetClipboard },
                electronApi: { getClipboardText: electronGetClipboard }
            })()
        ).resolves.toBe('electron clipboard');
        expect(cefGetClipboard).toHaveBeenCalledWith();
        expect(electronGetClipboard).toHaveBeenCalledWith();

        const cefFile = vi.fn().mockResolvedValue('C:/picked.wav');
        const electronFile = vi.fn().mockResolvedValue('/picked.wav');
        await expect(
            createFileDialogAdapter({
                isWindows: true,
                appApi: { OpenFileSelectorDialog: cefFile }
            })({
                defaultPath: 'C:/',
                defaultExt: '.wav',
                defaultFilter: 'Audio (*.wav)|*.wav'
            })
        ).resolves.toBe('C:/picked.wav');
        await expect(
            createFileDialogAdapter({
                isWindows: false,
                electronApi: { openFileDialog: electronFile }
            })({ filters: [{ name: 'Audio', extensions: ['wav'] }] })
        ).resolves.toBe('/picked.wav');
        expect(cefFile).toHaveBeenCalledWith(
            'C:/',
            '.wav',
            'Audio (*.wav)|*.wav'
        );
        expect(electronFile).toHaveBeenCalledWith([
            { name: 'Audio', extensions: ['wav'] }
        ]);

        const cefDirectory = vi.fn().mockResolvedValue('C:/picked');
        const electronDirectory = vi.fn().mockResolvedValue('/picked');
        await expect(
            createDirectoryDialogAdapter({
                isWindows: true,
                appApi: { OpenFolderSelectorDialog: cefDirectory }
            })({ defaultPath: 'C:/' })
        ).resolves.toBe('C:/picked');
        await expect(
            createDirectoryDialogAdapter({
                isWindows: false,
                electronApi: { openDirectoryDialog: electronDirectory }
            })({ defaultPath: '/home' })
        ).resolves.toBe('/picked');
        expect(cefDirectory).toHaveBeenCalledWith('C:/');
        expect(electronDirectory).toHaveBeenCalledWith();

        await expect(
            createFileDialogAdapter({
                isWindows: true,
                appApi: {
                    OpenFileSelectorDialog: vi.fn().mockResolvedValue('')
                }
            })()
        ).resolves.toBe(HOST_CAPABILITY_CONTRACT.fileDialog.cef.cancel);
        await expect(
            createFileDialogAdapter({
                isWindows: false,
                electronApi: {
                    openFileDialog: vi.fn().mockResolvedValue(null)
                }
            })()
        ).resolves.toBe(HOST_CAPABILITY_CONTRACT.fileDialog.electron.cancel);
        await expect(
            createDirectoryDialogAdapter({
                isWindows: true,
                appApi: {
                    OpenFolderSelectorDialog: vi.fn().mockResolvedValue('')
                }
            })()
        ).resolves.toBe(HOST_CAPABILITY_CONTRACT.directoryDialog.cef.cancel);
        await expect(
            createDirectoryDialogAdapter({
                isWindows: false,
                electronApi: {
                    openDirectoryDialog: vi.fn().mockResolvedValue(null)
                }
            })()
        ).resolves.toBe(
            HOST_CAPABILITY_CONTRACT.directoryDialog.electron.cancel
        );
    });
});
