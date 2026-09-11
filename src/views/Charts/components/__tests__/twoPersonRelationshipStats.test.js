import { describe, expect, test } from 'vitest';

import {
    buildSharedWorldRanking,
    countSharedRoomVisits
} from '../twoPersonRelationshipStats';

describe('countSharedRoomVisits', () => {
    test('counts one visit for each shared room', () => {
        expect(
            countSharedRoomVisits([
                { joinLeavesCount: 1 },
                { joinLeavesCount: 1 }
            ])
        ).toBe(2);
    });

    test('includes repeated visits to the same room', () => {
        expect(
            countSharedRoomVisits([
                { joinLeavesCount: 3 },
                { joinLeavesCount: 2 }
            ])
        ).toBe(5);
    });

    test('falls back to one visit for malformed room counts', () => {
        expect(
            countSharedRoomVisits([
                { joinLeavesCount: 0 },
                {},
                { joinLeavesCount: 'invalid' }
            ])
        ).toBe(3);
    });

    test('returns zero for an empty result', () => {
        expect(countSharedRoomVisits([])).toBe(0);
    });
});

describe('buildSharedWorldRanking', () => {
    test('aggregates room visits by world and sorts by visit count', () => {
        const ranking = buildSharedWorldRanking([
            {
                location: 'wrld_a:instance-1',
                joinLeavesCount: 2,
                coexistenceTime: 100,
                friendALeave: 300
            },
            {
                location: 'wrld_a:instance-2',
                joinLeavesCount: 3,
                coexistenceTime: 200,
                friendALeave: 200
            },
            {
                location: 'wrld_b:instance-1',
                joinLeavesCount: 4,
                coexistenceTime: 400,
                friendALeave: 400
            }
        ]);

        expect(ranking).toEqual([
            {
                worldId: 'wrld_a',
                latestLocation: 'wrld_a:instance-1',
                visitCount: 5,
                totalCoexistenceTime: 300
            },
            {
                worldId: 'wrld_b',
                latestLocation: 'wrld_b:instance-1',
                visitCount: 4,
                totalCoexistenceTime: 400
            }
        ]);
    });

    test('limits the number of ranked worlds', () => {
        const ranking = buildSharedWorldRanking(
            [
                { location: 'wrld_a:1', joinLeavesCount: 3 },
                { location: 'wrld_b:1', joinLeavesCount: 2 }
            ],
            1
        );

        expect(ranking).toHaveLength(1);
        expect(ranking[0].worldId).toBe('wrld_a');
    });
});
