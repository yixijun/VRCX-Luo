import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { i18n } from '../../../plugins/i18n';

const mocks = vi.hoisted(() => ({
    clearCookies: vi.fn(),
    getConfig: vi.fn(),
    getDeviceCode: vi.fn(),
    getDeviceStatus: vi.fn(),
    toDataURL: vi.fn(),
    getCurrentUser: vi.fn(),
    queueSaveCredentials: vi.fn(),
    error: vi.fn()
}));
vi.mock('qrcode', () => ({ default: { toDataURL: mocks.toDataURL } }));
vi.mock('../../../api', () => ({ authRequest: mocks }));
vi.mock('../../../services/webapi', () => ({
    default: { clearCookies: mocks.clearCookies }
}));
vi.mock('../../../coordinators/userCoordinator', () => ({
    getCurrentUser: mocks.getCurrentUser
}));
vi.mock('../../../stores', () => ({
    useAuthStore: () => ({ queueSaveCredentials: mocks.queueSaveCredentials })
}));
vi.mock('vue-sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('worker-timers', () => ({ setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay) }));
import QrLogin from '../components/QrLogin.vue';

describe('QR login lifecycle', () => {
    let wrapper;
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetAllMocks();
        mocks.getDeviceCode.mockResolvedValue({
            json: {
                deviceCode: 'device',
                verificationUrlComplete:
                    'https://vrchat.com/login?code=example',
                interval: 5
            }
        });
        mocks.toDataURL.mockResolvedValue('data:image/png;base64,test');
        mocks.getDeviceStatus.mockResolvedValue({ json: {} });
        wrapper = mount(QrLogin, { global: { plugins: [i18n] } });
    });
    afterEach(() => {
        wrapper?.unmount();
        vi.useRealTimers();
    });

    async function start() {
        await wrapper.find('button').trigger('click');
        await flushPromises();
    }
    test('completes a successful device authorization once', async () => {
        mocks.getDeviceStatus.mockResolvedValue({
            json: { user: { id: 'usr_1' } }
        });
        await start();
        expect(wrapper.find('img').exists()).toBe(true);
        await vi.advanceTimersByTimeAsync(5000);
        expect(mocks.getDeviceStatus).toHaveBeenCalledWith({
            deviceCode: 'device'
        });
        expect(mocks.queueSaveCredentials).toHaveBeenCalledTimes(1);
        expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(wrapper.find('img').exists()).toBe(false);
    });
    test('ignores an in-flight authorization result after cancellation', async () => {
        let resolve;
        mocks.getDeviceStatus.mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        await start();
        await vi.advanceTimersByTimeAsync(5000);
        await wrapper.find('button').trigger('click');
        resolve({ json: { user: { id: 'usr_1' } } });
        await flushPromises();
        expect(mocks.getCurrentUser).not.toHaveBeenCalled();
        expect(wrapper.find('img').exists()).toBe(false);
    });
    test('does not publish a QR image or poll after unmount during preparation', async () => {
        let resolve;
        mocks.toDataURL.mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        await start();
        wrapper.unmount();
        resolve('data:image/png;base64,test');
        await flushPromises();
        await vi.advanceTimersByTimeAsync(10000);
        expect(mocks.getDeviceStatus).not.toHaveBeenCalled();
    });
    test('honors slow_down before retrying', async () => {
        mocks.getDeviceStatus.mockRejectedValueOnce(new Error('slow_down'));
        await start();
        await vi.advanceTimersByTimeAsync(5000);
        expect(mocks.getDeviceStatus).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(9999);
        expect(mocks.getDeviceStatus).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(mocks.getDeviceStatus).toHaveBeenCalledTimes(2);
    });
});
