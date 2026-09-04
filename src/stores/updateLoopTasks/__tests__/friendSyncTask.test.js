import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    createFriendSyncTask,
    FRIENDS_REFRESH_SECONDS
} from '../friendSyncTask';

describe('friendSyncTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('refreshes friends and moderations when the hourly countdown expires', () => {
        const refreshFriends = vi.fn();
        const currentUser = {
            last_activity: '2026-03-23T00:59:30.000Z'
        };
        const getCurrentUser = vi.fn(() => currentUser);
        const updateStoredUser = vi.fn();
        const refreshPlayerModerations = vi.fn();
        const task = createFriendSyncTask({
            refreshFriends,
            getCurrentUser,
            updateStoredUser,
            refreshPlayerModerations,
            now: () => Date.parse('2026-03-23T01:00:00.000Z'),
            interval: 3
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(2000);
        expect(refreshFriends).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(refreshFriends).toHaveBeenCalledTimes(1);
        expect(updateStoredUser).toHaveBeenCalledWith(currentUser);
        expect(refreshPlayerModerations).toHaveBeenCalledTimes(1);

        clearInterval(timer);
    });

    test('does not refresh moderations for an inactive user', () => {
        const refreshPlayerModerations = vi.fn();
        const task = createFriendSyncTask({
            refreshFriends: vi.fn(),
            getCurrentUser: () => ({
                last_activity: new Date(
                    Date.parse('2026-03-21T00:00:00.000Z')
                ).toISOString()
            }),
            updateStoredUser: vi.fn(),
            refreshPlayerModerations,
            now: () => Date.parse('2026-03-23T01:00:00.000Z'),
            interval: FRIENDS_REFRESH_SECONDS
        });

        for (let index = 0; index < FRIENDS_REFRESH_SECONDS - 1; index += 1) {
            task.tick();
        }
        expect(refreshPlayerModerations).not.toHaveBeenCalled();

        task.tick();
        expect(refreshPlayerModerations).not.toHaveBeenCalled();
    });
});
