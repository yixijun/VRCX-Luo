import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import WristOriginMarker from '../WristOriginMarker.vue';

describe('WristOriginMarker.vue', () => {
    it('renders a controller origin anchor without capturing overlay input', () => {
        const wrapper = mount(WristOriginMarker);
        const marker = wrapper.get('[data-wrist-origin="controller"]');

        expect(marker.attributes('data-origin-anchor')).toBe('center');
        expect(marker.attributes('aria-hidden')).toBe('true');
        expect(marker.find('.wrist-origin-marker__ring').exists()).toBe(true);
        expect(marker.find('.wrist-origin-marker__dot').exists()).toBe(true);
        expect(marker.findAll('.wrist-origin-marker__line')).toHaveLength(2);
    });
});
