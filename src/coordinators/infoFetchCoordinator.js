import { reactive } from 'vue';
import { database } from '../services/database';
import {
    useFriendStore,
    useTrackedNonFriendsStore,
    useManualRelationsStore,
    useUserStore
} from '../stores';
import { userRequest } from '../api';
import { recordBioSnapshotForUser } from './bioSnapshotCoordinator';

/**
 * 信息抓取补全的全局响应式状态。
 * StatusBar / ProfileCompletionDialog 等 UI 组件直接读取此对象即可。
 */
export const infoFetchState = reactive({
    /** 'idle' | 'running' | 'computing' | 'done' | 'partial' | 'failed' | 'cancelled' */
    status: 'idle',
    done: 0,
    total: 0,
    friendsTotal: 0,
    trackedTotal: 0,
    bioUpdated: 0,
    statusUpdated: 0,
    succeeded: 0,
    failed: 0,
    failureCount: 0,
    failures: [],
    failedTargets: [],
    startedAt: null,
    finishedAt: null
});

let cancelled = false;

/**
 * 取消正在进行的抓取。
 */
export function cancelInfoFetch() {
    cancelled = true;
}

/**
 * 获取当前待扫描的目标总数（好友 + 追踪非好友，去重）。
 * 用于 ProfileCompletionDialog 在未启动时显示目标数。
 */
export function getTargetCount() {
    const friendStore = useFriendStore();
    const trackedStore = useTrackedNonFriendsStore();
    const seenIdsForFriends = new Set();
    const seenIdsForTracked = new Set();

    for (const ctx of friendStore.friends.values()) {
        seenIdsForFriends.add(ctx.id);
    }
    for (const item of trackedStore.trackedList) {
        if (!seenIdsForFriends.has(item.userId)) {
            seenIdsForTracked.add(item.userId);
        }
    }
    return {
        friends: seenIdsForFriends.size,
        tracked: seenIdsForTracked.size,
        total: seenIdsForFriends.size + seenIdsForTracked.size
    };
}

/**
 * 构建扫描目标列表（好友 + 追踪非好友，去重）。
 * @returns {Array<{userId: string, displayName: string}>}
 */
function buildTargetList() {
    const friendStore = useFriendStore();
    const trackedStore = useTrackedNonFriendsStore();
    const list = [];
    const seenIds = new Set();

    for (const ctx of friendStore.friends.values()) {
        list.push({ userId: ctx.id, displayName: ctx.name });
        seenIds.add(ctx.id);
    }

    for (const item of trackedStore.trackedList) {
        if (!seenIds.has(item.userId)) {
            list.push({ userId: item.userId, displayName: item.displayName });
            seenIds.add(item.userId);
        }
    }

    return list;
}

function normalizeTargets(targets) {
    const seenIds = new Set();
    return (targets || []).filter((target) => {
        if (!target?.userId || seenIds.has(target.userId)) {
            return false;
        }
        seenIds.add(target.userId);
        return true;
    });
}

function resetRunState(targets) {
    infoFetchState.status = 'running';
    infoFetchState.done = 0;
    infoFetchState.total = targets.length;
    infoFetchState.friendsTotal = 0;
    infoFetchState.trackedTotal = 0;
    infoFetchState.bioUpdated = 0;
    infoFetchState.statusUpdated = 0;
    infoFetchState.succeeded = 0;
    infoFetchState.failed = 0;
    infoFetchState.failureCount = 0;
    infoFetchState.failures = [];
    infoFetchState.failedTargets = [];
    infoFetchState.startedAt = Date.now();
    infoFetchState.finishedAt = null;
}

function getErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error || 'Unknown error');
}

function recordFailure(target, stage, error, failedTargetIds) {
    infoFetchState.failures.push({
        userId: target?.userId || '',
        displayName: target?.displayName || '',
        stage,
        message: getErrorMessage(error)
    });
    infoFetchState.failureCount += 1;
    if (target?.userId && !failedTargetIds.has(target.userId)) {
        failedTargetIds.add(target.userId);
        infoFetchState.failedTargets.push({ ...target });
    }
}

async function fetchWithRetry(target, stage, request, failedTargetIds) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const result = await request();
            return { value: result?.json || null, cancelled: false };
        } catch (error) {
            if (attempt === 0) {
                if (cancelled) {
                    return { value: null, cancelled: true };
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
                if (cancelled) {
                    return { value: null, cancelled: true };
                }
                continue;
            }
            recordFailure(target, stage, error, failedTargetIds);
            return { value: null, cancelled: false };
        }
    }
    return { value: null, cancelled: false };
}

/**
 * 执行全量信息抓取补全（个人简介 + 隐私状态）。
 * 通过 API 强制刷新每个用户的资料，与数据库对比后写入变更记录。
 *
 * 可由启动、L4 末尾、用户手动点击、ProfileCompletionDialog 等多处调用，内建防重入。
 */
export async function runSilentInfoFetch(options = {}) {
    if (
        infoFetchState.status === 'running' ||
        infoFetchState.status === 'computing'
    )
        return;

    cancelled = false;

    const targets = normalizeTargets(options.targets || buildTargetList());
    const counts = getTargetCount();
    const currentUserId = useUserStore().currentUser.id;
    resetRunState(targets);
    infoFetchState.total = targets.length;
    infoFetchState.friendsTotal = Array.isArray(options.targets)
        ? targets.length
        : counts.friends;
    infoFetchState.trackedTotal = Array.isArray(options.targets)
        ? 0
        : counts.tracked;

    if (targets.length === 0) {
        infoFetchState.status = 'done';
        infoFetchState.finishedAt = Date.now();
        return;
    }

    console.log(
        `[InfoFetch] 开始抓取，共 ${targets.length} 个目标（好友 + 追踪非好友）`
    );
    const failedTargetIds = new Set();

    for (const target of targets) {
        if (cancelled) break;

        const userResult = await fetchWithRetry(
            target,
            'user_fetch',
            () => userRequest.getUser({ userId: target.userId }),
            failedTargetIds
        );
        if (userResult.cancelled) break;
        const userJson = userResult.value;
        if (cancelled) break;

        const profileResult = await fetchWithRetry(
            target,
            'profile_fetch',
            () => userRequest.getPublicProfile({ userId: target.userId }),
            failedTargetIds
        );
        if (profileResult.cancelled) break;
        const profileJson = profileResult.value;
        if (cancelled) break;

        if (profileJson && typeof profileJson.bio === 'string') {
            try {
                const recorded = await recordBioSnapshotForUser({
                    database,
                    userId: profileJson.id || userJson?.id || target.userId,
                    currentUserId,
                    currentBio: profileJson.bio,
                    previousBio: undefined,
                    isFriend: false,
                    displayName:
                        profileJson.displayName ||
                        userJson?.displayName ||
                        target.displayName
                });
                if (recorded) {
                    infoFetchState.bioUpdated++;
                }
            } catch (error) {
                recordFailure(target, 'bio_archive', error, failedTargetIds);
            }
        }

        if (userJson) {
            const userId = userJson.id;
            const displayName = userJson.displayName || target.displayName;

            // Status/灯色 对比
            try {
                const currentStatus = userJson.status || 'offline';
                const currentStatusDesc = userJson.statusDescription || '';

                const validStatuses = ['join me', 'active', 'ask me', 'busy'];
                if (validStatuses.includes(currentStatus)) {
                    const lastStatus =
                        await database.getLastStatusChangeForUser(userId);
                    if (
                        !lastStatus ||
                        lastStatus.status !== currentStatus ||
                        lastStatus.statusDescription !== currentStatusDesc
                    ) {
                        database.addStatusToDatabase({
                            created_at: new Date().toJSON(),
                            userId,
                            displayName,
                            status: currentStatus,
                            statusDescription: currentStatusDesc,
                            previousStatus: lastStatus ? lastStatus.status : '',
                            previousStatusDescription: lastStatus
                                ? lastStatus.statusDescription
                                : ''
                        });
                        infoFetchState.statusUpdated++;
                    }
                }
            } catch (error) {
                recordFailure(target, 'status_archive', error, failedTargetIds);
            }
        }

        if (cancelled) break;
        infoFetchState.done++;
    }

    infoFetchState.failed = failedTargetIds.size;
    infoFetchState.succeeded = Math.max(
        0,
        infoFetchState.done - infoFetchState.failed
    );

    if (!cancelled) {
        infoFetchState.status = 'computing';
        try {
            await useManualRelationsStore().computeSuggestions();
        } catch (error) {
            recordFailure(null, 'relationship_compute', error, failedTargetIds);
        }
        if (infoFetchState.failureCount === 0) {
            infoFetchState.status = 'done';
        } else if (infoFetchState.succeeded > 0) {
            infoFetchState.status = 'partial';
        } else {
            infoFetchState.status = 'failed';
        }
    } else {
        infoFetchState.status = 'cancelled';
        console.log('[InfoFetch] 已取消');
    }

    infoFetchState.finishedAt = Date.now();
    console.log(
        `[InfoFetch] 完成：处理 ${infoFetchState.done}/${infoFetchState.total}，失败目标 ${infoFetchState.failed}，Bio 更新 ${infoFetchState.bioUpdated} 条，Status 更新 ${infoFetchState.statusUpdated} 条`
    );
}

export function retryFailedInfoFetch() {
    if (
        infoFetchState.status === 'running' ||
        infoFetchState.status === 'computing'
    ) {
        return Promise.resolve();
    }
    const targets = infoFetchState.failedTargets.map((target) => ({
        ...target
    }));
    return runSilentInfoFetch(targets.length ? { targets } : {});
}
