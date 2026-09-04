import { describe, expect, it } from 'vitest';

import { deriveGroupRoleChangeMessages } from '../groupRoleChangeDecision';

describe('deriveGroupRoleChangeMessages', () => {
    it('reports removed roles before added roles in source order', () => {
        expect(
            deriveGroupRoleChangeMessages({
                oldRoles: [
                    { id: 'role-old-a', name: 'Moderator' },
                    { id: 'role-old-b', name: 'Member' }
                ],
                newRoles: [
                    { id: 'role-old-b', name: 'Member' },
                    { id: 'role-new', name: 'Guest' }
                ],
                oldRoleIds: ['role-old-a', 'role-old-b'],
                newRoleIds: ['role-old-b', 'role-new']
            })
        ).toEqual(['Role Moderator removed', 'Role Guest added']);
    });

    it('uses the legacy empty-name output when a role payload is missing', () => {
        expect(
            deriveGroupRoleChangeMessages({
                oldRoles: [],
                newRoles: [{}],
                oldRoleIds: ['role-old'],
                newRoleIds: ['role-new']
            })
        ).toEqual(['Role  removed', 'Role  added']);
    });

    it('does not derive additions when the new role payload is absent', () => {
        expect(
            deriveGroupRoleChangeMessages({
                oldRoles: [{ id: 'role-old', name: 'Member' }],
                newRoles: undefined,
                oldRoleIds: ['role-old'],
                newRoleIds: ['role-new']
            })
        ).toEqual(['Role Member removed']);
    });
});
