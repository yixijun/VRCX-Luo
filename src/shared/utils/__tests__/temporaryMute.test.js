import { describe, expect, it } from 'vitest';

import {
    normalizeSilentUntil,
    resolveTemporaryMuteState
} from '../temporaryMute';

describe('temporary mute state', () => {
    it('normalizes future expiration and enables temporary mute', () => {
        expect(normalizeSilentUntil('1700000123456')).toBe(1700000123456);
        expect(
            resolveTemporaryMuteState({
                enabled: false,
                silentUntil: 2000,
                now: 1000
            })
        ).toEqual({ enabled: true, silentUntil: 2000, expired: false });
    });

    it('expires stale timers without changing persistent mute state', () => {
        expect(
            resolveTemporaryMuteState({
                enabled: true,
                silentUntil: 1000,
                now: 1000
            })
        ).toEqual({ enabled: false, silentUntil: null, expired: true });
        expect(
            resolveTemporaryMuteState({
                enabled: true,
                silentUntil: '',
                now: 1000
            })
        ).toEqual({ enabled: true, silentUntil: null, expired: false });
    });
});
