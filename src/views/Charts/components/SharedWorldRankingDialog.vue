<template>
    <Dialog v-model:open="isOpen">
        <DialogContent class="x-dialog flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader class="shrink-0 border-b border-border/60 px-5 py-4">
                <DialogTitle class="flex items-center gap-2">
                    <MapPin class="size-4 text-muted-foreground" />
                    <span>{{ t('view.charts.two_person_relationship.shared_world_ranking') }}</span>
                    <span
                        class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {{ total || items.length }}
                    </span>
                </DialogTitle>
            </DialogHeader>

            <div
                ref="scrollViewportRef"
                data-testid="shared-world-ranking-scroll"
                class="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3"
                @scroll.passive="handleScroll">
                <div
                    v-if="items.length === 0 && !loading"
                    class="px-3 py-10 text-center text-sm text-muted-foreground">
                    {{ t('view.charts.two_person_relationship.no_data') }}
                </div>

                <div
                    v-else
                    class="relative overflow-hidden rounded-lg border border-border/60"
                    :style="virtualContainerStyle">
                    <template v-for="virtualItem in virtualItems" :key="virtualItem.key">
                        <button
                            type="button"
                            class="group absolute left-0 top-0 flex w-full min-w-0 items-center gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors hover:bg-accent/60 sm:px-4"
                            :data-index="virtualItem.index"
                            :ref="virtualizer.measureElement"
                            :style="{ transform: `translateY(${virtualItem.start}px)` }"
                            @click="selectWorld(items[virtualItem.index])">
                            <span
                                :class="[
                                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                                    rankClass(virtualItem.index)
                                ]">
                                {{ virtualItem.index + 1 }}
                            </span>

                            <Location
                                :location="items[virtualItem.index].worldId"
                                :link="false"
                                class="min-w-0 flex-1 text-sm" />

                            <span class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                                <span>{{
                                    t('view.charts.two_person_relationship.shared_world_ranking_visits', {
                                        count: items[virtualItem.index].visitCount
                                    })
                                }}</span>
                            </span>
                        </button>
                    </template>
                </div>

                <div v-if="loading" class="px-3 py-3 text-center text-xs text-muted-foreground">
                    {{ t('view.friends_locations.loading_more') }}
                </div>

                <div
                    v-else-if="error"
                    class="flex items-center justify-center gap-2 px-3 py-3 text-xs text-destructive">
                    <span>{{ t('view.charts.two_person_relationship.shared_world_ranking_load_failed') }}</span>
                    <button
                        type="button"
                        data-testid="shared-world-ranking-retry"
                        class="rounded-md px-2 py-1 font-medium text-foreground underline-offset-2 hover:underline"
                        @click="emit('retry')">
                        {{ t('quick_launch.retry') }}
                    </button>
                </div>

                <div
                    v-else-if="items.length > 0 && !hasMore"
                    class="px-3 py-3 text-center text-xs text-muted-foreground">
                    {{ t('common.no_more') }}
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, nextTick, ref, watch } from 'vue';
    import { MapPin } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';
    import { useVirtualizer } from '@tanstack/vue-virtual';

    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import Location from '@/components/Location.vue';

    const props = defineProps({
        items: {
            type: Array,
            default: () => []
        },
        total: {
            type: Number,
            default: 0
        },
        hasMore: {
            type: Boolean,
            default: false
        },
        loading: {
            type: Boolean,
            default: false
        },
        error: {
            type: Boolean,
            default: false
        }
    });

    const isOpen = defineModel('open', { type: Boolean, default: false });
    const emit = defineEmits(['select', 'load-more', 'retry']);
    const { t } = useI18n();
    const scrollViewportRef = ref(null);
    const LOAD_AHEAD_PX = 260;

    function handleScroll(event) {
        const element = event.currentTarget;
        if (!element) return;
        if (
            props.hasMore &&
            !props.loading &&
            !props.error &&
            element.scrollTop + element.clientHeight >= element.scrollHeight - LOAD_AHEAD_PX
        ) {
            emit('load-more');
        }
    }

    const virtualizer = useVirtualizer(
        computed(() => ({
            count: props.items.length,
            getScrollElement: () => scrollViewportRef.value,
            estimateSize: () => 52,
            getItemKey: (index) => props.items[index]?.worldId ?? index,
            overscan: 6
        }))
    );

    const virtualItems = computed(() => virtualizer.value?.getVirtualItems?.() ?? []);
    const virtualContainerStyle = computed(() => ({
        height: `${virtualizer.value?.getTotalSize?.() ?? 0}px`
    }));

    watch(
        [() => props.items, isOpen],
        () => {
            nextTick(() => virtualizer.value?.measure?.());
        },
        { immediate: true }
    );

    function rankClass(index) {
        if (index === 0) return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400';
        if (index === 1) return 'bg-zinc-400/20 text-zinc-600 dark:text-zinc-300';
        if (index === 2) return 'bg-orange-500/15 text-orange-600 dark:text-orange-400';
        return 'bg-muted text-muted-foreground';
    }

    function selectWorld(item) {
        if (!item?.latestLocation) return;
        emit('select', item.latestLocation);
        isOpen.value = false;
    }
</script>
