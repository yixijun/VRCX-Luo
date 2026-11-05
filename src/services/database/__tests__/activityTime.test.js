import { DatabaseSync } from 'node:sqlite';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null }));
vi.mock('../../sqlite.js', () => ({
    default: {
        execute: async (callback, sql, args = {}) => {
            const query = state.db.prepare(sql);
            query.setAllowUnknownNamedParameters(true);
            query.setReturnArrays(true);
            query.all(args).forEach(callback);
        },
        executeNonQuery: async (sql, args = {}) => {
            const query = state.db.prepare(sql);
            query.setAllowUnknownNamedParameters(true);
            return query.run(args);
        }
    }
}));
vi.mock('../index.js', () => ({ dbVars: { userPrefix: 'test' } }));
import { gameLog } from '../gameLog.js';
import { activityV2 } from '../activityV2.js';

beforeEach(() => {
    state.db = new DatabaseSync(':memory:');
    state.db
        .exec(`CREATE TABLE gamelog_location (created_at TEXT, time REAL, location TEXT);
        CREATE TABLE gamelog_join_leave (created_at TEXT, type TEXT, location TEXT);
        INSERT INTO gamelog_location VALUES ('2026-11-03T15:40:48.000Z', 47072000, 'room'),
            ('2026-11-04T04:45:20.000Z', 284000, 'other');
        INSERT INTO gamelog_join_leave VALUES
            ('2026-11-03T16:14:48.888Z', 'OnPlayerLeft', 'room'),
            ('2026-11-03T16:14:48.888Z', 'OnPlayerLeft', 'room');`);
});
afterEach(() => state.db.close());

test('does not extend a completed visit when restoring it on the next launch', async () => {
    await gameLog.updateGamelogLocationTimeToDatabase({
        created_at: '2026-11-04T04:45:20.000Z',
        time: 86400000
    });
    expect(
        state.db
            .prepare("SELECT time FROM gamelog_location WHERE location='other'")
            .get().time
    ).toBe(284000);
});

test('can shorten a visit when an earlier logged quit arrives after process polling', async () => {
    await gameLog.updateGamelogLocationTimeToDatabase({
        created_at: '2026-11-04T04:45:20.000Z',
        time: 280000
    });
    expect(
        state.db
            .prepare("SELECT time FROM gamelog_location WHERE location='other'")
            .get().time
    ).toBe(280000);
});

test('finalizes a missing duration and ignores invalid and repeated resets', async () => {
    state.db.exec("UPDATE gamelog_location SET time=0 WHERE location='other'");
    const created_at = '2026-11-04T04:45:20.000Z';
    await gameLog.updateGamelogLocationTimeToDatabase({
        created_at,
        time: -1000
    });
    await gameLog.updateGamelogLocationTimeToDatabase({
        created_at,
        time: 60000
    });
    await gameLog.updateGamelogLocationTimeToDatabase({
        created_at,
        time: 86400000
    });
    expect(
        state.db
            .prepare("SELECT time FROM gamelog_location WHERE location='other'")
            .get().time
    ).toBe(60000);
});

test('recovers an overwritten visit from its final recorded room reset without altering raw logs', async () => {
    const rows = await activityV2.getCurrentUserLocationSliceV2(
        '2026-11-03T00:00:00.000Z'
    );
    expect(rows[0].time).toBe(2040888);
    expect(
        state.db
            .prepare("SELECT time FROM gamelog_location WHERE location='room'")
            .get().time
    ).toBe(47072000);
});

test('recovers incremental reads and includes boundary context for slices', async () => {
    const rows = await activityV2.getCurrentUserLocationAfterV2(
        '2026-11-03T15:40:48.000Z',
        true
    );
    expect(rows[0].time).toBe(2040888);
    const slice = await activityV2.getCurrentUserLocationSliceV2(
        '2026-11-03T16:00:00.000Z',
        '2026-11-03T17:00:00.000Z'
    );
    expect(slice.map((row) => row.created_at)).toEqual(
        rows.map((row) => row.created_at)
    );
    expect(slice[0].time).toBe(2040888);
});

test('does not interpret an individual player departure as a local game exit', async () => {
    state.db.exec(
        "DELETE FROM gamelog_join_leave; INSERT INTO gamelog_join_leave VALUES ('2026-11-03T15:50:00.123Z', 'OnPlayerLeft', 'room')"
    );
    const rows = await activityV2.getCurrentUserLocationSliceV2(
        '2026-11-03T00:00:00.000Z'
    );
    expect(rows[0].time).toBe(47072000);
});

test('ignores a reset followed by further activity in the same visit', async () => {
    state.db.exec(
        "INSERT INTO gamelog_join_leave VALUES ('2026-11-03T16:20:00.000Z', 'OnPlayerJoined', 'room')"
    );
    const rows = await activityV2.getCurrentUserLocationSliceV2(
        '2026-11-03T00:00:00.000Z'
    );
    expect(rows[0].time).toBe(47072000);
});
