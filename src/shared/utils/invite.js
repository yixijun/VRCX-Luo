import { parseLocation } from './location';

/**
 *
 * @param {string} location
 * @param {object} deps
 * @param {string} deps.currentUserId - current user's id
 * @param {string} deps.lastLocationStr - last location string from location store
 * @param {Map} deps.cachedInstances - instance cache map
 * @returns {boolean}
 */
function checkCanInvite(location, deps) {
    if (!location) {
        return false;
    }
    const L = parseLocation(location);
    const instance = deps.cachedInstances?.get(location);
    if (instance?.closedAt) {
        return false;
    }
    if (
        L.accessType === 'public' ||
        L.accessType === 'group' ||
        L.userId === deps.currentUserId
    ) {
        return true;
    }
    if (L.accessType === 'invite' || L.accessType === 'friends') {
        return false;
    }
    if (deps.lastLocationStr === location) {
        return true;
    }
    return false;
}

/**
 *
 * @param {string} location
 * @param {object} deps
 * @param {string} deps.currentUserId - current user's id
 * @param {Map} deps.cachedInstances - instance cache map
 * @param {Map} deps.friends - friends map
 * @returns {boolean}
 */
function checkCanInviteSelf(location, deps) {
    if (!location) {
        return false;
    }
    const L = parseLocation(location);
    const instance = deps.cachedInstances?.get(location);
    if (instance?.closedAt) {
        return false;
    }
    if (L.userId === deps.currentUserId) {
        return true;
    }
    if (L.accessType === 'friends' && !deps.friends?.has(L.userId)) {
        return false;
    }
    return true;
}

const DEFAULT_INVITE_RESPONSE_SLOT = 0;

/**
 * @param {Array<{slot?: number | string}>} responseMessages
 * @returns {number | string}
 */
function getInviteResponseSlot(responseMessages) {
    const message = Array.isArray(responseMessages)
        ? responseMessages.find(
              (item) =>
                  item?.slot !== undefined &&
                  item?.slot !== null &&
                  item?.slot !== ''
          )
        : null;
    return message?.slot ?? DEFAULT_INVITE_RESPONSE_SLOT;
}

/**
 * @param {boolean} rsvp
 * @param {Array<{slot?: number | string}>} responseMessages
 * @returns {{responseSlot: number | string, rsvp: boolean}}
 */
function createInviteResponseParams(rsvp, responseMessages) {
    return {
        responseSlot: getInviteResponseSlot(responseMessages),
        rsvp
    };
}

export {
    checkCanInvite,
    checkCanInviteSelf,
    createInviteResponseParams,
    getInviteResponseSlot
};
