<template>
    <Dialog v-model:open="isOpen">
        <DialogContent class="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader class="shrink-0 border-b border-border/60 px-5 py-4">
                <DialogTitle class="flex items-center gap-2">
                    <MapPin class="size-4 text-muted-foreground" />
                    <span>{{ t('view.charts.two_person_relationship.shared_world_ranking') }}</span>
                    <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {{ items.length }}
                    </span>
                </DialogTitle>
            </DialogHeader>

            <div class="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
                <div v-if="items.length === 0" class="px-3 py-10 text-center text-sm text-muted-foreground">
                    {{ t('view.charts.two_person_relationship.no_data') }}
                </div>

                <div v-else class="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60">
                    <button
                        v-for="(item, index) in items"
                        :key="item.worldId"
                        type="button"
                        class="group flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/60 sm:px-4"
                        @click="selectWorld(item)">
                        <span
                            :class="[
                                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                                rankClass(index)
                            ]">
                            {{ index + 1 }}
                        </span>

                        <Location :location="item.worldId" :link="false" class="min-w-0 flex-1 text-sm" />

                        <span class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                            <span>{{
                                t('view.charts.two_person_relationship.shared_world_ranking_visits', {
                                    count: item.visitCount
                                })
                            }}</span>
                        </span>
                    </button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { MapPin } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';

    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import Location from '@/components/Location.vue';

    defineProps({
        items: {
            type: Array,
            default: () => []
        }
    });

    const isOpen = defineModel('open', { type: Boolean, default: false });
    const emit = defineEmits(['select']);
    const { t } = useI18n();

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
