import { beforeEach, describe, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    storage: new Map(),
    protectedPayloads: new Map(),
    protect: vi.fn(),
    unprotect: vi.fn()
}));
vi.mock('../config', () => ({
    default: {
        getString: vi.fn(async (key) => mocks.storage.get(key) || ''),
        setString: vi.fn(async (key, value) => {
            mocks.storage.set(key, value);
        }),
        remove: vi.fn(async (key) => {
            mocks.storage.delete(key);
        })
    }
}));
vi.mock('../localSecrets', () => ({
    protectLocalSecret: mocks.protect,
    unprotectLocalSecret: mocks.unprotect
}));
import {
    getTotpSecret,
    hasTotpSecret,
    removeTotpSecret,
    saveTotpSecret,
    getTotpLoginFillAllowed,
    setTotpLoginFillAllowed
} from '../totpSecrets';
const key = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const account = {
    username: 'Alice',
    endpoint: 'https://api.vrchat.cloud/api/1'
};

describe('account TOTP keys', () => {
    beforeEach(() => {
        mocks.storage.clear();
        mocks.protectedPayloads.clear();
        vi.resetAllMocks();
        mocks.protect.mockImplementation(async (payload) => {
            const cipher = `cef:protected-${mocks.protectedPayloads.size}`;
            mocks.protectedPayloads.set(cipher, payload);
            return cipher;
        });
        mocks.unprotect.mockImplementation(async (cipher) =>
            mocks.protectedPayloads.get(cipher)
        );
    });
    test('persists only encrypted data and normalizes account names/endpoints', async () => {
        await saveTotpSecret(account, key);
        expect([...mocks.storage.values()].join()).not.toContain(key);
        expect(
            await getTotpSecret({
                username: ' ALICE ',
                endpoint: account.endpoint + '/'
            })
        ).toBe(key);
        expect(await hasTotpSecret(account)).toBe(true);
        await removeTotpSecret(account);
        expect(await getTotpSecret(account)).toBeNull();
    });
    test('isolates keys between users and API endpoints', async () => {
        await saveTotpSecret(account, key);
        expect(await getTotpSecret({ ...account, username: 'Bob' })).toBeNull();
        expect(
            await getTotpSecret({
                ...account,
                endpoint: 'https://example.com/api/1'
            })
        ).toBeNull();
    });
    test('rejects ciphertext copied from another account', async () => {
        await saveTotpSecret(account, key);
        const aliceCipher = [...mocks.storage.values()][0];
        await saveTotpSecret({ ...account, username: 'Bob' }, key);
        const bobStorageKey = [...mocks.storage.keys()][1];
        mocks.storage.set(bobStorageKey, aliceCipher);
        await expect(
            getTotpSecret({ ...account, username: 'Bob' })
        ).rejects.toThrow('TOTP account mismatch');
    });
    test('does not write a key when host encryption fails', async () => {
        mocks.protect.mockRejectedValue(new Error('locked'));
        await expect(saveTotpSecret(account, key)).rejects.toThrow();
        expect(mocks.storage.size).toBe(0);
    });
    test('login fill is opt-in and scoped to one account and endpoint', async () => {
        await saveTotpSecret(account, key);
        expect(await getTotpLoginFillAllowed(account)).toBe(false);
        await setTotpLoginFillAllowed(account, true);
        expect(await getTotpLoginFillAllowed(account)).toBe(true);
        expect(
            await getTotpLoginFillAllowed({ ...account, username: 'Bob' })
        ).toBe(false);
        expect(
            await getTotpLoginFillAllowed({
                ...account,
                endpoint: 'https://example.com/api/1'
            })
        ).toBe(false);
        await setTotpLoginFillAllowed(account, false);
        expect(await getTotpLoginFillAllowed(account)).toBe(false);
    });
    test('removing a key revokes login fill for a future replacement key', async () => {
        await saveTotpSecret(account, key);
        await setTotpLoginFillAllowed(account, true);
        await removeTotpSecret(account);
        await saveTotpSecret(account, key);
        expect(await getTotpLoginFillAllowed(account)).toBe(false);
    });
    test('does not return plaintext when decryption fails', async () => {
        await saveTotpSecret(account, key);
        mocks.unprotect.mockRejectedValue(new Error('wrong OS user'));
        await expect(getTotpSecret(account)).rejects.toThrow();
    });
});
