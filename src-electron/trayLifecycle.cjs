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

function bindTrayClick({ tray, mainWindow }) {
    tray.on('click', () => {
        mainWindow.show();
    });
}

module.exports = { bindTrayClick, destroyTray, setTrayIcon };
