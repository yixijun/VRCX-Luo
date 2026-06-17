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
    quitGame: vi.fn(() => Promise.resolve(1)),
    configValues: new Map(),
    getInt: vi.fn((key, defaultValue = null) =>
        Promise.resolve(mocks.configValues.has(key) ? mocks.configValues.get(key) : defaultValue)
    ),
    setInt: vi.fn((key, value) => {
        mocks.configValues.set(key, value);
        return Promise.resolve();
    })
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

vi.mock('../../services/config', () => ({
    default: {
        getInt: (...args) => mocks.getInt(...args),
        setInt: (...args) => mocks.setInt(...args)
    }
}));

globalThis.AppApi = {
    QuitGame: (...args) => mocks.quitGame(...args),
    IsGameRunning: () => Promise.resolve(mocks.isGameRunning),
    IsSteamVRRunning: () => Promise.resolve(mocks.isSteamVRRunning)
};

import { useAutoFollowStore } from '../autoFollow';

function friend(location = 'wrld_target:2') {
    return {
        id: 'usr_friend',
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
        mocks.configValues.clear();
        mocks.getInt.mockClear();
        mocks.setInt.mockClear();
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

    it('starts VRChat in VR mode when SteamVR is running and VRChat is not', async () => {
        mocks.isGameRunning = false;
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(store.launchMode).toBe('vr');
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_target:2', null, false);
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
        expect(mocks.quitGame).not.toHaveBeenCalled();
    });

    it('uses live AppApi SteamVR state when store state has not updated yet', async () => {
        mocks.isGameRunning = false;
        mocks.isSteamVRRunning = true;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(store.launchMode).toBe('vr');
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_target:2', null, false);
    });

    it('auto-detects VR launch when VRChat is running in VR mode', async () => {
        mocks.isGameNoVR = false;
        const store = useAutoFollowStore();

        await store.startFollow(friend(), { confirm: true, initialJoin: true });

        expect(store.launchMode).toBe('vr');
        expect(mocks.tryOpenInstanceInVrc).toHaveBeenCalledWith('wrld_target:2', null);
        expect(mocks.launchGame).not.toHaveBeenCalled();
        expect(mocks.quitGame).not.toHaveBeenCalled();
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
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_returned:5', null, true);
    });

    it('starts waiting when the target has no joinable instance', async () => {
        const target = reactive(friend('offline'));
        mocks.friends.set(target.id, { ref: target });
        const store = useAutoFollowStore();

        await store.startFollow(target, { confirm: false, initialJoin: true });

        expect(store.isActive).toBe(true);
        expect(store.targetLocation).toBe('');
        expect(store.statusText).toContain('等待');
        expect(mocks.launchGame).not.toHaveBeenCalled();
        expect(mocks.tryOpenInstanceInVrc).not.toHaveBeenCalled();
    });

    it('joins when a waiting target later enters a joinable instance', async () => {
        const target = reactive(friend('offline'));
        mocks.friends.set(target.id, { ref: target });
        const store = useAutoFollowStore();

        await store.startFollow(target, { confirm: false, initialJoin: true });
        target.location = 'wrld_returned:5';
        await nextTick();
        await flushPromises();

        expect(store.targetLocation).toBe('wrld_returned:5');
        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_returned:5', null, true);
    });

    it('does not repeat join for the same instance inside the cooldown', async () => {
        const target = reactive(friend('wrld_target:2'));
        mocks.friends.set(target.id, { ref: target });
        const store = useAutoFollowStore();

        await store.startFollow(target, { confirm: false, initialJoin: true });
        mocks.launchGame.mockClear();
        target.location = 'wrld_target:2~region(us)';
        await nextTick();
        await flushPromises();

        expect(store.statusText).toContain('冷却');
        expect(mocks.launchGame).not.toHaveBeenCalled();
    });

    it('joins a new instance even when the previous instance is still cooling down', async () => {
        const target = reactive(friend('wrld_target:2'));
        mocks.friends.set(target.id, { ref: target });
        const store = useAutoFollowStore();

        await store.startFollow(target, { confirm: false, initialJoin: true });
        mocks.launchGame.mockClear();
        target.location = 'wrld_other:8';
        await nextTick();
        await flushPromises();

        expect(mocks.launchGame).toHaveBeenCalledWith('wrld_other:8', null, true);
    });

    it('clamps and saves the join cooldown setting', async () => {
        const store = useAutoFollowStore();

        await store.setJoinCooldownSeconds(1);
        expect(store.joinCooldownSeconds).toBe(3);
        expect(mocks.setInt).toHaveBeenLastCalledWith('VRCX_autoFollowJoinCooldownMs', 3000);

        await store.setJoinCooldownSeconds(150);
        expect(store.joinCooldownSeconds).toBe(120);
        expect(mocks.setInt).toHaveBeenLastCalledWith('VRCX_autoFollowJoinCooldownMs', 120000);

        await store.setJoinCooldownSeconds('bad');
        expect(store.joinCooldownSeconds).toBe(15);
        expect(mocks.setInt).toHaveBeenLastCalledWith('VRCX_autoFollowJoinCooldownMs', 15000);
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
});
