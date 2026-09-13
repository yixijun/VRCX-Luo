<template>
    <Popover v-model:open="open">
        <PopoverTrigger as-child>
            <Button
                variant="ghost"
                size="icon"
                class="size-8"
                :class="open && 'bg-accent text-accent-foreground'"
                :aria-pressed="open"
                :aria-label="buttonLabel"
                :title="buttonLabel"
                data-testid="toggle-player-events">
                <History class="size-4" />
            </Button>
        </PopoverTrigger>

        <PopoverContent
            side="bottom"
            align="end"
            :side-offset="8"
            class="w-96 max-w-[calc(100vw-2rem)] max-h-[var(--reka-popover-content-available-height)] overflow-hidden p-0"
            style="height: min(24rem, var(--reka-popover-content-available-height, 24rem))"
            data-testid="player-events-popover">
            <InstancePlayerEvents
                v-if="open"
                :location="props.location"
                :instance-start-time="props.instanceStartTime"
                class="h-full min-h-0" />
        </PopoverContent>
    </Popover>
</template>

<script setup>
    import { computed, ref } from 'vue';
    import { History } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';

    import { Button } from '../../../components/ui/button';
    import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
    import InstancePlayerEvents from './InstancePlayerEvents.vue';

    const props = defineProps({
        location: {
            type: String,
            default: ''
        },
        instanceStartTime: {
            type: [Number, String],
            default: null
        }
    });

    const { t } = useI18n();
    const open = ref(false);
    const buttonLabel = computed(() =>
        t(open.value ? 'view.player_list.presence.back_to_players' : 'view.player_list.presence.show')
    );
</script>
