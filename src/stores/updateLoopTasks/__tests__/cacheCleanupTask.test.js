import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createCacheCleanupTask } from '../cacheCleanupTask';

describe('cacheCleanupTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('clears the cache and uses half the configured frequency', () => {
        const clearCache = vi.fn();
        const task = createCacheCleanupTask({
            getFrequency: () => 4,
            clearCache,
            initial: 3
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(2000);
        expect(clearCache).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(clearCache).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(clearCache).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(clearCache).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });

    test('clears on the next tick when a disabled frequency is enabled', () => {
        let frequency = 0;
        const clearCache = vi.fn();
        const task = createCacheCleanupTask({
            getFrequency: () => frequency,
            clearCache,
            initial: 1
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(1000);
        expect(clearCache).not.toHaveBeenCalled();

        frequency = 2;
        vi.advanceTimersByTime(1000);
        expect(clearCache).toHaveBeenCalledTimes(1);

        clearInterval(timer);
    });
});
