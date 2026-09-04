import { getGroupName, getWorldName, isRealInstance } from '../shared/utils';
import { AppDebug } from '../services/appConfig';
import { database } from '../services/database';
import { useFeedStore } from '../stores/feed';
import { useFriendStore } from '../stores/friend';
import { useNotificationStore } from '../stores/notification';
import { syncFriendSearchIndex } from './searchIndexCoordinator';
import { useSharedFeedStore } from '../stores/sharedFeed';
import { useUserStore } from '../stores/user';
import { userRequest } from '../api';
import { watchState } from '../services/watchState';
import { createFriendPresenceFeed } from './friendPresenceFeed';

/**
 * @param {object} ctx
 * @param {string} newState
 * @param {string} location
 * @param {number} $location_at
 * @param {object} [options] Test seams.
 * @param {function} [options.now] Timestamp provider.
 * @param {function} [options.nowIso] ISO timestamp provider.
 */
export async function runUpdateFriendDelayedCheckFlow(
    ctx,
    newState,
    location,
    $location_at,
    { now = Date.now, nowIso = () => new Date().toJSON() } = {}
) {
    return runUpdateFriendDelayedCheckFlowWithDependencies(
        ctx,
        newState,
        location,
        $location_at,
        {
            now,
            nowIso,
            friendStore: useFriendStore(),
            feedStore: useFeedStore(),
            notificationStore: useNotificationStore(),
            sharedFeedStore: useSharedFeedStore(),
            database
        }
    );
}

/**
 * Runs a friend presence transition with explicit state and side-effect capabilities.
 * The compatibility entry point above supplies the application's default adapters.
 *
 * @param {object} ctx
 * @param {string} newState
 * @param {string} location
 * @param {number} $location_at
 * @param {object} dependencies
 * @param {object} dependencies.friendStore
 * @param {object} dependencies.feedStore
 * @param {object} dependencies.notificationStore
 * @param {object} dependencies.sharedFeedStore
 * @param {object} dependencies.database
 * @param {function} [dependencies.now]
 * @param {function} [dependencies.nowIso]
 */
export async function runUpdateFriendDelayedCheckFlowWithDependencies(
    ctx,
    newState,
    location,
    $location_at,
    {
        friendStore,
        feedStore,
        notificationStore,
        sharedFeedStore,
        database: databaseApi,
        now = Date.now,
        nowIso = () => new Date().toJSON()
    }
) {
    const { friends, localFavoriteFriends } = friendStore;

    let feed;
    let groupName;
    let worldName;
    const id = ctx.id;
    if (AppDebug.debugFriendState) {
        console.log(
            `${ctx.name} updateFriendState ${ctx.state} -> ${newState}`
        );
        if (typeof ctx.ref !== 'undefined' && location !== ctx.ref.location) {
            console.log(
                `${ctx.name} pendingOfflineLocation ${location} -> ${ctx.ref.location}`
            );
        }
    }
    if (!friends.has(id)) {
        console.log('Friend not found', id);
        return;
    }
    const isVIP = localFavoriteFriends.has(id);
    const ref = ctx.ref;
    if (ctx.state !== newState && typeof ctx.ref !== 'undefined') {
        if (
            (newState === 'offline' || newState === 'active') &&
            ctx.state === 'online'
        ) {
            ctx.ref.$online_for = '';
            ctx.ref.$offline_for = now();
            ctx.ref.$active_for = '';
            if (newState === 'active') {
                ctx.ref.$active_for = now();
            }
            const ts = now();
            const time = ts - $location_at;
            worldName = await getWorldName(location);
            groupName = await getGroupName(location);
            feed = createFriendPresenceFeed({
                transition: 'offline',
                createdAt: nowIso(),
                userId: ref.id,
                displayName: ref.displayName,
                location,
                worldName,
                groupName,
                time
            });
            notificationStore.queueFeedNoty(feed);
            sharedFeedStore.addEntry(feed);
            feedStore.addFeedEntry(feed);
            databaseApi.addOnlineOfflineToDatabase(feed);
        } else if (
            newState === 'online' &&
            (ctx.state === 'offline' || ctx.state === 'active')
        ) {
            ctx.ref.$previousLocation = '';
            ctx.ref.$travelingToTime = now();
            ctx.ref.$location_at = now();
            ctx.ref.$online_for = now();
            ctx.ref.$offline_for = '';
            ctx.ref.$active_for = '';
            worldName = await getWorldName(location);
            groupName = await getGroupName(location);
            feed = createFriendPresenceFeed({
                transition: 'online',
                createdAt: nowIso(),
                userId: id,
                displayName: ctx.name,
                location,
                worldName,
                groupName,
                time: ''
            });
            notificationStore.queueFeedNoty(feed);
            sharedFeedStore.addEntry(feed);
            feedStore.addFeedEntry(feed);
            databaseApi.addOnlineOfflineToDatabase(feed);
        }
        if (newState === 'active') {
            ctx.ref.$active_for = now();
        }
    }
    if (ctx.state !== newState) {
        ctx.state = newState;
        friendStore.updateOnlineFriendCounter();
    }
    if (ref?.displayName) {
        ctx.name = ref.displayName;
        syncFriendSearchIndex(ctx);
    }
    ctx.isVIP = isVIP;
    friendStore.reindexSortedFriend(ctx);
}

/**
 * Handles immediate friend presence updates and pending-offline orchestration.
 * @param {string} id Friend id.
 * @param {string | undefined} stateInput Optional incoming state.
 * @param {object} [options] Test seams.
 * @param {function} [options.now] Timestamp provider.
 * @param {function} [options.nowIso] ISO timestamp provider.
 */
export async function runUpdateFriendFlow(
    id,
    stateInput = undefined,
    { now = Date.now, nowIso = () => new Date().toJSON() } = {}
) {
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    return runUpdateFriendFlowWithDependencies(id, stateInput, {
        now,
        nowIso,
        friendStore,
        userStore,
        isRealInstance,
        fetchUser: (args) => userRequest.getUser(args),
        watchState,
        debugFriendState: AppDebug.debugFriendState,
        syncFriendSearchIndex,
        runDelayedFlow: runUpdateFriendDelayedCheckFlow
    });
}

/**
 * Handles immediate friend presence updates with explicit capabilities.
 * The compatibility entry point above supplies the application's default adapters.
 *
 * @param {string} id Friend id.
 * @param {string | undefined} stateInput Optional incoming state.
 * @param {object} dependencies
 * @param {object} dependencies.friendStore
 * @param {object} dependencies.userStore
 * @param {function} dependencies.isRealInstance
 * @param {function} dependencies.fetchUser
 * @param {object} dependencies.watchState
 * @param {boolean} [dependencies.debugFriendState]
 * @param {function} dependencies.syncFriendSearchIndex
 * @param {function} dependencies.runDelayedFlow
 * @param {function} [dependencies.now]
 * @param {function} [dependencies.nowIso]
 */
export async function runUpdateFriendFlowWithDependencies(
    id,
    stateInput = undefined,
    {
        friendStore,
        userStore,
        isRealInstance: isRealInstanceFn,
        fetchUser,
        watchState: watchStateApi,
        debugFriendState = false,
        syncFriendSearchIndex: syncFriendSearchIndexFn,
        runDelayedFlow,
        now = Date.now,
        nowIso = () => new Date().toJSON()
    }
) {
    const { friends, localFavoriteFriends, pendingOfflineMap } = friendStore;

    const ctx = friends.get(id);
    if (typeof ctx === 'undefined') {
        return;
    }
    const ref = userStore.cachedUsers.get(id);

    if (stateInput === 'online') {
        const pendingOffline = pendingOfflineMap.get(id);
        if (debugFriendState && pendingOffline) {
            const time = (now() - pendingOffline.startTime) / 1000;
            console.log(`${ctx.name} pendingOfflineCancelTime ${time}`);
        }
        ctx.pendingOffline = false;
        pendingOfflineMap.delete(id);
    }
    const isVIP = localFavoriteFriends.has(id);
    let location = '';
    let $location_at = undefined;
    if (typeof ref !== 'undefined') {
        location = ref.location;
        $location_at = ref.$location_at;

        const currentState = stateInput || ctx.state;
        // wtf, fetch user if offline in an instance
        if (
            currentState !== 'online' &&
            isRealInstanceFn(ref.location) &&
            ref.$lastFetch < now() - 10000 // 10 seconds
        ) {
            console.log(`Fetching offline friend in an instance ${ctx.name}`);
            fetchUser({ userId: id });
        }
        // wtf, fetch user if online in an offline location
        if (
            currentState === 'online' &&
            ref.location === 'offline' &&
            ref.$lastFetch < now() - 10000 // 10 seconds
        ) {
            console.log(
                `Fetching online friend in an offline location ${ctx.name}`
            );
            fetchUser({ userId: id });
        }
    }
    if (typeof stateInput === 'undefined' || ctx.state === stateInput) {
        // this is should be: undefined -> user
        if (ctx.ref !== ref) {
            ctx.ref = ref;
            // NOTE
            // AddFriend (CurrentUser) 이후,
            // 서버에서 오는 순서라고 보면 될 듯.
            if (ctx.state === 'online') {
                if (watchStateApi.isFriendsLoaded) {
                    fetchUser({ userId: id });
                }
            }
        }
        if (ctx.isVIP !== isVIP) {
            ctx.isVIP = isVIP;
        }
        if (typeof ref !== 'undefined' && ctx.name !== ref.displayName) {
            ctx.name = ref.displayName;
            syncFriendSearchIndexFn(ctx);
        }
        friendStore.reindexSortedFriend(ctx);
        return;
    }
    if (
        ctx.state === 'online' &&
        (stateInput === 'active' || stateInput === 'offline')
    ) {
        ctx.ref = ref;
        ctx.isVIP = isVIP;
        if (typeof ref !== 'undefined') {
            ctx.name = ref.displayName;
            syncFriendSearchIndexFn(ctx);
        }
        if (!watchStateApi.isFriendsLoaded) {
            await runDelayedFlow(ctx, stateInput, location, $location_at, {
                now,
                nowIso
            });
            return;
        }
        // prevent status flapping
        if (pendingOfflineMap.has(id)) {
            if (debugFriendState) {
                console.log(ctx.name, 'pendingOfflineAlreadyWaiting');
            }
            return;
        }
        if (debugFriendState) {
            console.log(ctx.name, 'pendingOfflineBegin');
        }
        pendingOfflineMap.set(id, {
            startTime: now(),
            newState: stateInput,
            previousLocation: location,
            previousLocationAt: $location_at
        });
        ctx.pendingOffline = true;
        friendStore.reindexSortedFriend(ctx);
        return;
    }
    ctx.ref = ref;
    ctx.isVIP = isVIP;
    if (typeof ref !== 'undefined') {
        ctx.name = ref.displayName;
        syncFriendSearchIndexFn(ctx);
        await runDelayedFlow(ctx, ctx.ref.state, location, $location_at, {
            now,
            nowIso
        });
    } else {
        friendStore.reindexSortedFriend(ctx);
    }
}

/**
 * Processes pending-offline entries and executes delayed transitions.
 * @param {object} [options] Test seams.
 * @param {function} [options.now] Timestamp provider.
 * @param {function} [options.nowIso] ISO timestamp provider.
 */
export async function runPendingOfflineTickFlow({
    now = Date.now,
    nowIso = () => new Date().toJSON()
} = {}) {
    const friendStore = useFriendStore();
    const { friends, pendingOfflineMap, pendingOfflineDelay } = friendStore;

    const currentTime = now();
    for (const [id, pending] of pendingOfflineMap.entries()) {
        if (currentTime - pending.startTime >= pendingOfflineDelay) {
            const ctx = friends.get(id);
            if (typeof ctx === 'undefined') {
                pendingOfflineMap.delete(id);
                continue;
            }
            ctx.pendingOffline = false;
            if (pending.newState === ctx.state) {
                console.error(
                    ctx.name,
                    'pendingOfflineCancelledStateMatched, this should never happen'
                );
                pendingOfflineMap.delete(id);
                continue;
            }
            if (AppDebug.debugFriendState) {
                console.log(ctx.name, 'pendingOfflineEnd');
            }
            pendingOfflineMap.delete(id);
            await runUpdateFriendDelayedCheckFlow(
                ctx,
                pending.newState,
                pending.previousLocation,
                pending.previousLocationAt,
                { now, nowIso }
            );
        }
    }
}
