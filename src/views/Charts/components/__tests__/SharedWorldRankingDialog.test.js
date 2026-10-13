import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';

const virtualizerHarness = vi.hoisted(() => ({ optionsRef: null }));

vi.mock('@tanstack/vue-virtual', () => ({
    useVirtualizer: (optionsRef) => {
        virtualizerHarness.optionsRef = optionsRef;
        return {
            value: {
                getVirtualItems: () => {
                    const options = optionsRef.value;
                    const visibleCount = Math.min(options.count, 8);
                    return Array.from({ length: visibleCount }, (_, index) => ({
                        index,
                        key: options.getItemKey?.(index) ?? index,
                        start: index * 52
                    }));
                },
                getTotalSize: () => optionsRef.value.count * 52,
                measure: vi.fn(),
                measureElement: vi.fn()
            }
        };
    }
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key, params) => `${key}:${params?.count ?? ''}` })
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' }
}));

vi.mock('@/components/Location.vue', () => ({
    default: {
        props: ['location'],
        template: '<span data-testid="ranking-location">{{ location }}</span>'
    }
}));

vi.mock('lucide-vue-next', () => ({
    MapPin: { template: '<i />' }
}));

import SharedWorldRankingDialog from '../SharedWorldRankingDialog.vue';

function makeItems(count) {
    return Array.from({ length: count }, (_, index) => ({
        worldId: `wrld_${index}`,
        latestLocation: `wrld_${index}:instance`,
        visitCount: count - index,
        totalCoexistenceTime: 0
    }));
}

describe('SharedWorldRankingDialog.vue', () => {
    test('only mounts the visible ranking rows for a large result set', () => {
        const wrapper = mount(SharedWorldRankingDialog, {
            props: {
                items: makeItems(502),
                open: true
            }
        });

        expect(
            wrapper.findAll('[data-testid="ranking-location"]')
        ).toHaveLength(8);
        expect(virtualizerHarness.optionsRef.value.count).toBe(30);
        expect(wrapper.text()).toContain('wrld_0');
        expect(wrapper.text()).not.toContain('wrld_501');
    });

    test('loads another page when scrolling near the end', async () => {
        const wrapper = mount(SharedWorldRankingDialog, {
            props: {
                items: makeItems(502),
                open: true
            }
        });
        const scrollViewport = wrapper.get(
            '[data-testid="shared-world-ranking-scroll"]'
        );

        Object.defineProperties(scrollViewport.element, {
            clientHeight: { configurable: true, value: 500 },
            scrollHeight: { configurable: true, value: 1560 },
            scrollTop: { configurable: true, value: 1100, writable: true }
        });

        await scrollViewport.trigger('scroll');

        expect(virtualizerHarness.optionsRef.value.count).toBe(60);
    });
});
