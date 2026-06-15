import { describe, expect, test } from 'vitest';

import { normalizeReleaseVersion } from '../whatsNewReleases';

describe('normalizeReleaseVersion', () => {
    test('normalizes VRCX-Luo app versions', () => {
        expect(normalizeReleaseVersion('VRCX-Luo 2026.6.15')).toBe(
            '2026.06.15'
        );
    });

    test('normalizes GitHub release tags', () => {
        expect(normalizeReleaseVersion('beta-2026.6.15')).toBe('2026.06.15');
    });

    test('normalizes existing VRCX versions', () => {
        expect(normalizeReleaseVersion('VRCX 2026.04.05')).toBe(
            '2026.04.05'
        );
    });
});
