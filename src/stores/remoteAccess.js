import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';

import configRepository from '../services/config';
import {
    clampRemotePort,
    createPasswordHash
} from '../services/remoteAccessSecurity';

const ENABLED_KEY = 'VRCX_remoteAccessEnabled';
const PORT_KEY = 'VRCX_remoteAccessPort';
const PASSWORD_KEY = 'VRCX_remoteAccessPasswordHash';
const PRIVACY_KEY = 'VRCX_remoteAccessPrivacyMode';
const NATIVE_API_UNAVAILABLE_MESSAGE =
    '网页远控接口不可用，请重新编译本地测试版。';

function getLocalHostHint() {
    return location.hostname && location.hostname !== 'localhost'
        ? location.hostname
        : '127.0.0.1';
}

export const useRemoteAccessStore = defineStore('RemoteAccess', () => {
    const enabled = ref(false);
    const port = ref(23580);
    const hasPassword = ref(false);
    const privacyMode = ref(false);
    const running = ref(false);
    const url = ref('');
    const error = ref('');
    let initialized = false;

    const canStart = computed(() => hasPassword.value && port.value > 0);

    async function init() {
        if (initialized) {
            await refreshStatus();
            return;
        }
        initialized = true;
        const [enabledValue, portValue, passwordHash, privacyValue] =
            await Promise.all([
                configRepository.getBool(ENABLED_KEY, false),
                configRepository.getInt(PORT_KEY, 23580),
                configRepository.getString(PASSWORD_KEY, ''),
                configRepository.getBool(PRIVACY_KEY, false)
            ]);
        enabled.value = enabledValue;
        port.value = clampRemotePort(portValue);
        hasPassword.value = Boolean(passwordHash);
        privacyMode.value = privacyValue;
        await syncPasswordHashToNativeStorage(passwordHash);
        if (enabled.value && hasPassword.value) {
            await start();
        }
    }

    async function refreshStatus() {
        try {
            const status = await getNativeRemoteApi().status();
            running.value = Boolean(status?.running);
            url.value =
                status?.url ||
                (running.value
                    ? `http://${getLocalHostHint()}:${port.value}/`
                    : '');
            error.value = status?.error || '';
        } catch (err) {
            running.value = false;
            error.value = err?.message || String(err);
        }
    }

    async function start() {
        error.value = '';
        try {
            const status = await getNativeRemoteApi().start(
                port.value,
                privacyMode.value
            );
            running.value = Boolean(status?.running);
            url.value =
                status?.url || `http://${getLocalHostHint()}:${port.value}/`;
            error.value = status?.error || '';
            if (error.value) {
                toast.error(error.value);
            }
            return status;
        } catch (err) {
            running.value = false;
            error.value = err?.message || String(err);
            toast.error(error.value);
            return null;
        }
    }

    async function stop() {
        try {
            await getNativeRemoteApi().stop();
            running.value = false;
            url.value = '';
            await refreshStatus();
        } catch (err) {
            running.value = false;
            url.value = '';
            error.value = err?.message || String(err);
        }
    }

    async function setEnabled(value) {
        enabled.value = Boolean(value);
        await configRepository.setBool(ENABLED_KEY, enabled.value);
        if (enabled.value) {
            await start();
        } else {
            await stop();
        }
    }

    async function setPort(value) {
        port.value = clampRemotePort(value);
        await configRepository.setInt(PORT_KEY, port.value);
        if (enabled.value) {
            await start();
        }
    }

    async function setPrivacyMode(value) {
        privacyMode.value = Boolean(value);
        await configRepository.setBool(PRIVACY_KEY, privacyMode.value);
        if (enabled.value) {
            await start();
        }
    }

    async function setPassword(password) {
        const hash = await createPasswordHash(password);
        await configRepository.setString(PASSWORD_KEY, hash);
        await syncPasswordHashToNativeStorage(hash);
        hasPassword.value = true;
        if (enabled.value) {
            await start();
        }
    }

    return {
        enabled,
        port,
        hasPassword,
        privacyMode,
        running,
        url,
        error,
        canStart,
        init,
        refreshStatus,
        start,
        stop,
        setEnabled,
        setPort,
        setPrivacyMode,
        setPassword
    };
});

function getNativeRemoteApi() {
    const unavailable = () =>
        Promise.reject(new Error(NATIVE_API_UNAVAILABLE_MESSAGE));
    if (
        typeof window.electron?.startRemoteAccessServer === 'function' ||
        typeof window.electron?.stopRemoteAccessServer === 'function' ||
        typeof window.electron?.getRemoteAccessStatus === 'function'
    ) {
        return {
            start:
                window.electron.startRemoteAccessServer || unavailable,
            stop: window.electron.stopRemoteAccessServer || unavailable,
            status: window.electron.getRemoteAccessStatus || unavailable
        };
    }
    return {
        start:
            typeof AppApi?.StartRemoteAccessServer === 'function'
                ? AppApi.StartRemoteAccessServer
                : unavailable,
        stop:
            typeof AppApi?.StopRemoteAccessServer === 'function'
                ? AppApi.StopRemoteAccessServer
                : unavailable,
        status:
            typeof AppApi?.GetRemoteAccessStatus === 'function'
                ? AppApi.GetRemoteAccessStatus
                : unavailable
    };
}

async function syncPasswordHashToNativeStorage(hash) {
    const nativeStorage = globalThis.VRCXStorage;
    if (!hash || typeof nativeStorage?.Set !== 'function') {
        return;
    }
    await nativeStorage.Set(PASSWORD_KEY, hash);
    if (typeof nativeStorage?.Save === 'function') {
        await nativeStorage.Save();
    }
}
