import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createPinia,
    disposePinia,
    getActivePinia,
    setActivePinia
} from 'pinia';

const mocks = vi.hoisted(() => ({
    notifications: {
        openVR: true,
        vSleepMode: false,
        overlayNotifications: true,
        notificationPosition: 'topCenter',
        notificationTimeout: 3000
    },
    advanced: {
        progressPie: false,
        progressPieFilter: false,
        notificationOpacity: 80
    },
    wrist: {
        steamVrDashboard: true,
        openVRAlways: false,
        overlayWrist: true,
        overlaybutton: false,
        overlayHand: '1',
        hideUptimeFromFeed: false
    },
    game: {
        isSteamVRRunning: true,
        isGameRunning: true,
        isGameNoVR: false,
        setIsHmdAfk: vi.fn()
    },
    setVR: vi.fn(),
    workspaceCommand: vi.fn(async () => {})
}));

vi.mock('../../services/vrWorkspace', () => ({
    handleVrWorkspaceCommand: mocks.workspaceCommand
}));

vi.mock('../../shared/utils', () => ({
    isRpcWorld: vi.fn(() => true)
}));

vi.mock('../../services/watchState', () => ({
    watchState: {
        isFriendsLoaded: false
    }
}));

vi.mock('../settings/advanced', () => ({
    useAdvancedSettingsStore: () => mocks.advanced
}));

vi.mock('../settings/appearance', () => ({
    useAppearanceSettingsStore: () => ({
        isDarkMode: false,
        dtHour12: false,
        appLanguage: 'zh-CN'
    })
}));

vi.mock('../friend', () => ({
    useFriendStore: () => ({
        updateOnlineFriendCounter: vi.fn()
    })
}));

vi.mock('../game', () => ({
    useGameStore: () => mocks.game
}));

vi.mock('../gameLog', () => ({
    useGameLogStore: () => ({
        nowPlaying: {}
    })
}));

vi.mock('../location', () => ({
    useLocationStore: () => ({
        lastLocation: {
            date: '',
            location: '',
            name: '',
            playerList: new Map(),
            friendList: new Map()
        }
    })
}));

vi.mock('../settings/notifications', () => ({
    useNotificationsSettingsStore: () => mocks.notifications
}));

vi.mock('../photon', () => ({
    usePhotonStore: () => ({
        photonEventOverlay: false,
        timeoutHudOverlay: false,
        photonOverlayMessageTimeout: 3000
    })
}));

vi.mock('../sharedFeed', () => ({
    useSharedFeedStore: () => ({
        sendSharedFeed: vi.fn()
    })
}));

vi.mock('../user', () => ({
    useUserStore: () => ({
        currentUser: {
            $online_for: null
        }
    })
}));

vi.mock('../settings/wristOverlay', () => ({
    useWristOverlaySettingsStore: () => mocks.wrist
}));

globalThis.AppApi = {
    SetVR: (...args) => mocks.setVR(...args),
    ExecuteVrOverlayFunction: vi.fn()
};
globalThis.LINUX = false;

import { useVrStore } from '../vr';

describe('useVrStore', () => {
    afterEach(() => {
        disposePinia(getActivePinia());
        delete AppApi.GetDashboardActions;
        vi.useRealTimers();
    });
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mocks.notifications.openVR = true;
        mocks.notifications.vSleepMode = false;
        mocks.notifications.overlayNotifications = true;
        mocks.wrist.overlayWrist = true;
        mocks.wrist.steamVrDashboard = true;
        mocks.game.isSteamVRRunning = true;
        mocks.game.isGameRunning = true;
        mocks.game.isGameNoVR = false;
    });

    it('keeps wrist overlay while V sleep mode disables HMD overlay notifications', () => {
        mocks.notifications.vSleepMode = true;
        const store = useVrStore();

        store.updateOpenVR();

        expect(mocks.setVR).toHaveBeenCalledWith(true, false, true, false, 1);
    });

    it('enables HMD overlay notifications when V sleep mode is off', () => {
        const store = useVrStore();

        store.updateOpenVR();

        expect(mocks.setVR).toHaveBeenCalledWith(true, true, true, false, 1);
    });

    it('keeps the dashboard active while VRChat is closed', () => {
        mocks.game.isGameRunning = false;
        useVrStore().updateOpenVR();
        expect(mocks.setVR).toHaveBeenCalledWith(true, false, false, false, 1);
    });

    it('keeps the dashboard active when both in-game overlays are disabled', () => {
        mocks.wrist.overlayWrist = false;
        mocks.notifications.overlayNotifications = false;
        useVrStore().updateOpenVR();
        expect(mocks.setVR).toHaveBeenCalledWith(true, false, false, false, 1);
    });

    it('honors the master SteamVR integration switch', () => {
        mocks.notifications.openVR = false;
        useVrStore().updateOpenVR();
        expect(mocks.setVR).toHaveBeenCalledWith(false, false, false, false, 0);
    });

    it('disables only the dashboard and closes capture while wrist and notifications remain enabled', async () => {
        mocks.wrist.steamVrDashboard = false;
        await useVrStore().saveOpenVROption();
        expect(mocks.setVR).toHaveBeenCalledWith(true, true, true, false, 1);
        expect(mocks.workspaceCommand).toHaveBeenCalledWith({ type: 'close' });
        const config = AppApi.ExecuteVrOverlayFunction.mock.calls.find(
            ([name]) => name === 'configUpdate'
        );
        expect(JSON.parse(config[1]).dashboardEnabled).toBe(false);
    });

    it('stops the overlay runtime when the dashboard and both overlays are off', () => {
        mocks.wrist.steamVrDashboard = false;
        mocks.wrist.overlayWrist = false;
        mocks.notifications.overlayNotifications = false;
        useVrStore().updateOpenVR();
        expect(mocks.setVR).toHaveBeenCalledWith(false, false, false, false, 1);
    });

    it('re-enables the dashboard without enabling wrist or notification overlays', async () => {
        mocks.wrist.overlayWrist = false;
        mocks.notifications.overlayNotifications = false;
        await useVrStore().saveOpenVROption();
        expect(mocks.setVR).toHaveBeenCalledWith(true, false, false, false, 1);
        expect(mocks.workspaceCommand).not.toHaveBeenCalled();
        const config = AppApi.ExecuteVrOverlayFunction.mock.calls.find(
            ([name]) => name === 'configUpdate'
        );
        expect(JSON.parse(config[1]).dashboardEnabled).toBe(true);
    });

    it('ignores queued workspace opens and heartbeats after disabling but allows cleanup', async () => {
        vi.useFakeTimers();
        mocks.wrist.steamVrDashboard = false;
        AppApi.GetDashboardActions = vi.fn(async () =>
            ['open', 'ping', 'input', 'close'].map((type) =>
                JSON.stringify({ action: 'workspace', type })
            )
        );
        useVrStore();
        await vi.advanceTimersByTimeAsync(50);
        expect(mocks.workspaceCommand).toHaveBeenCalledTimes(1);
        expect(mocks.workspaceCommand).toHaveBeenCalledWith({
            action: 'workspace',
            type: 'close'
        });
    });
});
