import { describe, expect, test, vi } from 'vitest';

import {
    applyNotificationToCollection,
    applyNotificationV2ToCollection
} from '../notificationEntityProjection';

function dependencies() {
    return {
        sanitizeNotificationJson: vi.fn((payload) => ({
            ...payload,
            sanitized: true
        })),
        createDefaultNotificationRef: vi.fn((payload) => ({
            ...payload,
            created: 'legacy'
        })),
        createDefaultNotificationV2Ref: vi.fn((payload) => ({
            ...payload,
            created: 'v2'
        })),
        parseNotificationDetails: vi.fn((details) => ({ parsed: details })),
        applyBoopLegacyHandling: vi.fn(),
        endpointDomain: 'api.vrchat.cloud'
    };
}

describe('notification entity projection', () => {
    test('creates and parses a legacy notification through injected dependencies', () => {
        const deps = dependencies();
        const ref = applyNotificationToCollection({
            notifications: [],
            payload: { id: 'legacy_1', details: 'raw' },
            ...deps
        });

        expect(ref).toMatchObject({
            id: 'legacy_1',
            created: 'legacy',
            details: { parsed: 'raw' }
        });
        expect(deps.createDefaultNotificationRef).toHaveBeenCalledWith({
            id: 'legacy_1',
            details: 'raw',
            sanitized: true
        });
    });

    test('updates the last matching legacy notification in place', () => {
        const deps = dependencies();
        const first = { id: 'duplicate', $isExpired: false };
        const last = { id: 'duplicate', $isExpired: true };
        const ref = applyNotificationToCollection({
            notifications: [first, last],
            payload: { id: 'duplicate', details: 'new' },
            ...deps
        });

        expect(ref).toBe(last);
        expect(first).toEqual({ id: 'duplicate', $isExpired: false });
        expect(last).toMatchObject({
            id: 'duplicate',
            $isExpired: false,
            details: { parsed: 'new' },
            sanitized: true
        });
        expect(deps.createDefaultNotificationRef).not.toHaveBeenCalled();
    });

    test('creates a V2 notification, keeps the table timestamp and applies boop handling', () => {
        const deps = dependencies();
        const ref = applyNotificationV2ToCollection({
            notifications: [],
            payload: { id: 'v2_1', createdAt: '2026-09-04T12:00:00Z' },
            ...deps
        });

        expect(ref).toMatchObject({
            id: 'v2_1',
            created: 'v2',
            created_at: '2026-09-04T12:00:00Z'
        });
        expect(deps.applyBoopLegacyHandling).toHaveBeenCalledWith(
            ref,
            'api.vrchat.cloud'
        );
    });

    test('updates an existing V2 notification without replacing its reference', () => {
        const deps = dependencies();
        const existing = { id: 'v2_1', createdAt: 'old' };
        const ref = applyNotificationV2ToCollection({
            notifications: [existing],
            payload: { id: 'v2_1', createdAt: 'new' },
            ...deps
        });

        expect(ref).toBe(existing);
        expect(existing.created_at).toBe('new');
        expect(deps.createDefaultNotificationV2Ref).not.toHaveBeenCalled();
    });
});
