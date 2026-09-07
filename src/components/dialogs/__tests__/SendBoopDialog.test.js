import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
    sendBoop: vi.fn(),
    fetch: vi.fn(async () => ({ ref: { displayName: 'User A' } })),
    boopDialog: { value: { visible: true, userId: 'usr_1' } },
    isLocalUserVrcPlusSupporter: { value: false },
    emojiTable: { value: [] }
}));

vi.mock('pinia', async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }));
vi.mock('../../../api', () => ({
    miscRequest: { sendBoop: (...a) => mocks.sendBoop(...a) },
    notificationRequest: { hideNotificationV2: vi.fn() },
    queryRequest: { fetch: (...a) => mocks.fetch(...a) }
}));
vi.mock('../../../stores', () => ({
    useUserStore: () => ({
        sendBoopDialog: mocks.boopDialog,
        isLocalUserVrcPlusSupporter: mocks.isLocalUserVrcPlusSupporter
    }),
    useNotificationStore: () => ({
        notificationTable: { value: { data: [] } },
        isNotificationExpired: () => false,
        handleNotificationV2Hide: vi.fn()
    }),
    useGalleryStore: () => ({
        showGalleryPage: vi.fn(),
        refreshEmojiTable: vi.fn(),
        emojiTable: mocks.emojiTable
    })
}));
vi.mock('../../../shared/constants/photon.js', () => ({
    photonEmojis: ['Jack O Lantern']
}));
vi.mock('@/components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' },
    DialogFooter: { template: '<div><slot /></div>' }
}));
vi.mock('@/components/ui/button', () => ({
    Button: {
        emits: ['click'],
        inheritAttrs: false,
        template:
            '<button v-bind="$attrs" data-testid="btn" @click="$emit(\'click\')"><slot /></button>'
    }
}));
vi.mock('../../ui/popover', () => ({
    Popover: {
        props: ['open'],
        emits: ['update:open'],
        template: '<div><slot /></div>'
    },
    PopoverTrigger: { template: '<div><slot /></div>' },
    PopoverContent: { template: '<div data-testid="emoji-picker"><slot /></div>' }
}));
vi.mock('@/components/ui/input', () => ({
    Input: {
        inheritAttrs: false,
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template:
            '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    }
}));
vi.mock('../../Emoji.vue', () => ({ default: { template: '<div />' } }));
vi.mock('lucide-vue-next', () => ({
    Check: { template: '<i />' },
    ChevronDown: { template: '<i />' }
}));

mocks.emojiTable = ref([]);

import SendBoopDialog from '../SendBoopDialog.vue';

describe('SendBoopDialog.vue', () => {
    it('renders boop dialog content', async () => {
        const wrapper = mount(SendBoopDialog);
        expect(wrapper.text()).toContain('dialog.boop_dialog.header');
    });

    it('keeps default emoji names searchable while providing an icon glyph', () => {
        const wrapper = mount(SendBoopDialog);
        const item = wrapper.vm.defaultEmojiItems[0];

        expect(item).toMatchObject({
            label: 'Jack O Lantern',
            search: 'Jack O Lantern',
            glyph: '🎃'
        });
    });

    it('filters the dropdown by the searchable emoji name', async () => {
        const wrapper = mount(SendBoopDialog);

        wrapper.vm.emojiSearch = 'lantern';
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.filteredDefaultEmojiItems).toHaveLength(1);
        expect(wrapper.vm.filteredDefaultEmojiItems[0].value).toBe('default_jack_o_lantern');
    });

    it('selects the original VRChat emoji id and closes the dropdown', async () => {
        const wrapper = mount(SendBoopDialog);

        wrapper.vm.emojiPickerOpen = true;
        wrapper.vm.selectDefaultEmoji('default_jack_o_lantern');

        expect(wrapper.vm.fileId).toBe('default_jack_o_lantern');
        expect(wrapper.vm.emojiPickerOpen).toBe(false);
    });

    it('makes the selected custom emoji visually obvious', async () => {
        mocks.isLocalUserVrcPlusSupporter.value = true;
        mocks.emojiTable.value = [
            {
                id: 'emoji_custom_1',
                versions: [{ file: { url: 'https://example.com/emoji.png' } }]
            }
        ];

        const wrapper = mount(SendBoopDialog);
        const option = wrapper.get('[data-testid="custom-emoji-option"]');

        await option.trigger('click');

        expect(option.classes()).toEqual(
            expect.arrayContaining(['border-primary', 'bg-primary/10', 'ring-2', 'p-0'])
        );
        const marker = option.get('[data-testid="custom-emoji-selected"]');
        expect(marker.classes()).toEqual(expect.arrayContaining(['top-1.5', 'right-1.5', 'z-10']));
        expect(marker.classes()).not.toContain('bottom-1.5');

        const preview = option.get('[data-testid="custom-emoji-preview"]');
        expect(preview.classes()).toEqual(expect.arrayContaining(['aspect-square', 'w-full']));
        expect(preview.attributes('style')).toBeUndefined();
    });
});
