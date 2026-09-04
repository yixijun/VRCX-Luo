import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    friendStore: {
        friends: new Map(),
        localFavoriteFriends: new Set(),
        pendingOfflineMap: new Map(),
        pendingOfflineDelay: 5000,
        updateOnlineFriendCounter: vi.fn(),
        reindexSortedFriend: vi.fn()
    },
    userStore: {
        cachedUsers: new Map()
    },
    feedStore: {
        addFeedEntry: vi.fn()
    },
    notificationStore: {
        queueFeedNoty: vi.fn()
    },
    sharedFeedStore: {
        addEntry: vi.fn()
    },
    database: {
        addOnlineOfflineToDatabase: vi.fn()
    },
    userRequest: {
        getUser: vi.fn()
    },
    syncFriendSearchIndex: vi.fn(),
    getWorldName: vi.fn(),
    getGroupName: vi.fn(),
    isRealInstance: vi.fn()
}));

vi.mock('../../shared/utils', () => ({
    getWorldName: (...args) => mocks.getWorldName(...args),
    getGroupName: (...args) => mocks.getGroupName(...args),
    isRealInstance: (...args) => mocks.isRealInstance(...args)
}));

vi.mock('../../services/appConfig', () => ({
    AppDebug: { debugFriendState: false }
}));

vi.mock('../../services/database', () => ({
    database: mocks.database
}));

vi.mock('../../stores/feed', () => ({
    useFeedStore: () => mocks.feedStore
}));

vi.mock('../../stores/friend', () => ({
    useFriendStore: () => mocks.friendStore
}));

vi.mock('../../stores/notification', () => ({
    useNotificationStore: () => mocks.notificationStore
}));

vi.mock('../../stores/sharedFeed', () => ({
    useSharedFeedStore: () => mocks.sharedFeedStore
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => mocks.userStore
}));

vi.mock('../../api', () => ({
    userRequest: mocks.userRequest
}));

vi.mock('../searchIndexCoordinator', () => ({
    syncFriendSearchIndex: (...args) => mocks.syncFriendSearchIndex(...args)
}));

vi.mock('../../services/watchState', () => ({
    watchState: { isFriendsLoaded: false }
}));

import {
    runUpdateFriendDelayedCheckFlow,
    runUpdateFriendDelayedCheckFlowWithDependencies,
    runUpdateFriendFlow,
    runUpdateFriendFlowWithDependencies
} from '../friendPresenceCoordinator';

describe('runUpdateFriendDelayedCheckFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.friendStore.friends.clear();
        mocks.friendStore.localFavoriteFriends.clear();
        mocks.friendStore.pendingOfflineMap.clear();
        mocks.userStore.cachedUsers.clear();
        mocks.getWorldName.mockResolvedValue('World');
        mocks.getGroupName.mockResolvedValue('Group');
        mocks.isRealInstance.mockReturnValue(false);
    });

    it('records the offline transition across stores, notification, and database', async () => {
        const ref = {
            id: 'usr-friend',
            displayName: 'Friend',
            location: 'wrld_world:instance',
            $location_at: 5000,
            $lastFetch: 10000
        };
        const ctx = {
            id: ref.id,
            name: ref.displayName,
            state: 'online',
            ref
        };
        mocks.friendStore.friends.set(ctx.id, ctx);

        await runUpdateFriendDelayedCheckFlow(ctx, 'offline', 'offline', 5000, {
            now: () => 10000,
            nowIso: () => '2026-09-04T00:00:00.000Z'
        });

        const expectedFeed = {
            created_at: '2026-09-04T00:00:00.000Z',
            type: 'Offline',
            userId: 'usr-friend',
            displayName: 'Friend',
            location: 'offline',
            worldName: 'World',
            groupName: 'Group',
            time: 5000
        };
        expect(ctx.state).toBe('offline');
        expect(ctx.ref.$online_for).toBe('');
        expect(ctx.ref.$offline_for).toBe(10000);
        expect(mocks.notificationStore.queueFeedNoty).toHaveBeenCalledWith(
            expectedFeed
        );
        expect(mocks.sharedFeedStore.addEntry).toHaveBeenCalledWith(
            expectedFeed
        );
        expect(mocks.feedStore.addFeedEntry).toHaveBeenCalledWith(expectedFeed);
        expect(mocks.database.addOnlineOfflineToDatabase).toHaveBeenCalledWith(
            expectedFeed
        );
        expect(
            mocks.friendStore.updateOnlineFriendCounter
        ).toHaveBeenCalledOnce();
        expect(mocks.friendStore.reindexSortedFriend).toHaveBeenCalledWith(ctx);
    });

    it('records the online transition with the current location metadata', async () => {
        const ref = {
            id: 'usr-friend',
            displayName: 'Friend',
            location: 'wrld_world:instance',
            $lastFetch: 10000
        };
        const ctx = {
            id: ref.id,
            name: ref.displayName,
            state: 'offline',
            ref
        };
        mocks.friendStore.friends.set(ctx.id, ctx);

        await runUpdateFriendDelayedCheckFlow(ctx, 'online', ref.location, 0, {
            now: () => 20000,
            nowIso: () => '2026-09-04T00:00:01.000Z'
        });

        const expectedFeed = {
            created_at: '2026-09-04T00:00:01.000Z',
            type: 'Online',
            userId: 'usr-friend',
            displayName: 'Friend',
            location: 'wrld_world:instance',
            worldName: 'World',
            groupName: 'Group',
            time: ''
        };
        expect(ctx.state).toBe('online');
        expect(ctx.ref.$location_at).toBe(20000);
        expect(ctx.ref.$online_for).toBe(20000);
        expect(ctx.ref.$offline_for).toBe('');
        expect(mocks.notificationStore.queueFeedNoty).toHaveBeenCalledWith(
            expectedFeed
        );
        expect(mocks.sharedFeedStore.addEntry).toHaveBeenCalledWith(
            expectedFeed
        );
        expect(mocks.feedStore.addFeedEntry).toHaveBeenCalledWith(expectedFeed);
        expect(mocks.database.addOnlineOfflineToDatabase).toHaveBeenCalledWith(
            expectedFeed
        );
        expect(
            mocks.friendStore.updateOnlineFriendCounter
        ).toHaveBeenCalledOnce();
        expect(mocks.friendStore.reindexSortedFriend).toHaveBeenCalledWith(ctx);
    });

    it('uses explicitly injected capabilities and preserves side-effect order', async () => {
        const ref = {
            id: 'usr-injected-friend',
            displayName: 'Injected Friend',
            location: 'wrld_injected:instance',
            $location_at: 1000
        };
        const ctx = {
            id: ref.id,
            name: ref.displayName,
            state: 'online',
            ref
        };
        const sideEffectOrder = [];
        const injectedFriendStore = {
            friends: new Map([[ctx.id, ctx]]),
            localFavoriteFriends: new Set(),
            updateOnlineFriendCounter: vi.fn(),
            reindexSortedFriend: vi.fn()
        };
        const injectedFeedStore = {
            addFeedEntry: vi.fn(() => sideEffectOrder.push('feed'))
        };
        const injectedNotificationStore = {
            queueFeedNoty: vi.fn(() => sideEffectOrder.push('notification'))
        };
        const injectedSharedFeedStore = {
            addEntry: vi.fn(() => sideEffectOrder.push('shared-feed'))
        };
        const injectedDatabase = {
            addOnlineOfflineToDatabase: vi.fn(() =>
                sideEffectOrder.push('database')
            )
        };

        await runUpdateFriendDelayedCheckFlowWithDependencies(
            ctx,
            'offline',
            'offline',
            1000,
            {
                friendStore: injectedFriendStore,
                feedStore: injectedFeedStore,
                notificationStore: injectedNotificationStore,
                sharedFeedStore: injectedSharedFeedStore,
                database: injectedDatabase,
                now: () => 2000,
                nowIso: () => '2026-09-04T00:00:02.000Z'
            }
        );

        expect(sideEffectOrder).toEqual([
            'notification',
            'shared-feed',
            'feed',
            'database'
        ]);
        expect(injectedNotificationStore.queueFeedNoty).toHaveBeenCalledOnce();
        expect(
            injectedDatabase.addOnlineOfflineToDatabase
        ).toHaveBeenCalledOnce();
        expect(
            mocks.friendStore.updateOnlineFriendCounter
        ).not.toHaveBeenCalled();
    });
});

describe('runUpdateFriendFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.friendStore.friends.clear();
        mocks.friendStore.localFavoriteFriends.clear();
        mocks.friendStore.pendingOfflineMap.clear();
        mocks.userStore.cachedUsers.clear();
        mocks.getWorldName.mockResolvedValue('World');
        mocks.getGroupName.mockResolvedValue('Group');
        mocks.isRealInstance.mockReturnValue(false);
    });

    it('uses injected capabilities for an offline transition pending check', async () => {
        const ref = {
            id: 'usr-injected-friend',
            displayName: 'Injected Friend',
            location: 'wrld_injected:instance',
            $location_at: 1000,
            $lastFetch: 2000
        };
        const ctx = {
            id: ref.id,
            name: ref.displayName,
            state: 'online',
            ref: undefined,
            pendingOffline: false
        };
        const pendingOfflineMap = new Map();
        const injectedFriendStore = {
            friends: new Map([[ctx.id, ctx]]),
            localFavoriteFriends: new Set(),
            pendingOfflineMap,
            updateOnlineFriendCounter: vi.fn(),
            reindexSortedFriend: vi.fn()
        };
        const injectedUserStore = {
            cachedUsers: new Map([[ctx.id, ref]])
        };
        const fetchUser = vi.fn();
        const syncFriendSearchIndex = vi.fn();
        const runDelayedFlow = vi.fn();

        await runUpdateFriendFlowWithDependencies(ctx.id, 'offline', {
            friendStore: injectedFriendStore,
            userStore: injectedUserStore,
            isRealInstance: vi.fn(() => false),
            fetchUser,
            watchState: { isFriendsLoaded: true },
            syncFriendSearchIndex,
            runDelayedFlow,
            now: () => 2000,
            nowIso: () => '2026-09-04T00:00:02.000Z'
        });

        expect(ctx.ref).toBe(ref);
        expect(ctx.pendingOffline).toBe(true);
        expect(pendingOfflineMap.get(ctx.id)).toEqual({
            startTime: 2000,
            newState: 'offline',
            previousLocation: ref.location,
            previousLocationAt: 1000
        });
        expect(syncFriendSearchIndex).toHaveBeenCalledWith(ctx);
        expect(injectedFriendStore.reindexSortedFriend).toHaveBeenCalledWith(
            ctx
        );
        expect(fetchUser).not.toHaveBeenCalled();
        expect(runDelayedFlow).not.toHaveBeenCalled();
        expect(mocks.friendStore.reindexSortedFriend).not.toHaveBeenCalled();
    });

    it('keeps the compatibility entry point wired to default adapters', async () => {
        const ref = {
            id: 'usr-default-friend',
            displayName: 'Default Friend',
            location: 'wrld_default:instance',
            $location_at: 1000,
            $lastFetch: 2000
        };
        const ctx = {
            id: ref.id,
            name: ref.displayName,
            state: 'online',
            ref: undefined
        };
        mocks.friendStore.friends.set(ctx.id, ctx);
        mocks.userStore.cachedUsers.set(ctx.id, ref);

        await runUpdateFriendFlow(ctx.id, 'offline', {
            now: () => 2000,
            nowIso: () => '2026-09-04T00:00:02.000Z'
        });

        expect(ctx.state).toBe('offline');
        expect(
            mocks.database.addOnlineOfflineToDatabase
        ).toHaveBeenCalledOnce();
        expect(mocks.feedStore.addFeedEntry).toHaveBeenCalledOnce();
    });
});
