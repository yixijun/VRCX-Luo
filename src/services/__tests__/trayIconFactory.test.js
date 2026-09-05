import { describe, expect, it, vi } from 'vitest';

import { createTrayInstance } from '../../../src-electron/trayIconFactory.cjs';

function createHarness(platform) {
    const resize = vi.fn((size) => ({ platform, size }));
    const nativeImage = {
        createFromPath: vi.fn(() => ({ resize }))
    };
    const Tray = vi.fn(function Tray(icon) {
        this.icon = icon;
    });
    const path = {
        join: vi.fn((...parts) => parts.join('/'))
    };

    return {
        result: createTrayInstance({
            platform,
            nativeImage,
            Tray,
            path,
            rootDir: '/app'
        }),
        nativeImage,
        resize,
        Tray,
        path
    };
}

describe('tray icon factory', () => {
    it('keeps Windows icon paths and Tray construction', () => {
        const harness = createHarness('win32');

        expect(harness.result.trayIcon).toBe('/app/images/VRCX.ico');
        expect(harness.result.trayIconNotify).toBe(
            '/app/images/VRCX_notify.ico'
        );
        expect(harness.result.tray.icon).toBe(harness.result.trayIcon);
        expect(harness.Tray).toHaveBeenCalledWith('/app/images/VRCX.ico');
        expect(harness.nativeImage.createFromPath).not.toHaveBeenCalled();
    });

    it.each([
        ['darwin', 16],
        ['linux', 64]
    ])('keeps %s icon resize dimensions', (platform, dimension) => {
        const harness = createHarness(platform);

        expect(harness.nativeImage.createFromPath).toHaveBeenNthCalledWith(
            1,
            '/app/images/VRCX.png'
        );
        expect(harness.nativeImage.createFromPath).toHaveBeenNthCalledWith(
            2,
            '/app/images/VRCX_notify.png'
        );
        expect(harness.resize).toHaveBeenNthCalledWith(1, {
            width: dimension,
            height: dimension
        });
        expect(harness.resize).toHaveBeenNthCalledWith(2, {
            width: dimension,
            height: dimension
        });
        expect(harness.result.tray.icon).toBe(harness.result.trayIcon);
    });
});
