import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    createGroupInstanceTask,
    GROUP_INSTANCE_REFRESH_SECONDS
} from '../groupInstanceTask';

describe('groupInstanceTask', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('refreshes Group instances after friends are loaded', async () => {
        const getUsersGroupInstances = vi
            .fn()
            .mockResolvedValue({ groupA: ['usr_1'] });
        const handleGroupUserInstances = vi.fn();
        const checkGameRunning = vi.fn();
        const task = createGroupInstanceTask({
            isFriendsLoaded: () => true,
            getUsersGroupInstances,
            handleGroupUserInstances,
            checkGameRunning,
            interval: 2
        });
        const timer = setInterval(() => {
            void task.tick();
        }, 1000);

        await vi.advanceTimersByTimeAsync(1000);
        expect(getUsersGroupInstances).toHaveBeenCalledTimes(1);
        expect(handleGroupUserInstances).toHaveBeenCalledWith({
            groupA: ['usr_1']
        });
        expect(checkGameRunning).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1000);
        expect(getUsersGroupInstances).toHaveBeenCalledTimes(1);
        expect(checkGameRunning).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1000);
        expect(getUsersGroupInstances).toHaveBeenCalledTimes(2);
        expect(checkGameRunning).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });

    test('keeps checking the game while friends are not loaded', async () => {
        const getUsersGroupInstances = vi.fn();
        const checkGameRunning = vi.fn();
        const task = createGroupInstanceTask({
            isFriendsLoaded: () => false,
            getUsersGroupInstances,
            handleGroupUserInstances: vi.fn(),
            checkGameRunning,
            interval: GROUP_INSTANCE_REFRESH_SECONDS
        });
        const timer = setInterval(() => {
            void task.tick();
        }, 1000);

        await vi.advanceTimersByTimeAsync(2000);
        expect(getUsersGroupInstances).not.toHaveBeenCalled();
        expect(checkGameRunning).toHaveBeenCalledTimes(2);

        clearInterval(timer);
    });
});
