import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    STEAMVR_START_STATUS,
    waitForSteamVRRunning
} from '../steamvrStartup.js';

describe('waitForSteamVRRunning', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('detects SteamVR after a delayed poll instead of trusting the start command', async () => {
        vi.useFakeTimers();
        let running = false;
        const statuses = [];
        const checkRunning = vi.fn(async () => running);
        const wait = waitForSteamVRRunning({
            checkRunning,
            timeoutMs: 10_000,
            pollIntervalMs: 1_000,
            onStatus: (status) => statuses.push(status)
        });

        await vi.advanceTimersByTimeAsync(7_999);
        expect(checkRunning).toHaveBeenCalled();
        expect(
            await Promise.race([wait.promise, Promise.resolve(null)])
        ).toBeNull();

        running = true;
        await vi.advanceTimersByTimeAsync(1_000);

        await expect(wait.promise).resolves.toMatchObject({
            status: STEAMVR_START_STATUS.RUNNING,
            running: true
        });
        expect(statuses).toEqual([
            STEAMVR_START_STATUS.STARTING,
            STEAMVR_START_STATUS.RUNNING
        ]);
    });

    it('returns a timeout when SteamVR never becomes detectable', async () => {
        vi.useFakeTimers();
        const wait = waitForSteamVRRunning({
            checkRunning: async () => false,
            timeoutMs: 3_000,
            pollIntervalMs: 1_000
        });

        await vi.advanceTimersByTimeAsync(3_000);

        await expect(wait.promise).resolves.toMatchObject({
            status: STEAMVR_START_STATUS.TIMEOUT,
            running: false
        });
    });

    it('does not turn detection errors into a successful start and supports cancellation', async () => {
        const errorWait = waitForSteamVRRunning({
            checkRunning: async () => {
                throw new Error('probe failed');
            }
        });
        await expect(errorWait.promise).resolves.toMatchObject({
            status: STEAMVR_START_STATUS.ERROR,
            running: false
        });

        const cancelWait = waitForSteamVRRunning({
            checkRunning: async () => false,
            timeoutMs: 10_000
        });
        cancelWait.cancel();
        await expect(cancelWait.promise).resolves.toMatchObject({
            status: STEAMVR_START_STATUS.CANCELLED,
            running: false
        });
    });
});
