import { describe, expect, it } from 'vitest';

import {
    filterWorldFavoriteEntries,
    normalizeWorldFavoriteSearch
} from '../worldFavoriteSearch.js';

const entries = [
    {
        id: 'bar',
        name: '酒吧夜景',
        authorName: 'Alice',
        tags: ['author_tag_social']
    },
    {
        id: 'rain',
        name: 'Rainy Room',
        authorName: '雨作者',
        tags: ['author_tag_chill']
    },
    { id: 'dance', name: '舞厅', authorName: 'Bob', tags: ['author_tag_dance'] }
];

describe('world favorite search', () => {
    it('normalizes whitespace and keeps one-character Chinese queries active', () => {
        expect(normalizeWorldFavoriteSearch('  雨  ')).toBe('雨');
        expect(normalizeWorldFavoriteSearch('')).toBe('');
    });

    it('matches short Chinese queries by world name and author', () => {
        expect(
            filterWorldFavoriteEntries(entries, '酒吧').map((entry) => entry.id)
        ).toEqual(['bar']);
        expect(
            filterWorldFavoriteEntries(entries, '雨').map((entry) => entry.id)
        ).toEqual(['rain']);
    });

    it('matches short queries in tag mode and clears for blank input', () => {
        expect(
            filterWorldFavoriteEntries(entries, 'd', 'tag').map(
                (entry) => entry.id
            )
        ).toEqual(['dance']);
        expect(filterWorldFavoriteEntries(entries, '  ', 'tag')).toEqual([]);
    });
});
