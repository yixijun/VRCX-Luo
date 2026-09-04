import Noty from 'noty';

import { escapeTag } from '../shared/utils/base/string';

/**
 * Shows the logout greeting while keeping Noty and HTML details behind a
 * notification adapter seam.
 *
 * @param {object} dependencies
 * @param {string} dependencies.displayName
 * @param {function} dependencies.translate
 * @param {function} [dependencies.escapeDisplayName]
 * @param {function} [dependencies.createNotification]
 * @returns {object}
 */
export function showLogoutGreeting({
    displayName,
    translate,
    escapeDisplayName = escapeTag,
    createNotification = (options) => new Noty(options)
}) {
    const notification = createNotification({
        type: 'success',
        text: translate('message.auth.logout_greeting', {
            name: `<strong>${escapeDisplayName(displayName)}</strong>`
        })
    });
    notification.show();
    return notification;
}
