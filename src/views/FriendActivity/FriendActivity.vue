<template>
    <div ref="pageRef" :class="['friend-activity-page x-container overflow-y-auto', embedded ? 'min-h-0 flex-1' : '']">
        <div v-if="!embedded" class="flex flex-wrap items-center gap-2 px-1 pb-3">
            <Button v-if="!embedded" variant="ghost" size="sm" class="mr-2" @click="goBack">
                <ArrowLeft class="size-4" />
                {{ t('dialog.user.activity.room_activity.back') }}
            </Button>
            <div v-if="!embedded" class="min-w-0 flex-1">
                <h1 class="truncate text-base font-semibold">
                    {{ t('dialog.user.activity.room_activity.page_title', { name: friendName }) }}
                </h1>
                <p class="text-xs text-muted-foreground">
                    {{ t('dialog.user.activity.room_activity.page_hint') }}
                </p>
            </div>
        </div>

        <div
            class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/40 px-3 py-2 shadow-sm">
            <div class="flex min-w-0 flex-wrap items-center gap-2.5">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-muted-foreground">{{
                        t('dialog.user.activity.period')
                    }}</span>
                    <Select v-model="selectedPeriod" :disabled="loading">
                        <SelectTrigger size="sm" class="w-36 bg-background/70">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">{{ t('dialog.user.activity.period_7') }}</SelectItem>
                            <SelectItem value="30">{{ t('dialog.user.activity.period_30') }}</SelectItem>
                            <SelectItem value="90">{{ t('dialog.user.activity.period_90') }}</SelectItem>
                            <SelectItem value="365">{{ t('dialog.user.activity.period_365') }}</SelectItem>
                            <SelectItem value="all">{{ t('dialog.user.activity.period_all') }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs">
                    <Switch v-model="showUnknown" class="scale-75" />
                    <span class="text-muted-foreground">{{
                        t('dialog.user.activity.room_activity.show_unknown')
                    }}</span>
                </div>
                <div class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs">
                    <Switch v-model="showSuspectedPrivate" class="scale-75" />
                    <span class="text-muted-foreground">
                        {{ t('dialog.user.activity.room_activity.show_suspected_private') }}
                    </span>
                </div>
            </div>
            <Button
                variant="outline"
                size="sm"
                class="shrink-0 bg-background/70"
                :disabled="loading"
                @click="refreshLatest">
                <Loader2 v-if="loading" class="mr-1.5 size-4 animate-spin" />
                <RefreshCw v-else class="mr-1.5 size-4" />
                {{ t('dialog.user.activity.refresh_hint') }}
            </Button>
        </div>

        <Button v-if="hasNewRecords" variant="secondary" size="sm" class="mx-auto mb-3 flex" @click="jumpToTop">
            {{ t('dialog.user.activity.room_activity.new_records') }}
        </Button>

        <div v-if="loading && records.length === 0" class="flex justify-center py-12">
            <Loader2 class="size-6 animate-spin text-muted-foreground" />
        </div>
        <div v-else-if="filteredRecords.length === 0" class="py-12">
            <DataTableEmpty type="nodata" />
        </div>
        <div v-else class="relative flex flex-col gap-3">
            <div class="friend-activity-timeline__line" aria-hidden="true" />
            <article
                v-for="record in filteredRecords"
                :key="record.id"
                class="relative flex min-w-0 gap-3"
                :class="record.isKnownLocation ? 'cursor-pointer' : ''"
                @click="openRecord(record)">
                <div
                    class="relative z-10 flex w-28 shrink-0 flex-col items-end gap-1 pt-3 pr-4 text-right text-xs sm:w-32">
                    <span class="whitespace-nowrap tabular-nums text-muted-foreground">
                        {{ formatDateTime(record.startAt) }}
                    </span>
                    <span class="whitespace-nowrap tabular-nums text-muted-foreground">
                        {{ formatDuration(record) }}
                    </span>
                </div>
                <div
                    class="relative z-10 min-w-0 flex-1 rounded-lg border border-border/80 bg-card px-4 py-3 shadow-sm transition-[background-color,border-color,box-shadow]"
                    :class="record.isKnownLocation ? 'hover:bg-accent/50' : ''">
                    <span
                        class="absolute -left-[1.125rem] top-4 size-2.5 rounded-full border-2 border-background"
                        :class="
                            record.privacyState === 'suspected-private'
                                ? 'bg-amber-500'
                                : record.privacyState === 'unknown'
                                  ? 'bg-muted-foreground'
                                  : 'bg-primary'
                        "
                        aria-hidden="true" />
                    <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="truncate text-[15px] font-medium leading-5">{{
                                    getRoomName(record)
                                }}</span>
                                <span
                                    class="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {{ getAccessLabel(record) }}
                                </span>
                                <span
                                    v-if="record.groupName"
                                    class="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {{ record.groupName }}
                                </span>
                            </div>
                            <div
                                class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{{ formatDateTime(record.startAt) }} — {{ formatEndTime(record) }}</span>
                            </div>
                        </div>
                        <div class="flex shrink-0 items-center gap-1.5">
                            <span
                                class="rounded-md border border-current/15 px-1.5 py-0.5 text-[10px]"
                                :class="getStateClass(record.privacyState)">
                                {{ getStateLabel(record) }}
                            </span>
                            <span
                                v-if="record.status === 'ask me' || record.status === 'busy'"
                                class="rounded-md border border-current/15 px-1.5 py-0.5 text-[10px]"
                                :class="
                                    record.status === 'busy'
                                        ? 'bg-red-500/12 text-red-700 dark:text-red-300'
                                        : 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                                ">
                                {{ getStatusLabel(record.status) }}
                            </span>
                            <Button
                                v-if="record.location"
                                variant="ghost"
                                size="icon-sm"
                                class="size-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                :title="t('dialog.user.activity.room_activity.toggle_instance_id')"
                                @click.stop="toggleInstanceId(record.id)">
                                <Copy class="size-3.5" />
                            </Button>
                        </div>
                    </div>
                    <div v-if="expandedRecordId === record.id && record.location" class="mt-2 flex items-center gap-2">
                        <code
                            class="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                            {{ record.location }}
                        </code>
                        <Button variant="outline" size="sm" class="shrink-0" @click.stop="copyInstanceId(record)">
                            {{ t('dialog.user.activity.room_activity.copy_instance_id') }}
                        </Button>
                    </div>
                </div>
            </article>

            <Button v-if="hasMore" variant="outline" class="mx-auto mt-2" :disabled="loadingMore" @click="loadMore">
                <Loader2 v-if="loadingMore" class="mr-1.5 size-4 animate-spin" />
                {{ loadingMore ? t('dialog.user.activity.room_activity.loading_more') : t('common.load_more') }}
            </Button>
            <div v-else class="border-t border-border/50 pt-2 text-center text-xs text-muted-foreground">
                {{ t('common.no_more') }}
            </div>
        </div>
    </div>
</template>

<script setup>
    import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import { ArrowLeft, Copy, Loader2, RefreshCw } from 'lucide-vue-next';

    import { Button } from '@/components/ui/button';
    import { DataTableEmpty } from '@/components/ui/data-table';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Switch } from '@/components/ui/switch';
    import { accessTypeLocaleKeyMap } from '@/shared/constants';
    import { prefersReducedMotion } from '@/shared/utils/motion';
    import { copyToClipboard, parseLocation, timeToText, translateAccessType } from '@/shared/utils';
    import { getFriendActivityCurrentState, loadFriendActivityPage } from '@/services/friendActivity';
    import { useFriendStore, useUserStore } from '@/stores';
    import { useWorldStore } from '@/stores/world';
    import { showWorldDialog } from '@/coordinators/worldCoordinator';

    const props = defineProps({
        userId: { type: String, default: '' },
        initialPeriod: { type: String, default: '' },
        embedded: { type: Boolean, default: false }
    });
    const emit = defineEmits(['close']);

    const { t, locale } = useI18n();
    const route = useRoute();
    const router = useRouter();
    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const worldStore = useWorldStore();
    const { cachedUsers } = storeToRefs(userStore);

    const pageRef = ref(null);
    const normalizePeriod = (value) => (['7', '30', '90', '365', 'all'].includes(String(value)) ? String(value) : '30');
    const selectedPeriod = ref(normalizePeriod(props.initialPeriod || route.query.period));
    const records = ref([]);
    const loading = ref(false);
    const loadingMore = ref(false);
    const hasMore = ref(false);
    const cursor = ref(null);
    const hasNewRecords = ref(false);
    const showUnknown = ref(true);
    const showSuspectedPrivate = ref(true);
    const expandedRecordId = ref('');
    const liveNow = ref(Date.now());
    let requestId = 0;
    let liveTimer = null;

    const userId = computed(() => String(props.userId || route.params.id || ''));
    const friendRef = computed(
        () => cachedUsers.value.get(userId.value) || friendStore.friends.get(userId.value)?.ref || null
    );
    const friendName = computed(() => friendRef.value?.displayName || userId.value || t('dialog.user.info.header'));
    const filteredRecords = computed(() =>
        records.value.filter((record) => {
            if (record.privacyState === 'unknown' && !showUnknown.value) return false;
            if (record.privacyState === 'suspected-private' && !showSuspectedPrivate.value) return false;
            return true;
        })
    );
    const rangeDays = computed(() => (selectedPeriod.value === 'all' ? 0 : Number(selectedPeriod.value)));

    function getCurrentSession() {
        const location = friendRef.value?.location || '';
        const worldId = parseLocation(location).worldId;
        const worldName = worldStore.cachedWorlds.get(worldId)?.name || '';
        return getFriendActivityCurrentState(friendRef.value, worldName, '', liveNow.value);
    }

    async function loadPage({ reset = true, silent = false } = {}) {
        const currentRequestId = ++requestId;
        if (reset) {
            if (!silent) loading.value = true;
        } else {
            loadingMore.value = true;
        }
        try {
            const result = await loadFriendActivityPage({
                userId: userId.value,
                rangeDays: rangeDays.value,
                beforeAt: reset ? null : cursor.value,
                limit: 25,
                ...(reset ? getCurrentSession() : { currentSession: null, unknownTailStartAt: null }),
                now: () => liveNow.value
            });
            if (currentRequestId !== requestId) return result;
            if (reset) {
                records.value = result.items;
            } else {
                const existing = new Set(records.value.map((record) => record.id));
                records.value = [...records.value, ...result.items.filter((record) => !existing.has(record.id))];
            }
            cursor.value = result.nextBeforeAt;
            hasMore.value = result.hasMore && result.items.length > 0;
            return result;
        } finally {
            if (currentRequestId === requestId) {
                loading.value = false;
                loadingMore.value = false;
            }
        }
    }

    async function refreshLatest() {
        const previousFirstId = records.value[0]?.id || '';
        const previousRecords = records.value;
        const previousCursor = cursor.value;
        const previousHasMore = hasMore.value;
        const result = await loadPage({ reset: true, silent: true });
        if (!result) return;
        if (previousRecords.length > result.items.length) {
            const merged = new Map();
            for (const record of [...result.items, ...previousRecords]) {
                merged.set(record.id, record);
            }
            records.value = [...merged.values()].sort((a, b) => getRecordSortTime(b) - getRecordSortTime(a));
            cursor.value = previousCursor;
            hasMore.value = previousHasMore;
        }
        if (!previousFirstId || result.items[0]?.id === previousFirstId) return;
        if ((pageRef.value?.scrollTop || 0) > 12) {
            hasNewRecords.value = true;
        }
    }

    function getRecordSortTime(record) {
        return record.isOpenTail ? liveNow.value : record.endAt || 0;
    }

    async function loadMore() {
        if (!hasMore.value || loadingMore.value || !cursor.value) return;
        await loadPage({ reset: false });
    }

    function jumpToTop() {
        pageRef.value?.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
        hasNewRecords.value = false;
    }

    function formatDateTime(timestamp) {
        if (!timestamp) return '-';
        return new Intl.DateTimeFormat(locale.value, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(timestamp));
    }

    function formatEndTime(record) {
        if (record.privacyState === 'unknown' && record.isOpenTail) {
            return t('dialog.user.activity.room_activity.unknown');
        }
        return record.isOpenTail ? t('dialog.user.activity.room_activity.in_progress') : formatDateTime(record.endAt);
    }

    function formatDuration(record) {
        const duration = record.isOpenTail ? liveNow.value - record.startAt : record.durationMs;
        return timeToText(Math.max(0, duration), true);
    }

    function getRoomName(record) {
        const parsed = parseLocation(record.location);
        if (record.privacyState === 'unknown' || record.privacyState === 'suspected-private') {
            return t('dialog.user.activity.room_activity.unknown_room');
        }
        if (parsed.isPrivate) return t('dialog.user.activity.room_activity.private_room');
        if (parsed.isTraveling) return t('dialog.user.activity.room_activity.traveling');
        return record.worldName || parsed.worldId || t('dialog.user.activity.room_activity.unknown_room');
    }

    function getAccessLabel(record) {
        const parsed = parseLocation(record.location);
        if (parsed.isOffline) return t('dialog.user.activity.room_activity.offline');
        if (parsed.isPrivate) return t('dialog.user.activity.room_activity.private_room');
        if (parsed.isTraveling) return t('dialog.user.activity.room_activity.traveling');
        return parsed.accessTypeName
            ? translateAccessType(parsed.accessTypeName, t, accessTypeLocaleKeyMap)
            : t('dialog.user.activity.room_activity.unknown_access');
    }

    function getStateLabel(record) {
        if (record.privacyState === 'unknown') return t('dialog.user.activity.room_activity.unknown');
        if (record.privacyState === 'suspected-private')
            return t('dialog.user.activity.room_activity.suspected_private');
        if (record.privacyState === 'status-restricted')
            return t('dialog.user.activity.room_activity.status_restricted');
        if (record.isOpenTail) return t('dialog.user.activity.room_activity.in_progress');
        return t('dialog.user.activity.room_activity.confirmed');
    }

    function getStateClass(state) {
        if (state === 'suspected-private') return 'bg-amber-500/12 text-amber-700 dark:text-amber-300';
        if (state === 'unknown') return 'bg-muted text-muted-foreground';
        if (state === 'status-restricted') return 'bg-orange-500/12 text-orange-700 dark:text-orange-300';
        return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
    }

    function getStatusLabel(status) {
        const key = status === 'ask me' ? 'ask_me' : status === 'busy' ? 'busy' : 'active';
        return t(`dialog.user.status.${key}`);
    }

    function openRecord(record) {
        if (record.isKnownLocation && record.location) showWorldDialog(record.location);
    }

    function toggleInstanceId(id) {
        expandedRecordId.value = expandedRecordId.value === id ? '' : id;
    }

    function copyInstanceId(record) {
        copyToClipboard(record.location, t('dialog.user.activity.room_activity.instance_id_copied'));
    }

    function goBack() {
        if (props.embedded) {
            emit('close');
            return;
        }
        router.back();
    }

    watch(
        () => props.initialPeriod,
        (period) => {
            if (period) selectedPeriod.value = normalizePeriod(period);
        }
    );
    watch(selectedPeriod, () => {
        void loadPage({ reset: true });
    });
    watch(
        () => [
            friendRef.value?.location,
            friendRef.value?.status,
            friendRef.value?.state,
            friendRef.value?.$location_at
        ],
        () => void refreshLatest()
    );
    watch(userId, () => {
        expandedRecordId.value = '';
        hasNewRecords.value = false;
        cursor.value = null;
        void loadPage({ reset: true });
    });

    onMounted(() => {
        liveTimer = setInterval(() => {
            liveNow.value = Date.now();
        }, 1000);
        void loadPage({ reset: true });
    });

    onBeforeUnmount(() => {
        clearInterval(liveTimer);
    });
</script>

<style scoped>
    .friend-activity-timeline__line {
        position: absolute;
        top: 0.75rem;
        bottom: 0.75rem;
        left: 8rem;
        z-index: 0;
        width: 1px;
        pointer-events: none;
        background: color-mix(in srgb, var(--border) 80%, transparent);
    }

    @media (max-width: 640px) {
        .friend-activity-timeline__line {
            left: 7rem;
        }
    }
</style>
