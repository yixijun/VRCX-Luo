import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    execute: vi.fn(),
    executeNonQuery: vi.fn()
}));

vi.mock('../../sqlite.js', () => ({
    default: {
        execute: mocks.execute,
        executeNonQuery: mocks.executeNonQuery
    }
}));
vi.mock('../index.js', () => ({
    dbVars: {
        maxTableSize: 500,
        userPrefix: ''
    }
}));

import { gameLog } from '../gameLog.js';

describe('gameLog.getSelfPresenceForLocations', () => {
    beforeEach(() => {
        mocks.execute.mockReset();
    });

    test('filters out zero-duration records with AND time > 0', async () => {
        mocks.execute.mockImplementation(async (callback, sql, params) => {
            callback(['wrld_1:123~region(us)', '2024-01-15T10:00:00Z', 3600000]);
            return undefined;
        });

        const result = await gameLog.getSelfPresenceForLocations('usr_abc', [
            'wrld_1:123~region(us)'
        ]);

        expect(result.get('wrld_1:123~region(us)')).toEqual([
            { selfLeave: '2024-01-15T10:00:00Z', selfTime: 3600000 }
        ]);
        expect(mocks.execute).toHaveBeenCalledTimes(1);
        expect(mocks.execute.mock.calls[0][1]).toContain('AND time > 0');
    });

    test('returns empty map when locations array is empty', async () => {
        const result = await gameLog.getSelfPresenceForLocations('usr_abc', []);
        expect(result.size).toBe(0);
        expect(mocks.execute).not.toHaveBeenCalled();
    });
});

describe('gameLog read-query row projection', () => {
    beforeEach(() => {
        mocks.execute.mockReset();
    });

    test('lookupGameLogDatabase returns the shared projected row shape', async () => {
        mocks.execute.mockImplementation(async (callback) => {
            callback([
                12,
                '2025-01-01T12:00:00Z',
                'External',
                'Alice',
                'wrld_1:1',
                'usr_1',
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                'hello'
            ]);
            return undefined;
        });

        await expect(gameLog.lookupGameLogDatabase([], [], 5)).resolves.toEqual([
            {
                rowId: 12,
                created_at: '2025-01-01T12:00:00Z',
                type: 'External',
                message: 'hello',
                displayName: 'Alice',
                userId: 'usr_1',
                location: 'wrld_1:1'
            }
        ]);
    });
});

describe('gameLog.getCoInstanceHistoryBetweenFriends', () => {
    beforeEach(() => {
        mocks.execute.mockReset();
    });

    test('includes inferred co-instance sessions from feed GPS/offline history', async () => {
        mocks.execute.mockImplementation(async (callback, sql, params) => {
            if (sql.includes('FROM gamelog_join_leave a')) {
                callback([
                    'wrld_logged:123~region(us)',
                    '2025-01-01T12:00:00Z',
                    3600000,
                    '2025-01-01T12:30:00Z',
                    3600000
                ]);
                return undefined;
            }
            if (sql.includes('FROM _feed_gps') || sql.includes('FROM _feed_online_offline')) {
                if (params['@userId'] === 'usr_a') {
                    callback(['wrld_inferred:55~region(us)', '2025-01-01T10:00:00Z', 3600000]);
                } else if (params['@userId'] === 'usr_b') {
                    callback(['wrld_inferred:55~region(us)', '2025-01-01T10:20:00Z', 3600000]);
                }
            }
            return undefined;
        });

        const result = await gameLog.getCoInstanceHistoryBetweenFriends(
            'usr_a',
            'usr_b'
        );

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    location: 'wrld_logged:123~region(us)'
                }),
                expect.objectContaining({
                    location: 'wrld_inferred:55~region(us)'
                })
            ])
        );
    });

    test('deduplicates duplicate rows coming from multiple sources', async () => {
        mocks.execute.mockImplementation(async (callback, sql, params) => {
            if (sql.includes('FROM gamelog_join_leave a')) {
                callback([
                    'wrld_same:1~region(us)',
                    '2025-01-01T10:00:00Z',
                    3600000,
                    '2025-01-01T10:20:00Z',
                    3600000
                ]);
                return undefined;
            }
            if (sql.includes('FROM _feed_gps') || sql.includes('FROM _feed_online_offline')) {
                if (params['@userId'] === 'usr_a') {
                    callback(['wrld_same:1~region(us)', '2025-01-01T10:00:00Z', 3600000]);
                } else if (params['@userId'] === 'usr_b') {
                    callback(['wrld_same:1~region(us)', '2025-01-01T10:20:00Z', 3600000]);
                }
            }
            return undefined;
        });

        const result = await gameLog.getCoInstanceHistoryBetweenFriends(
            'usr_a',
            'usr_b'
        );

        const duplicates = result.filter(
            (item) =>
                item.location === 'wrld_same:1~region(us)' &&
                item.friendALeave === '2025-01-01T10:00:00Z' &&
                item.friendBLeave === '2025-01-01T10:20:00Z'
        );
        expect(duplicates).toHaveLength(1);
    });
});

describe('gameLog.getMyTopWorlds', () => {
    beforeEach(() => {
        mocks.execute.mockReset();
    });

    test('adds an exclude clause when a home world id is provided', async () => {
        mocks.execute.mockImplementation(async (callback, sql, params) => {
            callback(['wrld_1', 'World One', 3, 9000]);
            return undefined;
        });

        const result = await gameLog.getMyTopWorlds(30, 5, 'time', 'wrld_home');

        expect(result).toEqual([
            {
                worldId: 'wrld_1',
                worldName: 'World One',
                visitCount: 3,
                totalTime: 9000
            }
        ]);
        expect(mocks.execute).toHaveBeenCalledTimes(1);
        expect(mocks.execute.mock.calls[0][1]).toContain(
            'AND world_id != @excludeWorldId'
        );
        expect(mocks.execute.mock.calls[0][2]).toMatchObject({
            '@limit': 5,
            '@daysOffset': '-30 days',
            '@excludeWorldId': 'wrld_home'
        });
    });
});

describe('gameLog.getInstancesCreatedByUser', () => {
    beforeEach(() => {
        mocks.execute.mockReset();
    });

    test('returns only logged instances from worlds authored by the target user', async () => {
        mocks.execute.mockImplementation(async (callback, sql, params) => {
            callback([
                '2025-01-01T12:00:00Z',
                'wrld_target:123~region(us)',
                3600000,
                'Target World',
                ''
            ]);
            return undefined;
        });

        const result = await gameLog.getInstancesCreatedByUser({ id: 'usr_target' });

        expect([...result]).toEqual([
            {
                created_at: '2025-01-01T12:00:00Z',
                location: 'wrld_target:123~region(us)',
                time: 3600000,
                worldName: 'Target World',
                groupName: '',
                events: []
            }
        ]);
        expect(mocks.execute).toHaveBeenCalledTimes(1);
        expect(mocks.execute.mock.calls[0][1]).toContain(
            'INNER JOIN cache_world cw ON gl.world_id = cw.id'
        );
        expect(mocks.execute.mock.calls[0][1]).toContain('WHERE cw.author_id = @authorId');
        expect(mocks.execute.mock.calls[0][2]).toEqual({ '@authorId': 'usr_target' });
    });

    test('matches historical instances by fetched world IDs when the world is not cached', async () => {
        mocks.execute.mockImplementation(async (callback) => {
            callback([
                '2025-01-02T12:00:00Z',
                'wrld_uncached:123~region(us)',
                120000,
                'Uncached World',
                ''
            ]);
            return undefined;
        });

        await gameLog.getInstancesCreatedByUser(
            { id: 'usr_target' },
            ['wrld_uncached', 'wrld_uncached']
        );

        const [sql, params] = [
            mocks.execute.mock.calls[0][1],
            mocks.execute.mock.calls[0][2]
        ];
        expect(sql).toContain('gl.world_id IN (@worldId0)');
        expect(sql).not.toContain('INNER JOIN cache_world');
        expect(params).toEqual({
            '@worldId0': 'wrld_uncached',
            '@authorId': 'usr_target'
        });
    });
});
