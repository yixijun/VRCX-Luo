import { afterEach, describe, expect, test, vi } from 'vitest';

import { createNowPlayingTicker } from '../gameLog/nowPlayingTicker.js';

describe('createNowPlayingTicker', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    test('advances a playing item on the injected one-second schedule', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:10.000Z'));
        const nowPlaying = {
            startTime: 1735689600,
            length: 30,
            playing: true,
            elapsed: 0,
            percentage: 0,
            remainingText: ''
        };
        const clearNowPlaying = vi.fn();
        const updateView = vi.fn();

        const ticker = createNowPlayingTicker({
            getNowPlaying: () => nowPlaying,
            clearNowPlaying,
            formatSeconds: (seconds) => `${seconds}s`,
            updateView,
            schedule: (callback, delay) => setTimeout(callback, delay)
        });

        ticker.updateNowPlaying();
        expect(nowPlaying).toMatchObject({
            elapsed: 10,
            percentage: 33.3,
            remainingText: '20s'
        });
        expect(updateView).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1000);
        expect(nowPlaying.elapsed).toBe(11);
        expect(updateView).toHaveBeenCalledTimes(2);
    });

    test('does not schedule work when playback is stopped', () => {
        const schedule = vi.fn();
        const updateView = vi.fn();
        const ticker = createNowPlayingTicker({
            getNowPlaying: () => ({ playing: false }),
            clearNowPlaying: vi.fn(),
            formatSeconds: vi.fn(),
            updateView,
            schedule,
            now: () => 1000
        });

        ticker.updateNowPlaying();

        expect(schedule).not.toHaveBeenCalled();
        expect(updateView).not.toHaveBeenCalled();
    });

    test('clears completed playback without scheduling another tick', () => {
        const schedule = vi.fn();
        const clearNowPlaying = vi.fn();
        const updateView = vi.fn();
        const ticker = createNowPlayingTicker({
            getNowPlaying: () => ({
                startTime: 0,
                length: 10,
                playing: true,
                elapsed: 0
            }),
            clearNowPlaying,
            formatSeconds: vi.fn(),
            updateView,
            schedule,
            now: () => 10000
        });

        ticker.updateNowPlaying();

        expect(clearNowPlaying).toHaveBeenCalledTimes(1);
        expect(schedule).not.toHaveBeenCalled();
        expect(updateView).not.toHaveBeenCalled();
    });
});
