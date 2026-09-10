import { describe, expect, test } from 'vitest';

import { resolveNotificationPlayback } from '../notificationPlayback';

function makeSettings(overrides = {}) {
    return {
        desktopNotificationsEnabled: true,
        desktopToast: 'Desktop Mode',
        overlayToast: 'Game Running',
        overlayNotifications: true,
        xsNotifications: true,
        ovrtHudNotifications: true,
        ovrtWristNotifications: true,
        traySilentMode: false,
        notificationTTS: 'Game Running',
        afkDesktopToast: false,
        ...overrides
    };
}

function makeGame(overrides = {}) {
    return {
        isSteamVRRunning: false,
        isGameRunning: false,
        isGameNoVR: false,
        isHmdAfk: false,
        ...overrides
    };
}

describe('resolveNotificationPlayback', () => {
    test('keeps normal channel conditions unchanged outside a running game', () => {
        const result = resolveNotificationPlayback({
            notificationsSettingsStore: makeSettings(),
            gameStore: makeGame()
        });

        expect(result.playDesktopToast).toBe(false);
        expect(result.playOverlayToast).toBe(false);
        expect(result.playNotificationTTS).toBe(false);
        expect(result.playOverlayNotification).toBe(false);
    });

    test('forces the test notification through enabled channels', () => {
        const result = resolveNotificationPlayback({
            notificationsSettingsStore: makeSettings(),
            gameStore: makeGame(),
            forceDisplay: true
        });

        expect(result.playDesktopToast).toBe(true);
        expect(result.playOverlayToast).toBe(true);
        expect(result.playNotificationTTS).toBe(true);
        expect(result.playOverlayNotification).toBe(true);
        expect(result.playXSNotification).toBe(true);
        expect(result.playOvrtHudNotifications).toBe(true);
        expect(result.playOvrtWristNotifications).toBe(true);
    });

    test('still honors disabled desktop notifications for a forced test', () => {
        const result = resolveNotificationPlayback({
            notificationsSettingsStore: makeSettings({
                desktopNotificationsEnabled: false
            }),
            gameStore: makeGame(),
            forceDisplay: true
        });

        expect(result.playDesktopToast).toBe(false);
        expect(result.playOverlayToast).toBe(true);
    });
});
