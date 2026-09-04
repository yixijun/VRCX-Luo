/**
 * Normalizes a friend-location pipeline payload before it reaches applyUser.
 * Parsing is supplied by the caller so this module stays deterministic in tests.
 *
 * @param {object} content Pipeline event content.
 * @param {function} parseLocation Location parser capability.
 * @returns {{hasUser: boolean, locationJson: object}}
 */
export function createFriendLocationPayload(content, parseLocation) {
    const location = parseLocation(content.location);
    const travelingToLocation = parseLocation(content.travelingToLocation);
    const hasUser = Boolean(content?.user?.id);

    if (!hasUser) {
        return {
            hasUser,
            locationJson: {
                id: content.userId,
                location: content.location,
                worldId: content.worldId,
                instanceId: location.instanceId,
                travelingToLocation: content.travelingToLocation,
                travelingToWorld: travelingToLocation.worldId,
                travelingToInstance: travelingToLocation.instanceId
            }
        };
    }

    return {
        hasUser,
        locationJson: {
            location: content.location,
            worldId: content.worldId,
            instanceId: location.instanceId,
            travelingToLocation: content.travelingToLocation,
            travelingToWorld: travelingToLocation.worldId,
            travelingToInstance: travelingToLocation.instanceId,
            ...content.user,
            state: 'online'
        }
    };
}
