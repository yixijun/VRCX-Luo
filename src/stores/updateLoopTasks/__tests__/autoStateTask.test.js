import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    AUTO_STATE_CHANGE_SECONDS,
    createAutoStateTask
} from '../autoStateTask';

describe('autoStateTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('updates automatic state immediately and at the 3-second interval', () => {
        const updateAutoStateChange = vi.fn();
        const task = createAutoStateTask({
            updateAutoStateChange
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(1000);
        expect(updateAutoStateChange).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime((AUTO_STATE_CHANGE_SECONDS - 1) * 1000);
        expect(updateAutoStateChange).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(updateAutoStateChange).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });

    test('supports a shorter injected interval without changing the task API', () => {
        const updateAutoStateChange = vi.fn();
        const task = createAutoStateTask({
            updateAutoStateChange,
            interval: 2
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(3000);
        expect(updateAutoStateChange).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });
});
