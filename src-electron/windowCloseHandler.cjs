function bindWindowCloseHandler({
    window,
    app,
    dialog,
    getCloseToTray,
    shouldPromptCloseToTray,
    resolvePromptResponse,
    getAppIsQuitting,
    setAppIsQuitting,
    getClosePromptInProgress,
    setClosePromptInProgress,
    setStorageValue
}) {
    window.on('close', async (event) => {
        if (getAppIsQuitting()) {
            return;
        }

        if (getCloseToTray()) {
            event.preventDefault();
            window.hide();
            return;
        }

        if (!shouldPromptCloseToTray()) {
            return;
        }

        event.preventDefault();
        if (getClosePromptInProgress()) {
            return;
        }

        setClosePromptInProgress(true);
        try {
            const { response, checkboxChecked } = await dialog.showMessageBox(
                window,
                {
                    type: 'question',
                    title: '关闭 VRCX-Luo',
                    message: '是否最小化到系统托盘？',
                    detail: '最小化后 VRCX-Luo 会继续在后台运行，可从托盘图标重新打开。',
                    buttons: ['最小化到托盘', '直接退出', '取消'],
                    defaultId: 0,
                    cancelId: 2,
                    checkboxLabel: '以后不再提示',
                    checkboxChecked: false,
                    noLink: true
                }
            );

            const decision = resolvePromptResponse(
                response,
                checkboxChecked
            );
            if (decision.action === 'cancel') {
                return;
            }

            if (decision.persistPreference) {
                setStorageValue('VRCX_CloseToTrayPrompt', 'false');
                setStorageValue(
                    'VRCX_CloseToTray',
                    String(decision.closeToTrayEnabled)
                );
            }

            if (decision.action === 'minimize') {
                window.hide();
            } else {
                setAppIsQuitting(true);
                app.quit();
            }
        } finally {
            setClosePromptInProgress(false);
        }
    });
}

module.exports = { bindWindowCloseHandler };
