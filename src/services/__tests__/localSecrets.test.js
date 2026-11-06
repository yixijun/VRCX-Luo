import { describe, expect, test, vi } from 'vitest';
import { createLocalSecretHandlers } from '../../../src-electron/localSecrets.cjs';

describe('desktop local secret encryption', () => {
    const safeStorage = () => ({
        isEncryptionAvailable: () => true,
        getSelectedStorageBackend: () => 'gnome_libsecret',
        encryptString: vi.fn(() => Buffer.from('cipher')),
        decryptString: vi.fn(() => 'decrypted')
    });
    test('uses OS-backed storage and a base64 IPC envelope', () => {
        const storage = safeStorage();
        const handlers = createLocalSecretHandlers({
            safeStorage: storage,
            platform: 'win32'
        });
        const encrypted = handlers.protectLocalSecret(null, 'test-only-secret');
        expect(encrypted).toBe(Buffer.from('cipher').toString('base64'));
        expect(handlers.unprotectLocalSecret(null, encrypted)).toBe(
            'decrypted'
        );
    });
    test('refuses unavailable storage and Linux plaintext fallback', () => {
        const storage = safeStorage();
        storage.getSelectedStorageBackend = () => 'basic_text';
        const handlers = createLocalSecretHandlers({
            safeStorage: storage,
            platform: 'linux'
        });
        expect(() => handlers.protectLocalSecret(null, 'test')).toThrow(
            'Secure local storage unavailable'
        );
        expect(storage.encryptString).not.toHaveBeenCalled();
        storage.isEncryptionAvailable = () => false;
        expect(() => handlers.unprotectLocalSecret(null, 'Y2lwaGVy')).toThrow();
    });
    test('rejects invalid or oversized IPC arguments before encryption', () => {
        const storage = safeStorage();
        const handlers = createLocalSecretHandlers({
            safeStorage: storage,
            platform: 'win32'
        });
        expect(() => handlers.protectLocalSecret(null, {})).toThrow();
        expect(() =>
            handlers.protectLocalSecret(null, 'a'.repeat(4097))
        ).toThrow();
        expect(() =>
            handlers.unprotectLocalSecret(null, 'not base64!')
        ).toThrow();
        expect(storage.encryptString).not.toHaveBeenCalled();
        expect(storage.decryptString).not.toHaveBeenCalled();
    });
});
