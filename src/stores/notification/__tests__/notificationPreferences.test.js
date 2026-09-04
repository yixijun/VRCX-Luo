import { describe, expect, test, vi } from 'vitest';

import {
    createNotificationPreferences,
    filterValidHiddenNotificationIds,
    normalizeHiddenNotificationIds,
    NOTIFICATION_CENTER_HIDDEN_IDS_KEY,
    NOTIFICATION_TABLE_FILTERS_KEY
} from '../notificationPreferences';

describe('notification preferences', () => {
    test('filters invalid IDs without changing load order or multiplicity', () => {
        expect(
            filterValidHiddenNotificationIds([
                'first',
                '',
                'first',
                null,
                'last'
            ])
        ).toEqual(['first', 'first', 'last']);
    });

    test('normalizes valid IDs, removes duplicates and keeps the newest limit', () => {
        expect(
            normalizeHiddenNotificationIds(
                ['old', '', 'middle', 'old', null, 'new'],
                2
            )
        ).toEqual(['middle', 'new']);
    });

    test('loads table filters and sanitized hidden IDs through the repository interface', async () => {
        const configRepository = {
            getString: vi.fn().mockResolvedValue('["invite"]'),
            getArray: vi.fn().mockResolvedValue(['hidden', '', 'hidden', 42]),
            setArray: vi.fn().mockResolvedValue(undefined)
        };
        const preferences = createNotificationPreferences({
            configRepository
        });

        await expect(preferences.load()).resolves.toEqual({
            filterTypes: ['invite'],
            hiddenIds: ['hidden', 'hidden']
        });
        expect(configRepository.getString).toHaveBeenCalledWith(
            NOTIFICATION_TABLE_FILTERS_KEY,
            '[]'
        );
        expect(configRepository.getArray).toHaveBeenCalledWith(
            NOTIFICATION_CENTER_HIDDEN_IDS_KEY,
            []
        );
    });

    test('persists normalized IDs and reports save failures through the injected logger', async () => {
        const warn = vi.fn();
        const error = new Error('disk full');
        const configRepository = {
            getString: vi.fn(),
            getArray: vi.fn(),
            setArray: vi.fn().mockRejectedValue(error)
        };
        const preferences = createNotificationPreferences({
            configRepository,
            warn
        });

        preferences.saveHiddenIds(['one']);
        await Promise.resolve();

        expect(configRepository.setArray).toHaveBeenCalledWith(
            NOTIFICATION_CENTER_HIDDEN_IDS_KEY,
            ['one']
        );
        expect(warn).toHaveBeenCalledWith(
            'Failed to save hidden notification center IDs:',
            error
        );
    });
});
