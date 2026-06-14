import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
    clearUserIdentityCache,
    getUserIdentity,
    hasUserIdentityChanged
} from '../useUserIdentityDisplay';

describe('useUserIdentityDisplay', () => {
    beforeEach(() => {
        clearUserIdentityCache();
    });

    test('resolves identity with image resolver and caches unchanged values', () => {
        const imageResolver = vi.fn((user) => user.profilePicOverrideThumbnail);
        const user = {
            id: 'usr_1',
            displayName: 'Alice',
            profilePicOverrideThumbnail: 'https://example.com/profile.png'
        };

        const first = getUserIdentity({ user, imageResolver });
        const second = getUserIdentity({ user, imageResolver });

        expect(first).toBe(second);
        expect(first).toEqual(
            expect.objectContaining({
                id: 'usr_1',
                displayName: 'Alice',
                imageUrl: 'https://example.com/profile.png'
            })
        );
    });

    test('detects display or image changes by signature', () => {
        const before = getUserIdentity({
            user: { id: 'usr_1', displayName: 'Alice' },
            imageUrl: 'old.png'
        });
        const after = getUserIdentity({
            user: { id: 'usr_1', displayName: 'Alice New' },
            imageUrl: 'new.png'
        });

        expect(hasUserIdentityChanged(before, after)).toBe(true);
    });
});
