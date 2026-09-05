import { describe, expect, it } from 'vitest';

import {
    assertVersionConsistency,
    inspectVersionConsistency
} from '../../../src-electron/versionConsistency.cjs';

describe('version consistency', () => {
    it('accepts package and lock versions derived from Version', () => {
        expect(
            inspectVersionConsistency({
                versionText: '2026.08.23',
                packageVersion: '2026.08.23',
                packageLockVersion: '2026.08.23',
                packageLockRootVersion: '2026.08.23'
            })
        ).toEqual({
            sourceVersion: '2026.08.23',
            expectedPackageVersion: '2026.08.23',
            issues: []
        });
    });

    it('reports every package metadata drift and exposes it through the assertion', () => {
        const result = inspectVersionConsistency({
            versionText: '2026.08.23',
            packageVersion: '2026.03.28',
            packageLockVersion: '2026.03.28',
            packageLockRootVersion: '2026.04.01'
        });

        expect(result.issues).toEqual([
            'package.json version is 2026.03.28; expected 2026.08.23',
            'package-lock.json version is 2026.03.28; expected 2026.08.23',
            'package-lock.json root package version is 2026.04.01; expected 2026.08.23'
        ]);
        expect(() =>
            assertVersionConsistency({
                versionText: '2026.08.23',
                packageVersion: '2026.03.28',
                packageLockVersion: '2026.03.28',
                packageLockRootVersion: '2026.04.01'
            })
        ).toThrow(/Version consistency check failed/iu);
    });
});
