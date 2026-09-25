<template>
    <div id="chart" class="x-container flex h-full min-h-0 flex-col">
        <div ref="containerRef" class="flex min-h-0 flex-1 flex-col pt-4">
            <BackToTop :target="containerRef" :right="30" :bottom="30" :teleport="false" />

            <!-- Header bar (consistent with InstanceActivity) -->
            <div class="options-container mt-0 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 mb-4 in-[.is-compact-table]:mb-2! in-[.is-comfortable-table]:mb-3!">
                    <span class="shrink-0">{{ t('view.charts.relationship_timeline.header') }}</span>
                    <HoverCard>
                        <HoverCardTrigger as-child>
                            <Info class="ml-1 text-xs opacity-70" />
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" class="w-80">
                            <div class="text-xs">
                                {{ t('view.charts.relationship_timeline.tips.description') }}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                    <div class="flex items-center justify-between px-0.5 h-[30px] in-[.is-compact-table]:h-[24px]! in-[.is-comfortable-table]:h-[26px]!">
                        <span class="shrink-0 text-sm in-[.is-compact-table]:text-xs!">
                            {{ t('view.charts.relationship_timeline.settings.top_friends') }}
                        </span>
                        <div class="flex items-center gap-2 ml-3">
                            <Slider
                                v-model="friendCountModel"
                                :max="10"
                                :min="1"
                                :step="1"
                                class="w-24"
                                aria-label="Top friends count"
                                @valueCommit="debouncedRebuildChart" />
                            <span class="w-4 text-right text-xs tabular-nums text-muted-foreground">
                                {{ friendCount }}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center justify-between px-0.5 h-[30px] in-[.is-compact-table]:h-[24px]! in-[.is-comfortable-table]:h-[26px]! gap-2">
                        <span class="shrink-0 text-sm in-[.is-compact-table]:text-xs!">
                            {{ t('view.charts.relationship_timeline.settings.show_others') }}
                        </span>
                        <Switch
                            v-model="showOthers"
                            @update:modelValue="debouncedRebuildChart" />
                    </div>
                    <div class="flex items-center justify-between px-0.5 h-[30px] in-[.is-compact-table]:h-[24px]! in-[.is-comfortable-table]:h-[26px]! gap-2">
                        <span class="shrink-0 text-sm in-[.is-compact-table]:text-xs!">
                            {{ t('view.charts.relationship_timeline.settings.show_friends_only') }}
                        </span>
                        <Switch
                            v-model="showFriendsOnly"
                            @update:modelValue="debouncedRebuildChart" />
                    </div>
                    <!-- Refresh button -->
                    <TooltipWrapper :content="t('view.charts.relationship_timeline.refresh')" side="top">
                        <Button
                            class="rounded-full mr-1.5"
                            size="icon"
                            variant="ghost"
                            :disabled="isLoading"
                            @click="loadData">
                            <RefreshCcw :class="['size-4', isLoading ? 'animate-spin' : '']" />
                        </Button>
                    </TooltipWrapper>
                </div>
            </div>

            <!-- Loading -->
            <div v-if="isLoading" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>

            <!-- No data -->
            <div
                v-else-if="!hasData"
                class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <DataTableEmpty type="nodata" />
            </div>

            <!-- Chart area -->
            <div v-else class="relative mt-2 flex min-h-0 flex-1 flex-col">
                <!-- ECharts canvas -->
                <div
                    ref="chartDomRef"
                    class="w-full min-h-0 flex-1"
                    role="img"
                    aria-label="Relationship timeline stacked area chart"></div>

                <!-- Bottom-right: non-linear granularity scale control -->
                <div class="flex items-center justify-end gap-2 px-4 py-1">
                    <ZoomOut class="size-3.5 shrink-0 text-muted-foreground" />
                    <input
                        type="range"
                        v-model.number="scaleSlider"
                        min="0"
                        max="100"
                        step="1"
                        class="w-28 accent-primary"
                        @change="debouncedRebuildChart" />
                    <ZoomIn class="size-3.5 shrink-0 text-muted-foreground" />
                    <span class="w-20 text-right text-xs tabular-nums text-muted-foreground">
                        {{ bucketDays }}
                        {{ t('view.charts.relationship_timeline.days_per_unit') }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    defineOptions({ name: 'ChartsRelationshipTimeline' });

    import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { Info, RefreshCcw, ZoomIn, ZoomOut } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import * as echarts from 'echarts';

    import BackToTop from '@/components/BackToTop.vue';
    import { Button } from '@/components/ui/button';
    import { DataTableEmpty } from '@/components/ui/data-table';
    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import { Slider } from '@/components/ui/slider';
    import { Switch } from '@/components/ui/switch';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';

    import { database } from '../../../services/database';
    import {
        aggregateFriendDaysToBuckets,
        buildPerBucketTopNPercentageSeries,
        computeZoomRange
    } from './relationshipTimelineUtils';
    import { debounce } from '../../../shared/utils';
    import { useAppearanceSettingsStore, useFriendStore } from '../../../stores';

    // ─── i18n ──────────────────────────────────────────────────────────────────
    const { t } = useI18n();

    // ─── Stores ────────────────────────────────────────────────────────────────
    const appearanceStore = useAppearanceSettingsStore();
    const { isDarkMode } = storeToRefs(appearanceStore);
    const friendStore = useFriendStore();
    const { friends } = storeToRefs(friendStore);

    // ─── Refs ──────────────────────────────────────────────────────────────────
    const containerRef = ref(null);
    const chartDomRef = ref(null);
    const isLoading = ref(false);
    /** Raw per-friend per-day rows from the database */
    const rawRows = ref([]);

    // ─── Settings ──────────────────────────────────────────────────────────────
    /** Number of top friends to show (rest go into "Others") */
    const friendCount = ref(5);
    /** Slider model: Reka UI Slider uses an array */
    const friendCountModel = computed({
        get: () => [friendCount.value],
        set: (v) => { friendCount.value = v[0]; }
    });
    /** Whether to include the "Others" band in the chart */
    const showOthers = ref(false);
    /** Whether to only show current friends (exclude non-friends) */
    const showFriendsOnly = ref(false);
    /**
     * Non-linear scale slider (0-100).
     * Mapped to bucketDays = round(90 ^ (slider/100)).
     * - 0  →  1 day/bucket
     * - 51 → ~10 days/bucket (default)
     * - 100 → 90 days/bucket
     */
    const scaleSlider = ref(51);
    const bucketDays = computed(() =>
        Math.max(1, Math.round(Math.pow(90, scaleSlider.value / 100)))
    );

    // ─── Derived ───────────────────────────────────────────────────────────────
    const hasData = computed(() => rawRows.value.length > 0);
    const dataZoomRange = ref(null);

    // ─── Color palette (consistent with MutualFriends) ─────────────────────────
    const COLOR_PALETTE = [
        '#5470c6',
        '#91cc75',
        '#fac858',
        '#ee6666',
        '#73c0de',
        '#3ba272',
        '#fc8452',
        '#9a60b4',
        '#ea7ccc',
        '#17c0ac'
    ];
    const DEFAULT_VISIBLE_BUCKETS = 10;

    // ─── Friend display-name lookup ────────────────────────────────────────────
    function getFriendDisplayName(userId, fallbackName) {
        const friend = friends.value?.get(userId);
        return friend?.displayName || fallbackName || userId;
    }

    // ─── Performance: pre-process rawRows into per-friend per-day structure ────
    /**
     * Map<userId, { displayName: string, days: Map<epochDay, { totalTime: number, joinCount: number }> }>
     * Re-computed only when rawRows changes (not on every slider move).
     */
    const perFriendDays = ref(new Map());

    watch(
        rawRows,
        (rows) => {
            const map = new Map();
            for (const row of rows) {
                // Parse date string to epoch day (integer) once here, not on every rebuild
                const epochDay = Math.floor(
                    new Date(row.day + 'T00:00:00Z').getTime() / 86400000
                );
                let entry = map.get(row.userId);
                if (!entry) {
                    entry = { displayName: row.displayName, days: new Map() };
                    map.set(row.userId, entry);
                }
                const prev = entry.days.get(epochDay) || { totalTime: 0, joinCount: 0 };
                entry.days.set(epochDay, {
                    totalTime: prev.totalTime + row.totalTime,
                    joinCount: prev.joinCount + row.joinCount
                });
            }
            perFriendDays.value = map;
        },
        { immediate: true }
    );

    // ─── Chart data computation ────────────────────────────────────────────────
    function buildChartData() {
        let data = perFriendDays.value;
        if (showFriendsOnly.value) {
            const filtered = new Map();
            for (const [userId, entry] of data.entries()) {
                if (friends.value.has(userId)) {
                    filtered.set(userId, entry);
                }
            }
            data = filtered;
        }
        const aggregation = aggregateFriendDaysToBuckets(data, bucketDays.value);
        return buildPerBucketTopNPercentageSeries({
            aggregation,
            friendCount: friendCount.value,
            showOthers: showOthers.value,
            resolveDisplayName: getFriendDisplayName,
            othersName: t('view.charts.relationship_timeline.others'),
            colorPalette: COLOR_PALETTE
        });
    }

    // ─── ECharts instance management ──────────────────────────────────────────
    let echartsInstance = null;
    let resizeObserver = null;
    /** Cached DOM element so we can remove listeners even after the ref is cleared */
    let chartDomElement = null;
    /** Index of the series currently under the cursor (-1 = none) */
    let currentHoveredSeriesIndex = -1;

    function disposeChart() {
        if (chartDomElement) {
            chartDomElement.removeEventListener('mousemove', onChartMouseMove);
            chartDomElement.removeEventListener('mouseleave', onChartMouseLeave);
            chartDomElement = null;
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (echartsInstance) {
            echartsInstance.dispose();
            echartsInstance = null;
        }
    }

    /**
     * Compute which series names should appear in the legend based on whether
     * they have any non-zero values in the currently zoomed x-index range.
     * Returns an array of series names to pass as legend.data.
     */
    function computeLegendData(series, start, end, bucketCount) {
        if (!series || !bucketCount) return series?.map((s) => s.name) || [];
        const startIdx = Math.floor((start / 100) * (bucketCount - 1));
        const endIdx = Math.ceil((end / 100) * (bucketCount - 1));
        return series
            .filter(
                (s) =>
                    Array.isArray(s.data) &&
                    s.data.some((v, i) => i >= startIdx && i <= endIdx && Number(v) > 0)
            )
            .map((s) => s.name);
    }

    function buildEChartsOption(chartData) {
        const { xLabels, series, bucketCount } = chartData;
        const isDark = isDarkMode.value;
        const zoomRange = computeZoomRange(
            bucketCount,
            dataZoomRange.value,
            DEFAULT_VISIBLE_BUCKETS
        );

        const legendData = computeLegendData(
            series,
            zoomRange.start,
            zoomRange.end,
            bucketCount
        );

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'line',
                    lineStyle: { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }
                },
                formatter(params) {
                    const header = `<div style="margin-bottom:6px;font-weight:600;font-size:12px">${params[0]?.axisValue}</div>`;
                    // Sort descending by value, skip zero entries
                    const items = params
                        .filter((p) => p.value > 0)
                        .sort((a, b) => b.value - a.value);
                    if (!items.length) return '';
                    const rows = items
                        .map((p) => {
                            const isHovered = p.seriesIndex === currentHoveredSeriesIndex;
                            const rowBg = isHovered ? 'background:rgba(128,128,128,0.15);' : '';
                            const nameBold = isHovered ? 'font-weight:700;' : '';
                            const valWeight = isHovered ? '700' : '600';
                            return (
                                `<div style="display:flex;align-items:center;gap:6px;padding:2px 4px;border-radius:var(--radius-xs);${rowBg}">` +
                                `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0"></span>` +
                                `<span style="flex:1;font-size:12px;${nameBold}">${p.seriesName}</span>` +
                                `<span style="font-size:12px;font-weight:${valWeight};tabular-nums">${p.value.toFixed(1)}%</span>` +
                                `</div>`
                            );
                        })
                        .join('');
                    return header + rows;
                }
            },
            legend: {
                top: 0,
                type: 'scroll',
                height: 66,
                textStyle: { color: isDark ? '#ccc' : '#333', fontSize: 11 },
                data: legendData
            },
            grid: {
                left: '3%',
                right: '2%',
                top: 82,
                bottom: 80,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: xLabels,
                boundaryGap: false,
                axisLabel: {
                    rotate: 30,
                    fontSize: 10,
                    color: isDark ? '#bbb' : '#555'
                },
                axisLine: { lineStyle: { color: isDark ? '#444' : '#ddd' } }
            },
            yAxis: {
                type: 'value',
                max: 100,
                axisLabel: {
                    formatter: '{value}%',
                    color: isDark ? '#bbb' : '#555',
                    fontSize: 11
                },
                splitLine: {
                    lineStyle: { color: isDark ? '#333' : '#eee' }
                }
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    xAxisIndex: [0],
                    start: zoomRange.start,
                    end: zoomRange.end,
                    bottom: 5,
                    height: 20,
                    borderColor: 'transparent',
                    fillerColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    handleStyle: { color: isDark ? '#888' : '#aaa' }
                },
                {
                    type: 'inside',
                    xAxisIndex: [0],
                    start: zoomRange.start,
                    end: zoomRange.end
                }
            ],
            series
        };
    }

    /**
     * Lightweight legend-visibility update triggered on pan/zoom.
     * Avoids a full chart rebuild — only mutates legend.data.
     */
    function updateLegendVisibility(start, end) {
        if (!echartsInstance) return;
        const option = echartsInstance.getOption();
        if (!option?.series?.length) return;
        const bucketCount = option.xAxis?.[0]?.data?.length || 0;
        const legendData = computeLegendData(option.series, start, end, bucketCount);
        echartsInstance.setOption({ legend: [{ data: legendData }] });
    }

    function handleDataZoom(event) {
        let start = null;
        let end = null;
        if (Array.isArray(event?.batch) && event.batch.length > 0) {
            start = event.batch[0]?.start;
            end = event.batch[0]?.end;
        } else {
            start = event?.start;
            end = event?.end;
        }
        if (Number.isFinite(start) && Number.isFinite(end)) {
            dataZoomRange.value = { start, end };
            updateLegendVisibility(start, end);
        }
    }

    /**
     * DOM mousemove handler: determines which stacked series is under the
     * cursor and dispatches an ECharts highlight action so highlighting
     * works even during purely horizontal mouse movement.
     */
    function onChartMouseMove(event) {
        if (!echartsInstance || !chartDomElement) return;
        const option = echartsInstance.getOption();
        if (!option?.series?.length) return;

        const rect = chartDomElement.getBoundingClientRect();
        const pixelX = event.clientX - rect.left;
        const pixelY = event.clientY - rect.top;

        let xDataValue, yDataValue;
        try {
            xDataValue = echartsInstance.convertFromPixel({ xAxisIndex: 0 }, pixelX);
            yDataValue = echartsInstance.convertFromPixel({ yAxisIndex: 0 }, pixelY);
        } catch (_conversionError) {
            // convertFromPixel throws when the chart is not ready or coords are out of range
            return;
        }

        // Outside the chart grid area
        if (!Number.isFinite(xDataValue) || !Number.isFinite(yDataValue)) {
            if (currentHoveredSeriesIndex !== -1) {
                currentHoveredSeriesIndex = -1;
                echartsInstance.dispatchAction({ type: 'downplay' });
            }
            return;
        }

        const xLabelsLength = option.xAxis[0]?.data?.length || 0;
        const xIndex = Math.round(Math.max(0, Math.min(xDataValue, xLabelsLength - 1)));

        // Walk through series bottom-to-top (stack order = series array order).
        // Skip series that are deselected (hidden via legend).
        const legendSelected = option.legend?.[0]?.selected || {};
        const allSeries = option.series;
        let cumulative = 0;
        let foundIdx = -1;
        for (let i = 0; i < allSeries.length; i++) {
            if (legendSelected[allSeries[i].name] === false) continue;
            const rawVal = allSeries[i].data?.[xIndex];
            const value =
                rawVal != null && typeof rawVal === 'object'
                    ? Number(rawVal.value) || 0
                    : Number(rawVal) || 0;
            cumulative += value;
            if (foundIdx === -1 && yDataValue <= cumulative) {
                foundIdx = i;
            }
        }

        if (foundIdx !== currentHoveredSeriesIndex) {
            currentHoveredSeriesIndex = foundIdx;
            if (foundIdx >= 0) {
                echartsInstance.dispatchAction({ type: 'highlight', seriesIndex: foundIdx });
            } else {
                echartsInstance.dispatchAction({ type: 'downplay' });
            }
        }
    }

    function onChartMouseLeave() {
        if (currentHoveredSeriesIndex !== -1) {
            currentHoveredSeriesIndex = -1;
            echartsInstance?.dispatchAction({ type: 'downplay' });
        }
    }

    function rebuildChart() {
        if (!echartsInstance || !hasData.value) return;
        const chartData = buildChartData();
        if (!chartData) return;
        echartsInstance.setOption(buildEChartsOption(chartData), { notMerge: true });
    }

    /**
     * Debounced version of rebuildChart — waits 0.5 seconds after the last
     * settings change before performing the potentially expensive rebuild.
     */
    const debouncedRebuildChart = debounce(rebuildChart, 500);

    function initChart() {
        if (!chartDomRef.value) return;
        disposeChart();

        chartDomElement = chartDomRef.value;
        echartsInstance = echarts.init(
            chartDomElement,
            isDarkMode.value ? 'dark' : null,
            { renderer: 'canvas' }
        );

        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                echartsInstance?.resize({ width: entry.contentRect.width });
            }
        });
        resizeObserver.observe(chartDomElement);

        const chartData = buildChartData();
        if (chartData) {
            echartsInstance.setOption(buildEChartsOption(chartData), { notMerge: true });
        }
        echartsInstance.on('datazoom', handleDataZoom);

        chartDomElement.addEventListener('mousemove', onChartMouseMove);
        chartDomElement.addEventListener('mouseleave', onChartMouseLeave);
    }

    // ─── Data loading ─────────────────────────────────────────────────────────
    async function loadData() {
        isLoading.value = true;
        rawRows.value = [];
        try {
            rawRows.value = await database.getRelationshipTimelineData();
        } catch (err) {
            console.error('[RelationshipTimeline] Failed to load data', err);
        } finally {
            isLoading.value = false;
        }
    }

    // ─── Watchers ─────────────────────────────────────────────────────────────
    watch(isDarkMode, () => {
        if (echartsInstance) {
            disposeChart();
            initChart();
        }
    });

    watch(hasData, (val) => {
        if (val) {
            // Use nextTick so Vue renders the chart DOM before initializing
            nextTick(() => initChart());
        }
    });

    // ─── Lifecycle ────────────────────────────────────────────────────────────
    onMounted(() => {
        loadData();
    });

    onBeforeUnmount(() => {
        disposeChart();
    });
</script>
