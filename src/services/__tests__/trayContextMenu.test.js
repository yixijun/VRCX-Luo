import { describe, expect, it, vi } from 'vitest';

import { createTrayContextMenu } from '../../../src-electron/trayContextMenu.cjs';

function createHarness({ debug = false, desktopNotificationsEnabled = true } = {}) {
    const mainWindow = {
        show: vi.fn(),
        webContents: { openDevTools: vi.fn() }
    };
    const app = { quit: vi.fn() };
    const state = {
        desktopNotificationsEnabled,
        traySilentMode: false,
        vSleepMode: false,
        appIsQuitting: false
    };
    const storage = vi.fn((key, value) => {
        if (key === 'VRCX_desktopNotificationsEnabled') {
            state.desktopNotificationsEnabled = value === 'true';
        }
        if (key === 'VRCX_traySilentMode') {
            state.traySilentMode = value === 'true';
        }
        if (key === 'VRCX_vSleepMode') {
            state.vSleepMode = value === 'true';
        }
    });
    const notifyDesktopNotificationsChanged = vi.fn();
    const notifyTraySilentModeChanged = vi.fn();
    const notifyVSleepModeChanged = vi.fn();
    const refreshContextMenu = vi.fn();
    const setAppIsQuitting = vi.fn((value) => {
        state.appIsQuitting = value;
    });
    const Menu = {
        buildFromTemplate: vi.fn((template) => template)
    };

    const build = () =>
        createTrayContextMenu({
            Menu,
            mainWindow,
            debug,
            areDesktopNotificationsEnabled: () =>
                state.desktopNotificationsEnabled,
            isTraySilentModeEnabled: () => state.traySilentMode,
            isVSleepModeEnabled: () => state.vSleepMode,
            setStorageValue: storage,
            notifyDesktopNotificationsChanged,
            notifyTraySilentModeChanged,
            notifyVSleepModeChanged,
            refreshContextMenu,
            setAppIsQuitting,
            app
        });

    return {
        build,
        mainWindow,
        app,
        state,
        storage,
        notifyDesktopNotificationsChanged,
        notifyTraySilentModeChanged,
        notifyVSleepModeChanged,
        refreshContextMenu,
        setAppIsQuitting,
        Menu
    };
}

describe('tray context menu', () => {
    it('builds the existing menu order and debug entry', () => {
        const normal = createHarness();
        const template = normal.build();
        expect(template.map((item) => item.label || item.type)).toEqual([
            '打开 VRCX-Luo',
            'separator',
            '桌面通知：已开启',
            '静音模式',
            'V睡模式',
            'separator',
            '退出 VRCX-Luo'
        ]);
        expect(template[2]).toMatchObject({
            type: 'checkbox',
            checked: true
        });

        const debug = createHarness({ debug: true });
        const debugTemplate = debug.build();
        expect(debugTemplate.map((item) => item.label || item.type)).toEqual([
            '打开 VRCX-Luo',
            'separator',
            '桌面通知：已开启',
            '静音模式',
            'V睡模式',
            '开发者工具',
            'separator',
            '退出 VRCX-Luo'
        ]);
        debugTemplate[5].click();
        expect(debug.mainWindow.webContents.openDevTools).toHaveBeenCalledOnce();
    });

    it('describes the current desktop notification state', () => {
        const enabled = createHarness();
        expect(enabled.build()[2].label).toBe('桌面通知：已开启');

        const disabled = createHarness({ desktopNotificationsEnabled: false });
        expect(disabled.build()[2].label).toBe('桌面通知：已关闭');
    });

    it('preserves toggle persistence, notifications and menu refresh', () => {
        const harness = createHarness();
        const template = harness.build();

        template[0].click();
        expect(harness.mainWindow.show).toHaveBeenCalledOnce();

        template[2].click();
        template[3].click();
        template[4].click();

        expect(harness.storage).toHaveBeenNthCalledWith(
            1,
            'VRCX_desktopNotificationsEnabled',
            'false'
        );
        expect(harness.storage).toHaveBeenNthCalledWith(
            2,
            'VRCX_traySilentMode',
            'true'
        );
        expect(harness.storage).toHaveBeenNthCalledWith(
            3,
            'VRCX_vSleepMode',
            'true'
        );
        expect(harness.notifyDesktopNotificationsChanged).toHaveBeenCalledWith(
            false
        );
        expect(harness.notifyTraySilentModeChanged).toHaveBeenCalledWith(true);
        expect(harness.notifyVSleepModeChanged).toHaveBeenCalledWith(true);
        expect(harness.refreshContextMenu).toHaveBeenCalledTimes(3);
    });

    it('keeps the quit action as an explicit app quit', () => {
        const harness = createHarness();
        const template = harness.build();
        template.at(-1).click();

        expect(harness.setAppIsQuitting).toHaveBeenCalledWith(true);
        expect(harness.state.appIsQuitting).toBe(true);
        expect(harness.app.quit).toHaveBeenCalledOnce();
    });
});
