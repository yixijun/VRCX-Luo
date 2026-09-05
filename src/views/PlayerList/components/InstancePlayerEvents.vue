<template>
    <section
        class="instance-player-events flex h-full min-h-0 flex-col overflow-hidden"
        data-testid="instance-player-events">
        <div
            class="instance-player-events__toolbar flex shrink-0 items-center gap-2 border-b border-border px-2 py-1"
            :aria-label="t('view.player_list.presence.filters_label')">
            <span class="shrink-0 text-xs font-medium text-muted-foreground">
                {{ t('view.player_list.presence.title') }}
            </span>

            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                :model-value="filter"
                class="min-w-0 shrink-0"
                @update:model-value="handleFilterChange">
                <ToggleGroupItem value="all" class="h-7 gap-1 px-2 text-xs">
                    {{ t('view.player_list.presence.all') }}
                    <span class="text-[0.6875rem] tabular-nums text-muted-foreground">{{ allCount }}</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="friends" class="h-7 gap-1 px-2 text-xs">
                    {{ t('view.player_list.presence.friends') }}
                    <span class="text-[0.6875rem] tabular-nums text-muted-foreground">{{ friendsCount }}</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="strangers" class="h-7 gap-1 px-2 text-xs">
                    {{ t('view.player_list.presence.strangers') }}
                    <span class="text-[0.6875rem] tabular-nums text-muted-foreground">{{ strangersCount }}</span>
                </ToggleGroupItem>
            </ToggleGroup>

            <Button
                variant="ghost"
                size="icon"
                class="ml-auto size-7 shrink-0"
                :disabled="loading"
                :aria-label="t('view.player_list.presence.refresh')"
                :title="t('view.player_list.presence.refresh')"
                data-testid="refresh-player-events"
                @click="loadEvents">
                <RefreshCw class="size-3.5" :class="loading && 'opacity-50'" />
            </Button>
        </div>

        <div class="instance-player-events__list min-h-0 flex-1 overflow-y-auto" role="list">
            <div v-if="loading" class="px-3 py-2 text-xs text-muted-foreground">
                {{ t('view.player_list.presence.loading') }}
            </div>
            <div v-else-if="loadError" class="px-3 py-2 text-xs text-destructive">
                {{ t('view.player_list.presence.load_failed') }}
            </div>
            <div v-else-if="filteredEvents.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
                {{ t('view.player_list.presence.empty') }}
            </div>

            <button
                v-for="event in filteredEvents"
                :key="eventKey(event)"
                type="button"
                class="instance-player-events__row group flex w-full items-center gap-2 border-b border-border/60 px-2 py-1 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                role="listitem"
                @click="lookupUser(event)">
                <time
                    class="w-23 shrink-0 tabular-nums text-[0.6875rem] text-muted-foreground"
                    :datetime="event.created_at"
                    :title="formatDateFilter(event.created_at, 'long')">
                    {{ formatDateFilter(event.created_at, 'short') }}
                </time>

                <Badge
                    variant="outline"
                    class="h-5 w-13 shrink-0 justify-center gap-1 px-1 text-[0.6875rem]"
                    :class="event.type === 'OnPlayerJoined' ? 'text-emerald-400' : 'text-muted-foreground'">
                    <LogIn v-if="event.type === 'OnPlayerJoined'" class="size-3" />
                    <LogOut v-else class="size-3" />
                    {{ eventLabel(event) }}
                </Badge>

                <span class="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                    <UserIdentityInline
                        :user-id="event.userId"
                        :display-name="event.displayName || t('view.player_list.presence.unknown_player')"
                        avatar-class="size-5"
                        :hydrate-missing="false"
                        name-class="truncate" />
                    <span
                        v-if="isFriend(event)"
                        class="shrink-0 text-[0.6875rem] text-emerald-400"
                        :title="t('view.player_list.presence.friends')"
                        aria-hidden="true">
                        ●
                    </span>
                </span>
            </button>
        </div>
    </section>
</template>

<script setup>
    import { computed, ref, watch } from 'vue';
    import { LogIn, LogOut, RefreshCw } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';

    import { database } from '../../../services/database';
    import { lookupUser } from '../../../coordinators/userCoordinator';
    import { formatDateFilter } from '../../../shared/utils';
    import { useFriendStore } from '../../../stores';
    import UserIdentityInline from '../../../components/UserIdentityInline.vue';
    import { Badge } from '../../../components/ui/badge';
    import { Button } from '../../../components/ui/button';
    import { ToggleGroup, ToggleGroupItem } from '../../../components/ui/toggle-group';

    const props = defineProps({
        location: {
            type: String,
            default: ''
        }
    });

    const { t } = useI18n();
    const friendStore = useFriendStore();
    const filter = ref('all');
    const events = ref([]);
    const loading = ref(false);
    const loadError = ref(false);
    let requestId = 0;

    const eventRows = computed(() =>
        events.value.map((event) => ({
            ...event,
            isFriend: isFriend(event)
        }))
    );

    const allCount = computed(() => eventRows.value.length);
    const friendsCount = computed(() => eventRows.value.filter((event) => event.isFriend).length);
    const strangersCount = computed(() => eventRows.value.filter((event) => !event.isFriend).length);
    const filteredEvents = computed(() => {
        if (filter.value === 'friends') {
            return eventRows.value.filter((event) => event.isFriend);
        }
        if (filter.value === 'strangers') {
            return eventRows.value.filter((event) => !event.isFriend);
        }
        return eventRows.value;
    });

    function isFriend(event) {
        return Boolean(event?.userId && friendStore.friends?.has?.(event.userId));
    }

    function eventLabel(event) {
        return event?.type === 'OnPlayerJoined'
            ? t('view.player_list.presence.joined')
            : t('view.player_list.presence.left');
    }

    function eventKey(event) {
        return event?.rowId ?? `${event?.created_at ?? ''}:${event?.userId ?? ''}:${event?.type ?? ''}`;
    }

    function handleFilterChange(value) {
        if (['all', 'friends', 'strangers'].includes(value)) {
            filter.value = value;
        }
    }

    async function loadEvents() {
        const currentRequestId = ++requestId;
        const location = props.location?.trim?.() || '';

        if (!location) {
            events.value = [];
            loadError.value = false;
            loading.value = false;
            return;
        }

        loading.value = true;
        loadError.value = false;
        try {
            const rows = await database.getGameLogByLocation(location, ['OnPlayerJoined', 'OnPlayerLeft']);
            if (currentRequestId !== requestId) {
                return;
            }
            events.value = Array.isArray(rows)
                ? rows.filter((event) => event?.type === 'OnPlayerJoined' || event?.type === 'OnPlayerLeft')
                : [];
        } catch (error) {
            if (currentRequestId !== requestId) {
                return;
            }
            events.value = [];
            loadError.value = true;
            console.error('[InstancePlayerEvents] Failed to load room activity', error);
        } finally {
            if (currentRequestId === requestId) {
                loading.value = false;
            }
        }
    }

    watch(() => props.location, loadEvents, { immediate: true });

    defineExpose({ loadEvents });
</script>

<style scoped>
    .instance-player-events__toolbar {
        background: color-mix(in srgb, var(--background) 82%, var(--muted));
    }

    .instance-player-events__row:last-child {
        border-bottom-color: transparent;
    }

    .instance-player-events__row:active {
        background: var(--accent);
    }
</style>
