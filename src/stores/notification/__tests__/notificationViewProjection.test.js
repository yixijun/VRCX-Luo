import { describe, expect, test } from 'vitest';

import {
    filterNotificationsByCategory,
    filterRecentNotifications,
    filterUnseenNotifications
} from '../notificationViewProjection';

const cutoff = Date.parse('2026-09-03T12:00:00Z');

function notification(overrides = {}) {
    return {
        id: 'not_1',
        type: 'invite',
        created_at: '2026-09-04T11:00:00Z',
        seen: false,
        ...overrides
    };
}

describe('notification view projection', () => {
    test('groups notifications by category while preserving source order', () => {
        const notifications = [
            notification({ id: 'group', type: 'group.invite' }),
            notification({ id: 'friend', type: 'friendRequest' }),
            notification({ id: 'other', type: 'Event' }),
            notification({ id: 'group-2', type: 'groupChange' })
        ];

        expect(
            filterNotificationsByCategory(notifications, 'group').map(
                (item) => item.id
            )
        ).toEqual(['group', 'group-2']);
    });

    test('keeps only unseen notifications that are not hidden', () => {
        const notifications = [
            notification({ id: 'visible' }),
            notification({ id: 'seen', seen: true }),
            notification({ id: 'hidden' })
        ];

        expect(
            filterUnseenNotifications(
                notifications,
                new Set(['visible', 'hidden']),
                new Set(['hidden'])
            ).map((item) => item.id)
        ).toEqual(['visible']);
    });

    test('keeps recent seen notifications strictly after the cutoff', () => {
        const notifications = [
            notification({
                id: 'recent',
                created_at: '2026-09-04T11:00:00Z',
                seen: true
            }),
            notification({
                id: 'at-cutoff',
                created_at: '2026-09-03T12:00:00Z',
                seen: true
            }),
            notification({
                id: 'unseen',
                created_at: '2026-09-04T11:30:00Z',
                seen: false
            }),
            notification({
                id: 'hidden',
                created_at: '2026-09-04T11:45:00Z',
                seen: true
            })
        ];

        expect(
            filterRecentNotifications(
                notifications,
                new Set(['unseen']),
                new Set(['hidden']),
                cutoff
            ).map((item) => item.id)
        ).toEqual(['recent']);
    });
});
