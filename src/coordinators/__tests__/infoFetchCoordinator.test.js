import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    database: {
        getLastStatusChangeForUser: vi.fn(),
        addStatusToDatabase: vi.fn()
    },
    friends: new Map(),
    trackedList: [],
    currentUser: { id: 'usr-current' },
    getUser: vi.fn(),
    getPublicProfile: vi.fn(),
    recordBioSnapshotForUser: vi.fn(),
    computeSuggestions: vi.fn()
}));

vi.mock('../../services/database', () => ({ database: mocks.database }));
vi.mock('../../api', () => ({
    userRequest: {
        getUser: (...args) => mocks.getUser(...args),
        getPublicProfile: (...args) => mocks.getPublicProfile(...args)
    }
}));
vi.mock('../../stores', () => ({
    useFriendStore: () => ({ friends: mocks.friends }),
    useTrackedNonFriendsStore: () => ({ trackedList: mocks.trackedList }),
    useManualRelationsStore: () => ({
        computeSuggestions: (...args) => mocks.computeSuggestions(...args)
    }),
    useUserStore: () => ({ currentUser: mocks.currentUser })
}));
vi.mock('../bioSnapshotCoordinator', () => ({
    recordBioSnapshotForUser: (...args) =>
        mocks.recordBioSnapshotForUser(...args)
}));

import {
    cancelInfoFetch,
    getTargetCount,
    infoFetchState,
    retryFailedInfoFetch,
    runSilentInfoFetch
} from '../infoFetchCoordinator';

function userTarget(userId, displayName = userId) {
    return { id: userId, name: displayName };
}

function profileResponse(userId, displayName = userId) {
    return { json: { id: userId, displayName, bio: `bio-${userId}` } };
}

function resetState() {
    Object.assign(infoFetchState, {
        status: 'idle',
        done: 0,
        total: 0,
        friendsTotal: 0,
        trackedTotal: 0,
        bioUpdated: 0,
        statusUpdated: 0,
        succeeded: 0,
        failed: 0,
        failureCount: 0,
        failures: [],
        failedTargets: [],
        startedAt: null,
        finishedAt: null
    });
}

describe('infoFetchCoordinator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetState();
        mocks.friends.clear();
        mocks.trackedList.splice(0);
        mocks.database.getLastStatusChangeForUser.mockResolvedValue(null);
        mocks.getUser.mockImplementation(async ({ userId }) => ({
            json: {
                id: userId,
                displayName: userId,
                status: 'offline',
                statusDescription: ''
            }
        }));
        mocks.getPublicProfile.mockImplementation(async ({ userId }) =>
            profileResponse(userId)
        );
        mocks.recordBioSnapshotForUser.mockResolvedValue(false);
        mocks.computeSuggestions.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('reports a completed scan with no changes as successful', async () => {
        mocks.friends.set('usr-one', userTarget('usr-one', 'One'));

        await runSilentInfoFetch();

        expect(getTargetCount()).toEqual({ friends: 1, tracked: 0, total: 1 });
        expect(infoFetchState.status).toBe('done');
        expect(infoFetchState.done).toBe(1);
        expect(infoFetchState.succeeded).toBe(1);
        expect(infoFetchState.failed).toBe(0);
        expect(infoFetchState.failureCount).toBe(0);
        expect(infoFetchState.bioUpdated).toBe(0);
    });

    it('reports partial failure and retries only failed targets', async () => {
        vi.useFakeTimers();
        mocks.friends.set('usr-one', userTarget('usr-one'));
        mocks.friends.set('usr-two', userTarget('usr-two'));
        let shouldFail = true;
        mocks.getUser.mockImplementation(async ({ userId }) => {
            if (userId === 'usr-two' && shouldFail) {
                throw new Error('temporary user request failure');
            }
            return {
                json: { id: userId, displayName: userId, status: 'offline' }
            };
        });

        const firstRun = runSilentInfoFetch();
        await vi.runAllTimersAsync();
        await firstRun;

        expect(infoFetchState.status).toBe('partial');
        expect(infoFetchState.done).toBe(2);
        expect(infoFetchState.succeeded).toBe(1);
        expect(infoFetchState.failed).toBe(1);
        expect(infoFetchState.failedTargets).toEqual([
            { userId: 'usr-two', displayName: 'usr-two' }
        ]);
        expect(infoFetchState.failureCount).toBe(1);

        shouldFail = false;
        await retryFailedInfoFetch();

        expect(infoFetchState.status).toBe('done');
        expect(infoFetchState.total).toBe(1);
        expect(infoFetchState.failed).toBe(0);
        expect(mocks.getUser).toHaveBeenCalledTimes(4);
    });

    it('records archive failures separately from request failures', async () => {
        mocks.friends.set('usr-one', userTarget('usr-one'));
        mocks.recordBioSnapshotForUser.mockRejectedValue(
            new Error('archive unavailable')
        );

        await runSilentInfoFetch();

        expect(infoFetchState.status).toBe('failed');
        expect(infoFetchState.failed).toBe(1);
        expect(infoFetchState.failures).toEqual([
            expect.objectContaining({
                stage: 'bio_archive',
                message: 'archive unavailable'
            })
        ]);
    });

    it('leaves a cancelled scan with a usable summary', async () => {
        let releaseUser;
        const userReady = new Promise((resolve) => {
            releaseUser = resolve;
        });
        mocks.friends.set('usr-one', userTarget('usr-one'));
        mocks.getUser.mockReturnValueOnce(userReady);

        const run = runSilentInfoFetch();
        await Promise.resolve();
        cancelInfoFetch();
        releaseUser({
            json: { id: 'usr-one', displayName: 'usr-one', status: 'offline' }
        });
        await run;

        expect(infoFetchState.status).toBe('cancelled');
        expect(infoFetchState.done).toBe(0);
        expect(infoFetchState.finishedAt).toEqual(expect.any(Number));
        expect(mocks.getPublicProfile).not.toHaveBeenCalled();
        expect(mocks.computeSuggestions).not.toHaveBeenCalled();
    });
});
