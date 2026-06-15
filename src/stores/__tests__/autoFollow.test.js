import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(() => Promise.resolve({ ok: true })),
    toastSuccess: vi.fn(),
    toastWarning: vi.fn(),
    toastError: vi.fn(),
    friends: new Map(),
    isGameNoVR: true,
    isGameRunning: true,
    isSteamVRRunning: false,
    lastLocation: {
        location: 'wrld_home:1',
        friendList: new Map()
    },
    launchGame: vi.fn(() => Promise.resolve(true)),
    tryOpenInstanceInVrc: vi.fn(() => Promise.resolve(true)),
    quitGame: vi.fn(() => Promise.resolve(1))
}));

vi.mock('vue-sonner', () => ({
    toast: {
        success: (...args) => mocks.toastSuccess(...args),
        warning: (...args) => mocks.toastWarning(...args),
        error: (...args) => mocks.toastError(...args)
    }
}));

vi.mock('../../plugins/i18n', () => ({
    i18n: {
        global: {
            t: (key) => key
        }
    }
}));

vi.mock('../friend', () => ({
    useFriendStore: () => ({
        friends: mocks.friends
    })
}));

vi.mock('../game', () => ({
    useGameStore: () => ({
        get isGameNoVR() {
            return mocks.isGameNoVR;
        },
        get isGameRunning() {
            return mocks.isGameRunning;
        },
        get isSteamVRRunning() {
            return mocks.isSteamVRRunning;
        }
    })
}));

vi.mock('../launch', () => ({
    useLaunchStore: () => ({
        launchGame: (...args) => mocks.launchGame(...args),
        tryOpenInstanceInVrc: (...args) => mocks.tryOpenInstanceInVrc(...args)
    })
}));

vi.mock('../location', () => ({
    useLocationStore: () => ({
        lastLocation: mocks.lastLocation
    })
}));

vi.mock('../modal', () => ({
    useModalStore: () => ({
        confirm: (...args) => mocks.confirm(...args)
    })
}));

globalThis.AppApi = {
    QuitGame: (...args) => mocks.quitGame(...args)
};

import { useAutoFollowStore } from '../autoFollow';

function friend(location = 'wrld_target:2') {
    return {
        id: 'usr_friend',
        displayName: 'Friend',
        location
    };
}

describe('useAutoFollowStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        mocks.confirm.mockResolvedValue({ ok: true });
        mocks.toastSuccess.mockClear();
        mocks.toastWarning.mockClear();
        mocks.toastError.mockClear();
        mocks.friends.clear();
        mocks.isGameNoVR = true;
        mocks.isGameRunning = true;
        mocks.isSteamVRRunning = false;
        mocks.lastLocation.location = 'wrld_home:1';
        mocks.launchGame.mockClear();
        mocks.tryOpenInstanceInVrc.mockClear();
        mocks.quitGame.mockClear();
    });

    it('starts listening without launching when already in the same instance', async () => {
        mocks.lastLocation.location = 'wrld_target:2';
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(store.isActive).toBe(true);
        expect(store.statusText).toContain('已在同一房间');
        expect(mocks.launchGame).not.toHaveBeenCalled();
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
        expect(mocks.quitGame).not.toHaveBeenCalled();
    });

    it('quits and relaunches VRChat in desktop mode when target is elsewhere', async () => {
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(mocks.quitGame).toHaveBeenCalledTimes(1);
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_target:2', null, true);
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
    });

    it('uses desktop launch when VRChat is in desktop mode even if SteamVR is running', async () => {
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(mocks.quitGame).toHaveBeenCalledTimes(1);
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_target:2', null, true);
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
    });

    it('uses desktop launch when desktop UI requests it even if game mode state is stale', async () => {
        mocks.isGameNoVR = false;
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true, launchMode: 'desktop' });

        expect(mocks.quitGame).toHaveBeenCalledTimes(1);
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_target:2', null, true);
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
    });

    it('passes shortName from the friend location cache when relaunching in desktop mode', async () => {
        const store = useAutoFollowStore();
        const target = {
            ...friend('wrld_target:2~friends(usr_owner)'),
            $location: {
                shortName: 'short123'
            }
        };

        await store.startFollow(target, { confirm: true, initialJoin: true });

        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_target:2~friends(usr_owner)',
            'short123',
            true
        );
    });

    it('opens the instance in VRChat when in VR mode', async () => {
        mocks.isGameNoVR = false;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true, launchMode: 'vr' });

        expect(mocks.tryOpenInstanceInVrc).toHaveBeenCalledWith('wrld_target:2', null);
        expect(mocks.launchGame).not.toHaveBeenCalled();
        expect(mocks.quitGame).not.toHaveBeenCalled();
    });

    it('passes shortName from the friend location cache when opening in VR mode', async () => {
        mocks.isGameNoVR = false;
        const store = useAutoFollowStore();
        const target = {
            ...friend('wrld_target:2~friends(usr_owner)'),
            $location: {
                shortName: 'short123'
            }
        };

        await store.startFollow(target, { confirm: true, initialJoin: true, launchMode: 'vr' });

        expect(mocks.tryOpenInstanceInVrc).toHaveBeenCalledWith(
            'wrld_target:2~friends(usr_owner)',
            'short123'
        );
    });

    it('confirms before stopping the current target', async () => {
        const store = useAutoFollowStore();
        await store.startFollow(friend(), { confirm: false, initialJoin: false });

        await store.toggleFollow(friend());

        expect(store.isActive).toBe(false);
        expect(mocks.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                confirmText: '取消跟随'
            })
        );
    });
});
