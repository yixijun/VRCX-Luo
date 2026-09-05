import { describe, expect, it } from 'vitest';

import {
    assertLocalizationContract,
    inspectLocalizationResources
} from '../../../build-scripts/localizationContract.cjs';

const createResource = (fileName, value) => ({ fileName, value });

describe('localization contract', () => {
    it('uses en.json as the canonical key set and reports fallback drift', () => {
        const result = inspectLocalizationResources({
            resources: [
                createResource('en.json', {
                    language: 'English (en)',
                    translator: 'VRCX',
                    common: { ok: 'OK', cancel: 'Cancel' }
                }),
                createResource('ja.json', {
                    language: '日本語 (ja)',
                    translator: 'VRCX',
                    common: { ok: 'はい' }
                })
            ],
            supportedCodes: ['en', 'ja']
        });

        expect(result.errors).toEqual([]);
        expect(result.canonicalKeyCount).toBe(2);
        expect(result.keyDrift).toEqual([
            { fileName: 'ja.json', missing: ['common.cancel'], extra: [] }
        ]);
        expect(assertLocalizationContract(result)).toBe(result);
    });

    it('rejects malformed resources, metadata, and non-string leaves', () => {
        const result = inspectLocalizationResources({
            resources: [
                createResource('en.json', {
                    language: 'English (en)',
                    translator: 'VRCX',
                    common: { ok: 'OK' }
                }),
                createResource('ja.json', {
                    language: '',
                    translator: 'VRCX',
                    common: { ok: ['はい'] }
                }),
                { fileName: 'ko.json', parseError: 'unexpected token' }
            ],
            supportedCodes: ['en', 'ja', 'ko']
        });

        expect(result.errors).toEqual([
            'ja.json: language must be a non-empty string',
            'ja.json: translation leaf common.ok must be a string (got array)',
            'ko.json: invalid JSON (unexpected token)'
        ]);
        expect(() => assertLocalizationContract(result)).toThrow(
            /Localization contract check failed/iu
        );
    });

    it('can opt into strict key-drift failure without changing fallback mode', () => {
        const result = inspectLocalizationResources({
            resources: [
                createResource('en.json', {
                    language: 'English (en)',
                    translator: 'VRCX',
                    common: { ok: 'OK' }
                }),
                createResource('ja.json', {
                    language: '日本語 (ja)',
                    translator: 'VRCX',
                    common: { stale: '古い' }
                })
            ]
        });

        expect(() => assertLocalizationContract(result, { failOnKeyDrift: true })).toThrow(
            /ja\.json: missing 1 canonical translation keys/iu
        );
        expect(assertLocalizationContract(result)).toBe(result);
    });
});
