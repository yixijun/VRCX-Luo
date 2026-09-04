import { describe, expect, it } from 'vitest';

import { deriveGroupPresenceChanges } from '../groupPresenceDecision';

describe('deriveGroupPresenceChanges', () => {
    it('preserves incoming order and suppresses duplicate joins', () => {
        expect(
            deriveGroupPresenceChanges({
                groups: ['new-a', 'existing', 'new-b', 'new-a'],
                currentGroupIds: ['existing', 'old']
            })
        ).toEqual({
            joinedGroupIds: ['new-a', 'new-b'],
            leftGroupIds: ['old']
        });
    });

    it('preserves current membership order for removals', () => {
        expect(
            deriveGroupPresenceChanges({
                groups: ['kept'],
                currentGroupIds: ['first-left', 'kept', 'second-left']
            })
        ).toEqual({
            joinedGroupIds: [],
            leftGroupIds: ['first-left', 'second-left']
        });
    });

    it('handles an empty incoming membership list', () => {
        expect(
            deriveGroupPresenceChanges({
                groups: [],
                currentGroupIds: ['existing']
            })
        ).toEqual({
            joinedGroupIds: [],
            leftGroupIds: ['existing']
        });
    });
});
