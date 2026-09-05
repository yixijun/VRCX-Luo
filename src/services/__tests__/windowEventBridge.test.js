import { describe, expect, it, vi } from 'vitest';

import { bindWindowEventBridge } from '../../../src-electron/windowEventBridge.cjs';

function createEmitter() {
    const handlers = new Map();
    return {
        on: vi.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        }),
        emit(eventName, ...args) {
            handlers.get(eventName)?.(...args);
        }
    };
}

function createWindow() {
    const window = createEmitter();
    const webContents = createEmitter();
    webContents.setZoomLevel = vi.fn();
    webContents.getZoomLevel = vi.fn(() => 1);
    webContents.send = vi.fn();
    webContents.setVisualZoomLevelLimits = vi.fn();
    window.webContents = webContents;
    window.getSize = vi.fn(() => [1280, 720]);
    window.getPosition = vi.fn(() => [12, -8]);
    return { window, webContents };
}

describe('window event bridge', () => {
    it('applies the initial zoom after load and configures visual zoom limits', () => {
        const { window, webContents } = createWindow();
        const setStorageValue = vi.fn();

        bindWindowEventBridge({
            window,
            initialZoomLevel: 1.5,
            setStorageValue
        });
        webContents.emit('did-finish-load');

        expect(webContents.setZoomLevel).toHaveBeenCalledWith(1.5);
        expect(webContents.send).toHaveBeenCalledWith('setZoomLevel', 1.5);
        expect(webContents.setVisualZoomLevelLimits).toHaveBeenCalledWith(1, 5);
        expect(setStorageValue).not.toHaveBeenCalled();
    });

    it('keeps keyboard and zoom-changed persistence semantics', () => {
        const { window, webContents } = createWindow();
        const setStorageValue = vi.fn();
        bindWindowEventBridge({
            window,
            initialZoomLevel: 0,
            setStorageValue
        });

        webContents.getZoomLevel
            .mockReturnValueOnce(1)
            .mockReturnValueOnce(2)
            .mockReturnValueOnce(3);
        webContents.emit('before-input-event', {}, { control: true, key: '=' });
        webContents.emit('before-input-event', {}, { control: true, key: '-' });
        webContents.emit('zoom-changed', {}, 'in');

        expect(webContents.setZoomLevel).toHaveBeenNthCalledWith(1, 2);
        expect(webContents.setZoomLevel).toHaveBeenNthCalledWith(2, 1);
        expect(webContents.setZoomLevel).toHaveBeenNthCalledWith(3, 4);
        expect(setStorageValue).toHaveBeenNthCalledWith(
            1,
            'VRCX_ZoomLevel',
            '2'
        );
        expect(setStorageValue).toHaveBeenNthCalledWith(
            2,
            'VRCX_ZoomLevel',
            '1'
        );
        expect(setStorageValue).toHaveBeenNthCalledWith(
            3,
            'VRCX_ZoomLevel',
            '4'
        );
    });

    it('forwards window geometry, state and focus events unchanged', () => {
        const { window, webContents } = createWindow();
        bindWindowEventBridge({
            window,
            initialZoomLevel: 0,
            setStorageValue: vi.fn()
        });

        window.emit('resize');
        window.emit('move');
        window.emit('maximize');
        window.emit('minimize');
        window.emit('unmaximize');
        window.emit('restore');
        window.emit('focus');

        expect(webContents.send).toHaveBeenNthCalledWith(1, 'setWindowSize', {
            width: '1280',
            height: '720'
        });
        expect(webContents.send).toHaveBeenNthCalledWith(2, 'setWindowPosition', {
            x: '12',
            y: '-8'
        });
        expect(webContents.send).toHaveBeenNthCalledWith(3, 'setWindowState', '2');
        expect(webContents.send).toHaveBeenNthCalledWith(4, 'setWindowState', '1');
        expect(webContents.send).toHaveBeenNthCalledWith(5, 'setWindowState', '0');
        expect(webContents.send).toHaveBeenNthCalledWith(6, 'setWindowState', '0');
        expect(webContents.send).toHaveBeenNthCalledWith(7, 'onBrowserFocus');
    });
});
