import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { i18n } from '../../../../plugins/i18n';
import WorldTagFilter from '../WorldTagFilter.vue';

let wrapper;
afterEach(() => wrapper?.unmount());
function open() {
    const value = ref('');
    const search = vi.fn();
    wrapper = mount(
        defineComponent({
            setup: () => () =>
                h(WorldTagFilter, {
                    modelValue: value.value,
                    'onUpdate:modelValue': (next) => (value.value = next),
                    onSearch: () => search(value.value)
                })
        }),
        { global: { plugins: [i18n] } }
    );
    return { value, search };
}
describe('world tag filter controls', () => {
    it('submits custom tags on Enter', async () => {
        const { search } = open();
        await wrapper.get('input').setValue('game, chill');
        await wrapper.get('input').trigger('keyup.enter');
        expect(search).toHaveBeenCalledExactlyOnceWith('game, chill');
    });
    it('applies a quick tag and clears input using the existing clear control', async () => {
        const { value, search } = open();
        await wrapper
            .findAll('button')
            .find((button) => button.text() === 'Games')
            .trigger('click');
        expect(search).toHaveBeenCalledExactlyOnceWith('game');
        expect(value.value).toBe('game');
        const clear = wrapper
            .findAll('button')
            .find((button) => button.text() === 'Clear');
        expect(clear).toBeDefined();
        await clear.trigger('click');
        expect(value.value).toBe('');
    });
});
