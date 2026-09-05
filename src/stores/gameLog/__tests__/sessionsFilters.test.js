import { describe, expect, test } from 'vitest';

import {
    applySessionsSearchFilter,
    clampSessionsDateRange,
    filterSessionsEventsByFilters,
    filterSessionsSegmentsByDateRange,
    isSessionsEventSearchMatch,
    isSessionsGlobalSearchMode,
    isSessionsLocationInDateRange,
    normalizeSessionsSearch,
    toSessionsEpoch
} from '../sessionsFilters.js';

describe('sessions filters', () => {
    test('normalizes a session search value for case-insensitive matching', () => {
        expect(normalizeSessionsSearch('  alice  ')).toBe('ALICE');
    });

    test('recognizes global search only when no date range is active', () => {
        expect(
            isSessionsGlobalSearchMode({ dateRangeActive: false, search: 'Alice' })
        ).toBe(true);
        expect(
            isSessionsGlobalSearchMode({ dateRangeActive: true, search: 'Alice' })
        ).toBe(false);
        expect(
            isSessionsGlobalSearchMode({ dateRangeActive: false, search: '  ' })
        ).toBe(false);
    });

    test('clamps a date range to seven days and preserves reverse input order', () => {
        const [from, to] = clampSessionsDateRange(
            '2025-01-10T00:00:00Z',
            '2025-01-01T00:00:00Z'
        );

        expect(from).toBe('2025-01-08T00:00:00.000Z');
        expect(to).toBe('2025-01-10T00:00:00Z');
        expect(toSessionsEpoch(to) - toSessionsEpoch(from)).toBeLessThanOrEqual(
            7 * 86400000
        );
    });

    test('filters locations inclusively at both date boundaries', () => {
        const options = {
            dateRangeActive: true,
            dateFrom: '2025-01-01T00:00:00Z',
            dateTo: '2025-01-07T00:00:00Z'
        };
        expect(
            isSessionsLocationInDateRange(
                { created_at: '2025-01-01T00:00:00Z' },
                options
            )
        ).toBe(true);
        expect(
            isSessionsLocationInDateRange(
                { created_at: '2025-01-08T00:00:00Z' },
                options
            )
        ).toBe(false);
        expect(
            filterSessionsSegmentsByDateRange(
                [
                    { created_at: '2025-01-01T00:00:00Z' },
                    { created_at: '2025-01-08T00:00:00Z' }
                ],
                options
            )
        ).toEqual([{ created_at: '2025-01-01T00:00:00Z' }]);
    });

    test('applies VIP and event filters in the same order as the store', () => {
        const events = [
            { type: 'OnPlayerJoined', isFavorite: true },
            { type: 'OnPlayerLeft', isFavorite: false },
            { type: 'VideoPlay', isFavorite: false }
        ];

        expect(
            filterSessionsEventsByFilters(events, {
                vipFilter: true,
                eventFilters: ['OnPlayerJoined']
            })
        ).toEqual([events[0]]);
        expect(
            filterSessionsEventsByFilters(events, {
                vipFilter: false,
                eventFilters: []
            })
        ).toBe(events);
    });

    test('matches grouped members and projects matching events to their segment', () => {
        const segment = {
            location: 'wrld_1:1',
            worldName: 'Test World',
            events: [
                {
                    type: 'JoinGroup',
                    members: [
                        { displayName: 'Alice', userId: 'usr_1' },
                        { displayName: 'Bob', userId: 'usr_2' }
                    ]
                },
                { type: 'VideoPlay', videoName: 'Alice clip' }
            ]
        };
        const searchFilter = (event, value) =>
            String(event.videoName ?? '').toUpperCase().includes(value);

        expect(
            isSessionsEventSearchMatch(
                { type: 'JoinGroup', members: [{ displayName: 'Alice' }] },
                'ALICE',
                searchFilter
            )
        ).toBe(true);
        expect(
            applySessionsSearchFilter([segment], {
                search: 'alice',
                searchLimit: 10,
                gameLogSearchFilter: searchFilter
            })
        ).toEqual([
            {
                ...segment,
                events: [
                    {
                        displayName: 'Alice',
                        userId: 'usr_1',
                        type: 'OnPlayerJoined',
                        location: 'wrld_1:1'
                    },
                    { type: 'VideoPlay', videoName: 'Alice clip' }
                ]
            }
        ]);
    });
});
