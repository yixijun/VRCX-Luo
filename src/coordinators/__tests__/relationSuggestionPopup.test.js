import { describe, expect, it, vi } from 'vitest';

import { findRelationSuggestionForUser } from '../relationSuggestionPopup';

const suggestions = [
    {
        userIdA: 'usr_a',
        userIdB: 'usr_b',
        key: 'usr_a|usr_b'
    }
];

describe('findRelationSuggestionForUser', () => {
    it('does not offer a relationship suggestion when popup prompts are disabled', () => {
        const isManualRelation = vi.fn();

        const result = findRelationSuggestionForUser({
            enabled: false,
            userId: 'usr_a',
            suggestions,
            ignoredKeys: new Set(),
            isManualRelation
        });

        expect(result).toBeUndefined();
        expect(isManualRelation).not.toHaveBeenCalled();
    });

    it('offers an eligible suggestion when popup prompts are enabled', () => {
        const result = findRelationSuggestionForUser({
            enabled: true,
            userId: 'usr_b',
            suggestions,
            ignoredKeys: new Set(),
            isManualRelation: () => false
        });

        expect(result).toBe(suggestions[0]);
    });
});
