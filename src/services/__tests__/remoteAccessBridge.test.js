import { describe, expect, it, vi } from 'vitest';

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
                displayName: 'Friend',
                state: 'online',
                location: 'wrld_friend:456',
                statusDescription: 'friend status'
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
    clearAllNotifications: vi.fn(),
    clearNotificationCenter: vi.fn()
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

vi.mock('../../stores', () => ({
    useFriendStore: () => ({
        friends: mocks.friends
    }),
    useGameStore: () => ({
        isGameRunning: true,
        isGameNoVR: false,
        isSteamVRRunning: true
    }),
    useLaunchStore: () => ({
        launchGame: (...args) => mocks.launchGame(...args),
        tryOpenInstanceInVrc: (...args) => mocks.tryOpenInstanceInVrc(...args)
    }),
    useLocationStore: () => ({
        lastLocation: {
            location: 'wrld_home:123',
            name: 'Home',
            playerList: new Map()
        },
        lastLocationDestination: ''
    }),
    useNotificationStore: () => ({
        unseenFriendNotifications: mocks.notifications,
        unseenGroupNotifications: [],
        unseenOtherNotifications: [],
        recentFriendNotifications: [],
        recentGroupNotifications: [],
        recentOtherNotifications: [],
        unseenNotifications: mocks.notifications,
        clearNotificationCenter: (...args) =>
            mocks.clearNotificationCenter(...args)
    }),
    useUiStore: () => ({
        notifiedMenus: mocks.notifiedMenus,
        clearAllNotifications: (...args) => mocks.clearAllNotifications(...args)
    }),
    useUserStore: () => ({
        currentUser: mocks.currentUser
    })
}));

vi.mock('../../shared/utils', () => ({
    parseLocation: () => ({
        worldId: 'wrld_friend',
        instanceId: '456'
    })
}));

describe('remoteAccessBridge', () => {
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
});
