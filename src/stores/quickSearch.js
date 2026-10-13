import { computed, effectScope, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useFriendStore } from './friend';
import { useSearchIndexStore } from './searchIndex';
import { useUserStore } from './user';
import { showGroupDialog } from '../coordinators/groupCoordinator';
import { showWorldDialog } from '../coordinators/worldCoordinator';
import { showAvatarDialog } from '../coordinators/avatarCoordinator';
import { showUserDialog } from '../coordinators/userCoordinator';
import { database } from '../services/database';

import QuickSearchWorker from './quickSearchWorker.js?worker&inline';

export const useQuickSearchStore = defineStore('QuickSearch', () => {
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const searchIndexStore = useSearchIndexStore();

    const isOpen = ref(false);
    const query = ref('');

    // Worker instance (lazy)
    let worker = null;
    let indexUpdateTimer = null;
    let indexWatchScope = null;

    function getWorker() {
        if (!worker) {
            worker = new QuickSearchWorker();
            worker.onmessage = handleWorkerMessage;
        }
        return worker;
    }

    function disposeWorker() {
        if (!worker) return;
        worker.terminate();
        worker = null;
    }

    // Search results (updated from worker messages)
    const friendResults = ref([]);
    const ownAvatarResults = ref([]);
    const favoriteAvatarResults = ref([]);
    const ownWorldResults = ref([]);
    const favoriteWorldResults = ref([]);
    const ownGroupResults = ref([]);
    const joinedGroupResults = ref([]);

    // Recently met / recently joined (source data, loaded when dialog opens)
    const recentlyMetUsers = ref([]);
    const recentlyJoinedLocations = ref([]);

    // Filtered recent results when query is active
    const recentlyMetResults = ref([]);
    const recentBeenResults = ref([]);

    const hasResults = computed(
        () =>
            friendResults.value.length > 0 ||
            ownAvatarResults.value.length > 0 ||
            favoriteAvatarResults.value.length > 0 ||
            ownWorldResults.value.length > 0 ||
            favoriteWorldResults.value.length > 0 ||
            ownGroupResults.value.length > 0 ||
            joinedGroupResults.value.length > 0 ||
            recentlyMetResults.value.length > 0 ||
            recentBeenResults.value.length > 0
    );

    const currentUserId = computed(() => userStore.currentUser?.id);

    async function loadRecentItems() {
        const userId = currentUserId.value;
        if (!userId) return;
        const [users, locations] = await Promise.all([
            database.getRecentlyMetUsers(userId, 8).catch(() => []),
            database.getRecentlyJoinedLocations(10).catch(() => [])
        ]);
        // Exclude friends from recently-met list
        recentlyMetUsers.value = users.filter(
            (u) => !friendStore.friends.has(u.userId)
        );
        recentlyJoinedLocations.value = locations;
        // Always filter/populate results (shows all items when query is empty)
        filterRecentByQuery(query.value);
    }

    function filterRecentByQuery(q) {
        if (!q) {
            // Show all loaded recent items in the empty-query (initial) state
            recentlyMetResults.value = recentlyMetUsers.value;
            recentBeenResults.value = recentlyJoinedLocations.value;
            return;
        }
        const lowerQ = q.toLowerCase();
        recentlyMetResults.value = recentlyMetUsers.value.filter((u) =>
            u.displayName?.toLowerCase().includes(lowerQ)
        );
        recentBeenResults.value = recentlyJoinedLocations.value.filter((l) =>
            l.worldName?.toLowerCase().includes(lowerQ)
        );
    }

    // Send index update to worker when data changes
    function scheduleIndexUpdate() {
        if (!isOpen.value) return;
        if (indexUpdateTimer) clearTimeout(indexUpdateTimer);
        indexUpdateTimer = setTimeout(() => {
            indexUpdateTimer = null;
            if (!isOpen.value) return;
            sendIndexUpdate();
            if (query.value && query.value.length >= 1) {
                dispatchSearch();
            }
        }, 200);
    }

    function sendIndexUpdate() {
        const w = getWorker();
        const payload = searchIndexStore.getSnapshot();
        w.postMessage({ type: 'updateIndex', payload });
    }

    function stopIndexWatchers() {
        if (indexUpdateTimer) {
            clearTimeout(indexUpdateTimer);
            indexUpdateTimer = null;
        }
        if (indexWatchScope) {
            indexWatchScope.stop();
            indexWatchScope = null;
        }
    }

    function startIndexWatchers() {
        if (indexWatchScope) return;

        indexWatchScope = effectScope();
        indexWatchScope.run(() => {
            watch(
                () => searchIndexStore.version,
                () => scheduleIndexUpdate()
            );
        });
    }

    let searchSeq = 0;

    function dispatchSearch() {
        const q = query.value;
        if (!q || q.trim().length === 0) {
            ++searchSeq;
            clearSearchResults();
            return;
        }
        const seq = ++searchSeq;
        const w = getWorker();
        w.postMessage({
            type: 'search',
            payload: {
                seq,
                query: q,
                currentUserId: currentUserId.value,
                language: navigator.language
            }
        });
    }

    watch(query, (q) => {
        dispatchSearch();
        filterRecentByQuery(q);
    });
    watch(currentUserId, () => {
        if (query.value && query.value.length >= 1) {
            dispatchSearch();
        }
    });

    watch(isOpen, (open) => {
        if (open) {
            startIndexWatchers();
            sendIndexUpdate();
            loadRecentItems();
            if (query.value && query.value.length >= 1) {
                dispatchSearch();
            }
            return;
        }

        query.value = '';
        clearAllSearchData();
        stopIndexWatchers();
        disposeWorker();
    });

    function handleWorkerMessage(event) {
        const { type, payload } = event.data;
        if (type === 'searchResult') {
            if (payload.seq !== searchSeq) return;

            // Enrich friend results with reactive ref from store
            // (Worker can't serialize Vue reactive objects)
            friendResults.value = payload.friends.map((item) => {
                const friendEntry = friendStore.friends.get(item.id);
                return { ...item, ref: friendEntry?.ref };
            });
            ownAvatarResults.value = payload.ownAvatars;
            favoriteAvatarResults.value = payload.favAvatars;
            ownWorldResults.value = payload.ownWorlds;
            favoriteWorldResults.value = payload.favWorlds;
            ownGroupResults.value = payload.ownGroups;
            joinedGroupResults.value = payload.joinedGroups;

            // Supplement with DB bio search (async, merges when ready)
            if (query.value) {
                supplementWithBioSearch(query.value, payload.seq);
            }
        }
    }

    async function supplementWithBioSearch(q, seq) {
        try {
            const bioResults = await database.searchBiosByContent(q);
            if (seq !== searchSeq) return; // query changed, discard

            const existingIds = new Set(friendResults.value.map((r) => r.id));
            const additions = [];
            for (const bio of bioResults) {
                if (existingIds.has(bio.userId)) continue;
                const friendCtx = friendStore.friends.get(bio.userId);
                if (!friendCtx) continue;
                additions.push({
                    id: bio.userId,
                    name: friendCtx.name || bio.displayName,
                    type: 'friend',
                    imageUrl:
                        friendCtx.ref?.currentAvatarThumbnailImageUrl || '',
                    memo: friendCtx.memo || '',
                    note: friendCtx.ref?.note || '',
                    bio: bio.bio || '',
                    matchedField: 'bio',
                    ref: friendCtx.ref
                });
            }
            if (additions.length > 0 && seq === searchSeq) {
                friendResults.value = [...friendResults.value, ...additions];
            }
        } catch (e) {
            console.warn('[QuickSearch] Bio DB search failed:', e);
        }
    }

    function clearSearchResults() {
        friendResults.value = [];
        ownAvatarResults.value = [];
        favoriteAvatarResults.value = [];
        ownWorldResults.value = [];
        favoriteWorldResults.value = [];
        ownGroupResults.value = [];
        joinedGroupResults.value = [];
        recentlyMetResults.value = [];
        recentBeenResults.value = [];
    }

    function clearAllSearchData() {
        clearSearchResults();
        recentlyMetUsers.value = [];
        recentlyJoinedLocations.value = [];
    }

    function open() {
        isOpen.value = true;
    }

    function close() {
        isOpen.value = false;
    }

    /**
     * @param {string} value
     */
    function setQuery(value) {
        query.value = value;
    }

    /**
     * @param {{id: string, type: string}} item
     */
    function selectResult(item) {
        if (!item) return;

        close();

        switch (item.type) {
            case 'friend':
                showUserDialog(item.id);
                break;
            case 'avatar':
                showAvatarDialog(item.id);
                break;
            case 'world':
                showWorldDialog(item.id);
                break;
            case 'group':
                showGroupDialog(item.id);
                break;
            case 'recentlyMet':
                showUserDialog(item.id);
                break;
            case 'recentlyJoined':
                showWorldDialog(item.id);
                break;
        }
    }

    return {
        isOpen,
        query,
        friendResults,
        ownAvatarResults,
        favoriteAvatarResults,
        ownWorldResults,
        favoriteWorldResults,
        ownGroupResults,
        joinedGroupResults,
        recentlyMetUsers,
        recentlyJoinedLocations,
        recentlyMetResults,
        recentBeenResults,
        hasResults,

        open,
        close,
        setQuery,
        selectResult
    };
});
