import { beforeEach, describe, expect, test, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({
    requestMock: vi.fn()
}));

vi.mock('../../services/request', () => ({
    request: requestMock
}));
vi.mock('../../queries', () => ({
    patchAndRefetchActiveQuery: vi.fn(),
    queryKeys: {
        user: vi.fn()
    }
}));
vi.mock('../../stores', () => ({
    useUserStore: vi.fn(() => ({ currentUser: { id: 'usr_self' } }))
}));
vi.mock('../../coordinators/userCoordinator', () => ({
    applyCurrentUser: vi.fn(),
    applyUser: vi.fn(() => ({}))
}));

import userRequest from '../user';

describe('user public profile request', () => {
    beforeEach(() => {
        requestMock.mockReset();
    });

    test('requests profile data from the dedicated profile endpoint', async () => {
        const json = {
            id: 'usr_friend',
            bio: 'hello',
            iconUrl: 'https://img.example/profile.png'
        };
        requestMock.mockResolvedValue(json);

        await expect(
            userRequest.getPublicProfile({ userId: 'usr_friend' })
        ).resolves.toEqual({
            json,
            params: { userId: 'usr_friend' }
        });

        expect(requestMock).toHaveBeenCalledWith('profile/usr_friend', {
            method: 'GET'
        });
    });

    test('writes bio changes through the profile endpoint', async () => {
        const params = { bio: 'updated bio', bioLinks: [] };
        requestMock.mockResolvedValue({ id: 'usr_self' });

        await expect(userRequest.saveProfile(params)).resolves.toEqual({
            json: { id: 'usr_self' },
            params
        });

        expect(requestMock).toHaveBeenCalledWith('profile/usr_self', {
            method: 'PUT',
            params
        });
    });
});
