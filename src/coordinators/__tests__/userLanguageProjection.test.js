import { describe, expect, it } from 'vitest';

import { createUserLanguageEntries } from '../userLanguageProjection';

describe('createUserLanguageEntries', () => {
    it('preserves configured key order and values', () => {
        expect(
            createUserLanguageEntries({
                eng: 'English',
                jpn: '日本語',
                empty: ''
            })
        ).toEqual([
            { key: 'eng', value: 'English' },
            { key: 'jpn', value: '日本語' },
            { key: 'empty', value: '' }
        ]);
    });

    it('keeps enumerable inherited language keys like the legacy loop', () => {
        const prototype = { inherited: 'Inherited' };
        const languages = Object.create(prototype);
        languages.own = 'Own';

        expect(createUserLanguageEntries(languages)).toEqual([
            { key: 'own', value: 'Own' },
            { key: 'inherited', value: 'Inherited' }
        ]);
    });

    it('returns an empty list for an absent language map', () => {
        expect(createUserLanguageEntries(undefined)).toEqual([]);
        expect(createUserLanguageEntries(null)).toEqual([]);
    });
});
