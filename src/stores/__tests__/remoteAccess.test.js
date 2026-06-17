import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    toastError: vi.fn(),
    getBool: vi.fn(),
    getInt: vi.fn(),
    getString: vi.fn(),
    setBool: vi.fn(),
    setInt: vi.fn(),
    setString: vi.fn()
}));

vi.mock('vue-sonner', () => ({
    toast: {
        error: (...args) => mocks.toastError(...args)
    }
}));

vi.mock('../../services/config', () => ({
    default: {
        getBool: (...args) => mocks.getBool(...args),
        getInt: (...args) => mocks.getInt(...args),
        getString: (...args) => mocks.getString(...args),
        setBool: (...args) => mocks.setBool(...args),
        setInt: (...args) => mocks.setInt(...args),
        setString: (...args) => mocks.setString(...args)
    }
}));

import { useRemoteAccessStore } from '../remoteAccess';

describe('useRemoteAccessStore native bridge compatibility', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        delete window.electron;
        delete globalThis.VRCXStorage;
        globalThis.AppApi = {};
        mocks.toastError.mockClear();
        mocks.getBool.mockReset();
        mocks.getInt.mockReset();
        mocks.getString.mockReset();
        mocks.setBool.mockReset();
        mocks.setInt.mockReset();
        mocks.setString.mockReset();
        mocks.getBool.mockResolvedValue(false);
        mocks.getInt.mockResolvedValue(23580);
        mocks.getString.mockResolvedValue('');
        mocks.setBool.mockResolvedValue(undefined);
        mocks.setInt.mockResolvedValue(undefined);
        mocks.setString.mockResolvedValue(undefined);
    });

    test('reports unavailable native status API without throwing TypeError', async () => {
        const store = useRemoteAccessStore();

        await expect(store.refreshStatus()).resolves.toBeUndefined();

        expect(store.running).toBe(false);
        expect(store.error).toBe('网页远控接口不可用，请重新编译本地测试版。');
    });

    test('reports unavailable native stop API without throwing TypeError', async () => {
        const store = useRemoteAccessStore();
        store.running = true;
        store.url = 'http://127.0.0.1:23580/';

        await expect(store.stop()).resolves.toBeUndefined();

        expect(store.running).toBe(false);
        expect(store.url).toBe('');
        expect(store.error).toBe('网页远控接口不可用，请重新编译本地测试版。');
    });
    test('makes a stored password available to the native remote server before start', async () => {
        const passwordHash = 'pbkdf2-sha256:120000:c2FsdA==:aGFzaA==';
        mocks.getBool
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        mocks.getInt.mockResolvedValue(23580);
        mocks.getString.mockResolvedValue(passwordHash);
        const setStorage = vi.fn().mockResolvedValue(undefined);
        const saveStorage = vi.fn().mockResolvedValue(undefined);
        globalThis.VRCXStorage = {
            Set: setStorage,
            Save: saveStorage
        };
        globalThis.AppApi = {
            StartRemoteAccessServer: vi
                .fn()
                .mockResolvedValue({
                    running: true,
                    url: 'http://127.0.0.1:23580/'
                }),
            StopRemoteAccessServer: vi.fn(),
            GetRemoteAccessStatus: vi.fn()
        };
        const store = useRemoteAccessStore();

        await store.init();

        expect(setStorage).toHaveBeenCalledWith(
            'VRCX_remoteAccessPasswordHash',
            passwordHash
        );
        expect(saveStorage).toHaveBeenCalled();
        expect(globalThis.AppApi.StartRemoteAccessServer).toHaveBeenCalledWith(
            23580,
            false
        );
    });

    test('keeps initializing when native storage is unavailable', async () => {
        mocks.getBool.mockResolvedValue(false);
        mocks.getInt.mockResolvedValue(23580);
        mocks.getString.mockResolvedValue(
            'pbkdf2-sha256:120000:c2FsdA==:aGFzaA=='
        );
        const store = useRemoteAccessStore();

        await expect(store.init()).resolves.toBeUndefined();

        expect(store.hasPassword).toBe(true);
    });
});
