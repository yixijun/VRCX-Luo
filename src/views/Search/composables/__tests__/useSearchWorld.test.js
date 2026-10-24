import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    searchText: require('vue').ref(''),
    cachedConfig: require('vue').ref({ dynamicWorldRows: [] }),
    cachedWorlds: new Map(),
    replaceBioSymbols: vi.fn((text) => text),
    getWorlds: vi.fn()
}));

vi.mock('pinia', () => ({
    storeToRefs: (store) => store
}));

vi.mock('../../../../stores', () => ({
    useSearchStore: () => ({
        searchText: mocks.searchText
    }),
    useAuthStore: () => ({
        cachedConfig: mocks.cachedConfig
    }),
    useWorldStore: () => ({
        cachedWorlds: mocks.cachedWorlds
    })
}));

vi.mock('../../../../shared/utils', () => ({
    replaceBioSymbols: (...args) => mocks.replaceBioSymbols(...args)
}));

vi.mock('../../../../api', () => ({
    worldRequest: {
        getWorlds: (...args) => mocks.getWorlds(...args)
    }
}));

import { useSearchWorld } from '../useSearchWorld';

describe('useSearchWorld', () => {
    beforeEach(() => {
        mocks.searchText.value = '';
        mocks.cachedConfig.value = { dynamicWorldRows: [] };
        mocks.cachedWorlds.clear();
        mocks.replaceBioSymbols.mockReset();
        mocks.replaceBioSymbols.mockImplementation((text) => text);
        mocks.getWorlds.mockReset();
    });

    it('creates relevance params and appends system_approved tag', async () => {
        mocks.searchText.value = 'home world';
        mocks.replaceBioSymbols.mockReturnValue('home world');
        mocks.cachedWorlds.set('wrld_1', { id: 'wrld_1', name: 'World One' });
        mocks.getWorlds.mockResolvedValue({
            json: [{ id: 'wrld_1' }, { id: 'wrld_missing' }]
        });

        const api = useSearchWorld();
        api.searchWorld({});
        await Promise.resolve();
        await Promise.resolve();

        expect(mocks.getWorlds).toHaveBeenCalledWith(
            {
                n: 10,
                offset: 0,
                sort: 'relevance',
                search: 'home world',
                order: 'descending',
                tag: 'system_approved'
            },
            ''
        );
        expect(api.searchWorldParams.value.search).toBe('home world');
    });

    it('selects category row and uses row sort settings', async () => {
        mocks.cachedConfig.value = {
            dynamicWorldRows: [
                {
                    index: 2,
                    sortHeading: 'featured',
                    sortOrder: 'ascending',
                    tag: 'party'
                }
            ]
        };
        mocks.getWorlds.mockResolvedValue({ json: [] });

        const api = useSearchWorld();
        api.handleSearchWorldCategorySelect(2);
        await Promise.resolve();
        await Promise.resolve();

        expect(api.searchWorldCategoryIndex.value).toBe(2);
        expect(mocks.getWorlds).toHaveBeenCalledWith(
            {
                n: 10,
                offset: 0,
                sort: 'order',
                featured: 'true',
                order: 'ascending',
                tag: 'party',
                notag: 'system_labs'
            },
            ''
        );
    });

    it('normalizes custom tags without broadening them to all approved worlds', async () => {
        mocks.searchText.value = 'night';
        mocks.getWorlds.mockResolvedValue({ json: [] });
        const api = useSearchWorld();
        api.searchWorldTags.value =
            ' Game，author_tag_GAME, chill、content_horror ';
        await api.applyWorldTagSearch();
        expect(mocks.getWorlds).toHaveBeenLastCalledWith(
            expect.objectContaining({
                search: 'night',
                tag: 'author_tag_game,author_tag_chill,content_horror',
                notag: 'system_labs',
                offset: 0
            }),
            ''
        );
        expect(api.searchWorldParams.value.tag).not.toContain(
            'system_approved'
        );
    });

    it('can search by tags alone, include labs, and keep tags on the next page', async () => {
        mocks.getWorlds.mockResolvedValue({
            json: Array.from({ length: 10 }, (_, id) => ({ id: `wrld_${id}` }))
        });
        const api = useSearchWorld();
        api.searchWorldTags.value = 'sleep';
        api.searchWorldLabs.value = true;
        await api.applyWorldTagSearch();
        expect(api.searchWorldParams.value.search).toBe('');
        expect(api.searchWorldParams.value).not.toHaveProperty('notag');
        await api.moreSearchWorld(1);
        expect(mocks.getWorlds).toHaveBeenLastCalledWith(
            expect.objectContaining({ offset: 10, tag: 'author_tag_sleep' }),
            ''
        );
    });

    it('resets tag input for category browsing and clears all filters on clear', async () => {
        mocks.cachedConfig.value = {
            dynamicWorldRows: [
                { index: 2, sortHeading: 'labs', tag: 'system_labs' }
            ]
        };
        mocks.getWorlds.mockResolvedValue({ json: [] });
        const api = useSearchWorld();
        api.searchWorldTags.value = 'game';
        api.handleSearchWorldCategorySelect(2);
        expect(api.searchWorldTags.value).toBe('');
        expect(api.searchWorldLabs.value).toBe(true);
        expect(api.searchWorldParams.value.tag).toBe('system_labs');
        expect(api.searchWorldParams.value).not.toHaveProperty('notag');
        api.searchWorldTags.value = 'chill';
        await api.applyWorldTagSearch();
        expect(api.searchWorldCategoryIndex.value).toBe(null);
        api.clearWorldSearch();
        expect(api.searchWorldTags.value).toBe('');
        expect(api.searchWorldResults.value).toEqual([]);
    });

    it('ignores results from an older tag search after switching tags', async () => {
        let resolveOld;
        mocks.getWorlds.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveOld = resolve;
                })
        );
        mocks.getWorlds.mockResolvedValueOnce({ json: [{ id: 'wrld_new' }] });
        mocks.cachedWorlds.set('wrld_old', { id: 'wrld_old' });
        mocks.cachedWorlds.set('wrld_new', { id: 'wrld_new' });
        const api = useSearchWorld();
        api.searchWorldTags.value = 'game';
        const old = api.applyWorldTagSearch();
        api.searchWorldTags.value = 'chill';
        await api.applyWorldTagSearch();
        resolveOld({ json: [{ id: 'wrld_old' }] });
        await old;
        expect(api.searchWorldResults.value.map((world) => world.id)).toEqual([
            'wrld_new'
        ]);
        expect(api.searchWorldParams.value.tag).toBe('author_tag_chill');
    });
});
