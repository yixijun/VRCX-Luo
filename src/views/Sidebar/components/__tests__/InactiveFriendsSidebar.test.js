import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

const mocks = vi.hoisted(() => ({
    inactiveFriends: null,
    inactiveFriendDays: null,
    confirm: vi.fn().mockResolvedValue({ ok: true }),
    deleteFriend: vi
        .fn()
        .mockResolvedValue({ params: { userId: 'usr_default' } }),
    handleFriendDelete: vi.fn(),
    showUserDialog: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn()
}));

mocks.inactiveFriends = ref([]);
mocks.inactiveFriendDays = ref(30);

vi.mock('pinia', async (importOriginal) => ({
    ...(await importOriginal()),
    storeToRefs: (store) => store
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key)
    })
}));

vi.mock('../../../../stores', () => ({
    useAppearanceSettingsStore: () => ({
        inactiveFriendDays: mocks.inactiveFriendDays
    }),
    useFriendStore: () => ({ inactiveFriends: mocks.inactiveFriends }),
    useModalStore: () => ({ confirm: (...args) => mocks.confirm(...args) })
}));

vi.mock('../../../../api', () => ({
    friendRequest: {
        deleteFriend: (...args) => mocks.deleteFriend(...args)
    }
}));

vi.mock('../../../../coordinators/friendRelationshipCoordinator', () => ({
    handleFriendDelete: (...args) => mocks.handleFriendDelete(...args)
}));

vi.mock('../../../../coordinators/userCoordinator', () => ({
    showUserDialog: (...args) => mocks.showUserDialog(...args)
}));

vi.mock('../../../../composables/useUserDisplay', () => ({
    useUserDisplay: () => ({
        userImage: () => 'avatar.png',
        userStatusClass: () => ''
    })
}));

vi.mock('../../../../shared/utils', () => ({
    formatDateFilter: () => '2026/01/01'
}));

vi.mock('vue-sonner', () => ({
    toast: {
        success: (...args) => mocks.toastSuccess(...args),
        error: (...args) => mocks.toastError(...args)
    }
}));

vi.mock('@/components/ui/avatar', () => ({
    Avatar: { template: '<div><slot /></div>' },
    AvatarFallback: { template: '<div><slot /></div>' },
    AvatarImage: { template: '<img />' }
}));

vi.mock('@/components/ui/button', () => ({
    Button: {
        emits: ['click'],
        template: '<button @click="$emit(\'click\')"><slot /></button>'
    }
}));

vi.mock('@/components/ui/checkbox', () => ({
    Checkbox: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template:
            '<button data-testid="inactive-checkbox" @click="$emit(\'update:modelValue\', !modelValue)" />'
    }
}));

vi.mock('@/components/ui/tooltip', () => ({
    TooltipWrapper: { template: '<div><slot /></div>' }
}));

vi.mock('lucide-vue-next', () => ({
    CheckCheck: { template: '<i />' },
    ListChecks: { template: '<i />' },
    LoaderCircle: { template: '<i />' },
    Trash2: { template: '<i />' },
    User: { template: '<i />' },
    X: { template: '<i />' }
}));

import InactiveFriendsSidebar from '../InactiveFriendsSidebar.vue';

function makeFriend(id, displayName) {
    return {
        id,
        name: displayName,
        ref: {
            id,
            displayName,
            last_login: '2026-01-01T00:00:00Z'
        }
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('InactiveFriendsSidebar.vue', () => {
    beforeEach(() => {
        mocks.inactiveFriends.value = [
            makeFriend('usr_one', 'One'),
            makeFriend('usr_two', 'Two')
        ];
        mocks.confirm.mockReset();
        mocks.confirm.mockResolvedValue({ ok: true });
        mocks.deleteFriend.mockReset();
        mocks.deleteFriend.mockImplementation(({ userId }) =>
            Promise.resolve({ params: { userId } })
        );
        mocks.handleFriendDelete.mockReset();
        mocks.showUserDialog.mockReset();
        mocks.toastSuccess.mockReset();
        mocks.toastError.mockReset();
    });

    test('selects all inactive friends and deletes them sequentially after confirmation', async () => {
        const wrapper = mount(InactiveFriendsSidebar);

        await wrapper
            .get('[data-testid="inactive-batch-manage"]')
            .trigger('click');
        expect(
            wrapper.findAll('[data-testid="inactive-checkbox"]')
        ).toHaveLength(2);

        await wrapper
            .get('[data-testid="inactive-select-all"]')
            .trigger('click');
        await wrapper
            .get('[data-testid="inactive-delete-selected"]')
            .trigger('click');
        await flushPromises();
        await nextTick();

        expect(mocks.confirm).toHaveBeenCalledOnce();
        expect(mocks.deleteFriend.mock.calls).toEqual([
            [{ userId: 'usr_one' }],
            [{ userId: 'usr_two' }]
        ]);
        expect(mocks.handleFriendDelete).toHaveBeenCalledTimes(2);
        expect(mocks.toastSuccess).toHaveBeenCalledOnce();
    });

    test('continues deleting remaining friends when one request fails', async () => {
        mocks.deleteFriend
            .mockRejectedValueOnce(new Error('rate limited'))
            .mockResolvedValueOnce({ params: { userId: 'usr_two' } });
        const wrapper = mount(InactiveFriendsSidebar);

        await wrapper
            .get('[data-testid="inactive-batch-manage"]')
            .trigger('click');
        await wrapper
            .get('[data-testid="inactive-select-all"]')
            .trigger('click');
        await wrapper
            .get('[data-testid="inactive-delete-selected"]')
            .trigger('click');
        await flushPromises();
        await nextTick();

        expect(mocks.deleteFriend).toHaveBeenCalledTimes(2);
        expect(mocks.handleFriendDelete).toHaveBeenCalledTimes(1);
        expect(mocks.toastError).toHaveBeenCalledOnce();
    });
});
