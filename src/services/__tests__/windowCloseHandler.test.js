import { describe, expect, it, vi } from 'vitest';

import { bindWindowCloseHandler } from '../../../src-electron/windowCloseHandler.cjs';

function createEmitter() {
    const handlers = new Map();
    return {
        on: vi.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        }),
        emit(eventName, ...args) {
            return handlers.get(eventName)?.(...args);
        }
    };
}

function createHarness({
    appIsQuitting = false,
    closeToTray = false,
    promptEnabled = true,
    promptResponse = { response: 2, checkboxChecked: false }
} = {}) {
    const window = createEmitter();
    window.hide = vi.fn();
    const app = { quit: vi.fn() };
    const dialog = {
        showMessageBox: vi.fn(async () => promptResponse)
    };
    const state = {
        appIsQuitting,
        closePromptInProgress: false
    };
    const setStorageValue = vi.fn();
    const resolvePromptResponse = vi.fn((response, checkboxChecked) => {
        if (response === 2) {
            return {
                action: 'cancel',
                persistPreference: false,
                closeToTrayEnabled: false
            };
        }
        return {
            action: response === 0 ? 'minimize' : 'exit',
            persistPreference: checkboxChecked,
            closeToTrayEnabled: response === 0
        };
    });

    bindWindowCloseHandler({
        window,
        app,
        dialog,
        getCloseToTray: () => closeToTray,
        shouldPromptCloseToTray: () => promptEnabled,
        resolvePromptResponse,
        getAppIsQuitting: () => state.appIsQuitting,
        setAppIsQuitting: (value) => {
            state.appIsQuitting = value;
        },
        getClosePromptInProgress: () => state.closePromptInProgress,
        setClosePromptInProgress: (value) => {
            state.closePromptInProgress = value;
        },
        setStorageValue
    });

    return {
        window,
        app,
        dialog,
        state,
        resolvePromptResponse,
        setStorageValue
    };
}

function createCloseEvent() {
    return { preventDefault: vi.fn() };
}

describe('window close handler', () => {
    it('keeps quitting, close-to-tray and disabled-prompt guards', async () => {
        const quitting = createHarness({ appIsQuitting: true });
        const quittingEvent = createCloseEvent();
        await quitting.window.emit('close', quittingEvent);
        expect(quittingEvent.preventDefault).not.toHaveBeenCalled();
        expect(quitting.window.hide).not.toHaveBeenCalled();

        const tray = createHarness({ closeToTray: true });
        const trayEvent = createCloseEvent();
        await tray.window.emit('close', trayEvent);
        expect(trayEvent.preventDefault).toHaveBeenCalledOnce();
        expect(tray.window.hide).toHaveBeenCalledOnce();
        expect(tray.dialog.showMessageBox).not.toHaveBeenCalled();

        const noPrompt = createHarness({ promptEnabled: false });
        const noPromptEvent = createCloseEvent();
        await noPrompt.window.emit('close', noPromptEvent);
        expect(noPromptEvent.preventDefault).not.toHaveBeenCalled();
        expect(noPrompt.dialog.showMessageBox).not.toHaveBeenCalled();
    });

    it('preserves prompt response, persistence order and exit behavior', async () => {
        const exit = createHarness({
            promptResponse: { response: 1, checkboxChecked: true }
        });
        const exitEvent = createCloseEvent();
        await exit.window.emit('close', exitEvent);

        expect(exitEvent.preventDefault).toHaveBeenCalledOnce();
        expect(exit.dialog.showMessageBox).toHaveBeenCalledWith(exit.window, {
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
        });
        expect(exit.resolvePromptResponse).toHaveBeenCalledWith(1, true);
        expect(exit.setStorageValue).toHaveBeenNthCalledWith(
            1,
            'VRCX_CloseToTrayPrompt',
            'false'
        );
        expect(exit.setStorageValue).toHaveBeenNthCalledWith(
            2,
            'VRCX_CloseToTray',
            'false'
        );
        expect(exit.state.appIsQuitting).toBe(true);
        expect(exit.app.quit).toHaveBeenCalledOnce();
        expect(exit.state.closePromptInProgress).toBe(false);
    });

    it('keeps cancel/minimize behavior and the in-progress guard', async () => {
        const cancel = createHarness({
            promptResponse: { response: 2, checkboxChecked: true }
        });
        const cancelEvent = createCloseEvent();
        await cancel.window.emit('close', cancelEvent);
        expect(cancelEvent.preventDefault).toHaveBeenCalledOnce();
        expect(cancel.window.hide).not.toHaveBeenCalled();
        expect(cancel.app.quit).not.toHaveBeenCalled();
        expect(cancel.setStorageValue).not.toHaveBeenCalled();
        expect(cancel.state.closePromptInProgress).toBe(false);

        const minimize = createHarness({
            promptResponse: { response: 0, checkboxChecked: false }
        });
        const minimizeEvent = createCloseEvent();
        await minimize.window.emit('close', minimizeEvent);
        expect(minimize.window.hide).toHaveBeenCalledOnce();
        expect(minimize.app.quit).not.toHaveBeenCalled();

        const inProgress = createHarness({
            promptResponse: { response: 0, checkboxChecked: false }
        });
        inProgress.state.closePromptInProgress = true;
        const inProgressEvent = createCloseEvent();
        await inProgress.window.emit('close', inProgressEvent);
        expect(inProgressEvent.preventDefault).toHaveBeenCalledOnce();
        expect(inProgress.dialog.showMessageBox).not.toHaveBeenCalled();
        expect(inProgress.window.hide).not.toHaveBeenCalled();
    });
});
