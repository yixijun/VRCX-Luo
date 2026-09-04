import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    APP_UPDATE_CHECK_SECONDS,
    createUpdateCheckTask
} from '../updateCheckTask';

describe('updateCheckTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('checks for updates and backs up at the hourly interval', () => {
        const checkForVRCXUpdate = vi.fn();
        const tryAutoBackupVrcRegistry = vi.fn();
        const task = createUpdateCheckTask({
            getAutoUpdateMode: () => 'Stable',
            checkForVRCXUpdate,
            tryAutoBackupVrcRegistry,
            interval: 3
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(2000);
        expect(checkForVRCXUpdate).not.toHaveBeenCalled();
        expect(tryAutoBackupVrcRegistry).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(checkForVRCXUpdate).toHaveBeenCalledTimes(1);
        expect(tryAutoBackupVrcRegistry).toHaveBeenCalledTimes(1);

        clearInterval(timer);
    });

    test('always backs up but skips update checks when mode is Off', () => {
        const checkForVRCXUpdate = vi.fn();
        const tryAutoBackupVrcRegistry = vi.fn();
        const task = createUpdateCheckTask({
            getAutoUpdateMode: () => 'Off',
            checkForVRCXUpdate,
            tryAutoBackupVrcRegistry,
            interval: APP_UPDATE_CHECK_SECONDS
        });

        for (let index = 0; index < APP_UPDATE_CHECK_SECONDS; index += 1) {
            task.tick();
        }

        expect(checkForVRCXUpdate).not.toHaveBeenCalled();
        expect(tryAutoBackupVrcRegistry).toHaveBeenCalledTimes(1);
    });
});
