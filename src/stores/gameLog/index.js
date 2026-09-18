import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRouter } from 'vue-router';

import { buildGameLogSessions } from '../../views/GameLog/sessions/buildGameLogSessions';

import {
    compareGameLogRows,
    findUserByDisplayName,
    formatSeconds,
    gameLogSearchFilter,
    getGroupName
} from '../../shared/utils';
import { createMediaParsers } from './mediaParsers';
import {
    applySessionsSearchFilter as applySessionsSearchFilterPure,
    clampSessionsDateRange as clampSessionsDateRangePure,
    filterSessionsEventsByFilters as filterSessionsEventsByFiltersPure,
    filterSessionsSegmentsByDateRange as filterSessionsSegmentsByDateRangePure,
    isSessionsGlobalSearchMode as isSessionsGlobalSearchModePure,
    isSessionsLocationInDateRange as isSessionsLocationInDateRangePure,
    toSessionsEpoch
} from './sessionsFilters';
import { createNowPlayingTicker } from './nowPlayingTicker';
import { database } from '../../services/database';
import { tryLoadPlayerList } from '../../coordinators/gameLogCoordinator';
import { useAdvancedSettingsStore } from '../settings/advanced';
import { useFriendStore } from '../friend';
import { useGameStore } from '../game';
import { useNotificationStore } from '../notification';
import { useUiStore } from '../ui';
import { useUserStore } from '../user';
import { useVrStore } from '../vr';
import { useVrcxStore } from '../vrcx';
import { watchState } from '../../services/watchState';
import { accountHub } from '../../services/accountHub';

import configRepository from '../../services/config';

import * as workerTimers from 'worker-timers';

const SESSIONS_EVENT_FILTER_ALL = 'All';
const SESSIONS_EVENT_FILTER_TYPES = [
    'OnPlayerJoined',
    'OnPlayerLeft',
    'VideoPlay'
];
const SESSIONS_DATE_RANGE_MAX_DAYS = 7;
const SESSIONS_GLOBAL_SEARCH_INITIAL_LOCATIONS = 500;
const SESSIONS_SEARCH_BATCH_ATTEMPTS = 3;

export const useGameLogStore = defineStore('GameLog', () => {
    const notificationStore = useNotificationStore();
    const vrStore = useVrStore();
    const gameStore = useGameStore();
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const uiStore = useUiStore();
    const vrcxStore = useVrcxStore();
    const advancedSettingsStore = useAdvancedSettingsStore();

    const router = useRouter();

    const state = reactive({
        lastLocationAvatarList: new Map()
    });

    const gameLogTableData = shallowRef([]);
    const gameLogTable = ref({
        loading: false,
        search: '',
        filter: [],
        pageSize: 20,
        pageSizeLinked: true,
        vip: false
    });

    // ── Sessions view state ──
    const sessionsViewMode = ref('sessions'); // 'sessions' | 'table'
    const sessionsSegments = shallowRef([]);
    const sessionsCursor = ref(null);
    const sessionsLoading = ref(false);
    const sessionsHasMore = ref(true);
    const sessionsVipFilter = ref(false);
    const sessionsEventFilters = ref([]);
    const sessionsSearch = ref('');
    const sessionsDateFrom = ref('');
    const sessionsDateTo = ref('');
    const sessionsRawLocations = shallowRef([]);
    const sessionsRawEvents = shallowRef([]);
    const sessionsEventFilterSelection = computed({
        get() {
            return sessionsEventFilters.value.length === 0
                ? [SESSIONS_EVENT_FILTER_ALL]
                : sessionsEventFilters.value;
        },
        set(value) {
            handleSessionsEventFilterChange(value);
        }
    });
    const sessionsDateRangeActive = computed(
        () => !!sessionsDateFrom.value || !!sessionsDateTo.value
    );

    const nowPlaying = ref({
        url: '',
        name: '',
        length: 0,
        startTime: 0,
        offset: 0,
        elapsed: 0,
        percentage: 0,
        remainingText: '',
        playing: false,
        thumbnailUrl: ''
    });

    const lastVideoUrl = ref('');

    const lastResourceloadUrl = ref('');

    // Latest entry ref for GameLog Widget to watch
    const latestGameLogEntry = ref(null);
    let initPromise = Promise.resolve();

    watch(
        () => watchState.isLoggedIn,
        () => {
            gameLogTableData.value = [];
            sessionsSegments.value = [];
            sessionsRawLocations.value = [];
            sessionsRawEvents.value = [];
            sessionsCursor.value = null;
            sessionsHasMore.value = true;
        },
        { flush: 'sync' }
    );

    watch(
        () => accountHub.viewMode,
        () => {
            if (watchState.isLoggedIn) {
                gameLogTableData.value = [];
                sessionsSegments.value = [];
                sessionsRawLocations.value = [];
                sessionsRawEvents.value = [];
                sessionsCursor.value = null;
                sessionsHasMore.value = true;
                if (router.currentRoute.value.name === 'game-log') {
                    if (sessionsViewMode.value === 'sessions') {
                        loadSessionsSegments();
                    } else {
                        initGameLogTable();
                    }
                }
            }
        }
    );

    watch(
        router.currentRoute,
        async (value) => {
            await initPromise;
            if (value.name === 'game-log') {
                if (sessionsViewMode.value === 'sessions') {
                    loadSessionsSegments();
                } else {
                    initGameLogTable();
                }
            } else {
                gameLogTableData.value = [];
                sessionsSegments.value = [];
                sessionsRawLocations.value = [];
                sessionsRawEvents.value = [];
                sessionsCursor.value = null;
                sessionsHasMore.value = true;
            }
        },
        { immediate: true }
    );

    watch(
        () => watchState.isFavoritesLoaded,
        (isFavoritesLoaded) => {
            if (isFavoritesLoaded && gameLogTable.value.vip) {
                gameLogTableLookup(); // re-apply VIP filter after friends are loaded
            }
        }
    );

    watch(
        () => watchState.isFriendsLoaded,
        (isFriendsLoaded) => {
            if (isFriendsLoaded) {
                tryLoadPlayerList();
            }
        },
        { flush: 'sync' }
    );

    // Friends can finish loading before the native game-state callback. In
    // that order the existing friends watcher runs while the game is still
    // marked offline, so tryLoadPlayerList() returns early and the player
    // table remains empty until the next join/leave event. Rehydrate the
    // current room as soon as the game transitions to running as well.
    watch(
        () => gameStore.isGameRunning,
        (isGameRunning) => {
            if (isGameRunning) {
                tryLoadPlayerList();
            }
        },
        { flush: 'sync' }
    );

    /**
     *
     */
    async function init() {
        gameLogTable.value.filter = JSON.parse(
            await configRepository.getString('VRCX_gameLogTableFilters', '[]')
        );
        gameLogTable.value.vip = await configRepository.getBool(
            'VRCX_gameLogTableVIPFilter',
            false
        );
        const savedViewMode = await configRepository.getString(
            'VRCX_gameLogViewMode',
            'table'
        );
        if (savedViewMode === 'sessions' || savedViewMode === 'table') {
            sessionsViewMode.value = savedViewMode;
        }
    }

    initPromise = init();

    /**
     *
     * @param entry
     */
    function insertGameLogSorted(entry) {
        const arr = gameLogTableData.value;
        if (arr.length === 0) {
            gameLogTableData.value = [entry];
            return;
        }
        if (compareGameLogRows(entry, arr[0]) < 0) {
            gameLogTableData.value = [entry, ...arr];
            return;
        }
        if (compareGameLogRows(entry, arr[arr.length - 1]) > 0) {
            gameLogTableData.value = [...arr, entry];
            return;
        }
        for (let i = 1; i < arr.length; i++) {
            if (compareGameLogRows(entry, arr[i]) < 0) {
                gameLogTableData.value = [
                    ...arr.slice(0, i),
                    entry,
                    ...arr.slice(i)
                ];
                return;
            }
        }
        gameLogTableData.value = [...arr, entry];
    }

    /**
     *
     */
    function clearNowPlaying() {
        nowPlaying.value = {
            url: '',
            name: '',
            length: 0,
            startTime: 0,
            offset: 0,
            elapsed: 0,
            percentage: 0,
            remainingText: '',
            playing: false,
            thumbnailUrl: ''
        };
        vrStore.updateVrNowPlaying();
    }

    const { updateNowPlaying } = createNowPlayingTicker({
        getNowPlaying: () => nowPlaying.value,
        clearNowPlaying,
        formatSeconds,
        updateView: () => vrStore.updateVrNowPlaying(),
        schedule: (callback, delay) => workerTimers.setTimeout(callback, delay)
    });

    /**
     *
     */
    function resetLastMediaUrls() {
        lastVideoUrl.value = '';
        lastResourceloadUrl.value = '';
    }

    /**
     *
     * @param data
     */
    function setNowPlaying(data) {
        const ctx = structuredClone(data);
        if (nowPlaying.value.url !== ctx.videoUrl) {
            if (!ctx.userId && ctx.displayName) {
                ctx.userId =
                    findUserByDisplayName(
                        userStore.cachedUsers,
                        ctx.displayName,
                        userStore.cachedUserIdsByDisplayName
                    )?.id ?? '';
            }
            notificationStore.queueGameLogNoty(ctx);
            addGameLog(ctx);
            database.addGamelogVideoPlayToDatabase(ctx);

            let displayName = '';
            if (ctx.displayName) {
                displayName = ` (${ctx.displayName})`;
            }
            const name = `${ctx.videoName}${displayName}`;
            nowPlaying.value = {
                url: ctx.videoUrl,
                name,
                length: ctx.videoLength,
                startTime: Date.parse(ctx.created_at) / 1000,
                offset: ctx.videoPos,
                elapsed: 0,
                percentage: 0,
                remainingText: '',
                playing: false,
                thumbnailUrl: ctx.thumbnailUrl
            };
        } else {
            nowPlaying.value = {
                ...nowPlaying.value,
                length: ctx.videoLength,
                offset: ctx.videoPos,
                elapsed: 0,
                percentage: 0,
                remainingText: '',
                thumbnailUrl: ctx.thumbnailUrl
            };
            if (ctx.updatedAt && ctx.videoPos) {
                nowPlaying.value.startTime =
                    Date.parse(ctx.updatedAt) / 1000 - ctx.videoPos;
            } else {
                nowPlaying.value.startTime =
                    Date.parse(ctx.created_at) / 1000 - ctx.videoPos;
            }
        }
        vrStore.updateVrNowPlaying();
        if (!nowPlaying.value.playing && ctx.videoLength > 0) {
            nowPlaying.value.playing = true;
            updateNowPlaying();
        }
    }

    const {
        addGameLogVideo,
        addGameLogPyPyDance,
        addGameLogVRDancing,
        addGameLogZuwaZuwaDance,
        addGameLogLSMedia,
        addGameLogPopcornPalace
    } = createMediaParsers({
        nowPlaying,
        setNowPlaying,
        clearNowPlaying,
        userStore,
        advancedSettingsStore
    });

    /**
     *
     * @param row
     */
    function gameLogIsFriend(row) {
        if (typeof row.isFriend !== 'undefined') {
            return row.isFriend;
        }
        if (!row.userId) {
            return false;
        }
        return friendStore.friends.has(row.userId);
    }

    /**
     *
     * @param row
     */
    function gameLogIsFavorite(row) {
        if (typeof row.isFavorite !== 'undefined') {
            return row.isFavorite;
        }
        if (!row.userId) {
            return false;
        }
        return friendStore.localFavoriteFriends.has(row.userId);
    }

    /**
     *
     */
    async function gameLogTableLookup() {
        await configRepository.setString(
            'VRCX_gameLogTableFilters',
            JSON.stringify(gameLogTable.value.filter)
        );
        await configRepository.setBool(
            'VRCX_gameLogTableVIPFilter',
            gameLogTable.value.vip
        );
        gameLogTable.value.loading = true;
        try {
            let vipList = [];
            if (gameLogTable.value.vip) {
                vipList = Array.from(friendStore.localFavoriteFriends.values());
            }
            const search = gameLogTable.value.search.trim();
            let rows = [];
            if (search) {
                rows = await database.searchGameLogDatabase(
                    search,
                    gameLogTable.value.filter,
                    vipList,
                    vrcxStore.searchLimit
                );
            } else {
                rows = await database.lookupGameLogDatabase(
                    gameLogTable.value.filter,
                    vipList
                );
            }

            for (const row of rows) {
                row.isFriend = gameLogIsFriend(row);
                row.isFavorite = gameLogIsFavorite(row);
            }
            gameLogTableData.value = rows;
        } finally {
            gameLogTable.value.loading = false;
        }
    }

    /**
     *
     * @param entry
     */
    function addGameLog(entry) {
        entry.isFriend = gameLogIsFriend(entry);
        entry.isFavorite = gameLogIsFavorite(entry);

        // Update ref for GameLog Widget (independent data stream)
        latestGameLogEntry.value = entry;

        if (
            entry.type === 'LocationDestination' ||
            entry.type === 'AvatarChange' ||
            entry.type === 'ChatBoxMessage' ||
            (entry.userId === userStore.currentUser.id &&
                (entry.type === 'OnPlayerJoined' ||
                    entry.type === 'OnPlayerLeft'))
        ) {
            return;
        }
        if (sessionsViewMode.value === 'table') {
            // Table view applies its own VIP/filter/search gating.
            if (
                gameLogTable.value.vip &&
                !friendStore.localFavoriteFriends.has(entry.userId) &&
                (entry.type === 'OnPlayerJoined' ||
                    entry.type === 'OnPlayerLeft' ||
                    entry.type === 'VideoPlay' ||
                    entry.type === 'PortalSpawn' ||
                    entry.type === 'External')
            ) {
                return;
            }
            if (
                gameLogTable.value.filter.length > 0 &&
                !gameLogTable.value.filter.includes(entry.type)
            ) {
                return;
            }
            if (!gameLogSearch(entry)) {
                return;
            }
            insertGameLogSorted(entry);
            sweepGameLog();
        }
        // Keep sessions view live while it is active
        if (sessionsViewMode.value === 'sessions') {
            appendSessionsEntry(entry);
        }
    }

    /**
     *
     * @param input
     */
    async function addGamelogLocationToDatabase(input) {
        const groupName = await getGroupName(input.location);
        const entry = {
            ...input,
            groupName
        };
        database.addGamelogLocationToDatabase(entry);
    }

    /**
     *
     * @param row
     */
    function gameLogSearch(row) {
        return gameLogSearchFilter(row, gameLogTable.value.search);
    }

    /**
     *
     */
    function sweepGameLog() {
        const j = gameLogTableData.value.length;
        if (j > vrcxStore.maxTableSize + 50) {
            gameLogTableData.value = gameLogTableData.value.slice(0, -50);
        }
    }

    /**
     *
     */
    async function initGameLogTable() {
        gameLogTable.value.loading = true;
        const rows = await database.lookupGameLogDatabase(
            gameLogTable.value.filter,
            []
        );
        for (const row of rows) {
            row.isFriend = gameLogIsFriend(row);
            row.isFavorite = gameLogIsFavorite(row);
        }
        gameLogTableData.value = rows;
        gameLogTable.value.loading = false;
    }

    /**
     * @param {string} value
     */
    function setLastVideoUrl(value) {
        lastVideoUrl.value = value;
    }

    /**
     * @param {string} value
     */
    function setLastResourceloadUrl(value) {
        lastResourceloadUrl.value = value;
    }

    // ── Sessions view methods ──

    /**
     * Sessions filters are implemented in a dependency-free module. These
     * wrappers preserve the Store's existing private call signatures while
     * supplying its reactive state and shared search predicate.
     */
    function isSessionsGlobalSearchMode() {
        return isSessionsGlobalSearchModePure({
            dateRangeActive: sessionsDateRangeActive.value,
            search: sessionsSearch.value
        });
    }

    function isSessionsLocationInDateRange(location) {
        return isSessionsLocationInDateRangePure(location, {
            dateRangeActive: sessionsDateRangeActive.value,
            dateFrom: sessionsDateFrom.value,
            dateTo: sessionsDateTo.value
        });
    }

    function clampSessionsDateRange(from, to) {
        return clampSessionsDateRangePure(from, to);
    }

    function filterSessionsEventsByFilters(events) {
        return filterSessionsEventsByFiltersPure(events, {
            vipFilter: sessionsVipFilter.value,
            eventFilters: sessionsEventFilters.value
        });
    }

    function filterSessionsSegmentsByDateRange(segments) {
        return filterSessionsSegmentsByDateRangePure(segments, {
            dateRangeActive: sessionsDateRangeActive.value,
            dateFrom: sessionsDateFrom.value,
            dateTo: sessionsDateTo.value
        });
    }

    function applySessionsSearchFilter(segments) {
        return applySessionsSearchFilterPure(segments, {
            search: sessionsSearch.value,
            searchLimit: vrcxStore.searchLimit,
            gameLogSearchFilter
        });
    }

    /**
     * Rebuild sessions output from raw data (immediate).
     */
    function rebuildSessions() {
        const events = filterSessionsEventsByFilters(sessionsRawEvents.value);
        const result = buildGameLogSessions(sessionsRawLocations.value, events);
        sessionsSegments.value = applySessionsSearchFilter(
            filterSessionsSegmentsByDateRange(result.segments)
        );
    }

    /**
     * Debounced rebuild for real-time appends.
     * Waits for burst of events to settle before recalculating.
     */
    let rebuildSessionsTimer = null;
    function rebuildSessionsDebounced() {
        if (rebuildSessionsTimer) clearTimeout(rebuildSessionsTimer);
        rebuildSessionsTimer = setTimeout(() => {
            rebuildSessionsTimer = null;
            rebuildSessions();
        }, 500);
    }

    /**
     * @param {Array<string>} value
     */
    async function handleSessionsEventFilterChange(value) {
        const selected = Array.isArray(value) ? value : [];
        const wasAll = sessionsEventFilters.value.length === 0;
        const hasAll = selected.includes(SESSIONS_EVENT_FILTER_ALL);
        const types = selected.filter(
            (item) =>
                item !== SESSIONS_EVENT_FILTER_ALL &&
                SESSIONS_EVENT_FILTER_TYPES.includes(item)
        );

        if (hasAll && !wasAll) {
            sessionsEventFilters.value = [];
        } else if (wasAll && types.length > 0) {
            sessionsEventFilters.value = types;
        } else {
            sessionsEventFilters.value =
                types.length === SESSIONS_EVENT_FILTER_TYPES.length
                    ? []
                    : types.length > 0
                      ? types
                      : [];
        }
        if (isSessionsGlobalSearchMode()) {
            await loadSessionsSegments();
            return;
        }
        rebuildSessions();
    }

    /**
     * @param {string} value
     */
    async function setSessionsSearch(value) {
        sessionsSearch.value = String(value ?? '');
        if (isSessionsGlobalSearchMode()) {
            await loadSessionsSegments();
            return;
        }
        await loadSessionsSegments();
    }

    /**
     * @param {string} from
     * @param {string} to
     */
    async function setSessionsDateRange(from, to) {
        const [normalizedFrom, normalizedTo] = clampSessionsDateRange(from, to);
        sessionsDateFrom.value = normalizedFrom;
        sessionsDateTo.value = normalizedTo;
        await loadSessionsSegments();
    }

    /**
     * Clear the active sessions date range.
     */
    async function clearSessionsDateRange() {
        sessionsDateFrom.value = '';
        sessionsDateTo.value = '';
        await loadSessionsSegments();
    }

    /**
     * @param {number|null} beforeId
     * @param {number} fetchCount
     * @returns {Promise<{ beforeId: number|null, hasMore: boolean }>}
     */
    async function loadSessionsSearchBatch(beforeId, fetchCount) {
        const locations = await database.getSessionsLocationSegments(
            beforeId,
            fetchCount
        );
        if (locations.length === 0) {
            return { beforeId, hasMore: false };
        }

        const hasExtraTail = locations.length >= fetchCount;
        if (hasExtraTail) {
            locations.pop();
        }
        if (locations.length === 0) {
            return { beforeId, hasMore: false };
        }

        const events = await fetchEventsForLocations(locations);
        sessionsRawLocations.value = [
            ...sessionsRawLocations.value,
            ...locations
        ];
        sessionsRawEvents.value = [...sessionsRawEvents.value, ...events];
        rebuildSessions();

        return {
            beforeId: locations[locations.length - 1].id,
            hasMore:
                hasExtraTail &&
                sessionsSegments.value.length < vrcxStore.searchLimit
        };
    }

    /**
     * Load the initial batch of session segments.
     * Uses maxTableSize as a total-event budget: divide by ~50 to estimate
     * a reasonable number of location segments. Fetches one extra and drops
     * the oldest to ensure the boundary has complete event data.
     */
    async function loadSessionsSegments() {
        if (sessionsLoading.value) return;
        sessionsLoading.value = true;
        try {
            sessionsCursor.value = null;
            sessionsHasMore.value = true;

            // Derive location budget from maxTableSize (total event budget)
            const locationBudget = Math.max(
                5,
                Math.ceil(vrcxStore.maxTableSize / 50)
            );
            let fetchCount = locationBudget + 1; // +1 to drop last for clean boundary

            if (isSessionsGlobalSearchMode()) {
                fetchCount = SESSIONS_GLOBAL_SEARCH_INITIAL_LOCATIONS + 1;
                let beforeId = null;
                let hasMore = true;
                let attempts = 0;
                sessionsRawLocations.value = [];
                sessionsRawEvents.value = [];
                sessionsSegments.value = [];

                while (
                    hasMore &&
                    sessionsSegments.value.length === 0 &&
                    attempts < SESSIONS_SEARCH_BATCH_ATTEMPTS
                ) {
                    const nextBatch = await loadSessionsSearchBatch(
                        beforeId,
                        fetchCount
                    );
                    beforeId = nextBatch.beforeId;
                    hasMore = nextBatch.hasMore;
                    attempts += 1;
                }

                sessionsCursor.value = beforeId;
                sessionsHasMore.value = hasMore;
                return;
            }

            if (sessionsDateRangeActive.value) {
                let beforeId = null;
                let hasMore = true;
                sessionsRawLocations.value = [];
                sessionsRawEvents.value = [];
                sessionsSegments.value = [];
                while (hasMore && sessionsSegments.value.length === 0) {
                    const locations =
                        beforeId === null
                            ? await database.getSessionsLocationSegmentsByAnchor(
                                  sessionsDateFrom.value ||
                                      sessionsDateTo.value,
                                  fetchCount
                              )
                            : await database.getSessionsLocationSegments(
                                  beforeId,
                                  fetchCount
                              );
                    if (locations.length === 0) {
                        hasMore = false;
                        break;
                    }

                    const hasExtraTail = locations.length >= fetchCount;
                    if (hasExtraTail) {
                        locations.pop();
                    }
                    if (locations.length === 0) {
                        hasMore = false;
                        break;
                    }

                    const inRangeLocations = locations.filter((location) =>
                        isSessionsLocationInDateRange(location)
                    );
                    const oldestLocationEpoch = toSessionsEpoch(
                        locations[locations.length - 1].created_at
                    );
                    const newestLocationEpoch = toSessionsEpoch(
                        locations[0].created_at
                    );
                    const isEntireBatchAfterRange =
                        Boolean(sessionsDateTo.value) &&
                        oldestLocationEpoch >
                            toSessionsEpoch(sessionsDateTo.value);
                    const reachedRangeStart =
                        Boolean(sessionsDateFrom.value) &&
                        newestLocationEpoch <
                            toSessionsEpoch(sessionsDateFrom.value);

                    if (inRangeLocations.length === 0) {
                        if (reachedRangeStart || !hasExtraTail) {
                            hasMore = false;
                            break;
                        }
                        beforeId = locations[locations.length - 1].id;
                        hasMore = hasExtraTail || isEntireBatchAfterRange;
                        continue;
                    }

                    const events =
                        await fetchEventsForLocations(inRangeLocations);
                    sessionsRawLocations.value = [
                        ...sessionsRawLocations.value,
                        ...inRangeLocations
                    ];
                    sessionsRawEvents.value = [
                        ...sessionsRawEvents.value,
                        ...events
                    ];
                    beforeId = locations[locations.length - 1].id;
                    rebuildSessions();
                    hasMore = hasExtraTail && !reachedRangeStart;
                }
                sessionsCursor.value = beforeId;
                sessionsHasMore.value = hasMore;
                return;
            }

            const locations = await database.getSessionsLocationSegments(
                null,
                fetchCount
            );
            if (locations.length === 0) {
                sessionsRawLocations.value = [];
                sessionsRawEvents.value = [];
                sessionsSegments.value = [];
                sessionsHasMore.value = false;
                return;
            }

            // Drop last segment for boundary cleanliness
            const hasExtraTail = locations.length >= fetchCount;
            if (hasExtraTail) {
                locations.pop();
            }

            const events = await fetchEventsForLocations(locations);
            sessionsRawLocations.value = locations;
            sessionsRawEvents.value = events;
            rebuildSessions();

            sessionsCursor.value = locations[locations.length - 1].id;
            sessionsHasMore.value = hasExtraTail;
        } finally {
            sessionsLoading.value = false;
        }
    }

    /**
     * Load more (older) session segments for infinite scroll.
     */
    async function loadMoreSessionsSegments() {
        if (sessionsLoading.value || !sessionsHasMore.value) return;
        sessionsLoading.value = true;
        try {
            const batchBudget = Math.max(
                3,
                Math.ceil(vrcxStore.maxTableSize / 100)
            );
            const fetchCount = batchBudget + 1;

            if (isSessionsGlobalSearchMode()) {
                let beforeId = sessionsCursor.value;
                let hasMore = /** @type {boolean} */ (sessionsHasMore.value);
                const previousCount = sessionsSegments.value.length;
                let attempts = 0;

                while (
                    hasMore &&
                    beforeId != null &&
                    sessionsSegments.value.length < vrcxStore.searchLimit &&
                    sessionsSegments.value.length === previousCount &&
                    attempts < SESSIONS_SEARCH_BATCH_ATTEMPTS
                ) {
                    const nextBatch = await loadSessionsSearchBatch(
                        beforeId,
                        fetchCount
                    );
                    beforeId = nextBatch.beforeId;
                    hasMore = nextBatch.hasMore;
                    attempts += 1;
                }

                sessionsCursor.value = beforeId;
                sessionsHasMore.value = hasMore;
                return;
            }

            const moreLocations = await database.getSessionsLocationSegments(
                sessionsCursor.value,
                fetchCount
            );
            if (moreLocations.length === 0) {
                sessionsHasMore.value = false;
                return;
            }

            const hasExtraTail = moreLocations.length >= fetchCount;
            if (hasExtraTail) {
                moreLocations.pop();
            }

            const moreEvents = await fetchEventsForLocations(moreLocations);

            sessionsRawLocations.value = [
                ...sessionsRawLocations.value,
                ...moreLocations
            ];
            sessionsRawEvents.value = [
                ...sessionsRawEvents.value,
                ...moreEvents
            ];
            rebuildSessions();

            sessionsCursor.value = moreLocations[moreLocations.length - 1].id;
            sessionsHasMore.value =
                hasExtraTail &&
                (!sessionsDateRangeActive.value ||
                    toSessionsEpoch(
                        moreLocations[moreLocations.length - 1].created_at
                    ) >= toSessionsEpoch(sessionsDateFrom.value));
        } finally {
            sessionsLoading.value = false;
        }
    }

    /**
     * Jump to a time anchor (load segments from N hours ago).
     * @param {number} hours - how many hours back
     */
    async function jumpToSessionsAnchor(hours) {
        if (sessionsLoading.value) return;
        sessionsLoading.value = true;
        try {
            const sinceDate = new Date(
                Date.now() - hours * 3600 * 1000
            ).toISOString();
            const maxSegments = Math.max(
                10,
                Math.ceil(vrcxStore.maxTableSize / 25)
            );

            const locations =
                await database.getSessionsLocationSegmentsByAnchor(
                    sinceDate,
                    maxSegments + 1
                );
            if (locations.length === 0) {
                sessionsRawLocations.value = [];
                sessionsRawEvents.value = [];
                sessionsSegments.value = [];
                sessionsHasMore.value = false;
                sessionsCursor.value = null;
                return;
            }

            // Drop last segment for boundary cleanliness
            const hasExtraTail = locations.length > maxSegments;
            if (hasExtraTail) {
                locations.pop();
            }

            const events = await fetchEventsForLocations(locations);
            sessionsRawLocations.value = locations;
            sessionsRawEvents.value = events;
            rebuildSessions();

            sessionsCursor.value = locations[locations.length - 1].id;
            sessionsHasMore.value = true;
        } finally {
            sessionsLoading.value = false;
        }
    }

    /**
     * Fetch events (join/leave + video) for a batch of location segments.
     * @param {Array<object>} locations
     * @returns {Promise<Array<object>>}
     */
    async function fetchEventsForLocations(locations) {
        const locationTags = [...new Set(locations.map((l) => l.location))];
        const dates = locations.map((l) => new Date(l.created_at).getTime());
        const minDate = new Date(Math.min(...dates) - 86400000).toISOString();
        const maxDate = new Date(Math.max(...dates) + 86400000).toISOString();
        const events = await database.getSessionsEventsForSegments(
            locationTags,
            minDate,
            maxDate
        );
        for (const e of events) {
            e.isFriend = gameLogIsFriend(e);
            e.isFavorite = gameLogIsFavorite(e);
        }
        return events;
    }

    async function toggleSessionsVipFilter() {
        sessionsVipFilter.value = !sessionsVipFilter.value;
        if (isSessionsGlobalSearchMode()) {
            await loadSessionsSegments();
            return;
        }
        rebuildSessions();
    }

    /**
     * Append a real-time entry to the sessions raw data and rebuild.
     * Only handles event types relevant to the sessions view.
     * @param {object} entry
     */
    function appendSessionsEntry(entry) {
        const type = entry.type;
        if (
            type !== 'OnPlayerJoined' &&
            type !== 'OnPlayerLeft' &&
            type !== 'VideoPlay' &&
            type !== 'Location'
        ) {
            return;
        }

        if (type === 'Location') {
            // Add a new location segment
            sessionsRawLocations.value = [
                {
                    id: entry.rowId || Date.now(),
                    created_at: entry.created_at,
                    location: entry.location,
                    worldId: entry.worldId,
                    worldName: entry.worldName,
                    time: entry.time,
                    groupName: entry.groupName || ''
                },
                ...sessionsRawLocations.value
            ];
        } else {
            // Append event
            sessionsRawEvents.value = [
                ...sessionsRawEvents.value,
                {
                    type,
                    created_at: entry.created_at,
                    displayName: entry.displayName,
                    userId: entry.userId,
                    location: entry.location,
                    videoUrl: entry.videoUrl,
                    videoName: entry.videoName,
                    videoId: entry.videoId,
                    isFriend: entry.isFriend,
                    isFavorite: entry.isFavorite
                }
            ];
        }
        rebuildSessionsDebounced();
    }

    /**
     * Switch between sessions and table view.
     * @param {'sessions'|'table'} mode
     */
    async function setSessionsViewMode(mode) {
        if (mode !== 'sessions' && mode !== 'table') {
            return;
        }
        if (sessionsViewMode.value === mode) {
            return;
        }
        sessionsViewMode.value = mode;
        await configRepository.setString('VRCX_gameLogViewMode', mode);
        if (mode === 'table') {
            initGameLogTable();
        } else {
            gameLogTableData.value = [];
            loadSessionsSegments();
        }
    }

    return {
        state,

        nowPlaying,
        gameLogTable,
        gameLogTableData,
        lastVideoUrl,
        lastResourceloadUrl,
        latestGameLogEntry,

        // Sessions view state
        sessionsViewMode,
        sessionsSegments,
        sessionsLoading,
        sessionsHasMore,
        sessionsVipFilter,
        sessionsEventFilters,
        sessionsSearch,
        sessionsDateFrom,
        sessionsDateTo,
        sessionsEventFilterSelection,
        sessionsDateRangeActive,
        sessionsEventFilterTypes: SESSIONS_EVENT_FILTER_TYPES,
        sessionsDateRangeMaxDays: SESSIONS_DATE_RANGE_MAX_DAYS,

        clearNowPlaying,
        resetLastMediaUrls,
        gameLogIsFriend,
        gameLogIsFavorite,
        gameLogTableLookup,
        addGameLog,
        addGamelogLocationToDatabase,

        // Sessions view methods
        loadSessionsSegments,
        loadMoreSessionsSegments,
        jumpToSessionsAnchor,
        setSessionsViewMode,
        toggleSessionsVipFilter,
        handleSessionsEventFilterChange,
        setSessionsSearch,
        setSessionsDateRange,
        clearSessionsDateRange,

        // Media parsers (used by coordinator)
        addGameLogVideo,
        addGameLogPyPyDance,
        addGameLogVRDancing,
        addGameLogZuwaZuwaDance,
        addGameLogLSMedia,
        addGameLogPopcornPalace,
        setLastVideoUrl,
        setLastResourceloadUrl
    };
});
