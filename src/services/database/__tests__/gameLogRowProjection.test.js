import { describe, expect, test } from 'vitest';

import { projectGameLogRow } from '../gameLogRowProjection.js';

describe('projectGameLogRow', () => {
    test('projects a location row using the read-query column contract', () => {
        expect(
            projectGameLogRow([
                7,
                '2025-01-01T12:00:00Z',
                'Location',
                null,
                'wrld_home:123',
                null,
                3600000,
                'wrld_home',
                'Home World',
                'Friends',
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
            ])
        ).toEqual({
            rowId: 7,
            created_at: '2025-01-01T12:00:00Z',
            type: 'Location',
            location: 'wrld_home:123',
            worldId: 'wrld_home',
            worldName: 'Home World',
            time: 3600000,
            groupName: 'Friends'
        });
    });

    test.each([
        [
            'OnPlayerJoined',
            { displayName: 'Alice', location: 'wrld_1:1', userId: 'usr_1', time: 42 }
        ],
        [
            'OnPlayerLeft',
            { displayName: 'Alice', location: 'wrld_1:1', userId: 'usr_1', time: 42 }
        ],
        [
            'PortalSpawn',
            {
                displayName: 'Alice',
                location: 'wrld_1:1',
                userId: 'usr_1',
                instanceId: 'inst_1',
                worldName: 'World'
            }
        ],
        [
            'VideoPlay',
            {
                videoUrl: 'https://example.test/video',
                videoName: 'Video',
                videoId: 'vid_1',
                location: 'wrld_1:1',
                displayName: 'Alice',
                userId: 'usr_1'
            }
        ],
        ['Event', { data: '{"event":"test"}' }],
        [
            'External',
            {
                message: 'message',
                displayName: 'Alice',
                userId: 'usr_1',
                location: 'wrld_1:1'
            }
        ],
        ['StringLoad', { resourceUrl: 'https://example.test/resource', location: 'wrld_1:1' }],
        ['ImageLoad', { resourceUrl: 'https://example.test/resource', location: 'wrld_1:1' }]
    ])('projects a %s row without leaking unused columns', (type, expected) => {
        const dbRow = [
            9,
            '2025-01-01T12:00:00Z',
            type,
            'Alice',
            'wrld_1:1',
            'usr_1',
            42,
            'wrld_1',
            'World',
            'Friends',
            'inst_1',
            'https://example.test/video',
            'Video',
            'vid_1',
            'https://example.test/resource',
            'StringLoad',
            '{"event":"test"}',
            'message'
        ];

        expect(projectGameLogRow(dbRow)).toEqual({
            rowId: 9,
            created_at: '2025-01-01T12:00:00Z',
            type,
            ...expected
        });
    });

    test('keeps the common identity for an unknown type', () => {
        expect(
            projectGameLogRow([1, '2025-01-01T12:00:00Z', 'Unknown'])
        ).toEqual({
            rowId: 1,
            created_at: '2025-01-01T12:00:00Z',
            type: 'Unknown'
        });
    });
});
