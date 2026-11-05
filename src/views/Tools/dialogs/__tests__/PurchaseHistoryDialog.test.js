import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { nextTick } from 'vue';

const mocks = vi.hoisted(() => {
    const { reactive } = require('vue');
    return {
        user: reactive({
            currentUser: { id: 'usr_a' },
            cachedPurchases: new Map(),
            getAllProductPurchases: vi.fn()
        }),
        hub: reactive({ primaryId: 'usr_a', viewMode: 'primary' }),
        lifecycle: reactive({ isLoggedIn: true }),
        locale: reactive({ current: 'keys' }),
        transactions: vi.fn()
    };
});
vi.mock('pinia', async (original) => ({
    ...(await original()),
    storeToRefs: (store) => require('vue').toRefs(store)
}));
vi.mock('vue-i18n', async (original) => {
    const { createI18n } = await original();
    const cn = (await import('../../../../localization/zh-CN.json')).default;
    const tw = (await import('../../../../localization/zh-TW.json')).default;
    const translators = {
        'zh-CN': createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: { 'zh-CN': cn }
        }).global,
        'zh-TW': createI18n({
            legacy: false,
            locale: 'zh-TW',
            messages: { 'zh-TW': tw }
        }).global
    };
    return {
        useI18n: () => ({
            t: (key) => translators[mocks.locale.current]?.t(key) ?? key
        })
    };
});
vi.mock('../../../../services/accountHub', () => ({ accountHub: mocks.hub }));
vi.mock('../../../../services/watchState', () => ({
    watchState: mocks.lifecycle
}));
vi.mock('../../../../services/appConfig', () => ({
    AppDebug: { endpointDomain: 'https://example.invalid' }
}));
vi.mock('../../../../components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' }
}));
vi.mock('../../../../stores', () => ({
    useUserStore: () => mocks.user,
    useGalleryStore: () => ({ showFullscreenImageDialog: vi.fn() })
}));
vi.mock('../../../../api', () => ({
    marketplaceRequest: { getEconomyTransactions: mocks.transactions }
}));
vi.mock('../../../../shared/utils', () => ({
    commaNumber: String,
    replaceBioSymbols: (x) => x,
    formatDateFilter: (x) => x
}));
vi.mock('../../../../coordinators/userCoordinator', () => ({
    showUserDialog: vi.fn()
}));
import PurchaseHistoryDialog from '../PurchaseHistoryDialog.vue';

function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
let wrapper;
async function openTransactions() {
    wrapper = shallowMount(PurchaseHistoryDialog, {
        props: { isPurchaseHistoryDialogVisible: true },
        global: { renderStubDefaultSlot: true }
    });
    wrapper.vm.$.setupState.activeTab = 'transactions';
    await nextTick();
    return wrapper.vm.$.setupState;
}
describe('purchase history account and request lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.currentUser = { id: 'usr_a' };
        mocks.user.cachedPurchases = new Map();
        mocks.hub.primaryId = 'usr_a';
        mocks.hub.viewMode = 'primary';
        mocks.lifecycle.isLoggedIn = true;
        mocks.locale.current = 'keys';
        mocks.user.getAllProductPurchases.mockResolvedValue();
        mocks.transactions.mockResolvedValue({ json: { transactions: [] } });
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        wrapper?.unmount();
        wrapper = null;
        vi.restoreAllMocks();
    });
    test('updates Chinese type labels with the locale while preserving filter values and unknown types', async () => {
        const types = ['permanent', 'subscription', 'temporary', 'future_type'];
        mocks.user.cachedPurchases = new Map(
            types.map((listingType, index) => [
                String(index),
                {
                    id: String(index),
                    buyerId: 'usr_a',
                    purchaseDate: '2026-11-05',
                    listingType
                }
            ])
        );
        mocks.locale.current = 'zh-CN';
        const state = await openTransactions();
        expect(state.typeOptions).toEqual([
            { value: 'all', label: '全部' },
            { value: 'permanent', label: '永久' },
            { value: 'subscription', label: '订阅' },
            { value: 'temporary', label: '限时' },
            { value: 'future_type', label: 'future_type' }
        ]);
        state.typeFilter = 'subscription';
        expect(
            state.filteredPurchases.map((purchase) => purchase.listingType)
        ).toEqual(['subscription']);
        mocks.locale.current = 'zh-TW';
        await nextTick();
        expect(
            state.typeOptions.find((option) => option.value === 'subscription')
                .label
        ).toBe('訂閱');
        expect(
            state.typeOptions.find((option) => option.value === 'temporary')
                .label
        ).toBe('限時');
        expect(
            state.filteredPurchases.map((purchase) => purchase.listingType)
        ).toEqual(['subscription']);
        expect(state.listingTypeLabel('future_type')).toBe('future_type');
    });
    test('renders purchase and transaction type badges in Chinese', async () => {
        mocks.locale.current = 'zh-CN';
        mocks.user.cachedPurchases = new Map([
            [
                'p1',
                {
                    id: 'p1',
                    buyerId: 'usr_a',
                    purchaseDate: '2026-11-05',
                    listingType: 'permanent'
                }
            ]
        ]);
        mocks.transactions.mockResolvedValue({
            json: {
                transactions: [
                    { transactionLineId: 't1', listingType: 'subscription' }
                ]
            }
        });
        await openTransactions();
        await flushPromises();
        expect(wrapper.text()).toContain('永久');
        expect(wrapper.text()).toContain('订阅');
        expect(wrapper.text()).not.toContain('permanent');
        expect(wrapper.text()).not.toContain('subscription');
    });
    test('clears loaded history and filters synchronously when the account changes', async () => {
        mocks.transactions.mockResolvedValue({
            json: { transactions: [{ transactionLineId: 'private_a' }] }
        });
        const state = await openTransactions();
        await flushPromises();
        state.typeFilter = 'permanent';
        expect(state.transactions).toHaveLength(1);
        mocks.user.currentUser = { id: 'usr_b' };
        expect(state.transactions).toEqual([]);
        expect(state.typeFilter).toBe('all');
    });
    test('ignores late transactions even after returning to the original account', async () => {
        const result = deferred();
        mocks.transactions.mockReturnValue(result.promise);
        const state = await openTransactions();
        mocks.user.currentUser = { id: 'usr_b' };
        mocks.user.currentUser = { id: 'usr_a' };
        result.resolve({
            json: { transactions: [{ transactionLineId: 'private_a' }] }
        });
        await flushPromises();
        expect(state.transactions).toEqual([]);
    });
    test('only the latest refresh controls transactions and loading', async () => {
        const first = deferred();
        const second = deferred();
        mocks.transactions
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const state = await openTransactions();
        const refresh = state.loadTransactions();
        first.resolve({
            json: { transactions: [{ transactionLineId: 'old' }] }
        });
        await flushPromises();
        expect(state.isLoading).toBe(true);
        expect(state.transactions).toEqual([]);
        second.resolve({
            json: { transactions: [{ transactionLineId: 'new' }] }
        });
        await refresh;
        expect(state.transactions[0].transactionLineId).toBe('new');
        expect(state.isLoading).toBe(false);
    });
    test.each(['account:usr_b', 'merged'])(
        'does not request primary history in %s view',
        async (mode) => {
            mocks.hub.viewMode = mode;
            const state = await openTransactions();
            await state.loadPurchases();
            expect(mocks.transactions).not.toHaveBeenCalled();
            expect(mocks.user.getAllProductPurchases).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain(
                'message.marketplace.primary_account_only'
            );
        }
    );
    test('catches failures and releases the loading state for retry', async () => {
        mocks.transactions.mockRejectedValueOnce(new Error('network failure'));
        const state = await openTransactions();
        await flushPromises();
        expect(state.isLoading).toBe(false);
        expect(state.transactions).toEqual([]);
        await state.loadTransactions();
        expect(mocks.transactions).toHaveBeenCalledTimes(2);
    });
    test('invalidates requests on close and unmount', async () => {
        const result = deferred();
        mocks.transactions.mockReturnValue(result.promise);
        const state = await openTransactions();
        await wrapper.setProps({ isPurchaseHistoryDialogVisible: false });
        wrapper.unmount();
        wrapper = null;
        result.resolve({
            json: { transactions: [{ transactionLineId: 'late' }] }
        });
        await flushPromises();
        expect(state.transactions).toEqual([]);
        expect(state.isLoading).toBe(false);
    });
});
