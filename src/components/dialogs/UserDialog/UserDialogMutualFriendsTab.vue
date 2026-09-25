<template>
    <div
        v-if="currentUser.hasSharedConnectionsOptOut"
        class="flex h-full flex-col items-center justify-center gap-3 rounded-lg p-6 text-center text-sm text-muted-foreground">
        <p>{{ t('view.charts.mutual_friend.enable_sharing_prompt.message') }}</p>
        <Button variant="outline" :disabled="isEnablingSharing" @click="enableMutualFriendSharing">
            <Spinner v-if="isEnablingSharing" />
            {{ t('view.charts.mutual_friend.enable_sharing_prompt.confirm') }}
        </Button>
    </div>
    <div v-else class="mutual-friends-tab">
        <div class="mutual-friends-toolbar">
            <div class="mutual-friends-toolbar__summary">
                <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :disabled="userDialog.isMutualFriendsLoading"
                    :aria-label="t('dialog.user.mutual_friends.refresh')"
                    @click="refreshMutualFriends(userDialog.id)">
                    <Spinner v-if="userDialog.isMutualFriendsLoading" />
                    <RefreshCw v-else />
                </Button>
                <span class="mutual-friends-count">
                    <Users class="size-3.5" />
                    {{ t('dialog.user.mutual_friends.count', { count: userDialog.mutualFriends.length }) }}
                </span>
            </div>
            <div class="mutual-friends-toolbar__controls">
                <div class="mutual-friends-search">
                    <Search class="mutual-friends-search__icon" aria-hidden="true" />
                    <Input
                        v-model="searchQuery"
                        class="mutual-friends-search__input"
                        :placeholder="t('dialog.user.mutual_friends.search_placeholder')"
                        :aria-label="t('dialog.user.mutual_friends.search_placeholder')"
                        @click.stop />
                </div>
                <div class="mutual-friends-sort">
                    <span>{{ t('dialog.user.groups.sort_by') }}</span>
                    <Select
                        :model-value="userDialogMutualFriendSortingKey"
                        :disabled="userDialog.isMutualFriendsLoading"
                        @update:modelValue="setUserDialogMutualFriendSortingByKey">
                        <SelectTrigger class="mutual-friends-sort__trigger" size="sm" @click.stop>
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
                </div>
                <TooltipWrapper side="top" :content="t('dialog.user.mutual_friends.confirmed_date_tooltip')">
                    <button
                        type="button"
                        class="mutual-friends-help"
                        :aria-label="t('dialog.user.mutual_friends.confirmed_date_tooltip')"
                        @click.stop>
                        <CircleAlert class="size-4" />
                    </button>
                </TooltipWrapper>
            </div>
        </div>
        <TransitionGroup
            v-if="filteredMutualFriends.length"
            tag="ul"
            name="mutual-friend"
            appear
            class="mutual-friends-grid">
            <li
                v-for="(user, index) in filteredMutualFriends"
                :key="user.id"
                class="min-w-0"
                :style="{ '--stagger-index': Math.min(index, 7) }">
                <button type="button" class="mutual-friend-card" @click="showUserDialog(user.id)">
                    <Avatar class="mutual-friend-card__avatar">
                        <AvatarImage :src="userImage(user)" class="object-cover" />
                        <AvatarFallback>
                            <User class="size-4 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
                    <span class="mutual-friend-card__details">
                        <span
                            class="mutual-friend-card__name"
                            :style="{ color: user.$userColour }"
                            v-text="user.displayName"></span>
                        <span
                            v-if="mutualDateMap.get(user.id)"
                            class="mutual-friend-card__date"
                            :class="
                                isLinkStale(mutualDateMap.get(user.id))
                                    ? 'mutual-friend-card__date--stale'
                                    : 'mutual-friend-card__date--current'
                            ">
                            <CalendarDays class="size-3" />
                            {{ formatDateFilter(mutualDateMap.get(user.id), 'date') }}
                        </span>
                    </span>
                    <ChevronRight class="mutual-friend-card__chevron" aria-hidden="true" />
                </button>
            </li>
        </TransitionGroup>
        <div v-else class="mutual-friends-empty" role="status">
            <Search v-if="searchQuery.trim()" class="size-5" aria-hidden="true" />
            <Users v-else class="size-5" aria-hidden="true" />
            <span>{{
                t(
                    searchQuery.trim()
                        ? 'dialog.user.mutual_friends.search_no_results'
                        : 'dialog.user.mutual_friends.empty'
                )
            }}</span>
        </div>
    </div>
</template>

<script setup>
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Button } from '@/components/ui/button';
    import { CalendarDays, ChevronRight, CircleAlert, RefreshCw, Search, User, Users } from 'lucide-vue-next';
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
    const isEnablingSharing = ref(false);
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

    async function enableMutualFriendSharing() {
        const userId = userDialog.value.id;
        isEnablingSharing.value = true;
        try {
            await userStore.toggleSharedConnectionsOptOut();
            if (!currentUser.value.hasSharedConnectionsOptOut && userDialog.value.id === userId) {
                await getUserMutualFriends(userId);
            }
        } finally {
            isEnablingSharing.value = false;
        }
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

<style scoped>
    .mutual-friends-tab {
        display: flex;
        height: 100%;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
        gap: 0.75rem;
    }

    .mutual-friends-toolbar {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.375rem 0.75rem;
        border-bottom: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
        padding: 0 0 0.5rem;
    }

    .mutual-friends-toolbar__summary,
    .mutual-friends-toolbar__controls,
    .mutual-friends-count,
    .mutual-friends-sort {
        display: flex;
        min-width: 0;
        align-items: center;
    }

    .mutual-friends-toolbar__summary,
    .mutual-friends-toolbar__controls {
        gap: 0.375rem;
    }

    .mutual-friends-toolbar__controls {
        flex: 1 1 30rem;
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .mutual-friends-count {
        gap: 0.375rem;
        border-radius: 999px;
        background: color-mix(in oklab, var(--primary) 15%, transparent);
        padding: 0.25rem 0.625rem;
        color: var(--primary);
        font-size: 0.8125rem;
        font-weight: 650;
        white-space: nowrap;
    }

    .mutual-friends-search {
        position: relative;
        min-width: min(100%, 12rem);
        flex: 1 1 13rem;
        max-width: 20rem;
    }

    .mutual-friends-search__icon {
        position: absolute;
        top: 50%;
        left: 0.75rem;
        z-index: 1;
        width: 1rem;
        height: 1rem;
        transform: translateY(-50%);
        color: var(--muted-foreground);
        pointer-events: none;
    }

    .mutual-friends-search__input {
        height: 2.25rem;
        padding-left: 2.25rem;
        font-size: 0.875rem;
    }

    .mutual-friends-sort {
        gap: 0.5rem;
        color: var(--muted-foreground);
        font-size: 0.8125rem;
        white-space: nowrap;
    }

    .mutual-friends-sort__trigger {
        width: 10.5rem;
        min-width: 0;
    }

    .mutual-friends-help {
        display: inline-flex;
        width: 2rem;
        height: 2rem;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: var(--muted-foreground);
        transition:
            color 150ms ease,
            background-color 150ms ease;
    }

    .mutual-friends-help:hover {
        background: var(--accent);
        color: var(--foreground);
    }

    .mutual-friends-help:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
    }

    .mutual-friends-grid {
        display: grid;
        min-height: 0;
        min-width: 0;
        flex: 1 1 0%;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr));
        align-content: start;
        gap: 0.375rem;
        overflow: auto;
        padding: 0.0625rem;
    }

    .mutual-friend-enter-active {
        transition:
            opacity 180ms ease-out,
            transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        transition-delay: calc(var(--stagger-index, 0) * 24ms);
    }

    .mutual-friend-enter-from {
        transform: translateY(6px) scale(0.985);
        opacity: 0;
    }

    .mutual-friend-leave-active {
        transition:
            opacity 110ms ease-in,
            transform 110ms ease-in;
        pointer-events: none;
    }

    .mutual-friend-leave-to {
        transform: scale(0.98);
        opacity: 0;
    }

    .mutual-friend-move {
        transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .mutual-friend-card {
        display: flex;
        width: 100%;
        min-width: 0;
        min-height: 3.25rem;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid color-mix(in oklab, var(--border) 76%, transparent);
        border-radius: var(--radius-lg);
        background: color-mix(in oklab, var(--card) 45%, transparent);
        padding: 0.375rem 0.5rem;
        text-align: left;
        transition:
            border-color 150ms ease,
            background-color 150ms ease,
            transform 100ms ease-out;
    }

    .mutual-friend-card:hover {
        border-color: color-mix(in oklab, var(--primary) 38%, transparent);
        background: color-mix(in oklab, var(--accent) 48%, transparent);
    }

    .mutual-friend-card:active {
        transform: scale(0.99);
    }

    .mutual-friend-card:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
    }

    .mutual-friend-card__avatar {
        width: 2rem;
        height: 2rem;
        flex: 0 0 auto;
        box-shadow: 0 1px 4px color-mix(in oklab, var(--foreground) 12%, transparent);
    }

    .mutual-friend-card__details {
        display: flex;
        min-width: 0;
        flex: 1 1 auto;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.3rem;
    }

    .mutual-friend-card__name {
        max-width: 100%;
        overflow: hidden;
        font-size: 0.875rem;
        font-weight: 650;
        letter-spacing: -0.01em;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .mutual-friend-card__date {
        display: inline-flex;
        max-width: 100%;
        align-items: center;
        gap: 0.25rem;
        border-radius: var(--radius-xs);
        padding: 0 0.3rem;
        font-size: 0.6875rem;
        line-height: 0.95rem;
        white-space: nowrap;
    }

    .mutual-friend-card__date--current {
        background: color-mix(in oklab, oklch(0.65 0.19 145) 18%, transparent);
        color: oklch(0.42 0.14 145);
    }

    :global(.dark) .mutual-friend-card__date--current {
        color: oklch(0.82 0.14 145);
    }

    .mutual-friend-card__date--stale {
        background: color-mix(in oklab, var(--muted) 45%, transparent);
        color: color-mix(in oklab, var(--muted-foreground) 76%, transparent);
    }

    .mutual-friend-card__chevron {
        width: 1rem;
        height: 1rem;
        flex: 0 0 auto;
        color: color-mix(in oklab, var(--muted-foreground) 65%, transparent);
        transition:
            color 150ms ease,
            transform 150ms ease;
    }

    .mutual-friend-card:hover .mutual-friend-card__chevron {
        transform: translateX(2px);
        color: var(--foreground);
    }

    .mutual-friends-empty {
        display: flex;
        min-height: 7rem;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 1px dashed color-mix(in oklab, var(--border) 80%, transparent);
        border-radius: var(--radius-lg);
        background: color-mix(in oklab, var(--muted) 12%, transparent);
        padding: 1.25rem;
        color: var(--muted-foreground);
        font-size: 0.875rem;
        text-align: center;
    }

    @media (max-width: 42rem) {
        .mutual-friends-toolbar__controls {
            flex-basis: 100%;
            justify-content: flex-start;
        }

        .mutual-friends-search {
            max-width: none;
        }

        .mutual-friends-sort {
            flex: 1 1 auto;
            justify-content: space-between;
        }

        .mutual-friends-sort__trigger {
            flex: 1 1 auto;
            max-width: 12rem;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .mutual-friends-help,
        .mutual-friend-card,
        .mutual-friend-card__chevron,
        .mutual-friend-enter-active,
        .mutual-friend-leave-active,
        .mutual-friend-move {
            transition: none;
        }
    }
</style>
