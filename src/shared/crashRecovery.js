export const CRASH_RECOVERY_POLICY = Object.freeze({
    ASK: 'ask',
    RESTART: 'restart',
    IGNORE: 'ignore'
});

const CRASH_RECOVERY_POLICY_VALUES = new Set([
    CRASH_RECOVERY_POLICY.ASK,
    CRASH_RECOVERY_POLICY.RESTART,
    CRASH_RECOVERY_POLICY.IGNORE
]);

/**
 * Resolves a persisted policy while keeping the legacy boolean setting valid.
 * @param {unknown} configuredPolicy
 * @param {boolean} legacyEnabled
 * @returns {'ask' | 'restart' | 'ignore'}
 */
export function resolveCrashRecoveryPolicy(configuredPolicy, legacyEnabled) {
    if (
        typeof configuredPolicy === 'string' &&
        CRASH_RECOVERY_POLICY_VALUES.has(
            /** @type {'ask' | 'restart' | 'ignore'} */ (configuredPolicy)
        )
    ) {
        return /** @type {'ask' | 'restart' | 'ignore'} */ (configuredPolicy);
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
