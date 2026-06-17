import { watch } from 'vue';

import {
    instanceRequest,
    notificationRequest,
    userRequest
} from '../api';
import { watchState } from './watchState';
import {
    useFriendStore,
    useGameStore,
    useLaunchStore,
    useLocationStore,
    useNotificationStore,
    useUiStore,
    useUserStore
} from '../stores';
import { parseLocation } from '../shared/utils';

const SNAPSHOT_VERSION = 1;
const DANGEROUS_ACTIONS = new Set([
    'notification.respondInvite',
    'notification.hide',
    'notification.see'
]);

function toPlainUser(user, privacyMode) {
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        displayName: user.displayName || user.username || user.id,
        userIcon: user.userIcon || '',
        currentAvatarThumbnailImageUrl:
            user.currentAvatarThumbnailImageUrl || '',
        profilePicOverride: user.profilePicOverride || '',
        status: user.status || '',
        statusDescription: privacyMode ? '' : user.statusDescription || '',
        state: user.state || '',
        location: privacyMode ? '' : user.location || user.$location?.tag || '',
        travelingToLocation: privacyMode
            ? ''
            : user.travelingToLocation || user.$travelingToLocation || '',
        isFriend: Boolean(user.isFriend || user.$isFriend),
        isFavorite: Boolean(user.$isFavorite)
    };
}

function toPlainNotification(notification, privacyMode) {
    if (!notification) {
        return null;
    }
    return {
        id: notification.id,
        type: notification.type,
        created_at: notification.created_at,
        senderUserId: notification.senderUserId,
        senderUsername: privacyMode ? 'Hidden' : notification.senderUsername,
        receiverUserId: notification.receiverUserId,
        message: privacyMode ? '' : notification.message || '',
        details: privacyMode ? null : notification.details || null,
        seen: notification.seen !== false,
        imageUrl: privacyMode ? '' : notification.imageUrl || ''
    };
}

function getNotificationCenterItems(notificationStore) {
    const groups = [
        notificationStore.unseenFriendNotifications || [],
        notificationStore.unseenGroupNotifications || [],
        notificationStore.unseenOtherNotifications || [],
        notificationStore.recentFriendNotifications || [],
        notificationStore.recentGroupNotifications || [],
        notificationStore.recentOtherNotifications || []
    ];
    const seen = new Set();
    const output = [];
    for (const group of groups) {
        for (const notification of group) {
            if (!notification?.id || seen.has(notification.id)) {
                continue;
            }
            seen.add(notification.id);
            output.push(notification);
        }
    }
    return output;
}

function buildSnapshot(options = {}) {
    const privacyMode = Boolean(options.privacyMode);
    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const locationStore = useLocationStore();
    const notificationStore = useNotificationStore();
    const gameStore = useGameStore();
    const uiStore = useUiStore();

    const friends = Array.from(friendStore.friends.values())
        .map((friend) => toPlainUser(friend, privacyMode))
        .filter(Boolean)
        .sort((a, b) => {
            const stateOrder = { active: 0, online: 1, offline: 2 };
            return (
                (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9) ||
                String(a.displayName).localeCompare(String(b.displayName))
            );
        });

    const currentLocation = locationStore.lastLocation || {};
    const currentLocationValue = privacyMode
        ? ''
        : currentLocation.location || userStore.currentUser?.location || '';
    const currentInstanceUsers = [];
    const playerList = currentLocation.playerList;
    if (playerList instanceof Map) {
        for (const user of playerList.values()) {
            currentInstanceUsers.push(toPlainUser(user, privacyMode));
        }
    }

    return {
        version: SNAPSHOT_VERSION,
        generatedAt: new Date().toISOString(),
        loggedIn: Boolean(watchState.isLoggedIn),
        friendsLoaded: Boolean(watchState.isFriendsLoaded),
        currentUser: toPlainUser(userStore.currentUser, privacyMode),
        status: {
            value: userStore.currentUser?.status || '',
            description: privacyMode
                ? ''
                : userStore.currentUser?.statusDescription || ''
        },
        game: {
            isRunning: Boolean(gameStore.isGameRunning),
            isNoVr: Boolean(gameStore.isGameNoVR),
            isSteamVrRunning: Boolean(gameStore.isSteamVRRunning)
        },
        location: {
            location: currentLocationValue,
            name: privacyMode ? '' : currentLocation.name || '',
            travelingTo: privacyMode
                ? ''
                : locationStore.lastLocationDestination || '',
            users: currentInstanceUsers.filter(Boolean)
        },
        friends,
        notifications: getNotificationCenterItems(notificationStore)
            .slice(0, 80)
            .map((notification) =>
                toPlainNotification(notification, privacyMode)
            )
            .filter(Boolean),
        notifiedMenus: [...uiStore.notifiedMenus]
    };
}

function requireConfirmed(type, payload) {
    if (DANGEROUS_ACTIONS.has(type) && payload?.confirmed !== true) {
        const err = new Error('Action requires confirmation');
        err.code = 'CONFIRMATION_REQUIRED';
        throw err;
    }
}

async function executeAction(type, payload = {}) {
    if (!watchState.isLoggedIn && type !== 'ui.clearNotificationCenter') {
        throw new Error('VRCX is not logged in');
    }
    requireConfirmed(type, payload);

    switch (type) {
        case 'user.setStatus':
            await userRequest.saveCurrentUser({
                status: payload.status,
                statusDescription: payload.statusDescription || ''
            });
            return { ok: true };

        case 'friend.requestInvite':
            if (!payload.userId) {
                throw new Error('Missing userId');
            }
            await notificationRequest.sendRequestInvite({}, payload.userId);
            return { ok: true };

        case 'friend.selfInvite': {
            if (!payload.location) {
                throw new Error('Missing location');
            }
            const L = parseLocation(payload.location);
            await instanceRequest.selfInvite({
                instanceId: L.instanceId,
                worldId: L.worldId,
                shortName: payload.shortName || ''
            });
            return { ok: true };
        }

        case 'instance.open': {
            if (!payload.location) {
                throw new Error('Missing location');
            }
            const launchStore = useLaunchStore();
            await launchStore.tryOpenInstanceInVrc(
                payload.location,
                payload.shortName || null
            );
            return { ok: true };
        }

        case 'instance.launch': {
            if (!payload.location) {
                throw new Error('Missing location');
            }
            const launchStore = useLaunchStore();
            await launchStore.launchGame(
                payload.location,
                payload.shortName || null,
                Boolean(payload.desktopMode)
            );
            return { ok: true };
        }

        case 'ui.clearNotificationCenter':
            useUiStore().clearAllNotifications();
            useNotificationStore().clearNotificationCenter?.();
            return { ok: true };

        case 'notification.see':
            if (!payload.notificationId) {
                throw new Error('Missing notificationId');
            }
            await notificationRequest.seeNotificationV2({
                notificationId: payload.notificationId
            });
            return { ok: true };

        case 'notification.hide':
            if (!payload.notificationId) {
                throw new Error('Missing notificationId');
            }
            await notificationRequest.hideNotificationV2(payload.notificationId);
            return { ok: true };

        case 'notification.respondInvite':
            if (
                !payload.notificationId ||
                !payload.responseType ||
                typeof payload.responseData !== 'string'
            ) {
                throw new Error('Missing invite response payload');
            }
            await notificationRequest.sendNotificationResponse({
                notificationId: payload.notificationId,
                responseType: payload.responseType,
                responseData: payload.responseData
            });
            return { ok: true };

        default: {
            const err = new Error(`Unknown remote action: ${type}`);
            err.code = 'UNKNOWN_ACTION';
            throw err;
        }
    }
}

function createBridge() {
    let notifySnapshotChanged = () => {};
    let timer = null;

    function scheduleSnapshotChanged() {
        if (timer) {
            return;
        }
        timer = window.setTimeout(() => {
            timer = null;
            notifySnapshotChanged();
        }, 500);
    }

    watch(
        () => [
            watchState.isLoggedIn,
            watchState.isFriendsLoaded,
            useUserStore().currentUser,
            useFriendStore().friends.size,
            useNotificationStore().unseenNotifications.length,
            useUiStore().notifiedMenus.length,
            useLocationStore().lastLocation.location,
            useLocationStore().lastLocationDestination,
            useGameStore().isGameRunning
        ],
        scheduleSnapshotChanged,
        { deep: true }
    );

    return {
        getRemoteSnapshot: (options) => buildSnapshot(options),
        executeRemoteAction: executeAction,
        setSnapshotChangedCallback(callback) {
            notifySnapshotChanged =
                typeof callback === 'function' ? callback : () => {};
        }
    };
}

export function initRemoteAccessBridge() {
    window.$remoteBridge = createBridge();
}

export { buildSnapshot, executeAction };
