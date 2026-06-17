import { watch } from 'vue';

import {
    instanceRequest,
    miscRequest,
    notificationRequest,
    userRequest
} from '../api';
import { watchState } from './watchState';
import { useAutoFollowStore } from '../stores/autoFollow';
import { useFriendStore } from '../stores/friend';
import { useFavoriteStore } from '../stores/favorite';
import { useGameStore } from '../stores/game';
import { useGameLogStore } from '../stores/gameLog';
import { useInstanceStore } from '../stores/instance';
import { useLaunchStore } from '../stores/launch';
import { useLocationStore } from '../stores/location';
import { useNotificationStore } from '../stores/notification';
import { useAvatarStore } from '../stores/avatar';
import { useSearchStore } from '../stores/search';
import { useSharedFeedStore } from '../stores/sharedFeed';
import { useUiStore } from '../stores/ui';
import { useUserStore } from '../stores/user';
import { useWorldStore } from '../stores/world';
import { isRealInstance, parseLocation } from '../shared/utils';
import { showUserDialog } from '../coordinators/userCoordinator';

const SNAPSHOT_VERSION = 1;
const DANGEROUS_ACTIONS = new Set([
    'notification.respondInvite',
    'notification.hide',
    'notification.see'
]);

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_MAP = Object.freeze(new Map());

function asArray(value) {
    return Array.isArray(value) ? value : EMPTY_ARRAY;
}

function asMap(value) {
    return value instanceof Map ? value : EMPTY_MAP;
}

function safeStore(factory, fallback = {}) {
    try {
        return factory();
    } catch {
        return fallback;
    }
}

function getWorldDisplayName(location, worldStore) {
    if (privacyModeLocation(location)) {
        return location || '';
    }
    const parsed = parseLocation(location || '');
    if (!parsed.worldId) {
        return location || '';
    }
    return (
        worldStore?.cachedWorlds?.get(parsed.worldId)?.name ||
        (isRealInstance(location) ? location : location || '')
    );
}

function privacyModeLocation(location) {
    return !location || location === 'private' || location === 'offline';
}

function plainEntry(entry, privacyMode, stores = {}) {
    if (!entry) {
        return null;
    }
    const location = entry.location || entry.details?.location || '';
    const locationName =
        entry.worldName ||
        entry.instanceDisplayName ||
        stores.instanceStore?.cachedInstances?.get(location)?.displayName ||
        getWorldDisplayName(location, stores.worldStore);
    return {
        id: entry.id || entry.rowId || '',
        type: entry.type || '',
        created_at: entry.created_at || '',
        displayName: privacyMode
            ? 'Hidden'
            : entry.displayName || entry.senderUsername || '',
        userId: entry.userId || entry.senderUserId || '',
        location: privacyMode ? '' : location,
        locationName: privacyMode ? '' : locationName,
        worldName: privacyMode ? '' : locationName,
        groupName: privacyMode ? '' : entry.groupName || '',
        message: privacyMode ? '' : entry.message || entry.data || '',
        videoName: privacyMode ? '' : entry.videoName || '',
        isFriend: Boolean(entry.isFriend),
        isFavorite: Boolean(entry.isFavorite)
    };
}

function toPlainUser(user, privacyMode, stores = {}) {
    if (!user) {
        return null;
    }
    const ref = user.ref || user;
    const location = privacyMode
        ? ''
        : ref.location ||
          ref.$locationTag ||
          ref.$location?.tag ||
          user.location ||
          user.$locationTag ||
          user.$location?.tag ||
          '';
    const travelingToLocation = privacyMode
        ? ''
        : ref.travelingToLocation ||
          ref.$travelingToLocation ||
          user.travelingToLocation ||
          user.$travelingToLocation ||
          '';
    const locationName =
        user.locationName ||
        ref.locationName ||
        user.worldName ||
        ref.worldName ||
        user.$worldName ||
        ref.$worldName ||
        user.$location?.worldName ||
        ref.$location?.worldName ||
        stores.instanceStore?.cachedInstances?.get(location)?.displayName ||
        getWorldDisplayName(location, stores.worldStore);
    return {
        id: ref.id || user.id,
        displayName:
            ref.displayName ||
            user.displayName ||
            user.name ||
            ref.username ||
            ref.id ||
            user.id,
        userIcon: ref.userIcon || user.userIcon || '',
        currentAvatarThumbnailImageUrl:
            ref.currentAvatarThumbnailImageUrl ||
            user.currentAvatarThumbnailImageUrl ||
            '',
        profilePicOverride:
            ref.profilePicOverride || user.profilePicOverride || '',
        status: ref.status || user.status || '',
        statusDescription: privacyMode
            ? ''
            : ref.statusDescription || user.statusDescription || '',
        state: user.state || ref.state || '',
        location,
        locationName: privacyMode ? '' : locationName,
        worldName: privacyMode ? '' : locationName,
        travelingToLocation,
        isFriend: Boolean(user.isFriend || user.$isFriend),
        isFavorite: Boolean(user.$isFavorite)
    };
}

function toPlainNotification(notification, privacyMode) {
    if (!notification) {
        return null;
    }
    const responses =
        privacyMode || !Array.isArray(notification.responses)
            ? []
            : notification.responses.map((response) => ({
                  type: response.type || '',
                  text: response.text || '',
                  icon: response.icon || '',
                  data: response.data || ''
              }));
    return {
        id: notification.id,
        type: notification.type,
        created_at: notification.created_at,
        senderUserId: notification.senderUserId,
        senderUsername: privacyMode ? 'Hidden' : notification.senderUsername,
        receiverUserId: notification.receiverUserId,
        message: privacyMode ? '' : notification.message || '',
        details: privacyMode ? null : notification.details || null,
        responses,
        seen: notification.seen !== false,
        imageUrl: privacyMode ? '' : notification.imageUrl || ''
    };
}

function getNotificationCenterItems(notificationStore) {
    const groups = [
        asArray(notificationStore.unseenFriendNotifications),
        asArray(notificationStore.unseenGroupNotifications),
        asArray(notificationStore.unseenOtherNotifications),
        asArray(notificationStore.recentFriendNotifications),
        asArray(notificationStore.recentGroupNotifications),
        asArray(notificationStore.recentOtherNotifications)
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
    const instanceStore = safeStore(useInstanceStore, {
        cachedInstances: new Map(),
        currentInstanceWorld: { ref: {} }
    });
    const autoFollowStore = safeStore(useAutoFollowStore);
    const favoriteStore = safeStore(useFavoriteStore);
    const gameLogStore = safeStore(useGameLogStore, {
        gameLogTableData: [],
        latestGameLogEntry: null,
        nowPlaying: {}
    });
    const sharedFeedStore = safeStore(useSharedFeedStore, {
        sharedFeedData: []
    });
    const avatarStore = safeStore(useAvatarStore, {
        avatarHistory: [],
        cachedAvatars: new Map()
    });
    const worldStore = safeStore(useWorldStore, {
        cachedWorlds: new Map()
    });
    const searchStore = safeStore(useSearchStore, {
        searchUserResults: []
    });

    const friendMap = asMap(friendStore.friends);
    const notifiedMenus = asArray(uiStore.notifiedMenus);
    const favoriteFriends = asArray(favoriteStore.favoriteFriends);
    const favoriteWorlds = asArray(favoriteStore.favoriteWorlds);
    const favoriteAvatars = asArray(favoriteStore.favoriteAvatars);

    const friends = Array.from(friendMap.values())
        .map((friend) =>
            toPlainUser(friend, privacyMode, { instanceStore, worldStore })
        )
        .filter(Boolean)
        .sort((a, b) => {
            const stateOrder = { active: 0, online: 1, offline: 2 };
            return (
                (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9) ||
                String(a.displayName).localeCompare(String(b.displayName))
            );
        });
    const friendGroups = {
        favorite: friends.filter((friend) => friend.isFavorite).slice(0, 120),
        active: friends.filter((friend) => friend.state === 'active').slice(0, 120),
        online: friends.filter((friend) => friend.state === 'online').slice(0, 160),
        offline: friends.filter((friend) => friend.state === 'offline' || !friend.state).slice(0, 80)
    };

    const currentLocation = locationStore.lastLocation || {};
    const currentLocationValue = privacyMode
        ? ''
        : currentLocation.location || userStore.currentUser?.location || '';
    const currentWorldName =
        currentLocation.name ||
        instanceStore.currentInstanceWorld?.ref?.name ||
        getWorldDisplayName(currentLocationValue, worldStore);
    const currentInstanceUsers = [];
    const playerList = currentLocation.playerList;
    if (playerList instanceof Map) {
        for (const user of playerList.values()) {
            currentInstanceUsers.push(
                toPlainUser(user, privacyMode, { instanceStore, worldStore })
            );
        }
    }

    return {
        version: SNAPSHOT_VERSION,
        generatedAt: new Date().toISOString(),
        loggedIn: Boolean(watchState.isLoggedIn),
        friendsLoaded: Boolean(watchState.isFriendsLoaded),
        currentUser: toPlainUser(userStore.currentUser, privacyMode, {
            instanceStore,
            worldStore
        }),
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
        autoFollow: {
            isActive: Boolean(autoFollowStore.isActive),
            isJoining: Boolean(autoFollowStore.isJoining),
            targetFriendId: autoFollowStore.targetFriendId || '',
            targetFriendName: autoFollowStore.targetFriendName || '',
            statusText: autoFollowStore.statusText || ''
        },
        location: {
            location: currentLocationValue,
            name: privacyMode ? '' : currentWorldName || '',
            travelingTo: privacyMode
                ? ''
                : locationStore.lastLocationDestination || '',
            users: currentInstanceUsers.filter(Boolean)
        },
        friends,
        friendGroups,
        notifications: getNotificationCenterItems(notificationStore)
            .slice(0, 80)
            .map((notification) =>
                toPlainNotification(notification, privacyMode)
            )
            .filter(Boolean),
        notifiedMenus: [...notifiedMenus],
        feed: asArray(sharedFeedStore.sharedFeedData)
            .slice(0, 80)
            .map((entry) =>
                plainEntry(entry, privacyMode, { instanceStore, worldStore })
            )
            .filter(Boolean),
        gameLog: {
            latest: plainEntry(gameLogStore.latestGameLogEntry, privacyMode, {
                instanceStore,
                worldStore
            }),
            rows: asArray(gameLogStore.gameLogTableData)
                .slice(0, 80)
                .map((entry) =>
                    plainEntry(entry, privacyMode, {
                        instanceStore,
                        worldStore
                    })
                )
                .filter(Boolean),
            nowPlaying: privacyMode
                ? {}
                : {
                      name: gameLogStore.nowPlaying?.name || '',
                      url: gameLogStore.nowPlaying?.url || '',
                      remainingText:
                          gameLogStore.nowPlaying?.remainingText || '',
                      percentage: gameLogStore.nowPlaying?.percentage || 0,
                      playing: Boolean(gameLogStore.nowPlaying?.playing)
                  }
        },
        favorites: {
            friends: favoriteFriends.slice(0, 80).map((friend) =>
                toPlainUser(friend, privacyMode, { instanceStore, worldStore })
            ),
            worlds: favoriteWorlds.slice(0, 80).map((world) => ({
                id: world.id,
                name: privacyMode ? '' : world.name,
                authorName: privacyMode ? '' : world.authorName,
                imageUrl: privacyMode ? '' : world.imageUrl || world.thumbnailImageUrl || ''
            })),
            avatars: favoriteAvatars.slice(0, 80).map((avatar) => ({
                id: avatar.id,
                name: privacyMode ? '' : avatar.name,
                authorName: privacyMode ? '' : avatar.authorName,
                imageUrl: privacyMode ? '' : avatar.imageUrl || avatar.thumbnailImageUrl || ''
            }))
        },
        library: {
            avatarHistory: asArray(avatarStore.avatarHistory)
                .slice(0, 60)
                .map((avatar) => ({
                    id: avatar.id,
                    name: privacyMode ? '' : avatar.name,
                    authorName: privacyMode ? '' : avatar.authorName,
                    imageUrl: privacyMode ? '' : avatar.imageUrl || avatar.thumbnailImageUrl || ''
                })),
            cachedWorlds: Array.from(asMap(worldStore.cachedWorlds).values())
                .slice(0, 60)
                .map((world) => ({
                    id: world.id,
                    name: privacyMode ? '' : world.name,
                    authorName: privacyMode ? '' : world.authorName,
                    imageUrl: privacyMode ? '' : world.imageUrl || world.thumbnailImageUrl || ''
                }))
        },
        search: {
            users: asArray(searchStore.searchUserResults)
                .slice(0, 20)
                .map((user) =>
                    toPlainUser(user, privacyMode, { instanceStore, worldStore })
                )
                .filter(Boolean)
        },
        capabilities: [
            'user.setStatus',
            'user.open',
            'friend.requestInvite',
            'friend.selfInvite',
            'instance.open',
            'instance.launch',
            'ui.clearNotificationCenter',
            'notification.see',
            'notification.hide',
            'notification.respondInvite',
            'notification.markAllSeen',
            'friend.refresh',
            'user.boop',
            'autoFollow.start',
            'autoFollow.stop',
            'search.user'
        ],
        app: {
            version: typeof VERSION === 'string' ? VERSION : '',
            platform: LINUX ? 'linux' : WINDOWS ? 'windows' : 'unknown'
        }
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

        case 'user.open':
            if (!payload.userId) {
                throw new Error('Missing userId');
            }
            showUserDialog(payload.userId);
            return { ok: true };

        case 'friend.requestInvite':
            if (!payload.userId) {
                throw new Error('Missing userId');
            }
            await notificationRequest.sendRequestInvite({}, payload.userId);
            return { ok: true };

        case 'user.boop':
            if (!payload.userId) {
                throw new Error('Missing userId');
            }
            await miscRequest.sendBoop({
                userId: payload.userId,
                emojiId: payload.emojiId || undefined
            });
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

        case 'notification.markAllSeen':
            useNotificationStore().markAllAsSeen?.();
            return { ok: true };

        case 'friend.refresh':
            await useFriendStore().refreshFriends?.();
            return { ok: true };

        case 'autoFollow.start': {
            if (!payload.userId) {
                throw new Error('Missing userId');
            }
            const friend = useFriendStore().friends.get(payload.userId);
            if (!friend) {
                throw new Error('Friend not found');
            }
            await useAutoFollowStore().startFollow(friend.ref || friend, {
                confirm: false,
                initialJoin: payload.initialJoin !== false,
                launchMode: payload.launchMode
            });
            return { ok: true };
        }

        case 'autoFollow.stop':
            await useAutoFollowStore().stopFollow({ silent: false });
            return { ok: true };

        case 'search.user':
            if (!payload.query || String(payload.query).trim().length < 2) {
                throw new Error('Missing search query');
            }
            await useSearchStore().searchUserByDisplayName(
                String(payload.query).trim()
            );
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
    let stopWatching = null;

    function scheduleSnapshotChanged() {
        if (timer) {
            return;
        }
        timer = window.setTimeout(() => {
            timer = null;
            notifySnapshotChanged();
        }, 500);
    }

    function ensureWatching() {
        if (stopWatching) {
            return;
        }
        stopWatching = watch(
            () => [
                watchState.isLoggedIn,
                watchState.isFriendsLoaded,
                useUserStore().currentUser,
                useFriendStore().friends?.size ?? 0,
                useNotificationStore().unseenNotifications?.length ?? 0,
                useUiStore().notifiedMenus?.length ?? 0,
                useLocationStore().lastLocation?.location ?? '',
                useLocationStore().lastLocationDestination,
                useGameStore().isGameRunning
            ],
            scheduleSnapshotChanged,
            { deep: true }
        );
    }

    return {
        getRemoteSnapshot(options) {
            ensureWatching();
            return buildSnapshot(options);
        },
        executeRemoteAction(type, payload) {
            ensureWatching();
            return executeAction(type, payload);
        },
        setSnapshotChangedCallback(callback) {
            notifySnapshotChanged =
                typeof callback === 'function' ? callback : () => {};
            ensureWatching();
        }
    };
}

export function initRemoteAccessBridge() {
    window.$remoteBridge = createBridge();
}

export { buildSnapshot, executeAction };
