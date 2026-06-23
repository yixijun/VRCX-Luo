import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

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
    setVR: vi.fn()
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
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mocks.notifications.openVR = true;
        mocks.notifications.vSleepMode = false;
        mocks.notifications.overlayNotifications = true;
        mocks.wrist.overlayWrist = true;
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
});
