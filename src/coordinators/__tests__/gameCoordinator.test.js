import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    userStore: {
        currentUser: {
            $online_for: 1000,
            currentAvatar: 'avtr_test'
        },
        markCurrentUserGameStarted: vi.fn(),
        markCurrentUserGameStopped: vi.fn()
    },
    gameStore: {
        state: {
            lastCrashedTime: null
        },
        isGameNoVR: false,
        setLastSession: vi.fn(),
        setIsGameRunning: vi.fn(),
        isGameRunning: false,
        setIsSteamVRRunning: vi.fn(),
        isSteamVRRunning: false,
        setLastCrashedTime: vi.fn()
    },
    instanceStore: {
        removeAllQueuedInstances: vi.fn()
    },
    updateLoopStore: {
        setIpcTimeout: vi.fn(),
        setNextDiscordUpdate: vi.fn()
    },
    gameLogStore: {
        clearNowPlaying: vi.fn(),
        addGameLog: vi.fn()
    },
    vrStore: {
        updateVRLastLocation: vi.fn(),
        updateOpenVR: vi.fn()
    },
    advancedSettingsStore: {
        autoSweepVRChatCache: false,
        relaunchVRChatAfterCrash: false,
        crashRecoveryDesktopMode: 'ignore',
        crashRecoveryVRMode: 'ignore',
        gameLogDisabled: false
    },
    configRepository: {
        setBool: vi.fn().mockResolvedValue(undefined),
        setString: vi.fn().mockResolvedValue(undefined)
    },
    addAvatarWearTime: vi.fn(),
    runLastLocationResetFlow: vi.fn(),
    isRealInstance: vi.fn(() => false),
    locationStore: {
        lastLocation: { location: '', playerList: { size: 0 } }
    },
    modalStore: {
        confirm: vi.fn()
    },
    launchStore: {
        launchGame: vi.fn()
    },
    notificationStore: {
        queueGameLogNoty: vi.fn()
    },
    workerTimers: {
        setTimeout: vi.fn()
    }
}));

vi.mock('vue-sonner', () => ({
    toast: vi.fn()
}));

vi.mock('../../shared/utils', () => ({
    deleteVRChatCache: vi.fn(),
    isRealInstance: (...args) => mocks.isRealInstance(...args)
}));

vi.mock('../../plugins/i18n', () => ({
    i18n: {
        global: {
            t: (key, params) =>
                params?.mode ? `${key}:${params.mode}` : key
        }
    }
}));

vi.mock('../../services/database', () => ({
    database: new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (prop === '__esModule') return false;
                return vi.fn().mockResolvedValue(null);
            }
        }
    )
}));

vi.mock('../../stores/settings/advanced', () => ({
    useAdvancedSettingsStore: () => mocks.advancedSettingsStore
}));

vi.mock('../../stores/avatar', () => ({
    useAvatarStore: () => ({})
}));

vi.mock('../avatarCoordinator', () => ({
    addAvatarWearTime: (...args) => mocks.addAvatarWearTime(...args)
}));

vi.mock('../../stores/gameLog', () => ({
    useGameLogStore: () => mocks.gameLogStore
}));

vi.mock('../../stores/game', () => ({
    useGameStore: () => mocks.gameStore
}));

vi.mock('../../stores/instance', () => ({
    useInstanceStore: () => mocks.instanceStore
}));

vi.mock('../../stores/launch', () => ({
    useLaunchStore: () => mocks.launchStore
}));

vi.mock('../../stores/location', () => ({
    useLocationStore: () => mocks.locationStore
}));

vi.mock('../locationCoordinator', () => ({
    runLastLocationResetFlow: (...args) =>
        mocks.runLastLocationResetFlow(...args)
}));

vi.mock('../../stores/modal', () => ({
    useModalStore: () => mocks.modalStore
}));

vi.mock('../../stores/notification', () => ({
    useNotificationStore: () => mocks.notificationStore
}));

vi.mock('../../stores/updateLoop', () => ({
    useUpdateLoopStore: () => mocks.updateLoopStore
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => mocks.userStore
}));

vi.mock('../../stores/vr', () => ({
    useVrStore: () => mocks.vrStore
}));

vi.mock('../../stores/world', () => ({
    useWorldStore: () => ({ updateVRChatWorldCache: vi.fn() })
}));

vi.mock('../../services/config', () => ({
    default: mocks.configRepository
}));

vi.mock('worker-timers', () => ({
    setTimeout: (...args) => mocks.workerTimers.setTimeout(...args)
}));

import {
    runCheckIfGameCrashedFlow,
    runGameRunningChangedFlow
} from '../gameCoordinator';

describe('runGameRunningChangedFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userStore.currentUser.$online_for = 1000;
        mocks.gameStore.isGameNoVR = false;
        mocks.gameStore.state.lastCrashedTime = null;
        mocks.gameStore.isSteamVRRunning = false;
        mocks.advancedSettingsStore.relaunchVRChatAfterCrash = false;
        mocks.advancedSettingsStore.crashRecoveryDesktopMode = 'ignore';
        mocks.advancedSettingsStore.crashRecoveryVRMode = 'ignore';
        mocks.locationStore.lastLocation.location = '';
        mocks.isRealInstance.mockReturnValue(false);
        mocks.modalStore.confirm.mockReset();
        mocks.launchStore.launchGame.mockReset();
        mocks.workerTimers.setTimeout.mockReset();
        globalThis.AppApi = {
            VrcClosedGracefully: vi.fn().mockResolvedValue(false),
            FocusWindow: vi.fn()
        };
    });

    test('persists and stores last game session when game stops', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(5000);

        await runGameRunningChangedFlow(false);

        expect(mocks.gameStore.setLastSession).toHaveBeenCalledWith(4000, 5000);
        expect(mocks.configRepository.setString).toHaveBeenCalledWith(
            'VRCX_lastGameSessionMs',
            '4000'
        );
        expect(mocks.configRepository.setString).toHaveBeenCalledWith(
            'VRCX_lastGameOfflineAt',
            '5000'
        );
        expect(mocks.userStore.markCurrentUserGameStopped).toHaveBeenCalled();
    });

    test('skips persisting last game session when no valid session start exists', async () => {
        mocks.userStore.currentUser.$online_for = 0;

        await runGameRunningChangedFlow(false);

        expect(mocks.gameStore.setLastSession).not.toHaveBeenCalled();
        expect(mocks.configRepository.setString).not.toHaveBeenCalledWith(
            'VRCX_lastGameSessionMs',
            expect.any(String)
        );
        expect(mocks.configRepository.setString).not.toHaveBeenCalledWith(
            'VRCX_lastGameOfflineAt',
            expect.any(String)
        );
    });
});

describe('runCheckIfGameCrashedFlow', () => {
    beforeEach(() => {
        mocks.advancedSettingsStore.crashRecoveryDesktopMode = 'ignore';
        mocks.advancedSettingsStore.crashRecoveryVRMode = 'ignore';
        mocks.gameStore.isGameNoVR = false;
        mocks.gameStore.isSteamVRRunning = true;
        mocks.gameStore.state.lastCrashedTime = null;
        mocks.locationStore.lastLocation.location = 'wrld_test:instance_1';
        mocks.isRealInstance.mockReturnValue(true);
        mocks.modalStore.confirm.mockReset();
        mocks.launchStore.launchGame.mockReset();
        mocks.workerTimers.setTimeout.mockReset();
        globalThis.AppApi = {
            VrcClosedGracefully: vi.fn().mockResolvedValue(false),
            FocusWindow: vi.fn()
        };
    });

    test('does nothing when the current mode is set to ignore', async () => {
        runCheckIfGameCrashedFlow();
        await Promise.resolve();

        expect(globalThis.AppApi.VrcClosedGracefully).not.toHaveBeenCalled();
        expect(mocks.modalStore.confirm).not.toHaveBeenCalled();
        expect(mocks.workerTimers.setTimeout).not.toHaveBeenCalled();
    });

    test('asks before restarting when VR mode uses the ask policy', async () => {
        mocks.advancedSettingsStore.crashRecoveryVRMode = 'ask';
        mocks.modalStore.confirm.mockResolvedValue({
            ok: false,
            reason: 'cancel'
        });

        runCheckIfGameCrashedFlow();
        await Promise.resolve();

        expect(mocks.modalStore.confirm).toHaveBeenCalledWith({
            title: 'message.crash.vrchat_relaunch_title',
            description:
                'message.crash.vrchat_relaunch_description:message.crash.vr_mode',
            confirmText: 'message.crash.vrchat_relaunch_confirm',
            cancelText: 'message.crash.vrchat_relaunch_cancel'
        });
        expect(mocks.workerTimers.setTimeout).not.toHaveBeenCalled();
    });

    test('schedules a VR restart after confirming the crash card', async () => {
        mocks.advancedSettingsStore.crashRecoveryVRMode = 'ask';
        mocks.modalStore.confirm.mockResolvedValue({ ok: true, reason: 'ok' });

        runCheckIfGameCrashedFlow();
        await Promise.resolve();
        await Promise.resolve();

        expect(mocks.workerTimers.setTimeout).toHaveBeenCalledWith(
            expect.any(Function),
            8000
        );
        const restart = mocks.workerTimers.setTimeout.mock.calls.at(-1)[0];
        restart();
        expect(mocks.launchStore.launchGame).toHaveBeenCalledWith(
            'wrld_test:instance_1',
            '',
            false
        );
    });

    test('keeps the desktop restart delay for the immediate policy', async () => {
        mocks.gameStore.isGameNoVR = true;
        mocks.gameStore.isSteamVRRunning = false;
        mocks.advancedSettingsStore.crashRecoveryDesktopMode = 'restart';

        runCheckIfGameCrashedFlow();
        await Promise.resolve();

        expect(mocks.workerTimers.setTimeout).toHaveBeenCalledWith(
            expect.any(Function),
            2000
        );
        expect(mocks.modalStore.confirm).not.toHaveBeenCalled();
    });
});
