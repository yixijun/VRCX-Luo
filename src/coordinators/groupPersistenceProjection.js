/**
 * Projects the current user's Group refs into the configuration snapshot
 * shape. The iterable order is part of the legacy serialized behavior.
 *
 * @param {Iterable<object>} groupRefs
 * @returns {Array<object>}
 */
export function serializeCurrentUserGroups(groupRefs) {
    const groups = [];
    for (const ref of groupRefs) {
        groups.push({
            id: ref.id,
            name: ref.name,
            ownerId: ref.ownerId,
            iconUrl: ref.iconUrl,
            roles: ref.roles,
            roleIds: ref.myMember?.roleIds
        });
    }
    return groups;
}
