import { describe, expect, it } from 'vitest';

import {
    canRequestBrowserNotificationPermission,
    collectFreshNotifications,
    getBrowserNotificationState
} from '../remoteNotifications';

describe('remote browser notifications', () => {
    it('does not request browser notification permission on insecure LAN pages', () => {
        const state = getBrowserNotificationState({
            notificationApi: { permission: 'default' },
            isSecureContext: false,
            hostname: '192.168.2.174'
        });

        expect(state).toBe('insecure');
        expect(canRequestBrowserNotificationPermission(state)).toBe(false);
    });

    it('allows one active permission request only when permission is still default', () => {
        expect(canRequestBrowserNotificationPermission('default')).toBe(true);
        expect(canRequestBrowserNotificationPermission('default', true)).toBe(
            false
        );
        expect(canRequestBrowserNotificationPermission('denied')).toBe(false);
        expect(canRequestBrowserNotificationPermission('granted')).toBe(false);
    });

    it('reports only notifications that were not in the previous snapshot', () => {
        const result = collectFreshNotifications(new Set(['one']), [
            { id: 'one', senderUsername: 'Old' },
            { id: 'two', senderUsername: 'New' }
        ]);

        expect([...result.currentIds]).toEqual(['one', 'two']);
        expect(result.fresh).toEqual([{ id: 'two', senderUsername: 'New' }]);
    });
});
