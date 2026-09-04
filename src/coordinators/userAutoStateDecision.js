/**
 * Derives the status payload for the automatic status update flow.
 *
 * Store reads and the network side effect stay in the coordinator; this
 * module owns only the guards, instance-type mapping and friend filtering.
 *
 * @param {object} dependencies
 * @param {boolean} dependencies.enabled
 * @param {boolean} dependencies.isGameRunning
 * @param {number} dependencies.playerCount
 * @param {string} dependencies.location
 * @param {(location: string) => object} dependencies.parseLocation
 * @param {string[]} dependencies.allowedInstanceTypes
 * @param {boolean} dependencies.noFriends
 * @param {string[]} dependencies.selectedGroups
 * @param {Map<string, object>} dependencies.cachedFavorites
 * @param {Record<string, string[]>} dependencies.localFriendFavorites
 * @param {Map<string, object>} dependencies.friendList
 * @param {string} dependencies.currentStatus
 * @param {string} dependencies.companyStatus
 * @param {string} dependencies.aloneStatus
 * @param {boolean} dependencies.companyDescEnabled
 * @param {string} dependencies.companyDesc
 * @param {boolean} dependencies.aloneDescEnabled
 * @param {string} dependencies.aloneDesc
 * @returns {{status: string, statusDescription?: string}|undefined}
 */
export function deriveAutoStateChangeParams({
    enabled,
    isGameRunning,
    playerCount,
    location,
    parseLocation,
    allowedInstanceTypes,
    noFriends,
    selectedGroups,
    cachedFavorites,
    localFriendFavorites,
    friendList,
    currentStatus,
    companyStatus,
    aloneStatus,
    companyDescEnabled,
    companyDesc,
    aloneDescEnabled,
    aloneDesc
}) {
    if (
        !enabled ||
        !isGameRunning ||
        !playerCount ||
        location === '' ||
        location === 'traveling'
    ) {
        return;
    }

    const locationRef = parseLocation(location);
    let instanceType = locationRef.accessType;
    if (instanceType === 'group') {
        if (locationRef.groupAccessType === 'members') {
            instanceType = 'groupOnly';
        } else if (locationRef.groupAccessType === 'plus') {
            instanceType = 'groupPlus';
        } else {
            instanceType = 'groupPublic';
        }
    }
    if (
        allowedInstanceTypes.length > 0 &&
        !allowedInstanceTypes.includes(instanceType)
    ) {
        return;
    }

    let withCompany = playerCount > 1;
    if (noFriends) {
        if (selectedGroups.length > 0) {
            const groupFriendIds = new Set();
            for (const ref of cachedFavorites.values()) {
                if (
                    ref.type === 'friend' &&
                    selectedGroups.includes(ref.$groupKey)
                ) {
                    groupFriendIds.add(ref.favoriteId);
                }
            }
            for (const selectedKey of selectedGroups) {
                if (selectedKey.startsWith('local:')) {
                    const groupName = selectedKey.slice(6);
                    const userIds = localFriendFavorites[groupName];
                    if (userIds) {
                        for (let i = 0; i < userIds.length; ++i) {
                            groupFriendIds.add(userIds[i]);
                        }
                    }
                }
            }
            withCompany = false;
            for (const friendId of friendList.keys()) {
                if (groupFriendIds.has(friendId)) {
                    withCompany = true;
                    break;
                }
            }
        } else {
            withCompany = friendList.size >= 1;
        }
    }

    const newStatus = withCompany ? companyStatus : aloneStatus;
    if (currentStatus === newStatus) {
        return;
    }

    const params = { status: newStatus };
    if (withCompany && companyDescEnabled) {
        params.statusDescription = companyDesc;
    } else if (!withCompany && aloneDescEnabled) {
        params.statusDescription = aloneDesc;
    }

    return params;
}
