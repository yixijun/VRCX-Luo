import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import QuickLaunchButton from '../QuickLaunchButton.vue';

const mocks = vi.hoisted(() => ({
    isSteamVRRunning: false,
    setIsSteamVRRunning: vi.fn(),
    launchVRChat: vi.fn(),
    confirm: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    startSteamVR: vi.fn()
}));

vi.mock('@/stores', () => ({
    useGameStore: () => ({
        get isSteamVRRunning() {
            return mocks.isSteamVRRunning;
        },
        setIsSteamVRRunning: (...args) => mocks.setIsSteamVRRunning(...args)
    }),
    useLaunchStore: () => ({
        launchVRChat: (...args) => mocks.launchVRChat(...args)
    }),
    useModalStore: () => ({
        confirm: (...args) => mocks.confirm(...args)
    })
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('vue-sonner', () => ({
    toast: {
        success: (...args) => mocks.toastSuccess(...args),
        error: (...args) => mocks.toastError(...args)
    }
}));

vi.mock('@/components/ui/button', () => ({
    Button: {
        props: ['class', 'disabled', 'variant', 'size'],
        template: '<button :class="$props.class" :data-variant="variant" :data-size="size" :disabled="disabled"><slot /></button>'
    }
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: { template: '<div><slot /></div>' },
    DropdownMenuContent: { template: '<div><slot /></div>' },
    DropdownMenuItem: { template: '<button type="button" @click="$emit(\'click\', $event)"><slot /></button>' },
    DropdownMenuLabel: { template: '<div><slot /></div>' },
    DropdownMenuSeparator: { template: '<hr />' },
    DropdownMenuTrigger: { template: '<div><slot /></div>' }
}));

vi.mock('lucide-vue-next', () => ({
    CirclePlay: { template: '<i />' },
    Headset: { template: '<i />' },
    Loader2: { template: '<i />' },
    Monitor: { template: '<i />' },
    Rocket: { template: '<i />' }
}));

function mountComponent(options = {}) {
    return mount(QuickLaunchButton, {
        ...options,
        attachTo: document.body
    });
}

describe('QuickLaunchButton', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
        vi.useFakeTimers();
        mocks.isSteamVRRunning = false;
        mocks.launchVRChat.mockResolvedValue(true);
        mocks.confirm.mockResolvedValue({ ok: true });
        mocks.startSteamVR.mockResolvedValue(true);
        globalThis.AppApi = {
            IsSteamVRRunning: vi.fn(async () => mocks.isSteamVRRunning),
            StartSteamVR: (...args) => mocks.startSteamVR(...args)
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    test('renders quick launch menu actions', () => {
        mountComponent();

        expect(document.body.textContent).toContain('quick_launch.vrchat_desktop');
        expect(document.body.textContent).toContain('quick_launch.vrchat_vr');
        expect(document.body.textContent).toContain('quick_launch.steamvr');
    });

    test('uses the same compact round button style as BackToTop', () => {
        mountComponent();

        const trigger = document.body.querySelector('[data-testid="quick-launch-button"]');
        const wrapper = trigger.closest('div[style]');

        expect(trigger.dataset.variant).toBe('secondary');
        expect(trigger.dataset.size).toBe('icon');
        expect(trigger.className).toContain('h-9');
        expect(trigger.className).toContain('w-9');
        expect(trigger.className).toContain('rounded-full');
        expect(trigger.className).toContain('shadow');
        expect(wrapper.getAttribute('style')).toContain('position: fixed');
        expect(wrapper.getAttribute('style')).toContain('right: 20px');
        expect(wrapper.getAttribute('style')).toContain('bottom: 20px');
        expect(wrapper.getAttribute('style')).toContain('transition: bottom 160ms ease');
    });

    test('moves above BackToTop when the target scrolls past the visibility threshold', async () => {
        const target = document.createElement('div');
        document.body.appendChild(target);
        Object.defineProperty(target, 'scrollTop', {
            configurable: true,
            value: 500
        });

        mountComponent({
            props: { target, visibilityHeight: 400 }
        });

        target.dispatchEvent(new Event('scroll'));
        await Promise.resolve();

        const trigger = document.body.querySelector('[data-testid="quick-launch-button"]');
        const wrapper = trigger.closest('div[style]');

        expect(wrapper.getAttribute('style')).toContain('bottom: 68px');
    });

    test('starts VRChat in desktop mode', async () => {
        mountComponent();
        const desktopItem = [...document.body.querySelectorAll('button')]
            .find((button) => button.textContent.includes('quick_launch.vrchat_desktop'));

        desktopItem.click();

        expect(mocks.launchVRChat).toHaveBeenCalledWith(true);
    });

    test('starts SteamVR before launching VRChat in VR mode', async () => {
        mountComponent();
        const vrItem = [...document.body.querySelectorAll('button')]
            .find((button) => button.textContent.includes('quick_launch.vrchat_vr'));

        vrItem.click();
        await vi.runAllTimersAsync();

        expect(mocks.confirm).toHaveBeenCalled();
        expect(mocks.startSteamVR).toHaveBeenCalled();
        expect(mocks.launchVRChat).toHaveBeenCalledWith(false);
    });

    test('continues VR launch when SteamVR prompt is declined', async () => {
        mocks.confirm.mockResolvedValue({ ok: false });
        mountComponent();
        const vrItem = [...document.body.querySelectorAll('button')]
            .find((button) => button.textContent.includes('quick_launch.vrchat_vr'));

        vrItem.click();
        await vi.runAllTimersAsync();

        expect(mocks.startSteamVR).not.toHaveBeenCalled();
        expect(mocks.launchVRChat).toHaveBeenCalledWith(false);
    });
});
