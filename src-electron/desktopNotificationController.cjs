function createDesktopNotificationController({
    Notification,
    isEnabled,
    getActiveNotification,
    setActiveNotification
}) {
    function show(title, body, icon, silent) {
        if (!isEnabled()) {
            return;
        }

        const activeNotification = getActiveNotification();
        if (activeNotification) {
            activeNotification.close();
        }

        const notification = new Notification({
            title,
            body,
            icon,
            silent: !!silent
        });
        notification.on('close', () => {
            if (getActiveNotification() === notification) {
                notification.removeAllListeners();
                setActiveNotification(null);
            }
        });
        setActiveNotification(notification);
        notification.show();
    }

    return { show };
}

module.exports = { createDesktopNotificationController };
