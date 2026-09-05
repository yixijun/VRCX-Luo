function bindWindowEventBridge({ window, initialZoomLevel, setStorageValue }) {
    const { webContents } = window;

    webContents.on('did-finish-load', () => {
        webContents.setZoomLevel(initialZoomLevel);
        webContents.send('setZoomLevel', initialZoomLevel);
    });

    webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key === '=') {
            const currentZoom = webContents.getZoomLevel() + 1;
            webContents.setZoomLevel(currentZoom);
            setStorageValue('VRCX_ZoomLevel', currentZoom.toString());
            webContents.send('setZoomLevel', currentZoom);
        }
        if (input.control && input.key === '-') {
            const currentZoom = webContents.getZoomLevel() - 1;
            webContents.setZoomLevel(currentZoom);
            setStorageValue('VRCX_ZoomLevel', currentZoom.toString());
            webContents.send('setZoomLevel', currentZoom);
        }
    });

    webContents.on('zoom-changed', (event, zoomDirection) => {
        let currentZoom = webContents.getZoomLevel();
        if (zoomDirection === 'in') {
            webContents.setZoomLevel(++currentZoom);
        } else {
            webContents.setZoomLevel(--currentZoom);
        }
        setStorageValue('VRCX_ZoomLevel', currentZoom.toString());
        webContents.send('setZoomLevel', currentZoom);
    });
    webContents.setVisualZoomLevelLimits(1, 5);

    window.on('resize', () => {
        const [width, height] = window
            .getSize()
            .map((size) => size.toString());
        webContents.send('setWindowSize', { width, height });
    });

    window.on('move', () => {
        const [x, y] = window
            .getPosition()
            .map((coord) => coord.toString());
        webContents.send('setWindowPosition', { x, y });
    });

    window.on('maximize', () => {
        webContents.send('setWindowState', '2');
    });

    window.on('minimize', () => {
        webContents.send('setWindowState', '1');
    });

    window.on('unmaximize', () => {
        webContents.send('setWindowState', '0');
    });

    window.on('restore', () => {
        webContents.send('setWindowState', '0');
    });

    window.on('focus', () => {
        webContents.send('onBrowserFocus');
    });
}

module.exports = { bindWindowEventBridge };
