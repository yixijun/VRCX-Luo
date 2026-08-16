<template>
    <div class="relative h-full">
        <div class="h-full w-full overflow-auto overflow-x-hidden">
            <div class="px-1.5 py-2.5">
                <div class="mb-2 flex items-start gap-1 px-1">
                    <span class="min-w-0 flex-1 pt-1.5 text-xs leading-4 text-muted-foreground">
                        {{ t('side_panel.inactive_friends.description', { days: inactiveFriendDays }) }}
                    </span>
                    <TooltipWrapper
                        v-if="!isBatchMode"
                        :content="t('side_panel.inactive_friends.batch_manage')"
                        side="left">
                        <Button
                            data-testid="inactive-batch-manage"
                            size="icon-sm"
                            variant="ghost"
                            :aria-label="t('side_panel.inactive_friends.batch_manage')"
                            @click="enterBatchMode">
                            <ListChecks class="size-4" />
                        </Button>
                    </TooltipWrapper>
                </div>

                <div v-if="isBatchMode" class="mb-2 flex h-9 items-center gap-1 rounded-md bg-muted/50 px-1.5">
                    <TooltipWrapper :content="selectAllLabel" side="top">
                        <Button
                            data-testid="inactive-select-all"
                            size="icon-sm"
                            variant="ghost"
                            :disabled="isDeleting"
                            :aria-label="selectAllLabel"
                            @click="toggleSelectAll">
                            <CheckCheck class="size-4" />
                        </Button>
                    </TooltipWrapper>
                    <span class="min-w-0 flex-1 truncate px-1 text-xs tabular-nums text-muted-foreground">
                        {{
                            t('side_panel.inactive_friends.selected_count', {
                                selected: selectedFriendIds.size,
                                total: inactiveFriends.length
                            })
                        }}
                    </span>
                    <TooltipWrapper :content="t('side_panel.inactive_friends.delete_selected')" side="top">
                        <Button
                            data-testid="inactive-delete-selected"
                            size="icon-sm"
                            variant="destructive"
                            :disabled="isDeleting || selectedFriendIds.size === 0"
                            :aria-label="t('side_panel.inactive_friends.delete_selected')"
                            @click="confirmBulkDelete">
                            <LoaderCircle v-if="isDeleting" class="size-4 animate-spin" />
                            <Trash2 v-else class="size-4" />
                        </Button>
                    </TooltipWrapper>
                    <TooltipWrapper :content="t('side_panel.inactive_friends.cancel')" side="top">
                        <Button
                            data-testid="inactive-cancel-batch"
                            size="icon-sm"
                            variant="ghost"
                            :disabled="isDeleting"
                            :aria-label="t('side_panel.inactive_friends.cancel')"
                            @click="exitBatchMode">
                            <X class="size-4" />
                        </Button>
                    </TooltipWrapper>
                </div>

                <div class="flex flex-col gap-0.5">
                    <div
                        v-for="friend in inactiveFriends"
                        :key="friend.id"
                        class="box-border flex cursor-pointer items-center rounded-lg p-1.5 text-[13px] transition-colors hover:bg-muted/50"
                        :class="{ 'bg-muted/60': selectedFriendIds.has(friend.id) }"
                        @click="handleFriendClick(friend)">
                        <Checkbox
                            v-if="isBatchMode"
                            class="mr-2"
                            :model-value="selectedFriendIds.has(friend.id)"
                            :disabled="isDeleting"
                            :aria-label="
                                t('side_panel.inactive_friends.select_friend', {
                                    name: getFriendDisplayName(friend)
                                })
                            "
                            @click.stop
                            @update:modelValue="toggleFriendSelection(friend.id)" />
                        <div class="relative mr-2.5 inline-block size-9 flex-none" :class="userStatusClass(friend.ref)">
                            <Avatar class="size-full rounded-full">
                                <AvatarImage :src="userImage(friend.ref, true)" class="object-cover" />
                                <AvatarFallback>
                                    <User class="size-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden h-9 flex flex-col justify-between">
                            <span
                                class="block truncate font-medium leading-[18px]"
                                :style="{ color: friend.ref?.$userColour }">
                                {{ getFriendDisplayName(friend) }}
                            </span>
                            <span class="block truncate text-xs text-muted-foreground">
                                {{
                                    t('side_panel.inactive_friends.last_login', {
                                        time: formatDateFilter(friend.ref?.last_login, 'short')
                                    })
                                }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Button } from '@/components/ui/button';
    import { Checkbox } from '@/components/ui/checkbox';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { CheckCheck, ListChecks, LoaderCircle, Trash2, User, X } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { computed, ref } from 'vue';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';

    import { friendRequest } from '../../../api';
    import { handleFriendDelete } from '../../../coordinators/friendRelationshipCoordinator';
    import { useAppearanceSettingsStore, useFriendStore, useModalStore } from '../../../stores';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { showUserDialog } from '../../../coordinators/userCoordinator';
    import { formatDateFilter } from '../../../shared/utils';

    const { t } = useI18n();
    const { userImage, userStatusClass } = useUserDisplay();
    const { inactiveFriends } = storeToRefs(useFriendStore());
    const { inactiveFriendDays } = storeToRefs(useAppearanceSettingsStore());
    const modalStore = useModalStore();

    const isBatchMode = ref(false);
    const isDeleting = ref(false);
    const selectedFriendIds = ref(new Set());

    const isAllSelected = computed(
        () =>
            inactiveFriends.value.length > 0 &&
            inactiveFriends.value.every((friend) => selectedFriendIds.value.has(friend.id))
    );
    const selectAllLabel = computed(() =>
        t(isAllSelected.value ? 'side_panel.inactive_friends.deselect_all' : 'side_panel.inactive_friends.select_all')
    );

    function getFriendDisplayName(friend) {
        return friend.ref?.displayName || friend.name || friend.id;
    }

    function enterBatchMode() {
        isBatchMode.value = true;
    }

    function exitBatchMode() {
        if (isDeleting.value) return;
        selectedFriendIds.value = new Set();
        isBatchMode.value = false;
    }

    function toggleFriendSelection(friendId) {
        if (isDeleting.value) return;
        const nextSelection = new Set(selectedFriendIds.value);
        if (nextSelection.has(friendId)) {
            nextSelection.delete(friendId);
        } else {
            nextSelection.add(friendId);
        }
        selectedFriendIds.value = nextSelection;
    }

    function toggleSelectAll() {
        if (isDeleting.value) return;
        selectedFriendIds.value = isAllSelected.value
            ? new Set()
            : new Set(inactiveFriends.value.map((friend) => friend.id));
    }

    function handleFriendClick(friend) {
        if (isBatchMode.value) {
            toggleFriendSelection(friend.id);
            return;
        }
        showUserDialog(friend.id);
    }

    async function confirmBulkDelete() {
        const targets = inactiveFriends.value.filter((friend) => selectedFriendIds.value.has(friend.id));
        if (!targets.length || isDeleting.value) return;

        const previewLimit = 8;
        const preview = targets.slice(0, previewLimit).map(getFriendDisplayName).join('\n');
        const remaining = targets.length - previewLimit;
        const previewText =
            remaining > 0
                ? `${preview}\n${t('side_panel.inactive_friends.preview_more', { count: remaining })}`
                : preview;

        try {
            const { ok } = await modalStore.confirm({
                title: t('side_panel.inactive_friends.confirm_title', { count: targets.length }),
                description: `${t('side_panel.inactive_friends.confirm_description')}\n\n${previewText}`,
                confirmText: t('side_panel.inactive_friends.confirm_delete', { count: targets.length }),
                cancelText: t('side_panel.inactive_friends.cancel'),
                destructive: true
            });
            if (ok) {
                await bulkDelete(targets);
            }
        } catch {
            // Closing or replacing the confirmation leaves the selection unchanged.
        }
    }

    async function bulkDelete(targets) {
        isDeleting.value = true;
        let deletedCount = 0;
        const failedIds = new Set();

        for (const friend of targets) {
            try {
                const args = await friendRequest.deleteFriend({ userId: friend.id });
                handleFriendDelete(args);
                deletedCount += 1;
            } catch (error) {
                console.error(`Failed to unfriend ${friend.id}`, error);
                failedIds.add(friend.id);
            }
        }

        isDeleting.value = false;
        selectedFriendIds.value = failedIds;

        if (failedIds.size > 0) {
            toast.error(
                t('side_panel.inactive_friends.delete_partial', {
                    deleted: deletedCount,
                    failed: failedIds.size
                })
            );
            return;
        }

        toast.success(t('side_panel.inactive_friends.delete_success', { count: deletedCount }));
        isBatchMode.value = false;
    }
</script>
