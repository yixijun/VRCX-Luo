import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSearchStore, useUserStore } from '../../../stores';
import { replaceBioSymbols } from '../../../shared/utils';
import { marketplaceRequest } from '../../../api';
import { VRCHAT_STORE_IDS } from '../../../shared/constants';
import { useMarketplacePurchase } from '../../../composables/useMarketplacePurchase';
/**
 * VRChat store shelves composable for Search view.
 * Fetches the official store shelves, tracks owned listings and handles purchases.
 */
export function useSearchStoreShelves() {
    const { searchText } = storeToRefs(useSearchStore());
    const userStore = useUserStore();
    const { isLocalUserVrcPlusSupporter, ownedListingIds, ownedProductIds } =
        storeToRefs(userStore);
    const {
        purchasingListingId,
        isPrimaryAccount,
        canPurchase,
        purchaseListing: purchase
    } = useMarketplacePurchase();

    const storeShelves = ref([]);
    const isStoreShelvesLoading = ref(false);

    const filteredStoreShelves = computed(() => {
        const query = searchText.value.trim().toLowerCase();
        if (!query) {
            return storeShelves.value;
        }
        return storeShelves.value
            .map((shelf) => ({
                ...shelf,
                listings: shelf.listings.filter(
                    (listing) =>
                        listing.displayName.toLowerCase().includes(query) ||
                        listing.subtitle?.toLowerCase().includes(query)
                )
            }))
            .filter((shelf) => shelf.listings.length > 0);
    });

    function isListingOwned(listing) {
        if (ownedListingIds.value.has(listing.id)) {
            return true;
        }
        const productIds = listing.productIds ?? [];
        return (
            productIds.length > 0 &&
            productIds.every((id) => ownedProductIds.value.has(id))
        );
    }

    function getListingPrice(listing) {
        if (
            isLocalUserVrcPlusSupporter.value &&
            listing.vrcPlusDiscountPrice != null
        ) {
            return listing.vrcPlusDiscountPrice;
        }
        return listing.priceTokens;
    }

    function canPurchaseListing(listing) {
        return canPurchase(getListingPrice(listing));
    }

    async function refreshCredits() {
        try {
            await marketplaceRequest.getVRChatCredits();
        } catch (err) {
            console.error(err);
        }
    }

    async function getStoreShelves() {
        isStoreShelvesLoading.value = true;
        try {
            const [results] = await Promise.all([
                Promise.all(
                    VRCHAT_STORE_IDS.map((storeId) =>
                        marketplaceRequest.getStoreShelves({
                            storeId,
                            fetch: 'public',
                            hydrateListings: true
                        })
                    )
                ),
                isPrimaryAccount.value
                    ? userStore.getAllProductPurchases().catch(console.error)
                    : undefined,
                refreshCredits()
            ]);
            storeShelves.value = results
                .flatMap((args) => args.json ?? [])
                .map((shelf) => ({
                    ...shelf,
                    listings: (shelf.listings ?? [])
                        .filter((listing) => listing.active)
                        .map((listing) => ({
                            ...listing,
                            displayName: replaceBioSymbols(listing.displayName),
                            description: replaceBioSymbols(listing.description)
                        }))
                }));
        } catch (err) {
            console.error(err);
        } finally {
            isStoreShelvesLoading.value = false;
        }
    }

    function purchaseListing(listing) {
        return purchase({
            listingId: listing.id,
            displayName: listing.displayName,
            price: getListingPrice(listing)
        });
    }

    return {
        filteredStoreShelves,
        isStoreShelvesLoading,
        purchasingListingId,
        isPrimaryAccount,
        getStoreShelves,
        isListingOwned,
        getListingPrice,
        canPurchaseListing,
        purchaseListing
    };
}
