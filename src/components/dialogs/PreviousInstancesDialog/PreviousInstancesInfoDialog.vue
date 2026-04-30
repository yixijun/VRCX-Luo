<template>
    <div class="flex flex-col h-full">
        <DialogHeader>
            <DialogTitle>{{ t('dialog.previous_instances.info') }}</DialogTitle>
        </DialogHeader>

        <DataTableLayout
            v-if="viewMode === 'table'"
            class="min-w-0 w-full flex-1"
            :table="table"
            :loading="loading"
            :table-style="tableStyle"
            :page-sizes="pageSizes"
            :total-items="totalItems"
            :on-page-size-change="handlePageSizeChange"
            :on-page-change="handlePageChange"
            :on-sort-change="handleSortChange">
            <template #toolbar>
                <div style="display: flex; align-items: center; justify-content: space-between">
                    <div class="flex items-center gap-2 px-1 py-2">
                        <ToggleGroup
                            type="single"
                            :model-value="viewMode"
                            variant="outline"
                            @update:model-value="handleViewModeChange">
                            <TooltipWrapper
                                :content="t('dialog.previous_instances.table_view')"
                                side="bottom"
                                :delay-duration="300">
                                <ToggleGroupItem
                                    value="table"
                                    class="px-2"
                                    :class="viewMode === 'table' && 'bg-accent text-accent-foreground'">
                                    <List class="size-4" />
                                </ToggleGroupItem>
                            </TooltipWrapper>
                            <TooltipWrapper
                                :content="t('dialog.previous_instances.chart_view')"
                                side="bottom"
                                :delay-duration="300">
                                <ToggleGroupItem
                                    value="chart"
                                    class="px-2"
                                    :class="viewMode === 'chart' && 'bg-accent text-accent-foreground'">
                                    <BarChart3 class="size-4" />
                                </ToggleGroupItem>
                            </TooltipWrapper>
                        </ToggleGroup>
                        <Location :location="location.tag" class="text-sm" />
                    </div>
                    <InputGroupField
                        v-model="search"
                        :placeholder="t('dialog.previous_instances.search_placeholder')"
                        style="width: 150px"
                        clearable />
                </div>
            </template>
        </DataTableLayout>

        <div v-else-if="viewMode === 'chart'" class="flex flex-col min-w-0 w-full flex-1">
            <div class="flex items-center justify-between px-1 py-2 flex-shrink-0">
                <div class="flex items-center gap-2">
                    <ToggleGroup
                        type="single"
                        :model-value="viewMode"
                        variant="outline"
                        @update:model-value="handleViewModeChange">
                        <TooltipWrapper
                            :content="t('dialog.previous_instances.table_view')"
                            side="bottom"
                            :delay-duration="300">
                            <ToggleGroupItem
                                value="table"
                                class="px-2"
                                :class="viewMode === 'table' && 'bg-accent text-accent-foreground'">
                                <List class="size-4" />
                            </ToggleGroupItem>
                        </TooltipWrapper>
                        <TooltipWrapper
                            :content="t('dialog.previous_instances.chart_view')"
                            side="bottom"
                            :delay-duration="300">
                            <ToggleGroupItem
                                value="chart"
                                class="px-2"
                                :class="viewMode === 'chart' && 'bg-accent text-accent-foreground'">
                                <BarChart3 class="size-4" />
                            </ToggleGroupItem>
                        </TooltipWrapper>
                    </ToggleGroup>
                    <Location :location="location.tag" class="text-sm" />
                </div>
            </div>
            <div class="flex-1 overflow-auto min-h-0">
                <div v-if="chartLoading" class="flex items-center justify-center" style="min-height: 200px">
                    <span class="text-muted-foreground text-sm">{{ t('view.friends_locations.loading_more') }}</span>
                </div>
                <PreviousInstancesInfoChart v-else :chart-data="chartData" />
            </div>
        </div>

        <div class="flex items-center justify-end gap-2 p-2 mt-auto border-t border-border flex-shrink-0">
            <div class="w-[150px]">
                <VirtualCombobox
                    v-model="manualAddUserId"
                    :groups="userPickerGroups"
                    placeholder="伪记录"
                    search-placeholder="搜索..."
                    :clearable="true"
                    :close-on-select="true"
                >
                    <template #trigger="{ text }">
                        <div class="flex items-center truncate">
                            <Search class="mr-2 size-4 opacity-50" />
                            <span class="truncate">{{ text || "伪记录" }}</span>
                        </div>
                    </template>
                    <template #item="{ item }">
                        <div class="flex w-full items-center p-1.5 text-[13px]">
                            <div class="flex-1 overflow-hidden">
                                <span class="block truncate font-medium leading-[18px]" v-text="item.label"></span>
                            </div>
                        </div>
                    </template>
                </VirtualCombobox>
            </div>
            <Button
                size="sm"
                variant="outline"
                :disabled="!manualAddUserId"
                @click="handleAddFakeRecord"
                class="px-3"
            >
                <Plus class="size-4 mr-1" />
                添加记录
            </Button>
        </div>
    </div>
</template>

<script setup>
    defineOptions({ name: 'PreviousInstancesInfoDialog' });

    import { computed, nextTick, ref, watch } from 'vue';
    import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import { BarChart3, List, Plus, Search } from 'lucide-vue-next';

    import { useGameLogStore, useInstanceStore, useSearchStore, useVrcxStore, useFriendStore, useUserStore, useTrackedNonFriendsStore } from '../../../stores';
    import { compareByCreatedAt, localeIncludes, parseLocation, timeToText } from '../../../shared/utils';
    import { DataTableLayout } from '../../ui/data-table';
    import { InputGroupField } from '../../../components/ui/input-group';
    import { ToggleGroup, ToggleGroupItem } from '../../../components/ui/toggle-group';
    import { TooltipWrapper } from '../../../components/ui/tooltip';
    import { createColumns } from './previousInstancesInfoColumns.jsx';
    import { database } from '../../../services/database';
    import { useVrcxVueTable } from '../../../lib/table/useVrcxVueTable';
    import { lookupUser } from '../../../coordinators/userCoordinator';

    import PreviousInstancesInfoChart from './PreviousInstancesInfoChart.vue';
    import { VirtualCombobox } from '../../../components/ui/virtual-combobox';
    import { Button } from '../../../components/ui/button';

    const { previousInstancesInfoDialog, previousInstancesInfoState } = storeToRefs(useInstanceStore());
    const { gameLogIsFriend, gameLogIsFavorite } = useGameLogStore();
    const { t } = useI18n();

    const { vipFriends, onlineFriends, activeFriends, offlineFriends } = storeToRefs(useFriendStore());
    const { trackedList } = storeToRefs(useTrackedNonFriendsStore());
    const { currentUser } = storeToRefs(useUserStore());

    const manualAddUserId = ref('');

    const dialogState = computed(() => {
        return previousInstancesInfoState.value;
    });

    const friendSections = computed(() => [
        { key: 'vip', label: t('side_panel.favorite'), friends: vipFriends.value },
        { key: 'online', label: t('side_panel.online'), friends: onlineFriends.value },
        { key: 'active', label: t('side_panel.active'), friends: activeFriends.value },
        { key: 'offline', label: t('side_panel.offline'), friends: offlineFriends.value }
    ]);

    const userPickerGroups = computed(() => {
        const groups = [];
        const addGroup = ({ key, label, list }) => {
            if (!list?.length) return;
            const addedIds = new Set();
            const items = [];
            for (const item of list) {
                const uid = String(item.id || item.userId);
                if (addedIds.has(uid)) continue;
                addedIds.add(uid);
                items.push({
                    value: uid,
                    label: item.displayName || item.name || uid,
                    search: item.displayName || item.name || uid,
                    user: item
                });
            }
            if (items.length > 0) {
                groups.push({ key, label, items });
            }
        };

        friendSections.value.forEach(section => {
            addGroup({ key: section.key, label: section.label, list: section.friends });
        });

        addGroup({ key: 'tracked', label: '追踪非好友', list: trackedList.value });

        return groups;
    });

    async function handleAddFakeRecord() {
        if (!manualAddUserId.value) return;

        let targetUser = null;
        for (const group of userPickerGroups.value) {
            const found = group.items.find(i => i.value === manualAddUserId.value);
            if (found) {
                targetUser = found;
                break;
            }
        }
        if (!targetUser) return;
        const uid = targetUser.value;
        const uDisplayName = targetUser.label;

        let joinTime = Date.now();
        if (currentUser.value?.id) {
            const ownJoinTime = await database.getLastJoinTimeForUserAtLocation({
                id: currentUser.value.id,
                displayName: currentUser.value.displayName || currentUser.value.username
            }, location.value.tag);
            if (ownJoinTime) {
                joinTime = ownJoinTime;
            }
        }

        const joinMs = joinTime;
        const leaveMs = joinMs + 5000;

        const joinedAtISO = new Date(joinMs).toISOString();
        const leftAtISO = new Date(leaveMs).toISOString();

        database.addGamelogJoinLeaveToDatabase({
            created_at: joinedAtISO,
            type: 'OnPlayerJoined',
            displayName: uDisplayName,
            location: location.value.tag,
            userId: uid,
            time: 0
        });

        database.addGamelogJoinLeaveToDatabase({
            created_at: leftAtISO,
            type: 'OnPlayerLeft',
            displayName: uDisplayName,
            location: location.value.tag,
            userId: uid,
            time: 5000
        });

        setTimeout(() => {
            refreshPreviousInstancesInfoTable();
        }, 100);
        manualAddUserId.value = '';
    }

    const loading = ref(false);
    const rawRows = ref([]);
    const pageSizes = [10, 25, 50, 100];
    const pageSize = computed({
        get: () => dialogState.value.pageSize,
        set: (value) => {
            dialogState.value.pageSize = value;
        }
    });
    const pageIndex = computed({
        get: () => dialogState.value.pageIndex,
        set: (value) => {
            dialogState.value.pageIndex = value;
        }
    });
    const tableStyle = { maxHeight: '100%' };
    const search = computed({
        get: () => dialogState.value.search,
        set: (value) => {
            dialogState.value.search = value;
        }
    });
    const sortBy = computed({
        get: () => dialogState.value.sortBy,
        set: (value) => {
            dialogState.value.sortBy = value;
        }
    });

    const location = ref({
        tag: '',
        isOffline: false,
        isPrivate: false,
        isTraveling: false,
        isRealInstance: false,
        worldId: '',
        instanceId: '',
        instanceName: '',
        accessType: '',
        accessTypeName: '',
        region: '',
        shortName: '',
        userId: null,
        hiddenId: null,
        privateId: null,
        friendsId: null,
        groupId: null,
        groupAccessType: null,
        canRequestInvite: false,
        strict: false,
        ageGate: false
    });

    const { stringComparer } = storeToRefs(useSearchStore());

    const viewMode = ref('table');
    const chartData = ref([]);
    const chartLoading = ref(false);

    const displayRows = computed(() => {
        const q = String(search.value ?? '')
            .trim()
            .toLowerCase();
        const rows = Array.isArray(rawRows.value) ? rawRows.value : [];
        if (!q) return rows;
        return rows.filter((row) => localeIncludes(row?.displayName ?? '', q, stringComparer.value));
    });

    const columns = computed(() =>
        createColumns({
            onLookupUser: lookupUser
        })
    );

    const { table } = useVrcxVueTable({
        persistKey: 'previousInstancesInfoDialog',
        get data() {
            return displayRows.value;
        },
        columns: columns.value,
        getRowId: (row) => JSON.stringify(row ?? {}),
        initialSorting: sortBy.value,
        initialPagination: {
            pageIndex: pageIndex.value,
            pageSize: pageSize.value
        },
        tableOptions: {
            autoResetPageIndex: false
        }
    });

    watch(
        columns,
        (next) => {
            table.setOptions((prev) => ({
                ...prev,
                columns: next
            }));
        },
        { immediate: true }
    );

    const totalItems = computed(() => {
        return table.getFilteredRowModel().rows.length;
    });

    const handlePageSizeChange = (size) => {
        pageSize.value = size;
    };

    const handlePageChange = (page) => {
        pageIndex.value = Math.max(0, page - 1);
    };

    const handleSortChange = (sorting) => {
        sortBy.value = sorting;
    };

    function handleViewModeChange(value) {
        if (value) {
            viewMode.value = value;
            if (value === 'chart' && chartData.value.length === 0) {
                loadChartData();
            }
        }
    }

    async function loadChartData() {
        chartLoading.value = true;
        try {
            const data = await database.getPlayerDetailFromInstance(location.value.tag);
            chartData.value = data;
        } catch (error) {
            console.error('Failed to load chart data:', error);
            chartData.value = [];
        } finally {
            chartLoading.value = false;
        }
    }

    watch(
        () => previousInstancesInfoDialog.value.visible,
        (value) => {
            if (value) {
                nextTick(() => {
                    init();
                    refreshPreviousInstancesInfoTable();
                });
            } else {
                viewMode.value = 'table';
                chartData.value = [];
            }
        },
        { immediate: true }
    );

    function init() {
        loading.value = true;
        location.value = parseLocation(previousInstancesInfoDialog.value.instanceId);
        if (previousInstancesInfoDialog.value.lastId !== previousInstancesInfoDialog.value.instanceId) {
            table.setPageIndex(0);
            previousInstancesInfoDialog.value.lastId = previousInstancesInfoDialog.value.instanceId;
        }
    }

    function refreshPreviousInstancesInfoTable() {
        database.getPlayersFromInstance(location.value.tag).then((data) => {
            const array = [];
            for (const entry of Array.from(data.values())) {
                entry.timer = timeToText(entry.time);
                entry.isFriend = gameLogIsFriend(entry);
                entry.isFavorite = gameLogIsFavorite(entry);
                array.push(entry);
            }
            array.sort(compareByCreatedAt);
            rawRows.value = array;
            loading.value = false;
        });
    }
</script>
