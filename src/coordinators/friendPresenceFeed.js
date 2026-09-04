const transitionFeedTypes = Object.freeze({
    online: 'Online',
    offline: 'Offline'
});

/**
 * Builds the feed record for a friend presence transition.
 * This module is pure: all values needed by the record are supplied by the caller.
 *
 * @param {object} input
 * @param {'online'|'offline'} input.transition
 * @param {string} input.createdAt
 * @param {string} input.userId
 * @param {string} input.displayName
 * @param {string} input.location
 * @param {string} input.worldName
 * @param {string} input.groupName
 * @param {number|string} input.time
 * @returns {object|undefined}
 */
export function createFriendPresenceFeed({
    transition,
    createdAt,
    userId,
    displayName,
    location,
    worldName,
    groupName,
    time
}) {
    const type = transitionFeedTypes[transition];
    if (typeof type === 'undefined') {
        return undefined;
    }
    return {
        created_at: createdAt,
        type,
        userId,
        displayName,
        location,
        worldName,
        groupName,
        time
    };
}
