import { describe, expect, it, vi } from 'vitest';

import { createTrayIconNotificationAdapter } from '../trayIconNotificationAdapter';

describe('tray icon notification adapter', () => {
    it('routes notification state to the Electron host on Linux', () => {
        const electronApi = { setTrayIconNotification: vi.fn() };
        const appApi = { SetTrayIconNotification: vi.fn() };
        const setTrayIconNotification = createTrayIconNotificationAdapter({
            isLinux: true,
            electronApi,
            appApi
        });

        setTrayIconNotification(true);

        expect(electronApi.setTrayIconNotification).toHaveBeenCalledWith(true);
        expect(appApi.SetTrayIconNotification).not.toHaveBeenCalled();
    });

    it('routes notification state to the CEF host outside Linux', () => {
        const electronApi = { setTrayIconNotification: vi.fn() };
        const appApi = { SetTrayIconNotification: vi.fn() };
        const setTrayIconNotification = createTrayIconNotificationAdapter({
            isLinux: false,
            electronApi,
            appApi
        });

        setTrayIconNotification(false);

        expect(appApi.SetTrayIconNotification).toHaveBeenCalledWith(false);
        expect(electronApi.setTrayIconNotification).not.toHaveBeenCalled();
    });
});
