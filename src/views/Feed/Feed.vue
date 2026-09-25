<template>
    <div
        class="x-container feed x-container--auto-height"
        ref="feedRef"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop">
        <div
            v-show="isDraggingOver"
            class="feed-drop-overlay absolute inset-0 z-50 flex items-center justify-center rounded-[var(--radius)] bg-background/80 backdrop-blur-sm pointer-events-none">
            <div class="flex flex-wrap justify-center gap-6 p-8 w-full max-w-4xl pointer-events-none">
                <div
                    v-for="zone in dropZones"
                    :key="zone.tab"
                    :data-tab="zone.tab"
                    class="feed-zone-element flex flex-col items-center justify-center p-6 w-[28%] aspect-square rounded-2xl border-2 border-dashed border-primary/40 bg-card/80 text-foreground transition-all duration-300 pointer-events-none"
                    :class="{ 'border-primary border-solid bg-primary/20 text-primary scale-[1.05] shadow-[0_12px_30px_-10px_rgba(var(--primary-rgb),0.5)]': hoveredZone === zone.tab }">
                    <Upload class="size-8 mb-2" />
                    <span class="text-sm font-semibold text-center">{{ zone.label }}</span>
                    <span class="text-xs opacity-70 mt-1 text-center">{{ t('dialog.gallery_icons.drop_to_upload') }}</span>
                </div>
            </div>
        </div>
        <DataTableLayout

            :table="table"
            :loading="feedTable.loading"
            auto-height
            :page-sizes="pageSizes"
            :total-items="totalItems"
            :on-page-size-change="handlePageSizeChange">
            <template #toolbar>
                <div class="mt-0 mx-0 mb-2" style="display: flex; align-items: center">
                    <div style="flex: none; display: flex; align-items: center" class="mr-2">
                        <Popover v-model:open="popoverOpen">
                            <PopoverTrigger as-child>
                                <Button variant="outline" size="sm" class="mx-2 h-8 gap-1.5">
                                    <ListFilter class="size-4" />
                                    {{ t('view.my_avatars.filter') }}
                                    <Badge
                                        v-if="activeFilterCount"
                                        variant="secondary"
                                        class="ml-0.5 h-4.5 min-w-4.5 rounded-full px-1 text-xs">
                                        {{ activeFilterCount }}
                                    </Badge>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent class="w-auto" side="bottom" align="end">
                                <RangeCalendar
                                    v-model="dateRange"
                                    :locale="locale"
                                    :max-value="todayDate"
                                    :number-of-months="2"
                                    :week-starts-on="weekStartsOn" />
                                <div class="flex justify-end gap-2 mt-3">
                                    <Button variant="outline" size="sm" @click="clearDateFilter">
                                        {{ t('common.actions.clear') }}
                                    </Button>
                                    <Button size="sm" @click="applyDateFilter">
                                        {{ t('common.actions.confirm') }}
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <TooltipWrapper side="bottom" :content="t('view.feed.favorites_only_tooltip')">
                            <div>
                                <Toggle
                                    variant="outline"
                                    size="sm"
                                    :model-value="feedTable.vip"
                                    @update:modelValue="
                                        (v) => {
                                            feedTable.vip = v;
                                            feedTableLookup();
                                        }
                                    ">
                                    <Star />
                                </Toggle>
                            </div>
                        </TooltipWrapper>
                    </div>
                    <ToggleGroup
                        type="multiple"
                        variant="outline"
                        size="sm"
                        :model-value="activeFilterSelection"
                        @update:model-value="handleFeedFilterChange"
                        class="w-full justify-start"
                        style="flex: 1">
                        <ToggleGroupItem value="All">
                            {{ t('view.search.avatar.all') }}
                        </ToggleGroupItem>
                        <ToggleGroupItem v-for="type in feedFilterTypes" :key="type" :value="type">
                            {{ t('view.feed.filters.' + type) }}
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <InputGroupField
                        class="ml-2"
                        v-model="feedTable.search"
                        :placeholder="t('view.feed.search_placeholder')"
                        clearable
                        style="flex: 0.4"
                        @keyup.enter="feedTableLookup"
                        @change="feedTableLookup" />
                </div>
            </template>
        </DataTableLayout>
    </div>
</template>

<script setup>
    import { computed, ref } from 'vue';
    import { ListFilter, Star, Upload } from 'lucide-vue-next';
    import { getLocalTimeZone, today } from '@internationalized/date';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import dayjs from 'dayjs';

    import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
    import { useAppearanceSettingsStore, useFeedStore, useGalleryStore, useVrcxStore } from '../../stores';
    import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group';
    import { Badge } from '../../components/ui/badge';
    import { Button } from '../../components/ui/button';
    import { DataTableLayout } from '../../components/ui/data-table';
    import { InputGroupField } from '../../components/ui/input-group';
    import { RangeCalendar } from '../../components/ui/range-calendar';
    import { Toggle } from '../../components/ui/toggle';
    import { TooltipWrapper } from '../../components/ui/tooltip';
    import { columns as baseColumns } from './columns.jsx';
    import { useVrcxVueTable } from '../../lib/table/useVrcxVueTable';

    const { feedTable, feedTableData } = storeToRefs(useFeedStore());
    const { feedTableLookup } = useFeedStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();
    const { weekStartsOn } = storeToRefs(appearanceSettingsStore);
    const vrcxStore = useVrcxStore();
    const galleryStore = useGalleryStore();

    const { t, locale } = useI18n();
    const feedFilterTypes = ['GPS', 'Online', 'Offline', 'Status', 'Avatar', 'Bio'];

    const popoverOpen = ref(false);
    const todayDate = today(getLocalTimeZone());
    const dateRange = ref(undefined);
    const hasDateFilter = computed(() => !!(feedTable.value.dateFrom || feedTable.value.dateTo));
    const activeFilterCount = computed(() => (hasDateFilter.value ? 1 : 0));

    // Drag-and-drop state
    const isDraggingOver = ref(false);
    const hoveredZone = ref('');
    let dragEnterCount = 0;

    const dropZones = computed(() => [
        { tab: 'gallery', label: t('dialog.gallery_icons.gallery') },
        { tab: 'icons', label: t('dialog.gallery_icons.icons') },
        { tab: 'emojis', label: t('dialog.gallery_icons.emojis') },
        { tab: 'stickers', label: t('dialog.gallery_icons.stickers') },
        { tab: 'prints', label: t('dialog.gallery_icons.prints') }
    ]);

    /**
     * @param {DragEvent} e
     */
    function onDragEnter(e) {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        dragEnterCount++;
        isDraggingOver.value = true;
    }

    /**
     * @param {DragEvent} e
     */
    function onDragOver(e) {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        e.dataTransfer.dropEffect = 'copy';

        // Hit-test to see which zone we are hovering over
        const elements = document.querySelectorAll('.feed-zone-element');
        let found = '';
        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                found = el.getAttribute('data-tab');
                break;
            }
        }
        hoveredZone.value = found;
    }

    /**
     * Decrements the drag enter counter; hides the overlay when the drag leaves the container.
     */
    function onDragLeave() {
        dragEnterCount--;
        if (dragEnterCount <= 0) {
            dragEnterCount = 0;
            isDraggingOver.value = false;
            hoveredZone.value = '';
        }
    }

    /**
     * Handles drop on the container. Stores file in gallery store and navigates to Gallery.
     * @param {DragEvent} e
     */
    function onDrop(e) {
        const tab = hoveredZone.value;

        dragEnterCount = 0;
        isDraggingOver.value = false;
        hoveredZone.value = '';

        if (!tab || !e.dataTransfer?.files?.length) return;

        const file = e.dataTransfer.files[0];
        galleryStore.pendingDrop = { file, tab };
        galleryStore.showGalleryPage();
    }

    /**
     *
     */
    function applyDateFilter() {
        if (dateRange.value?.start) {
            const s = dateRange.value.start;
            feedTable.value.dateFrom = dayjs(`${s.year}-${s.month}-${s.day}`).startOf('day').toISOString();
        } else {
            feedTable.value.dateFrom = '';
        }
        if (dateRange.value?.end) {
            const e = dateRange.value.end;
            feedTable.value.dateTo = dayjs(`${e.year}-${e.month}-${e.day}`).endOf('day').toISOString();
        } else {
            feedTable.value.dateTo = '';
        }
        popoverOpen.value = false;
        feedTableLookup();
    }

    /**
     *
     */
    function clearDateFilter() {
        dateRange.value = undefined;
        feedTable.value.dateFrom = '';
        feedTable.value.dateTo = '';
        popoverOpen.value = false;
        feedTableLookup();
    }

    const feedRef = ref(null);

    const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

    /**
     *
     * @param row
     */
    function getFeedRowId(row) {
        if (row?.id != null) return `id:${row.id}`;
        if (row?.rowId != null) return `row:${row.rowId}`;

        const type = row?.type ?? '';
        const createdAt = row?.created_at ?? row?.createdAt ?? '';
        const userId = row?.userId ?? row?.senderUserId ?? '';
        const location = row?.location ?? row?.details?.location ?? '';
        const message = row?.message ?? '';

        return `${type}:${createdAt}:${userId}:${location}:${message}`;
    }

    const { table, pagination } = useVrcxVueTable({
        get data() {
            return feedTableData.value;
        },
        persistKey: 'feed',
        columns: baseColumns,
        getRowId: getFeedRowId,
        enableExpanded: true,
        getRowCanExpand: () => true,
        initialSorting: [],
        initialExpanded: {},
        initialPagination: {
            pageIndex: 0,
            pageSize: appearanceSettingsStore.tablePageSize
        },
        tableOptions: {
            autoResetExpanded: false,
            autoResetPageIndex: false
        }
    });

    const totalItems = computed(() => {
        const length = table.getFilteredRowModel().rows.length;
        const max = vrcxStore.maxTableSize;
        return length > max && length < max + 51 ? max : length;
    });

    const handlePageSizeChange = (size) => {
        pagination.value = {
            ...pagination.value,
            pageIndex: 0,
            pageSize: size
        };
    };

    const activeFilterSelection = computed(() => {
        const filter = feedTable.value.filter;
        if (!Array.isArray(filter) || filter.length === 0) {
            return ['All'];
        }
        return filter;
    });

    /**
     *
     * @param value
     */
    function handleFeedFilterChange(value) {
        const selected = Array.isArray(value) ? value : [];
        const wasAll = activeFilterSelection.value.includes('All');
        const hasAll = selected.includes('All');
        const types = selected.filter((v) => v !== 'All');

        if (hasAll && !wasAll) {
            feedTable.value.filter = [];
        } else if (wasAll && types.length) {
            feedTable.value.filter = types;
        } else {
            feedTable.value.filter = types.length === feedFilterTypes.length ? [] : types.length ? types : [];
        }
        feedTableLookup();
    }
</script>

<style scoped>
    .feed :deep(.x-text-removed) {
        text-decoration: line-through;
        color: #ff0000;
        background-color: rgba(255, 0, 0, 0.2);
        padding: 2px 2px;
        border-radius: var(--radius-xs);
    }

    .feed :deep(.x-text-added) {
        color: rgb(35, 188, 35);
        background-color: rgba(76, 255, 80, 0.2);
        padding: 2px 2px;
        border-radius: var(--radius-xs);
    }

    .feed-drop-overlay {
        pointer-events: none;
    }
</style>

