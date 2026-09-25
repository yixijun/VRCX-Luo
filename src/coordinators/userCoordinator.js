import { reactive } from 'vue';
import { toast } from '../services/toastAdapter';
import { i18n } from '../plugins/i18n';

import {
    arraysMatch,
    computeUserPlatform,
    createDefaultUserRef,
    diffObjectProps,
    evictMapCache,
    extractFileId,
    findUserByDisplayName,
    getWorldName,
    isRealInstance,
    parseLocation,
    sanitizeUserJson
} from '../shared/utils';
import { getUserMemo } from './memoCoordinator';
import {
    avatarRequest,
    instanceRequest,
    queryRequest,
    userRequest
} from '../api';
import { processBulk, request } from '../services/request';
import { AppDebug } from '../services/appConfig';
import { database } from '../services/database';
import { patchUserFromEvent } from '../queries';
import { watchState } from '../services/watchState';
import { applyAvatar, showAvatarDialog } from './avatarCoordinator';
import { applyFavorite } from './favoriteCoordinator';
import {
    runAvatarSwapFlow,
    runFirstLoginFlow,
    runHomeLocationSyncFlow,
    runPostApplySyncFlow
} from './userSessionCoordinator';
import { runHandleUserUpdateFlow } from './userEventCoordinator';
import { runUpdateCurrentUserLocationFlow } from './locationCoordinator';
import { runUpdateFriendFlow } from './friendPresenceCoordinator';
import { userOnFriend } from './friendRelationshipCoordinator';
import { handleGroupRepresented } from './groupCoordinator';
import { useAppearanceSettingsStore } from '../stores/settings/appearance';
import { useAuthStore } from '../stores/auth';
import { useAvatarStore } from '../stores/avatar';
import { useFavoriteStore } from '../stores/favorite';
import { useFriendStore } from '../stores/friend';
import { useGameStore } from '../stores/game';
import { useGeneralSettingsStore } from '../stores/settings/general';
import { useInstanceStore } from '../stores/instance';
import { useLocationStore } from '../stores/location';
import { useModerationStore } from '../stores/moderation';
import { useNotificationStore } from '../stores/notification';
import { usePhotonStore } from '../stores/photon';
import { useSearchStore } from '../stores/search';
import { syncFriendSearchIndex } from './searchIndexCoordinator';
import { removeAvatarFromCache } from './avatarCoordinator';
import { useSharedFeedStore } from '../stores/sharedFeed';
import { useUiStore } from '../stores/ui';
import { useUserStore } from '../stores/user';
import { useManualRelationsStore } from '../stores/manualRelations';
import { findRelationSuggestionForUser } from './relationSuggestionPopup';
import { showRelationSuggestionNotification } from '../services/relationSuggestionNotification';
import { createUserLanguageEntries } from './userLanguageProjection';
import { deriveAutoStateChangeParams } from './userAutoStateDecision';
import { recordBioSnapshotForUser } from './bioSnapshotCoordinator';

const getRobotUrl = () =>
    `${AppDebug.endpointDomain}/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file`;

/**
 * @param {import('../types/api/user').GetUserResponse} json
 * @returns {import('../types/api/user').VrcxUser}
 */
export function applyUser(json) {
    const userStore = useUserStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();
    const friendStore = useFriendStore();
    const locationStore = useLocationStore();
    const instanceStore = useInstanceStore();
    const moderationStore = useModerationStore();
    const photonStore = usePhotonStore();

    const {
        currentUser,
        cachedUsers,
        currentTravelers,
        customUserTags,
        rebuildCachedUserDisplayNameIndex,
        setCachedUser,
        state,
        userDialog
    } = userStore;

    let ref = cachedUsers.get(json.id);
    let previousDisplayName = '';
    let hasPropChanged = false;
    let changedProps = {};
    sanitizeUserJson(json, getRobotUrl());
    if (typeof ref === 'undefined') {
        ref = reactive(createDefaultUserRef(json));
        if (locationStore.lastLocation.playerList.has(json.id)) {
            const player = locationStore.lastLocation.playerList.get(json.id);
            ref.$location_at = player.joinTime;
            ref.$online_for = player.joinTime;
        } else if (
            ref.isFriend &&
            ref.location &&
            ref.location !== ':' && // ':' is the empty/invalid location sentinel
            !ref.location.startsWith('offline') &&
            !ref.location.startsWith('traveling')
        ) {
            // Restore $location_at from DB so the "time in instance" timer
            // doesn't reset to zero after VRCX restarts.
            // Primary source: _feed_gps (covers both real and private instances).
            // Fallback: gamelog_join_leave (only available when sharing an instance).
            const _ref = ref;
            database
                .getLastGPSArrivalTimeForUser(_ref.id, _ref.location)
                .then(async (arrivalTime) => {
                    if (arrivalTime !== null && arrivalTime < Date.now()) {
                        _ref.$location_at = arrivalTime;
                        return;
                    }
                    if (isRealInstance(_ref.location)) {
                        const joinTime =
                            await database.getLastJoinTimeForUserAtLocation(
                                {
                                    id: _ref.id,
                                    displayName: _ref.displayName
                                },
                                _ref.location
                            );
                        if (joinTime !== null && joinTime < Date.now()) {
                            _ref.$location_at = joinTime;
                        }
                    }
                })
                .catch(() => {});
        }
        if (ref.isFriend || ref.id === currentUser.id) {
            let newCount = state.instancePlayerCount.get(ref.location);
            if (typeof newCount === 'undefined') {
                newCount = 0;
            }
            newCount++;
            state.instancePlayerCount.set(ref.location, newCount);
        }
        const tag = customUserTags.get(json.id);
        if (tag) {
            ref.$customTag = tag.tag;
            ref.$customTagColour = tag.colour;
        } else if (ref.$customTag) {
            ref.$customTag = '';
            ref.$customTagColour = '';
        }
        const { deletedCount } = evictMapCache(
            cachedUsers,
            friendStore.friends.size + 300,
            (_value, key) => friendStore.friends.has(key),
            { logLabel: 'User cache cleanup' }
        );
        if (deletedCount > 0) {
            setCachedUser(ref, '', { skipIndex: true });
            rebuildCachedUserDisplayNameIndex();
        } else {
            setCachedUser(ref);
        }
        runUpdateFriendFlow(ref.id);
    } else {
        if (json.state !== 'online') {
            runUpdateFriendFlow(ref.id, json.state);
        }
        previousDisplayName = ref.displayName;
        const { hasPropChanged: _hasPropChanged, changedProps: _changedProps } =
            diffObjectProps(ref, json, arraysMatch);
        for (const prop in json) {
            if (typeof json[prop] !== 'undefined') {
                ref[prop] = json[prop];
            }
        }
        setCachedUser(ref, previousDisplayName);
        hasPropChanged = _hasPropChanged;
        changedProps = _changedProps;
    }
    ref.$moderations = moderationStore.getUserModerations(ref.id);
    ref.$isVRCPlus = ref.tags.includes('system_supporter');
    appearanceSettingsStore.applyUserTrustLevel(ref);
    userStore.applyUserLanguage(ref);
    ref.$platform = computeUserPlatform(ref.platform, ref.last_platform);
    // traveling
    if (ref.location === 'traveling') {
        ref.$location = parseLocation(ref.travelingToLocation);
        if (!currentTravelers.has(ref.id) && ref.travelingToLocation) {
            const travelRef = reactive({
                created_at: new Date().toJSON(),
                ...ref
            });
            currentTravelers.set(ref.id, travelRef);
            onPlayerTraveling(travelRef);
        }
    } else {
        ref.$location = parseLocation(ref.location);
        currentTravelers.delete(ref.id);
    }
    if (
        !instanceStore.cachedInstances.has(ref.$location.tag) &&
        isRealInstance(ref.location)
    ) {
        instanceRequest.getInstance({
            worldId: ref.$location.worldId,
            instanceId: ref.$location.instanceId
        });
    }
    if (
        ref.$isVRCPlus &&
        ref.badges &&
        ref.badges.every(
            (x) => x.badgeId !== 'bdg_754f9935-0f97-49d8-b857-95afb9b673fa'
        )
    ) {
        ref.badges.unshift({
            badgeId: 'bdg_754f9935-0f97-49d8-b857-95afb9b673fa',
            badgeName: 'Supporter',
            badgeDescription: 'Supports VRChat through VRC+',
            badgeImageUrl:
                'https://assets.vrchat.com/badges/fa/bdgai_583f6b13-91ab-4e1b-974e-ab91600b06cb.png',
            hidden: true,
            showcased: false
        });
    }
    const friendCtx = friendStore.friends.get(ref.id);
    if (friendCtx) {
        friendCtx.ref = ref;
        friendCtx.name = ref.displayName;
        syncFriendSearchIndex(friendCtx);
        friendStore.reindexSortedFriend(friendCtx);
    }
    if (ref.id === currentUser.id) {
        if (ref.status) {
            currentUser.status = ref.status;
        }
        runUpdateCurrentUserLocationFlow();
    }
    // add user ref to playerList, friendList, photonLobby, photonLobbyCurrent
    const playerListRef = locationStore.lastLocation.playerList.get(ref.id);
    if (playerListRef) {
        if (
            !locationStore.lastLocation.friendList.has(ref.id) &&
            friendStore.friends.has(ref.id)
        ) {
            const userMap = {
                displayName: ref.displayName,
                userId: ref.id,
                joinTime: playerListRef.joinTime
            };
            locationStore.lastLocation.friendList.set(ref.id, userMap);
        }
        if (
            locationStore.lastLocation.friendList.has(ref.id) &&
            !friendStore.friends.has(ref.id)
        ) {
            locationStore.lastLocation.friendList.delete(ref.id);
        }
        photonStore.photonLobby.forEach((ref1, id) => {
            if (
                typeof ref1 !== 'undefined' &&
                ref1.displayName === ref.displayName &&
                ref1 !== ref
            ) {
                photonStore.photonLobby.set(id, ref);
                if (photonStore.photonLobbyCurrent.has(id)) {
                    photonStore.photonLobbyCurrent.set(id, ref);
                }
            }
        });
        instanceStore.getCurrentInstanceUserList();
    }
    if (ref.state === 'online') {
        runUpdateFriendFlow(ref.id, ref.state);
    }
    applyFavorite('friend', ref.id);
    userOnFriend(ref);
    const D = userDialog;
    if (D.visible && D.id === ref.id) {
        D.ref = ref;
        D.note = String(ref.note || '');
        D.incomingRequest = false;
        D.outgoingRequest = false;
        if (D.ref.friendRequestStatus === 'incoming') {
            D.incomingRequest = true;
        } else if (D.ref.friendRequestStatus === 'outgoing') {
            D.outgoingRequest = true;
        }
    }
    if (hasPropChanged) {
        if (changedProps.location && changedProps.location[0] !== 'traveling') {
            if (playerListRef) {
                ref.$location_at = playerListRef.joinTime;
            } else {
                const ts = Date.now();
                changedProps.location.push(ts - ref.$location_at);
                ref.$location_at = ts;
            }
        }
        if (changedProps.state && ref.id === userStore.currentUser.id) {
            const newState = changedProps.state[1];
            const oldState = changedProps.state[0];
            if (
                (newState === 'online' &&
                    (oldState === 'offline' || oldState === 'active')) ||
                ((newState === 'offline' || newState === 'active') &&
                    oldState === 'online')
            ) {
                database.addOnlineOfflineToDatabase({
                    created_at: new Date().toJSON(),
                    type: newState === 'online' ? 'Online' : 'Offline',
                    userId: ref.id,
                    displayName: ref.displayName,
                    location: ref.location,
                    worldName: '', // Will be resolved if needed
                    groupName: '',
                    time:
                        newState === 'offline'
                            ? Date.now() - ref.$location_at
                            : ''
                });
            }
        }
        handleUserUpdate(ref, changedProps);
        if (AppDebug.debugUserDiff) {
            delete changedProps.last_login;
            delete changedProps.last_activity;
            if (Object.keys(changedProps).length !== 0) {
                console.log('>', ref.displayName, changedProps);
            }
        }
    }
    patchUserFromEvent(ref);
    return ref;
}

/**
 * @param {string} userId
 */
export function showUserDialog(userId) {
    if (
        !userId ||
        typeof userId !== 'string' ||
        userId === 'usr_00000000-0000-0000-0000-000000000000'
    ) {
        return;
    }
    const userStore = useUserStore();
    const uiStore = useUiStore();
    const friendStore = useFriendStore();
    const moderationStore = useModerationStore();
    const favoriteStore = useFavoriteStore();
    const locationStore = useLocationStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();
    const t = i18n.global.t;

    const { currentUser, userDialog, showUserDialogHistory } = userStore;

    const isMainDialogOpen = uiStore.openDialog({
        type: 'user',
        id: userId
    });
    const D = userDialog;
    D.visible = true;
    if (isMainDialogOpen && D.id === userId) {
        uiStore.setDialogCrumbLabel('user', D.id, D.ref?.displayName || D.id);
        userStore.applyUserDialogLocation(true);
        return;
    }
    D.id = userId;
    // Do not let a previous profile/avatar remain visible while the new
    // user's presence and public profile requests are in flight.
    D.ref = {};
    D.publicProfileRef = {};
    D.bioSnapshotVersion = 0;
    D.memo = '';
    D.note = '';
    getUserMemo(userId).then((memo) => {
        if (memo.userId === userId) {
            D.memo = memo.memo;
            const ref = friendStore.friends.get(userId);
            if (ref) {
                ref.memo = String(memo.memo || '');
                if (memo.memo) {
                    ref.$nickName = memo.memo.split('\n')[0];
                } else {
                    ref.$nickName = '';
                }
                syncFriendSearchIndex(ref);
            }
        }
    });

    D.loading = true;
    // The public profile is now served by a separate VRChat endpoint. Reset
    // both resources when switching users so a previous user's avatar/bio
    // cannot flash while the new profile request is in flight.
    D.ref = {};
    D.publicProfileRef = {};
    D.theme = {
        iconColor: 'var(--muted-foreground)',
        buttonColor: 'var(--primary)',
        subtextColor: 'var(--muted-foreground)'
    };
    D.avatars = [];
    D.worlds = [];
    D.instance = {
        id: '',
        tag: '',
        $location: {},
        friendCount: 0,
        users: [],
        shortName: '',
        ref: {}
    };
    D.isRepresentedGroupLoading = true;
    D.representedGroup = {
        bannerId: '',
        bannerUrl: '',
        description: '',
        discriminator: '',
        groupId: '',
        id: '',
        iconUrl: '',
        isRepresenting: false,
        memberCount: 0,
        memberVisibility: '',
        name: '',
        ownerId: '',
        privacy: '',
        shortCode: '',
        $thumbnailUrl: '',
        $memberId: ''
    };
    D.lastSeen = '';
    D.joinCount = 0;
    D.timeSpent = 0;
    D.avatarModeration = 0;
    D.isHideAvatar = false;
    D.isShowAvatar = false;
    D.previousDisplayNames = [];
    D.dateFriended = '';
    D.unFriended = false;
    D.dateFriendedInfo = [];
    D.mutualFriendCount = 0;
    D.mutualGroupCount = 0;
    if (userId === currentUser.id) {
        getWorldName(currentUser.homeLocation).then((worldName) => {
            D.$homeLocationName = worldName;
        });
    }
    AppApi.SendIpc('ShowUserDialog', userId);

    const mergePublicProfileIntoDialogRef = (profile) => {
        if (!profile || userId !== D.id || !D.ref) {
            return;
        }
        const profileFields = [
            'ageVerificationStatus',
            'ageVerified',
            'backgroundGradientBottom',
            'backgroundGradientTop',
            'backgroundTextureId',
            'backgroundType',
            'bannerColor',
            'bannerType',
            'bannerUrl',
            'displayName',
            'hasVrcPlus',
            'iconFrame',
            'iconUrl',
            'isEconomyCreator',
            'languages',
            'nameplateEffect',
            'profileEffect',
            'pronouns',
            'representedGroup',
            'trustTags'
        ];
        for (const key of profileFields) {
            if (profile[key] !== undefined && profile[key] !== null) {
                D.ref[key] = profile[key];
            }
        }
        if (typeof profile.bio === 'string') {
            D.ref.bio = profile.bio;
        }
        if (Array.isArray(profile.bioLinks)) {
            D.ref.bioLinks = profile.bioLinks;
        }
        if (Array.isArray(profile.badges)) {
            D.ref.badges = profile.badges;
        }

        if (appearanceSettingsStore.displayVRCProfileThemes) {
            const toThemeColor = (value, fallback) => {
                const normalized = String(value || '').trim().replace(/^#/, '');
                return /^[0-9a-f]{3,8}$/i.test(normalized) ? `#${normalized}` : fallback;
            };
            D.theme = {
                iconColor: toThemeColor(profile.themeIconColor, 'var(--muted-foreground)'),
                buttonColor: toThemeColor(profile.themeButtonColor, 'var(--primary)'),
                subtextColor: toThemeColor(profile.themeSubtextColor, 'var(--muted-foreground)')
            };
        }
    };

    // Status still comes from the legacy user endpoint; bio snapshots only
    // come from the dedicated public-profile endpoint.
    const statusBefore = userStore.cachedUsers.get(userId)?.status;
    let bioSnapshotAttempted = false;
    const queueBioSnapshot = (bio, displayName) => {
        if (bioSnapshotAttempted || typeof bio !== 'string') {
            return;
        }
        bioSnapshotAttempted = true;
        recordBioSnapshotForUser({
            database,
            userId,
            currentUserId: currentUser.id,
            currentBio: bio || '',
            previousBio: undefined,
            isFriend: false,
            displayName: displayName || userId
        })
            .then((recorded) => {
                // The Info tab may have already queried the archive while
                // this async database write was in flight. Bump a reactive
                // version after the write so it retries the diff query.
                if (recorded && userId === D.id) {
                    D.bioSnapshotVersion += 1;
                }
            })
            .catch((err) => {
                console.error('Failed to record bio snapshot:', err);
            });
    };
    updateUserDialogProfile({
        withGroupsAndWorlds: true,
        onProfileLoaded: (profile) => {
            queueBioSnapshot(profile.bio, D.ref?.displayName || profile.displayName);
        }
    });
    queryRequest
        .fetch('user', {
            userId
        })
        .catch((err) => {
            D.loading = false;
            D.id = null;
            D.visible = false;
            uiStore.jumpBackDialogCrumb();
            toast.error(t('message.user.load_failed'));
            throw err;
        })
        .then((args) => {
            if (args.ref.id === D.id) {
                D.loading = false;

                D.ref = args.ref;
                mergePublicProfileIntoDialogRef(D.publicProfileRef);
                uiStore.setDialogCrumbLabel(
                    'user',
                    D.id,
                    D.ref?.displayName || D.id
                );

                // Record status snapshot for any user (friend or stranger) when
                // their profile is viewed, skipping if status hasn't changed.
                // Also skip when runHandleUserUpdateFlow already recorded this
                // exact status change: that path fires for friends whenever
                // status transitions between two non-offline values.
                if (userId !== currentUser.id && D.ref.status !== undefined) {
                    const currentStatus = D.ref.status || '';
                    const currentStatusDesc = D.ref.statusDescription || '';
                    const isFriend = friendStore.friends.has(userId);
                    const validStatuses = [
                        'join me',
                        'active',
                        'ask me',
                        'busy'
                    ];
                    // runHandleUserUpdateFlow records the status change for
                    // friends when both old and new status are non-offline.
                    const eventFlowWillRecordStatus =
                        isFriend &&
                        statusBefore !== undefined &&
                        statusBefore !== currentStatus &&
                        currentStatus !== 'offline' &&
                        (statusBefore || '') !== 'offline';
                    if (
                        !eventFlowWillRecordStatus &&
                        validStatuses.includes(currentStatus)
                    ) {
                        database
                            .getLastStatusChangeForUser(userId)
                            .then((last) => {
                                if (!last || last.status !== currentStatus) {
                                    database.addStatusToDatabase({
                                        created_at: new Date().toJSON(),
                                        userId,
                                        displayName: D.ref.displayName,
                                        status: currentStatus,
                                        statusDescription: currentStatusDesc,
                                        previousStatus: last ? last.status : '',
                                        previousStatusDescription: last
                                            ? last.statusDescription
                                            : ''
                                    });
                                }
                            })
                            .catch((err) => {
                                console.error(
                                    'Failed to record status snapshot:',
                                    err
                                );
                            });
                    }
                }

                D.friend = friendStore.friends.get(D.id);
                D.isFriend = Boolean(D.friend);
                D.note = String(D.ref.note || '');
                D.incomingRequest = false;
                D.outgoingRequest = false;
                D.isBlock = false;
                D.isMute = false;
                D.isInteractOff = false;
                D.isMuteChat = false;
                for (const ref of moderationStore.cachedPlayerModerations.values()) {
                    if (
                        ref.targetUserId === D.id &&
                        ref.sourceUserId === currentUser.id
                    ) {
                        if (ref.type === 'block') {
                            D.isBlock = true;
                        } else if (ref.type === 'mute') {
                            D.isMute = true;
                        } else if (ref.type === 'interactOff') {
                            D.isInteractOff = true;
                        } else if (ref.type === 'muteChat') {
                            D.isMuteChat = true;
                        }
                    }
                }
                D.isFavorite =
                    favoriteStore.getCachedFavoritesByObjectId(D.id) ||
                    favoriteStore.isInAnyLocalFriendGroup(D.id);
                if (D.ref.friendRequestStatus === 'incoming') {
                    D.incomingRequest = true;
                } else if (D.ref.friendRequestStatus === 'outgoing') {
                    D.outgoingRequest = true;
                }
                let inCurrentWorld = false;
                if (locationStore.lastLocation.playerList.has(D.ref.id)) {
                    inCurrentWorld = true;
                }
                if (userId !== currentUser.id && watchState.isFriendsLoaded) {
                    database
                        .getUserStats(D.ref, inCurrentWorld)
                        .then(async (ref1) => {
                            if (ref1.userId === D.id) {
                                D.lastSeen = ref1.lastSeen;
                                D.joinCount = ref1.joinCount;
                                D.timeSpent = ref1.timeSpent;
                            }
                            const displayNameMap = ref1.previousDisplayNames;
                            const userNotifications =
                                await database.getFriendLogHistoryForUserId(
                                    D.id,
                                    ['DisplayName', 'Friend', 'Unfriend']
                                );
                            const dateFriendedInfo = [];
                            for (const notification of userNotifications) {
                                if (notification.userId !== D.id) {
                                    continue;
                                }
                                if (notification.type === 'DisplayName') {
                                    displayNameMap.set(
                                        notification.previousDisplayName,
                                        notification.created_at
                                    );
                                }
                                if (
                                    notification.type === 'Friend' ||
                                    (notification.type === 'Unfriend' &&
                                        !appearanceSettingsStore.hideUnfriends)
                                ) {
                                    dateFriendedInfo.unshift(notification);
                                }
                            }
                            D.dateFriendedInfo = dateFriendedInfo;
                            if (dateFriendedInfo.length > 0) {
                                const latestFriendedInfo = dateFriendedInfo[0];
                                D.unFriended =
                                    latestFriendedInfo.type === 'Unfriend';
                                D.dateFriended = latestFriendedInfo.created_at;
                            }
                            displayNameMap.forEach(
                                (updated_at, displayName) => {
                                    D.previousDisplayNames.push({
                                        displayName,
                                        updated_at
                                    });
                                }
                            );
                        });
                    AppApi.GetVRChatUserModeration(currentUser.id, userId).then(
                        (result) => {
                            D.avatarModeration = result;
                            if (result === 4) {
                                D.isHideAvatar = true;
                            } else if (result === 5) {
                                D.isShowAvatar = true;
                            }
                        }
                    );
                    if (!currentUser.hasSharedConnectionsOptOut) {
                        try {
                            queryRequest
                                .fetch('mutualCounts', { userId })
                                .then((args) => {
                                    if (args.params.userId === D.id) {
                                        D.mutualFriendCount = args.json.friends;
                                        D.mutualGroupCount = args.json.groups;
                                    }
                                });
                        } catch (error) {
                            console.error(error);
                        }
                    }
                } else {
                    D.previousDisplayNames = currentUser.pastDisplayNames;
                    database
                        .getUserStats(D.ref, inCurrentWorld)
                        .then((ref1) => {
                            if (ref1.userId === D.id) {
                                D.lastSeen = ref1.lastSeen;
                                D.joinCount = ref1.joinCount;
                                D.timeSpent = ref1.timeSpent;
                            }
                        });
                }
                queryRequest
                    .fetch('representedGroup', { userId })
                    .then((args1) => {
                        handleGroupRepresented(args1);
                    });
                D.visible = true;
                userStore.applyUserDialogLocation(true);

                const generalSettingsStore = useGeneralSettingsStore();
                const manualRelationsStore = useManualRelationsStore();
                const suggestions =
                    manualRelationsStore.cachedSuggestions || [];
                const ignoredKeys =
                    manualRelationsStore.ignoredSuggestionKeys || new Set();

                const suggestionForThisUser =
                    findRelationSuggestionForUser({
                        enabled:
                            generalSettingsStore.relationshipSuggestionPromptsEnabled,
                        userId,
                        suggestions,
                        ignoredKeys,
                        isManualRelation: (userIdA, userIdB) =>
                            manualRelationsStore.isManualRelation(
                                userIdA,
                                userIdB
                            )
                    });

                if (suggestionForThisUser) {
                    const otherUserName =
                        suggestionForThisUser.userIdA === userId
                            ? suggestionForThisUser.nameB
                            : suggestionForThisUser.nameA;
                    showRelationSuggestionNotification({
                        suggestion: suggestionForThisUser,
                        otherUserName,
                        onAccept: (suggestion) => {
                            manualRelationsStore.addManualRelation(
                                suggestion.userIdA,
                                suggestion.userIdB,
                                'friend'
                            );
                            manualRelationsStore.ignoreSuggestion(
                                suggestion.key
                            );
                        },
                        onIgnore: (suggestion) => {
                            manualRelationsStore.ignoreSuggestion(
                                suggestion.key
                            );
                        }
                    });
                }
            }
        });
    showUserDialogHistory.delete(userId);
    showUserDialogHistory.add(userId);
}

/**
 * Refresh the profile-only fields after the self profile editor saves.
 * Keeping this separate from showUserDialog avoids resetting the active tab
 * and preserves the local dialog's selection while the request completes.
 *
 * @param {{
 *     withGroupsAndWorlds?: boolean,
 *     onProfileLoaded?: (profile: object) => void,
 *     onProfileSettled?: () => void
 * }} [options]
 */
export function updateUserDialogProfile(options = {}) {
    const userStore = useUserStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();
    const { withGroupsAndWorlds = false, onProfileLoaded, onProfileSettled } = options;
    const D = userStore.userDialog;
    const userId = D.id;
    if (!userId) {
        return Promise.resolve();
    }

    return userRequest
        .getPublicProfile({ userId, ...(withGroupsAndWorlds ? { withGroupsAndWorlds: true } : {}) })
        .then(({ json }) => {
            if (D.id !== userId) {
                return;
            }
            const profile = json || {};
            D.publicProfileRef = profile;
            if (!D.ref) {
                D.ref = {};
            }
            const profileFields = [
                'ageVerificationStatus',
                'ageVerified',
                'backgroundGradientBottom',
                'backgroundGradientTop',
                'backgroundTextureId',
                'backgroundType',
                'bannerColor',
                'bannerType',
                'bannerUrl',
                'displayName',
                'hasVrcPlus',
                'iconFrame',
                'iconUrl',
                'isEconomyCreator',
                'languages',
                'nameplateEffect',
                'profileEffect',
                'pronouns',
                'representedGroup',
                'trustTags'
            ];
            for (const key of profileFields) {
                if (profile[key] !== undefined && profile[key] !== null) {
                    D.ref[key] = profile[key];
                }
            }
            if (typeof profile.bio === 'string') {
                D.ref.bio = profile.bio;
            }
            if (Array.isArray(profile.bioLinks)) {
                D.ref.bioLinks = profile.bioLinks;
            }
            if (Array.isArray(profile.badges)) {
                D.ref.badges = profile.badges;
            }
            if (appearanceSettingsStore.displayVRCProfileThemes) {
                const toThemeColor = (value, fallback) => {
                    const normalized = String(value || '').trim().replace(/^#/, '');
                    return /^[0-9a-f]{3,8}$/i.test(normalized)
                        ? `#${normalized}`
                        : fallback;
                };
                D.theme = {
                    iconColor: toThemeColor(profile.themeIconColor, 'var(--muted-foreground)'),
                    buttonColor: toThemeColor(profile.themeButtonColor, 'var(--primary)'),
                    subtextColor: toThemeColor(profile.themeSubtextColor, 'var(--muted-foreground)')
                };
            }
            if (typeof onProfileLoaded === 'function') {
                onProfileLoaded(profile);
            }
        })
        .catch((error) => {
            if (AppDebug.debugWebRequests) {
                console.warn('Failed to refresh public profile:', error);
            }
        })
        .finally(() => {
            if (typeof onProfileSettled === 'function') {
                onProfileSettled();
            }
        });
}

/**
 * @param {object} ref
 */
function onPlayerTraveling(ref) {
    const userStore = useUserStore();
    const gameStore = useGameStore();
    const locationStore = useLocationStore();
    const notificationStore = useNotificationStore();

    if (
        !gameStore.isGameRunning ||
        !locationStore.lastLocation.location ||
        locationStore.lastLocation.location !== ref.travelingToLocation ||
        ref.id === userStore.currentUser.id ||
        locationStore.lastLocation.playerList.has(ref.id)
    ) {
        return;
    }

    const onPlayerJoining = {
        created_at: new Date(ref.created_at).toJSON(),
        userId: ref.id,
        displayName: ref.displayName,
        type: 'OnPlayerJoining'
    };
    notificationStore.queueFeedNoty(onPlayerJoining);
}

/**
 * @param {object} ref
 * @param {object} props
 */
async function handleUserUpdate(ref, props) {
    const { bio: legacyBioChange, ...otherChanges } = props;
    const currentUserId = useUserStore().currentUser.id;
    const isFriend = useFriendStore().friends.has(ref.id);
    if (legacyBioChange && isFriend && ref.id !== currentUserId) {
        try {
            const { json: profile } = await userRequest.getPublicProfile({
                userId: ref.id
            });
            if (typeof profile?.bio === 'string') {
                let recordedSnapshot = null;
                const recorded = await recordBioSnapshotForUser({
                    database,
                    userId: profile.id || ref.id,
                    currentUserId,
                    currentBio: profile.bio,
                    previousBio: undefined,
                    isFriend: false,
                    displayName: profile.displayName || ref.displayName,
                    onRecorded: (snapshot) => {
                        recordedSnapshot = snapshot;
                    }
                });
                if (recorded && recordedSnapshot) {
                    await runHandleUserUpdateFlow(
                        ref,
                        {
                            ...otherChanges,
                            bio: [
                                recordedSnapshot.bio,
                                recordedSnapshot.previousBio
                            ]
                        },
                        { skipBioDatabase: true }
                    );
                    return;
                }
            }
        } catch (error) {
            if (AppDebug.debugWebRequests) {
                console.warn('Failed to verify user bio from public profile:', error);
            }
        }
    }

    // Never feed the legacy /users bio into the archive or bio-change feed.
    await runHandleUserUpdateFlow(ref, otherChanges);
}

/**
 * @param fileId
 */
export async function refreshUserDialogAvatars(fileId) {
    const userStore = useUserStore();
    const avatarStore = useAvatarStore();

    const D = userStore.userDialog;
    const userId = D.id;
    if (D.isAvatarsLoading) {
        return;
    }
    D.isAvatarsLoading = true;
    if (fileId) {
        D.loading = true;
    }
    D.avatarSorting = 'update';
    D.avatarReleaseStatus = 'all';
    const params = {
        n: 50,
        offset: 0,
        sort: 'updated',
        order: 'descending',
        releaseStatus: 'all',
        user: 'me'
    };
    for (const ref of avatarStore.cachedAvatars.values()) {
        if (ref.authorId === D.id) {
            removeAvatarFromCache(ref.id);
        }
    }
    const map = new Map();
    await processBulk({
        fn: avatarRequest.getAvatars,
        N: -1,
        params,
        handle: (args) => {
            for (const json of args.json) {
                const ref = applyAvatar(json);
                map.set(ref.id, ref);
            }
        },
        done: () => {
            const array = Array.from(map.values());
            if (userId === D.id) {
                userStore.sortUserDialogAvatars(array);
            }
            D.isAvatarsLoading = false;
            if (fileId) {
                D.loading = false;
                for (const ref of array) {
                    if (extractFileId(ref.imageUrl) === fileId) {
                        showAvatarDialog(ref.id);
                        return;
                    }
                }
                toast.error('Own avatar not found');
            }
        }
    });
}

/**
 * @param ref
 */
export async function lookupUser(ref) {
    const userStore = useUserStore();
    const searchStore = useSearchStore();

    let ctx;
    if (ref.userId) {
        showUserDialog(ref.userId);
        return;
    }
    if (!ref.displayName || ref.displayName.substring(0, 3) === 'ID:') {
        return;
    }
    const found = findUserByDisplayName(
        userStore.cachedUsers,
        ref.displayName,
        userStore.cachedUserIdsByDisplayName
    );
    if (found) {
        showUserDialog(found.id);
        return;
    }
    searchStore.setSearchText(ref.displayName);
    await searchStore.searchUserByDisplayName(ref.displayName);
    for (ctx of searchStore.searchUserResults) {
        if (ctx.displayName === ref.displayName) {
            searchStore.setSearchText('');
            searchStore.clearSearch();
            showUserDialog(ctx.id);
            return;
        }
    }
}

/**
 * @param {object} args
 */
export function handleConfig(args) {
    const authStore = useAuthStore();
    const userStore = useUserStore();

    const ref = {
        ...args.json
    };
    args.ref = ref;
    authStore.setCachedConfig(ref);
    if (typeof args.ref?.whiteListedAssetUrls !== 'object') {
        console.error('Invalid config whiteListedAssetUrls');
    }
    AppApi.PopulateImageHosts(JSON.stringify(args.ref.whiteListedAssetUrls));
    const languages = args.ref?.constants?.LANGUAGE?.SPOKEN_LANGUAGE_OPTIONS;
    if (!languages) {
        return;
    }
    userStore.setSubsetOfLanguages(languages);
    userStore.setLanguageDialogLanguages(createUserLanguageEntries(languages));
}

/**
 * @param {import('../types/api/user').GetCurrentUserResponse} json
 * @returns {import('../types/api/user').GetCurrentUserResponse}
 */
export function applyCurrentUser(json) {
    const userStore = useUserStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();
    const authStore = useAuthStore();
    const gameStore = useGameStore();
    const locationStore = useLocationStore();

    authStore.setAttemptingAutoLogin(false);
    let ref = userStore.currentUser;
    runAvatarSwapFlow({
        json,
        ref,
        isLoggedIn: watchState.isLoggedIn
    });
    if (watchState.isLoggedIn) {
        for (const prop in json) {
            if (typeof json[prop] !== 'undefined') {
                ref[prop] = json[prop];
            }
        }
    } else {
        ref = {
            acceptedPrivacyVersion: 0,
            acceptedTOSVersion: 0,
            accountDeletionDate: null,
            accountDeletionLog: null,
            activeFriends: [],
            ageVerificationStatus: '',
            ageVerified: false,
            allowAvatarCopying: false,
            badges: [],
            bannerColor: '',
            bannerType: 'color',
            bannerUrl: '',
            bio: '',
            bioLinks: [],
            currentAvatar: '',
            currentAvatarImageUrl: '',
            currentAvatarTags: [],
            currentAvatarThumbnailImageUrl: '',
            date_joined: '',
            developerType: '',
            discordDetails: {
                global_name: '',
                id: ''
            },
            discordId: '',
            displayName: '',
            emailVerified: false,
            fallbackAvatar: '',
            friendGroupNames: [],
            friendKey: '',
            friends: [],
            googleId: '',
            hasBirthday: false,
            hasDiscordFriendsOptOut: false,
            hasEmail: false,
            hasLoggedInFromClient: false,
            hasPendingEmail: false,
            hasSharedConnectionsOptOut: false,
            hideContentFilterSettings: false,
            homeLocation: '',
            iconUrl: '',
            id: '',
            isAdult: true,
            isBoopingEnabled: false,
            isFriend: false,
            last_activity: '',
            last_login: '',
            last_mobile: null,
            last_platform: '',
            obfuscatedEmail: '',
            obfuscatedPendingEmail: '',
            oculusId: '',
            offlineFriends: [],
            onlineFriends: [],
            pastDisplayNames: [],
            picoId: '',
            presence: {
                avatarThumbnail: '',
                currentAvatarTags: '',
                debugflag: '',
                displayName: '',
                groups: [],
                id: '',
                instance: '',
                instanceType: '',
                platform: '',
                profilePicOverride: '',
                status: '',
                travelingToInstance: '',
                travelingToWorld: '',
                userIcon: '',
                world: '',
                ...json.presence
            },
            profilePicOverride: '',
            profilePicOverrideThumbnail: '',
            pronouns: '',
            queuedInstance: '',
            state: '',
            status: '',
            statusDescription: '',
            statusFirstTime: false,
            statusHistory: [],
            steamDetails: {},
            steamId: '',
            tags: [],
            twoFactorAuthEnabled: false,
            twoFactorAuthEnabledDate: null,
            unsubscribe: false,
            updated_at: '',
            userIcon: '',
            userLanguage: '',
            userLanguageCode: '',
            username: '',
            viveId: '',
            // VRCX
            $online_for: null,
            $offline_for: null,
            $location_at: Date.now(),
            $travelingToTime: Date.now(),
            $previousAvatarSwapTime: null,
            $homeLocation: {},
            $isVRCPlus: false,
            $isModerator: false,
            $isTroll: false,
            $isProbableTroll: false,
            $trustLevel: 'Visitor',
            $trustClass: 'x-tag-untrusted',
            $userColour: '',
            $trustSortNum: 1,
            $languages: [],
            $locationTag: '',
            $travelingToLocation: '',
            ...json
        };
        runFirstLoginFlow(ref);
    }

    ref.$isVRCPlus = ref.tags.includes('system_supporter');
    appearanceSettingsStore.applyUserTrustLevel(ref);
    userStore.applyUserLanguage(ref);
    userStore.applyPresenceLocation(ref);
    runPostApplySyncFlow(ref);
    runHomeLocationSyncFlow(ref);

    // when isGameRunning use gameLog instead of API
    const $location = parseLocation(locationStore.lastLocation.location);
    const $travelingLocation = parseLocation(
        locationStore.lastLocationDestination
    );
    let location = locationStore.lastLocation.location;
    let instanceId = $location.instanceId;
    let worldId = $location.worldId;
    let travelingToLocation = locationStore.lastLocationDestination;
    let travelingToWorld = $travelingLocation.worldId;
    let travelingToInstance = $travelingLocation.instanceId;
    if (!gameStore.isGameRunning && json.presence) {
        if (isRealInstance(json.presence.world)) {
            location = `${json.presence.world}:${json.presence.instance}`;
        } else {
            location = json.presence.world;
        }
        if (isRealInstance(json.presence.travelingToWorld)) {
            travelingToLocation = `${json.presence.travelingToWorld}:${json.presence.travelingToInstance}`;
        } else {
            travelingToLocation = json.presence.travelingToWorld;
        }
        instanceId = json.presence.instance;
        worldId = json.presence.world;
        travelingToInstance = json.presence.travelingToInstance;
        travelingToWorld = json.presence.travelingToWorld;
    }
    const userRef = applyUser({
        ageVerificationStatus: json.ageVerificationStatus,
        ageVerified: json.ageVerified,
        allowAvatarCopying: json.allowAvatarCopying,
        badges: json.badges,
        bio: json.bio,
        bioLinks: json.bioLinks,
        currentAvatarImageUrl: json.currentAvatarImageUrl,
        currentAvatarTags: json.currentAvatarTags,
        currentAvatarThumbnailImageUrl: json.currentAvatarThumbnailImageUrl,
        date_joined: json.date_joined,
        developerType: json.developerType,
        discordId: json.discordId,
        displayName: json.displayName,
        friendKey: json.friendKey,
        id: json.id,
        isFriend: json.isFriend,
        last_activity: json.last_activity,
        last_login: json.last_login,
        last_mobile: json.last_mobile,
        last_platform: json.last_platform,
        profilePicOverride: json.profilePicOverride,
        profilePicOverrideThumbnail: json.profilePicOverrideThumbnail,
        pronouns: json.pronouns,
        state: json.state,
        status: json.status,
        statusDescription: json.statusDescription,
        tags: json.tags,
        userIcon: json.userIcon,
        location,
        instanceId,
        worldId,
        travelingToLocation,
        travelingToInstance,
        travelingToWorld
    });
    // set VRCX online/offline timers
    userRef.$online_for = userStore.currentUser.$online_for;
    userRef.$offline_for = userStore.currentUser.$offline_for;
    userRef.$location_at = userStore.currentUser.$location_at;
    userRef.$travelingToTime = userStore.currentUser.$travelingToTime;
    if (json.presence?.platform) {
        userRef.platform = json.presence.platform;
    }

    return ref;
}

/**
 */
export function getCurrentUser() {
    const authStore = useAuthStore();
    return request('auth/user', {
        method: 'GET'
    }).then((json) => {
        const args = {
            json
        };
        authStore.handleCurrentUserUpdate(json);
        return args;
    });
}

/**
 * @param data
 */
export function addCustomTag(data) {
    const userStore = useUserStore();
    const sharedFeedStore = useSharedFeedStore();

    if (data.Tag) {
        userStore.customUserTags.set(data.UserId, {
            tag: data.Tag,
            colour: data.TagColour
        });
    } else {
        userStore.customUserTags.delete(data.UserId);
    }
    const feedUpdate = {
        userId: data.UserId,
        colour: data.TagColour
    };
    AppApi.ExecuteVrOverlayFunction(
        'updateHudFeedTag',
        JSON.stringify(feedUpdate)
    );
    const ref = userStore.cachedUsers.get(data.UserId);
    if (typeof ref !== 'undefined') {
        ref.$customTag = data.Tag;
        ref.$customTagColour = data.TagColour;
    }
    sharedFeedStore.addTag(data.UserId, data.TagColour);
}

/**
 */
export function updateAutoStateChange() {
    const userStore = useUserStore();
    const generalSettingsStore = useGeneralSettingsStore();
    const gameStore = useGameStore();
    const locationStore = useLocationStore();
    const favoriteStore = useFavoriteStore();

    const params = deriveAutoStateChangeParams({
        enabled: generalSettingsStore.autoStateChangeEnabled,
        isGameRunning: gameStore.isGameRunning,
        playerCount: locationStore.lastLocation.playerList.size,
        location: locationStore.lastLocation.location,
        parseLocation,
        allowedInstanceTypes:
            generalSettingsStore.autoStateChangeInstanceTypes,
        noFriends: generalSettingsStore.autoStateChangeNoFriends,
        selectedGroups: generalSettingsStore.autoStateChangeGroups,
        cachedFavorites: favoriteStore.cachedFavorites,
        localFriendFavorites: favoriteStore.localFriendFavorites,
        friendList: locationStore.lastLocation.friendList,
        currentStatus: userStore.currentUser.status,
        companyStatus: generalSettingsStore.autoStateChangeCompanyStatus,
        aloneStatus: generalSettingsStore.autoStateChangeAloneStatus,
        companyDescEnabled:
            generalSettingsStore.autoStateChangeCompanyDescEnabled,
        companyDesc: generalSettingsStore.autoStateChangeCompanyDesc,
        aloneDescEnabled: generalSettingsStore.autoStateChangeAloneDescEnabled,
        aloneDesc: generalSettingsStore.autoStateChangeAloneDesc
    });
    if (!params) {
        return;
    }

    userRequest.saveCurrentUser(params).then(() => {
        const text = `Status automatically changed to ${params.status}`;
        if (AppDebug.errorNoty) {
            toast.dismiss(AppDebug.errorNoty);
        }
        AppDebug.errorNoty = toast.info(text);
        console.log(text);
    });
}
