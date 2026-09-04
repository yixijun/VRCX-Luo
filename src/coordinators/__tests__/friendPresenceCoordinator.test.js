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

import { runUpdateFriendDelayedCheckFlow } from '../friendPresenceCoordinator';

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
});
