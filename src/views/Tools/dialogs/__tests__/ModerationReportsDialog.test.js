import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { nextTick } from 'vue';

import cn from '../../../../localization/zh-CN.json';
import tw from '../../../../localization/zh-TW.json';

const mocks = vi.hoisted(() => {
    const { reactive } = require('vue');
    return {
        user: reactive({ currentUser: { id: 'usr_a' } }),
        auth: reactive({
            cachedConfig: {
                reportOptions: {
                    user: {},
                    world: {},
                    avatar: {},
                    group: {},
                    future_type: {}
                },
                reportCategories: {
                    server_category: { text: 'Server category' }
                },
                reportReasons: { server_reason: { text: 'Server reason' } }
            }
        }),
        getReports: vi.fn()
    };
});
vi.mock('pinia', async (original) => ({
    ...(await original()),
    storeToRefs: (store) => require('vue').toRefs(store)
}));
vi.mock('../../../../components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogFooter: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' }
}));
vi.mock('../../../../stores', () => ({
    useUserStore: () => mocks.user,
    useAuthStore: () => mocks.auth,
    useModalStore: () => ({})
}));
vi.mock('../../../../api', () => ({
    moderationReportRequest: { getModerationReports: mocks.getReports }
}));
vi.mock('../../../../shared/utils', () => ({
    formatDateFilter: (value) => value
}));
vi.mock('../../../../coordinators/userCoordinator', () => ({
    showUserDialog: vi.fn()
}));
vi.mock('../../../../coordinators/worldCoordinator', () => ({
    showWorldDialog: vi.fn()
}));
vi.mock('../../../../coordinators/avatarCoordinator', () => ({
    showAvatarDialog: vi.fn()
}));
vi.mock('../../../../coordinators/groupCoordinator', () => ({
    showGroupDialog: vi.fn()
}));

import ModerationReportsDialog from '../ModerationReportsDialog.vue';

let wrapper;

describe('moderation report localization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getReports.mockResolvedValue({
            json: {
                results: [
                    { id: 'r1', contentName: 'User content', type: 'user' }
                ],
                hasNext: false
            }
        });
    });
    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
    });

    test('updates type badges and options when switching Chinese locales and sends raw filter values', async () => {
        const i18n = createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: { 'zh-CN': cn, 'zh-TW': tw }
        });
        wrapper = shallowMount(ModerationReportsDialog, {
            props: { isModerationReportsDialogVisible: false },
            global: { plugins: [i18n], renderStubDefaultSlot: true }
        });
        await wrapper.setProps({ isModerationReportsDialogVisible: true });
        await flushPromises();
        const state = wrapper.vm.$.setupState;
        expect(state.typeOptions).toEqual([
            { value: 'all', label: '全部' },
            { value: 'user', label: '玩家' },
            { value: 'world', label: '世界' },
            { value: 'avatar', label: '模型' },
            { value: 'group', label: '群组' },
            { value: 'future_type', label: 'future_type' }
        ]);
        expect(wrapper.text()).toContain('玩家');
        expect(wrapper.text()).toContain('User content');
        i18n.global.locale.value = 'zh-TW';
        await nextTick();
        expect(
            state.typeOptions.find((option) => option.value === 'user').label
        ).toBe('用戶');
        expect(
            state.typeOptions.find((option) => option.value === 'avatar').label
        ).toBe('角色');
        expect(wrapper.text()).toContain('用戶');
        state.setTypeFilter('avatar');
        await flushPromises();
        expect(mocks.getReports).toHaveBeenLastCalledWith({
            reportingUserId: 'usr_a',
            n: 100,
            offset: 0,
            type: 'avatar'
        });
        expect(state.reportTypeLabel('future_type')).toBe('future_type');
        expect(state.categoryLabel('server_category')).toBe('Server category');
        expect(state.reasonLabel('server_reason')).toBe('Server reason');
        expect(state.categoryLabel('unknown')).toBe('unknown');
        expect(state.reasonLabel('unknown')).toBe('unknown');
    });
});
