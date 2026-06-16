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

const JOIN_COOLDOWN_MS = 15_000;

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

    let unwatchFriend = null;
    let lastJoinLocation = '';
    let lastJoinAt = 0;

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

    function canJoinNow(location) {
        if (!isRealInstance(location)) {
            return false;
        }
        const now = Date.now();
        return location !== lastJoinLocation || now - lastJoinAt > JOIN_COOLDOWN_MS;
    }

    async function runJoin(location, reason = 'manual', shortName = '') {
        if (!isRealInstance(location) || isJoining.value || !canJoinNow(location)) {
            return false;
        }

        const launchStore = useLaunchStore();
        const locationStore = useLocationStore();

        if (sameInstance(location, locationStore.lastLocation.location)) {
            statusText.value = '已在同一房间，正在监听好友位置变化';
            return true;
        }

        isJoining.value = true;
        lastJoinLocation = location;
        lastJoinAt = Date.now();
        statusText.value = reason === 'changed' ? '好友切换房间，正在跟随' : '正在加入好友所在房间';

        try {
            if (launchMode.value === 'desktop') {
                const gameStore = useGameStore();
                if (gameStore.isGameRunning) {
                    await AppApi.QuitGame();
                }
                await launchStore.launchGame(location, shortName || null, true);
            } else {
                await launchStore.tryOpenInstanceInVrc(location, shortName || null);
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
        const modeText = sameRoom
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
        if (!location) {
            toast.warning('无法开启自动跟随：该好友当前没有可加入的房间');
            return false;
        }

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
        launchMode.value = options.launchMode === 'vr' ? 'vr' : 'desktop';
        statusText.value = isSameRoom ? '已在同一房间，正在监听好友位置变化' : '已开启，准备加入好友房间';
        watchTargetFriend();
        toast.success(`自动跟随已开启：${targetFriendName.value}`);

        if (options.initialJoin !== false && !isSameRoom) {
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
            launchMode: options.launchMode || 'desktop'
        });
    }

    return {
        isActive,
        targetFriendId,
        targetFriendName,
        targetLocation,
        statusText,
        isJoining,
        launchMode,
        activeLabel,
        startFollow,
        stopFollow,
        toggleFollow
    };
});
