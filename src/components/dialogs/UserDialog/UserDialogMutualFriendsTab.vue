<template>
    <div style="display: flex; align-items: center; justify-content: space-between">
        <div style="display: flex; align-items: center">
            <Button
                class="rounded-full"
                variant="ghost"
                size="icon-sm"
                :disabled="userDialog.isMutualFriendsLoading"
                @click="refreshMutualFriends(userDialog.id)">
                <Spinner v-if="userDialog.isMutualFriendsLoading" />
                <RefreshCw v-else />
            </Button>
            <span class="inline-flex items-center gap-1 ml-1.5 text-sm">
                <Users class="size-3.5 text-muted-foreground" />
                {{ t('dialog.user.groups.total_count', { count: userDialog.mutualFriends.length }) }}
            </span>
        </div>
        <div style="display: flex; align-items: center">
            <Input v-model="searchQuery" class="h-8 w-40 mr-2" placeholder="Search friends" @click.stop />
            <span style="margin-right: 6px">{{ t('dialog.user.groups.sort_by') }}</span>
            <Select
                :model-value="userDialogMutualFriendSortingKey"
                :disabled="userDialog.isMutualFriendsLoading"
                @update:modelValue="setUserDialogMutualFriendSortingByKey">
                <SelectTrigger size="sm" @click.stop>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem
                        v-for="(item, key) in userDialogMutualFriendSortingOptions"
                        :key="String(key)"
                        :value="String(key)">
                        {{ t(item.name) }}
                    </SelectItem>
                </SelectContent>
            </Select>
            <TooltipWrapper side="top" :content="t('dialog.user.mutual_friends.confirmed_date_tooltip')">
                <button
                    type="button"
                    class="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    :aria-label="t('dialog.user.mutual_friends.confirmed_date_tooltip')"
                    @click.stop>
                    <CircleAlert class="size-3.5" />
                </button>
            </TooltipWrapper>
        </div>
    </div>
    <ul class="flex flex-wrap items-start" style="margin-top: 8px; overflow: auto; max-height: 250px; min-width: 130px">
        <li
            v-for="user in filteredMutualFriends"
            :key="user.id"
            class="box-border flex items-center p-1.5 text-[13px] cursor-pointer w-[167px] hover:rounded-[25px_5px_5px_25px]"
            @click="showUserDialog(user.id)">
            <div class="relative inline-block flex-none size-9 mr-2.5">
                <Avatar class="size-9">
                    <AvatarImage :src="userImage(user)" class="object-cover" />
                    <AvatarFallback>
                        <User class="size-4 text-muted-foreground" />
                    </AvatarFallback>
                </Avatar>
            </div>
            <div class="flex-1 overflow-hidden">
                <span
                    class="block truncate font-medium leading-[18px]"
                    :style="{ color: user.$userColour }"
                    v-text="user.displayName"></span>
                <span
                    v-if="mutualDateMap.get(user.id)"
                    class="block truncate rounded px-1 text-[11px] leading-[15px]"
                    :class="
                        isLinkStale(mutualDateMap.get(user.id))
                            ? 'bg-gray-400/30 text-gray-500'
                            : 'bg-green-500/20 text-green-700 dark:text-green-400'
                    ">
                    {{ formatDateFilter(mutualDateMap.get(user.id), 'date') }}
                </span>
            </div>
        </li>
    </ul>
</template>

<script setup>
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Button } from '@/components/ui/button';
    import { CircleAlert, RefreshCw, User, Users } from 'lucide-vue-next';
    import { Spinner } from '@/components/ui/spinner';
    import { Input } from '@/components/ui/input';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { computed, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import {
        compareByDisplayName,
        compareByFriendOrder,
        compareByLastActiveRef,
        formatDateFilter
    } from '../../../shared/utils';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { database } from '../../../services/database';
    import { processBulk } from '../../../services/request';
    import { useOptionKeySelect } from '../../../composables/useOptionKeySelect';
    import { useUserStore } from '../../../stores';
    import { userDialogMutualFriendSortingOptions } from '../../../shared/constants';
    import { userRequest } from '../../../api';
    import { showUserDialog } from '../../../coordinators/userCoordinator';

    const { t } = useI18n();
    const { userImage } = useUserDisplay();

    const userStore = useUserStore();
    const { userDialog, currentUser } = storeToRefs(userStore);
    const { cachedUsers } = userStore;

    const { selectedKey: userDialogMutualFriendSortingKey, selectByKey: setUserDialogMutualFriendSortingByKey } =
        useOptionKeySelect(
            userDialogMutualFriendSortingOptions,
            () => userDialog.value.mutualFriendSorting,
            setUserDialogMutualFriendSorting
        );

    const searchQuery = ref('');
    const mutualDateMap = ref(new Map());
    const friendLastUpdated = ref(null);

    const filteredMutualFriends = computed(() => {
        const friends = userDialog.value.mutualFriends;
        const query = searchQuery.value.trim().toLowerCase();
        if (!query) return friends;
        return friends.filter((u) => (u.displayName || '').toLowerCase().includes(query));
    });
    watch(
        () => userDialog.value.id,
        () => {
            searchQuery.value = '';
        }
    );

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    /**
     * Returns true if the link date is stale (more than 1 day before the friend's last_updated).
     * @param {string} linkDate
     * @returns {boolean}
     */
    function isLinkStale(linkDate) {
        if (!linkDate || !friendLastUpdated.value) {
            return false;
        }
        const lastUpdatedMs = new Date(friendLastUpdated.value).getTime();
        const linkDateMs = new Date(linkDate).getTime();
        if (isNaN(lastUpdatedMs) || isNaN(linkDateMs)) {
            return false;
        }
        return lastUpdatedMs - linkDateMs > ONE_DAY_MS;
    }

    /**
     *
     * @param sortOrder
     */
    async function setUserDialogMutualFriendSorting(sortOrder) {
        const D = userDialog.value;
        D.mutualFriendSorting = sortOrder;
        switch (sortOrder.value) {
            case 'alphabetical':
                D.mutualFriends.sort(compareByDisplayName);
                break;
            case 'lastActive':
                D.mutualFriends.sort(compareByLastActiveRef);
                break;
            case 'friendOrder':
                D.mutualFriends.sort(compareByFriendOrder);
                break;
        }
    }

    /**
     * Load mutual friends from the OLD (historical) table and display them.
     * @param userId
     */
    async function getUserMutualFriends(userId) {
        if (currentUser.value.hasSharedConnectionsOptOut) {
            userDialog.value.mutualFriends = [];
            mutualDateMap.value = new Map();
            friendLastUpdated.value = null;
            return;
        }
        const [entries, lastFetched] = await Promise.all([
            database.getMutualsForFriendWithDateFromOld(userId) || [],
            database.getFriendLastFetchedFromOld(userId)
        ]);
        friendLastUpdated.value = lastFetched;
        const newDateMap = new Map();
        const friends = [];
        for (const entry of entries) {
            const ref = cachedUsers.get(entry.id);
            const base = typeof ref !== 'undefined' ? ref : { id: entry.id, displayName: entry.id };
            friends.push(base);
            if (entry.date) {
                newDateMap.set(entry.id, entry.date);
            }
        }
        mutualDateMap.value = newDateMap;
        userDialog.value.mutualFriends = friends;
        setUserDialogMutualFriendSorting(userDialog.value.mutualFriendSorting);
    }

    /**
     * Fetch mutual friends from API, merge into OLD table, then reload display.
     * @param userId
     */
    async function refreshMutualFriends(userId) {
        if (currentUser.value.hasSharedConnectionsOptOut) {
            return;
        }
        userDialog.value.isMutualFriendsLoading = true;
        const collectedIds = [];
        const params = {
            userId,
            n: 100,
            offset: 0
        };
        processBulk({
            fn: userRequest.getMutualFriends,
            N: -1,
            params,
            handle: (args) => {
                for (const json of args.json) {
                    if (!collectedIds.includes(json.id)) {
                        collectedIds.push(json.id);
                    }
                }
            },
            done: async (success) => {
                try {
                    if (success) {
                        await database.updateMutualsForFriend(userId, collectedIds);
                        await database.updateMutualsForFriendInOld(userId, collectedIds);
                        await database.updateFriendFetchTimeInOld(userId);
                    }
                    await getUserMutualFriends(userId);
                } catch (err) {
                    console.error('[UserDialogMutualFriendsTab] Failed to persist mutual friends', err);
                } finally {
                    userDialog.value.isMutualFriendsLoading = false;
                }
            }
        });
    }

    defineExpose({ getUserMutualFriends });
</script>
