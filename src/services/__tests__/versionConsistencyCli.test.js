import { describe, expect, it, vi } from 'vitest';

import { checkVersionConsistency } from '../../../build-scripts/check-version-consistency.js';

describe('version consistency CLI', () => {
    it('reads repository metadata and returns a passing consistency result', () => {
        const files = new Map([
            ['fixture\\Version', '2026.08.23\n'],
            [
                'fixture\\package.json',
                JSON.stringify({ name: 'vrcx-luo', version: '2026.08.23' })
            ],
            [
                'fixture\\package-lock.json',
                JSON.stringify({
                    name: 'vrcx-luo',
                    version: '2026.08.23',
                    packages: {
                        '': { name: 'vrcx-luo', version: '2026.08.23' }
                    }
                })
            ]
        ]);
        const fsModule = {
            readFileSync: vi.fn((filePath) => files.get(filePath))
        };

        expect(
            checkVersionConsistency({ rootDir: 'fixture', fsModule })
        ).toEqual({
            sourceVersion: '2026.08.23',
            expectedPackageVersion: '2026.08.23',
            issues: []
        });
    });

    it('fails with the drift details when package metadata is stale', () => {
        const files = new Map([
            ['fixture\\Version', '2026.08.23\n'],
            [
                'fixture\\package.json',
                JSON.stringify({ name: 'vrcx-luo', version: '2026.03.28' })
            ],
            [
                'fixture\\package-lock.json',
                JSON.stringify({
                    name: 'vrcx-luo',
                    version: '2026.03.28',
                    packages: {
                        '': { name: 'vrcx-luo', version: '2026.03.28' }
                    }
                })
            ]
        ]);
        const fsModule = {
            readFileSync: vi.fn((filePath) => files.get(filePath))
        };

        expect(() =>
            checkVersionConsistency({ rootDir: 'fixture', fsModule })
        ).toThrow(
            /package\.json version is 2026\.03\.28; expected 2026\.08\.23/iu
        );
    });
});
