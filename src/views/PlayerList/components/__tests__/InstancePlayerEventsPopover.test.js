import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key
    })
}));

vi.mock('../../../../components/ui/button', () => ({
    Button: {
        template: '<button v-bind="$attrs"><slot /></button>'
    }
}));

vi.mock('../../../../components/ui/popover', () => ({
    Popover: {
        props: ['open'],
        emits: ['update:open'],
        template:
            '<div data-testid="popover" @click="$emit(\'update:open\', !open)"><slot /></div>'
    },
    PopoverTrigger: {
        template: '<span data-testid="popover-trigger"><slot /></span>'
    },
    PopoverContent: {
        template:
            '<div data-testid="player-events-popover" v-bind="$attrs"><slot /></div>'
    }
}));

vi.mock('lucide-vue-next', () => ({
    History: { template: '<span data-testid="history-icon" />' }
}));

vi.mock('../InstancePlayerEvents.vue', () => ({
    default: {
        props: ['location'],
        template: '<div data-testid="event-panel" :data-location="location" />'
    }
}));

import InstancePlayerEventsPopover from '../InstancePlayerEventsPopover.vue';

describe('InstancePlayerEventsPopover.vue', () => {
    test('opens a right-aligned floating panel from the icon trigger', async () => {
        const wrapper = mount(InstancePlayerEventsPopover, {
            props: { location: 'wrld_123:instance_1' }
        });

        expect(wrapper.find('[data-testid="event-panel"]').exists()).toBe(
            false
        );

        await wrapper
            .get('[data-testid="toggle-player-events"]')
            .trigger('click');

        const content = wrapper.get('[data-testid="player-events-popover"]');
        expect(content.attributes('side')).toBe('bottom');
        expect(content.attributes('align')).toBe('end');
        expect(content.classes()).toContain('max-h-[var(--reka-popover-content-available-height)]');
        expect(content.classes()).toContain('overflow-hidden');
        expect(content.attributes('style')).toMatch(
            /height:\s*min\(24rem,\s*var\(--reka-popover-content-available-height,\s*24rem\)\)/
        );
        expect(
            wrapper
                .get('[data-testid="event-panel"]')
                .attributes('data-location')
        ).toBe('wrld_123:instance_1');
        expect(
            wrapper
                .get('[data-testid="toggle-player-events"]')
                .attributes('title')
        ).toBe('view.player_list.presence.back_to_players');

        await wrapper
            .get('[data-testid="toggle-player-events"]')
            .trigger('click');
        expect(wrapper.find('[data-testid="event-panel"]').exists()).toBe(
            false
        );
    });
});
