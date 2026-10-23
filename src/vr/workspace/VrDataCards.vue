<template>
    <section class="vr-data-cards" aria-label="记录卡片" :aria-busy="loading">
        <div class="vr-record-tools">
            <span>{{ rows.length }} 条记录 · 本页</span>
            <button :aria-expanded="toolsOpen" @click="toolsOpen = !toolsOpen">
                <i class="ri-equalizer-line" /> 排序与字段
            </button>
        </div>
        <div v-if="toolsOpen" class="vr-record-options">
            <div class="vr-record-headers" aria-label="排序与批量操作">
                <template v-for="group in table.getHeaderGroups()" :key="group.id">
                    <div
                        v-for="header in group.headers.filter((item) => !item.isPlaceholder && !isSpacer(item.column))"
                        :key="header.id">
                        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                    </div>
                </template>
            </div>
            <div v-if="enableColumnVisibility" class="vr-record-columns">
                <label v-for="column in toggleableColumns" :key="column.id">
                    <input
                        type="checkbox"
                        :checked="column.getIsVisible()"
                        @change="column.toggleVisibility($event.target.checked)" />
                    {{ resolveHeaderLabel(column) }}
                </label>
            </div>
        </div>
        <div ref="scroller" class="vr-record-scroller" @scroll.passive="onScroll">
            <p v-if="loading" class="vr-record-loading" role="status">正在更新…</p>
            <ContextMenu v-for="row in visibleRows" :key="row.id">
                <ContextMenuTrigger as-child :disabled="!$slots['row-context-menu']">
                    <article
                        class="vr-record-card group/row"
                        :inert="loading || undefined"
                        :class="rowClass?.(row)"
                        :tabindex="onRowClick ? 0 : undefined"
                        @click="onRowClick?.(row)"
                        @keydown.enter.self.prevent="onRowClick?.(row)">
                        <div
                            v-for="cell in row.getVisibleCells().filter((item) => !isSpacer(item.column))"
                            :key="cell.id"
                            class="vr-record-field"
                            :class="{ 'vr-record-wide': isWide(cell.column) }">
                            <span v-if="cell.column.columnDef.meta?.label" class="vr-record-label">{{
                                resolveHeaderLabel(cell.column)
                            }}</span>
                            <div class="vr-record-value">
                                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                            </div>
                        </div>
                        <div
                            v-if="row.getIsExpanded() && (expandedRenderer || $slots.expanded)"
                            class="vr-record-expanded"
                            @click.stop>
                            <slot name="expanded" :row="row"
                                ><FlexRender :render="expandedRenderer" :props="{ row }"
                            /></slot>
                        </div>
                    </article>
                </ContextMenuTrigger>
                <slot v-if="$slots['row-context-menu']" name="row-context-menu" :row="row" />
            </ContextMenu>
            <slot v-if="!loading && !rows.length" name="empty"><DataTableEmpty :type="emptyType" /></slot>
            <button v-if="visibleRows.length < rows.length" class="vr-record-more" @click="showMore">
                继续显示 · {{ visibleRows.length }} / {{ rows.length }}
            </button>
        </div>
    </section>
</template>

<script setup>
    import { computed, nextTick, ref, watch } from 'vue';
    import { FlexRender } from '@tanstack/vue-table';
    import { ContextMenu, ContextMenuTrigger } from '../../components/ui/context-menu';
    import DataTableEmpty from '../../components/ui/data-table/DataTableEmpty.vue';
    import {
        getToggleableColumns,
        isSpacer,
        resolveHeaderLabel
    } from '../../components/ui/data-table/dataTableHelpers';

    const props = defineProps({
        table: { type: Object, required: true },
        loading: Boolean,
        emptyType: { type: String, default: 'nodata' },
        expandedRenderer: { type: Function, default: null },
        rowClass: { type: Function, default: null },
        onRowClick: { type: Function, default: null },
        enableColumnVisibility: { type: Boolean, default: true }
    });
    const toolsOpen = ref(false);
    const scroller = ref(null);
    const limit = ref(12);
    const rows = computed(() => props.table.getRowModel().rows || []);
    const visibleRows = computed(() => rows.value.slice(0, limit.value));
    const toggleableColumns = computed(() => getToggleableColumns(props.table.getAllLeafColumns()));
    const isWide = (column) =>
        column.columnDef.meta?.stretch || ['detail', 'actions', 'description', 'message', 'bio'].includes(column.id);
    function showMore() {
        limit.value += 12;
    }
    function onScroll(event) {
        const node = event.currentTarget;
        if (node.scrollHeight - node.scrollTop - node.clientHeight < 180) showMore();
    }
    watch(
        [
            () => props.table.getState().pagination?.pageIndex,
            () => props.table.getState().pagination?.pageSize,
            () => props.table.getState().sorting,
            () => props.table.getState().columnFilters,
            () => props.table.getState().globalFilter
        ],
        async () => {
            limit.value = 12;
            await nextTick();
            if (scroller.value) scroller.value.scrollTop = 0;
        }
    );
</script>

<style scoped>
    .vr-data-cards {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 160px;
        max-height: 72vh;
        overflow: hidden;
        gap: 12px;
    }
    .vr-record-tools {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }
    .vr-record-tools > span {
        color: var(--muted-foreground);
        font-size: 18px;
    }
    button {
        min-height: 52px;
        padding: 12px 20px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--card);
        color: var(--foreground);
        font-size: 20px;
    }
    button:hover {
        background: var(--accent);
        border-color: var(--primary);
    }
    button:focus-visible,
    article:focus-visible {
        outline: 3px solid var(--ring);
        outline-offset: -3px;
    }
    .vr-record-options {
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--card);
        max-height: 35vh;
        overflow: auto;
    }
    .vr-record-headers,
    .vr-record-columns {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
    }
    .vr-record-columns {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
    }
    .vr-record-columns label {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 52px;
        padding: 8px 12px;
        font-size: 20px;
    }
    .vr-record-columns input {
        width: 28px;
        min-height: 28px;
        height: 28px;
        accent-color: var(--primary);
    }
    .vr-record-scroller {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 3px;
    }
    .vr-record-card {
        flex-shrink: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 20px 28px;
        padding: 24px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: var(--card);
    }
    .vr-record-card:focus-within {
        border-color: var(--primary);
    }
    .vr-record-field {
        min-width: 0;
    }
    .vr-record-wide,
    .vr-record-expanded {
        grid-column: 1 / -1;
    }
    .vr-record-label {
        display: block;
        color: var(--muted-foreground);
        font-size: 16px;
        margin-bottom: 8px;
    }
    .vr-record-value {
        font-size: 22px;
        overflow-wrap: anywhere;
    }
    .vr-record-value :deep(.truncate) {
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
    }
    .vr-record-value :deep(.text-xs),
    .vr-record-value :deep(.text-sm) {
        font-size: 18px;
    }
    .vr-record-value :deep(button) {
        min-width: 48px;
        min-height: 48px;
    }
    .vr-record-value :deep(svg) {
        min-width: 22px;
        min-height: 22px;
    }
    .vr-record-expanded {
        border-top: 1px solid var(--border);
        padding-top: 20px;
    }
    .vr-record-more {
        flex-shrink: 0;
        width: 100%;
    }
    .vr-record-loading {
        color: var(--muted-foreground);
        font-size: 20px;
        padding: 16px;
    }
</style>
