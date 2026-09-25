<template>
    <div class="flex min-h-0 flex-col gap-3">
        <UserDialogResourceToolbar>
            <template #summary>
                <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :disabled="userDialog.isWorldsLoading"
                    :aria-label="t('common.actions.refresh')"
                    @click="refreshUserDialogWorlds()">
                    <Spinner v-if="userDialog.isWorldsLoading" />
                    <RefreshCw v-else />
                </Button>
                <span class="user-resource-count">
                    <Globe class="size-3.5" />
                    {{ t('dialog.user.worlds.total_count', { count: userDialog.worlds.length }) }}
                </span>
            </template>
            <template #controls>
                <UserDialogResourceSearch
                    v-model="searchQuery"
                    :placeholder="t('dialog.user.worlds.search_placeholder')" />
                <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{{ t('dialog.user.worlds.sort_by') }}</span>
                    <Select
                        :model-value="userDialogWorldSortingKey"
                        :disabled="userDialog.isWorldsLoading"
                        @update:modelValue="setUserDialogWorldSortingByKey">
                        <SelectTrigger class="w-36" size="sm" @click.stop>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="(item, key) in userDialogWorldSortingOptions"
                                :key="String(key)"
                                :value="String(key)">
                                {{ t(item.name) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <span>{{ t('dialog.user.worlds.order_by') }}</span>
                    <Select
                        :model-value="userDialogWorldOrderKey"
                        :disabled="userDialog.isWorldsLoading"
                        @update:modelValue="setUserDialogWorldOrderByKey">
                        <SelectTrigger class="w-28" size="sm" @click.stop>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="(item, key) in userDialogWorldOrderOptions"
                                :key="String(key)"
                                :value="String(key)">
                                {{ t(item.name) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </template>
        </UserDialogResourceToolbar>
        <UserDialogResourceGrid
            :items="filteredWorlds"
            :loading="userDialog.isWorldsLoading"
            @select="showWorldDialog($event.id)">
            <template #subtitle="{ item }">
                <span v-if="item.occupants">({{ item.occupants }})</span>
            </template>
            <template #empty>
                <Search v-if="searchQuery.trim()" class="size-5" aria-hidden="true" />
                <span>{{ t(searchQuery.trim() && userDialog.worlds.length ? 'common.no_matching_records' : 'common.no_data') }}</span>
            </template>
        </UserDialogResourceGrid>
    </div>
</template>

<script setup>
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Button } from '@/components/ui/button';
    import { Globe, RefreshCw, Search } from 'lucide-vue-next';
    import { Spinner } from '@/components/ui/spinner';
    import { computed, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useUserStore, useWorldStore } from '../../../stores';
    import { applyWorld, showWorldDialog } from '../../../coordinators/worldCoordinator';
    import { userDialogWorldOrderOptions, userDialogWorldSortingOptions } from '../../../shared/constants/';
    import { queryRequest } from '../../../api';
    import { useOptionKeySelect } from '../../../composables/useOptionKeySelect';
    import UserDialogResourceGrid from './UserDialogResourceGrid.vue';
    import UserDialogResourceSearch from './UserDialogResourceSearch.vue';
    import UserDialogResourceToolbar from './UserDialogResourceToolbar.vue';

    const { t } = useI18n();

    const userStore = useUserStore();
    const { userDialog, currentUser } = storeToRefs(userStore);
    const { cachedWorlds } = useWorldStore();

    const userDialogWorldsRequestId = ref(0);

    const searchQuery = ref('');
    const filteredWorlds = computed(() => {
        const worlds = userDialog.value.worlds;
        const query = searchQuery.value.trim().toLowerCase();
        if (!query) return worlds;
        return worlds.filter((w) => (w.name || '').toLowerCase().includes(query));
    });
    watch(
        () => userDialog.value.id,
        () => {
            searchQuery.value = '';
        }
    );

    watch(
        () => [userDialog.value.id, userDialog.value.publicProfileRef],
        ([userId]) => {
            if (userDialog.value.activeTab !== 'Worlds') return;
            const profileWorlds = getCompletePublicProfileWorlds(userId);
            if (profileWorlds) {
                if (userDialog.value.isWorldsLoading) {
                    userDialogWorldsRequestId.value += 1;
                    userDialog.value.isWorldsLoading = false;
                }
                userDialog.value.worlds = profileWorlds;
            }
        }
    );

    function sortPublicWorlds(worlds) {
        const sortKey = userDialog.value.worldSorting.value;
        const direction = userDialog.value.worldOrder.value === 'ascending' ? 1 : -1;
        const valueFor = (world) => {
            switch (sortKey) {
                case 'name':
                    return String(world.name || '').toLocaleLowerCase();
                case 'created':
                    return Date.parse(world.created_at || '') || 0;
                case 'favorites':
                    return Number(world.favorites) || 0;
                case 'popularity':
                    return Number(world.popularity) || 0;
                case 'updated':
                default:
                    return Date.parse(world.updated_at || '') || 0;
            }
        };
        return [...worlds].sort((left, right) => {
            const a = valueFor(left);
            const b = valueFor(right);
            const compared = typeof a === 'string' ? a.localeCompare(b) : a - b;
            return compared === 0 ? left.id.localeCompare(right.id) : compared * direction;
        });
    }

    function getCompletePublicProfileWorlds(userId) {
        if (!userId || userId === currentUser.value.id) return null;
        const profile = userDialog.value.publicProfileRef;
        if (profile?.id !== userId || !Array.isArray(profile.publicWorlds)) return null;
        const total = Number(profile.totalPublicWorldsCount);
        if (!Number.isFinite(total) || total !== profile.publicWorlds.length) return null;
        return sortPublicWorlds(
            profile.publicWorlds.map((world) =>
                applyWorld({
                    ...world,
                    tags: Array.isArray(world.tags) ? world.tags : []
                })
            )
        );
    }

    /**
     *
     * @param userId
     */
    function setUserDialogWorlds(userId) {
        const profileWorlds = getCompletePublicProfileWorlds(userId);
        if (profileWorlds) {
            userDialog.value.worlds = profileWorlds;
            return true;
        }
        const worlds = [];
        for (const ref of cachedWorlds.values()) {
            if (ref.authorId === userId) {
                worlds.push(ref);
            }
        }
        userDialog.value.worlds = worlds;
        return false;
    }

    /**
     *
     */
    function refreshUserDialogWorlds() {
        const D = userDialog.value;
        if (D.isWorldsLoading) {
            return;
        }
        const requestId = ++userDialogWorldsRequestId.value;
        D.isWorldsLoading = true;
        const params = {
            n: 50,
            offset: 0,
            sort: userDialog.value.worldSorting.value,
            order: userDialog.value.worldOrder.value,
            // user: 'friends',
            userId: D.id,
            releaseStatus: 'public'
        };
        if (params.userId === currentUser.value.id) {
            params.user = 'me';
            params.releaseStatus = 'all';
        }
        const worlds = [];
        const worldIds = new Set();
        (async () => {
            try {
                let offset = 0;
                while (true) {
                    const args = await queryRequest.fetch('worldsByUser', {
                        ...params,
                        offset
                    });
                    if (requestId !== userDialogWorldsRequestId.value || D.id !== params.userId) {
                        return;
                    }
                    for (const world of args.json) {
                        if (!worldIds.has(world.id)) {
                            worldIds.add(world.id);
                            worlds.push(world);
                        }
                    }
                    if (args.json.length < params.n) {
                        break;
                    }
                    offset += params.n;
                }
                if (requestId === userDialogWorldsRequestId.value && D.id === params.userId) {
                    userDialog.value.worlds = getCompletePublicProfileWorlds(params.userId) || worlds;
                }
            } finally {
                if (requestId === userDialogWorldsRequestId.value) {
                    D.isWorldsLoading = false;
                }
            }
        })().catch((err) => {
            console.error('refreshUserDialogWorlds failed', err);
        });
    }

    /**
     *
     * @param sortOrder
     */
    async function setUserDialogWorldSorting(sortOrder) {
        const D = userDialog.value;
        if (D.worldSorting.value === sortOrder.value) {
            return;
        }
        D.worldSorting = sortOrder;
        refreshUserDialogWorlds();
    }

    const { selectedKey: userDialogWorldSortingKey, selectByKey: setUserDialogWorldSortingByKey } = useOptionKeySelect(
        userDialogWorldSortingOptions,
        () => userDialog.value.worldSorting,
        setUserDialogWorldSorting
    );

    /**
     *
     * @param order
     */
    async function setUserDialogWorldOrder(order) {
        const D = userDialog.value;
        if (D.worldOrder.value === order.value) {
            return;
        }
        D.worldOrder = order;
        refreshUserDialogWorlds();
    }

    const { selectedKey: userDialogWorldOrderKey, selectByKey: setUserDialogWorldOrderByKey } = useOptionKeySelect(
        userDialogWorldOrderOptions,
        () => userDialog.value.worldOrder,
        setUserDialogWorldOrder
    );

    defineExpose({ setUserDialogWorlds, refreshUserDialogWorlds });
</script>
