import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    configRepository: {
        getString: vi.fn(),
        setString: vi.fn()
    },
    changeLogRemoveLinks: vi.fn((value) => value),
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn()
    },
    webApiService: {
        execute: vi.fn()
    }
}));

vi.mock('../../services/config', () => ({
    default: mocks.configRepository
}));

vi.mock('../../shared/utils', () => ({
    changeLogRemoveLinks: (...args) => mocks.changeLogRemoveLinks(...args)
}));

vi.mock('vue-sonner', () => ({
    toast: mocks.toast
}));

vi.mock('../../services/webapi', () => ({
    default: mocks.webApiService
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
        locale: require('vue').ref('en')
    })
}));

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

import { getAssetOfInterest, useVRCXUpdaterStore } from '../vrcxUpdater';

describe('getAssetOfInterest', () => {
    test('selects Windows setup asset instead of other exe assets', () => {
        const result = getAssetOfInterest(
            [
                {
                    state: 'uploaded',
                    name: 'VRCX-Luo.exe',
                    content_type: 'application/x-msdownload',
                    browser_download_url: 'https://example.com/portable.exe',
                    digest: 'sha256:portable',
                    size: 1
                },
                {
                    state: 'uploaded',
                    name: 'VRCX-Luo_Setup.exe',
                    content_type: 'application/x-msdownload',
                    browser_download_url: 'https://example.com/setup.exe',
                    digest: 'sha256:setup',
                    size: 2
                }
            ],
            { windows: true }
        );

        expect(result).toEqual({
            downloadUrl: 'https://example.com/setup.exe',
            hashString: 'setup',
            size: 2
        });
    });

    test('does not select non-setup Windows exe assets', () => {
        const result = getAssetOfInterest(
            [
                {
                    state: 'uploaded',
                    name: 'VRCX-Luo.exe',
                    content_type: 'application/x-msdownload',
                    browser_download_url: 'https://example.com/app.exe',
                    size: 1
                }
            ],
            { windows: true }
        );

        expect(result.downloadUrl).toBe('');
    });

    test('selects Linux AppImage for the current arch', () => {
        const result = getAssetOfInterest(
            [
                {
                    state: 'uploaded',
                    name: 'VRCX-Luo-arm64.AppImage',
                    content_type: 'application/octet-stream',
                    browser_download_url: 'https://example.com/arm64.AppImage',
                    size: 1
                },
                {
                    state: 'uploaded',
                    name: 'VRCX-Luo-x64.AppImage',
                    content_type: 'application/octet-stream',
                    browser_download_url: 'https://example.com/x64.AppImage',
                    digest: 'sha256:linux',
                    size: 3
                }
            ],
            { linux: true, arch: 'x64' }
        );

        expect(result).toEqual({
            downloadUrl: 'https://example.com/x64.AppImage',
            hashString: 'linux',
            size: 3
        });
    });
});

describe('useVRCXUpdaterStore.setAutoUpdateVRCX', () => {
    beforeEach(async () => {
        mocks.configRepository.getString.mockImplementation(
            (key, defaultValue) => {
                if (key === 'VRCX_autoUpdateVRCX') {
                    return Promise.resolve('Off');
                }
                if (key === 'VRCX_id') {
                    return Promise.resolve('test-vrcx-id');
                }
                if (key === 'VRCX_lastVRCXVersion') {
                    return Promise.resolve('2026.1.0');
                }
                return Promise.resolve(defaultValue ?? '');
            }
        );
        mocks.configRepository.setString.mockResolvedValue(undefined);
        mocks.webApiService.execute.mockResolvedValue({
            status: 200,
            data: '[]'
        });

        globalThis.AppApi = {
            GetVersion: vi.fn().mockResolvedValue('2026.1.0')
        };

        setActivePinia(createPinia());
        useVRCXUpdaterStore();
        await flushPromises();
        vi.clearAllMocks();
    });

    test('sets autoUpdateVRCX to Off, clears pending flag, and persists config', async () => {
        const store = useVRCXUpdaterStore();
        store.pendingVRCXUpdate = true;

        await store.setAutoUpdateVRCX('Off');

        expect(store.autoUpdateVRCX).toBe('Off');
        expect(store.pendingVRCXUpdate).toBe(false);
        expect(mocks.configRepository.setString).toHaveBeenCalledWith(
            'VRCX_autoUpdateVRCX',
            'Off'
        );
    });

    test('updates autoUpdateVRCX for non-Off values and keeps pending flag', async () => {
        const store = useVRCXUpdaterStore();
        store.pendingVRCXUpdate = true;

        await store.setAutoUpdateVRCX('Notify');

        expect(store.autoUpdateVRCX).toBe('Notify');
        expect(store.pendingVRCXUpdate).toBe(true);
        expect(mocks.configRepository.setString).toHaveBeenCalledWith(
            'VRCX_autoUpdateVRCX',
            'Notify'
        );
    });

    test('loads changelog from matching GitHub release', async () => {
        globalThis.AppApi.GetVersion.mockResolvedValue('VRCX-Luo 2026.6.15');
        mocks.webApiService.execute.mockResolvedValue({
            status: 200,
            data: JSON.stringify([
                {
                    tag_name: 'beta-2026.6.15',
                    name: 'Beta 2026.6.15',
                    body: '## Release body\n[Full notes](https://example.com)',
                    html_url:
                        'https://github.com/yixijun/VRCX-Luo/releases/tag/beta-2026.6.15',
                    prerelease: true,
                    assets: []
                }
            ])
        });

        setActivePinia(createPinia());
        const store = useVRCXUpdaterStore();
        await flushPromises();
        await store.showChangeLogDialog({ prefetch: true });

        expect(store.changeLogDialog.buildName).toBe('Beta 2026.6.15');
        expect(store.changeLogDialog.changeLog).toBe(
            '## Release body\n[Full notes](https://example.com)'
        );
        expect(store.changeLogDialog.releaseUrl).toBe(
            'https://github.com/yixijun/VRCX-Luo/releases/tag/beta-2026.6.15'
        );
    });
});
