function isLocalHost(hostname = '') {
    return ['localhost', '127.0.0.1', '::1'].includes(String(hostname));
}

function getBrowserNotificationState({
    notificationApi,
    isSecureContext = false,
    hostname = ''
} = {}) {
    if (!notificationApi) {
        return 'unsupported';
    }
    if (!isSecureContext && !isLocalHost(hostname)) {
        return 'insecure';
    }
    return notificationApi.permission || 'default';
}

function canRequestBrowserNotificationPermission(state, inFlight = false) {
    return state === 'default' && !inFlight;
}

function collectFreshNotifications(previousIds, notifications = []) {
    const known = previousIds instanceof Set ? previousIds : new Set();
    const currentIds = new Set(
        notifications.map((item) => item?.id).filter(Boolean)
    );
    const fresh = notifications.filter(
        (item) => item?.id && !known.has(item.id)
    );
    return { currentIds, fresh };
}

export {
    canRequestBrowserNotificationPermission,
    collectFreshNotifications,
    getBrowserNotificationState
};
