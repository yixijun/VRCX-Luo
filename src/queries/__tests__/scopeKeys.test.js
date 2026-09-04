import { describe, expect, test } from 'vitest';

import { queryKeys } from '../keys';

describe('query cache scope keys', () => {
    test('keeps stable top-level scopes for collection invalidation', () => {
        expect(queryKeys.favoriteScope()).toEqual(['favorite']);
        expect(queryKeys.friendScope()).toEqual(['friends']);
        expect(queryKeys.inventoryScope()).toEqual(['inventory']);
        expect(queryKeys.galleryScope()).toEqual(['gallery']);
    });

    test('scopes group invalidation to one group while retaining descendants', () => {
        expect(queryKeys.groupScope('grp_1')).toEqual(['group', 'grp_1']);
    });
});
