import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createIpcTimeoutTask } from '../ipcTimeoutTask';

describe('ipcTimeoutTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('disables IPC immediately when the timeout starts at zero', () => {
        const setIpcEnabled = vi.fn();
        const task = createIpcTimeoutTask({ setIpcEnabled });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(1000);
        expect(setIpcEnabled).toHaveBeenCalledWith(false);

        clearInterval(timer);
    });

    test('honors an externally supplied timeout before disabling IPC', () => {
        const setIpcEnabled = vi.fn();
        const task = createIpcTimeoutTask({ setIpcEnabled });
        task.setNext(3);
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(2000);
        expect(setIpcEnabled).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(setIpcEnabled).toHaveBeenCalledWith(false);

        clearInterval(timer);
    });
});
