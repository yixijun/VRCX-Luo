function destroyTray({ getTray, setTray }) {
    const tray = getTray();
    if (tray) {
        tray.destroy();
        setTray(null);
    }
}

function setTrayIcon({ getTray, trayIcon, trayIconNotify, notify }) {
    const tray = getTray();
    if (tray) {
        tray.setImage(notify ? trayIconNotify : trayIcon);
    }
}

module.exports = { destroyTray, setTrayIcon };
