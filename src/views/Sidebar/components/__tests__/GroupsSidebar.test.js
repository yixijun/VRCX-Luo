import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
    isAgeGatedInstancesVisible: { value: true },
    groupInstances: {
        value: [
            {
                group: {
                    groupId: 'grp_1',
                    name: 'Group One',
                    iconUrl: 'https://example.com/icon.png'
                },
                instance: {
                    id: 'inst_1',
                    ownerId: 'usr_owner',
                    userCount: 1,
                    capacity: 16,
                    location: 'wrld_1:123'
                }
            }
        ]
    },
    sortGroupInstancesByInGame: (a, b) =>
        a[0].group.name.localeCompare(b[0].group.name),
    showLaunchDialog: vi.fn(),
    checkCanInviteSelf: vi.fn(() => true),
    selfInvite: vi.fn().mockResolvedValue({}),
    showGroupDialog: vi.fn(),
    showWorldDialog: vi.fn(),
    toastSuccess: vi.fn()
}));

vi.mock('pinia', async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }));

vi.mock('@tanstack/vue-virtual', () => ({
    useVirtualizer: (optionsRef) => ({
        value: {
            getVirtualItems: () =>
                Array.from({ length: optionsRef.value.count }, (_, index) => ({
                    index,
                    key: optionsRef.value.getItemKey(index),
                    start: index * 52
                })),
            getTotalSize: () => optionsRef.value.count * 52,
            measure: vi.fn(),
            measureElement: vi.fn()
        }
    })
}));

vi.mock('../../../../stores', () => ({
    useAppearanceSettingsStore: () => ({
        isAgeGatedInstancesVisible: mocks.isAgeGatedInstancesVisible
    }),
    useGroupStore: () => ({
        sortGroupInstancesByInGame: mocks.sortGroupInstancesByInGame,
        groupInstances: mocks.groupInstances
    }),
    useLaunchStore: () => ({
        showLaunchDialog: (...a) => mocks.showLaunchDialog(...a)
    })
}));

vi.mock('../../../../composables/useInviteChecks', () => ({
    useInviteChecks: () => ({
        checkCanInviteSelf: (...a) => mocks.checkCanInviteSelf(...a)
    })
}));

vi.mock('../../../../shared/utils', () => ({
    convertFileUrlToImageUrl: (url) => `${url}?small`,
    parseLocation: (location) => ({
        isRealInstance: !!location,
        worldId: location.split(':')[0],
        instanceId: location.split(':')[1]
    })
}));

vi.mock('../../../../coordinators/groupCoordinator', () => ({
    showGroupDialog: (...a) => mocks.showGroupDialog(...a)
}));

vi.mock('../../../../coordinators/worldCoordinator', () => ({
    showWorldDialog: (...a) => mocks.showWorldDialog(...a)
}));

vi.mock('../../../../api', () => ({
    instanceRequest: {
        selfInvite: (...a) => mocks.selfInvite(...a)
    }
}));

vi.mock('vue-sonner', () => ({
    toast: {
        success: (...a) => mocks.toastSuccess(...a)
    }
}));

vi.mock('../../../../components/ui/context-menu', () => ({
    ContextMenu: { template: '<div><slot /></div>' },
    ContextMenuTrigger: { template: '<div><slot /></div>' },
    ContextMenuContent: { template: '<div><slot /></div>' },
    ContextMenuItem: {
        emits: ['click'],
        props: ['disabled'],
        template:
            '<button data-testid="ctx-item" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
    }
}));

vi.mock('../../../../components/BackToTop.vue', () => ({
    default: {
        props: ['teleport'],
        template:
            '<div data-testid="back-to-top" :data-teleport="String(teleport)" />'
    }
}));

vi.mock('../../../../components/QuickLaunchButton.vue', () => ({
    default: {
        props: ['teleport'],
        template:
            '<div data-testid="quick-launch-button" :data-teleport="String(teleport)" />'
    }
}));

vi.mock('../../../../components/Location.vue', () => ({
    default: {
        props: ['location'],
        template: '<span data-testid="location">{{ location }}</span>'
    }
}));

vi.mock('lucide-vue-next', () => ({
    ChevronDown: { template: '<i />' },
    Users: { template: '<i />' }
}));

import GroupsSidebar from '../GroupsSidebar.vue';

describe('GroupsSidebar.vue', () => {
    beforeEach(() => {
        mocks.showLaunchDialog.mockClear();
        mocks.selfInvite.mockClear();
        mocks.showGroupDialog.mockClear();
        mocks.showWorldDialog.mockClear();
        mocks.toastSuccess.mockClear();
    });

    it('opens the group from its heading and the room from its card', async () => {
        const wrapper = mount(GroupsSidebar);

        expect(wrapper.text()).toContain('Group One');

        await wrapper.get('[data-testid="group-heading"]').trigger('click');
        expect(mocks.showGroupDialog).toHaveBeenCalledWith('grp_1');

        await wrapper.get('[data-testid="group-room"]').trigger('click');
        expect(mocks.showWorldDialog).toHaveBeenCalledWith('wrld_1:123');
    });

    it('handles launch/self-invite actions', async () => {
        const wrapper = mount(GroupsSidebar);

        const items = wrapper.findAll('[data-testid="ctx-item"]');
        await items[0].trigger('click');
        expect(mocks.showLaunchDialog).toHaveBeenCalledWith('wrld_1:123');

        await items[1].trigger('click');
        await Promise.resolve();
        expect(mocks.selfInvite).toHaveBeenCalledWith({
            worldId: 'wrld_1',
            instanceId: '123'
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
            'message.invite.self_sent'
        );
    });

    it('keeps floating controls inside the visible sidebar tab', () => {
        const wrapper = mount(GroupsSidebar);

        expect(
            wrapper
                .get('[data-testid="quick-launch-button"]')
                .attributes('data-teleport')
        ).toBe('false');
        expect(
            wrapper
                .get('[data-testid="back-to-top"]')
                .attributes('data-teleport')
        ).toBe('false');
    });

    it('does not render floating controls while the tab is inactive', () => {
        const wrapper = mount(GroupsSidebar, {
            props: { active: false }
        });

        expect(
            wrapper.find('[data-testid="quick-launch-button"]').exists()
        ).toBe(false);
        expect(wrapper.find('[data-testid="back-to-top"]').exists()).toBe(
            false
        );
    });
});
