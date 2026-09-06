import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import WristPageTabs from '../WristPageTabs.vue';

describe('WristPageTabs.vue', () => {
    it('renders compact actions for each wrist page', () => {
        const wrapper = mount(WristPageTabs, {
            props: { modelValue: 'feed' }
        });
        const tabs = wrapper.findAll('[data-vr-action^="wrist-page-"]');

        expect(tabs).toHaveLength(3);
        expect(tabs[0].attributes('aria-current')).toBe('page');
        expect(tabs[1].attributes('aria-current')).toBeUndefined();
        expect(tabs[0].attributes('type')).toBe('button');
    });

    it('emits the selected page without requiring text hit targets', async () => {
        const wrapper = mount(WristPageTabs, {
            props: { modelValue: 'feed' }
        });

        await wrapper
            .get('[data-vr-action="wrist-page-devices"]')
            .trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([['devices']]);
    });
});
