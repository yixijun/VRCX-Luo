import { describe, expect, it, vi } from 'vitest';

import { updatePackageVersions } from '../../../src-electron/patch-package-version.js';

describe('package version sync', () => {
    it('writes the canonical package version to package.json and package-lock.json', () => {
        const files = new Map([
            ['fixture\\Version', 'Nightly Build\n'],
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
            readFileSync: vi.fn((filePath) => files.get(filePath)),
            writeFileSync: vi.fn((filePath, value) =>
                files.set(filePath, value)
            )
        };

        updatePackageVersions({
            rootDir: 'fixture',
            fsModule,
            now: new Date('2026-09-05T12:00:00.000Z')
        });

        expect(JSON.parse(files.get('fixture\\package.json')).version).toBe(
            '2026.09.05'
        );
        expect(
            JSON.parse(files.get('fixture\\package-lock.json'))
        ).toMatchObject({
            version: '2026.09.05',
            packages: { '': { version: '2026.09.05' } }
        });
    });
});
