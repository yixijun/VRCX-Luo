import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import StatusBar from '../StatusBar.vue';
import en from '../../localization/en.json';
import { useAutoFollowStore } from '../../stores/autoFollow';

// --- Mocks ---

vi.mock('../../services/config', () => ({
    default: {
        init: vi.fn(),
        getString: vi
            .fn()
            .mockImplementation((_key, defaultValue) => defaultValue ?? '{}'),
        setString: vi.fn(),
        getBool: vi
            .fn()
            .mockImplementation((_key, defaultValue) => defaultValue ?? false),
        setBool: vi.fn(),
        getInt: vi
            .fn()
            .mockImplementation((_key, defaultValue) => defaultValue ?? 0),
        setInt: vi.fn(),
        getFloat: vi
            .fn()
            .mockImplementation((_key, defaultValue) => defaultValue ?? 0),
        setFloat: vi.fn(),
        getObject: vi.fn().mockReturnValue(null),
        setObject: vi.fn(),
        getArray: vi.fn().mockReturnValue([]),
        setArray: vi.fn(),
        remove: vi.fn()
    }
}));

vi.mock('../../services/websocket', () => ({
    wsState: { connected: false, messageCount: 0, bytesReceived: 0 },
    initWebsocket: vi.fn(),
    closeWebSocket: vi.fn(),
    reconnectWebSocket: vi.fn()
}));

vi.mock('../../services/webapi', () => ({
    default: {
        execute: vi.fn().mockImplementation((options = {}) => {
            const url = String(options.url || '');
            if (url.includes('github.com') || url.includes('api.github.com')) {
                return Promise.resolve({
                    status: 200,
                    data: JSON.stringify([])
                });
            }
            return Promise.resolve({
                status: 200,
                data: JSON.stringify({
                    page: { updated_at: '2026-01-01T00:00:00.000Z' },
                    status: { description: 'All Systems Operational' }
                })
            });
        })
    }
}));

vi.mock('worker-timers', () => ({
    setInterval: vi.fn(),
    clearInterval: vi.fn(),
    setTimeout: vi.fn(),
    clearTimeout: vi.fn()
}));

vi.mock('../../services/jsonStorage', () => ({
    default: vi.fn()
}));
vi.mock('../../services/watchState', () => ({
    watchState: { isLoggedIn: false }
}));
vi.mock('../../services/database', () => ({
    database: new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (prop === '__esModule') return false;
                return vi.fn().mockResolvedValue(null);
            }
        }
    )
}));
vi.mock('../../plugins/router', () => ({
    router: {
        beforeEach: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
        currentRoute: ref({ path: '/', name: '', meta: {} }),
        isReady: vi.fn().mockResolvedValue(true)
    },
    initRouter: vi.fn()
}));
vi.mock('vue-router', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useRouter: vi.fn(() => ({
            push: vi.fn(),
            replace: vi.fn(),
            currentRoute: ref({ path: '/', name: '', meta: {} })
        }))
    };
});
vi.mock('../../plugins/interopApi', () => ({
    initInteropApi: vi.fn()
}));

const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    legacy: false,
    globalInjection: false,
    missingWarn: false,
    fallbackWarn: false,
    messages: { en }
});

const stubs = {
    TooltipWrapper: {
        template: '<span data-testid="tooltip"><slot /></span>',
        props: [
            'content',
            'disabled',
            'delayDuration',
            'delay-duration',
            'side'
        ]
    },
    ContextMenu: { template: '<div><slot /></div>' },
    ContextMenuTrigger: { template: '<div><slot /></div>' },
    ContextMenuContent: { template: '<div><slot /></div>' },
    ContextMenuItem: {
        template: '<div><slot /></div>',
        props: ['disabled']
    },
    ContextMenuCheckboxItem: {
        template: '<div><slot /></div>',
        props: ['modelValue']
    },
    ContextMenuSeparator: { template: '<div />' },
    ContextMenuSub: { template: '<div><slot /></div>' },
    ContextMenuSubTrigger: { template: '<div><slot /></div>' },
    ContextMenuSubContent: { template: '<div><slot /></div>' },
    ContextMenuRadioGroup: {
        template: '<div><slot /></div>',
        props: ['modelValue']
    },
    ContextMenuRadioItem: { template: '<div><slot /></div>', props: ['value'] },
    HoverCard: {
        template: '<div data-testid="hover-card"><slot /></div>',
        props: ['open']
    },
    HoverCardTrigger: {
        template: '<div data-testid="hover-card-trigger"><slot /></div>'
    },
    HoverCardContent: {
        template: '<div data-testid="hover-card-content"><slot /></div>',
        props: ['class', 'side', 'align', 'sideOffset']
    },
    Popover: { template: '<div><slot /></div>', props: ['open'] },
    PopoverTrigger: { template: '<div><slot /></div>' },
    PopoverContent: {
        template: '<div><slot /></div>',
        props: ['class', 'side', 'align']
    },
    Select: { template: '<div><slot /></div>', props: ['modelValue'] },
    SelectTrigger: { template: '<div><slot /></div>', props: ['size'] },
    SelectValue: { template: '<span />', props: ['placeholder'] },
    SelectContent: { template: '<div><slot /></div>', props: ['class'] },
    SelectGroup: { template: '<div><slot /></div>' },
    SelectItem: { template: '<div><slot /></div>', props: ['value'] },
    NumberField: {
        template: '<div><slot /></div>',
        props: ['modelValue', 'step', 'formatOptions', 'class']
    },
    NumberFieldContent: { template: '<div><slot /></div>' },
    NumberFieldDecrement: { template: '<button />' },
    NumberFieldIncrement: { template: '<button />' },
    NumberFieldInput: { template: '<input />', props: ['class'] }
};

/**
 *
 * @param storeOverrides
 */
function mountStatusBar(storeOverrides = {}) {
    return mount(StatusBar, {
        global: {
            plugins: [
                i18n,
                createTestingPinia({
                    stubActions: true,
                    initialState: {
                        Game: {
                            isGameRunning: false,
                            isSteamVRRunning: false,
                            lastSessionDurationMs: 0,
                            lastOfflineAt: 0,
                            ...storeOverrides.Game
                        },
                        Vrcx: {
                            proxyServer: '',
                            appStartAt: Date.now(),
                            ...storeOverrides.Vrcx
                        },
                        VrcStatus: {
                            lastStatus: '',
                            lastStatusTime: null,
                            lastStatusSummary: '',
                            ...storeOverrides.VrcStatus
                        },
                        User: {
                            currentUser: {
                                $online_for: Date.now()
                            },
                            ...storeOverrides.User
                        },
                        GeneralSettings: {
                            ...storeOverrides.GeneralSettings
                        },
                        AutoFollow: {
                            isActive: false,
                            targetFriendName: '',
                            statusText: '',
                            isJoining: false,
                            ...storeOverrides.AutoFollow
                        }
                    }
                })
            ],
            stubs
        }
    });
}

describe('StatusBar.vue - Servers indicator', () => {
    let zoomLevelChangedCallback = null;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        zoomLevelChangedCallback = null;
        window.electron = {
            onZoomLevelChanged: vi.fn((callback) => {
                zoomLevelChangedCallback = callback;
                return vi.fn();
            })
        };
        globalThis.AppApi = new Proxy(
            {
                CurrentCulture: vi.fn().mockResolvedValue('en-US'),
                GetVersion: vi.fn().mockResolvedValue('VRCX-Luo 2026.6.15'),
                GetZoom: vi.fn().mockResolvedValue(0),
                SetTrayIconNotification: vi.fn(),
                SetZoom: vi.fn()
            },
            {
                get(target, prop) {
                    if (prop in target) {
                        return target[prop];
                    }
                    target[prop] = vi.fn().mockResolvedValue(null);
                    return target[prop];
                }
            }
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        delete window.electron;
    });

    test('shows "Game" label instead of "VRChat" for game running indicator', () => {
        const wrapper = mountStatusBar({ Game: { isGameRunning: true } });
        expect(wrapper.text()).toContain('Game');
    });

    test('shows Servers indicator with green dot when no issues', () => {
        const wrapper = mountStatusBar();
        expect(wrapper.text()).toContain('Servers');
        const serversDots = wrapper.findAll('.bg-status-online');
        expect(serversDots.length).toBeGreaterThan(0);
        expect(wrapper.find('.bg-status-askme').exists()).toBe(false);
    });

    test('shows Servers indicator with yellow dot when there is an issue', () => {
        const wrapper = mountStatusBar({
            VrcStatus: {
                lastStatus: 'Partial System Outage'
            }
        });
        expect(wrapper.text()).toContain('Servers');
        expect(wrapper.find('.bg-status-askme').exists()).toBe(true);
    });

    test('shows HoverCard content with status text when there is an issue', () => {
        const wrapper = mountStatusBar({
            VrcStatus: {
                lastStatus: 'Partial System Outage',
                lastStatusSummary: 'API, CDN'
            }
        });
        const hoverContent = wrapper.find('[data-testid="hover-card-content"]');
        expect(hoverContent.exists()).toBe(true);
        expect(hoverContent.text()).toContain('VRChat Server Issues');
    });

    test('does not show HoverCard content when no issues', () => {
        const wrapper = mountStatusBar();
        const hoverContent = wrapper.find('[data-testid="hover-card-content"]');
        expect(hoverContent.exists()).toBe(false);
    });

    test('shows Servers indicator in context menu', () => {
        const wrapper = mountStatusBar();
        const text = wrapper.text();
        expect(text).toContain('Servers');
    });

    test('shows SteamVR indicator', () => {
        const wrapper = mountStatusBar({ Game: { isSteamVRRunning: true } });
        expect(wrapper.text()).toContain('SteamVR');
    });

    test('shows last game session details when game is offline and there is session data', () => {
        const wrapper = mountStatusBar({
            Game: {
                isGameRunning: false,
                lastSessionDurationMs: 3_600_000,
                lastOfflineAt: new Date('2026-03-13T14:30:00Z').getTime()
            }
        });

        expect(wrapper.text()).toContain('Last Session');
        expect(wrapper.text()).toContain('Offline Since');
    });

    test('always shows auto follow status when inactive', async () => {
        const wrapper = mountStatusBar();
        const autoFollowStore = useAutoFollowStore();

        expect(wrapper.text()).toContain('Auto Follow');
        expect(wrapper.find('[data-testid="auto-follow-status"]').exists()).toBe(true);

        await wrapper.find('[data-testid="auto-follow-status"]').trigger('click');

        expect(autoFollowStore.stopFollow).not.toHaveBeenCalled();
    });

    test('shows auto follow status and confirms stop on click', async () => {
        const wrapper = mountStatusBar({
            AutoFollow: {
                isActive: true,
                targetFriendName: 'Test Friend',
                statusText: '跟随中'
            }
        });
        const autoFollowStore = useAutoFollowStore();

        expect(wrapper.text()).toContain('Auto Follow');
        expect(wrapper.text()).toContain('Test Friend');

        const statusItem = wrapper.find('[data-testid="auto-follow-status"]');
        await statusItem.trigger('click');

        expect(autoFollowStore.stopFollow).toHaveBeenCalledWith({ confirm: true });
    });

    test('shows auto follow and reorder controls in context menu', () => {
        const wrapper = mountStatusBar();

        expect(wrapper.text()).toContain('Auto Follow');
        expect(wrapper.text()).toContain('Reorder');
        expect(wrapper.text()).toContain('Move Up');
        expect(wrapper.text()).toContain('Move Down');
    });

    test('refreshes zoom value after Ctrl + wheel changes app zoom', async () => {
        AppApi.GetZoom.mockResolvedValueOnce(0).mockResolvedValue(1.25);

        const wrapper = mountStatusBar();
        await nextTick();

        expect(wrapper.text()).toContain('100.00%');

        window.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true }));
        await new Promise((resolve) => setTimeout(resolve, 80));
        await nextTick();

        expect(wrapper.text()).toContain('125.60%');
    });

    test('refreshes zoom value when Electron reports zoom change', async () => {
        const wrapper = mountStatusBar();
        await nextTick();

        expect(wrapper.text()).toContain('100.00%');

        zoomLevelChangedCallback?.({}, 1.25);
        await nextTick();

        expect(wrapper.text()).toContain('125.60%');
    });

    test('applies zoom when typing a number and pressing Enter', async () => {
        const wrapper = mountStatusBar();
        await nextTick();

        const zoomItem = wrapper
            .findAll('.cursor-pointer')
            .find((item) => item.text().includes('Zoom') && item.text().includes('100.00%'));
        await zoomItem.trigger('click');
        await nextTick();

        const input = wrapper.find('input');
        input.element.value = '120';
        await input.trigger('keydown.enter');

        expect(AppApi.SetZoom).toHaveBeenCalledWith(1);
        expect(wrapper.text()).toContain('120.00%');
    });
});
