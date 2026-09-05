import { describe, expect, it, vi } from 'vitest';

import { registerIpcHandlers } from '../../../src-electron/ipcHandlers.cjs';

const handlerContracts = [
    ['callDotNetMethod', 'callDotNetMethod'],
    ['dialog:openFile', 'openFileDialog'],
    ['dialog:openDirectory', 'openDirectoryDialog'],
    ['notification:showNotification', 'showNotification'],
    ['app:restart', 'restartApp'],
    ['app:getOverlayWindow', 'getOverlayWindow'],
    ['app:updateVr', 'updateVr'],
    ['app:getArch', 'getArch'],
    ['app:getClipboardText', 'getClipboardText'],
    ['app:getNoUpdater', 'getNoUpdater'],
    ['app:setTrayIconNotification', 'setTrayIconNotification'],
    ['app:updateTrayNotifications', 'updateTrayNotifications'],
    ['app:setDesktopNotificationsEnabled', 'setDesktopNotificationsEnabled'],
    ['app:setTraySilentMode', 'setTraySilentMode'],
    ['app:setVSleepMode', 'setVSleepMode']
];

describe('registerIpcHandlers', () => {
    it('registers the stable Electron IPC handler contract in order', () => {
        const registrations = [];
        const ipcMain = {
            handle: vi.fn((channel, handler) => {
                registrations.push([channel, handler]);
            })
        };
        const handlers = Object.fromEntries(
            handlerContracts.map(([, name]) => [name, vi.fn()])
        );

        registerIpcHandlers({ ipcMain, handlers });

        expect(registrations.map(([channel]) => channel)).toEqual(
            handlerContracts.map(([channel]) => channel)
        );
        expect(registrations.map(([, handler]) => handler)).toEqual(
            handlerContracts.map(([, name]) => handlers[name])
        );
        expect(ipcMain.handle).toHaveBeenCalledTimes(handlerContracts.length);
    });

    it('applies an optional guard to every registered handler', () => {
        const registrations = [];
        const ipcMain = {
            handle: vi.fn((channel, handler) => {
                registrations.push([channel, handler]);
            })
        };
        const handlers = Object.fromEntries(
            handlerContracts.map(([, name]) => [name, vi.fn()])
        );
        const guardedHandlers = new Map();
        const guard = vi.fn((handler, channel) => {
            const guarded = vi.fn(handler);
            guardedHandlers.set(channel, guarded);
            return guarded;
        });

        registerIpcHandlers({ ipcMain, handlers, guard });

        expect(guard).toHaveBeenCalledTimes(handlerContracts.length);
        for (const [channel, handlerName] of handlerContracts) {
            expect(guard).toHaveBeenCalledWith(handlers[handlerName], channel);
            expect(guardedHandlers.get(channel)).toBe(
                registrations.find(
                    ([registeredChannel]) => registeredChannel === channel
                )?.[1]
            );
        }
    });
});
