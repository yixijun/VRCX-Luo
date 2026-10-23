import { useFriendStore } from '../stores/friend';
import { useUserStore } from '../stores/user';
import { useGameStore } from '../stores/game';
import { useLocationStore } from '../stores/location';
import { useInstanceStore } from '../stores/instance';
import { useLaunchStore } from '../stores/launch';
import { useNotificationStore } from '../stores/notification';
import { useNotificationsSettingsStore } from '../stores/settings/notifications';
import { useWristOverlaySettingsStore } from '../stores/settings/wristOverlay';
import { notificationRequest } from '../api';
import { isRealInstance, checkCanInvite } from '../shared/utils';
import { watchState } from './watchState';
import { createVrDashboardController } from './vrDashboardController';

export function createVrDashboard(saveOptions) {
    function context() {
        return {
            accountId: watchState.isLoggedIn ? useUserStore().currentUser.id : '',
            friends: Array.from(useFriendStore().friends.values()),
            invites: useNotificationStore().notificationTable.data.filter((row) => row.type === 'invite' && !row.hidden && !useNotificationStore().isNotificationExpired(row))
        };
    }
    function snapshot() {
        const ctx = context();
        const notifications = useNotificationsSettingsStore();
        return {
            accountId: ctx.accountId,
            displayName: useUserStore().currentUser.displayName || '',
            gameRunning: useGameStore().isGameRunning,
            location: useLocationStore().lastLocation.name || '',
            settings: { wrist: useWristOverlaySettingsStore().overlayWrist, hud: notifications.overlayNotifications, silent: notifications.traySilentMode, sleep: notifications.vSleepMode },
            friends: ctx.accountId ? ctx.friends.map((friend) => ({
                id: friend.id, name: friend.ref?.displayName || friend.name || friend.id,
                online: friend.state !== 'offline', favorite: friend.isVIP === true,
                world: friend.ref?.$location?.name || friend.ref?.$location?.worldName || '',
                canJoin: isRealInstance(friend.ref?.$location?.tag || friend.ref?.location || '')
            })).sort((a,b) => Number(b.online)-Number(a.online) || Number(b.favorite)-Number(a.favorite) || a.name.localeCompare(b.name)) : [],
            invites: ctx.accountId ? ctx.invites.map((row) => ({id: row.id, name: row.senderUsername || row.username || '好友', world: row.details?.worldName || row.data?.worldName || '邀请房间', message: row.details?.inviteMessage || row.message || ''})) : []
        };
    }
    return createVrDashboardController({
        context, snapshot,
        publish: (result) => AppApi.ExecuteVrOverlayFunction('dashboardResult', JSON.stringify(result)),
        async settings(action, value) {
            const notifications = useNotificationsSettingsStore();
            const wrist = useWristOverlaySettingsStore();
            if (action === 'wrist' && wrist.overlayWrist !== value) wrist.setOverlayWrist();
            if (action === 'hud' && notifications.overlayNotifications !== value) notifications.setOverlayNotifications();
            if (action === 'silent') notifications.setTraySilentMode(value);
            if (action === 'sleep') notifications.setVSleepMode(value);
            await saveOptions();
        },
        async join(friend, mode) {
            const location = friend.ref?.$location?.tag || friend.ref?.location;
            if (!isRealInstance(location)) throw new Error('好友房间不可访问，请请求邀请');
            const launch = useLaunchStore();
            if (mode === 'current') {
                if (!useGameStore().isGameRunning) throw new Error('VRChat 未运行，请选择 VR 或桌面启动');
                await launch.tryOpenInstanceInVrc(location, null);
            } else await launch.launchGame(location, null, mode === 'desktop');
        },
        async invite(friend, request) {
            if (request) await notificationRequest.sendRequestInvite({}, friend.id);
            else {
                const location = useLocationStore().lastLocation;
                if (!isRealInstance(location.location) || !checkCanInvite(location.location, {
                    currentUserId: useUserStore().currentUser.id, lastLocationStr: location.location,
                    cachedInstances: useInstanceStore().cachedInstances
                })) throw new Error('当前房间无法发送邀请');
                await notificationRequest.sendInvite({instanceId: location.location, worldId: location.location, worldName: location.name}, friend.id);
            }
        },
        async respond(row, accept, mode) {
            const notifications = useNotificationStore();
            if (accept) {
                if (mode === 'current' && !useGameStore().isGameRunning) throw new Error('VRChat 未运行');
                const expectedAccountId = context().accountId;
                if (!(await notifications.acceptInviteAndLaunch(row, { dashboardConfirmed: true, mode, expectedAccountId }))) throw new Error('接受邀请失败或账户已切换');
            } else await notifications.declineDashboardInvite(row);
        }
    });
}
