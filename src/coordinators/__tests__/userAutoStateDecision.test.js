import { describe, expect, it, vi } from 'vitest';

import { deriveAutoStateChangeParams } from '../userAutoStateDecision';

function createDependencies(overrides = {}) {
    return {
        enabled: true,
        isGameRunning: true,
        playerCount: 1,
        location: 'wrld_world:instance~region(us)',
        parseLocation: vi.fn(() => ({ accessType: 'public' })),
        allowedInstanceTypes: [],
        noFriends: false,
        selectedGroups: [],
        cachedFavorites: new Map(),
        localFriendFavorites: Object.create(null),
        friendList: new Map(),
        currentStatus: 'active',
        companyStatus: 'busy',
        aloneStatus: 'active',
        companyDescEnabled: false,
        companyDesc: 'With friends',
        aloneDescEnabled: false,
        aloneDesc: 'Alone',
        ...overrides
    };
}

describe('deriveAutoStateChangeParams', () => {
    it('keeps the legacy guards for disabled or unavailable locations', () => {
        const guardCases = [
            { enabled: false },
            { isGameRunning: false },
            { playerCount: 0 },
            { location: '' },
            { location: 'traveling' }
        ];

        for (const overrides of guardCases) {
            expect(
                deriveAutoStateChangeParams(createDependencies(overrides))
            ).toBeUndefined();
        }
    });

    it('maps group access and selected remote/local friend groups', () => {
        const params = deriveAutoStateChangeParams(
            createDependencies({
                parseLocation: vi.fn(() => ({
                    accessType: 'group',
                    groupAccessType: 'members'
                })),
                allowedInstanceTypes: ['groupOnly'],
                noFriends: true,
                selectedGroups: ['friend:close', 'local:trusted'],
                cachedFavorites: new Map([
                    [
                        'favorite-1',
                        {
                            type: 'friend',
                            $groupKey: 'friend:close',
                            favoriteId: 'remote-friend'
                        }
                    ]
                ]),
                localFriendFavorites: {
                    trusted: ['local-friend']
                },
                friendList: new Map([['local-friend', {}]]),
                companyDescEnabled: true,
                companyDesc: 'In company'
            })
        );

        expect(params).toEqual({
            status: 'busy',
            statusDescription: 'In company'
        });
    });

    it('uses the alone status when selected groups have no matching friend', () => {
        expect(
            deriveAutoStateChangeParams(
                createDependencies({
                    playerCount: 3,
                    noFriends: true,
                    selectedGroups: ['local:trusted'],
                    localFriendFavorites: { trusted: ['not-present'] },
                    friendList: new Map([['other-friend', {}]]),
                    currentStatus: 'busy',
                    aloneStatus: 'active',
                    aloneDescEnabled: true,
                    aloneDesc: 'Solo'
                })
            )
        ).toEqual({ status: 'active', statusDescription: 'Solo' });
    });

    it('does not emit a request when the computed status is unchanged', () => {
        expect(
            deriveAutoStateChangeParams(
                createDependencies({
                    playerCount: 2,
                    friendList: new Map([['friend', {}]]),
                    currentStatus: 'busy'
                })
            )
        ).toBeUndefined();
    });

    it('omits descriptions when the selected description is disabled', () => {
        expect(
            deriveAutoStateChangeParams(
                createDependencies({
                    playerCount: 2,
                    friendList: new Map([['friend', {}]])
                })
            )
        ).toEqual({ status: 'busy' });
    });
});
