<template>
    <Dialog :open="freeStoreItemDialog.visible" @update:open="(open) => !open && closeDialog()">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{{ t('dialog.free_store_item_dialog.header') }}</DialogTitle>
                <DialogDescription>{{ t('dialog.free_store_item_dialog.description') }}</DialogDescription>
            </DialogHeader>

            <div class="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
                <p v-if="!freeStoreItemDialog.listings.length" class="py-6 text-center text-sm text-muted-foreground">
                    {{ t('dialog.free_store_item_dialog.empty') }}
                </p>
                <div v-for="listing in freeStoreItemDialog.listings" :key="listing.id" class="flex items-center gap-3">
                    <img
                        :src="listing.imageUrl || getFileImageUrl(listing.imageId)"
                        loading="lazy"
                        class="size-12 shrink-0 rounded object-cover" />
                    <div class="min-w-0">
                        <div class="truncate text-sm">{{ listing.displayName }}</div>
                        <div v-if="listing.subtitle" class="truncate text-xs text-muted-foreground">
                            {{ listing.subtitle }}
                        </div>
                    </div>
                </div>
            </div>

            <p v-if="!isPrimaryAccount" class="text-sm text-muted-foreground">
                {{ t('message.marketplace.primary_account_only') }}
            </p>

            <DialogFooter>
                <label class="inline-flex items-center gap-2 text-sm sm:mr-auto">
                    <Checkbox v-model="dontShowAgain" />
                    <span>{{ t('dialog.free_store_item_dialog.dont_show_again') }}</span>
                </label>
                <Button size="sm" variant="secondary" @click="closeDialog">{{
                    t('dialog.free_store_item_dialog.close')
                }}</Button>
                <Button
                    size="sm"
                    :disabled="isClaiming || !isPrimaryAccount || !freeStoreItemDialog.listings.length"
                    @click="claimListings"
                    >{{ t('dialog.free_store_item_dialog.claim') }}</Button
                >
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Checkbox } from '@/components/ui/checkbox';
    import { toast } from 'vue-sonner';
    import { computed, onScopeDispose, ref } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import { marketplaceRequest } from '../../api';
    import { AppDebug } from '../../services/appConfig';
    import { useNotificationStore, useNotificationsSettingsStore, useUserStore } from '../../stores';
    import { captureMarketplaceAccount, isPrimaryMarketplaceAccount } from '../../services/marketplaceAccount';
    const { t } = useI18n();

    const { freeStoreItemDialog } = storeToRefs(useNotificationStore());
    const notificationsSettingsStore = useNotificationsSettingsStore();
    const userStore = useUserStore();

    const dontShowAgain = ref(false);
    const isClaiming = ref(false);
    const isPrimaryAccount = computed(() => isPrimaryMarketplaceAccount(userStore.currentUser.id));
    let disposed = false;
    onScopeDispose(() => {
        disposed = true;
    });

    function getFileImageUrl(fileId) {
        return `${AppDebug.endpointDomain}/file/${fileId}/1/`;
    }

    function closeDialog() {
        freeStoreItemDialog.value.visible = false;
        if (dontShowAgain.value && notificationsSettingsStore.freeStoreItemNotifications) {
            notificationsSettingsStore.setFreeStoreItemNotifications();
        }
        dontShowAgain.value = false;
    }

    async function claimListings() {
        if (disposed || isClaiming.value || !isPrimaryAccount.value || !freeStoreItemDialog.value.listings.length)
            return;
        const account = captureMarketplaceAccount(() => userStore.currentUser.id);
        const isCurrent = () => !disposed && account.isCurrent();
        const listings = [...freeStoreItemDialog.value.listings];
        isClaiming.value = true;
        let claimed = 0;
        try {
            for (const listing of listings) {
                if (!isCurrent()) break;
                try {
                    await marketplaceRequest.purchaseListing(
                        { listingId: listing.id, totalPrice: 0, quantity: 1 },
                        account.userId
                    );
                    claimed++;
                } catch (err) {
                    console.error('Error claiming free store item:', err);
                }
            }
            if (isCurrent()) {
                if (claimed > 0) {
                    toast.success(t('dialog.free_store_item_dialog.claim_success', { count: claimed }));
                }
                closeDialog();
                await userStore.getAllProductPurchases().catch(console.error);
            }
        } finally {
            account.dispose();
            isClaiming.value = false;
        }
    }
</script>
