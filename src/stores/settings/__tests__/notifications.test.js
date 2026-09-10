import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    openFileDialog: vi.fn(),
    config: {
        getString: vi.fn(),
        getBool: vi.fn(),
        setString: vi.fn(),
        setBool: vi.fn()
    },
    vrStore: {
        updateOpenVR: vi.fn(),
        updateVRConfigVars: vi.fn()
    },
    modalStore: {
        prompt: vi.fn()
    }
}));

vi.mock('../../../services/fileDialogAdapter', () => ({
    openFileDialog: mocks.openFileDialog
}));
vi.mock('../../../services/config', () => ({
    default: mocks.config
}));
vi.mock('../../vr', () => ({
    useVrStore: () => mocks.vrStore
}));
vi.mock('../../modal', () => ({
    useModalStore: () => mocks.modalStore
}));
vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

import { useNotificationsSettingsStore } from '../notifications';

describe('useNotificationsSettingsStore file selection', () => {
    let store;

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mocks.config.getString.mockImplementation(
            async (_key, defaultValue = '') => defaultValue
        );
        mocks.config.getBool.mockImplementation(
            async (_key, defaultValue = false) => defaultValue
        );
        mocks.config.setString.mockResolvedValue(undefined);
        mocks.config.setBool.mockResolvedValue(undefined);
        mocks.openFileDialog.mockResolvedValue(null);
        globalThis.Audio = class {
            constructor() {
                this.currentTime = 0;
                this.play = vi.fn().mockResolvedValue(undefined);
            }
        };
        store = useNotificationsSettingsStore();
    });

    it('persists the selected custom notification sound through the adapter', async () => {
        const selectedPath = 'C:/sounds/notify.wav';
        mocks.openFileDialog.mockResolvedValue(selectedPath);

        await store.selectCustomNotificationSound();

        expect(mocks.openFileDialog).toHaveBeenCalledWith({
            defaultPath: '',
            defaultExt: '.wav',
            defaultFilter:
                'Audio Files (*.wav;*.mp3;*.ogg;*.m4a)|*.wav;*.mp3;*.ogg;*.m4a|All files (*.*)|*.*',
            filters: [
                {
                    name: 'Audio Files',
                    extensions: ['wav', 'mp3', 'ogg', 'm4a']
                },
                { name: 'All files', extensions: ['*'] }
            ]
        });
        expect(store.customNotificationSoundPath).toBe(selectedPath);
        expect(store.customNotificationSoundEnabled).toBe(true);
        expect(mocks.config.setString).toHaveBeenCalledWith(
            'VRCX_customNotificationSoundPath',
            selectedPath
        );
        expect(mocks.config.setBool).toHaveBeenCalledWith(
            'VRCX_customNotificationSoundEnabled',
            true
        );
    });

    it('leaves sound settings unchanged when the picker is canceled', async () => {
        await store.selectCustomNotificationSound();

        expect(store.customNotificationSoundPath).toBe('');
        expect(store.customNotificationSoundEnabled).toBe(false);
        expect(mocks.config.setString).not.toHaveBeenCalled();
        expect(mocks.config.setBool).not.toHaveBeenCalled();
    });

    it('keeps a desktop notification toggle received during initialization', async () => {
        let releaseDesktopConfig;
        const desktopConfig = new Promise((resolve) => {
            releaseDesktopConfig = resolve;
        });
        vi.stubGlobal('VRCXStorage', {
            Get: vi.fn((key) =>
                key === 'VRCX_desktopNotificationsEnabled'
                    ? desktopConfig
                    : Promise.resolve('')
            ),
            Set: vi.fn()
        });

        setActivePinia(createPinia());
        store = useNotificationsSettingsStore();
        expect(store.desktopNotificationsEnabled).toBe(true);
        window.dispatchEvent(
            new CustomEvent('vrcx-desktop-notifications-updated', {
                detail: { enabled: false }
            })
        );

        expect(store.desktopNotificationsEnabled).toBe(false);

        releaseDesktopConfig('true');
        await Promise.resolve();
        await Promise.resolve();

        expect(store.desktopNotificationsEnabled).toBe(false);
        vi.unstubAllGlobals();
    });
});
