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

function applyStatus(status, refs) {
    refs.running.value = Boolean(status?.running);
    refs.url.value =
        status?.url ||
        (refs.running.value
            ? `http://${getLocalHostHint()}:${refs.port.value}/`
            : '');
    refs.error.value = status?.error || '';
    refs.localOnly.value = Boolean(status?.localOnly);
    refs.lanAccessReady.value = Boolean(status?.lanAccessReady);
    refs.lanAddress.value = status?.lanAddress || '';
}

export const useRemoteAccessStore = defineStore('RemoteAccess', () => {
    const enabled = ref(false);
    const port = ref(23580);
    const hasPassword = ref(false);
    const privacyMode = ref(false);
    const running = ref(false);
    const url = ref('');
    const error = ref('');
    const localOnly = ref(false);
    const lanAccessReady = ref(false);
    const lanAddress = ref('');
    let initialized = false;

    const canStart = computed(() => hasPassword.value && port.value > 0);
    const refs = {
        port,
        running,
        url,
        error,
        localOnly,
        lanAccessReady,
        lanAddress
    };

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
            applyStatus(await getNativeRemoteApi().status(), refs);
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
            applyStatus(status, refs);
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
            localOnly.value = false;
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

    async function repairLanAccess() {
        error.value = '';
        try {
            const status = await getNativeRemoteApi().repair(port.value);
            applyStatus(status, refs);
            if (error.value) {
                toast.error(error.value);
                return false;
            }
            if (enabled.value) {
                const restartedStatus = await start();
                if (
                    !restartedStatus?.running ||
                    restartedStatus?.localOnly ||
                    restartedStatus?.error
                ) {
                    error.value =
                        restartedStatus?.error ||
                        '局域网访问权限仍未生效，请确认 UAC 已允许后重试。';
                    toast.error(error.value);
                    return false;
                }
            }
            return true;
        } catch (err) {
            error.value = err?.message || String(err);
            toast.error(error.value);
            return false;
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
        localOnly,
        lanAccessReady,
        lanAddress,
        canStart,
        init,
        refreshStatus,
        start,
        stop,
        setEnabled,
        setPort,
        setPrivacyMode,
        setPassword,
        repairLanAccess
    };
});

function getNativeRemoteApi() {
    const unavailable = () =>
        Promise.reject(new Error(NATIVE_API_UNAVAILABLE_MESSAGE));
    if (
        typeof window.electron?.startRemoteAccessServer === 'function' ||
        typeof window.electron?.stopRemoteAccessServer === 'function' ||
        typeof window.electron?.getRemoteAccessStatus === 'function' ||
        typeof window.electron?.repairRemoteAccessLan === 'function'
    ) {
        return {
            start: window.electron.startRemoteAccessServer || unavailable,
            stop: window.electron.stopRemoteAccessServer || unavailable,
            status: window.electron.getRemoteAccessStatus || unavailable,
            repair: window.electron.repairRemoteAccessLan || unavailable
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
                : unavailable,
        repair:
            typeof AppApi?.RepairRemoteAccessLan === 'function'
                ? AppApi.RepairRemoteAccessLan
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
