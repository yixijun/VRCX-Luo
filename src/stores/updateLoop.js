import { defineStore } from 'pinia';
import { watch } from 'vue';

import { database } from '../services/database';
import { groupRequest } from '../api';
import { runRefreshFriendsListFlow } from '../coordinators/friendSyncCoordinator';
import { runUpdateIsGameRunningFlow } from '../coordinators/gameCoordinator';
import { addGameLogEvent } from '../coordinators/gameLogCoordinator';
import { runRefreshPlayerModerationsFlow } from '../coordinators/moderationCoordinator';
import { refreshTrackedNonFriendsFlow } from '../coordinators/nonFriendCoordinator';
import { clearVRCXCache } from '../coordinators/vrcxCoordinator';
import { useAuthStore } from './auth';
import { useDiscordPresenceSettingsStore } from './settings/discordPresence';
import { useFriendStore } from './friend';
import { handleGroupUserInstances } from '../coordinators/groupCoordinator';
import {
    getCurrentUser,
    updateAutoStateChange
} from '../coordinators/userCoordinator';
import { useUserStore } from './user';
import { useVRCXUpdaterStore } from './vrcxUpdater';
import { useVrStore } from './vr';
import { useVrcxStore } from './vrcx';
import { watchState } from '../services/watchState';

import * as workerTimers from 'worker-timers';
import { createCurrentUserTask } from './updateLoopTasks/currentUserTask';
import { createFriendSyncTask } from './updateLoopTasks/friendSyncTask';
import { createGroupInstanceTask } from './updateLoopTasks/groupInstanceTask';
import { createGameStateTask } from './updateLoopTasks/gameStateTask';
import { createUpdateCheckTask } from './updateLoopTasks/updateCheckTask';
import { createDiscordTask } from './updateLoopTasks/discordTask';
import { createNonFriendSyncTask } from './updateLoopTasks/nonFriendSyncTask';
import { createIpcTimeoutTask } from './updateLoopTasks/ipcTimeoutTask';
import { createCacheCleanupTask } from './updateLoopTasks/cacheCleanupTask';
import { createAutoStateTask } from './updateLoopTasks/autoStateTask';
import { createDatabaseOptimizeTask } from './updateLoopTasks/databaseOptimizeTask';

export const useUpdateLoopStore = defineStore('UpdateLoop', () => {
    const authStore = useAuthStore();
    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const vrcxStore = useVrcxStore();
    const discordPresenceSettingsStore = useDiscordPresenceSettingsStore();
    const vrcxUpdaterStore = useVRCXUpdaterStore();
    const vrStore = useVrStore();
    const currentUserTask = createCurrentUserTask({ getCurrentUser });
    const friendSyncTask = createFriendSyncTask({
        refreshFriends: runRefreshFriendsListFlow,
        getCurrentUser: () => userStore.currentUser,
        updateStoredUser: (currentUser) =>
            authStore.updateStoredUser(currentUser),
        refreshPlayerModerations: runRefreshPlayerModerationsFlow,
        now: () => Date.now()
    });
    const groupInstanceTask = createGroupInstanceTask({
        isFriendsLoaded: () => watchState.isFriendsLoaded,
        getUsersGroupInstances: () => groupRequest.getUsersGroupInstances(),
        handleGroupUserInstances,
        checkGameRunning: () => AppApi.CheckGameRunning()
    });
    const gameStateTask = createGameStateTask({
        isLinux: LINUX,
        getLogLines: () => LogWatcher.GetLogLines(),
        addGameLogEvent,
        getIsGameRunning: () => AppApi.IsGameRunning(),
        getIsSteamVRRunning: () => AppApi.IsSteamVRRunning(),
        updateIsGameRunning: runUpdateIsGameRunningFlow,
        initVr: () => vrStore.vrInit()
    });
    const updateCheckTask = createUpdateCheckTask({
        getAutoUpdateMode: () => vrcxUpdaterStore.autoUpdateVRCX,
        checkForVRCXUpdate: () => vrcxUpdaterStore.checkForVRCXUpdate(),
        tryAutoBackupVrcRegistry: () => vrcxStore.tryAutoBackupVrcRegistry()
    });
    const discordTask = createDiscordTask({
        isActive: () => discordPresenceSettingsStore.discordActive,
        updateDiscord: () => discordPresenceSettingsStore.updateDiscord()
    });
    const nonFriendSyncTask = createNonFriendSyncTask({
        refreshTrackedNonFriends: refreshTrackedNonFriendsFlow
    });
    const ipcTimeoutTask = createIpcTimeoutTask({
        setIpcEnabled: (enabled) => vrcxStore.setIpcEnabled(enabled)
    });
    const cacheCleanupTask = createCacheCleanupTask({
        getFrequency: () => vrcxStore.clearVRCXCacheFrequency,
        clearCache: clearVRCXCache
    });
    const autoStateTask = createAutoStateTask({
        updateAutoStateChange
    });
    const databaseOptimizeTask = createDatabaseOptimizeTask({
        optimize: () => database.optimize(),
        onError: console.error
    });
    const state = {
        nextCurrentUserRefresh: 300,
        nextFriendsRefresh: 3600,
        nextNonFriendRefresh: 3600,
        nextGroupInstanceRefresh: 0,
        nextAppUpdateCheck: 3600,
        ipcTimeout: 0,
        nextClearVRCXCacheCheck: 86400,
        nextDiscordUpdate: 0,
        nextAutoStateChange: 0,
        nextGetLogCheck: 0,
        nextGameRunningCheck: 0,
        nextDatabaseOptimize: 3600
    };

    watch(
        () => watchState.isLoggedIn,
        () => {
            state.nextCurrentUserRefresh = 300;
            currentUserTask.reset();
            state.nextFriendsRefresh = 3600;
            friendSyncTask.reset();
            state.nextNonFriendRefresh = 3600;
            nonFriendSyncTask.reset();
            state.nextGroupInstanceRefresh = 0;
            groupInstanceTask.reset();
        },
        { flush: 'sync' }
    );

    const nextGroupInstanceRefresh = state.nextGroupInstanceRefresh;

    const nextCurrentUserRefresh = state.nextCurrentUserRefresh;

    const nextDiscordUpdate = state.nextDiscordUpdate;

    const ipcTimeout = state.ipcTimeout;

    /**
     *
     */
    async function updateLoop() {
        try {
            if (watchState.isLoggedIn) {
                currentUserTask.tick();
                friendSyncTask.tick();
                nonFriendSyncTask.tick();
                await groupInstanceTask.tick();
                updateCheckTask.tick();
                ipcTimeoutTask.tick();
                cacheCleanupTask.tick();
                discordTask.tick();
                autoStateTask.tick();
                await gameStateTask.tick();
                databaseOptimizeTask.tick();
            }
        } catch (err) {
            friendStore.setIsRefreshFriendsLoading(false);
            console.error(err);
        }
        workerTimers.setTimeout(() => updateLoop(), 1000);
    }

    /**
     *
     * @param value
     */
    function setNextClearVRCXCacheCheck(value) {
        cacheCleanupTask.setNext(value);
    }

    /**
     *
     * @param value
     */
    function setNextGroupInstanceRefresh(value) {
        groupInstanceTask.setNext(value);
    }

    /**
     *
     * @param value
     */
    function setNextDiscordUpdate(value) {
        discordTask.setNext(value);
    }

    /**
     *
     * @param value
     */
    function setIpcTimeout(value) {
        ipcTimeoutTask.setNext(value);
    }

    /**
     *
     * @param value
     */
    function setNextCurrentUserRefresh(value) {
        currentUserTask.setNext(value);
    }

    return {
        // state,

        nextGroupInstanceRefresh,
        nextCurrentUserRefresh,
        nextDiscordUpdate,
        ipcTimeout,
        updateLoop,
        setIpcTimeout,
        setNextCurrentUserRefresh,
        setNextDiscordUpdate,
        setNextGroupInstanceRefresh,
        setNextClearVRCXCacheCheck
    };
});
