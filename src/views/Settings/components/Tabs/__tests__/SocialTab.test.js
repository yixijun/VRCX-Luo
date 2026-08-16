import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
    setRelationshipSuggestionPromptsEnabled: vi.fn(),
    generalStore: {
        recentActionCooldownEnabled: { value: false },
        recentActionCooldownMinutes: { value: 60 },
        relationshipSuggestionPromptsEnabled: { value: true },
        localFavoriteFriendsGroups: { value: [] },
        setRecentActionCooldownEnabled: vi.fn(),
        setRecentActionCooldownMinutes: vi.fn(),
        setRelationshipSuggestionPromptsEnabled: vi.fn(),
        setLocalFavoriteFriendsGroups: vi.fn()
    },
    favoriteStore: {
        favoriteFriendGroups: { value: [] },
        localFriendFavoriteGroups: { value: [] }
    }
}));

vi.mock('pinia', async (importOriginal) => ({
    ...(await importOriginal()),
    storeToRefs: (store) => store
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('@/stores', () => ({
    useGeneralSettingsStore: () => mocks.generalStore,
    useFavoriteStore: () => mocks.favoriteStore
}));

vi.mock('@/components/ui/switch', () => ({
    Switch: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template:
            '<button data-testid="settings-switch" @click="$emit(\'update:modelValue\', !modelValue)" />'
    }
}));

vi.mock('@/components/ui/number-field', () => ({
    NumberField: { template: '<div><slot /></div>' },
    NumberFieldContent: { template: '<div><slot /></div>' },
    NumberFieldDecrement: { template: '<button />' },
    NumberFieldIncrement: { template: '<button />' },
    NumberFieldInput: { template: '<input />' }
}));

vi.mock('@/components/ui/select', () => ({
    Select: { template: '<div><slot /></div>' },
    SelectContent: { template: '<div><slot /></div>' },
    SelectGroup: { template: '<div><slot /></div>' },
    SelectItem: { template: '<div><slot /></div>' },
    SelectSeparator: { template: '<hr />' },
    SelectTrigger: { template: '<button><slot /></button>' },
    SelectValue: { template: '<span />' }
}));

vi.mock('../../SettingsGroup.vue', () => ({
    default: { template: '<section><slot /></section>' }
}));

vi.mock('../../SettingsItem.vue', () => ({
    default: {
        props: ['label', 'description'],
        template:
            '<div class="settings-item" :data-label="label" :data-description="description"><slot /></div>'
    }
}));

import SocialTab from '../SocialTab.vue';

describe('SocialTab.vue', () => {
    beforeEach(() => {
        mocks.generalStore.setRelationshipSuggestionPromptsEnabled.mockClear();
    });

    it('lets the user disable relationship suggestion prompts', async () => {
        const wrapper = mount(SocialTab);
        const setting = wrapper.get(
            '[data-label="view.settings.social.interaction.relationship_suggestion_prompts"]'
        );

        await setting.get('[data-testid="settings-switch"]').trigger('click');

        expect(
            mocks.generalStore.setRelationshipSuggestionPromptsEnabled
        ).toHaveBeenCalledTimes(1);
    });
});
