import { describe, expect, test } from 'vitest';
import {
    buildDailySummary,
    buildSessionsFromGamelog
} from '../activityEngine.js';

describe('daily playtime', () => {
    test('splits at local midnight instead of UTC midnight', () => {
        const start = new Date(2026, 9, 1, 23).getTime();
        const end = new Date(2026, 9, 2, 1).getTime();
        expect(buildDailySummary([{ start, end }], start, end)).toEqual([
            { date: '2026-10-01', totalMs: 3600000 },
            { date: '2026-10-02', totalMs: 3600000 }
        ]);
    });

    test('preserves a recorded twelve-hour session', () => {
        const start = new Date(2026, 9, 1, 10).getTime();
        const end = start + 12 * 3600000;
        expect(buildDailySummary([{ start, end }], start, end)).toEqual([
            { date: '2026-10-01', totalMs: 12 * 3600000 }
        ]);
    });

    test('counts overlapping and duplicate sessions once, regardless of order', () => {
        const start = new Date(2026, 9, 1, 10).getTime();
        const end = start + 4 * 3600000;
        expect(
            buildDailySummary(
                [
                    { start: start + 3600000, end },
                    { start, end: start + 2 * 3600000 },
                    { start, end: start + 2 * 3600000 }
                ],
                start,
                end
            )
        ).toEqual([{ date: '2026-10-01', totalMs: 4 * 3600000 }]);
    });

    test('includes zero-playtime dates in the daily average', () => {
        const start = new Date(2026, 9, 1).getTime();
        const end = new Date(2026, 9, 4).getTime();
        expect(
            buildDailySummary([{ start, end: start + 3600000 }], start, end)
        ).toEqual([
            { date: '2026-10-01', totalMs: 3600000 },
            { date: '2026-10-02', totalMs: 0 },
            { date: '2026-10-03', totalMs: 0 }
        ]);
    });

    test('clips sessions to the selected range without changing the input', () => {
        const start = new Date(2026, 9, 1, 10).getTime();
        const sessions = [{ start, end: start + 4 * 3600000 }];
        expect(
            buildDailySummary(sessions, start + 3600000, start + 2 * 3600000)
        ).toEqual([{ date: '2026-10-01', totalMs: 3600000 }]);
        expect(sessions[0].end).toBe(start + 4 * 3600000);
    });
});

describe('gamelog durations', () => {
    test('does not fill missing historical durations until the next login or now', () => {
        const start = Date.parse('2026-11-01T12:00:00Z');
        const rows = [
            { created_at: new Date(start).toISOString(), time: 0 },
            {
                created_at: new Date(start + 86400000).toISOString(),
                time: 3600000
            },
            {
                created_at: new Date(start + 2 * 86400000).toISOString(),
                time: 0
            }
        ];
        expect(buildSessionsFromGamelog(rows, 0, start + 3 * 86400000)).toEqual(
            [
                expect.objectContaining({
                    start: start + 86400000,
                    end: start + 86400000 + 3600000
                })
            ]
        );
    });

    test('extends only the currently observed live location', () => {
        const start = Date.parse('2026-11-04T12:00:00Z');
        const rows = [{ created_at: new Date(start).toISOString(), time: 0 }];
        expect(
            buildSessionsFromGamelog(rows, 0, start + 3600000, start)
        ).toEqual([expect.objectContaining({ start, end: start + 3600000 })]);
        expect(buildSessionsFromGamelog(rows, 0, start + 3600000)).toEqual([]);
    });

    test('does not extend recorded time past the next location or now', () => {
        const start = Date.parse('2026-11-04T12:00:00Z');
        const rows = [
            { created_at: new Date(start).toISOString(), time: 86400000 },
            {
                created_at: new Date(start + 3600000).toISOString(),
                time: 3600000
            }
        ];
        expect(buildSessionsFromGamelog(rows, 0, start + 5400000)).toEqual([
            expect.objectContaining({ start, end: start + 5400000 })
        ]);
    });
});
