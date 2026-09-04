import { describe, expect, it } from 'vitest';

import { projectLocalFavoriteEntities } from '../favoriteLocalProjection';

describe('projectLocalFavoriteEntities', () => {
    it('groups entities and preserves legacy reverse insertion order', () => {
        const refs = new Map([
            ['world-1', { id: 'world-1', name: 'First' }],
            ['world-2', { id: 'world-2', name: 'Second' }]
        ]);

        expect(
            projectLocalFavoriteEntities(
                [
                    { worldId: 'world-1', groupName: 'Favorites' },
                    { worldId: 'world-2', groupName: 'Favorites' },
                    { worldId: 'missing', groupName: 'Other' }
                ],
                {
                    idKey: 'worldId',
                    resolveRef: (id) => refs.get(id)
                }
            )
        ).toEqual({
            Favorites: [refs.get('world-2'), refs.get('world-1')],
            Other: [{ id: 'missing' }]
        });
    });

    it('keeps resolved null values instead of replacing them with fallbacks', () => {
        expect(
            projectLocalFavoriteEntities(
                [{ avatarId: 'avatar-1', groupName: 'Favorites' }],
                {
                    idKey: 'avatarId',
                    resolveRef: () => null
                }
            )
        ).toEqual({ Favorites: [null] });
    });

    it('creates the default Favorites group when the database is empty', () => {
        expect(
            projectLocalFavoriteEntities([], {
                idKey: 'worldId',
                resolveRef: () => undefined
            })
        ).toEqual({ Favorites: [] });
    });
});
