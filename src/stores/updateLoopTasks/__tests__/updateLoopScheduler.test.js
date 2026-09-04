import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createUpdateLoopScheduler } from '../updateLoopScheduler';

describe('updateLoopScheduler', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('runs registered tasks in order and schedules the next cycle', async () => {
        const calls = [];
        const tasks = [
            {
                tick: vi.fn(async () => {
                    calls.push('current');
                })
            },
            {
                tick: vi.fn(() => {
                    calls.push('friend');
                })
            }
        ];
        const scheduler = createUpdateLoopScheduler({
            tasks,
            isLoggedIn: () => true,
            onError: vi.fn(),
            setTimeout,
            clearTimeout
        });

        await scheduler.start();
        expect(calls).toEqual(['current', 'friend']);

        await vi.advanceTimersByTimeAsync(1000);
        expect(tasks[0].tick).toHaveBeenCalledTimes(2);
        expect(tasks[1].tick).toHaveBeenCalledTimes(2);

        scheduler.stop();
    });

    test('keeps the timer alive while logged out but skips tasks', async () => {
        const task = { tick: vi.fn() };
        const scheduler = createUpdateLoopScheduler({
            tasks: [task],
            isLoggedIn: () => false,
            onError: vi.fn(),
            setTimeout,
            clearTimeout
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(2000);
        expect(task.tick).not.toHaveBeenCalled();

        scheduler.stop();
        await vi.advanceTimersByTimeAsync(2000);
        expect(task.tick).not.toHaveBeenCalled();
    });

    test('forwards task errors and continues scheduling', async () => {
        const error = new Error('task failed');
        const onError = vi.fn();
        const task = { tick: vi.fn().mockRejectedValue(error) };
        const scheduler = createUpdateLoopScheduler({
            tasks: [task],
            isLoggedIn: () => true,
            onError,
            setTimeout,
            clearTimeout
        });

        await scheduler.start();
        expect(onError).toHaveBeenCalledWith(error);

        await vi.advanceTimersByTimeAsync(1000);
        expect(task.tick).toHaveBeenCalledTimes(2);

        scheduler.stop();
    });
});
