import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { effectScope } from 'vue';
import { flushPromises } from '@vue/test-utils';

const mocks = vi.hoisted(() => {
    const { reactive } = require('vue');
    const user = reactive({
        currentUser: { id: 'usr_a' },
        currentUserCredits: null,
        isLocalUserVrcPlusSupporter: false,
        ownedListingIds: new Set(),
        ownedProductIds: new Set(),
        getAllProductPurchases: vi.fn(),
        setCachedPurchases: vi.fn()
    });
    user.setCurrentUserCredits = vi.fn((value) => {
        user.currentUserCredits = value;
    });
    return {
        user,
        hub: reactive({ primaryId: 'usr_a', viewMode: 'primary' }),
        lifecycle: reactive({ isLoggedIn: true }),
        search: reactive({ searchText: '' }),
        request: vi.fn(),
        confirm: vi.fn(),
        success: vi.fn()
    };
});
vi.mock('pinia', async (original) => ({
    ...(await original()),
    storeToRefs: (store) => require('vue').toRefs(store)
}));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key) => key }) }));
vi.mock('vue-sonner', () => ({ toast: { success: mocks.success } }));
vi.mock('../../../../services/request', () => ({ request: mocks.request }));
vi.mock('../../../../services/accountHub', () => ({ accountHub: mocks.hub }));
vi.mock('../../../../services/watchState', () => ({
    watchState: mocks.lifecycle
}));
vi.mock('../../../../stores', () => ({
    useUserStore: () => mocks.user,
    useSearchStore: () => mocks.search,
    useModalStore: () => ({ confirm: mocks.confirm })
}));
vi.mock('../../../../api', async () => ({
    marketplaceRequest: (
        await vi.importActual('../../../../api/marketplace.js')
    ).default
}));
vi.mock('../../../../shared/utils', () => ({
    commaNumber: String,
    replaceBioSymbols: (x) => x
}));
vi.mock('../../../../shared/constants', () => ({
    VRCHAT_STORE_IDS: ['store_a']
}));

import { useSearchStoreShelves } from '../useSearchStoreShelves';

const listing = {
    id: 'listing_a',
    displayName: 'Item',
    priceTokens: 20,
    active: true
};
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}
let scope;
function createStore() {
    scope = effectScope();
    return scope.run(() => useSearchStoreShelves());
}
describe('store shelves and purchase account isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.currentUser = { id: 'usr_a' };
        mocks.user.currentUserCredits = null;
        mocks.hub.primaryId = 'usr_a';
        mocks.hub.viewMode = 'primary';
        mocks.lifecycle.isLoggedIn = true;
        mocks.user.getAllProductPurchases.mockResolvedValue();
        mocks.confirm.mockResolvedValue({ ok: true });
        mocks.request.mockImplementation((endpoint) => {
            if (endpoint.endsWith('/economy/balance'))
                return Promise.resolve({ balance: 100 });
            if (endpoint === 'economy/store/shelves')
                return Promise.resolve([{ listings: [listing] }]);
            return Promise.resolve({});
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        scope?.stop();
        vi.restoreAllMocks();
    });

    test('first visit loads balance and enables an affordable purchase', async () => {
        const store = createStore();
        await store.getStoreShelves();
        expect(store.canPurchaseListing(listing)).toBe(true);
        expect(mocks.user.currentUserCredits).toBe(100);
    });
    test('failed balance loading keeps shelves visible and can be retried', async () => {
        // Fail just the wallet, independently of the public shelf requests.
        mocks.request.mockImplementation((endpoint) =>
            endpoint.endsWith('/economy/balance')
                ? Promise.reject(new Error('balance unavailable'))
                : Promise.resolve([{ listings: [listing] }])
        );
        const store = createStore();
        await store.getStoreShelves();
        expect(store.filteredStoreShelves.value).toHaveLength(1);
        expect(store.isStoreShelvesLoading.value).toBe(false);
        expect(store.canPurchaseListing(listing)).toBe(false);
        mocks.request.mockImplementation((endpoint) =>
            endpoint.endsWith('/economy/balance')
                ? Promise.resolve({ balance: 100 })
                : Promise.resolve([{ listings: [listing] }])
        );
        await store.getStoreShelves();
        expect(store.canPurchaseListing(listing)).toBe(true);
    });
    test.each(['account:usr_b', 'merged'])(
        'never offers purchases in %s view',
        async (mode) => {
            mocks.hub.viewMode = mode;
            mocks.user.currentUserCredits = 800;
            const store = createStore();
            await store.purchaseListing(listing);
            expect(store.canPurchaseListing(listing)).toBe(false);
            expect(mocks.confirm).not.toHaveBeenCalled();
            expect(mocks.request).not.toHaveBeenCalled();
        }
    );
    test.each([false, true])(
        'cancels confirmation after an account change (return=%s)',
        async (returnToOriginal) => {
            const confirmation = deferred();
            mocks.confirm.mockReturnValue(confirmation.promise);
            mocks.user.currentUserCredits = 100;
            const store = createStore();
            const pending = store.purchaseListing(listing);
            mocks.user.currentUser = { id: 'usr_b' };
            if (returnToOriginal) mocks.user.currentUser = { id: 'usr_a' };
            confirmation.resolve({ ok: true });
            await pending;
            expect(mocks.request).not.toHaveBeenCalled();
            expect(store.purchasingListingId.value).toBe('');
        }
    );
    test('ignores a late balance response after switching accounts', async () => {
        const balance = deferred();
        mocks.user.currentUserCredits = 100;
        mocks.request.mockImplementation((endpoint) =>
            endpoint.endsWith('/economy/balance')
                ? balance.promise
                : Promise.resolve({})
        );
        const store = createStore();
        const pending = store.purchaseListing(listing);
        await flushPromises();
        expect(mocks.request).toHaveBeenCalledWith(
            'user/usr_a/economy/balance',
            { method: 'GET' }
        );
        mocks.user.currentUser = { id: 'usr_b' };
        mocks.user.currentUserCredits = 800;
        balance.resolve({ balance: 40 });
        await pending;
        expect(mocks.user.currentUserCredits).toBe(800);
    });
    test('does not refresh or announce an old purchase in the next account', async () => {
        const purchase = deferred();
        mocks.request.mockReturnValue(purchase.promise);
        mocks.user.currentUserCredits = 100;
        const store = createStore();
        const pending = store.purchaseListing(listing);
        await flushPromises();
        mocks.user.currentUser = { id: 'usr_b' };
        purchase.resolve({});
        await pending;
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.user.getAllProductPurchases).not.toHaveBeenCalled();
        expect(mocks.request).toHaveBeenCalledTimes(1);
    });
    test('prevents duplicate confirmation and submission', async () => {
        const confirmation = deferred();
        mocks.confirm.mockReturnValue(confirmation.promise);
        mocks.user.currentUserCredits = 100;
        const store = createStore();
        const first = store.purchaseListing(listing);
        await store.purchaseListing(listing);
        expect(mocks.confirm).toHaveBeenCalledTimes(1);
        confirmation.resolve({ ok: true });
        await first;
        expect(
            mocks.request.mock.calls.filter(
                ([path]) => path === 'economy/purchase/listing'
            )
        ).toHaveLength(1);
    });
    test('cancels without submitting or refreshing when confirmation is declined', async () => {
        mocks.confirm.mockResolvedValue({ ok: false });
        mocks.user.currentUserCredits = 100;
        const store = createStore();
        await store.purchaseListing(listing);
        expect(mocks.request).not.toHaveBeenCalled();
        expect(mocks.user.getAllProductPurchases).not.toHaveBeenCalled();
        expect(store.purchasingListingId.value).toBe('');
    });
    test('does not submit a confirmation after its component scope is disposed', async () => {
        const confirmation = deferred();
        mocks.confirm.mockReturnValue(confirmation.promise);
        mocks.user.currentUserCredits = 100;
        const store = createStore();
        const pending = store.purchaseListing(listing);
        scope.stop();
        confirmation.resolve({ ok: true });
        await pending;
        expect(mocks.request).not.toHaveBeenCalled();
        expect(store.purchasingListingId.value).toBe('');
    });
    test('rechecks affordability after confirmation', async () => {
        const confirmation = deferred();
        mocks.confirm.mockReturnValue(confirmation.promise);
        mocks.user.currentUserCredits = 100;
        const store = createStore();
        const pending = store.purchaseListing(listing);
        mocks.user.currentUserCredits = 10;
        confirmation.resolve({ ok: true });
        await pending;
        expect(mocks.request).not.toHaveBeenCalled();
    });
    test('releases the purchase lock after a failure and permits a retry', async () => {
        mocks.user.currentUserCredits = 100;
        mocks.request.mockRejectedValueOnce(new Error('purchase failed'));
        const store = createStore();
        await store.purchaseListing(listing);
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.user.getAllProductPurchases).toHaveBeenCalledTimes(1);
        expect(store.purchasingListingId.value).toBe('');
        await store.purchaseListing(listing);
        expect(mocks.success).toHaveBeenCalledTimes(1);
        expect(
            mocks.request.mock.calls.filter(
                ([path]) => path === 'economy/purchase/listing'
            )
        ).toHaveLength(2);
    });
});
