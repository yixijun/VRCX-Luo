import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    userStore: {
        currentUser: {
            id: 'usr_self',
            $locationTag: 'wrld_test:instance_1',
            $travelingToLocation: '',
            $online_for: 1000,
            $offline_for: null
        },
        cachedUsers: new Map(),
        setCurrentUserLocationAt: vi.fn(),
        setCurrentUserTravelingToTime: vi.fn(),
        applyUserDialogLocation: vi.fn()
    },
    gameStore: { isGameRunning: true },
    advancedSettingsStore: { gameLogDisabled: false },
    locationStore: {
        lastLocation: {
            date: 2000,
            location: 'wrld_test:instance_1',
            playerList: new Map()
        },
        lastLocationDestination: '',
        lastLocationDestinationTime: 0
    },
    instanceStore: {
        applyWorldDialogInstances: vi.fn(),
        applyGroupDialogInstances: vi.fn()
    }
}));

vi.mock('../../shared/utils', () => ({
    getGroupName: vi.fn(),
    getWorldName: vi.fn(),
    isRealInstance: vi.fn(() => true),
    parseLocation: (tag) => ({ tag, isTraveling: false })
}));

vi.mock('../../services/database', () => ({ database: {} }));
vi.mock('../../stores/settings/advanced', () => ({
    useAdvancedSettingsStore: () => mocks.advancedSettingsStore
}));
vi.mock('../../stores/gameLog', () => ({ useGameLogStore: () => ({}) }));
vi.mock('../../stores/game', () => ({
    useGameStore: () => mocks.gameStore
}));
vi.mock('../../stores/instance', () => ({
    useInstanceStore: () => mocks.instanceStore
}));
vi.mock('../../stores/location', () => ({
    useLocationStore: () => mocks.locationStore
}));
vi.mock('../../stores/notification', () => ({
    useNotificationStore: () => ({})
}));
vi.mock('../../stores/photon', () => ({ usePhotonStore: () => ({}) }));
vi.mock('../../stores/user', () => ({
    useUserStore: () => mocks.userStore
}));
vi.mock('../../stores/vr', () => ({ useVrStore: () => ({}) }));

import { runUpdateCurrentUserLocationFlow } from '../locationCoordinator';

describe('runUpdateCurrentUserLocationFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userStore.cachedUsers = new Map([
            ['usr_self', { id: 'usr_self' }]
        ]);
    });

    test('keeps the restored room arrival time on the current user', () => {
        runUpdateCurrentUserLocationFlow();

        expect(mocks.userStore.setCurrentUserLocationAt).toHaveBeenCalledWith(
            2000
        );
    });
});
