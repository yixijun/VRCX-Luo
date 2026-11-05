import { request } from '../services/request';
import { useUserStore } from '../stores';
import { captureMarketplaceAccount } from '../services/marketplaceAccount';

function requirePrimaryAccount(account, expectedUserId = account.userId) {
    if (!account.isCurrent() || account.userId !== expectedUserId) {
        throw new Error(
            'Marketplace operations require the active primary account'
        );
    }
}
let balanceRequestId = 0;
const marketplaceReq = {
    searchAvatars(params) {
        const query = Object.fromEntries(
            Object.entries(params).filter(([, value]) => value !== undefined)
        );
        return request('avatars', {
            method: 'GET',
            params: query
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },
    getStoreShelves(params) {
        return request('economy/store/shelves', {
            method: 'GET',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },
    async getProductPurchases(params) {
        const userStore = useUserStore();
        const account = captureMarketplaceAccount(
            () => userStore.currentUser.id
        );
        try {
            requirePrimaryAccount(account);
            const json = await request('economy/purchases', {
                method: 'GET',
                params
            });
            if (account.isCurrent() && account.userId === params.buyerId)
                userStore.setCachedPurchases(json);
            return { json, params };
        } finally {
            account.dispose();
        }
    },
    getProductListing(params) {
        return request(`listing/${params.listingId}`, {
            method: 'GET',
            params: { hydrate: true }
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },
    async purchaseListing(
        params,
        expectedUserId = useUserStore().currentUser.id
    ) {
        const account = captureMarketplaceAccount(
            () => useUserStore().currentUser.id
        );
        try {
            requirePrimaryAccount(account, expectedUserId);
            const json = await request('economy/purchase/listing', {
                method: 'POST',
                params
            });
            return { json, params };
        } finally {
            account.dispose();
        }
    },
    getEconomySubscriptions(params) {
        return request('economy/subscriptions', {
            method: 'GET',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },
    async getEconomyTransactions(params) {
        const account = captureMarketplaceAccount(
            () => useUserStore().currentUser.id
        );
        try {
            requirePrimaryAccount(account);
            const json = await request(
                `user/${account.userId}/economy/transactions`,
                {
                    method: 'GET',
                    params
                }
            );
            return { json, params };
        } finally {
            account.dispose();
        }
    },
    async getVRChatCredits() {
        const id = ++balanceRequestId;
        const userStore = useUserStore();
        const account = captureMarketplaceAccount(
            () => userStore.currentUser.id
        );
        try {
            if (!account.isCurrent()) return { json: { balance: null } };
            const json = await request(
                `user/${account.userId}/economy/balance`,
                {
                    method: 'GET'
                }
            );
            if (id === balanceRequestId && account.isCurrent())
                userStore.setCurrentUserCredits(json.balance ?? null);
            return { json };
        } finally {
            account.dispose();
        }
    }
};
export default marketplaceReq;
