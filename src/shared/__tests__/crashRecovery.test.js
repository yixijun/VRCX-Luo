import { describe, expect, test } from 'vitest';

import {
    CRASH_RECOVERY_POLICY,
    getCrashRecoveryPolicy,
    resolveCrashRecoveryPolicy
} from '../crashRecovery';

describe('crash recovery policy', () => {
    test('keeps valid configured policies and migrates the legacy boolean', () => {
        expect(resolveCrashRecoveryPolicy('ask', true)).toBe(
            CRASH_RECOVERY_POLICY.ASK
        );
        expect(resolveCrashRecoveryPolicy('restart', false)).toBe(
            CRASH_RECOVERY_POLICY.RESTART
        );
        expect(resolveCrashRecoveryPolicy('ignore', true)).toBe(
            CRASH_RECOVERY_POLICY.IGNORE
        );
        expect(resolveCrashRecoveryPolicy(null, true)).toBe(
            CRASH_RECOVERY_POLICY.RESTART
        );
        expect(resolveCrashRecoveryPolicy('unknown', false)).toBe(
            CRASH_RECOVERY_POLICY.IGNORE
        );
    });

    test('selects the policy for desktop and VR modes independently', () => {
        expect(
            getCrashRecoveryPolicy({
                isGameNoVR: true,
                desktopPolicy: CRASH_RECOVERY_POLICY.ASK,
                vrPolicy: CRASH_RECOVERY_POLICY.RESTART
            })
        ).toBe(CRASH_RECOVERY_POLICY.ASK);

        expect(
            getCrashRecoveryPolicy({
                isGameNoVR: false,
                desktopPolicy: CRASH_RECOVERY_POLICY.IGNORE,
                vrPolicy: CRASH_RECOVERY_POLICY.RESTART
            })
        ).toBe(CRASH_RECOVERY_POLICY.RESTART);
    });
});
