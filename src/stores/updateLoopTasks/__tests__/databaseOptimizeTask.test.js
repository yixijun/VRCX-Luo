import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createDatabaseOptimizeTask } from '../databaseOptimizeTask';

describe('databaseOptimizeTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('optimizes at the initial interval without blocking the loop', () => {
        const optimize = vi.fn().mockResolvedValue(undefined);
        const task = createDatabaseOptimizeTask({
            optimize,
            onError: vi.fn(),
            initial: 3,
            interval: 2
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(2000);
        expect(optimize).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(optimize).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(optimize).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(optimize).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });

    test('reports rejected optimizations through the injected error handler', async () => {
        const error = new Error('optimize failed');
        const onError = vi.fn();
        const optimize = vi.fn().mockRejectedValue(error);
        const task = createDatabaseOptimizeTask({
            optimize,
            onError,
            initial: 1
        });

        task.tick();
        await vi.runAllTicks();

        expect(onError).toHaveBeenCalledWith(error);
    });
});
