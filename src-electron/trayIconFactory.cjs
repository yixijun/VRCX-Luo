function createTrayInstance({
    platform,
    nativeImage,
    Tray,
    path,
    rootDir
}) {
    let trayIcon;
    let trayIconNotify;

    if (platform === 'darwin') {
        const image = nativeImage.createFromPath(
            path.join(rootDir, 'images/VRCX.png')
        );
        trayIcon = image.resize({ width: 16, height: 16 });

        const imageNotify = nativeImage.createFromPath(
            path.join(rootDir, 'images/VRCX_notify.png')
        );
        trayIconNotify = imageNotify.resize({ width: 16, height: 16 });
    } else if (platform === 'linux') {
        const image = nativeImage.createFromPath(
            path.join(rootDir, 'images/VRCX.png')
        );
        trayIcon = image.resize({ width: 64, height: 64 });

        const imageNotify = nativeImage.createFromPath(
            path.join(rootDir, 'images/VRCX_notify.png')
        );
        trayIconNotify = imageNotify.resize({ width: 64, height: 64 });
    } else {
        trayIcon = path.join(rootDir, 'images/VRCX.ico');
        trayIconNotify = path.join(rootDir, 'images/VRCX_notify.ico');
    }

    return {
        tray: new Tray(trayIcon),
        trayIcon,
        trayIconNotify
    };
}

module.exports = { createTrayInstance };
