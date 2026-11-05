import { beforeEach, describe, expect, test, vi } from 'vitest';
import { effectScope } from 'vue';
const mocks = vi.hoisted(() => {
    const { reactive } = require('vue');
    return {
        request: vi.fn(),
        user: reactive({
            currentUser: { id: 'usr_self' },
            setCachedPurchases: vi.fn(),
            setCurrentUserCredits: vi.fn()
        }),
        hub: reactive({ primaryId: 'usr_self', viewMode: 'primary' }),
        lifecycle: reactive({ isLoggedIn: true })
    };
});
vi.mock('../../services/request', () => ({ request: mocks.request }));
vi.mock('../../stores', () => ({ useUserStore: () => mocks.user }));
vi.mock('../../services/accountHub', () => ({ accountHub: mocks.hub }));
vi.mock('../../services/watchState', () => ({ watchState: mocks.lifecycle }));
import marketplace from '../marketplace';

function deferred() {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

describe('marketplace request adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.currentUser.id = 'usr_self';
        mocks.hub.primaryId = 'usr_self';
        mocks.hub.viewMode = 'primary';
        mocks.lifecycle.isLoggedIn = true;
    });
    test('preserves explicit purchase price and quantity for server validation', async () => {
        mocks.request.mockResolvedValue({ purchaseId: 'purchase' });
        const params = { listingId: 'listing', totalPrice: 100, quantity: 1 };
        await marketplace.purchaseListing(params, 'usr_self');
        expect(mocks.request).toHaveBeenCalledWith('economy/purchase/listing', {
            method: 'POST',
            params
        });
    });
    test('updates ownership only for purchases belonging to the active buyer', async () => {
        mocks.request.mockResolvedValue([{ purchaseId: 'purchase' }]);
        await marketplace.getProductPurchases({ buyerId: 'usr_other' });
        expect(mocks.user.setCachedPurchases).not.toHaveBeenCalled();
        await marketplace.getProductPurchases({ buyerId: 'usr_self' });
        expect(mocks.user.setCachedPurchases).toHaveBeenCalledWith([
            { purchaseId: 'purchase' }
        ]);
    });
    test('ignores a balance result after the active user changes', async () => {
        let resolve;
        mocks.request.mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        const pending = marketplace.getVRChatCredits();
        expect(mocks.request).toHaveBeenCalledWith(
            'user/usr_self/economy/balance',
            { method: 'GET' }
        );
        mocks.user.currentUser.id = 'usr_other';
        resolve({ balance: 100 });
        await pending;
        expect(mocks.user.setCurrentUserCredits).not.toHaveBeenCalled();
    });
    test.each(['balance', 'ownership'])(
        'ignores a late %s response after switching away and back',
        async (kind) => {
            const result = deferred();
            mocks.request.mockReturnValue(result.promise);
            const pending =
                kind === 'balance'
                    ? marketplace.getVRChatCredits()
                    : marketplace.getProductPurchases({ buyerId: 'usr_self' });
            mocks.user.currentUser.id = 'usr_other';
            mocks.user.currentUser.id = 'usr_self';
            result.resolve(
                kind === 'balance' ? { balance: 100 } : [{ purchaseId: 'old' }]
            );
            await pending;
            expect(mocks.user.setCurrentUserCredits).not.toHaveBeenCalled();
            expect(mocks.user.setCachedPurchases).not.toHaveBeenCalled();
        }
    );
    test('invalidates a response across logout and login to the same account', async () => {
        const result = deferred();
        mocks.request.mockReturnValue(result.promise);
        const pending = marketplace.getVRChatCredits();
        mocks.lifecycle.isLoggedIn = false;
        mocks.lifecycle.isLoggedIn = true;
        result.resolve({ balance: 100 });
        await pending;
        expect(mocks.user.setCurrentUserCredits).not.toHaveBeenCalled();
    });
    test('allows initial wallet loading before primary registration finishes', async () => {
        mocks.hub.primaryId = '';
        const result = deferred();
        mocks.request.mockReturnValue(result.promise);
        const pending = marketplace.getVRChatCredits();
        mocks.hub.primaryId = 'usr_self';
        result.resolve({ balance: 100 });
        await pending;
        expect(mocks.user.setCurrentUserCredits).toHaveBeenCalledWith(100);
    });
    test.each(['account:usr_other', 'merged'])(
        'blocks private primary operations in %s view',
        async (mode) => {
            mocks.hub.viewMode = mode;
            await expect(
                marketplace.purchaseListing({ listingId: 'listing' })
            ).rejects.toThrow('primary account');
            await expect(
                marketplace.getEconomyTransactions({ n: 100 })
            ).rejects.toThrow('primary account');
            await expect(
                marketplace.getProductPurchases({ buyerId: 'usr_self' })
            ).rejects.toThrow('primary account');
            await marketplace.getVRChatCredits();
            expect(mocks.request).not.toHaveBeenCalled();
        }
    );
    test('refuses a purchase confirmed for a different user', async () => {
        await expect(
            marketplace.purchaseListing({ listingId: 'listing' }, 'usr_other')
        ).rejects.toThrow('primary account');
        expect(mocks.request).not.toHaveBeenCalled();
    });
    test('still invalidates a request after its caller unmounts', async () => {
        const result = deferred();
        mocks.request.mockReturnValue(result.promise);
        const scope = effectScope();
        const pending = scope.run(() => marketplace.getVRChatCredits());
        scope.stop();
        mocks.user.currentUser.id = 'usr_other';
        mocks.user.currentUser.id = 'usr_self';
        result.resolve({ balance: 100 });
        await pending;
        expect(mocks.user.setCurrentUserCredits).not.toHaveBeenCalled();
    });
    test('an older wallet request cannot replace the most recent balance', async () => {
        const first = deferred();
        const second = deferred();
        mocks.request
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const oldRequest = marketplace.getVRChatCredits();
        const newRequest = marketplace.getVRChatCredits();
        second.resolve({ balance: 80 });
        await newRequest;
        first.resolve({ balance: 100 });
        await oldRequest;
        expect(
            mocks.user.setCurrentUserCredits
        ).toHaveBeenCalledExactlyOnceWith(80);
    });
});
