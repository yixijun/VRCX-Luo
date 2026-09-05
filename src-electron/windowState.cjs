function readWindowConfig({ getValue }) {
    return {
        x: parseInt(getValue('VRCX_LocationX')) || 0,
        y: parseInt(getValue('VRCX_LocationY')) || 0,
        width: parseInt(getValue('VRCX_SizeWidth')) || 1920,
        height: parseInt(getValue('VRCX_SizeHeight')) || 1080,
        zoomLevel: parseFloat(getValue('VRCX_ZoomLevel')) || 0
    };
}

function applyStoredWindowState(
    window,
    { getValue, startup, getCloseToTray }
) {
    if (getValue('VRCX_StartAsMinimizedState') === 'true' && startup) {
        if (getCloseToTray()) {
            window.hide();
            return;
        }
        window.minimize();
        return;
    }

    const windowState = parseInt(getValue('VRCX_WindowState')) || -1;
    switch (windowState) {
        case -1:
            break;
        case 0:
            window.restore();
            break;
        case 1:
            window.minimize();
            break;
        case 2:
            window.maximize();
            break;
    }
}

module.exports = { applyStoredWindowState, readWindowConfig };
