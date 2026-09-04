import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    createCurrentUserTask,
    CURRENT_USER_REFRESH_SECONDS
} from '../currentUserTask';

describe('currentUserTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('refreshes only when the 5-minute countdown expires', () => {
        const getCurrentUser = vi.fn();
        const task = createCurrentUserTask({ getCurrentUser });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime((CURRENT_USER_REFRESH_SECONDS - 1) * 1000);
        expect(getCurrentUser).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(getCurrentUser).toHaveBeenCalledTimes(1);

        clearInterval(timer);
    });

    test('resets the countdown after each refresh', () => {
        const getCurrentUser = vi.fn();
        const task = createCurrentUserTask({
            getCurrentUser,
            interval: 2
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(2000);
        expect(getCurrentUser).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(getCurrentUser).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(getCurrentUser).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });
});
