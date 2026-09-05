import { describe, expect, it, vi } from 'vitest';

import {
    applyStoredWindowState,
    readWindowConfig
} from '../../../src-electron/windowState.cjs';

function createStorage(values) {
    return (key) => values[key];
}

function createWindow() {
    return {
        hide: vi.fn(),
        minimize: vi.fn(),
        maximize: vi.fn(),
        restore: vi.fn()
    };
}

describe('window state', () => {
    it('reads persisted bounds and zoom with the existing defaults', () => {
        expect(
            readWindowConfig({
                getValue: createStorage({
                    VRCX_LocationX: '12',
                    VRCX_LocationY: '-8',
                    VRCX_SizeWidth: '1280',
                    VRCX_SizeHeight: '720',
                    VRCX_ZoomLevel: '1.5'
                })
            })
        ).toEqual({
            x: 12,
            y: -8,
            width: 1280,
            height: 720,
            zoomLevel: 1.5
        });

        expect(
            readWindowConfig({ getValue: createStorage({}) })
        ).toEqual({ x: 0, y: 0, width: 1920, height: 1080, zoomLevel: 0 });
    });

    it('minimizes or hides only for the startup minimized path', () => {
        const minimizedWindow = createWindow();
        const closeToTray = vi.fn(() => false);
        applyStoredWindowState(minimizedWindow, {
            getValue: createStorage({ VRCX_StartAsMinimizedState: 'true' }),
            startup: true,
            getCloseToTray: closeToTray
        });
        expect(minimizedWindow.minimize).toHaveBeenCalledOnce();
        expect(minimizedWindow.hide).not.toHaveBeenCalled();
        expect(closeToTray).toHaveBeenCalledOnce();

        const trayWindow = createWindow();
        applyStoredWindowState(trayWindow, {
            getValue: createStorage({ VRCX_StartAsMinimizedState: 'true' }),
            startup: true,
            getCloseToTray: () => true
        });
        expect(trayWindow.hide).toHaveBeenCalledOnce();
        expect(trayWindow.minimize).not.toHaveBeenCalled();
    });

    it('keeps legacy persisted state parsing for minimize and maximize', () => {
        for (const [state, method] of [
            ['1', 'minimize'],
            ['2', 'maximize']
        ]) {
            const window = createWindow();
            applyStoredWindowState(window, {
                getValue: createStorage({ VRCX_WindowState: state }),
                startup: false,
                getCloseToTray: () => false
            });
            expect(window[method]).toHaveBeenCalledOnce();
        }

        const legacyZeroWindow = createWindow();
        applyStoredWindowState(legacyZeroWindow, {
            getValue: createStorage({ VRCX_WindowState: '0' }),
            startup: false,
            getCloseToTray: () => false
        });
        expect(legacyZeroWindow.restore).not.toHaveBeenCalled();
    });

    it('does not read close-to-tray or operate the window for an inactive state', () => {
        const window = createWindow();
        const getCloseToTray = vi.fn();
        applyStoredWindowState(window, {
            getValue: createStorage({ VRCX_WindowState: '9' }),
            startup: false,
            getCloseToTray
        });
        expect(getCloseToTray).not.toHaveBeenCalled();
        expect(window.hide).not.toHaveBeenCalled();
        expect(window.minimize).not.toHaveBeenCalled();
        expect(window.maximize).not.toHaveBeenCalled();
        expect(window.restore).not.toHaveBeenCalled();
    });
});
