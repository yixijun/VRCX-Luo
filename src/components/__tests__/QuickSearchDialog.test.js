import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
    selectResult: vi.fn(),
    userImage: vi.fn(() => 'https://example.com/u.png'),
    isOpen: { value: true },
    query: { value: '' },
    friendResults: { value: [] },
    ownAvatarResults: { value: [] },
    favoriteAvatarResults: { value: [] },
    ownWorldResults: { value: [] },
    favoriteWorldResults: { value: [] },
    ownGroupResults: { value: [] },
    joinedGroupResults: { value: [] },
    recentlyMetResults: { value: [] },
    recentBeenResults: { value: [] },
    hasResults: { value: false }
}));

vi.mock('pinia', async (i) => ({
    ...(await i()),
    storeToRefs: (s) =>
        Object.fromEntries(
            Object.entries(s).map(([key, value]) => [
                key,
                value && typeof value === 'object' && 'value' in value
                    ? value.value
                    : value
            ])
        )
}));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }));
vi.mock('../../stores/quickSearch', () => ({
    useQuickSearchStore: () => ({
        isOpen: mocks.isOpen,
        query: mocks.query,
        friendResults: mocks.friendResults,
        ownAvatarResults: mocks.ownAvatarResults,
        favoriteAvatarResults: mocks.favoriteAvatarResults,
        ownWorldResults: mocks.ownWorldResults,
        favoriteWorldResults: mocks.favoriteWorldResults,
        ownGroupResults: mocks.ownGroupResults,
        joinedGroupResults: mocks.joinedGroupResults,
        recentlyMetResults: mocks.recentlyMetResults,
        recentBeenResults: mocks.recentBeenResults,
        hasResults: mocks.hasResults,
        selectResult: (...args) => mocks.selectResult(...args)
    })
}));
vi.mock('../../composables/useUserDisplay', () => ({
    useUserDisplay: () => ({ userImage: (...a) => mocks.userImage(...a) })
}));
vi.mock('../QuickSearchSync.vue', () => ({
    default: { template: '<div data-testid="sync" />' }
}));
vi.mock('../UserIdentityInline.vue', () => ({
    default: { template: '<span><slot /></span>' }
}));
vi.mock('@/components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' },
    DialogDescription: { template: '<div><slot /></div>' }
}));
vi.mock('@/components/ui/command', () => ({
    Command: { template: '<div><slot /></div>' },
    CommandInput: { template: '<input />' },
    CommandList: { template: '<div><slot /></div>' },
    CommandGroup: { template: '<div><slot /></div>' },
    CommandItem: {
        emits: ['select'],
        template:
            '<button data-testid="cmd-item" @click="$emit(\'select\')"><slot /></button>'
    }
}));
vi.mock('lucide-vue-next', () => ({
    Clock: { template: '<i />' },
    Globe: { template: '<i />' },
    History: { template: '<i />' },
    Image: { template: '<i />' },
    Users: { template: '<i />' }
}));

import QuickSearchDialog from '../QuickSearchDialog.vue';

describe('QuickSearchDialog.vue', () => {
    beforeEach(() => {
        mocks.selectResult.mockClear();
        mocks.query.value = '';
        mocks.hasResults.value = false;
        mocks.friendResults.value = [];
        mocks.ownWorldResults.value = [];
        mocks.ownGroupResults.value = [];
        mocks.joinedGroupResults.value = [];
        mocks.recentlyMetResults.value = [];
        mocks.recentBeenResults.value = [];
    });

    it('renders search dialog structure', () => {
        const wrapper = mount(QuickSearchDialog);
        expect(wrapper.text()).toContain('side_panel.search_placeholder');
        expect(wrapper.find('[data-testid="sync"]').exists()).toBe(true);
    });

    it('renders world and group results that the store already provides', async () => {
        mocks.query.value = 'alpha';
        mocks.hasResults.value = true;
        mocks.ownWorldResults.value = [
            { id: 'wrld_1', name: 'Alpha World', imageUrl: '' }
        ];
        mocks.ownGroupResults.value = [
            { id: 'grp_1', name: 'Alpha Group', imageUrl: '' }
        ];
        mocks.joinedGroupResults.value = [
            { id: 'grp_2', name: 'Joined Alpha', imageUrl: '' }
        ];

        const wrapper = mount(QuickSearchDialog);

        expect(wrapper.text()).toContain('Alpha World');
        expect(wrapper.text()).toContain('Alpha Group');
        expect(wrapper.text()).toContain('Joined Alpha');

        const worldItem = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Alpha World'));
        await worldItem.trigger('click');
        expect(mocks.selectResult).toHaveBeenCalledWith(
            mocks.ownWorldResults.value[0]
        );
    });
});
