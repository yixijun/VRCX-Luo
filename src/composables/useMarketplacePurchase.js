import { computed, onScopeDispose, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { useModalStore, useUserStore } from '../stores';
import { marketplaceRequest } from '../api';
import { commaNumber } from '../shared/utils';
import {
    captureMarketplaceAccount,
    isPrimaryMarketplaceAccount
} from '../services/marketplaceAccount';

/** Shared confirmation and account checks for paid store and avatar listings. */
export function useMarketplacePurchase() {
    const { t } = useI18n();
    const userStore = useUserStore();
    const modalStore = useModalStore();
    const purchasingListingId = ref('');
    const isPrimaryAccount = computed(() =>
        isPrimaryMarketplaceAccount(userStore.currentUser.id)
    );
    let disposed = false;
    onScopeDispose(() => {
        disposed = true;
    });

    function canPurchase(price) {
        return (
            isPrimaryAccount.value &&
            !purchasingListingId.value &&
            userStore.currentUserCredits !== null &&
            userStore.currentUserCredits >= price
        );
    }

    async function purchaseListing({ listingId, displayName, price }) {
        if (disposed || !canPurchase(price)) return;
        const account = captureMarketplaceAccount(
            () => userStore.currentUser.id
        );
        const isCurrent = () => !disposed && account.isCurrent();
        purchasingListingId.value = listingId;
        let submitted = false;
        try {
            const { ok } = await modalStore.confirm({
                title: t('confirm.title'),
                description: t('dialog.avatar.info.purchase_confirm', {
                    name: displayName,
                    price: commaNumber(price)
                })
            });
            if (
                !ok ||
                !isCurrent() ||
                userStore.currentUserCredits === null ||
                userStore.currentUserCredits < price
            )
                return;
            submitted = true;
            await marketplaceRequest.purchaseListing(
                { listingId, totalPrice: price, quantity: 1 },
                account.userId
            );
            if (isCurrent())
                toast.success(t('dialog.avatar.info.purchase_success'));
        } catch (error) {
            console.error('Failed to purchase listing', error);
        } finally {
            try {
                if (submitted && isCurrent()) {
                    await Promise.allSettled([
                        marketplaceRequest.getVRChatCredits(),
                        userStore.getAllProductPurchases()
                    ]);
                }
            } finally {
                account.dispose();
                purchasingListingId.value = '';
            }
        }
    }

    return {
        purchasingListingId,
        isPrimaryAccount,
        canPurchase,
        purchaseListing
    };
}
