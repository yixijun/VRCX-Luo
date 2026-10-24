import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';

const config = vi.hoisted(() => ({
    getBool: vi.fn(async (_key, fallback) => fallback),
    getInt: vi.fn(async (_key, fallback) => fallback),
    setBool: vi.fn(async () => {})
}));
vi.mock('../../../services/config', () => ({ default: config }));
vi.mock('../../sharedFeed', () => ({
    useSharedFeedStore: () => ({ loadSharedFeed: vi.fn() })
}));

import { useWristOverlaySettingsStore } from '../wristOverlay';

describe('SteamVR dashboard preference', () => {
    let pinia;
    beforeEach(() => {
        vi.clearAllMocks();
        config.getBool.mockImplementation(async (_key, fallback) => fallback);
        pinia = createPinia();
        setActivePinia(pinia);
    });
    afterEach(() => disposePinia(pinia));

    it('keeps the existing dashboard enabled by default', async () => {
        const store = useWristOverlaySettingsStore();
        await flushPromises();
        expect(store.steamVrDashboard).toBe(true);
        expect(config.getBool).toHaveBeenCalledWith(
            'VRCX_steamVrDashboard',
            true
        );
    });

    it('restores a disabled preference and persists explicit switch values independently of wrist HUD', async () => {
        config.getBool.mockImplementation(async (key, fallback) =>
            key === 'VRCX_steamVrDashboard' ? false : fallback
        );
        const store = useWristOverlaySettingsStore();
        await flushPromises();
        expect(store.steamVrDashboard).toBe(false);
        const wrist = store.overlayWrist;
        await store.setSteamVrDashboard(true);
        await store.setSteamVrDashboard(true);
        expect(store.steamVrDashboard).toBe(true);
        expect(store.overlayWrist).toBe(wrist);
        expect(config.setBool).toHaveBeenLastCalledWith(
            'VRCX_steamVrDashboard',
            true
        );
    });
});
