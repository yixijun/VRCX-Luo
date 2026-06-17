import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';

import { useFriendStore } from './friend';
import { useGameStore } from './game';
import { useLaunchStore } from './launch';
import { useLocationStore } from './location';
import { useModalStore } from './modal';
import { isRealInstance } from '../shared/utils/instance';
import { parseLocation } from '../shared/utils/locationParser';
import configRepository from '../services/config';

const DEFAULT_JOIN_COOLDOWN_SECONDS = 15;
const MIN_JOIN_COOLDOWN_SECONDS = 3;
const MAX_JOIN_COOLDOWN_SECONDS = 120;
const JOIN_COOLDOWN_CONFIG_KEY = 'VRCX_autoFollowJoinCooldownMs';

function clampJoinCooldownSeconds(value) {
    const seconds = Number.parseInt(value, 10);
    if (!Number.isFinite(seconds)) {
        return DEFAULT_JOIN_COOLDOWN_SECONDS;
    }
    return Math.min(
        MAX_JOIN_COOLDOWN_SECONDS,
        Math.max(MIN_JOIN_COOLDOWN_SECONDS, seconds)
    );
}

function getFollowTarget(friendRef) {
    const location = friendRef?.travelingToLocation || friendRef?.$travelingToLocation || friendRef?.location || friendRef?.$locationTag || '';
    if (!isRealInstance(location)) {
        return {
            location: '',
            shortName: ''
        };
    }
    const parsedLocation = parseLocation(location);
    const locationInfo = friendRef?.$location || {};
    return {
        location,
        shortName: parsedLocation.shortName || locationInfo.shortName || friendRef?.shortName || friendRef?.secureName || ''
    };
}

function getFollowLocation(friendRef) {
    return getFollowTarget(friendRef).location;
}

function sameInstance(a, b) {
    if (!isRealInstance(a) || !isRealInstance(b)) {
        return false;
    }
    const left = parseLocation(a);
    const right = parseLocation(b);
    return left.worldId === right.worldId && left.instanceId === right.instanceId;
}

export const useAutoFollowStore = defineStore('AutoFollow', () => {
    const isActive = ref(false);
    const targetFriendId = ref('');
    const targetFriendName = ref('');
    const targetLocation = ref('');
    const statusText = ref('');
    const isJoining = ref(false);
    const launchMode = ref('desktop');
    const preferredLaunchMode = ref('');
    const joinCooldownSeconds = ref(DEFAULT_JOIN_COOLDOWN_SECONDS);

    let unwatchFriend = null;
    let lastJoinLocation = '';
    let lastJoinAt = 0;
    let joinCooldownEditVersion = 0;

    const activeLabel = computed(() => {
        if (!isActive.value) {
            return '自动跟随';
        }
        return targetFriendName.value ? `跟随中：${targetFriendName.value}` : '跟随中';
    });

    function cleanupWatcher() {
        if (unwatchFriend) {
            unwatchFriend();
            unwatchFriend = null;
        }
    }

    function resolveFriendRef(friend) {
        return friend?.ref || friend || null;
    }

    function getCurrentTargetRef() {
        if (!targetFriendId.value) {
            return null;
        }
        return useFriendStore().friends.get(targetFriendId.value)?.ref || null;
    }

    function normalizeInstanceKey(location) {
        if (!isRealInstance(location)) {
            return '';
        }
        const parsed = parseLocation(location);
        return `${parsed.worldId}:${parsed.instanceName || parsed.instanceId}`;
    }

    function canJoinNow(location) {
        if (!isRealInstance(location)) {
            return false;
        }
        const now = Date.now();
        return (
            normalizeInstanceKey(location) !== lastJoinLocation ||
            now - lastJoinAt > joinCooldownSeconds.value * 1000
        );
    }

    function rememberJoinAttempt(location) {
        lastJoinLocation = normalizeInstanceKey(location);
        lastJoinAt = Date.now();
    }

    async function readRuntimeState() {
        const gameStore = useGameStore();
        let isGameRunning = gameStore.isGameRunning;
        let isSteamVRRunning = gameStore.isSteamVRRunning;
        try {
            [isGameRunning, isSteamVRRunning] = await Promise.all([
                AppApi.IsGameRunning(),
                AppApi.IsSteamVRRunning()
            ]);
            gameStore.setIsGameRunning?.(isGameRunning);
            gameStore.setIsSteamVRRunning?.(isSteamVRRunning);
        } catch (err) {
            console.warn('Failed to read game runtime state', err);
        }
        return {
            isGameRunning,
            isGameNoVR: gameStore.isGameNoVR,
            isSteamVRRunning
        };
    }

    function resolveLaunchModeFromRuntime(value, runtimeState) {
        if (value === 'desktop' || value === 'vr') {
            return value;
        }
        if (runtimeState.isGameRunning && !runtimeState.isGameNoVR) {
            return 'vr';
        }
        if (!runtimeState.isGameRunning && runtimeState.isSteamVRRunning) {
            return 'vr';
        }
        return 'desktop';
    }

    async function runJoin(location, reason = 'manual', shortName = '') {
        if (!isRealInstance(location) || isJoining.value) {
            return false;
        }

        const launchStore = useLaunchStore();
        const locationStore = useLocationStore();

        if (sameInstance(location, locationStore.lastLocation.location)) {
            statusText.value = '已在同一房间，正在监听好友位置变化';
            return true;
        }

        if (!canJoinNow(location)) {
            statusText.value = '自动跟随冷却中，正在等待下一次位置变化';
            return false;
        }

        isJoining.value = true;
        rememberJoinAttempt(location);
        statusText.value = reason === 'changed' ? '好友切换房间，正在跟随' : '正在加入好友所在房间';

        try {
            const runtimeState = await readRuntimeState();
            const mode = resolveLaunchModeFromRuntime(
                preferredLaunchMode.value,
                runtimeState
            );
            launchMode.value = mode;
            if (mode === 'vr') {
                if (runtimeState.isGameRunning) {
                    await launchStore.tryOpenInstanceInVrc(location, shortName || null);
                } else {
                    await launchStore.launchGame(location, shortName || null, false);
                }
            } else {
                if (runtimeState.isGameRunning) {
                    await AppApi.QuitGame();
                }
                await launchStore.launchGame(location, shortName || null, true);
            }
            return true;
        } catch (err) {
            console.error('Auto follow failed', err);
            toast.error('自动跟随失败');
            return false;
        } finally {
            isJoining.value = false;
        }
    }

    function watchTargetFriend() {
        cleanupWatcher();
        const friendStore = useFriendStore();
        unwatchFriend = watch(
            () => {
                const ref = getCurrentTargetRef();
                return getFollowTarget(ref);
            },
            async (target, previousTarget) => {
                const location = target.location;
                if (!isActive.value) {
                    return;
                }
                if (!friendStore.friends.has(targetFriendId.value)) {
                    stopFollow({ silent: true });
                    return;
                }
                if (!location) {
                    statusText.value = '好友离线或暂时没有可加入房间，等待重新上线';
                    return;
                }
                targetLocation.value = location;
                if (location === previousTarget.location) {
                    return;
                }
                await runJoin(location, 'changed', target.shortName);
            },
            { flush: 'sync' }
        );
    }

    async function confirmStart(friendRef, location, sameRoom) {
        const modalStore = useModalStore();
        const name = friendRef.displayName || friendRef.name || friendRef.id;
        const modeText = !location
            ? '该好友当前没有可加入房间。开启后会等待好友进入可加入房间，然后自动跟随。'
            : sameRoom
            ? '你已经和该好友在同一个房间。开启后只会监听后续换房间。'
            : '开启后会尝试加入该好友当前房间，并继续监听后续换房间。PC 桌面模式会重启 VRChat 加入实例，VR 模式会直接打开实例链接。';
        const result = await modalStore.confirm({
            title: '自动跟随',
            description: `确定要自动跟随 ${name} 吗？\n${modeText}`,
            confirmText: '开启',
            cancelText: '取消'
        });
        return result.ok;
    }

    async function confirmStop() {
        const modalStore = useModalStore();
        const result = await modalStore.confirm({
            title: '自动跟随',
            description: targetFriendName.value
                ? `是否取消跟随 ${targetFriendName.value}？`
                : '是否取消自动跟随？',
            confirmText: '取消跟随',
            cancelText: '继续跟随',
            destructive: true
        });
        return result.ok;
    }

    async function startFollow(friend, options = {}) {
        const friendRef = resolveFriendRef(friend);
        if (!friendRef?.id) {
            toast.warning('无法开启自动跟随：缺少好友信息');
            return false;
        }

        const target = getFollowTarget(friendRef);
        const location = target.location;

        const locationStore = useLocationStore();
        const isSameRoom = sameInstance(location, locationStore.lastLocation.location);
        if (options.confirm !== false) {
            const ok = await confirmStart(friendRef, location, isSameRoom);
            if (!ok) {
                return false;
            }
        }

        isActive.value = true;
        targetFriendId.value = friendRef.id;
        targetFriendName.value = friendRef.displayName || friendRef.name || friendRef.id;
        targetLocation.value = location;
        preferredLaunchMode.value =
            options.launchMode === 'desktop' || options.launchMode === 'vr'
                ? options.launchMode
                : '';
        launchMode.value = resolveLaunchModeFromRuntime(
            preferredLaunchMode.value,
            await readRuntimeState()
        );
        statusText.value = !location
            ? '好友当前没有可加入房间，等待好友进入可加入房间'
            : isSameRoom ? '已在同一房间，正在监听好友位置变化' : '已开启，准备加入好友房间';
        watchTargetFriend();
        toast.success(`自动跟随已开启：${targetFriendName.value}`);

        if (options.initialJoin !== false && location && !isSameRoom) {
            await runJoin(location, 'initial', target.shortName);
        }
        return true;
    }

    async function stopFollow(options = {}) {
        if (!isActive.value) {
            return false;
        }
        if (options.confirm && !(await confirmStop())) {
            return false;
        }
        const name = targetFriendName.value;
        isActive.value = false;
        targetFriendId.value = '';
        targetFriendName.value = '';
        targetLocation.value = '';
        statusText.value = '';
        isJoining.value = false;
        launchMode.value = 'desktop';
        preferredLaunchMode.value = '';
        lastJoinLocation = '';
        lastJoinAt = 0;
        cleanupWatcher();
        if (!options.silent) {
            toast.success(name ? `自动跟随已停止：${name}` : '自动跟随已停止');
        }
        return true;
    }

    async function toggleFollow(friend, options = {}) {
        const friendRef = resolveFriendRef(friend);
        if (isActive.value && friendRef?.id === targetFriendId.value) {
            return stopFollow({ confirm: true });
        }
        return startFollow(friendRef, {
            confirm: true,
            initialJoin: true,
            launchMode: options.launchMode
        });
    }

    async function loadJoinCooldownSeconds() {
        const editVersion = joinCooldownEditVersion;
        const storedMs = await configRepository.getInt(
            JOIN_COOLDOWN_CONFIG_KEY,
            DEFAULT_JOIN_COOLDOWN_SECONDS * 1000
        );
        if (editVersion !== joinCooldownEditVersion) {
            return;
        }
        joinCooldownSeconds.value = clampJoinCooldownSeconds(
            Math.round(storedMs / 1000)
        );
    }

    async function setJoinCooldownSeconds(value) {
        joinCooldownEditVersion++;
        const seconds = clampJoinCooldownSeconds(value);
        joinCooldownSeconds.value = seconds;
        await configRepository.setInt(JOIN_COOLDOWN_CONFIG_KEY, seconds * 1000);
    }

    loadJoinCooldownSeconds();

    return {
        isActive,
        targetFriendId,
        targetFriendName,
        targetLocation,
        statusText,
        isJoining,
        launchMode,
        joinCooldownSeconds,
        activeLabel,
        startFollow,
        stopFollow,
        toggleFollow,
        setJoinCooldownSeconds
    };
});
