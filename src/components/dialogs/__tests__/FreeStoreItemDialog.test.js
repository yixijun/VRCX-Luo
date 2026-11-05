import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';

const mocks = vi.hoisted(() => {
    const { reactive } = require('vue');
    return {
        user: reactive({
            currentUser: { id: 'usr_a' },
            getAllProductPurchases: vi.fn()
        }),
        notifications: reactive({
            freeStoreItemDialog: { visible: true, listings: [] }
        }),
        hub: reactive({ primaryId: 'usr_a', viewMode: 'primary' }),
        lifecycle: reactive({ isLoggedIn: true }),
        purchase: vi.fn(),
        success: vi.fn()
    };
});
vi.mock('pinia', async (original) => ({
    ...(await original()),
    storeToRefs: (store) => require('vue').toRefs(store)
}));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key) => key }) }));
vi.mock('vue-sonner', () => ({ toast: { success: mocks.success } }));
vi.mock('../../../services/accountHub', () => ({ accountHub: mocks.hub }));
vi.mock('../../../services/watchState', () => ({
    watchState: mocks.lifecycle
}));
vi.mock('../../../services/appConfig', () => ({
    AppDebug: { endpointDomain: 'https://example.invalid' }
}));
vi.mock('../../../stores', () => ({
    useUserStore: () => mocks.user,
    useNotificationStore: () => mocks.notifications,
    useNotificationsSettingsStore: () => ({})
}));
vi.mock('../../../api', () => ({
    marketplaceRequest: { purchaseListing: mocks.purchase }
}));
import FreeStoreItemDialog from '../FreeStoreItemDialog.vue';

function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
let wrapper;
function mountDialog() {
    wrapper = shallowMount(FreeStoreItemDialog, {
        global: { renderStubDefaultSlot: true }
    });
    return wrapper.vm.$.setupState;
}
describe('free store claims account lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.currentUser = { id: 'usr_a' };
        mocks.hub.primaryId = 'usr_a';
        mocks.hub.viewMode = 'primary';
        mocks.lifecycle.isLoggedIn = true;
        mocks.notifications.freeStoreItemDialog = {
            visible: true,
            listings: [{ id: 'listing_a' }, { id: 'listing_b' }]
        };
        mocks.purchase.mockResolvedValue({});
        mocks.user.getAllProductPurchases.mockResolvedValue();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
        vi.restoreAllMocks();
    });
    test.each(['account:usr_b', 'merged'])(
        'blocks claims and explains the restriction in %s view',
        async (mode) => {
            mocks.hub.viewMode = mode;
            const state = mountDialog();
            await state.claimListings();
            expect(mocks.purchase).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain(
                'message.marketplace.primary_account_only'
            );
        }
    );
    test('claims each listing for the captured primary account and refreshes ownership', async () => {
        const state = mountDialog();
        await state.claimListings();
        expect(mocks.purchase).toHaveBeenNthCalledWith(
            1,
            { listingId: 'listing_a', totalPrice: 0, quantity: 1 },
            'usr_a'
        );
        expect(mocks.purchase).toHaveBeenNthCalledWith(
            2,
            { listingId: 'listing_b', totalPrice: 0, quantity: 1 },
            'usr_a'
        );
        expect(mocks.success).toHaveBeenCalledTimes(1);
        expect(mocks.user.getAllProductPurchases).toHaveBeenCalledTimes(1);
        expect(mocks.notifications.freeStoreItemDialog.visible).toBe(false);
        expect(state.isClaiming).toBe(false);
    });
    test('stops the batch after switching away and back without affecting the next account view', async () => {
        const first = deferred();
        mocks.purchase.mockReturnValueOnce(first.promise);
        const state = mountDialog();
        const pending = state.claimListings();
        mocks.hub.viewMode = 'merged';
        mocks.hub.viewMode = 'primary';
        first.resolve({});
        await pending;
        expect(mocks.purchase).toHaveBeenCalledTimes(1);
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.user.getAllProductPurchases).not.toHaveBeenCalled();
        expect(mocks.notifications.freeStoreItemDialog.visible).toBe(true);
        expect(state.isClaiming).toBe(false);
    });
    test('prevents duplicate claims while a batch is in flight', async () => {
        const first = deferred();
        mocks.purchase.mockReturnValueOnce(first.promise);
        const state = mountDialog();
        const pending = state.claimListings();
        await state.claimListings();
        expect(mocks.purchase).toHaveBeenCalledTimes(1);
        first.resolve({});
        await pending;
        expect(mocks.purchase).toHaveBeenCalledTimes(2);
    });
    test('stops an unmounted batch and leaves no stale completion side effects', async () => {
        const first = deferred();
        mocks.purchase.mockReturnValueOnce(first.promise);
        const state = mountDialog();
        const pending = state.claimListings();
        wrapper.unmount();
        wrapper = null;
        first.resolve({});
        await pending;
        expect(mocks.purchase).toHaveBeenCalledTimes(1);
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.user.getAllProductPurchases).not.toHaveBeenCalled();
    });
    test('handles a failed claim and a failed ownership refresh without leaving the lock set', async () => {
        mocks.purchase.mockRejectedValueOnce(new Error('claim failed'));
        mocks.user.getAllProductPurchases.mockRejectedValueOnce(
            new Error('refresh failed')
        );
        const state = mountDialog();
        await state.claimListings();
        await flushPromises();
        expect(mocks.purchase).toHaveBeenCalledTimes(2);
        expect(mocks.success).toHaveBeenCalledTimes(1);
        expect(state.isClaiming).toBe(false);
    });
});
