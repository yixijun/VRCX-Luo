<template>
    <Dialog :open="visible" @update:open="(open) => (open ? null : closeDialog())">
        <DialogContent class="x-dialog sm:max-w-[50vw] h-[70vh] overflow-hidden">
            <DialogHeader class="calendar-dialog-header">
                <div class="dialog-title-container">
                    <DialogTitle>{{ t('dialog.group_calendar.header') }}</DialogTitle>
                </div>
                <div class="calendar-header-controls">
                    <div class="calendar-mode-switch" role="group" :aria-label="t('dialog.group_calendar.header')">
                        <Button
                            size="sm"
                            :variant="calendarMode === 'calendar' ? 'default' : 'ghost'"
                            :aria-pressed="calendarMode === 'calendar'"
                            @click="setCalendarMode('calendar')">
                            <CalendarDays class="size-4" />
                            {{ t('dialog.group_calendar.calendar_mode') }}
                        </Button>
                        <Button
                            size="sm"
                            :variant="calendarMode === 'discover' ? 'default' : 'ghost'"
                            :aria-pressed="calendarMode === 'discover'"
                            @click="setCalendarMode('discover')">
                            <Compass class="size-4" />
                            {{ t('dialog.group_calendar.discover_mode') }}
                        </Button>
                    </div>
                    <div v-if="calendarMode === 'calendar'" class="featured-switch">
                        <span class="featured-switch-text">{{ t('dialog.group_calendar.featured_events') }}</span>
                        <Switch v-model="showFeaturedEvents" @update:modelValue="toggleFeaturedEvents" />
                        <Button size="sm" variant="outline" @click="toggleViewMode" class="view-toggle-btn">
                            {{
                                viewMode === 'timeline'
                                    ? t('dialog.group_calendar.list_view')
                                    : t('dialog.group_calendar.calendar_view')
                            }}
                        </Button>
                    </div>
                </div>
            </DialogHeader>
            <div class="top-content">
                <Transition name="calendar-section" mode="out-in">
                    <div v-if="calendarMode === 'discover'" key="discover" class="grid-view discover-view">
                        <div class="search-container discover-toolbar">
                            <InputGroupSearch
                                v-model="discoverSearchQuery"
                                size="sm"
                                :placeholder="t('dialog.group_calendar.discover_search_placeholder')"
                                :aria-label="t('dialog.group_calendar.discover_search_placeholder')"
                                class="search-input" />
                            <Select
                                v-if="!discoverSearchQuery.trim()"
                                :model-value="discoverScope"
                                :disabled="isDiscoverLoading"
                                @update:modelValue="setDiscoverScope">
                                <SelectTrigger class="discover-scope-trigger" size="sm" @click.stop>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="upcoming">{{ t('dialog.group_calendar.scope_upcoming') }}</SelectItem>
                                    <SelectItem value="live">{{ t('dialog.group_calendar.scope_live') }}</SelectItem>
                                    <SelectItem value="all">{{ t('dialog.group_calendar.scope_all') }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <span v-if="discoverEvents.length" class="discover-count">
                                {{ t('dialog.group_calendar.results_count', { count: discoverEvents.length }) }}
                            </span>
                            <Button
                                size="icon-sm"
                                variant="outline"
                                :disabled="isDiscoverLoading || discoverSearchPending"
                                :aria-label="t('dialog.group_calendar.refresh_discover')"
                                @click="fetchDiscoverEvents(true)">
                                <Spinner v-if="isDiscoverLoading" class="size-4" />
                                <RefreshCw v-else class="size-4" />
                            </Button>
                        </div>
                        <div class="groups-grid discover-results" :aria-busy="isDiscoverLoading">
                            <TransitionGroup
                                v-if="discoverEvents.length"
                                tag="div"
                                name="calendar-event"
                                class="discover-events-grid">
                                <div v-for="event in discoverEvents" :key="event.id" class="discover-event-item">
                                    <GroupCalendarEventCard
                                        :event="event"
                                        mode="grid"
                                        :is-following="Boolean(event.userInterest?.isFollowing)"
                                        card-class="grid-card"
                                        @update-following-calendar-data="updateFollowingCalendarData"
                                        @click-action="showGroupDialog(event.ownerId)" />
                                </div>
                            </TransitionGroup>
                            <div v-else-if="isDiscoverLoading" class="discover-state" role="status">
                                <Spinner class="size-5" />
                                <span>{{ t('dialog.group_calendar.discover_loading') }}</span>
                            </div>
                            <div v-else-if="discoverError" class="discover-state" role="alert">
                                <span>{{ t('dialog.group_calendar.discover_failed') }}</span>
                                <Button size="sm" variant="outline" @click="fetchDiscoverEvents(true)">
                                    {{ t('dialog.group_calendar.retry') }}
                                </Button>
                            </div>
                            <div v-else class="discover-state" role="status">
                                <Compass class="size-5 text-muted-foreground" />
                                <span>{{ t('dialog.group_calendar.discover_empty') }}</span>
                            </div>
                            <div
                                v-if="discoverEvents.length && isDiscoverLoading"
                                class="discover-loading-more"
                                role="status">
                                <Spinner class="size-4" />
                            </div>
                            <div v-if="discoverHasMore" class="discover-load-more">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    :disabled="isDiscoverLoading || discoverSearchPending"
                                    @click="fetchDiscoverEvents(false)">
                                    {{ t('dialog.group_calendar.load_more') }}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="viewMode === 'timeline'" key="timeline" class="timeline-view">
                        <div class="timeline-container">
                            <div v-if="groupedTimelineEvents.length" class="timeline-list">
                                <div v-for="(timeGroup, key) of groupedTimelineEvents" :key="key" class="timeline-group">
                                    <div class="timeline-timestamp">
                                        {{ dayjs(timeGroup.startsAt).format('MM-DD ddd') }} {{ timeGroup.startTime }}
                                    </div>
                                    <div class="time-group-container">
                                        <GroupCalendarEventCard
                                            v-for="value in timeGroup.events"
                                            :key="value.id"
                                            :event="value"
                                            mode="timeline"
                                            :is-following="isEventFollowing(value.id)"
                                            :card-class="{ 'grouped-card': timeGroup.events.length > 1 }"
                                            @update-following-calendar-data="updateFollowingCalendarData"
                                            @click-action="showGroupDialog(value.ownerId)" />
                                    </div>
                                </div>
                            </div>
                            <div v-else class="timeline-empty">{{ t('dialog.group_calendar.no_events') }}</div>
                        </div>

                        <div class="calendar-container">
                            <GroupCalendarMonth
                                v-model="selectedDay"
                                :is-loading="isLoading"
                                :events-by-date="filteredCalendar"
                                :following-by-date="followingCalendarDate" />
                        </div>
                    </div>
                    <div v-else key="grid" class="grid-view">
                        <div class="search-container">
                            <InputGroupSearch
                                v-model="searchQuery"
                                size="sm"
                                :placeholder="t('dialog.group_calendar.search_placeholder')"
                                class="search-input" />
                        </div>

                        <div class="groups-grid">
                            <div v-if="filteredGroupEvents.length" class="groups-container">
                                <div v-for="group in filteredGroupEvents" :key="group.groupId" class="group-row">
                                    <div class="group-header" @click="toggleGroup(group.groupId)">
                                        <ChevronDown
                                            class="rotation-transition"
                                            :class="{ 'is-rotated': groupCollapsed[group.groupId] }" />
                                        {{ group.groupName }}
                                    </div>
                                    <div class="events-row" v-show="!groupCollapsed[group.groupId]">
                                        <GroupCalendarEventCard
                                            v-for="event in group.events"
                                            :key="event.id"
                                            :event="event"
                                            mode="grid"
                                            :is-following="isEventFollowing(event.id)"
                                            @update-following-calendar-data="updateFollowingCalendarData"
                                            @click-action="showGroupDialog(event.ownerId)"
                                            card-class="grid-card" />
                                    </div>
                                </div>
                            </div>
                            <div v-else class="no-events">
                                {{
                                    searchQuery
                                        ? t('dialog.group_calendar.search_no_matching')
                                        : t('dialog.group_calendar.search_no_this_month')
                                }}
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { Button } from '@/components/ui/button';
    import { CalendarDays, ChevronDown, Compass, RefreshCw } from 'lucide-vue-next';
    import { InputGroupSearch } from '@/components/ui/input-group';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Spinner } from '@/components/ui/spinner';
    import { useI18n } from 'vue-i18n';

    import dayjs from 'dayjs';

    import { formatDateFilter, getGroupName, replaceBioSymbols } from '../../../shared/utils';
    import { Switch } from '../../../components/ui/switch';
    import { groupRequest } from '../../../api';
    import { processBulk } from '../../../services/request';
    import { useGroupStore } from '../../../stores';
    import { showGroupDialog } from '@/coordinators/groupCoordinator';

    import GroupCalendarEventCard from '../components/GroupCalendarEventCard.vue';
    import GroupCalendarMonth from '../components/GroupCalendarMonth.vue';
    import configRepository from '../../../services/config';

    const { applyGroupEvent } = useGroupStore();

    const { t } = useI18n();

    const props = defineProps({
        visible: {
            type: Boolean,
            required: true
        }
    });

    const emit = defineEmits(['close']);

    const calendar = ref([]);
    const followingCalendar = ref([]);
    const featuredCalendar = ref([]);
    const discoverEvents = ref([]);
    const selectedDay = ref(new Date());
    const isLoading = ref(false);
    const isDiscoverLoading = ref(false);
    const discoverHasMore = ref(false);
    const discoverError = ref(false);
    const discoverSearchPending = ref(false);
    const viewMode = ref('timeline');
    const calendarMode = ref('calendar');
    const searchQuery = ref('');
    const discoverSearchQuery = ref('');
    const discoverScope = ref('upcoming');
    const discoverNextCursor = ref('');
    const discoverOffset = ref(0);
    const discoverRequestId = ref(0);
    const groupCollapsed = ref({});
    const showFeaturedEvents = ref(false);
    const groupNamesCache = new Map();
    let discoverSearchTimer = null;
    let discoverReloadQueued = false;

    onMounted(async () => {
        showFeaturedEvents.value = await configRepository.getBool('VRCX_groupCalendarShowFeaturedEvents', false);
    });

    /**
     *
     */
    function toggleFeaturedEvents() {
        configRepository.setBool('VRCX_groupCalendarShowFeaturedEvents', showFeaturedEvents.value);
        updateCalenderData();
    }

    watch(
        () => props.visible,
        async (newVisible) => {
            if (newVisible) {
                selectedDay.value = new Date();
                if (calendarMode.value === 'discover') {
                    fetchDiscoverEvents(true);
                } else {
                    updateCalenderData();
                }
            } else {
                discoverRequestId.value += 1;
                isDiscoverLoading.value = false;
                discoverReloadQueued = false;
                if (discoverSearchTimer) {
                    clearTimeout(discoverSearchTimer);
                    discoverSearchTimer = null;
                }
                discoverSearchPending.value = false;
            }
        }
    );

    watch(discoverSearchQuery, () => {
        if (calendarMode.value !== 'discover') return;
        if (discoverSearchTimer) clearTimeout(discoverSearchTimer);
        discoverSearchPending.value = true;
        discoverSearchTimer = setTimeout(() => {
            discoverSearchTimer = null;
            discoverSearchPending.value = false;
            fetchDiscoverEvents(true);
        }, 320);
    });

    onBeforeUnmount(() => {
        discoverRequestId.value += 1;
        discoverReloadQueued = false;
        if (discoverSearchTimer) clearTimeout(discoverSearchTimer);
        discoverSearchPending.value = false;
    });

    watch(
        () => selectedDay.value,
        async (newDate, oldDate) => {
            if (props.visible && oldDate) {
                const newMonth = dayjs(newDate).format('YYYY-MM');
                const oldMonth = dayjs(oldDate).format('YYYY-MM');

                if (newMonth !== oldMonth) {
                    updateCalenderData();
                }
            }
        }
    );

    /**
     *
     */
    async function updateCalenderData() {
        isLoading.value = true;
        let fetchPromises = [getCalendarData(), getFollowingCalendarData()];
        if (showFeaturedEvents.value) {
            fetchPromises.push(getFeaturedCalendarData());
        }
        await Promise.all(fetchPromises)
            .catch((error) => {
                console.error('Error fetching calendar data:', error);
            })
            .finally(() => {
                isLoading.value = false;
            });
    }

    function setCalendarMode(mode) {
        if (calendarMode.value === mode) return;
        calendarMode.value = mode;
        if (mode === 'discover' && props.visible) {
            fetchDiscoverEvents(true);
        } else if (mode === 'calendar') {
            discoverReloadQueued = false;
            if (props.visible && calendar.value.length === 0) {
                updateCalenderData();
            }
        }
    }

    function setDiscoverScope(scope) {
        if (discoverScope.value === scope) return;
        discoverScope.value = scope;
        fetchDiscoverEvents(true);
    }

    async function fetchDiscoverEvents(reset = true) {
        if (!props.visible || calendarMode.value !== 'discover') return;
        if (isDiscoverLoading.value) {
            if (reset) discoverReloadQueued = true;
            return;
        }
        if (reset) {
            discoverRequestId.value += 1;
            discoverNextCursor.value = '';
            discoverOffset.value = 0;
            discoverHasMore.value = false;
            discoverError.value = false;
            discoverEvents.value = [];
        } else if (!discoverHasMore.value) {
            return;
        }

        const requestId = discoverRequestId.value;
        const n = 24;
        const searchTerm = discoverSearchQuery.value.trim();
        const requestScope = discoverScope.value;
        isDiscoverLoading.value = true;
        try {
            const response = searchTerm
                ? await groupRequest.searchCalendarEvents({
                      searchTerm,
                      n,
                      offset: reset ? 0 : discoverOffset.value,
                      utcOffset: Math.max(-12, Math.min(12, -Math.round(new Date().getTimezoneOffset() / 60)))
                  })
                : await groupRequest.discoverCalendarEvents({
                      scope: requestScope,
                      n,
                      ...(reset || !discoverNextCursor.value ? {} : { nextCursor: discoverNextCursor.value })
                  });
            if (
                requestId !== discoverRequestId.value ||
                !props.visible ||
                calendarMode.value !== 'discover' ||
                searchTerm !== discoverSearchQuery.value.trim() ||
                requestScope !== discoverScope.value
            ) {
                return;
            }

            const results = Array.isArray(response?.results) ? response.results : [];
            for (const event of results) {
                event.title = replaceBioSymbols(event.title);
                event.description = replaceBioSymbols(event.description);
                applyGroupEvent(event);
            }
            const merged = new Map(reset ? [] : discoverEvents.value.map((event) => [event.id, event]));
            for (const event of results) merged.set(event.id, event);
            discoverEvents.value = [...merged.values()];

            if (searchTerm) {
                discoverOffset.value = (reset ? 0 : discoverOffset.value) + results.length;
                discoverHasMore.value = typeof response?.hasNext === 'boolean'
                    ? response.hasNext
                    : results.length === n;
            } else {
                discoverNextCursor.value = response?.nextCursor || '';
                discoverHasMore.value = Boolean(discoverNextCursor.value);
            }
        } catch (error) {
            if (
                requestId === discoverRequestId.value &&
                props.visible &&
                calendarMode.value === 'discover' &&
                searchTerm === discoverSearchQuery.value.trim() &&
                requestScope === discoverScope.value
            ) {
                discoverError.value = true;
                console.error('Failed to fetch calendar discovery results:', error);
            }
        } finally {
            if (requestId === discoverRequestId.value) {
                isDiscoverLoading.value = false;
                if (discoverReloadQueued && props.visible && calendarMode.value === 'discover') {
                    discoverReloadQueued = false;
                    fetchDiscoverEvents(true);
                }
            }
        }
    }

    const groupedByGroupEvents = computed(() => {
        const currentMonth = dayjs(selectedDay.value).month();
        const currentYear = dayjs(selectedDay.value).year();

        let currentMonthEvents = calendar.value.filter((event) => {
            const eventDate = dayjs(event.startsAt);
            return eventDate.month() === currentMonth && eventDate.year() === currentYear;
        });
        if (showFeaturedEvents.value) {
            const featuredMonthEvents = featuredCalendar.value.filter((event) => {
                const eventDate = dayjs(event.startsAt);
                return eventDate.month() === currentMonth && eventDate.year() === currentYear;
            });
            currentMonthEvents = currentMonthEvents.concat(featuredMonthEvents);
        }

        const groupMap = new Map();
        currentMonthEvents.forEach((event) => {
            const groupId = event.ownerId;
            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, []);
            }
            groupMap.get(groupId).push(event);
        });

        Array.from(groupMap.values()).forEach((events) => {
            events.sort((a, b) => (dayjs(a.startsAt).isBefore(dayjs(b.startsAt)) ? -1 : 1));
        });

        return Array.from(groupMap.entries()).map(([groupId, events]) => ({
            groupId,
            groupName: groupNamesCache.get(groupId),
            events: events
        }));
    });

    const filteredGroupEvents = computed(() => {
        const hasSearch = searchQuery.value.trim();
        return !hasSearch
            ? groupedByGroupEvents.value
            : groupedByGroupEvents.value.filter((group) => {
                  if (group.groupName.toLowerCase().includes(searchQuery.value.toLowerCase())) return true;

                  return group.events.some(
                      (event) =>
                          event.title?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          event.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
                  );
              });
    });

    watch(
        [filteredGroupEvents, searchQuery],
        ([groups, search]) => {
            const newCollapsed = { ...groupCollapsed.value };
            let hasChanged = false;
            const hasSearch = search.trim();

            groups.forEach((group) => {
                if (!(group.groupId in newCollapsed)) {
                    newCollapsed[group.groupId] = false;
                    hasChanged = true;
                } else if (hasSearch) {
                    newCollapsed[group.groupId] = false;
                    hasChanged = true;
                }
            });

            if (hasChanged) {
                groupCollapsed.value = newCollapsed;
            }
        },
        { immediate: true }
    );

    const filteredCalendar = computed(() => {
        const result = {};
        calendar.value.forEach((item) => {
            const currentDate = formatDateKey(item.startsAt);
            if (!Array.isArray(result[currentDate])) {
                result[currentDate] = [];
            }
            result[currentDate].push(item);
        });
        if (showFeaturedEvents.value) {
            featuredCalendar.value.forEach((item) => {
                const currentDate = formatDateKey(item.startsAt);
                if (!Array.isArray(result[currentDate])) {
                    result[currentDate] = [];
                }
                result[currentDate].push(item);
            });
        }

        Object.values(result).forEach((events) => {
            events.sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)));
        });
        return result;
    });

    const followingCalendarDate = computed(() => {
        const result = {};

        const followingIds = new Set(followingCalendar.value.map((item) => item.id));

        calendar.value.forEach((event) => {
            if (followingIds.has(event.id)) {
                const dateKey = formatDateKey(event.startsAt);
                if (!result[dateKey]) {
                    result[dateKey] = [];
                }
                result[dateKey].push(event.id);
            }
        });
        return result;
    });

    const formattedSelectedDay = computed(() => {
        return formatDateKey(selectedDay.value);
    });

    const groupedTimelineEvents = computed(() => {
        const eventsForDay = filteredCalendar.value[formattedSelectedDay.value] || [];
        const timeGroups = {};

        eventsForDay.forEach((event) => {
            const startTimeKey = formatDateFilter(event.startsAt, 'time');
            if (!timeGroups[startTimeKey]) {
                timeGroups[startTimeKey] = [];
            }
            timeGroups[startTimeKey].push(event);
        });

        return Object.entries(timeGroups)
            .map(([startTime, events]) => ({
                startTime,
                events,
                startsAt: events[0].startsAt,
                hasFollowing: events.some((event) => isEventFollowing(event.id))
            }))
            .sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)));
    });

    // Use a stable key for calendar maps (independent of locale/appearance date formatting).
    const formatDateKey = (date) => dayjs(date).format('YYYY-MM-DD');

    /**
     *
     * @param groupId
     */
    async function getGroupNameFromCache(groupId) {
        if (!groupNamesCache.has(groupId)) {
            groupNamesCache.set(groupId, await getGroupName(groupId));
        }
    }

    /**
     *
     */
    async function getCalendarData() {
        calendar.value = [];
        try {
            await processBulk({
                fn: (bulkParams) => groupRequest.getGroupCalendars(bulkParams),
                N: -1,
                params: {
                    n: 100,
                    offset: 0,
                    date: dayjs(selectedDay.value).format('YYYY-MM-DDTHH:mm:ss[Z]') // this need to be local time because UTC time may cause month shift
                },
                async handle(args) {
                    for (const event of args.results) {
                        event.title = replaceBioSymbols(event.title);
                        event.description = replaceBioSymbols(event.description);
                        applyGroupEvent(event);
                        await getGroupNameFromCache(event.ownerId);
                    }
                    calendar.value.push(...args.results);
                }
            });
        } catch (error) {
            console.error('Error fetching calendars:', error);
        }
    }

    /**
     *
     */
    async function getFollowingCalendarData() {
        followingCalendar.value = [];
        try {
            await processBulk({
                fn: (bulkParams) => groupRequest.getFollowingGroupCalendars(bulkParams),
                N: -1,
                params: {
                    n: 100,
                    offset: 0,
                    date: dayjs(selectedDay.value).format('YYYY-MM-DDTHH:mm:ss[Z]')
                },
                async handle(args) {
                    for (const event of args.results) {
                        applyGroupEvent(event);
                        await getGroupNameFromCache(event.ownerId);
                    }
                    followingCalendar.value.push(...args.results);
                }
            });
        } catch (error) {
            console.error('Error fetching following calendars:', error);
        }
    }

    /**
     *
     */
    async function getFeaturedCalendarData() {
        featuredCalendar.value = [];
        try {
            await processBulk({
                fn: (bulkParams) => groupRequest.getFeaturedGroupCalendars(bulkParams),
                N: -1,
                params: {
                    n: 100,
                    offset: 0,
                    date: dayjs(selectedDay.value).format('YYYY-MM-DDTHH:mm:ss[Z]')
                },
                async handle(args) {
                    for (const event of args.results) {
                        applyGroupEvent(event);
                        await getGroupNameFromCache(event.ownerId);
                    }
                    featuredCalendar.value.push(...args.results);
                }
            });
        } catch (error) {
            console.error('Error fetching featured calendars:', error);
        }
    }

    /**
     *
     * @param updatedEvent
     */
    function updateFollowingCalendarData(updatedEvent) {
        const index = followingCalendar.value.findIndex((item) => item.id === updatedEvent.id);
        if (index !== -1) {
            followingCalendar.value.splice(index, 1);
        }
        if (updatedEvent.userInterest?.isFollowing) {
            followingCalendar.value.push(updatedEvent);
        }
        const discoverEvent = discoverEvents.value.find((item) => item.id === updatedEvent.id);
        if (discoverEvent) {
            Object.assign(discoverEvent, updatedEvent);
        }
    }

    /**
     *
     * @param eventId
     */
    function isEventFollowing(eventId) {
        return followingCalendar.value.some((item) => item.id === eventId);
    }

    /**
     *
     */
    function toggleViewMode() {
        viewMode.value = viewMode.value === 'timeline' ? 'grid' : 'timeline';
    }

    /**
     *
     * @param groupId
     */
    function toggleGroup(groupId) {
        groupCollapsed.value = {
            ...groupCollapsed.value,
            [groupId]: !groupCollapsed.value[groupId]
        };
    }

    /**
     *
     */
    function closeDialog() {
        emit('close');
    }
</script>

<style scoped>
    .calendar-dialog-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .calendar-header-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        min-width: 0;
    }

    .calendar-dialog-header .dialog-title-container {
        width: auto;
        flex: 1;
    }

    .calendar-mode-switch {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--muted);
    }

    .calendar-mode-switch :deep(button) {
        border-radius: var(--radius-sm);
        gap: 6px;
        white-space: nowrap;
    }

    .x-dialog {
        .top-content {
            height: 640px;
            position: relative;
            overflow: hidden;
            .timeline-view {
                .timeline-container {
                    min-width: 200px;
                    padding-left: 4px;
                    padding-right: 16px;
                    margin-left: 8px;
                    margin-right: 8px;
                    overflow: auto;
                    height: 50vh;

                    .timeline-list {
                        display: flex;
                        flex-direction: column;
                        gap: 14px;
                    }

                    .timeline-group {
                        padding: 0 20px 8px 8px;
                    }

                    .timeline-timestamp {
                        font-size: 13px;
                        font-weight: 600;
                        margin-bottom: 8px;
                    }

                    .timeline-empty {
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .time-group-container {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        overflow: visible;
                    }
                }
                .calendar-container {
                    .date {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        .calendar-date-content {
                            width: 80%;
                            height: 80%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: var(--radius-xl);
                            font-size: 18px;
                            position: relative;

                            &.has-events {
                                background-color: var(--group-calendar-event-bg,);
                            }
                            .calendar-event-badge {
                                position: absolute;
                                top: 2px;
                                right: 2px;
                                min-width: 16px;
                                height: 16px;
                                border-radius: var(--radius-xl);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 10px;
                                font-weight: bold;
                                z-index: 10;
                                padding: 0 4px;
                                line-height: 16px;
                            }
                        }
                    }
                }
            }
        }
    }

    .dialog-title-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        .view-toggle-btn {
            font-size: 12px;
            padding: 8px 12px;
        }
    }

    .featured-switch {
        display: flex;
        align-items: center;
        gap: 8px;
        .featured-switch-text {
            font-size: 13px;
            white-space: nowrap;
        }
    }

    .discover-toolbar {
        gap: 8px;
        align-items: center;
        .search-input {
            flex: 1;
            max-width: 440px;
        }
        .discover-scope-trigger {
            width: 150px;
            border-radius: var(--radius-md);
        }
        .discover-count {
            color: var(--muted-foreground);
            font-size: 12px;
            white-space: nowrap;
        }
    }

    .discover-results {
        padding-top: 8px;
    }

    .discover-events-grid {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 16px;
        overflow: visible;
    }

    .discover-event-item {
        flex: 0 0 280px;
        max-width: 280px;
    }

    .discover-state {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: var(--muted-foreground);
        text-align: center;
    }

    .discover-loading-more {
        display: flex;
        justify-content: center;
        padding: 12px;
        color: var(--muted-foreground);
    }

    .discover-load-more {
        display: flex;
        justify-content: center;
        padding: 16px 0 4px;
    }

    .calendar-event-enter-active,
    .calendar-event-leave-active,
    .calendar-event-move {
        transition:
            opacity 160ms ease,
            transform 160ms ease;
    }

    .calendar-event-enter-from,
    .calendar-event-leave-to {
        opacity: 0;
        transform: translateY(6px);
    }

    .calendar-section-enter-active,
    .calendar-section-leave-active {
        transition:
            opacity 140ms ease,
            transform 140ms ease;
    }

    .calendar-section-enter-from,
    .calendar-section-leave-to {
        opacity: 0;
        transform: translateY(4px);
    }

    @media (max-width: 900px) {
        .calendar-dialog-header {
            align-items: flex-start;
            flex-direction: column;
        }

        .calendar-header-controls {
            width: 100%;
            justify-content: space-between;
            flex-wrap: wrap;
        }

        .calendar-dialog-header .dialog-title-container {
            width: 100%;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .calendar-event-enter-active,
        .calendar-event-leave-active,
        .calendar-event-move,
        .calendar-section-enter-active,
        .calendar-section-leave-active {
            transition: none;
        }
    }

    .timeline-view {
        display: flex;
        align-items: center;
        .timeline-container {
            flex: 1;
        }
    }

    .grid-view {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        .search-container {
            padding: 2px 20px 12px 20px;
            display: flex;
            justify-content: flex-end;
            .search-input {
                width: 300px;
            }
        }

        .groups-grid {
            flex: 1;
            overflow-y: auto;
            padding: 16px 20px;
            .groups-container {
                overflow: visible;
                .group-row {
                    margin-bottom: 18px;
                    overflow: visible;
                    .group-header {
                        font-size: 16px;
                        font-weight: bold;
                        padding: 4px 12px 8px 12px;
                        cursor: pointer;
                        border-radius: var(--radius-md);
                        margin: 0 -12px 8px -12px;
                        display: flex;
                        align-items: center;

                        .rotation-transition {
                            font-size: 14px;
                            margin-right: 8px;
                            transition: transform 0.3s;
                        }
                    }
                    .events-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 16px;
                        overflow: visible;
                    }
                }
            }
            .no-events {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 200px;
                font-size: 16px;
            }
        }
    }

    .is-rotated {
        transform: rotate(-90deg);
    }

    .rotation-transition {
        transition: transform 0.2s ease-in-out;
    }
</style>
