import { beforeEach, describe, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prompt: vi.fn() }));
vi.mock('../../shared/utils', () => ({ parseLocation: vi.fn() }));
vi.mock('../appConfig', () => ({
    AppDebug: { endpointDomainVrchat: 'https://api.vrchat.cloud/api/1' }
}));
vi.mock('../sqlite.js', () => ({ default: {} }));
vi.mock('../webapi.js', () => ({ default: {} }));
vi.mock('../../stores/modal', () => ({
    useModalStore: () => ({ otpPrompt: mocks.prompt })
}));
import { AccountSession } from '../accountSession';
const saved = {
    user: { displayName: 'Test account' },
    loginParams: {
        username: 'alice',
        endpoint: 'https://api.vrchat.cloud/api/1'
    }
};
describe('secondary account TOTP login', () => {
    let session;
    beforeEach(() => {
        vi.resetAllMocks();
        session = new AccountSession('usr_test');
        session._apiEndpoint = saved.loginParams.endpoint;
        session._requestRaw = vi.fn().mockResolvedValue({ verified: true });
    });
    test('allows an explicit TOTP choice when the challenge lists only email', async () => {
        mocks.prompt
            .mockResolvedValueOnce({ ok: true, value: 'totp' })
            .mockResolvedValueOnce({ ok: true, value: '654321' });
        await session._completeTwoFactorAuth(
            { requiresTwoFactorAuth: ['emailOtp'] },
            saved
        );
        expect(session._requestRaw).toHaveBeenCalledWith(
            'auth/twofactorauth/totp/verify',
            { method: 'POST', params: { code: '654321' } }
        );
    });
    test('waits for explicit choice and sends the entered TOTP through the secondary client', async () => {
        mocks.prompt
            .mockResolvedValueOnce({ ok: true, value: 'totp' })
            .mockResolvedValueOnce({ ok: true, value: '654321' });
        await session._completeTwoFactorAuth(
            { requiresTwoFactorAuth: ['totp', 'emailOtp'] },
            saved
        );
        expect(mocks.prompt).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                mode: 'choice',
                methods: ['totp', 'emailOtp']
            })
        );
        expect(mocks.prompt).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                mode: 'totp',
                totpIdentity: saved.loginParams
            })
        );
        expect(session._requestRaw).toHaveBeenCalledWith(
            'auth/twofactorauth/totp/verify',
            { method: 'POST', params: { code: '654321' } }
        );
        expect(session._requestRaw).toHaveBeenLastCalledWith('auth/user');
    });
    test('uses email only when selected and offered', async () => {
        mocks.prompt
            .mockResolvedValueOnce({ ok: true, value: 'emailOtp' })
            .mockResolvedValueOnce({ ok: true, value: '654321' });
        await session._completeTwoFactorAuth(
            { requiresTwoFactorAuth: ['emailOtp'] },
            saved
        );
        expect(session._requestRaw).toHaveBeenCalledWith(
            'auth/twofactorauth/emailotp/verify',
            { method: 'POST', params: { code: '654321' } }
        );
    });
    test('rejects a method not offered by the server', async () => {
        mocks.prompt.mockResolvedValueOnce({ ok: true, value: 'emailOtp' });
        await expect(
            session._completeTwoFactorAuth(
                { requiresTwoFactorAuth: ['totp'] },
                saved
            )
        ).rejects.toThrow('cancelled');
        expect(session._requestRaw).not.toHaveBeenCalled();
    });
    test('does not submit if the session closes while waiting for a code', async () => {
        mocks.prompt
            .mockResolvedValueOnce({ ok: true, value: 'totp' })
            .mockImplementationOnce(async () => {
                session._destroyed = true;
                return { ok: true, value: '654321' };
            });
        await expect(
            session._completeTwoFactorAuth(
                { requiresTwoFactorAuth: ['totp'] },
                saved
            )
        ).rejects.toThrow('Account session closed');
        expect(session._requestRaw).not.toHaveBeenCalled();
    });
    test('rejects a code the server did not verify', async () => {
        mocks.prompt
            .mockResolvedValueOnce({ ok: true, value: 'totp' })
            .mockResolvedValueOnce({ ok: true, value: '654321' });
        session._requestRaw.mockResolvedValue({ verified: false });
        await expect(
            session._completeTwoFactorAuth(
                { requiresTwoFactorAuth: ['totp'] },
                saved
            )
        ).rejects.toThrow('Two-factor verification failed');
        expect(session._requestRaw).not.toHaveBeenCalledWith('auth/user');
    });
    test('preserves the recovery-code option', async () => {
        mocks.prompt
            .mockResolvedValueOnce({ ok: true, value: 'totp' })
            .mockResolvedValueOnce({ ok: false, reason: 'cancel', value: '' })
            .mockResolvedValueOnce({ ok: true, value: 'abcd1234' });
        await session._completeTwoFactorAuth(
            { requiresTwoFactorAuth: ['totp'] },
            saved
        );
        expect(session._requestRaw).toHaveBeenCalledWith(
            'auth/twofactorauth/otp/verify',
            { method: 'POST', params: { code: 'abcd-1234' } }
        );
    });
});
