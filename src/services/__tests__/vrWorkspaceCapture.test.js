import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createVrWorkspaceCapture,
    validateInput
} from '../../../src-electron/vrWorkspaceCapture.cjs';

describe('Electron VR workspace transport', () => {
    let client, contents, capture, publish;
    beforeEach(() => {
        vi.useFakeTimers();
        client = {
            on: vi.fn(),
            removeListener: vi.fn(),
            isAttached: vi.fn(() => true),
            attach: vi.fn(),
            detach: vi.fn(),
            sendCommand: vi.fn(async (method) =>
                method === 'Page.getLayoutMetrics'
                    ? {
                          cssVisualViewport: {
                              clientWidth: 1000,
                              clientHeight: 800
                          }
                      }
                    : { data: 'frame' }
            )
        };
        contents = {
            debugger: client,
            isDestroyed: () => false,
            executeJavaScript: vi.fn()
        };
        publish = vi.fn();
        capture = createVrWorkspaceCapture({
            getWindow: () => ({
                webContents: contents,
                isDestroyed: () => false
            }),
            publish
        });
    });
    afterEach(async () => {
        await capture.setEnabled(false);
        vi.useRealTimers();
    });
    it('uses CSS viewport dimensions so zoom cannot truncate the click area', async () => {
        await capture.setEnabled(true);
        await vi.advanceTimersByTimeAsync(1);
        await capture.input({ type: 'up', x: 1, y: 1 });
        expect(client.sendCommand).toHaveBeenCalledWith(
            'Input.dispatchMouseEvent',
            expect.objectContaining({ x: 999.5, y: 799.5 })
        );
        expect(publish).toHaveBeenCalledWith(
            expect.stringContaining('data:image/jpeg;base64,frame')
        );
    });
    it('rejects input after close and restores the viewport without detaching existing developer tools', async () => {
        await capture.setEnabled(true);
        await capture.setEnabled(false);
        expect(await capture.input({ type: 'key', key: 'Enter' })).toBe(false);
        expect(client.sendCommand).toHaveBeenCalledWith(
            'Emulation.clearDeviceMetricsOverride'
        );
        expect(client.detach).not.toHaveBeenCalled();
    });
    it('expires capture when the dashboard stops renewing its lease', async () => {
        await capture.setEnabled(true);
        await vi.advanceTimersByTimeAsync(16000);
        expect(contents.executeJavaScript).toHaveBeenCalledWith(
            'window.closeVrWorkspace?.()'
        );
        expect(await capture.input({ type: 'key', key: 'Enter' })).toBe(false);
    });
    it('validates native input before passing it to Chromium', () => {
        expect(validateInput({ type: 'down', x: -0.1, y: 0 })).toBe(false);
        expect(validateInput({ type: 'text', text: '<中文>' })).toBe(true);
        expect(
            validateInput({ type: 'scroll', x: 0.5, y: 0.5, deltaY: Infinity })
        ).toBe(false);
        expect(validateInput({ type: 'key', key: 'F12' })).toBe(false);
    });
});
