import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
    selfInvite: vi.fn(async () => ({})),
    writeText: vi.fn(),
    getBool: vi.fn(async () => false),
    isGameRunning: { value: false },
    isSteamVRRunning: { value: false },
    setIsSteamVRRunning: vi.fn(),
    confirm: vi.fn(async () => ({ ok: true })),
    launchGame: vi.fn(),
    launchDialogData: {
        value: {
            visible: true,
            loading: true,
            tag: 'wrld_1:123',
            shortName: 'abc'
        }
    }
}));

Object.assign(globalThis, {
    navigator: { clipboard: { writeText: (...a) => mocks.writeText(...a) } },
    AppApi: {
        IsSteamVRRunning: vi.fn(async () => false),
        StartSteamVR: vi.fn(async () => true)
    }
});

vi.mock('pinia', async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }));
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../stores', () => ({
    useFriendStore: () => ({ friends: ref(new Map()) }),
    useGameStore: () => ({
        isGameRunning: mocks.isGameRunning,
        isSteamVRRunning: mocks.isSteamVRRunning,
        setIsSteamVRRunning: (...args) => mocks.setIsSteamVRRunning(...args)
    }),
    useInviteStore: () => ({ canOpenInstanceInGame: ref(false) }),
    useLaunchStore: () => ({
        launchDialogData: mocks.launchDialogData,
        launchGame: (...args) => mocks.launchGame(...args),
        tryOpenInstanceInVrc: vi.fn()
    }),
    useLocationStore: () => ({ lastLocation: ref({ friendList: new Map() }) }),
    useModalStore: () => ({ confirm: (...args) => mocks.confirm(...args) })
}));
vi.mock('../../../shared/utils', () => ({
    getLaunchURL: () => 'vrchat://launch',
    isRealInstance: () => true,
    parseLocation: () => ({
        isRealInstance: true,
        worldId: 'wrld_1',
        instanceId: '123',
        tag: 'wrld_1:123'
    })
}));
vi.mock('../../../composables/useInviteChecks', () => ({
    useInviteChecks: () => ({ checkCanInvite: () => true })
}));
vi.mock('../../../api', () => ({
    instanceRequest: {
        selfInvite: (...a) => mocks.selfInvite(...a),
        getInstanceShortName: vi.fn()
    },
    queryRequest: { fetch: vi.fn() }
}));
vi.mock('../../../services/config', () => ({
    default: { getBool: (...a) => mocks.getBool(...a), setBool: vi.fn() }
}));
vi.mock('@/components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' },
    DialogDescription: { template: '<div><slot /></div>' },
    DialogFooter: { template: '<div><slot /></div>' }
}));
vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: { template: '<div><slot /></div>' },
    DropdownMenuTrigger: { template: '<div><slot /></div>' },
    DropdownMenuContent: { template: '<div><slot /></div>' },
    DropdownMenuItem: { template: '<div><slot /></div>' }
}));
vi.mock('@/components/ui/field', () => ({
    Field: { template: '<div><slot /></div>' },
    FieldGroup: { template: '<div><slot /></div>' },
    FieldLabel: { template: '<div><slot /></div>' },
    FieldContent: { template: '<div><slot /></div>' }
}));
vi.mock('@/components/ui/button', () => ({
    Button: {
        emits: ['click'],
        template:
            '<button data-testid="btn" @click="$emit(\'click\')"><slot /></button>'
    }
}));
vi.mock('@/components/ui/button-group', () => ({
    ButtonGroup: { template: '<div><slot /></div>' }
}));
vi.mock('@/components/ui/input-group', () => ({
    InputGroupField: { template: '<input />' }
}));
vi.mock('@/components/ui/tooltip', () => ({
    TooltipWrapper: { template: '<div><slot /></div>' }
}));
vi.mock('../InviteDialog/InviteDialog.vue', () => ({
    default: { template: '<div />' }
}));
vi.mock('lucide-vue-next', () => ({
    Copy: { template: '<i />' },
    Info: { template: '<i />' },
    MoreHorizontal: { template: '<i />' }
}));

import LaunchDialog from '../LaunchDialog.vue';
import { Button } from '@/components/ui/button';

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

async function waitForExpect(assertion) {
    for (let i = 0; i < 10; i++) {
        try {
            assertion();
            return;
        } catch (error) {
            await flushPromises();
            if (i === 9) {
                throw error;
            }
        }
    }
}

describe('LaunchDialog.vue', () => {
    beforeEach(() => {
        mocks.selfInvite.mockClear();
        mocks.confirm.mockClear();
        mocks.launchGame.mockClear();
        mocks.setIsSteamVRRunning.mockClear();
        mocks.isGameRunning.value = false;
        mocks.isSteamVRRunning.value = false;
        AppApi.IsSteamVRRunning = vi.fn(async () => false);
        AppApi.StartSteamVR = vi.fn(async () => true);
    });

    it('renders launch dialog header', async () => {
        const wrapper = mount(LaunchDialog);
        await Promise.resolve();
        expect(wrapper.text()).toContain('dialog.launch.header');
    });

    it('waits after starting SteamVR before launching VRChat in VR mode', async () => {
        vi.useFakeTimers();
        const wrapper = mount(LaunchDialog);
        await flushPromises();

        const launchButton = wrapper
            .findAllComponents(Button)
            .find((button) => button.text() === 'dialog.launch.launch');
        await launchButton.vm.$emit('click');
        await flushPromises();

        await waitForExpect(() => expect(AppApi.IsSteamVRRunning).toHaveBeenCalled());
        await waitForExpect(() => expect(mocks.confirm).toHaveBeenCalled());
        await waitForExpect(() => expect(AppApi.StartSteamVR).toHaveBeenCalled());
        expect(mocks.launchGame).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(4999);
        expect(mocks.launchGame).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(mocks.launchGame).toHaveBeenCalledTimes(1);
        expect(mocks.launchGame.mock.calls[0][2]).toBe(false);

        vi.useRealTimers();
    });
});
