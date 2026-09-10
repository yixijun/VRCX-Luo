/**
 * Resolves the notification channels that should be played for the current
 * runtime state.  Keeping this decision pure makes the test-notification path
 * explicit without changing the normal condition-based behavior.
 *
 * @param {object} deps
 * @param {object} deps.notificationsSettingsStore
 * @param {object} deps.gameStore
 * @param {boolean} [deps.forceDisplay]
 * @returns {{playNotificationTTS: boolean, playDesktopToast: boolean, playOverlayToast: boolean, playOverlayNotification: boolean, playXSNotification: boolean, playOvrtHudNotifications: boolean, playOvrtWristNotifications: boolean}}
 */
export function resolveNotificationPlayback({
    notificationsSettingsStore,
    gameStore,
    forceDisplay = false
}) {
    const notiConditions = {
        Always: () => true,
        'Inside VR': () => gameStore.isSteamVRRunning,
        'Outside VR': () => !gameStore.isSteamVRRunning,
        'Game Closed': () => !gameStore.isGameRunning,
        'Game Running': () => gameStore.isGameRunning,
        'Desktop Mode': () => gameStore.isGameNoVR && gameStore.isGameRunning,
        AFK: () =>
            notificationsSettingsStore.afkDesktopToast &&
            gameStore.isHmdAfk &&
            gameStore.isGameRunning &&
            !gameStore.isGameNoVR
    };

    const matchesCondition = (name) => notiConditions[name]?.() === true;
    const playNotificationTTS =
        notificationsSettingsStore.traySilentMode !== true &&
        (forceDisplay ||
            matchesCondition(notificationsSettingsStore.notificationTTS));
    const playDesktopToast = forceDisplay
        ? notificationsSettingsStore.desktopNotificationsEnabled !== false
        : matchesCondition(notificationsSettingsStore.desktopToast) ||
          matchesCondition('AFK');
    const playOverlayToast = forceDisplay
        ? true
        : matchesCondition(notificationsSettingsStore.overlayToast);

    return {
        playNotificationTTS,
        playDesktopToast,
        playOverlayToast,
        playOverlayNotification:
            notificationsSettingsStore.overlayNotifications && playOverlayToast,
        playXSNotification:
            notificationsSettingsStore.xsNotifications && playOverlayToast,
        playOvrtHudNotifications:
            notificationsSettingsStore.ovrtHudNotifications && playOverlayToast,
        playOvrtWristNotifications:
            notificationsSettingsStore.ovrtWristNotifications &&
            playOverlayToast
    };
}
