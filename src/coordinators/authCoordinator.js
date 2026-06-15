import { i18n } from '../plugins/i18n';

import Noty from 'noty';

import { closeWebSocket, initWebsocket } from '../services/websocket';
import { escapeTag } from '../shared/utils';
import { queryClient } from '../queries';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notification';
import { useUpdateLoopStore } from '../stores/updateLoop';
import { useUserStore } from '../stores/user';
import { applyCurrentUser } from './userCoordinator';
import { watchState } from '../services/watchState';
import { accountHub } from '../services/accountHub';

import configRepository from '../services/config';
import webApiService from '../services/webapi';

/**
 * Runs the shared logout side effects (including goodbye notification).
 */
export async function runLogoutFlow() {
    const authStore = useAuthStore();
    const userStore = useUserStore();
    const notificationStore = useNotificationStore();
    const t = i18n.global.t;

    if (watchState.isLoggedIn) {
        new Noty({
            type: 'success',
            text: t('message.auth.logout_greeting', {
                name: `<strong>${escapeTag(userStore.currentUser.displayName)}</strong>`
            })
        }).show();
    }

    userStore.setUserDialogVisible(false);
    accountHub.reset();
    watchState.isLoggedIn = false;
    watchState.isFriendsLoaded = false;
    watchState.isFavoritesLoaded = false;
    notificationStore.setNotificationInitStatus(false);
    await authStore.updateStoredUser(userStore.currentUser);
    await queryClient.cancelQueries();
    queryClient.clear();
    webApiService.clearCookies();
    authStore.loginForm.lastUserLoggedIn = '';
    await configRepository.remove('lastUserLoggedIn');
    authStore.setAttemptingAutoLogin(false);
    authStore.state.autoLoginAttempts.clear();
    closeWebSocket();
    const { router } = await import('../plugins/router');
    if (router.currentRoute.value.name !== 'login') {
        router.replace({ name: 'login' }).catch(() => {});
    }
}

/**
 * Runs post-login side effects after a successful auth response.
 * @param {object} json Current user payload from auth API.
 */
export function runLoginSuccessFlow(json) {
    const updateLoopStore = useUpdateLoopStore();

    updateLoopStore.setNextCurrentUserRefresh(420); // 7mins
    applyCurrentUser(json);
    initWebsocket();
}
