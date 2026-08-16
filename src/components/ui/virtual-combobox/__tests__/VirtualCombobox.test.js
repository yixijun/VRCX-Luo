import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/components/ui/popover', () => ({
    Popover: { template: '<div><slot /></div>' },
    PopoverContent: { template: '<div><slot /></div>' },
    PopoverTrigger: { template: '<div><slot /></div>' }
}));

vi.mock('@/components/ui/button', () => ({
    Button: {
        props: ['class', 'disabled'],
        template:
            '<button role="combobox" :class="$props.class" :disabled="disabled"><slot /></button>'
    }
}));

vi.mock('@/components/ui/input', () => ({
    Input: { template: '<input />' }
}));

vi.mock('lucide-vue-next', () => ({
    X: { template: '<i />' }
}));

vi.mock('@tanstack/vue-virtual', () => ({
    useVirtualizer: () =>
        require('vue').shallowRef({
            getTotalSize: () => 0,
            getVirtualItems: () => [],
            scrollToOffset: vi.fn()
        })
}));

import VirtualCombobox from '../VirtualCombobox.vue';

describe('VirtualCombobox.vue', () => {
    test('applies caller sizing classes to the visible trigger', () => {
        const wrapper = mount(VirtualCombobox, {
            props: {
                groups: [],
                class: 'w-64 shrink-0'
            }
        });

        const trigger = wrapper.get('[role="combobox"]');
        expect(trigger.classes()).toContain('w-64');
        expect(trigger.classes()).toContain('shrink-0');
    });
});
