import { describe, expect, it } from 'vitest';

import {
    buildFriendActivitySessions,
    getCurrentFriendActivitySession
} from '../friendActivity';

const at = (hour, minute = 0) => Date.UTC(2026, 0, 1, hour, minute);

describe('friend activity sessions', () => {
    it('derives separate room visits from GPS and offline feed rows', () => {
        const records = buildFriendActivitySessions({
            rangeStartMs: at(8),
            rangeEndMs: at(12),
            rows: [
                {
                    kind: 'gps',
                    sourceId: 1,
                    createdAt: new Date(at(10)).toISOString(),
                    location: 'wrld_b:room-b',
                    worldName: 'World B',
                    previousLocation: 'wrld_a:room-a',
                    time: 30 * 60 * 1000
                },
                {
                    kind: 'offline',
                    sourceId: 2,
                    createdAt: new Date(at(11)).toISOString(),
                    location: 'wrld_b:room-b',
                    worldName: 'World B',
                    time: 60 * 60 * 1000
                }
            ]
        });

        expect(records).toHaveLength(2);
        expect(records[0]).toMatchObject({
            worldName: 'World B',
            startAt: at(10),
            endAt: at(11)
        });
        expect(records[1]).toMatchObject({
            worldName: '',
            startAt: at(9, 30),
            endAt: at(10)
        });
        expect(records[1].location).toBe('wrld_a:room-a');
    });

    it('splits a visit at restricted status changes and marks hidden locations as suspected private', () => {
        const records = buildFriendActivitySessions({
            rangeStartMs: at(8),
            rangeEndMs: at(11),
            rows: [
                {
                    kind: 'gps',
                    sourceId: 1,
                    createdAt: new Date(at(10)).toISOString(),
                    previousLocation: 'private',
                    location: 'wrld_public:room',
                    time: 60 * 60 * 1000
                }
            ],
            statusRows: [
                { createdAt: new Date(at(8)).toISOString(), status: 'active' },
                {
                    createdAt: new Date(at(9, 30)).toISOString(),
                    status: 'busy'
                },
                {
                    createdAt: new Date(at(9, 45)).toISOString(),
                    status: 'active'
                }
            ]
        });

        expect(records).toHaveLength(3);
        expect(records[1]).toMatchObject({
            startAt: at(9, 30),
            endAt: at(9, 45),
            status: 'busy',
            privacyState: 'suspected-private'
        });
        expect(records[1].isKnownLocation).toBe(false);
    });

    it('keeps an active room open and creates unknown gaps instead of extending a visit', () => {
        const current = getCurrentFriendActivitySession(
            {
                state: 'online',
                location: 'wrld_live:room',
                $location_at: at(11)
            },
            'Live World',
            '',
            at(12)
        );
        const records = buildFriendActivitySessions({
            rangeStartMs: at(8),
            rangeEndMs: at(12),
            rows: [
                {
                    kind: 'offline',
                    sourceId: 1,
                    createdAt: new Date(at(9)).toISOString(),
                    location: 'wrld_old:room',
                    time: 60 * 60 * 1000
                }
            ],
            currentSession: current
        });

        expect(
            records.some((record) => record.isOpenTail && record.endAt === null)
        ).toBe(true);
        expect(
            records.some((record) => record.privacyState === 'unknown')
        ).toBe(true);
    });
});
