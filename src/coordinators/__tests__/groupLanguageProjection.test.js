import { describe, expect, it } from 'vitest';

import { createGroupLanguageEntries } from '../groupLanguageProjection';

describe('createGroupLanguageEntries', () => {
    it('preserves source order and skips unknown language ids', () => {
        expect(
            createGroupLanguageEntries({
                languages: ['en', 'missing', 'ja'],
                subsetOfLanguages: {
                    en: 'English',
                    ja: '日本語'
                }
            })
        ).toEqual([
            { key: 'en', value: 'English' },
            { key: 'ja', value: '日本語' }
        ]);
    });

    it('keeps empty and false-y localized values', () => {
        expect(
            createGroupLanguageEntries({
                languages: ['empty', 'false', 'zero'],
                subsetOfLanguages: {
                    empty: '',
                    false: false,
                    zero: 0
                }
            })
        ).toEqual([
            { key: 'empty', value: '' },
            { key: 'false', value: false },
            { key: 'zero', value: 0 }
        ]);
    });

    it('returns an empty projection when languages are absent', () => {
        expect(
            createGroupLanguageEntries({
                languages: undefined,
                subsetOfLanguages: {}
            })
        ).toEqual([]);
    });
});
