import { describe, expect, test } from 'vitest';

import { countSharedRoomVisits } from '../twoPersonRelationshipStats';

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
