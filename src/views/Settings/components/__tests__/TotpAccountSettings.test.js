import { beforeEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
const mocks = vi.hoisted(() => ({ user: null, active: null, saved: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key) => key }) }));
vi.mock('@/stores', () => ({
    useAuthStore: () => ({
        currentTotpIdentity: mocks.active,
        getSavedCredentials: mocks.saved
    }),
    useUserStore: () => ({ currentUser: mocks.user })
}));
vi.mock('@/services/appConfig', () => ({
    AppDebug: { endpointDomainVrchat: 'https://api.vrchat.cloud/api/1' }
}));
vi.mock('@/components/TotpSecretEditor.vue', () => ({
    default: {
        props: ['identity'],
        template: '<div class="key-editor">{{ identity.username }}</div>'
    }
}));
import TotpAccountSettings from '../TotpAccountSettings.vue';
beforeEach(() => {
    vi.resetAllMocks();
    mocks.user = ref({ id: 'usr_alice', displayName: 'Alice' });
    mocks.active = ref(null);
});
test('uses the current saved account username rather than its display name', async () => {
    mocks.saved.mockResolvedValue({
        loginParams: {
            username: 'alice-login',
            endpoint: 'https://example.com/api/1'
        }
    });
    const wrapper = mount(TotpAccountSettings);
    await flushPromises();
    expect(mocks.saved).toHaveBeenCalledWith('usr_alice');
    expect(wrapper.get('.key-editor').text()).toBe('alice-login');
    wrapper.unmount();
});
test('allows a freshly authenticated account without saved credentials to configure its key', async () => {
    mocks.saved.mockResolvedValue(null);
    mocks.active.value = {
        username: 'alice-unsaved',
        endpoint: 'https://api.vrchat.cloud/api/1'
    };
    const wrapper = mount(TotpAccountSettings);
    await flushPromises();
    expect(wrapper.get('.key-editor').text()).toBe('alice-unsaved');
    wrapper.unmount();
});
test('uses the active login identity instead of stale saved credentials', async () => {
    mocks.saved.mockResolvedValue({ loginParams: { username: 'old-login' } });
    mocks.active.value = {
        username: 'current-login',
        endpoint: 'https://example.com/api/1'
    };
    const wrapper = mount(TotpAccountSettings);
    await flushPromises();
    expect(wrapper.get('.key-editor').text()).toBe('current-login');
    wrapper.unmount();
});
test('discards late saved-account details after switching accounts', async () => {
    let complete;
    mocks.saved
        .mockImplementationOnce(
            () =>
                new Promise((r) => {
                    complete = r;
                })
        )
        .mockResolvedValueOnce({ loginParams: { username: 'bob' } });
    const wrapper = mount(TotpAccountSettings);
    await flushPromises();
    mocks.user.value = { id: 'usr_bob', displayName: 'Bob' };
    await flushPromises();
    complete({ loginParams: { username: 'alice' } });
    await flushPromises();
    expect(wrapper.get('.key-editor').text()).toBe('bob');
    wrapper.unmount();
});
