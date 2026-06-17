import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    watchState: {
        isLoggedIn: true,
        isFriendsLoaded: true
    },
    saveCurrentUser: vi.fn(() => Promise.resolve()),
    seeNotificationV2: vi.fn(() => Promise.resolve()),
    hideNotificationV2: vi.fn(() => Promise.resolve()),
    sendNotificationResponse: vi.fn(() => Promise.resolve()),
    sendRequestInvite: vi.fn(() => Promise.resolve()),
    selfInvite: vi.fn(() => Promise.resolve()),
    launchGame: vi.fn(() => Promise.resolve()),
    tryOpenInstanceInVrc: vi.fn(() => Promise.resolve()),
    currentUser: {
        id: 'usr_me',
        displayName: 'Me',
        status: 'active',
        statusDescription: 'private status',
        location: 'wrld_home:123'
    },
    friends: new Map([
        [
            'usr_friend',
            {
                id: 'usr_friend',
                name: 'Friend context fallback',
                state: 'online',
                ref: {
                    id: 'usr_friend',
                    displayName: 'Friend',
                    state: 'online',
                    location: 'wrld_friend:456',
                    statusDescription: 'friend status',
                    currentAvatarThumbnailImageUrl: 'https://img/friend.png'
                }
            }
        ]
    ]),
    notifications: [
        {
            id: 'not_1',
            type: 'invite',
            created_at: '2026-06-17T00:00:00.000Z',
            senderUserId: 'usr_friend',
            senderUsername: 'Friend',
            receiverUserId: 'usr_me',
            message: 'secret invite',
            details: { worldId: 'wrld_friend' },
            seen: false
        }
    ],
    notifiedMenus: ['Notifications'],
    storeOverrides: {},
    storeAccesses: [],
    watch: vi.fn((source) => {
        source();
        return vi.fn();
    }),
    clearAllNotifications: vi.fn(),
    clearNotificationCenter: vi.fn()
}));

vi.mock('vue', () => ({
    watch: (...args) => mocks.watch(...args)
}));

vi.mock('../watchState', () => ({
    watchState: mocks.watchState
}));

vi.mock('../../api', () => ({
    instanceRequest: {
        selfInvite: (...args) => mocks.selfInvite(...args)
    },
    notificationRequest: {
        hideNotificationV2: (...args) => mocks.hideNotificationV2(...args),
        seeNotificationV2: (...args) => mocks.seeNotificationV2(...args),
        sendNotificationResponse: (...args) =>
            mocks.sendNotificationResponse(...args),
        sendRequestInvite: (...args) => mocks.sendRequestInvite(...args)
    },
    userRequest: {
        saveCurrentUser: (...args) => mocks.saveCurrentUser(...args)
    }
}));

function getStoreOverride(key, fallback) {
    return Object.hasOwn(mocks.storeOverrides, key)
        ? mocks.storeOverrides[key]
        : fallback;
}

vi.mock('../../stores/friend', () => ({
    useFriendStore: () => {
        mocks.storeAccesses.push('friend');
        return {
            friends: getStoreOverride('friends', mocks.friends)
        };
    }
}));

vi.mock('../../stores/game', () => ({
    useGameStore: () => {
        mocks.storeAccesses.push('game');
        return {
            isGameRunning: getStoreOverride('isGameRunning', true),
            isGameNoVR: getStoreOverride('isGameNoVR', false),
            isSteamVRRunning: getStoreOverride('isSteamVRRunning', true)
        };
    }
}));

vi.mock('../../stores/launch', () => ({
    useLaunchStore: () => ({
        launchGame: (...args) => mocks.launchGame(...args),
        tryOpenInstanceInVrc: (...args) => mocks.tryOpenInstanceInVrc(...args)
    })
}));

vi.mock('../../stores/location', () => ({
    useLocationStore: () => {
        mocks.storeAccesses.push('location');
        return {
            lastLocation: getStoreOverride('lastLocation', {
                location: 'wrld_home:123',
                name: 'Home',
                playerList: new Map()
            }),
            lastLocationDestination: getStoreOverride(
                'lastLocationDestination',
                ''
            )
        };
    }
}));

vi.mock('../../stores/notification', () => ({
    useNotificationStore: () => {
        mocks.storeAccesses.push('notification');
        return {
            unseenFriendNotifications: getStoreOverride(
                'unseenFriendNotifications',
                mocks.notifications
            ),
            unseenGroupNotifications: getStoreOverride(
                'unseenGroupNotifications',
                []
            ),
            unseenOtherNotifications: getStoreOverride(
                'unseenOtherNotifications',
                []
            ),
            recentFriendNotifications: getStoreOverride(
                'recentFriendNotifications',
                []
            ),
            recentGroupNotifications: getStoreOverride(
                'recentGroupNotifications',
                []
            ),
            recentOtherNotifications: getStoreOverride(
                'recentOtherNotifications',
                []
            ),
            unseenNotifications: getStoreOverride(
                'unseenNotifications',
                mocks.notifications
            ),
            clearNotificationCenter: (...args) =>
                mocks.clearNotificationCenter(...args)
        };
    }
}));

vi.mock('../../stores/ui', () => ({
    useUiStore: () => {
        mocks.storeAccesses.push('ui');
        return {
            notifiedMenus: getStoreOverride('notifiedMenus', mocks.notifiedMenus),
            clearAllNotifications: (...args) =>
                mocks.clearAllNotifications(...args)
        };
    }
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => {
        mocks.storeAccesses.push('user');
        return {
            currentUser: getStoreOverride('currentUser', mocks.currentUser)
        };
    }
}));

vi.mock('../../shared/utils', () => ({
    parseLocation: () => ({
        worldId: 'wrld_friend',
        instanceId: '456'
    })
}));

describe('remoteAccessBridge', () => {
    beforeEach(() => {
        mocks.storeOverrides = {};
        mocks.storeAccesses = [];
        mocks.watch.mockClear();
    });

    it('does not instantiate app stores while registering the remote bridge', async () => {
        const { initRemoteAccessBridge } = await import(
            '../remoteAccessBridge'
        );

        initRemoteAccessBridge();

        expect(window.$remoteBridge).toBeTruthy();
        expect(mocks.storeAccesses).toEqual([]);
    });

    it('rejects unknown remote actions', async () => {
        const { executeAction } = await import('../remoteAccessBridge');

        await expect(executeAction('unknown.action')).rejects.toThrow(
            'Unknown remote action'
        );
    });

    it('requires confirmation for dangerous notification actions', async () => {
        const { executeAction } = await import('../remoteAccessBridge');

        await expect(
            executeAction('notification.see', { notificationId: 'not_1' })
        ).rejects.toThrow('Action requires confirmation');

        await executeAction('notification.see', {
            notificationId: 'not_1',
            confirmed: true
        });

        expect(mocks.seeNotificationV2).toHaveBeenCalledWith({
            notificationId: 'not_1'
        });
    });

    it('redacts sensitive fields in privacy mode snapshots', async () => {
        const { buildSnapshot } = await import('../remoteAccessBridge');

        const snapshot = buildSnapshot({ privacyMode: true });

        expect(snapshot.currentUser.statusDescription).toBe('');
        expect(snapshot.currentUser.location).toBe('');
        expect(snapshot.notifications[0].senderUsername).toBe('Hidden');
        expect(snapshot.notifications[0].message).toBe('');
        expect(snapshot.notifications[0].details).toBeNull();
    });

    it('builds friend snapshots from friend context refs', async () => {
        const { buildSnapshot } = await import('../remoteAccessBridge');

        const snapshot = buildSnapshot();

        expect(snapshot.friends[0]).toMatchObject({
            id: 'usr_friend',
            displayName: 'Friend',
            currentAvatarThumbnailImageUrl: 'https://img/friend.png',
            state: 'online',
            location: 'wrld_friend:456'
        });
    });

    it('tolerates stores that are not fully initialised during startup', async () => {
        mocks.storeOverrides = {
            friends: undefined,
            unseenFriendNotifications: undefined,
            unseenNotifications: undefined,
            notifiedMenus: undefined,
            lastLocation: undefined,
            lastLocationDestination: undefined,
            currentUser: undefined
        };
        const { buildSnapshot, initRemoteAccessBridge } = await import(
            '../remoteAccessBridge'
        );

        const snapshot = buildSnapshot();

        expect(snapshot.currentUser).toBeNull();
        expect(snapshot.friends).toEqual([]);
        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.notifiedMenus).toEqual([]);
        expect(snapshot.location.location).toBe('');
        expect(() => initRemoteAccessBridge()).not.toThrow();
    });
});
