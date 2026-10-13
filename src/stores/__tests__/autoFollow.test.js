import { nextTick, reactive } from 'vue';
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
    QuitGame: (...args) => mocks.quitGame(...args),
    IsGameRunning: () => Promise.resolve(mocks.isGameRunning),
    IsSteamVRRunning: () => Promise.resolve(mocks.isSteamVRRunning)
};

import { useAutoFollowStore } from '../autoFollow';

function friend(location = 'wrld_target:2', id = 'usr_friend') {
    return {
        id,
        displayName: 'Friend',
        location
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
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
        AppApi.IsGameRunning = () => Promise.resolve(mocks.isGameRunning);
        AppApi.IsSteamVRRunning = () => Promise.resolve(mocks.isSteamVRRunning);
        AppApi.QuitGame = (...args) => mocks.quitGame(...args);
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
        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_target:2',
            null,
            true
        );
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
    });

    it('uses desktop launch when VRChat is in desktop mode even if SteamVR is running', async () => {
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(mocks.quitGame).toHaveBeenCalledTimes(1);
        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_target:2',
            null,
            true
        );
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
    });

    it('starts VRChat in VR mode when SteamVR is running and VRChat is not', async () => {
        mocks.isGameRunning = false;
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(store.launchMode).toBe('vr');
        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_target:2',
            null,
            false
        );
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
        expect(mocks.quitGame).not.toHaveBeenCalled();
    });

    it('uses live AppApi SteamVR state when store state has not updated yet', async () => {
        mocks.isGameRunning = false;
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(store.launchMode).toBe('vr');
        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_target:2',
            null,
            false
        );
    });

    it('auto-detects VR launch when VRChat is running in VR mode', async () => {
        mocks.isGameNoVR = false;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(store.launchMode).toBe('vr');
        expect(mocks.tryOpenInstanceInVrc).toHaveBeenCalledWith(
            'wrld_target:2',
            null
        );
        expect(mocks.launchGame).not.toHaveBeenCalled();
        expect(mocks.quitGame).not.toHaveBeenCalled();
    });

    it('uses desktop launch when desktop UI requests it even if game mode state is stale', async () => {
        mocks.isGameNoVR = false;
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), {
            confirm: true,
            initialJoin: true,
            launchMode: 'desktop'
        });

        expect(mocks.quitGame).toHaveBeenCalledTimes(1);
        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_target:2',
            null,
            true
        );
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

        await store.startFollow(friend(), {
            confirm: true,
            initialJoin: true,
            launchMode: 'vr'
        });

        expect(mocks.tryOpenInstanceInVrc).toHaveBeenCalledWith(
            'wrld_target:2',
            null
        );
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

        await store.startFollow(target, {
            confirm: true,
            initialJoin: true,
            launchMode: 'vr'
        });

        expect(mocks.tryOpenInstanceInVrc).toHaveBeenCalledWith(
            'wrld_target:2~friends(usr_owner)',
            'short123'
        );
    });

    it('confirms before stopping the current target', async () => {
        const store = useAutoFollowStore();
        await store.startFollow(friend(), {
            confirm: false,
            initialJoin: false
        });

        await store.toggleFollow(friend());

        expect(store.isActive).toBe(false);
        expect(mocks.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                confirmText: '取消跟随'
            })
        );
    });

    it('continues following when the target goes offline and later joins another instance', async () => {
        const target = reactive(friend('wrld_target:2'));
        mocks.friends.set(target.id, { ref: target });
        const store = useAutoFollowStore();

        await store.startFollow(target, { confirm: false, initialJoin: false });

        target.location = 'offline';
        await nextTick();
        expect(store.isActive).toBe(true);
        expect(store.statusText).toContain('等待重新上线');
        expect(mocks.launchGame).not.toHaveBeenCalled();

        target.location = 'wrld_returned:5';
        await nextTick();
        await flushPromises();

        expect(store.isActive).toBe(true);
        expect(mocks.quitGame).toHaveBeenCalledTimes(1);
        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_returned:5',
            null,
            true
        );
    });

    it('re-detects launch mode when the followed target changes rooms', async () => {
        const target = reactive(friend('wrld_target:2'));
        mocks.friends.set(target.id, { ref: target });
        const store = useAutoFollowStore();

        await store.startFollow(target, { confirm: false, initialJoin: false });

        mocks.isGameRunning = false;
        mocks.isSteamVRRunning = true;
        target.location = 'wrld_vr:7';
        await nextTick();
        await flushPromises();

        expect(store.launchMode).toBe('vr');
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_vr:7', null, false);
        expect(mocks.quitGame).not.toHaveBeenCalled();
    });

    it('invalidates a pending join when automatic follow is stopped', async () => {
        let releaseRuntime;
        const runtimeReady = new Promise((resolve) => {
            releaseRuntime = resolve;
        });
        AppApi.IsGameRunning = () => runtimeReady;

        const store = useAutoFollowStore();
        const startPromise = store.startFollow(friend(), {
            confirm: false,
            initialJoin: true,
            launchMode: 'desktop'
        });
        await flushPromises();

        expect(store.isJoining).toBe(true);
        await store.stopFollow({ confirm: false });
        expect(store.isActive).toBe(false);

        releaseRuntime(true);
        await startPromise;
        await flushPromises();

        expect(mocks.quitGame).not.toHaveBeenCalled();
        expect(mocks.launchGame).not.toHaveBeenCalled();
        expect(store.isJoining).toBe(false);
    });

    it('keeps only the latest room while a join is in progress', async () => {
        const target = reactive(friend('wrld_target:2'));
        mocks.friends.set(target.id, { ref: target });

        let releaseFirstLaunch;
        let launchCount = 0;
        mocks.launchGame.mockImplementation((location) => {
            launchCount += 1;
            if (launchCount === 1) {
                return new Promise((resolve) => {
                    releaseFirstLaunch = resolve;
                });
            }
            return Promise.resolve(true);
        });

        const store = useAutoFollowStore();
        const startPromise = store.startFollow(target, {
            confirm: false,
            initialJoin: true,
            launchMode: 'desktop'
        });
        await flushPromises();

        expect(mocks.launchGame).toHaveBeenCalledWith(
            'wrld_target:2',
            null,
            true
        );
        target.location = 'wrld_next:3';
        await nextTick();
        target.location = 'wrld_latest:4';
        await nextTick();
        await flushPromises();

        releaseFirstLaunch(true);
        await startPromise;
        await flushPromises();

        expect(
            mocks.launchGame.mock.calls.map(([location]) => location)
        ).toEqual(['wrld_target:2', 'wrld_latest:4']);
    });

    it('invalidates the old target when switching followed friends during a join', async () => {
        let releaseFirstRead;
        let isFirstRead = true;
        const firstRuntimeRead = new Promise((resolve) => {
            releaseFirstRead = resolve;
        });
        AppApi.IsGameRunning = () => {
            if (isFirstRead) {
                isFirstRead = false;
                return firstRuntimeRead;
            }
            return Promise.resolve(true);
        };

        const firstTarget = reactive(friend('wrld_first:2'));
        const secondTarget = reactive(friend('wrld_second:3', 'usr_other'));
        mocks.friends.set(firstTarget.id, { ref: firstTarget });
        mocks.friends.set(secondTarget.id, { ref: secondTarget });

        const store = useAutoFollowStore();
        const firstStart = store.startFollow(firstTarget, {
            confirm: false,
            initialJoin: true,
            launchMode: 'desktop'
        });
        await flushPromises();

        const secondStart = store.startFollow(secondTarget, {
            confirm: false,
            initialJoin: true,
            launchMode: 'desktop'
        });
        await flushPromises();
        expect(store.targetFriendId).toBe('usr_other');

        releaseFirstRead(true);
        await Promise.all([firstStart, secondStart]);
        await flushPromises();

        expect(
            mocks.launchGame.mock.calls.map(([location]) => location)
        ).toEqual(['wrld_second:3']);
    });
});
