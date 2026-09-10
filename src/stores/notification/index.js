import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import {
    applyBoopLegacyHandling,
    checkCanInvite,
    createInviteResponseParams,
    createDefaultNotificationRef,
    createDefaultNotificationV2Ref,
    executeWithBackoff,
    findUserByDisplayName,
    parseLocation,
    parseNotificationDetails,
    removeFromArray,
    sanitizeNotificationJson,
    userImage,
} from "../../shared/utils";
import { getUserMemo } from "../../coordinators/memoCoordinator";
import {
    friendRequest,
    instanceRequest,
    miscRequest,
    notificationRequest,
    queryRequest,
} from "../../api";
import {
    getNotificationMessage,
    getUserIdFromNoty as getUserIdFromNotyBase,
    toNotificationText,
} from "../../shared/utils/notificationMessage";
import { database, dbVars } from "../../services/database";
import { getNotificationCategory } from "../../shared/utils/notificationCategory";
import { AppDebug } from "../../services/appConfig";
import { createOverlayDispatch } from "./overlayDispatch";
import {
    buildTrayNotificationSnapshot,
    createTrayNotificationActionHandler,
    getTrayNotificationTheme,
} from "./trayNotificationBridge";
import {
    filterNotificationsByCategory,
    filterRecentNotifications,
    filterUnseenNotifications,
} from "./notificationViewProjection";
import {
    applyNotificationToCollection,
    applyNotificationV2ToCollection,
} from "./notificationEntityProjection";
import { createNotificationPreferences } from "./notificationPreferences";
import { createNotificationSeenQueue } from "./notificationSeenQueue";
import { appendPendingNotification } from "./notificationPendingEntry";
import { useAdvancedSettingsStore } from "../settings/advanced";
import { useAppearanceSettingsStore } from "../settings/appearance";
import { useFavoriteStore } from "../favorite";
import { useFriendStore } from "../friend";
import { handleFriendAdd } from "../../coordinators/friendRelationshipCoordinator";
import { useGameStore } from "../game";
import { useGeneralSettingsStore } from "../settings/general";
import { useGroupStore } from "../group";
import { showGroupDialog } from "../../coordinators/groupCoordinator";
import { showUserDialog } from "../../coordinators/userCoordinator";
import { showWorldDialog } from "../../coordinators/worldCoordinator";
import { router } from "../../plugins/router";
import { useInstanceStore } from "../instance";
import { useInviteStore } from "../invite";
import { useLocationStore } from "../location";
import { useModalStore } from "../modal";
import { useNotificationsSettingsStore } from "../settings/notifications";
import { useSharedFeedStore } from "../sharedFeed";
import { useUiStore } from "../ui";
import { useUserStore } from "../user";
import { useWristOverlaySettingsStore } from "../settings/wristOverlay";
import { watchState } from "../../services/watchState";
import { useLaunchStore } from "../launch";

import configRepository from "../../services/config";

export const useNotificationStore = defineStore("Notification", () => {
    const { t } = useI18n();
    const generalSettingsStore = useGeneralSettingsStore();
    const locationStore = useLocationStore();
    const favoriteStore = useFavoriteStore();
    const friendStore = useFriendStore();
    const notificationsSettingsStore = useNotificationsSettingsStore();
    const advancedSettingsStore = useAdvancedSettingsStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();
    const userStore = useUserStore();
    const wristOverlaySettingsStore = useWristOverlaySettingsStore();
    const uiStore = useUiStore();
    const gameStore = useGameStore();
    const sharedFeedStore = useSharedFeedStore();
    const instanceStore = useInstanceStore();
    const inviteStore = useInviteStore();
    const modalStore = useModalStore();
    const launchStore = useLaunchStore();
    const notificationPreferences = createNotificationPreferences({
        configRepository,
    });

    const notificationInitStatus = ref(false);
    const notificationTable = ref({
        data: [],
        filters: [
            {
                prop: "type",
                value: [],
            },
            {
                prop: ["senderUsername", "message"],
                value: "",
            },
        ],
        pageSize: 20,
        pageSizeLinked: true,
        paginationProps: {
            layout: "sizes,prev,pager,next,total",
        },
    });
    const unseenNotifications = ref([]);
    const isNotificationsLoading = ref(false);
    const isNotificationCenterOpen = ref(false);
    const notificationCenterHiddenIds = ref([]);
    const acceptingInviteIds = new Set();

    const friendNotifications = computed(() =>
        filterNotificationsByCategory(notificationTable.value.data, "friend"),
    );
    const groupNotifications = computed(() =>
        filterNotificationsByCategory(notificationTable.value.data, "group"),
    );
    const otherNotifications = computed(() =>
        filterNotificationsByCategory(notificationTable.value.data, "other"),
    );
    const unseenSet = computed(() => new Set(unseenNotifications.value));
    const notificationCenterHiddenSet = computed(
        () => new Set(notificationCenterHiddenIds.value),
    );
    const trayNotificationSnapshot = ref({ total: 0, items: [] });
    const unseenFriendNotifications = computed(() =>
        filterUnseenNotifications(
            friendNotifications.value,
            unseenSet.value,
            notificationCenterHiddenSet.value,
        ),
    );
    const unseenGroupNotifications = computed(() =>
        filterUnseenNotifications(
            groupNotifications.value,
            unseenSet.value,
            notificationCenterHiddenSet.value,
        ),
    );
    const unseenOtherNotifications = computed(() =>
        filterUnseenNotifications(
            otherNotifications.value,
            unseenSet.value,
            notificationCenterHiddenSet.value,
        ),
    );
    const recentCutoff = computed(() => dayjs().subtract(24, "hour").valueOf());
    const recentFriendNotifications = computed(() =>
        filterRecentNotifications(
            friendNotifications.value,
            unseenSet.value,
            notificationCenterHiddenSet.value,
            recentCutoff.value,
        ),
    );
    const recentGroupNotifications = computed(() =>
        filterRecentNotifications(
            groupNotifications.value,
            unseenSet.value,
            notificationCenterHiddenSet.value,
            recentCutoff.value,
        ),
    );
    const recentOtherNotifications = computed(() =>
        filterRecentNotifications(
            otherNotifications.value,
            unseenSet.value,
            notificationCenterHiddenSet.value,
            recentCutoff.value,
        ),
    );
    const hasUnseenNotifications = computed(
        () => unseenNotifications.value.length > 0,
    );

    const notyMap = {};

    /**
     *
     */
    function saveNotificationCenterHiddenIds() {
        const ids = notificationPreferences.normalizeHiddenIds(
            notificationCenterHiddenIds.value,
        );
        notificationCenterHiddenIds.value = ids;
        notificationPreferences.saveHiddenIds(ids);
    }

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            isNotificationsLoading.value = false;
            notificationTable.value.data = [];
            if (isLoggedIn) {
                initNotifications();
            }
        },
        { flush: "sync" },
    );

    /**
     *
     */
    async function init() {
        const { filterTypes, hiddenIds } =
            await notificationPreferences.load();
        notificationTable.value.filters[0].value = filterTypes;
        notificationCenterHiddenIds.value = hiddenIds;
    }

    const initPromise = init();

    function getNotificationMessageText(notification) {
        let message = notification.message || "";
        for (const key of [
            "inviteMessage",
            "requestMessage",
            "responseMessage",
        ]) {
            if (notification.details?.[key]) {
                message = `, ${notification.details[key]}`;
            }
        }
        try {
            return getNotificationMessage(notification, message) || null;
        } catch (error) {
            console.warn("Failed to format tray notification:", error);
            return null;
        }
    }

    let trayNotificationSyncToken = 0;

    function getTrayNotificationAvatarUrl(notification) {
        const senderId = getUserIdFromNotyBase(notification);
        if (senderId?.startsWith("grp_")) {
            return notification.details?.imageUrl || notification.imageUrl || "";
        }

        const cachedUser = senderId ? userStore.cachedUsers.get(senderId) : null;
        return (
            userImage(
                cachedUser,
                true,
                "64",
                false,
                appearanceSettingsStore.displayVRCPlusIconsAsAvatar,
            ) ||
            notification.senderUserIcon ||
            notification.thumbnailImageUrl ||
            ""
        );
    }

    function publishTrayNotificationSnapshot(snapshot) {
        trayNotificationSnapshot.value = snapshot;
        if (WINDOWS) {
            AppApi.UpdateTrayNotifications(JSON.stringify(snapshot));
        } else {
            window.electron?.updateTrayNotifications?.(snapshot);
        }
    }

    async function resolveTrayAvatarPath(notification, avatarUrl) {
        let resolvedUrl = avatarUrl;
        const senderId = getUserIdFromNotyBase(notification);
        if (!resolvedUrl && senderId?.startsWith("usr_")) {
            try {
                const args = await queryRequest.fetch("user", { userId: senderId });
                resolvedUrl = userImage(
                    args.ref || args.json,
                    true,
                    "64",
                    false,
                    appearanceSettingsStore.displayVRCPlusIconsAsAvatar,
                );
            } catch (error) {
                console.warn("Failed to resolve tray notification avatar:", error);
            }
        }
        if (!resolvedUrl) return "";
        return notySaveImage({ thumbnailImageUrl: resolvedUrl });
    }

    function syncTrayNotifications() {
        const syncToken = ++trayNotificationSyncToken;
        const snapshot = buildTrayNotificationSnapshot({
            notifications: notificationTable.value.data,
            unseenIds: unseenNotifications.value,
            hiddenIds: notificationCenterHiddenIds.value,
            formatMessage: getNotificationMessageText,
            getAvatarUrl: getTrayNotificationAvatarUrl,
            theme: getTrayNotificationTheme(),
        });
        publishTrayNotificationSnapshot(snapshot);
        if (!WINDOWS || snapshot.items.length === 0) return;

        const notificationsById = new Map(
            notificationTable.value.data.map((notification) => [notification.id, notification]),
        );
        Promise.all(
            snapshot.items.map((item) =>
                resolveTrayAvatarPath(notificationsById.get(item.id), item.avatarUrl),
            ),
        )
            .then((avatarPaths) => {
                if (syncToken !== trayNotificationSyncToken) return;
                publishTrayNotificationSnapshot({
                    ...snapshot,
                    items: snapshot.items.map((item, index) => ({
                        ...item,
                        avatarPath: avatarPaths[index] || "",
                    })),
                });
            })
            .catch((error) => {
                console.warn("Failed to cache tray notification avatars:", error);
            });
    }

    watch(
        [
            () => notificationTable.value.data,
            unseenNotifications,
            notificationCenterHiddenIds,
            () => appearanceSettingsStore.$state,
        ],
        syncTrayNotifications,
        { deep: true, flush: "post" },
    );

    /**
     *
     * @param args
     */
    function handleNotification(args) {
        args.ref = applyNotification(args.json);
        const { ref } = args;
        const array = notificationTable.value.data;
        const { length } = array;
        if (ref.seen || notificationCenterHiddenSet.value.has(ref.id)) {
            removeFromArray(unseenNotifications.value, ref.id);
        } else if (!unseenNotifications.value.includes(ref.id)) {
            unseenNotifications.value.push(ref.id);
        }
        for (let i = 0; i < length; ++i) {
            if (array[i].id === ref.id) {
                array[i] = ref;
                return;
            }
        }
        if (ref.senderUserId !== userStore.currentUser.id) {
            if (
                ref.type !== "friendRequest" &&
                ref.type !== "ignoredFriendRequest" &&
                !ref.type.includes(".")
            ) {
                database.addNotificationToDatabase(ref);
            }
            if (watchState.isFriendsLoaded && notificationInitStatus.value) {
                if (
                    ref.details?.worldId &&
                    !instanceStore.cachedInstances.has(ref.details.worldId)
                ) {
                    // get instance name for invite
                    const L = parseLocation(ref.details.worldId);
                    if (L.isRealInstance) {
                        instanceRequest.getInstance({
                            worldId: L.worldId,
                            instanceId: L.instanceId,
                        });
                    }
                }
                if (
                    notificationTable.value.filters[0].value.length === 0 ||
                    notificationTable.value.filters[0].value.includes(ref.type)
                ) {
                    uiStore.notifyMenu("notification");
                }
                queueNotificationNoty(ref);
                sharedFeedStore.addEntry(ref);
            }
        }
        notificationTable.value.data.push(ref);
        const D = userStore.userDialog;
        if (
            D.visible === false ||
            ref.type !== "friendRequest" ||
            ref.senderUserId !== D.id
        ) {
            return;
        }
        D.incomingRequest = true;
    }

    /**
     *
     * @param notificationId
     */
    function handleNotificationHide(notificationId) {
        const ref = notificationTable.value.data.find(
            (n) => n.id === notificationId,
        );
        if (typeof ref === "undefined") {
            return;
        }
        if (
            ref.type === "friendRequest" ||
            ref.type === "ignoredFriendRequest" ||
            ref.type.includes(".")
        ) {
            removeFromArray(notificationTable.value.data, ref);
        } else {
            ref.$isExpired = true;
            database.updateNotificationExpired(ref);
        }
        handleNotificationExpire({
            ref,
            params: {
                notificationId: ref.id,
            },
        });
    }

    /**
     *
     * @param args
     */
    function handlePipelineNotification(args) {
        const ref = args.json;
        if (
            ref.type !== "requestInvite" ||
            generalSettingsStore.autoAcceptInviteRequests === "Off"
        ) {
            return;
        }

        let currentLocation = locationStore.lastLocation.location;
        if (locationStore.lastLocation.location === "traveling") {
            currentLocation = locationStore.lastLocationDestination;
        }
        if (!currentLocation) {
            // game log disabled, use API location
            currentLocation = userStore.currentUser.$locationTag;
            if (userStore.currentUser.$travelingToLocation) {
                currentLocation = userStore.currentUser.$travelingToLocation;
            }
        }
        if (!currentLocation) {
            return;
        }
        if (
            generalSettingsStore.autoAcceptInviteRequests === "All Favorites" &&
            !favoriteStore.state.favoriteFriends_.some(
                (x) => x.id === ref.senderUserId,
            ) &&
            !favoriteStore.isInAnyLocalFriendGroup(ref.senderUserId)
        ) {
            return;
        }
        if (
            generalSettingsStore.autoAcceptInviteRequests ===
            "Selected Favorites"
        ) {
            const groups = generalSettingsStore.autoAcceptInviteGroups;
            if (groups.length === 0) {
                return;
            } else {
                let found = false;
                for (const groupKey of groups) {
                    if (groupKey.startsWith("local:")) {
                        const localGroup = groupKey.slice(6);
                        const localFavs =
                            favoriteStore.localFriendFavorites[localGroup];
                        if (localFavs && localFavs.includes(ref.senderUserId)) {
                            found = true;
                            break;
                        }
                    } else {
                        const remoteFavs =
                            favoriteStore.cachedFavorites.get(groupKey);
                        if (
                            remoteFavs &&
                            remoteFavs.some(
                                (f) => f.favoriteId === ref.senderUserId,
                            )
                        ) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    return;
                }
            }
        }
        if (
            !checkCanInvite(currentLocation, {
                currentUserId: userStore.currentUser.id,
                lastLocationStr: locationStore.lastLocation.location,
                cachedInstances: instanceStore.cachedInstances,
            })
        ) {
            return;
        }

        const L = parseLocation(currentLocation);
        queryRequest
            .fetch("world", {
                worldId: L.worldId,
            })
            .then((args1) => {
                notificationRequest
                    .sendInvite(
                        {
                            instanceId: L.tag,
                            worldId: L.tag,
                            worldName: args1.ref.name,
                            rsvp: true,
                        },
                        ref.senderUserId,
                    )
                    .then((_args) => {
                        const text = `Auto invite sent to ${ref.senderUsername}`;
                        if (AppDebug.errorNoty) {
                            toast.dismiss(AppDebug.errorNoty);
                        }
                        AppDebug.errorNoty = toast.info(text);
                        console.log(text);
                        notificationRequest
                            .hideNotification({
                                notificationId: ref.id,
                            })
                            .then(() => {
                                handleNotificationHide(ref.id);
                            });
                        return _args;
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            });
    }

    /**
     * @param {object} entry
     */
    function appendNotificationTableEntry(entry) {
        return appendPendingNotification({
            collection: notificationTable.value.data,
            unseenIds: unseenNotifications.value,
            hiddenIds: notificationCenterHiddenIds.value,
            entry,
        });
    }

    /**
     * @param {boolean} value
     */
    function setNotificationInitStatus(value) {
        notificationInitStatus.value = value;
    }

    /**
     *
     */
    function clearUnseenNotifications() {
        unseenNotifications.value = [];
    }

    /**
     *
     * @param notificationId
     */
    function handleNotificationSee(notificationId) {
        removeFromArray(unseenNotifications.value, notificationId);
        if (unseenNotifications.value.length === 0) {
            uiStore.removeNotify("notification");
        }
        const ref = notificationTable.value.data.find(
            (n) => n.id === notificationId,
        );
        if (ref) {
            ref.seen = true;
        }
        database.seenNotificationV2(notificationId);
    }

    const notificationSeenQueue = createNotificationSeenQueue({
        executeWithBackoff,
        seeNotificationV2: (params) =>
            notificationRequest.seeNotificationV2(params),
        seeNotification: (params) => notificationRequest.seeNotification(params),
        onV2Seen: handleNotificationV2Update,
        onLegacySeen: handleNotificationSee,
        onV2Failure: handleNotificationV2Hide,
    });

    /**
     * Queue a notification to be marked as seen.
     * @param {string} notificationId
     * @param {number} [version]
     */
    function queueMarkAsSeen(notificationId, version = 1) {
        notificationSeenQueue.enqueue(notificationId, version);
    }

    /**
     *
     */
    function markAllAsSeen() {
        const unseenIds = [...unseenNotifications.value];
        for (const id of unseenIds) {
            const ref = notificationTable.value.data.find((n) => n.id === id);
            const version = ref?.version || 1;
            queueMarkAsSeen(id, version);
        }
        unseenNotifications.value = [];
        uiStore.removeNotify("notification");
    }

    /**
     * Hide the current notification center cards without deleting notification logs.
     */
    function clearNotificationCenter() {
        const visibleNotifications = [
            ...unseenFriendNotifications.value,
            ...unseenGroupNotifications.value,
            ...unseenOtherNotifications.value,
            ...recentFriendNotifications.value,
            ...recentGroupNotifications.value,
            ...recentOtherNotifications.value,
        ];
        if (visibleNotifications.length === 0) {
            return;
        }
        const ids = new Set(notificationCenterHiddenIds.value);
        for (const noty of visibleNotifications) {
            if (!noty?.id) continue;
            ids.add(noty.id);
            removeFromArray(unseenNotifications.value, noty.id);
        }
        notificationCenterHiddenIds.value = [...ids];
        saveNotificationCenterHiddenIds();
        if (unseenNotifications.value.length === 0) {
            uiStore.removeNotify("notification");
        }
    }

    /**
     *
     * @param args
     */
    function handleNotificationAccept(args) {
        let ref;
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            if (array[i].id === args.params.notificationId) {
                ref = array[i];
                break;
            }
        }
        if (typeof ref === "undefined") {
            return;
        }
        ref.$isExpired = true;
        args.ref = ref;
        handleNotificationExpire({
            ref,
            params: {
                notificationId: ref.id,
            },
        });
        handleFriendAdd({
            params: {
                userId: ref.senderUserId,
            },
        });

        const D = userStore.userDialog;
        if (
            typeof args.ref === "undefined" ||
            args.ref.type !== "friendRequest" ||
            args.ref.senderUserId !== D.id
        ) {
            return;
        }
        D.isFriend = true;
        D.incomingRequest = false;
    }

    /**
     *
     * @param args
     */
    function handleNotificationExpire(args) {
        const { ref } = args;
        const D = userStore.userDialog;
        if (ref.type !== "friendRequest" || ref.senderUserId !== D.id) {
            return;
        }
        D.incomingRequest = false;
    }

    /**
     *
     * @param {object} data
     * @returns {object}
     */
    function applyNotification(data) {
        return applyNotificationToCollection({
            notifications: notificationTable.value.data,
            payload: data,
            sanitizeNotificationJson,
            createDefaultNotificationRef,
            parseNotificationDetails,
        });
    }

    /**
     *
     * @param data
     */
    function applyNotificationV2(data) {
        return applyNotificationV2ToCollection({
            notifications: notificationTable.value.data,
            payload: data,
            sanitizeNotificationJson,
            createDefaultNotificationV2Ref,
            applyBoopLegacyHandling,
            endpointDomain: AppDebug.endpointDomain,
        });
    }

    /**
     *
     * @param args
     */
    function handleNotificationV2(args) {
        const ref = applyNotificationV2(args.json);
        if (ref.seen || notificationCenterHiddenSet.value.has(ref.id)) {
            removeFromArray(unseenNotifications.value, ref.id);
        } else if (!unseenNotifications.value.includes(ref.id)) {
            unseenNotifications.value.push(ref.id);
        }
        const existingNotification = notificationTable.value.data.find(
            (n) => n.id === ref.id,
        );
        if (existingNotification) {
            Object.assign(existingNotification, ref);
            database.addNotificationV2ToDatabase(existingNotification); // update
            return;
        }

        if (
            notificationTable.value.filters[0].value.length === 0 ||
            notificationTable.value.filters[0].value.includes(ref.type)
        ) {
            uiStore.notifyMenu("notification");
        }
        database.addNotificationV2ToDatabase(ref);
        notificationTable.value.data.push(ref);
        queueNotificationNoty(ref);
        sharedFeedStore.addEntry(ref);
    }

    /**
     *
     * @param args
     */
    function handleNotificationV2Update(args) {
        const notificationId = args.params.notificationId;
        const json = { ...args.json };
        if (!json) {
            return;
        }
        json.id = notificationId;
        handleNotificationV2({
            json,
            params: {
                notificationId,
            },
        });
        if (json.seen) {
            handleNotificationSee(notificationId);
        }
    }

    /**
     *
     * @param notificationId
     */
    function handleNotificationV2Hide(notificationId) {
        database.expireNotificationV2(notificationId);
        removeFromArray(unseenNotifications.value, notificationId);
        if (unseenNotifications.value.length === 0) {
            uiStore.removeNotify("notification");
        }
        const ref = notificationTable.value.data.find(
            (n) => n.id === notificationId,
        );
        if (ref) {
            ref.expiresAt = new Date().toJSON();
            ref.seen = true;
        }
    }

    /**
     *
     */
    function expireFriendRequestNotifications() {
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            if (
                array[i].type === "friendRequest" ||
                array[i].type === "ignoredFriendRequest"
            ) {
                array.splice(i, 1);
            }
        }
    }

    /**
     *
     * @param {string} notificationId
     */
    function expireNotification(notificationId) {
        let ref;
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            if (array[i].id === notificationId) {
                ref = array[i];
                break;
            }
        }
        if (typeof ref === "undefined") {
            return;
        }
        ref.$isExpired = true;
        database.updateNotificationExpired(ref);
        handleNotificationExpire({
            ref,
            params: {
                notificationId: ref.id,
            },
        });
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async function refreshNotifications() {
        isNotificationsLoading.value = true;
        let count;
        let params;
        try {
            expireFriendRequestNotifications();
            params = {
                n: 100,
                offset: 0,
            };
            count = 50; // 5000 max
            for (let i = 0; i < count; i++) {
                const args = await notificationRequest.getNotifications(params);
                for (const json of args.json) {
                    handleNotification({
                        json,
                        params: {
                            notificationId: json.id,
                        },
                    });
                }
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
            params = {
                n: 100,
                offset: 0,
            };
            count = 50; // 5000 max
            for (let i = 0; i < count; i++) {
                const args =
                    await notificationRequest.getNotificationsV2(params);
                for (const json of args.json) {
                    handleNotificationV2({
                        json,
                        params: {
                            notificationId: json.id,
                        },
                    });
                }
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
            params = {
                n: 100,
                offset: 0,
            };
            count = 50; // 5000 max
            for (let i = 0; i < count; i++) {
                const args =
                    await notificationRequest.getHiddenFriendRequests(params);
                for (const json of args.json) {
                    json.type = "ignoredFriendRequest";
                    handleNotification({
                        json,
                        params: {
                            notificationId: json.id,
                        },
                    });
                }
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            isNotificationsLoading.value = false;
            notificationInitStatus.value = true;
        }
    }

    /**
     *
     * @param {object} noty
     */
    function queueNotificationNoty(noty) {
        noty.isFriend = friendStore.friends.has(noty.senderUserId);
        noty.isFavorite = friendStore.localFavoriteFriends.has(
            noty.senderUserId,
        );
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === "On" ||
                notyFilter[noty.type] === "Friends" ||
                (notyFilter[noty.type] === "VIP" && noty.isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     *
     * @param noty
     */
    function playNoty(noty) {
        if (
            userStore.currentUser.status === "busy" ||
            !watchState.isFriendsLoaded
        ) {
            return;
        }
        let displayName = "";
        if (noty.type === "DisplayName" && noty.previousDisplayName) {
            displayName = noty.previousDisplayName;
        } else if (noty.displayName) {
            displayName = noty.displayName;
        } else if (noty.senderUsername) {
            displayName = noty.senderUsername;
        } else if (noty.sourceDisplayName) {
            displayName = noty.sourceDisplayName;
        }
        if (displayName) {
            // don't play noty twice
            const notyId = `${noty.type},${displayName}`;
            if (notyMap[notyId] && notyMap[notyId] >= noty.created_at) {
                return;
            }
            notyMap[notyId] = noty.created_at;
        }
        const bias = new Date(Date.now() - 60000).toJSON();
        for (const [notyId, createdAt] of Object.entries(notyMap)) {
            if (createdAt < bias) {
                delete notyMap[notyId];
            }
        }
        if (noty.created_at < bias) {
            // don't play noty if it's over 1min old
            return;
        }

        const notiConditions = {
            Always: () => true,
            "Inside VR": () => gameStore.isSteamVRRunning,
            "Outside VR": () => !gameStore.isSteamVRRunning,
            "Game Closed": () => !gameStore.isGameRunning, // Also known as "Outside VRChat"
            "Game Running": () => gameStore.isGameRunning, // Also known as "Inside VRChat"
            "Desktop Mode": () =>
                gameStore.isGameNoVR && gameStore.isGameRunning,
            AFK: () =>
                notificationsSettingsStore.afkDesktopToast &&
                gameStore.isHmdAfk &&
                gameStore.isGameRunning &&
                !gameStore.isGameNoVR,
        };

        const playNotificationTTS =
            notificationsSettingsStore.traySilentMode !== true &&
            notiConditions[notificationsSettingsStore.notificationTTS]?.();
        const playDesktopToast =
            notiConditions[notificationsSettingsStore.desktopToast]?.() ||
            notiConditions["AFK"]();
        const playOverlayToast =
            notiConditions[notificationsSettingsStore.overlayToast]?.();
        const playOverlayNotification =
            notificationsSettingsStore.overlayNotifications && playOverlayToast;
        const playXSNotification =
            notificationsSettingsStore.xsNotifications && playOverlayToast;
        const playOvrtHudNotifications =
            notificationsSettingsStore.ovrtHudNotifications && playOverlayToast;
        const playOvrtWristNotifications =
            notificationsSettingsStore.ovrtWristNotifications &&
            playOverlayToast;

        let message = "";
        if (noty.title) {
            message = `${noty.title}, ${noty.message}`;
        } else if (noty.message) {
            message = noty.message;
        }
        const messageList = [
            "inviteMessage",
            "requestMessage",
            "responseMessage",
        ];
        for (let k = 0; k < messageList.length; k++) {
            if (
                typeof noty.details !== "undefined" &&
                typeof noty.details[messageList[k]] !== "undefined"
            ) {
                message = `, ${noty.details[messageList[k]]}`;
            }
        }
        if (playNotificationTTS) {
            playNotyTTS(noty, displayName, message);
        }
        if (
            playDesktopToast ||
            playXSNotification ||
            playOvrtHudNotifications ||
            playOvrtWristNotifications ||
            playOverlayNotification
        ) {
            if (notificationsSettingsStore.imageNotifications) {
                notySaveImage(noty).then((image) => {
                    if (playXSNotification) {
                        displayXSNotification(noty, message, image);
                    }
                    if (
                        playOvrtHudNotifications ||
                        playOvrtWristNotifications
                    ) {
                        displayOvrtNotification(
                            playOvrtHudNotifications,
                            playOvrtWristNotifications,
                            noty,
                            message,
                            image,
                        );
                    }
                    if (playDesktopToast) {
                        displayDesktopToast(noty, message, image);
                    }
                    if (playOverlayNotification) {
                        displayOverlayNotification(noty, message, image);
                    }
                });
            } else {
                if (playXSNotification) {
                    displayXSNotification(noty, message, "");
                }
                if (playOvrtHudNotifications || playOvrtWristNotifications) {
                    displayOvrtNotification(
                        playOvrtHudNotifications,
                        playOvrtWristNotifications,
                        noty,
                        message,
                        "",
                    );
                }
                if (playDesktopToast) {
                    displayDesktopToast(noty, message, "");
                }
                if (playOverlayNotification) {
                    displayOverlayNotification(noty, message, "");
                }
            }
        }
    }

    /**
     *
     * @param {object} noty
     * @param {string} displayName
     * @param {string} message
     */
    async function playNotyTTS(noty, displayName, message) {
        if (notificationsSettingsStore.notificationTTSNickName) {
            const userId = getUserIdFromNoty(noty);
            const memo = await getUserMemo(userId);
            if (memo.memo) {
                const array = memo.memo.split("\n");
                const nickName = array[0];
                displayName = nickName;
            }
        }
        const msg = getNotificationMessage(noty, message, displayName);
        if (msg) {
            notificationsSettingsStore.speak(
                toNotificationText(msg.title, msg.body, noty.type),
            );
        }
    }

    const {
        notySaveImage,
        displayDesktopToast,
        displayOverlayNotification,
        displayXSNotification,
        displayOvrtNotification,
    } = createOverlayDispatch({
        getUserIdFromNoty,
        queryRequest,
        notificationsSettingsStore,
        advancedSettingsStore,
        appearanceSettingsStore,
    });

    // Overlay dispatch functions (notySaveImage, displayDesktopToast, etc.)
    // are in ./overlayDispatch.js — destructured above via createOverlayDispatch().

    /**
     *
     * @param {object} noty
     * @returns
     */
    function getUserIdFromNoty(noty) {
        const id = getUserIdFromNotyBase(noty);
        if (id) return id;
        if (noty.displayName) {
            return (
                findUserByDisplayName(
                    userStore.cachedUsers,
                    noty.displayName,
                    userStore.cachedUserIdsByDisplayName,
                )?.id ?? ""
            );
        }
        return "";
    }

    /**
     *
     * @param gamelog
     */
    function queueGameLogNoty(gamelog) {
        const noty = structuredClone(gamelog);
        let bias;
        // remove join/leave notifications when switching worlds
        if (
            noty.type === "OnPlayerJoined"
            // noty.type === 'BlockedOnPlayerJoined' ||
            // noty.type === 'MutedOnPlayerJoined'
        ) {
            bias = locationStore.lastLocation.date + 30 * 1000; // 30 secs
            if (Date.parse(noty.created_at) <= bias) {
                return;
            }
        }
        if (
            noty.type === "OnPlayerLeft" ||
            noty.type === "BlockedOnPlayerLeft" ||
            noty.type === "MutedOnPlayerLeft"
        ) {
            bias = locationStore.lastLocationDestinationTime + 5 * 1000; // 5 secs
            if (Date.parse(noty.created_at) <= bias) {
                return;
            }
        }
        if (
            noty.type === "Notification" ||
            noty.type === "LocationDestination"
            // skip unused entries
        ) {
            return;
        }
        if (noty.type === "VideoPlay") {
            if (!noty.videoName) {
                // skip video without name
                return;
            }
            noty.notyName = noty.videoName;
            if (noty.displayName) {
                // add requester's name to noty
                noty.notyName = `${noty.videoName} (${noty.displayName})`;
            }
        }
        if (
            noty.type !== "VideoPlay" &&
            noty.displayName === userStore.currentUser.displayName
        ) {
            // remove current user
            return;
        }
        noty.isFriend = false;
        noty.isFavorite = false;
        if (noty.userId) {
            noty.isFriend = friendStore.friends.has(noty.userId);
            noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        } else if (noty.displayName) {
            const ref = findUserByDisplayName(
                userStore.cachedUsers,
                noty.displayName,
                userStore.cachedUserIdsByDisplayName,
            );
            if (ref) {
                noty.isFriend = friendStore.friends.has(ref.id);
                noty.isFavorite = friendStore.localFavoriteFriends.has(ref.id);
            }
        }
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === "On" ||
                notyFilter[noty.type] === "Everyone" ||
                (notyFilter[noty.type] === "Friends" && noty.isFriend) ||
                (notyFilter[noty.type] === "VIP" && noty.isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     *
     * @param feed
     */
    function queueFeedNoty(feed) {
        const noty = { ...feed };
        if (noty.type === "Avatar") {
            return;
        }
        // hide private worlds from feed
        if (
            wristOverlaySettingsStore.hidePrivateFromFeed &&
            noty.type === "GPS" &&
            noty.location === "private"
        ) {
            return;
        }
        noty.isFriend = friendStore.friends.has(noty.userId);
        noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === "Everyone" ||
                (notyFilter[noty.type] === "Friends" && noty.isFriend) ||
                (notyFilter[noty.type] === "VIP" && noty.isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     *
     * @param noty
     */
    function queueFriendLogNoty(noty) {
        if (noty.type === "FriendRequest") {
            return;
        }
        noty.isFriend = friendStore.friends.has(noty.userId);
        noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === "On" ||
                notyFilter[noty.type] === "Friends" ||
                (notyFilter[noty.type] === "VIP" && noty.isFavorite))
        ) {
            playNoty(noty);
        }
    }

    /**
     *
     * @param noty
     */
    function queueModerationNoty(noty) {
        noty.isFriend = false;
        noty.isFavorite = false;
        if (noty.userId) {
            noty.isFriend = friendStore.friends.has(noty.userId);
            noty.isFavorite = friendStore.localFavoriteFriends.has(noty.userId);
        }
        const notyFilter = notificationsSettingsStore.sharedFeedFilters.noty;
        if (notyFilter[noty.type] && notyFilter[noty.type] === "On") {
            playNoty(noty);
        }
    }

    /**
     *
     */
    async function initNotifications() {
        await initPromise;
        notificationInitStatus.value = false;
        let tableData = await database.getNotificationsV2();
        let notifications = await database.getNotifications();
        tableData = tableData.concat(
            notifications.filter((n) => !tableData.some((t) => t.id === n.id)),
        );
        tableData.sort(
            (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
        );
        tableData.splice(dbVars.maxTableSize);
        notificationTable.value.data = tableData;
        refreshNotifications();
    }

    /**
     *
     */
    function testNotification() {
        playNoty({
            type: "Event",
            created_at: new Date().toJSON(),
            data: t("view.settings.notifications.notifications.test_message"),
        });
    }

    /**
     *
     * @param row
     */
    function acceptFriendRequestNotification(row) {
        modalStore
            .confirm({
                description: t("confirm.accept_friend_request"),
                title: t("confirm.title"),
            })
            .then(({ ok }) => {
                if (!ok) return;
                notificationRequest
                    .acceptFriendRequestNotification({
                        notificationId: row.id,
                    })
                    .then((args) => {
                        handleNotificationAccept(args);
                    })
                    .catch((err) => {
                        if (err && err.message && err.message.includes("404")) {
                            handleNotificationHide(row.id);
                        }
                    });
            })
            .catch(() => {});
    }

    /**
     *
     * @param row
     */
    async function hideNotification(row) {
        if (row.type === "ignoredFriendRequest") {
            await friendRequest.deleteHiddenFriendRequest(
                { notificationId: row.id },
                row.senderUserId,
            );
            handleNotificationHide(row.id);
        } else {
            notificationRequest
                .hideNotification({
                    notificationId: row.id,
                })
                .then(() => {
                    handleNotificationHide(row.id);
                });
        }
    }

    /**
     *
     * @param row
     */
    function hideNotificationPrompt(row) {
        modalStore
            .confirm({
                description: t("confirm.decline_type", { type: row.type }),
                title: t("confirm.title"),
            })
            .then(({ ok }) => {
                if (ok) hideNotification(row);
            })
            .catch(() => {});
    }

    /**
     *
     * @param row
     */
    function acceptRequestInvite(row) {
        modalStore
            .confirm({
                description: t("confirm.send_invite"),
                title: t("confirm.title"),
            })
            .then(({ ok }) => {
                if (!ok) return;
                let currentLocation = locationStore.lastLocation.location;
                if (locationStore.lastLocation.location === "traveling") {
                    currentLocation = locationStore.lastLocationDestination;
                }
                if (!currentLocation) {
                    currentLocation = userStore.currentUser?.$locationTag;
                }
                const L = parseLocation(currentLocation);
                queryRequest
                    .fetch("world", { worldId: L.worldId })
                    .then((args) => {
                        notificationRequest
                            .sendInvite(
                                {
                                    instanceId: L.tag,
                                    worldId: L.tag,
                                    worldName: args.ref.name,
                                    rsvp: true,
                                },
                                row.senderUserId,
                            )
                            .then((_args) => {
                                toast(t("message.invite.sent"));
                                notificationRequest
                                    .hideNotification({
                                        notificationId: row.id,
                                    })
                                    .then(() => {
                                        handleNotificationHide(row.id);
                                    });
                                return _args;
                            });
                    });
            })
            .catch(() => {});
    }

    /**
     * Accept a direct friend invite and open the invited instance.
     * Supports both legacy invite notifications and V2 response actions.
     * @param {boolean} rsvp
     * @returns {Promise<{responseSlot: number | string, rsvp: boolean}>}
     */
    async function getQuickInviteResponseParams(rsvp) {
        if (!inviteStore.inviteResponseMessageTable?.data?.length) {
            await inviteStore.refreshInviteMessageTableData("response");
        }
        return createInviteResponseParams(
            rsvp,
            inviteStore.inviteResponseMessageTable?.data,
        );
    }

    async function acceptInviteAndLaunch(row) {
        if (
            !row?.id ||
            row.type !== "invite" ||
            acceptingInviteIds.has(row.id)
        ) {
            return false;
        }

        const location = getInviteLocation(row);
        if (!location) {
            toast.error(t("message.invite.location_unavailable"));
            return false;
        }

        const { ok } = await modalStore.confirm({
            description: t("confirm.accept_invite_and_launch"),
            title: t("confirm.title"),
        });
        if (!ok) {
            return false;
        }

        acceptingInviteIds.add(row.id);
        try {
            if (row.version >= 2 || Array.isArray(row.responses)) {
                const response = row.responses?.find(
                    (item) =>
                        item?.type === "accept" ||
                        item?.type === "join" ||
                        item?.icon === "check",
                );
                if (response) {
                    await notificationRequest.sendNotificationResponse({
                        notificationId: row.id,
                        responseType: response.type,
                        responseData: response.data || "",
                    });
                }
                handleNotificationV2Hide(row.id);
            } else {
                await notificationRequest.sendInviteResponse(
                    await getQuickInviteResponseParams(true),
                    row.id,
                );
                await notificationRequest.hideNotification({
                    notificationId: row.id,
                });
                handleNotificationHide(row.id);
            }

            const steamVrRunning = await isSteamVrRunning();
            if (gameStore.isGameRunning) {
                await launchStore.tryOpenInstanceInVrc(
                    location,
                    row.shortName || row.details?.shortName || null,
                );
            } else {
                await launchStore.launchGame(
                    location,
                    row.shortName || row.details?.shortName || null,
                    !steamVrRunning,
                );
            }
            return true;
        } catch (error) {
            console.error(
                "Failed to accept invite and launch instance:",
                error,
            );
            toast.error(t("message.invite.accept_launch_failed"));
            return false;
        } finally {
            acceptingInviteIds.delete(row.id);
        }
    }

    async function declineTrayInvite(row) {
        try {
            if (row.version >= 2 || Array.isArray(row.responses)) {
                const response = row.responses?.find(
                    (item) =>
                        item?.type === "decline" ||
                        item?.type === "reject" ||
                        item?.icon === "cancel",
                );
                if (!response) {
                    throw new Error("No decline response is available");
                }
                await notificationRequest.sendNotificationResponse({
                    notificationId: row.id,
                    responseType: response.type,
                    responseData: response.data || "",
                });
                handleNotificationV2Hide(row.id);
            } else {
                await notificationRequest.sendInviteResponse(
                    await getQuickInviteResponseParams(false),
                    row.id,
                );
                await notificationRequest.hideNotification({
                    notificationId: row.id,
                });
                handleNotificationHide(row.id);
            }
            toast.success("已拒绝邀请");
        } catch (error) {
            console.error("Failed to decline tray invite:", error);
            toast.error("拒绝邀请失败");
            throw error;
        }
    }

    async function replyTrayBoop(row) {
        const userId = row.senderUserId || row.link?.replace(/^user:/, "");
        if (!userId) {
            toast.error("无法找到戳一戳发送者");
            throw new Error("Missing boop sender");
        }
        try {
            userStore.showSendBoopDialog(userId);
        } catch (error) {
            console.error("Failed to open tray boop reply:", error);
            toast.error("无法打开戳一戳回复");
            throw error;
        }
    }

    async function acceptTrayFriendRequest(row) {
        try {
            const args = await notificationRequest.acceptFriendRequestNotification({
                notificationId: row.id,
            });
            handleNotificationAccept(args);
            toast.success("已接受好友申请");
        } catch (error) {
            console.error("Failed to accept tray friend request:", error);
            toast.error("接受好友申请失败");
            throw error;
        }
    }

    async function declineTrayFriendRequest(row) {
        try {
            await notificationRequest.hideNotification({
                notificationId: row.id,
            });
            handleNotificationHide(row.id);
            toast.success("已拒绝好友申请");
        } catch (error) {
            console.error("Failed to decline tray friend request:", error);
            toast.error("拒绝好友申请失败");
            throw error;
        }
    }

    function openTrayNotification(row) {
        const senderId = typeof row.senderUserId === "string" ? row.senderUserId : "";
        const groupId = senderId.startsWith("grp_")
            ? senderId
            : row.data?.groupId || row.details?.groupId || "";
        if (groupId && (row.type?.startsWith("group.") || row.type === "groupChange")) {
            showGroupDialog(groupId);
            return;
        }

        if (senderId.startsWith("usr_")) {
            showUserDialog(senderId);
            return;
        }

        if (
            typeof row.link === "string" &&
            /^(group|user|event):/.test(row.link)
        ) {
            openNotificationLink(row.link);
            return;
        }

        const location =
            row.location ||
            row.details?.worldId ||
            row.data?.location ||
            row.data?.worldId ||
            "";
        if (location.startsWith("wrld_")) {
            showWorldDialog(location);
            return;
        }

        router.push({ name: "notification" });
    }

    async function respondToTrayNotification(row, response) {
        if (response.type === "link") {
            openNotificationLink(response.data);
            return;
        }
        if (response.icon === "reply" && row.type === "boop") {
            userStore.showSendBoopDialog(row.senderUserId);
            return;
        }

        try {
            const args = await notificationRequest.sendNotificationResponse({
                notificationId: row.id,
                responseType: response.type,
                responseData: response.data || "",
            });
            handleNotificationV2Hide(row.id);
            toast.success(args.json || "操作成功");
        } catch (error) {
            console.error("Failed to respond to tray notification:", error);
            toast.error("操作失败");
            throw error;
        }
    }

    function ignoreTrayNotifications(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return;
        const hiddenIds = new Set(notificationCenterHiddenIds.value);
        for (const id of ids) {
            hiddenIds.add(id);
            removeFromArray(unseenNotifications.value, id);
        }
        notificationCenterHiddenIds.value = [...hiddenIds];
        saveNotificationCenterHiddenIds();
        if (unseenNotifications.value.length === 0) {
            uiStore.removeNotify("notification");
        }
        toast.success(
            ids.length === 1 ? "已忽略通知" : `已忽略 ${ids.length} 条通知`,
        );
    }

    const handleTrayNotificationAction = createTrayNotificationActionHandler({
        findNotification: (id) =>
            notificationTable.value.data.find((item) => item.id === id),
        isExpired: isNotificationExpired,
        openNotification: openTrayNotification,
        openNotificationCenter: () => {
            isNotificationCenterOpen.value = true;
        },
        respondToNotification: respondToTrayNotification,
        acceptInvite: acceptInviteAndLaunch,
        declineInvite: declineTrayInvite,
        acceptRequestInvite,
        acceptFriendRequest: acceptTrayFriendRequest,
        declineFriendRequest: declineTrayFriendRequest,
        replyBoop: replyTrayBoop,
        ignoreNotifications: ignoreTrayNotifications,
        getPreviewIds: () =>
            trayNotificationSnapshot.value.items.map((item) => item.id),
    });

    window.addEventListener("vrcx-tray-notification-action", (event) => {
        const customEvent = /** @type {CustomEvent<{action?: string, notificationId?: string}>} */ (
            event
        );
        const { action, notificationId } = customEvent.detail || {};
        handleTrayNotificationAction(action, notificationId).catch((error) => {
            console.error("Failed to handle tray notification action:", error);
        });
    });
    window.electron?.onTrayNotificationAction?.((payload) => {
        const { action, notificationId } = payload || {};
        handleTrayNotificationAction(action, notificationId).catch((error) => {
            console.error("Failed to handle tray notification action:", error);
        });
    });

    function getInviteLocation(row) {
        const details = row.details || {};
        const data = row.data || {};
        const directLocation =
            details.worldId || data.location || data.worldId || row.location;
        if (directLocation?.includes(":")) {
            return directLocation;
        }
        const worldId = directLocation || data.worldId;
        const instanceId = details.instanceId || data.instanceId;
        return worldId && instanceId ? `${worldId}:${instanceId}` : "";
    }

    async function isSteamVrRunning() {
        try {
            const running = await AppApi.IsSteamVRRunning();
            gameStore.setIsSteamVRRunning(running);
            return running;
        } catch (error) {
            console.error("Failed to read SteamVR state:", error);
            return gameStore.isSteamVRRunning;
        }
    }

    /**
     *
     * @param notificationId
     * @param responses
     * @param responseType
     */
    function sendNotificationResponse(notificationId, responses, responseType) {
        if (!Array.isArray(responses) || responses.length === 0) return;
        let responseData = "";
        for (let i = 0; i < responses.length; i++) {
            if (responses[i].type === responseType) {
                responseData = responses[i].data;
                break;
            }
        }
        const params = { notificationId, responseType, responseData };
        notificationRequest
            .sendNotificationResponse(params)
            .then((args) => {
                console.log("Notification response", args);
                if (!args.json) return;
                handleNotificationV2Hide(notificationId);
                toast.success(args.json);
            })
            .catch(() => {
                handleNotificationV2Hide(notificationId);
                notificationRequest.hideNotificationV2(notificationId);
            });
    }

    /**
     *
     * @param row
     */
    function deleteNotificationLog(row) {
        const idx = notificationTable.value.data.findIndex(
            (e) => e.id === row.id,
        );
        if (idx !== -1) {
            notificationTable.value.data.splice(idx, 1);
        }
        if (
            row.type !== "friendRequest" &&
            row.type !== "ignoredFriendRequest"
        ) {
            if (!row.version || row.version < 2) {
                database.deleteNotification(row.id);
            } else {
                database.deleteNotificationV2(row.id);
            }
        }
    }

    /**
     *
     * @param row
     */
    function deleteNotificationLogPrompt(row) {
        modalStore
            .confirm({
                // TODO: type translation
                description: t("confirm.delete_type", { type: row.type }),
                title: t("confirm.title"),
            })
            .then(({ ok }) => {
                if (ok) deleteNotificationLog(row);
            })
            .catch(() => {});
    }

    /**
     *
     * @param notification
     */
    function isNotificationExpired(notification) {
        if (notification.$isExpired !== undefined) {
            return notification.$isExpired;
        }
        if (!notification.expiresAt) {
            return false;
        }
        const expiresAt = dayjs(notification.expiresAt);
        return expiresAt.isValid() && dayjs().isSameOrAfter(expiresAt);
    }

    /**
     *
     * @param link
     */
    function openNotificationLink(link) {
        if (!link) {
            return;
        }
        const data = link.split(":");
        if (!data.length) {
            return;
        }
        switch (data[0]) {
            case "group":
                showGroupDialog(data[1]);
                break;
            case "user":
                showUserDialog(data[1]);
                break;
            case "event":
                const ids = data[1].split(",");
                if (ids.length < 2) {
                    console.error("Invalid event notification link:", data[1]);
                    return;
                }

                showGroupDialog(ids[0]);
                // ids[1] cal_ is the event id
                break;
            case "openNotificationLink":
            default:
                toast.error("Unsupported notification link type");
                break;
        }
    }

    return {
        notificationInitStatus,
        notificationTable,
        unseenNotifications,
        isNotificationsLoading,

        initNotifications,
        expireNotification,
        refreshNotifications,
        queueNotificationNoty,
        playNoty,
        queueGameLogNoty,
        queueFeedNoty,
        queueFriendLogNoty,
        queueModerationNoty,
        handleNotificationAccept,
        handleNotificationSee,
        handlePipelineNotification,
        handleNotificationV2Update,
        handleNotificationHide,
        handleNotificationV2Hide,
        handleNotification,
        handleNotificationV2,
        testNotification,

        // Notification actions
        acceptFriendRequestNotification,
        hideNotification,
        hideNotificationPrompt,
        acceptRequestInvite,
        acceptInviteAndLaunch,
        handleTrayNotificationAction,
        sendNotificationResponse,
        deleteNotificationLog,
        deleteNotificationLogPrompt,

        isNotificationCenterOpen,
        friendNotifications,
        groupNotifications,
        otherNotifications,
        unseenFriendNotifications,
        unseenGroupNotifications,
        unseenOtherNotifications,
        recentFriendNotifications,
        recentGroupNotifications,
        recentOtherNotifications,
        hasUnseenNotifications,
        getNotificationCategory,
        isNotificationExpired,
        openNotificationLink,
        queueMarkAsSeen,
        markAllAsSeen,
        clearNotificationCenter,
        appendNotificationTableEntry,
        setNotificationInitStatus,
        clearUnseenNotifications,
    };
});
