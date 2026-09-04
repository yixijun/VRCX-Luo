import { describe, expect, test, vi } from 'vitest';

import { createNotificationSeenQueue } from '../notificationSeenQueue';

function flushQueue() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createQueue(overrides = {}) {
    const calls = [];
    const dependencies = {
        executeWithBackoff: vi.fn(async (operation) => operation()),
        seeNotificationV2: vi.fn(async ({ notificationId }) => ({
            json: { notificationId }
        })),
        seeNotification: vi.fn(async ({ notificationId }) => {
            calls.push(['legacy-request', notificationId]);
        }),
        onV2Seen: vi.fn((args) =>
            calls.push(['v2-seen', args.params.notificationId])
        ),
        onLegacySeen: vi.fn((id) => calls.push(['legacy-seen', id])),
        onV2Failure: vi.fn((id) => calls.push(['v2-failure', id])),
        warn: vi.fn(),
        ...overrides
    };
    return {
        calls,
        dependencies,
        queue: createNotificationSeenQueue(dependencies)
    };
}

describe('notification seen queue', () => {
    test('deduplicates IDs and serializes legacy and V2 requests', async () => {
        const { calls, dependencies, queue } = createQueue();

        queue.enqueue('legacy_1');
        queue.enqueue('legacy_1', 2);
        queue.enqueue('v2_1', 2);
        await flushQueue();

        expect(dependencies.seeNotification).toHaveBeenCalledTimes(1);
        expect(dependencies.seeNotificationV2).toHaveBeenCalledTimes(1);
        expect(calls).toEqual([
            ['legacy-request', 'legacy_1'],
            ['legacy-seen', 'legacy_1'],
            ['v2-seen', 'v2_1']
        ]);
    });

    test('keeps the original retry policy and allows 429 errors to retry', async () => {
        const executeWithBackoff = vi.fn(async (operation, options) => {
            expect(options.maxRetries).toBe(3);
            expect(options.baseDelay).toBe(1000);
            expect(options.shouldRetry({ status: 429 })).toBe(true);
            expect(options.shouldRetry({ message: 'HTTP 429' })).toBe(true);
            expect(options.shouldRetry({ status: 500 })).toBe(false);
            return operation();
        });
        const { dependencies, queue } = createQueue({ executeWithBackoff });

        queue.enqueue('legacy_1');
        await flushQueue();

        expect(executeWithBackoff).toHaveBeenCalledTimes(1);
        expect(dependencies.seeNotification).toHaveBeenCalledTimes(1);
    });

    test('hides V2 notifications after a failed request and logs the failure', async () => {
        const error = new Error('network down');
        const executeWithBackoff = vi.fn(async () => {
            throw error;
        });
        const { dependencies, queue } = createQueue({ executeWithBackoff });

        queue.enqueue('v2_1', 2);
        await flushQueue();

        expect(dependencies.warn).toHaveBeenCalledWith(
            'Failed to mark notification as seen:',
            'v2_1'
        );
        expect(dependencies.onV2Failure).toHaveBeenCalledWith('v2_1');
        expect(dependencies.onLegacySeen).not.toHaveBeenCalled();
    });

    test('does not start a second processor while the first one is active', async () => {
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        const executeWithBackoff = vi.fn(async (operation) => {
            await gate;
            return operation();
        });
        const { dependencies, queue } = createQueue({ executeWithBackoff });

        queue.enqueue('first');
        queue.enqueue('second');
        await Promise.resolve();
        expect(executeWithBackoff).toHaveBeenCalledTimes(1);

        release();
        await flushQueue();
        expect(executeWithBackoff).toHaveBeenCalledTimes(2);
        expect(dependencies.seeNotification).toHaveBeenCalledWith({
            notificationId: 'second'
        });
    });
});
