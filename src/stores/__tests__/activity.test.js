import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
    buildSessionsFromGamelog,
    computeActivityView
} from '../../shared/utils/activityEngine';

const mocks = vi.hoisted(() => ({
    getMyTopWorlds: vi.fn(),
    getActivitySyncStateV2: vi.fn(),
    getActivitySessionsV2: vi.fn(),
    getActivitySourceSliceV2: vi.fn(),
    getActivitySourceAfterV2: vi.fn(),
    worker: vi.fn(),
    game: { isGameRunning: false },
    location: { lastLocation: { date: 0 } }
}));

vi.mock('../../services/database', () => ({
    database: {
        getMyTopWorlds: mocks.getMyTopWorlds,
        getActivitySyncStateV2: mocks.getActivitySyncStateV2,
        getActivitySessionsV2: mocks.getActivitySessionsV2,
        getActivitySourceSliceV2: mocks.getActivitySourceSliceV2,
        getActivitySourceAfterV2: mocks.getActivitySourceAfterV2,
        replaceActivitySessionsV2: vi.fn(),
        upsertActivitySyncStateV2: vi.fn(),
        getActivityBucketCacheV2: vi.fn().mockResolvedValue(null),
        upsertActivityBucketCacheV2: vi.fn(),
        ACTIVITY_VIEW_KIND: { ACTIVITY: 'activity' }
    }
}));
vi.mock('../../workers/activityWorkerRunner', () => ({
    runActivityWorkerTask: mocks.worker
}));
vi.mock('../../services/accountHub', () => ({
    accountHub: { viewMode: 'active' }
}));
vi.mock('../../services/watchState', () => ({
    watchState: { isLoggedIn: true }
}));
vi.mock('../game', () => ({ useGameStore: () => mocks.game }));
vi.mock('../location', () => ({ useLocationStore: () => mocks.location }));

import { useActivityStore } from '../activity';

describe('useActivityStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    test('rebuilds an empty historical cache with no source cursor when newer events exist', async () => {
        mocks.getActivitySyncStateV2.mockResolvedValue({
            updatedAt: '2026-08-14T12:48:55.251Z',
            sourceLastCreatedAt: '',
            cachedRangeDays: 30,
            isSelf: false
        });
        mocks.getActivitySessionsV2.mockResolvedValue([]);
        const events = [
            { created_at: '2026-10-28T10:00:00.000Z', type: 'Online' }
        ];
        mocks.getActivitySourceSliceV2.mockResolvedValue(events);
        mocks.worker.mockResolvedValue({
            sessions: [],
            pendingSessionStartAt: 123
        });
        await useActivityStore().loadActivity('usr_empty_cursor_regression', {
            rangeDays: 30
        });
        expect(mocks.getActivitySourceSliceV2).toHaveBeenCalledWith({
            userId: 'usr_empty_cursor_regression',
            isSelf: false,
            fromDays: 30
        });
    });

    test('forwards excludeWorldId to top worlds query', async () => {
        mocks.getMyTopWorlds.mockResolvedValue([{ worldId: 'wrld_1' }]);
        const store = useActivityStore();

        const result = await store.loadTopWorldsView({
            userId: 'usr_me',
            rangeDays: 30,
            limit: 5,
            sortBy: 'time',
            excludeWorldId: 'wrld_home'
        });

        expect(result).toEqual([{ worldId: 'wrld_1' }]);
        expect(mocks.getMyTopWorlds).toHaveBeenCalledWith(
            30,
            5,
            'time',
            'wrld_home'
        );
    });

    test('rebuilds persisted self sessions and shrinks corrected tails without a new cursor', async () => {
        const clock = vi
            .spyOn(Date, 'now')
            .mockReturnValue(Date.parse('2026-11-05T12:00:00Z'));
        try {
            const createdAt = '2026-11-03T15:40:48.000Z';
            const start = Date.parse(createdAt);
            const userId = 'usr_corrected_self_tail';
            mocks.getActivitySyncStateV2.mockResolvedValue({
                updatedAt: createdAt,
                sourceLastCreatedAt: createdAt,
                cachedRangeDays: 30,
                isSelf: true
            });
            mocks.getActivitySessionsV2.mockResolvedValue([
                { start, end: start + 47072000 }
            ]);
            mocks.getActivitySourceSliceV2.mockResolvedValue([
                { created_at: createdAt, time: 2040888 }
            ]);
            mocks.worker.mockImplementation(async (type, payload) => {
                if (type === 'computeSessionsSnapshot')
                    return {
                        sessions: buildSessionsFromGamelog(
                            payload.rows,
                            payload.mergeGapMs,
                            payload.nowMs,
                            payload.activeLocationStartMs
                        ),
                        pendingSessionStartAt: null
                    };
                return computeActivityView(payload);
            });
            const store = useActivityStore();
            const options = {
                isSelf: true,
                rangeDays: 30,
                dayLabels: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
                normalizeConfig: {}
            };
            const first = await store.loadActivity(userId, options);
            expect(first.sessions).toEqual([
                expect.objectContaining({ start, end: start + 2040888 })
            ]);
            mocks.getActivitySourceSliceV2.mockResolvedValue([
                { created_at: createdAt, time: 1800000 }
            ]);
            const second = await store.loadActivity(userId, options);
            expect(second.sessions).toEqual([
                expect.objectContaining({ start, end: start + 1800000 })
            ]);
            expect(mocks.getActivitySourceAfterV2).not.toHaveBeenCalled();
        } finally {
            clock.mockRestore();
        }
    });
});
