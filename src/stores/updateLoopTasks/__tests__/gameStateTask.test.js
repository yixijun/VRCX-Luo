import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createGameStateTask } from '../gameStateTask';

describe('gameStateTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('reads log lines and updates game state on Linux ticks', async () => {
        const addGameLogEvent = vi.fn();
        const getIsGameRunning = vi.fn().mockResolvedValue(true);
        const getIsSteamVRRunning = vi.fn().mockResolvedValue(false);
        const updateIsGameRunning = vi.fn().mockResolvedValue(undefined);
        const initVr = vi.fn();
        const task = createGameStateTask({
            isLinux: true,
            getLogLines: vi.fn().mockResolvedValue(['joined world', 'left world']),
            addGameLogEvent,
            getIsGameRunning,
            getIsSteamVRRunning,
            updateIsGameRunning,
            initVr
        });
        const timer = setInterval(() => {
            void task.tick();
        }, 1000);

        await vi.advanceTimersByTimeAsync(1000);

        expect(addGameLogEvent).toHaveBeenNthCalledWith(1, 'joined world');
        expect(addGameLogEvent).toHaveBeenNthCalledWith(2, 'left world');
        expect(getIsGameRunning).toHaveBeenCalledTimes(1);
        expect(getIsSteamVRRunning).toHaveBeenCalledTimes(1);
        expect(updateIsGameRunning).toHaveBeenCalledWith(true, false);
        expect(initVr).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1000);
        expect(getIsGameRunning).toHaveBeenCalledTimes(2);
        expect(initVr).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });

    test('does nothing on non-Linux platforms', async () => {
        const getLogLines = vi.fn();
        const getIsGameRunning = vi.fn();
        const task = createGameStateTask({
            isLinux: false,
            getLogLines,
            addGameLogEvent: vi.fn(),
            getIsGameRunning,
            getIsSteamVRRunning: vi.fn(),
            updateIsGameRunning: vi.fn(),
            initVr: vi.fn()
        });
        const timer = setInterval(() => {
            void task.tick();
        }, 1000);

        await vi.advanceTimersByTimeAsync(2000);
        expect(getLogLines).not.toHaveBeenCalled();
        expect(getIsGameRunning).not.toHaveBeenCalled();

        clearInterval(timer);
    });

    test('does not advance game polling when log reading fails', async () => {
        const logError = new Error('log unavailable');
        const getLogLines = vi.fn().mockRejectedValueOnce(logError).mockResolvedValue([]);
        const getIsGameRunning = vi.fn().mockResolvedValue(true);
        const getIsSteamVRRunning = vi.fn().mockResolvedValue(false);
        const task = createGameStateTask({
            isLinux: true,
            getLogLines,
            addGameLogEvent: vi.fn(),
            getIsGameRunning,
            getIsSteamVRRunning,
            updateIsGameRunning: vi.fn().mockResolvedValue(undefined),
            initVr: vi.fn()
        });

        await expect(task.tick()).rejects.toBe(logError);
        await task.tick();

        expect(getIsGameRunning).toHaveBeenCalledTimes(1);
    });
});
