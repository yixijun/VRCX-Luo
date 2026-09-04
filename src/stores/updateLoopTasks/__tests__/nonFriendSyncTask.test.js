import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    createNonFriendSyncTask,
    NON_FRIEND_REFRESH_SECONDS
} from '../nonFriendSyncTask';

describe('nonFriendSyncTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('refreshes tracked non-friends at the hourly interval', () => {
        const refreshTrackedNonFriends = vi.fn();
        const task = createNonFriendSyncTask({
            refreshTrackedNonFriends,
            interval: 3
        });
        const timer = setInterval(() => task.tick(), 1000);

        vi.advanceTimersByTime(2000);
        expect(refreshTrackedNonFriends).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(refreshTrackedNonFriends).toHaveBeenCalledTimes(1);

        clearInterval(timer);
    });

    test('resets to the full interval explicitly', () => {
        const refreshTrackedNonFriends = vi.fn();
        const task = createNonFriendSyncTask({
            refreshTrackedNonFriends,
            interval: NON_FRIEND_REFRESH_SECONDS
        });

        task.reset();
        for (let index = 0; index < NON_FRIEND_REFRESH_SECONDS - 1; index += 1) {
            task.tick();
        }
        expect(refreshTrackedNonFriends).not.toHaveBeenCalled();

        task.tick();
        expect(refreshTrackedNonFriends).toHaveBeenCalledTimes(1);
    });
});
