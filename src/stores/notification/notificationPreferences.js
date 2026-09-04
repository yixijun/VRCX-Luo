export const NOTIFICATION_TABLE_FILTERS_KEY = 'VRCX_notificationTableFilters';
export const NOTIFICATION_CENTER_HIDDEN_IDS_KEY =
    'VRCX_notificationCenterHiddenIds';
export const NOTIFICATION_CENTER_HIDDEN_IDS_LIMIT = 1000;

/**
 * Filters invalid hidden notification IDs without changing their order or
 * multiplicity. This mirrors the loading behavior of the existing store.
 *
 * @param {Array<unknown>} ids
 * @returns {Array<string>}
 */
export function filterValidHiddenNotificationIds(ids) {
    return /** @type {string[]} */ (
        ids.filter((id) => typeof id === 'string' && id.length > 0)
    );
}

/**
 * Normalizes hidden notification IDs before persistence while preserving the
 * existing deduplication, order and limit semantics.
 *
 * @param {Array<unknown>} ids
 * @param {number} limit
 * @returns {Array<string>}
 */
export function normalizeHiddenNotificationIds(
    ids,
    limit = NOTIFICATION_CENTER_HIDDEN_IDS_LIMIT
) {
    return [...new Set(filterValidHiddenNotificationIds(ids))].slice(-limit);
}

/**
 * Creates the persistence seam for notification-center preferences.
 *
 * @param {object} dependencies
 * @param {object} dependencies.configRepository
 * @param {Function} [dependencies.warn]
 * @returns {object}
 */
export function createNotificationPreferences({
    configRepository,
    warn = console.warn
}) {
    return Object.freeze({
        async load() {
            const filterTypes = JSON.parse(
                await configRepository.getString(
                    NOTIFICATION_TABLE_FILTERS_KEY,
                    '[]'
                )
            );
            const hiddenIds = await configRepository.getArray(
                NOTIFICATION_CENTER_HIDDEN_IDS_KEY,
                []
            );
            return {
                filterTypes,
                hiddenIds: filterValidHiddenNotificationIds(hiddenIds)
            };
        },

        saveHiddenIds(ids) {
            configRepository
                .setArray(NOTIFICATION_CENTER_HIDDEN_IDS_KEY, ids)
                .catch((err) => {
                    warn('Failed to save hidden notification center IDs:', err);
                });
        },

        normalizeHiddenIds(ids) {
            return normalizeHiddenNotificationIds(ids);
        }
    });
}
