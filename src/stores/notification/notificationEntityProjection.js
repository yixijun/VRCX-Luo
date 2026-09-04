/**
 * Applies a legacy notification payload to the notification collection.
 * Existing objects are updated in place so Vue keeps the original reactive
 * reference and the store's duplicate-id resolution remains unchanged.
 *
 * @param {object} dependencies
 * @param {Array<object>} dependencies.notifications
 * @param {object} dependencies.payload
 * @param {Function} dependencies.sanitizeNotificationJson
 * @param {Function} dependencies.createDefaultNotificationRef
 * @param {Function} dependencies.parseNotificationDetails
 * @returns {object}
 */
export function applyNotificationToCollection({
    notifications,
    payload,
    sanitizeNotificationJson,
    createDefaultNotificationRef,
    parseNotificationDetails
}) {
    const json = sanitizeNotificationJson({ ...payload });
    let ref;
    for (let i = notifications.length - 1; i >= 0; i--) {
        if (notifications[i].id === json.id) {
            ref = notifications[i];
            break;
        }
    }
    if (typeof ref === 'undefined') {
        ref = createDefaultNotificationRef(json);
    } else {
        Object.assign(ref, json);
        ref.$isExpired = false;
    }
    ref.details = parseNotificationDetails(ref.details);
    return ref;
}

/**
 * Applies a V2 notification payload to the notification collection.
 *
 * @param {object} dependencies
 * @param {Array<object>} dependencies.notifications
 * @param {object} dependencies.payload
 * @param {Function} dependencies.sanitizeNotificationJson
 * @param {Function} dependencies.createDefaultNotificationV2Ref
 * @param {Function} dependencies.applyBoopLegacyHandling
 * @param {string} dependencies.endpointDomain
 * @returns {object}
 */
export function applyNotificationV2ToCollection({
    notifications,
    payload,
    sanitizeNotificationJson,
    createDefaultNotificationV2Ref,
    applyBoopLegacyHandling,
    endpointDomain
}) {
    const json = sanitizeNotificationJson({ ...payload });
    let ref = notifications.find((notification) => notification.id === json.id);
    if (typeof ref === 'undefined') {
        ref = createDefaultNotificationV2Ref(json);
    } else {
        Object.assign(ref, json);
    }
    ref.created_at = ref.createdAt;
    applyBoopLegacyHandling(ref, endpointDomain);
    return ref;
}
