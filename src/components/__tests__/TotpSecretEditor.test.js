import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    getPermission: vi.fn(),
    setPermission: vi.fn(),
    generate: vi.fn()
}));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key) => key }) }));
vi.mock('../../services/totpSecrets', () => ({
    hasTotpSecret: async () => true,
    getTotpSecret: mocks.get,
    saveTotpSecret: mocks.save,
    removeTotpSecret: mocks.remove,
    getTotpLoginFillAllowed: mocks.getPermission,
    setTotpLoginFillAllowed: mocks.setPermission
}));
vi.mock('../../services/totp', async (original) => ({
    ...(await original()),
    generateTotp: mocks.generate
}));
vi.mock('@/components/ui/button', () => ({
    Button: { template: '<button><slot /></button>' }
}));
vi.mock('@/components/ui/switch', () => ({
    Switch: {
        props: ['modelValue', 'disabled', 'id'],
        emits: ['update:modelValue'],
        template: `<input type="checkbox" role="switch" :id="id" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)" />`
    }
}));
vi.mock('@/components/ui/input-group', () => ({
    InputGroupField: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
    }
}));
import TotpSecretEditor from '../TotpSecretEditor.vue';
const identity = {
    username: 'alice',
    endpoint: 'https://api.vrchat.cloud/api/1'
};
const key = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
describe('TOTP settings editor', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.get.mockResolvedValue(null);
        mocks.getPermission.mockResolvedValue(false);
        mocks.generate.mockResolvedValue('123456');
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    test('defaults login fill to off and persists explicit opt-in for this identity', async () => {
        const wrapper = mount(TotpSecretEditor, { props: { identity } });
        await flushPromises();
        expect(wrapper.get('[role=switch]').element.checked).toBe(false);
        await wrapper.get('[role=switch]').setValue(true);
        await flushPromises();
        expect(mocks.setPermission).toHaveBeenCalledWith(identity, true);
        expect(wrapper.get('[role=switch]').element.checked).toBe(true);
        wrapper.unmount();
    });
    test('keeps login fill off if the opt-in cannot be saved', async () => {
        mocks.setPermission.mockRejectedValue(new Error('storage unavailable'));
        const wrapper = mount(TotpSecretEditor, { props: { identity } });
        await flushPromises();
        await wrapper.get('[role=switch]').setValue(true);
        await flushPromises();
        expect(wrapper.get('[role=switch]').element.checked).toBe(false);
        expect(wrapper.get('[role=alert]').text()).toBe(
            'totp.preference_failed'
        );
        wrapper.unmount();
    });
    test('saves a key and displays its current code without closing the editor', async () => {
        const wrapper = mount(TotpSecretEditor, { props: { identity } });
        await flushPromises();
        await wrapper.find('input[type=password]').setValue(key);
        mocks.get.mockResolvedValue(key);
        await wrapper.find('button').trigger('click');
        await flushPromises();
        expect(mocks.save).toHaveBeenCalledWith(identity, key);
        expect(wrapper.get('[data-testid=totp-code]').text()).toBe('123456');
        expect(wrapper.find('input[type=password]').element.value).toBe('');
        wrapper.unmount();
    });
    test('updates the code at the next 30-second boundary and stops on unmount', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(59000);
        mocks.get.mockResolvedValue(key);
        const wrapper = mount(TotpSecretEditor, { props: { identity } });
        await flushPromises();
        expect(mocks.generate).toHaveBeenCalledTimes(1);
        mocks.generate.mockResolvedValue('654321');
        await vi.advanceTimersByTimeAsync(1000);
        expect(wrapper.get('[data-testid=totp-code]').text()).toBe('654321');
        expect(mocks.generate).toHaveBeenLastCalledWith(key, { now: 60000 });
        wrapper.unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
    test('does not save invalid keys or display codes after encryption fails', async () => {
        const wrapper = mount(TotpSecretEditor, { props: { identity } });
        await flushPromises();
        await wrapper.find('input[type=password]').setValue('invalid!');
        await wrapper.find('button').trigger('click');
        expect(mocks.save).not.toHaveBeenCalled();
        await wrapper.find('input[type=password]').setValue(key);
        mocks.save.mockRejectedValue(new Error('locked'));
        await wrapper.find('button').trigger('click');
        await flushPromises();
        expect(wrapper.get('[role=alert]').text()).toBe(
            'totp.storage_unavailable'
        );
        expect(wrapper.find('[data-testid=totp-code]').exists()).toBe(false);
        wrapper.unmount();
    });
    test('clears the current code and removes the saved key', async () => {
        mocks.get.mockResolvedValue(key);
        const wrapper = mount(TotpSecretEditor, { props: { identity } });
        await flushPromises();
        await wrapper.find('button').trigger('click');
        await flushPromises();
        expect(mocks.remove).toHaveBeenCalledWith(identity);
        expect(wrapper.find('[data-testid=totp-code]').exists()).toBe(false);
        wrapper.unmount();
    });
    test('discards a late code after switching accounts', async () => {
        let complete;
        mocks.get.mockResolvedValue(key);
        mocks.generate.mockImplementationOnce(
            () =>
                new Promise((r) => {
                    complete = r;
                })
        );
        const wrapper = mount(TotpSecretEditor, { props: { identity } });
        await flushPromises();
        mocks.get.mockResolvedValue(null);
        await wrapper.setProps({ identity: { ...identity, username: 'bob' } });
        await flushPromises();
        complete('123456');
        await flushPromises();
        expect(wrapper.find('[data-testid=totp-code]').exists()).toBe(false);
        wrapper.unmount();
    });
});
