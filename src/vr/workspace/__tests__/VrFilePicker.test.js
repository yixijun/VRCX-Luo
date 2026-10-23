import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import VrFilePicker from '../VrFilePicker.vue';
import {
    openVrFilePicker,
    finishVrFilePicker
} from '../../../services/vrWorkspaceFilePicker';

let wrapper;
afterEach(() => {
    wrapper?.unmount();
    finishVrFilePicker();
    vi.unstubAllGlobals();
});

async function open(mode, options = {}) {
    const list = vi.fn(async () =>
        JSON.stringify({
            path: 'C:/Photos',
            parent: 'C:/',
            hasMore: true,
            entries: [
                { path: 'C:/Photos/one.png', name: 'one.png', directory: false }
            ]
        })
    );
    vi.stubGlobal('AppApi', { ListVrWorkspaceDirectory: list });
    const result = openVrFilePicker(mode, options);
    wrapper = mount(VrFilePicker, { global: { stubs: { Teleport: true } } });
    await flushPromises();
    return { result, list };
}

describe('VR file picker interaction', () => {
    it('saves the entered filename in the folder actually being displayed', async () => {
        const { result } = await open('save', { filename: 'backup.json' });
        await wrapper
            .get('input[aria-label="保存的文件名"]')
            .setValue('../outside.json');
        expect(
            wrapper.get('.vr-picker-confirm').attributes('disabled')
        ).toBeDefined();
        await wrapper
            .get('input[aria-label="保存的文件名"]')
            .setValue('新备份.json');
        await wrapper.get('.vr-picker-confirm').trigger('click');
        await expect(result).resolves.toBe('C:/Photos/新备份.json');
    });
    it('loads the next page on demand', async () => {
        const { list } = await open('file');
        expect(list).toHaveBeenCalledTimes(1);
        await wrapper
            .findAll('button')
            .find((button) => button.text() === '下一页')
            .trigger('click');
        await flushPromises();
        expect(list).toHaveBeenLastCalledWith('C:/Photos', 64);
    });
    it('cancels pending selection when the workspace removes the picker', async () => {
        const { result } = await open('files');
        wrapper.unmount();
        wrapper = null;
        await expect(result).resolves.toBe('');
    });
});
