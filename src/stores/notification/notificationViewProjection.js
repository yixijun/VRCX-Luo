import {
    getNotificationCategory,
    getNotificationTs
} from '../../shared/utils/notificationCategory';

/**
 * Projects the notification table into a category without changing source
 * order or the notification objects themselves.
 *
 * @param {Array<object>} notifications
 * @param {string} category
 * @returns {Array<object>}
 */
export function filterNotificationsByCategory(notifications, category) {
    return notifications.filter(
        (notification) =>
            getNotificationCategory(notification.type) === category
    );
}

/**
 * Projects pending notifications for the notification center.
 *
 * @param {Array<object>} notifications
 * @param {Set<string>} unseenIds
 * @param {Set<string>} hiddenIds
 * @returns {Array<object>}
 */
export function filterUnseenNotifications(notifications, unseenIds, hiddenIds) {
    return notifications.filter(
        (notification) =>
            unseenIds.has(notification.id) && !hiddenIds.has(notification.id)
    );
}

/**
 * Projects recently seen notifications while preserving the old 24-hour
 * cutoff and hidden/unseen filtering semantics.
 *
 * @param {Array<object>} notifications
 * @param {Set<string>} unseenIds
 * @param {Set<string>} hiddenIds
 * @param {number} cutoff
 * @returns {Array<object>}
 */
export function filterRecentNotifications(
    notifications,
    unseenIds,
    hiddenIds,
    cutoff
) {
    return notifications.filter(
        (notification) =>
            !unseenIds.has(notification.id) &&
            !hiddenIds.has(notification.id) &&
            notification.seen !== false &&
            getNotificationTs(notification) > cutoff
    );
}
