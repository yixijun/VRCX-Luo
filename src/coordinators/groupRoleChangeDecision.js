/**
 * Derives the notification messages emitted for a Group role change.
 *
 * The returned order intentionally matches the legacy coordinator: removed
 * roles are reported before added roles, and role ids keep their source order.
 *
 * @param {object} dependencies
 * @param {Array<object>} dependencies.oldRoles
 * @param {Array<object>|undefined} dependencies.newRoles
 * @param {Array<string>} dependencies.oldRoleIds
 * @param {Array<string>} dependencies.newRoleIds
 * @returns {Array<string>}
 */
export function deriveGroupRoleChangeMessages({
    oldRoles,
    newRoles,
    oldRoleIds,
    newRoleIds
}) {
    const messages = [];

    for (const roleId of oldRoleIds) {
        if (!newRoleIds.includes(roleId)) {
            const role = oldRoles.find((candidate) => candidate.id === roleId);
            const roleName = role ? role.name : '';
            messages.push(`Role ${roleName} removed`);
        }
    }

    if (typeof newRoles !== 'undefined') {
        for (const roleId of newRoleIds) {
            if (!oldRoleIds.includes(roleId)) {
                const role = newRoles.find(
                    (candidate) => candidate.id === roleId
                );
                const roleName = role ? role.name : '';
                messages.push(`Role ${roleName} added`);
            }
        }
    }

    return messages;
}
