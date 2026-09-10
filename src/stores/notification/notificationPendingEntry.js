/**
 * Appends a locally generated notification to the table and, when it is
 * visible to the user, marks it as pending so all notification projections
 * (including the tray preview) can consume the same entry.
 *
 * @param {{collection: object[], unseenIds: Array<string|number>, hiddenIds?: Array<string|number>, entry: object, now?: number}} [options]
 * @returns {object|null}
 */
function appendPendingNotification(options) {
    const {
        collection,
        unseenIds,
        hiddenIds = [],
        entry,
        now = Date.now()
    } = options || {};
    if (!Array.isArray(collection) || !entry || typeof entry !== 'object') {
        return null;
    }

    const id = ensureNotificationId(entry, collection, now);
    const isHidden = hiddenIds.some((hiddenId) => hiddenId === id);
    if (
        entry.seen !== true &&
        !isHidden &&
        Array.isArray(unseenIds) &&
        !unseenIds.includes(id)
    ) {
        unseenIds.push(id);
    }

    collection.push(entry);
    return entry;
}

function ensureNotificationId(entry, collection, now) {
    if (entry.id !== undefined && entry.id !== null && String(entry.id).trim()) {
        return entry.id;
    }

    const type = String(entry.type || 'notification');
    const createdAt = String(
        entry.created_at || entry.createdAt || new Date(now).toISOString()
    );
    const context = String(
        entry.location ||
            entry.senderUserId ||
            entry.message ||
            entry.title ||
            ''
    );
    const baseId = [type, createdAt, context]
        .map((value) => encodeURIComponent(value))
        .join(':');

    let id = `local:${baseId}`;
    let suffix = 2;
    while (collection.some((item) => item?.id === id)) {
        id = `local:${baseId}:${suffix}`;
        suffix += 1;
    }
    entry.id = id;
    return id;
}

export { appendPendingNotification };
