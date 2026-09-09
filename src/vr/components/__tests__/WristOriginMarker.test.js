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

    it('positions the marker from normalized pointer coordinates', () => {
        const wrapper = mount(WristOriginMarker, {
            props: {
                x: 0.25,
                y: 0.75,
                visible: true,
                pressed: true,
                hand: 'right'
            }
        });
        const marker = wrapper.get('[data-wrist-origin="controller"]');

        expect(marker.attributes('style')).toContain('left: 25%;');
        expect(marker.attributes('style')).toContain('top: 75%;');
        expect(marker.attributes('data-pointer-hand')).toBe('right');
        expect(marker.classes()).toContain('pressed');
    });

    it('does not animate between controller samples', () => {
        const wrapper = mount(WristOriginMarker, {
            props: { visible: true }
        });
        const marker = wrapper.get('[data-wrist-origin="controller"]');

        expect(window.getComputedStyle(marker.element).transitionDuration).toBe(
            '0s'
        );
    });
});
