import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    getMyTopWorlds: vi.fn(),
    getActivitySyncStateV2: vi.fn(),
    getActivitySessionsV2: vi.fn(),
    getActivitySourceSliceV2: vi.fn(),
    getActivitySourceAfterV2: vi.fn(),
    worker: vi.fn()
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
});
