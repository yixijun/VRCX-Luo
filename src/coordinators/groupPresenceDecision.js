/**
 * Derives the ordered Group membership changes represented by a presence
 * payload. The coordinator applies the returned changes after this pure
 * decision so store mutations keep their legacy order.
 *
 * @param {object} dependencies
 * @param {Iterable<string>} dependencies.groups
 * @param {Iterable<string>} dependencies.currentGroupIds
 * @returns {{joinedGroupIds: string[], leftGroupIds: string[]}}
 */
export function deriveGroupPresenceChanges({ groups, currentGroupIds }) {
    const currentIds = Array.from(currentGroupIds);
    const knownIds = new Set(currentIds);
    const joinedGroupIds = [];

    for (const groupId of groups) {
        if (knownIds.has(groupId)) {
            continue;
        }
        knownIds.add(groupId);
        joinedGroupIds.push(groupId);
    }

    const incomingIds = new Set(groups);
    const leftGroupIds = currentIds.filter(
        (groupId) => !incomingIds.has(groupId)
    );

    return { joinedGroupIds, leftGroupIds };
}
