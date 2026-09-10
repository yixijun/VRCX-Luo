function createTrayContextMenu({
    Menu,
    mainWindow,
    debug,
    areDesktopNotificationsEnabled,
    isTraySilentModeEnabled,
    isVSleepModeEnabled,
    setStorageValue,
    notifyDesktopNotificationsChanged,
    notifyTraySilentModeChanged,
    notifyVSleepModeChanged,
    refreshContextMenu,
    setAppIsQuitting,
    app
}) {
    const template = [
        { label: '打开 VRCX-Luo', click: () => mainWindow.show() },
        { type: 'separator' },
        {
            label: areDesktopNotificationsEnabled()
                ? '桌面通知：已开启'
                : '桌面通知：已关闭',
            type: 'checkbox',
            checked: areDesktopNotificationsEnabled(),
            click: () => {
                const enabled = !areDesktopNotificationsEnabled();
                setStorageValue(
                    'VRCX_desktopNotificationsEnabled',
                    String(enabled)
                );
                notifyDesktopNotificationsChanged(enabled);
                refreshContextMenu();
            }
        },
        {
            label: '静音模式',
            type: 'checkbox',
            checked: isTraySilentModeEnabled(),
            click: () => {
                const enabled = !isTraySilentModeEnabled();
                setStorageValue('VRCX_traySilentMode', String(enabled));
                notifyTraySilentModeChanged(enabled);
                refreshContextMenu();
            }
        },
        {
            label: 'V睡模式',
            type: 'checkbox',
            checked: isVSleepModeEnabled(),
            click: () => {
                const enabled = !isVSleepModeEnabled();
                setStorageValue('VRCX_vSleepMode', String(enabled));
                notifyVSleepModeChanged(enabled);
                refreshContextMenu();
            }
        }
    ];

    if (debug) {
        template.push({
            label: '开发者工具',
            click: () => mainWindow.webContents.openDevTools()
        });
    }

    template.push(
        { type: 'separator' },
        {
            label: '退出 VRCX-Luo',
            click: () => {
                setAppIsQuitting(true);
                app.quit();
            }
        }
    );

    return Menu.buildFromTemplate(template);
}

module.exports = { createTrayContextMenu };
