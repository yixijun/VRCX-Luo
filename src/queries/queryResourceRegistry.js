/**
 * Builds the resource definitions consumed by the query request facade.
 *
 * The Query module owns cache keys and policies; API modules are supplied as
 * transport implementations so this registry has no global API dependency.
 *
 * @param {object} dependencies
 * @param {object} dependencies.requests API request implementations
 * @param {object} dependencies.queryKeys Query key factory
 * @param {object} dependencies.policies Entity query policies
 * @returns {Record<string, {key: Function, policy: object, queryFn: Function}>}
 */
export function createQueryResourceRegistry({ requests, queryKeys, policies }) {
    const {
        avatarRequest,
        favoriteRequest,
        groupRequest,
        inventoryRequest,
        miscRequest,
        userRequest,
        worldRequest
    } = requests;

    const userDialogPolicy = Object.freeze({
        ...policies.user,
        staleTime: 60_000
    });
    const userForcePolicy = Object.freeze({
        ...policies.user,
        staleTime: 0
    });
    const avatarDialogPolicy = Object.freeze({
        ...policies.avatar,
        staleTime: 120_000
    });
    const worldDialogPolicy = Object.freeze({
        ...policies.world,
        staleTime: 120_000
    });
    const worldForcePolicy = Object.freeze({
        ...policies.world,
        staleTime: 0
    });
    const groupDialogPolicy = Object.freeze({
        ...policies.group,
        staleTime: 120_000
    });
    const groupForcePolicy = Object.freeze({
        ...policies.group,
        staleTime: 0
    });

    return Object.freeze({
        user: {
            key: (params) => queryKeys.user(params.userId),
            policy: policies.user,
            queryFn: (params) => userRequest.getUser(params)
        },
        'user.dialog': {
            key: (params) => queryKeys.user(params.userId),
            policy: userDialogPolicy,
            queryFn: (params) => userRequest.getUser(params)
        },
        'user.force': {
            key: (params) => queryKeys.user(params.userId),
            policy: userForcePolicy,
            queryFn: (params) => userRequest.getUser(params)
        },
        avatar: {
            key: (params) => queryKeys.avatar(params.avatarId),
            policy: policies.avatar,
            queryFn: (params) => avatarRequest.getAvatar(params)
        },
        'avatar.dialog': {
            key: (params) => queryKeys.avatar(params.avatarId),
            policy: avatarDialogPolicy,
            queryFn: (params) => avatarRequest.getAvatar(params)
        },
        world: {
            key: (params) => queryKeys.world(params.worldId),
            policy: policies.world,
            queryFn: (params) => worldRequest.getWorld(params)
        },
        'world.dialog': {
            key: (params) => queryKeys.world(params.worldId),
            policy: worldDialogPolicy,
            queryFn: (params) => worldRequest.getWorld(params)
        },
        'world.location': {
            key: (params) => queryKeys.world(params.worldId),
            policy: worldDialogPolicy,
            queryFn: (params) => worldRequest.getWorld(params)
        },
        'world.force': {
            key: (params) => queryKeys.world(params.worldId),
            policy: worldForcePolicy,
            queryFn: (params) => worldRequest.getWorld(params)
        },
        worldsByUser: {
            key: (params) => queryKeys.worldsByUser(params),
            policy: policies.worldCollection,
            queryFn: (params) =>
                worldRequest.getWorlds(params, params.option || undefined)
        },
        group: {
            key: (params) =>
                queryKeys.group(params.groupId, params.includeRoles),
            policy: policies.group,
            queryFn: (params) => groupRequest.getGroup(params)
        },
        'group.dialog': {
            key: (params) =>
                queryKeys.group(params.groupId, params.includeRoles),
            policy: groupDialogPolicy,
            queryFn: (params) => groupRequest.getGroup(params)
        },
        'group.force': {
            key: (params) =>
                queryKeys.group(params.groupId, params.includeRoles),
            policy: groupForcePolicy,
            queryFn: (params) => groupRequest.getGroup(params)
        },
        groupMember: {
            key: (params) => queryKeys.groupMember(params),
            policy: policies.groupCollection,
            queryFn: (params) => groupRequest.getGroupMember(params)
        },
        groupMembers: {
            key: (params) => queryKeys.groupMembers(params),
            policy: policies.groupCollection,
            queryFn: (params) => groupRequest.getGroupMembers(params)
        },
        groupGallery: {
            key: (params) => queryKeys.groupGallery(params),
            policy: policies.groupCollection,
            queryFn: (params) => groupRequest.getGroupGallery(params)
        },
        groupCalendar: {
            key: (params) => queryKeys.groupCalendar(params.groupId),
            policy: policies.groupCollection,
            queryFn: (params) => groupRequest.getGroupCalendar(params.groupId)
        },
        groupCalendarEvent: {
            key: (params) => queryKeys.groupCalendarEvent(params),
            policy: policies.groupCalendarEvent,
            queryFn: (params) => groupRequest.getGroupCalendarEvent(params)
        },
        avatarGallery: {
            key: (params) => queryKeys.avatarGallery(params.avatarId),
            policy: policies.avatarGallery,
            queryFn: (params) => avatarRequest.getAvatarGallery(params.avatarId)
        },
        favoriteLimits: {
            key: () => queryKeys.favoriteLimits(),
            policy: policies.favoriteLimits,
            queryFn: () => favoriteRequest.getFavoriteLimits()
        },
        userInventoryItem: {
            key: (params) => queryKeys.userInventoryItem(params),
            policy: policies.inventoryCollection,
            queryFn: (params) => inventoryRequest.getUserInventoryItem(params)
        },
        fileAnalysis: {
            key: (params) => queryKeys.fileAnalysis(params),
            policy: policies.fileAnalysis,
            queryFn: (params) => miscRequest.getFileAnalysis(params)
        },
        worldPersistData: {
            key: (params) => queryKeys.worldPersistData(params.worldId),
            policy: policies.worldPersistData,
            queryFn: (params) => miscRequest.hasWorldPersistData(params)
        },
        mutualCounts: {
            key: (params) => queryKeys.mutualCounts(params.userId),
            policy: policies.mutualCounts,
            queryFn: (params) => userRequest.getMutualCounts(params)
        },
        visits: {
            key: () => queryKeys.visits(),
            policy: policies.visits,
            queryFn: () => miscRequest.getVisits()
        },
        file: {
            key: (params) => queryKeys.file(params.fileId),
            policy: policies.fileObject,
            queryFn: (params) => miscRequest.getFile(params)
        },
        avatarStyles: {
            key: () => queryKeys.avatarStyles(),
            policy: policies.avatarStyles,
            queryFn: () => avatarRequest.getAvailableAvatarStyles()
        },
        representedGroup: {
            key: (params) => queryKeys.representedGroup(params.userId),
            policy: policies.representedGroup,
            queryFn: (params) => groupRequest.getRepresentedGroup(params)
        },
        vrchatCredits: {
            key: () => queryKeys.vrchatCredits(),
            policy: policies.vrchatCredits,
            queryFn: () => miscRequest.getVRChatCredits()
        }
    });
}
