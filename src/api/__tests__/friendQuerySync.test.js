import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockRequest = vi.fn();
const mockInvalidateActive = vi.fn().mockResolvedValue();
const mockApplyUser = vi.fn((json) => json);

vi.mock('../../services/request', () => ({
    request: (...args) => mockRequest(...args)
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => ({
        applyUser: (...args) => mockApplyUser(...args)
    })
}));

vi.mock('../../coordinators/userCoordinator', () => ({
    applyUser: (...args) => mockApplyUser(...args)
}));

vi.mock('../../queries', () => ({
    queryCache: {
        invalidateActive: (...args) => mockInvalidateActive(...args)
    },
    entityQueryPolicies: {
        user: {},
        avatar: {},
        world: {},
        worldCollection: {}
    }
}));

import friendRequest from '../friend';

describe('friend query sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('friend mutations invalidate active friends queries', async () => {
        mockRequest.mockResolvedValue({ ok: true });

        await friendRequest.sendFriendRequest({ userId: 'usr_1' });
        await friendRequest.cancelFriendRequest({ userId: 'usr_1' });
        await friendRequest.deleteFriend({ userId: 'usr_1' });

        expect(mockInvalidateActive).toHaveBeenCalledTimes(3);
        expect(mockInvalidateActive).toHaveBeenCalledWith(['friends']);
    });
});
