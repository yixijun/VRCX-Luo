export const TEMPORARY_MUTE_DURATIONS = Object.freeze({
    quarterHour: 15 * 60 * 1000,
    hour: 60 * 60 * 1000
});

export function normalizeSilentUntil(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

/**
 * @param {{ enabled?: boolean, silentUntil?: number|string|null, now?: number }} options
 */
export function resolveTemporaryMuteState(options = {}) {
    const { enabled = false, silentUntil, now = Date.now() } = options;
    const normalizedUntil = normalizeSilentUntil(silentUntil);
    if (normalizedUntil && normalizedUntil <= now) {
        return { enabled: false, silentUntil: null, expired: true };
    }
    if (normalizedUntil) {
        return { enabled: true, silentUntil: normalizedUntil, expired: false };
    }
    return { enabled: Boolean(enabled), silentUntil: null, expired: false };
}
