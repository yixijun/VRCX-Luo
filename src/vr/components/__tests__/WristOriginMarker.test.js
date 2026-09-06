import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import WristOriginMarker from '../WristOriginMarker.vue';

describe('WristOriginMarker.vue', () => {
    it('renders a controller origin anchor without capturing overlay input', () => {
        const wrapper = mount(WristOriginMarker);
        const marker = wrapper.get('[data-wrist-origin="controller"]');

        expect(marker.attributes('data-origin-anchor')).toBe('overlay-origin');
        expect(marker.attributes('data-position-space')).toBe(
            'tracked-device-relative'
        );
        expect(marker.attributes('aria-hidden')).toBe('true');
        expect(marker.element.tagName).toBe('SPAN');
        expect(marker.element.childElementCount).toBe(0);
    });
});
