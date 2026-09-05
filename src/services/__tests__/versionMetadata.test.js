import { describe, expect, it } from 'vitest';

import { createVersionMetadata } from '../../../src-electron/versionMetadata.cjs';

describe('version metadata', () => {
    it('normalizes a stable Version value without changing its public value', () => {
        expect(
            createVersionMetadata(' 2026.08.23\n', {
                fallbackPackageVersion: '2026.01.01'
            })
        ).toEqual({
            sourceVersion: '2026.08.23',
            packageVersion: '2026.08.23',
            isNightly: false
        });
    });

    it('converts timestamped Version values to the package version used by builds', () => {
        expect(
            createVersionMetadata('2026-08-23T12:34:56.000Z', {
                fallbackPackageVersion: '2026.01.01'
            })
        ).toMatchObject({
            sourceVersion: '2026-08-23T12:34:56.000Z',
            packageVersion: '2026.08.23',
            isNightly: false
        });
    });

    it('marks a seven-character suffix as a nightly version', () => {
        expect(
            createVersionMetadata('2026.08.23-abcdefg', {
                fallbackPackageVersion: '2026.01.01'
            })
        ).toEqual({
            sourceVersion: '2026.08.23-abcdefg',
            packageVersion: '2026.08.23-abcdefg',
            isNightly: true
        });
    });

    it('uses the injected fallback for an empty or placeholder Version value', () => {
        expect(
            createVersionMetadata('  ', {
                fallbackPackageVersion: '2026.09.05'
            })
        ).toEqual({
            sourceVersion: '',
            packageVersion: '2026.09.05',
            isNightly: false
        });
        expect(
            createVersionMetadata('Nightly Build', {
                fallbackPackageVersion: '2026.09.05'
            })
        ).toEqual({
            sourceVersion: 'Nightly Build',
            packageVersion: '2026.09.05',
            isNightly: false
        });
    });
});
