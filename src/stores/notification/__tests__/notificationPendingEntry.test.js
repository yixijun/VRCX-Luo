import { describe, expect, test } from 'vitest';

import { appendPendingNotification } from '../notificationPendingEntry';

describe('appendPendingNotification', () => {
    test('adds a local notification to the unseen queue and generates an id', () => {
        const collection = [];
        const unseenIds = [];
        const entry = {
            type: 'instance.closed',
            location: 'wrld_demo:1234',
            created_at: '2026-09-10T10:00:00.000Z'
        };

        const appended = appendPendingNotification({
            collection,
            unseenIds,
            entry,
            now: Date.parse('2026-09-10T10:00:00.000Z')
        });

        expect(appended).toBe(entry);
        expect(entry.id).toBe(
            'local:instance.closed:2026-09-10T10%3A00%3A00.000Z:wrld_demo%3A1234'
        );
        expect(collection).toEqual([entry]);
        expect(unseenIds).toEqual([entry.id]);
    });

    test('does not mark seen or hidden entries as pending', () => {
        const collection = [];
        const unseenIds = [];
        const hiddenIds = ['queue-1'];

        appendPendingNotification({
            collection,
            unseenIds,
            hiddenIds,
            entry: { id: 'queue-1', type: 'group.queueReady', seen: false },
            now: Date.parse('2026-09-10T10:00:00.000Z')
        });
        appendPendingNotification({
            collection,
            unseenIds,
            hiddenIds,
            entry: { id: 'seen-1', type: 'instance.closed', seen: true },
            now: Date.parse('2026-09-10T10:00:00.000Z')
        });

        expect(unseenIds).toEqual([]);
        expect(collection).toHaveLength(2);
    });

    test('keeps generated ids unique when local events share the same key', () => {
        const collection = [];
        const unseenIds = [];
        const entry = {
            type: 'group.queueReady',
            location: 'grp_demo',
            created_at: '2026-09-10T10:00:00.000Z'
        };

        const first = appendPendingNotification({
            collection,
            unseenIds,
            entry: { ...entry },
            now: Date.parse(entry.created_at)
        });
        const second = appendPendingNotification({
            collection,
            unseenIds,
            entry: { ...entry },
            now: Date.parse(entry.created_at)
        });

        expect(first.id).not.toBe(second.id);
        expect(unseenIds).toEqual([first.id, second.id]);
    });
});
