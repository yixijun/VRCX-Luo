<template>
    <div class="flex min-h-0 flex-col gap-3">
        <UserDialogResourceToolbar>
            <template #summary>
                <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :disabled="userDialog.isFavoriteWorldsLoading"
                    :aria-label="t('common.actions.refresh')"
                    @click="getUserFavoriteWorlds(userDialog.id)">
                    <Spinner v-if="userDialog.isFavoriteWorldsLoading" />
                    <RefreshCw v-else />
                </Button>
                <span class="user-resource-count">
                    <Globe class="size-3.5" />
                    {{ t('dialog.user.worlds.total_count', { count: favoriteWorldTotalCount }) }}
                </span>
            </template>
            <template #controls>
                <UserDialogResourceSearch
                    v-model="searchQuery"
                    :placeholder="t('dialog.user.worlds.search_placeholder')" />
            </template>
        </UserDialogResourceToolbar>

        <UserDialogResourceGrid
            v-if="searchActive"
            :items="allFilteredFavoriteWorlds"
            key-field="favoriteId"
            :loading="userDialog.isFavoriteWorldsLoading"
            @select="showWorldDialog($event.id)">
            <template #subtitle="{ item }">
                <span v-if="item.occupants">({{ item.occupants }})</span>
            </template>
            <template #empty>
                <Search class="size-5" aria-hidden="true" />
                <span>{{ t('common.no_matching_records') }}</span>
            </template>
        </UserDialogResourceGrid>

        <TabsUnderline
            v-else-if="userDialog.userFavoriteWorlds?.length"
            v-model="favoriteWorldsTab"
            :items="favoriteWorldTabs"
            :unmount-on-hide="false"
            class="zero-margin-tabs min-h-0 flex-1"
            style="height: 50vh">
            <template
                v-for="(list, index) in userDialog.userFavoriteWorlds"
                :key="`favorite-worlds-label-${index}`"
                v-slot:[`label-${index}`]>
                <span>
                    <i class="x-status-icon" style="margin-right: 8px" :class="userFavoriteWorldsStatus(list[1])"></i>
                    <span class="font-bold text-sm" v-text="list[0]"></span>
                    <span style="font-size: 10px; margin-left: 6px"
                        >{{ list[2].length }}/{{ favoriteLimits.maxFavoritesPerGroup.world }}</span
                    >
                </span>
            </template>
            <template
                v-for="(list, index) in userDialog.userFavoriteWorlds"
                :key="`favorite-worlds-content-${index}`"
                v-slot:[String(index)]>
                <UserDialogResourceGrid
                    :items="list[2]"
                    key-field="favoriteId"
                    :loading="userDialog.isFavoriteWorldsLoading"
                    @select="showWorldDialog($event.id)">
                    <template #subtitle="{ item }">
                        <span v-if="item.occupants">({{ item.occupants }})</span>
                    </template>
                </UserDialogResourceGrid>
            </template>
        </TabsUnderline>

        <UserDialogResourceGrid
            v-else
            :items="[]"
            :loading="userDialog.isFavoriteWorldsLoading">
            <template #empty>
                <Search v-if="searchQuery.trim()" class="size-5" aria-hidden="true" />
                <span>{{ t(searchQuery.trim() ? 'common.no_matching_records' : 'common.no_data') }}</span>
            </template>
        </UserDialogResourceGrid>
    </div>
</template>

<script setup>
    import { computed, ref, watch } from 'vue';
    import { Globe, RefreshCw, Search } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import { Spinner } from '@/components/ui/spinner';
    import { TabsUnderline } from '@/components/ui/tabs';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useFavoriteStore, useUserStore } from '../../../stores';
    import { showWorldDialog } from '../../../coordinators/worldCoordinator';
    import { handleFavoriteWorldList } from '../../../coordinators/favoriteCoordinator';
    import { favoriteRequest } from '../../../api';
    import UserDialogResourceGrid from './UserDialogResourceGrid.vue';
    import UserDialogResourceSearch from './UserDialogResourceSearch.vue';
    import UserDialogResourceToolbar from './UserDialogResourceToolbar.vue';

    const { t } = useI18n();

    const { userDialog } = storeToRefs(useUserStore());
    const { favoriteLimits } = storeToRefs(useFavoriteStore());

    const favoriteWorldsTab = ref('0');
    const userDialogFavoriteWorldsRequestId = ref(0);

    const favoriteWorldTabs = computed(() =>
        (userDialog.value.userFavoriteWorlds || []).map((list, index) => ({
            value: String(index),
            label: list?.[0] ?? ''
        }))
    );

    const searchQuery = ref('');
    const searchActive = computed(() => searchQuery.value.trim().length > 0);
    const favoriteWorldTotalCount = computed(() =>
        (userDialog.value.userFavoriteWorlds || []).reduce((total, list) => total + (list[2]?.length || 0), 0)
    );
    const allFilteredFavoriteWorlds = computed(() => {
        const query = searchQuery.value.trim().toLowerCase();
        if (!query) return [];
        const lists = userDialog.value.userFavoriteWorlds || [];
        const all = lists.flatMap((list) => list[2] || []);
        return all.filter((w) => (w.name || '').toLowerCase().includes(query));
    });
    watch(
        () => userDialog.value.id,
        () => {
            searchQuery.value = '';
        }
    );

    /**
     *
     * @param visibility
     */
    function userFavoriteWorldsStatus(visibility) {
        const style = {};
        if (visibility === 'public') {
            style.green = true;
        } else if (visibility === 'friends') {
            style.blue = true;
        } else {
            style.red = true;
        }
        return style;
    }

    /**
     *
     * @param userId
     */
    async function getUserFavoriteWorlds(userId) {
        const requestId = ++userDialogFavoriteWorldsRequestId.value;
        userDialog.value.isFavoriteWorldsLoading = true;
        favoriteWorldsTab.value = '0';
        userDialog.value.userFavoriteWorlds = [];
        const worldLists = [];
        const groupArgs = await favoriteRequest.getFavoriteGroups({
            ownerId: userId,
            n: 100,
            offset: 0
        });
        if (requestId !== userDialogFavoriteWorldsRequestId.value || userDialog.value.id !== userId) {
            if (requestId === userDialogFavoriteWorldsRequestId.value) {
                userDialog.value.isFavoriteWorldsLoading = false;
            }
            return;
        }
        const worldGroups = groupArgs.json.filter((list) => list.type === 'world');
        const tasks = worldGroups.map(async (list) => {
            if (list.type !== 'world') {
                return null;
            }
            const params = {
                ownerId: userId,
                n: 100,
                offset: 0,
                userId,
                tag: list.name
            };
            try {
                const args = await favoriteRequest.getFavoriteWorlds(params);
                handleFavoriteWorldList(args);
                return [list.displayName, list.visibility, args.json];
            } catch (err) {
                console.error('getUserFavoriteWorlds', err);
                return null;
            }
        });
        const results = await Promise.all(tasks);
        for (const result of results) {
            if (result) {
                worldLists.push(result);
            }
        }
        if (requestId === userDialogFavoriteWorldsRequestId.value) {
            if (userDialog.value.id === userId) {
                userDialog.value.userFavoriteWorlds = worldLists;
            }
            userDialog.value.isFavoriteWorldsLoading = false;
        }
    }

    defineExpose({ getUserFavoriteWorlds });
</script>
