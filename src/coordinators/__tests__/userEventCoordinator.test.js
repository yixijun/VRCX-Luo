import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    database: {},
    friendStore: {},
    userStore: {},
    worldStore: {},
    groupStore: {},
    instanceStore: {},
    feedStore: {},
    notificationStore: {},
    sharedFeedStore: {},
    generalSettingsStore: {},
    getGroupName: vi.fn(),
    getWorldName: vi.fn(),
    parseLocation: vi.fn(),
    getAvatarName: vi.fn()
}));

vi.mock('../../shared/utils', () => ({
    getGroupName: (...args) => mocks.getGroupName(...args),
    getWorldName: (...args) => mocks.getWorldName(...args),
    parseLocation: (...args) => mocks.parseLocation(...args)
}));

vi.mock('../../services/appConfig', () => ({
    AppDebug: { debugFriendState: false, debugUserDiff: false }
}));

vi.mock('../../services/database', () => ({
    database: mocks.database
}));

vi.mock('../avatarCoordinator', () => ({
    getAvatarName: (...args) => mocks.getAvatarName(...args)
}));

vi.mock('../../stores/feed', () => ({
    useFeedStore: () => mocks.feedStore
}));

vi.mock('../../stores/friend', () => ({
    useFriendStore: () => mocks.friendStore
}));

vi.mock('../../stores/settings/general', () => ({
    useGeneralSettingsStore: () => mocks.generalSettingsStore
}));

vi.mock('../../stores/group', () => ({
    useGroupStore: () => mocks.groupStore
}));

vi.mock('../../stores/instance', () => ({
    useInstanceStore: () => mocks.instanceStore
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

vi.mock('../../stores/world', () => ({
    useWorldStore: () => mocks.worldStore
}));

import {
    runHandleUserUpdateFlow,
    runHandleUserUpdateFlowWithDependencies
} from '../userEventCoordinator';

function createDependencies(sideEffectOrder = []) {
    return {
        friendStore: {
            friends: new Map([['usr-friend', {}]])
        },
        userStore: {
            currentUser: { id: 'usr-current' },
            state: { instancePlayerCount: new Map() },
            userDialog: { $location: { tag: '' } },
            applyUserDialogLocation: vi.fn(),
            checkNote: vi.fn()
        },
        worldStore: { worldDialog: { id: 'wrld-other' } },
        groupStore: { groupDialog: { id: 'grp-other' } },
        instanceStore: {
            applyWorldDialogInstances: vi.fn(),
            applyGroupDialogInstances: vi.fn()
        },
        feedStore: {
            addFeedEntry: vi.fn(() => sideEffectOrder.push('feed'))
        },
        notificationStore: {
            queueFeedNoty: vi.fn(() => sideEffectOrder.push('notification'))
        },
        sharedFeedStore: {
            addEntry: vi.fn(() => sideEffectOrder.push('shared-feed'))
        },
        generalSettingsStore: { logEmptyAvatars: false },
        database: {
            addBioToDatabase: vi.fn(() => sideEffectOrder.push('database')),
            addGPSToDatabase: vi.fn(),
            addAvatarToDatabase: vi.fn(),
            addStatusToDatabase: vi.fn()
        },
        now: () => 2000,
        nowIso: () => '2026-09-04T00:00:02.000Z'
    };
}

describe('runHandleUserUpdateFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(mocks.database)) {
            delete mocks.database[key];
        }
        mocks.friendStore = {};
        mocks.userStore = {};
        mocks.worldStore = {};
        mocks.groupStore = {};
        mocks.instanceStore = {};
        mocks.feedStore = {};
        mocks.notificationStore = {};
        mocks.sharedFeedStore = {};
        mocks.generalSettingsStore = {};
    });

    it('uses injected capabilities for a friend-update Bio record', async () => {
        const sideEffectOrder = [];
        const dependencies = createDependencies(sideEffectOrder);
        const ref = {
            id: 'usr-friend',
            displayName: 'Friend'
        };

        await runHandleUserUpdateFlowWithDependencies(
            ref,
            { bio: ['new bio', 'old bio'] },
            dependencies
        );

        expect(sideEffectOrder).toEqual([
            'notification',
            'shared-feed',
            'feed',
            'database'
        ]);
        expect(dependencies.database.addBioToDatabase).toHaveBeenCalledWith({
            created_at: '2026-09-04T00:00:02.000Z',
            type: 'Bio',
            userId: 'usr-friend',
            displayName: 'Friend',
            bio: 'new bio',
            previousBio: 'old bio'
        });
        expect(mocks.database.addBioToDatabase).toBeUndefined();
    });

    it('keeps the existing entry point wired to the default stores', async () => {
        const dependencies = createDependencies();
        mocks.friendStore = dependencies.friendStore;
        mocks.userStore = dependencies.userStore;
        mocks.worldStore = dependencies.worldStore;
        mocks.groupStore = dependencies.groupStore;
        mocks.instanceStore = dependencies.instanceStore;
        mocks.feedStore = dependencies.feedStore;
        mocks.notificationStore = dependencies.notificationStore;
        mocks.sharedFeedStore = dependencies.sharedFeedStore;
        mocks.generalSettingsStore = dependencies.generalSettingsStore;
        Object.assign(mocks.database, dependencies.database);
        const ref = {
            id: 'usr-friend',
            displayName: 'Friend'
        };

        await runHandleUserUpdateFlow(
            ref,
            { bio: ['new bio', 'old bio'] },
            { nowIso: () => '2026-09-04T00:00:03.000Z' }
        );

        expect(mocks.database.addBioToDatabase).toHaveBeenCalledOnce();
        expect(mocks.feedStore.addFeedEntry).toHaveBeenCalledOnce();
    });
});
