import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), isLoggedIn: false }));
vi.mock('../../stores', () => ({
    useAuthStore: () => ({}),
    useModalStore: () => ({}),
    useNotificationStore: () => ({}),
    useUpdateLoopStore: () => ({}),
    useUserStore: () => ({})
}));
vi.mock('../../coordinators/userCoordinator', () => ({
    getCurrentUser: vi.fn()
}));
vi.mock('../appConfig.js', () => ({
    AppDebug: { endpointDomain: 'https://example.com/api/1' },
    isApiLogSuppressed: () => true,
    logWebRequest: vi.fn()
}));
vi.mock('../../plugins/i18n', () => ({
    i18n: { global: { t: (key) => key } }
}));
vi.mock('../webapi.js', () => ({ default: { execute: mocks.execute } }));
vi.mock('../watchState', () => ({ watchState: mocks }));
import { request } from '../request';

beforeEach(() => {
    mocks.execute.mockReset();
    mocks.isLoggedIn = false;
});

test('does not merge overlapping login requests for different accounts', async () => {
    let firstResponse, secondResponse;
    mocks.execute
        .mockImplementationOnce(
            () =>
                new Promise((r) => {
                    firstResponse = r;
                })
        )
        .mockImplementationOnce(
            () =>
                new Promise((r) => {
                    secondResponse = r;
                })
        );
    const first = request('auth/user', {
        headers: { Authorization: 'Basic public-test-alice' }
    });
    const second = request('auth/user', {
        headers: { Authorization: 'Basic public-test-bob' }
    });
    firstResponse({
        status: 200,
        data: JSON.stringify({ requiresTwoFactorAuth: ['emailOtp'] })
    });
    secondResponse?.({
        status: 200,
        data: JSON.stringify({ requiresTwoFactorAuth: ['totp', 'otp'] })
    });
    await Promise.all([first, second]);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(await first).toEqual({ requiresTwoFactorAuth: ['emailOtp'] });
    expect(await second).toEqual({ requiresTwoFactorAuth: ['totp', 'otp'] });
});

test('does not reuse a cookie-check response for a credential login', async () => {
    mocks.execute.mockImplementation(async () => ({
        status: 200,
        data: JSON.stringify({ requiresTwoFactorAuth: ['totp'] })
    }));
    const cookieCheck = request('auth/user');
    const credentialLogin = request('auth/user', {
        headers: { Authorization: 'Basic public-test' }
    });
    await Promise.all([cookieCheck, credentialLogin]);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
});

test('still merges ordinary concurrent GET requests', async () => {
    mocks.isLoggedIn = true;
    mocks.execute.mockResolvedValue({
        status: 200,
        data: JSON.stringify({ id: 'usr_public_test' })
    });
    const first = request('users/usr_public_test');
    const second = request('users/usr_public_test');
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(await first).toEqual(await second);
});
