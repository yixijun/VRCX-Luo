import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
    closeMainDialog: vi.fn(),
    handleBreadcrumbClick: vi.fn(),
    dialogCrumbs: {
        value: [
            { type: 'user', id: 'u1', label: 'User' },
            { type: 'world', id: 'w1', label: 'World' }
        ]
    },
    userVisible: { value: true },
    previousInstancesInfoVisible: { value: false },
    previousInstancesVisible: { value: false },
    previousInstancesVariant: { value: 'user' }
}));

vi.mock('pinia', async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock('@/stores', () => ({
    useUiStore: () => ({
        dialogCrumbs: mocks.dialogCrumbs.value,
        closeMainDialog: (...a) => mocks.closeMainDialog(...a),
        handleBreadcrumbClick: (...a) => mocks.handleBreadcrumbClick(...a)
    }),
    useUserStore: () => ({ userDialog: { visible: mocks.userVisible.value } }),
    useWorldStore: () => ({ worldDialog: { visible: false } }),
    useAvatarStore: () => ({ avatarDialog: { visible: false } }),
    useGroupStore: () => ({ groupDialog: { visible: false } }),
    useInstanceStore: () => ({
        previousInstancesInfoDialog: ref({
            visible: mocks.previousInstancesInfoVisible.value
        }),
        previousInstancesListDialog: ref({
            visible: mocks.previousInstancesVisible.value,
            variant: mocks.previousInstancesVariant.value
        })
    })
}));
vi.mock('@/components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: {
        inheritAttrs: false,
        template:
            '<div data-testid="dialog-content" :class="$attrs.class"><slot /></div>'
    }
}));
vi.mock('@/components/ui/breadcrumb', () => ({
    Breadcrumb: { template: '<div><slot /></div>' },
    BreadcrumbList: { template: '<div><slot /></div>' },
    BreadcrumbItem: { template: '<div><slot /></div>' },
    BreadcrumbLink: { template: '<div><slot /></div>' },
    BreadcrumbSeparator: { template: '<span>/</span>' },
    BreadcrumbPage: { template: '<span><slot /></span>' },
    BreadcrumbEllipsis: { template: '<span>...</span>' }
}));
vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: { template: '<div><slot /></div>' },
    DropdownMenuTrigger: { template: '<div><slot /></div>' },
    DropdownMenuContent: { template: '<div><slot /></div>' },
    DropdownMenuItem: {
        emits: ['click'],
        template:
            '<button data-testid="crumb-dd" @click="$emit(\'click\')"><slot /></button>'
    }
}));
vi.mock('@/components/ui/button', () => ({
    Button: {
        emits: ['click'],
        template:
            '<button data-testid="btn" @click="$emit(\'click\')"><slot /></button>'
    }
}));
vi.mock('@/components/ui/tooltip', () => ({
    TooltipWrapper: { template: '<div><slot /></div>' }
}));
vi.mock('lucide-vue-next', () => ({ ArrowLeft: { template: '<i />' } }));
vi.mock('../AvatarDialog/AvatarDialog.vue', () => ({
    default: { template: '<div />' }
}));
vi.mock('../GroupDialog/GroupDialog.vue', () => ({
    default: { template: '<div />' }
}));
vi.mock('../PreviousInstancesDialog/PreviousInstancesInfoDialog.vue', () => ({
    default: { template: '<div />' }
}));
vi.mock('../PreviousInstancesDialog/PreviousInstancesListDialog.vue', () => ({
    default: { template: '<div />' }
}));
vi.mock('../UserDialog/UserDialog.vue', () => ({
    default: { template: '<div data-testid="user-dialog" />' }
}));
vi.mock('../WorldDialog/WorldDialog.vue', () => ({
    default: { template: '<div />' }
}));

import MainDialogContainer from '../MainDialogContainer.vue';

describe('MainDialogContainer.vue', () => {
    beforeEach(() => {
        mocks.handleBreadcrumbClick.mockClear();
        mocks.userVisible.value = true;
        mocks.previousInstancesInfoVisible.value = false;
        mocks.previousInstancesVisible.value = false;
        mocks.previousInstancesVariant.value = 'user';
    });

    it('renders active dialog and handles breadcrumb back click', async () => {
        const wrapper = mount(MainDialogContainer);
        expect(wrapper.find('[data-testid="user-dialog"]').exists()).toBe(true);

        await wrapper.get('[data-testid="btn"]').trigger('click');
        expect(mocks.handleBreadcrumbClick).toHaveBeenCalled();
    });

    it('gives previous instances a definite viewport height for the nested scroll area', () => {
        mocks.userVisible.value = false;
        mocks.previousInstancesVisible.value = true;

        const wrapper = mount(MainDialogContainer);
        const dialog = wrapper.get('[data-testid="dialog-content"]');

        expect(dialog.classes()).toEqual(
            expect.arrayContaining([
                'previous-instances-dialog',
                'h-[calc(100dvh-3rem)]',
                'overflow-hidden',
                'flex',
                'flex-col'
            ])
        );
        expect(dialog.classes()).not.toContain('translate-y-0');
    });

    it('keeps the previous-instance details on the same bounded scroll layout', () => {
        mocks.userVisible.value = false;
        mocks.previousInstancesInfoVisible.value = true;

        const wrapper = mount(MainDialogContainer);
        const dialog = wrapper.get('[data-testid="dialog-content"]');

        expect(dialog.classes()).toEqual(
            expect.arrayContaining([
                'previous-instances-dialog',
                'h-[calc(100dvh-3rem)]',
                'overflow-hidden',
                'flex',
                'flex-col'
            ])
        );
    });

    it('uses the same bounded layout for instances from worlds created by a user', () => {
        mocks.userVisible.value = false;
        mocks.previousInstancesVisible.value = true;
        mocks.previousInstancesVariant.value = 'user-created';

        const wrapper = mount(MainDialogContainer);
        const dialog = wrapper.get('[data-testid="dialog-content"]');

        expect(dialog.classes()).toEqual(
            expect.arrayContaining([
                'previous-instances-dialog',
                'h-[calc(100dvh-3rem)]',
                'overflow-hidden',
                'flex',
                'flex-col'
            ])
        );
    });

    it('animates content when switching between dialog pages', () => {
        const wrapper = mount(MainDialogContainer);
        const transition = wrapper.get('transition-stub');

        expect(transition.attributes('name')).toBe('dialog-panel');
        expect(transition.attributes('mode')).toBe('out-in');
    });
});
