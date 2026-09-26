import { describe, expect, test } from 'vitest';

import { getBioEditorSeed, getProfileEditorSeed } from '../profileEditor';

describe('profile editor seed', () => {
    test('keeps the loaded public bio while the editor request is pending', () => {
        const seed = getProfileEditorSeed(
            { id: 'usr_self', bio: '', status: 'active' },
            {
                ref: { bio: 'cached fallback', bioLinks: ['https://example.com'] },
                publicProfileRef: {
                    bio: 'current public profile',
                    bioLinks: ['https://vrchat.com'],
                    bannerType: 'avatarBanner'
                }
            }
        );

        expect(seed.bio).toBe('current public profile');
        expect(seed.bioLinks).toEqual(['https://vrchat.com']);
        expect(seed.bannerType).toBe('avatarBanner');
        expect(seed.status).toBe('active');
    });

    test('falls back to the user resource when no public profile is cached', () => {
        const seed = getProfileEditorSeed({ bio: 'legacy bio', pronouns: 'they/them' });

        expect(seed.bio).toBe('legacy bio');
        expect(seed.pronouns).toBe('they/them');
        expect(seed.bioLinks).toEqual([]);
    });

    test('hydrates the compact bio dialog from the public profile snapshot', () => {
        const seed = getBioEditorSeed(
            { bio: '', bioLinks: [] },
            {
                publicProfileRef: {
                    bio: 'profile bio',
                    bioLinks: ['https://vrchat.com']
                }
            }
        );

        expect(seed).toEqual({
            bio: 'profile bio',
            bioLinks: ['https://vrchat.com']
        });
    });
});
