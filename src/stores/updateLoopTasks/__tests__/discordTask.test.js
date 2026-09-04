import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createDiscordTask, DISCORD_UPDATE_SECONDS } from '../discordTask';

describe('discordTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('updates Discord immediately and then at the 3-second interval', () => {
        const updateDiscord = vi.fn();
        const task = createDiscordTask({
            isActive: () => true,
            updateDiscord
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(1000);
        expect(updateDiscord).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime((DISCORD_UPDATE_SECONDS - 1) * 1000);
        expect(updateDiscord).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(updateDiscord).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });

    test('keeps the countdown moving while Discord is inactive', () => {
        const updateDiscord = vi.fn();
        const task = createDiscordTask({
            isActive: () => false,
            updateDiscord,
            interval: 2
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(3000);
        expect(updateDiscord).not.toHaveBeenCalled();

        clearInterval(timer);
    });
});
