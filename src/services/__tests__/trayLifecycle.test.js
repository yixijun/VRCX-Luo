import { describe, expect, it, vi } from 'vitest';

import {
    destroyTray,
    setTrayIcon
} from '../../../src-electron/trayLifecycle.cjs';

describe('tray lifecycle', () => {
    it('destroys and clears an existing tray', () => {
        const tray = { destroy: vi.fn() };
        const setTray = vi.fn();

        destroyTray({ getTray: () => tray, setTray });

        expect(tray.destroy).toHaveBeenCalledOnce();
        expect(setTray).toHaveBeenCalledWith(null);
    });

    it('does nothing when no tray exists', () => {
        const setTray = vi.fn();

        destroyTray({ getTray: () => null, setTray });

        expect(setTray).not.toHaveBeenCalled();
    });

    it('preserves normal and notification icon selection', () => {
        const tray = { setImage: vi.fn() };
        const getTray = () => tray;

        setTrayIcon({
            getTray,
            trayIcon: 'normal.ico',
            trayIconNotify: 'notify.ico',
            notify: false
        });
        setTrayIcon({
            getTray,
            trayIcon: 'normal.ico',
            trayIconNotify: 'notify.ico',
            notify: true
        });

        expect(tray.setImage).toHaveBeenNthCalledWith(1, 'normal.ico');
        expect(tray.setImage).toHaveBeenNthCalledWith(2, 'notify.ico');
    });
});
