export const CRASH_RECOVERY_POLICY = Object.freeze({
    ASK: 'ask',
    RESTART: 'restart',
    IGNORE: 'ignore'
});

const CRASH_RECOVERY_POLICY_VALUES = new Set(
    Object.values(CRASH_RECOVERY_POLICY)
);

/**
 * Resolves a persisted policy while keeping the legacy boolean setting valid.
 * @param {unknown} configuredPolicy
 * @param {boolean} legacyEnabled
 * @returns {'ask' | 'restart' | 'ignore'}
 */
export function resolveCrashRecoveryPolicy(configuredPolicy, legacyEnabled) {
    if (CRASH_RECOVERY_POLICY_VALUES.has(configuredPolicy)) {
        return configuredPolicy;
    }
    return legacyEnabled
        ? CRASH_RECOVERY_POLICY.RESTART
        : CRASH_RECOVERY_POLICY.IGNORE;
}

/**
 * Selects the mode-specific crash recovery policy.
 * @param {object} options
 * @param {boolean} options.isGameNoVR
 * @param {'ask' | 'restart' | 'ignore'} options.desktopPolicy
 * @param {'ask' | 'restart' | 'ignore'} options.vrPolicy
 * @returns {'ask' | 'restart' | 'ignore'}
 */
export function getCrashRecoveryPolicy({
    isGameNoVR,
    desktopPolicy,
    vrPolicy
}) {
    return isGameNoVR ? desktopPolicy : vrPolicy;
}
