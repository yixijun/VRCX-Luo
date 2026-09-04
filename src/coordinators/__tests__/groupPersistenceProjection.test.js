import { describe, expect, it } from 'vitest';

import { serializeCurrentUserGroups } from '../groupPersistenceProjection';

describe('serializeCurrentUserGroups', () => {
    it('preserves iterable order and the persisted field shape', () => {
        const roles = [{ id: 'role-1', name: 'Member' }];
        expect(
            serializeCurrentUserGroups(
                new Map([
                    [
                        'first',
                        {
                            id: 'first',
                            name: 'First',
                            ownerId: 'owner-1',
                            iconUrl: 'icon-1',
                            roles,
                            myMember: { roleIds: ['role-1'] }
                        }
                    ],
                    [
                        'second',
                        {
                            id: 'second',
                            name: 'Second',
                            ownerId: 'owner-2',
                            iconUrl: 'icon-2',
                            roles: [],
                            myMember: { roleIds: [] }
                        }
                    ]
                ]).values()
            )
        ).toEqual([
            {
                id: 'first',
                name: 'First',
                ownerId: 'owner-1',
                iconUrl: 'icon-1',
                roles,
                roleIds: ['role-1']
            },
            {
                id: 'second',
                name: 'Second',
                ownerId: 'owner-2',
                iconUrl: 'icon-2',
                roles: [],
                roleIds: []
            }
        ]);
    });

    it('keeps an undefined roleIds property when myMember is absent', () => {
        expect(
            serializeCurrentUserGroups([
                {
                    id: 'group-1',
                    name: 'Group',
                    ownerId: 'owner',
                    iconUrl: '',
                    roles: []
                }
            ])
        ).toEqual([
            {
                id: 'group-1',
                name: 'Group',
                ownerId: 'owner',
                iconUrl: '',
                roles: [],
                roleIds: undefined
            }
        ]);
    });

    it('returns an empty snapshot for an empty iterable', () => {
        expect(serializeCurrentUserGroups([])).toEqual([]);
    });
});
