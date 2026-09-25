<template>
    <div class="x-container x-container--auto-height" ref="playerListRef">
        <ResizablePanelGroup
            v-if="hasSummaryContent"
            ref="playerListLayoutRef"
            direction="vertical"
            class="player-list__layout min-h-0"
            @layout="handlePlayerListLayout">
            <ResizablePanel
                ref="playerListSummaryPanelRef"
                :default-size="summarySize"
                :min-size="summaryMinSize"
                :max-size="summaryMaxSize"
                :order="1">
                <div class="player-list__summary h-full min-h-0 overflow-y-auto overflow-x-hidden pr-1">
                    <div
                        v-if="currentInstanceWorld.ref.id"
                        ref="playerListHeaderRef"
                        style="display: flex; min-height: 120px"
                        class="mb-3">
                        <img
                            v-if="!worldImageError"
                            :src="currentInstanceWorld.ref.thumbnailImageUrl"
                            class="cursor-pointer"
                            style="flex: none; width: 160px; height: 120px; border-radius: var(--radius-md)"
                            @click="showFullscreenImageDialog(currentInstanceWorld.ref.imageUrl)"
                            @error="worldImageError = true"
                            loading="lazy" />
                        <div
                            v-else
                            class="flex items-center justify-center bg-muted"
                            style="flex: none; width: 160px; height: 120px; border-radius: var(--radius-md)">
                            <Image class="size-8 text-muted-foreground" />
                        </div>
                        <div class="ml-2" style="display: flex; flex-direction: column; min-width: 320px; width: 100%">
                            <div class="flex items-center">
                                <span
                                    class="cursor-pointer"
                                    style="
                                        font-weight: bold;
                                        overflow: hidden;
                                        text-overflow: ellipsis;
                                        display: -webkit-box;
                                        -webkit-box-orient: vertical;
                                        line-clamp: 1;
                                    "
                                    @click="showWorldDialog(currentInstanceWorld.ref.id)">
                                    <Home
                                        v-if="
                                            currentUser.$homeLocation &&
                                            currentUser.$homeLocation.worldId === currentInstanceWorld.ref.id
                                        "
                                        class="inline-block" />
                                    {{ currentInstanceWorld.ref.name }}
                                </span>
                            </div>
                            <div>
                                <span
                                    class="cursor-pointer x-grey font-mono"
                                    @click="showUserDialog(currentInstanceWorld.ref.authorId)"
                                    v-text="currentInstanceWorld.ref.authorName"></span>
                            </div>
                            <div class="mt-1.5">
                                <Badge class="mr-1.5" v-if="currentInstanceWorld.ref.$isLabs" variant="outline">
                                    {{ t('dialog.world.tags.labs') }}
                                </Badge>
                                <Badge
                                    class="mr-1.5"
                                    v-else-if="currentInstanceWorld.ref.releaseStatus === 'public'"
                                    variant="outline">
                                    {{ t('dialog.world.tags.public') }}
                                </Badge>
                                <Badge
                                    class="mr-1.5"
                                    v-else-if="currentInstanceWorld.ref.releaseStatus === 'private'"
                                    variant="outline">
                                    {{ t('dialog.world.tags.private') }}
                                </Badge>
                                <TooltipWrapper v-if="currentInstanceWorld.isPC" side="top" content="PC">
                                    <Badge class="text-platform-pc border-platform-pc! mr-1.5" variant="outline"
                                        ><Monitor class="h-4 w-4" />
                                        <span
                                            v-if="currentInstanceWorld.fileAnalysis.standalonewindows?._fileSize"
                                            class="x-grey text-platform-pc border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px"
                                            >{{ currentInstanceWorld.fileAnalysis.standalonewindows._fileSize }}</span
                                        >
                                    </Badge>
                                </TooltipWrapper>
                                <TooltipWrapper v-if="currentInstanceWorld.isQuest" side="top" content="Android">
                                    <Badge class="text-platform-quest border-platform-quest! mr-1.5" variant="outline"
                                        ><Smartphone class="h-4 w-4" />
                                        <span
                                            v-if="currentInstanceWorld.fileAnalysis.android?._fileSize"
                                            class="x-grey text-platform-quest border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px"
                                            >{{ currentInstanceWorld.fileAnalysis.android._fileSize }}</span
                                        >
                                    </Badge>
                                </TooltipWrapper>
                                <TooltipWrapper v-if="currentInstanceWorld.isIos" side="top" content="iOS">
                                    <Badge class="text-platform-ios border-platform-ios mr-1.5" variant="outline"
                                        ><Apple class="h-4 w-4 text-platform-ios" />
                                        <span
                                            v-if="currentInstanceWorld.fileAnalysis.ios?._fileSize"
                                            class="x-grey text-platform-ios border-platform-ios border-l-[0.8px] border-solid ml-1.5 pl-1.5 pb-px"
                                            >{{ currentInstanceWorld.fileAnalysis.ios._fileSize }}</span
                                        >
                                    </Badge>
                                </TooltipWrapper>
                                <Badge
                                    class="mr-1.5 mt-1.5"
                                    v-if="currentInstanceWorld.avatarScalingDisabled"
                                    variant="outline">
                                    {{ t('dialog.world.tags.avatar_scaling_disabled') }}
                                </Badge>
                                <Badge class="mr-1.5" v-if="currentInstanceWorld.inCache" variant="outline">
                                    <span>{{ currentInstanceWorld.cacheSize }} {{ t('dialog.world.tags.cache') }}</span>
                                </Badge>
                            </div>
                            <div class="mt-1.5">
                        <LocationWorld
                            :locationobject="currentInstanceLocation"
                            :currentuserid="currentUser.id"
                            class="w-fit" />
                                <span class="ml-1.5" v-if="lastLocation.playerList.size > 0">
                                    {{ lastLocation.playerList.size }}
                                    <template v-if="lastLocation.friendList.size > 0"
                                        >({{ lastLocation.friendList.size }})</template
                                    >
                                    &nbsp;&horbar; <Timer v-if="lastLocation.date" :epoch="lastLocation.date" />
                                </span>
                            </div>
                            <div class="mt-1.5">
                                <span
                                    v-show="currentInstanceWorld.ref.name !== currentInstanceWorld.ref.description"
                                    class="inline-block max-w-full align-middle text-xs break-words"
                                    v-text="currentInstanceWorld.ref.description"></span>
                            </div>
                        </div>
                        <div
                            class="player-list__summary-action ml-5 flex w-28 shrink-0 items-start justify-end pr-1 pt-1">
                            <InstancePlayerEventsPopover
                                :location="currentInstanceTag"
                                :instance-start-time="currentInstanceStartTime" />
                        </div>
                        <div class="ml-5" style="display: flex; flex-direction: column">
                            <div class="box-border flex items-center p-1.5 text-[13px] cursor-default">
                                <div class="flex-1 overflow-hidden">
                                    <span class="block truncate font-medium leading-[18px]">{{
                                        t('dialog.world.info.capacity')
                                    }}</span>
                                    <span class="block truncate text-xs"
                                        >{{ commaNumber(currentInstanceWorld.ref.recommendedCapacity) }} ({{
                                            commaNumber(currentInstanceWorld.ref.capacity)
                                        }})</span
                                    >
                                </div>
                            </div>
                            <div class="box-border flex items-center p-1.5 text-[13px] cursor-default">
                                <div class="flex-1 overflow-hidden">
                                    <span class="block truncate font-medium leading-[18px]">{{
                                        t('dialog.world.info.last_updated')
                                    }}</span>
                                    <span class="block truncate text-xs">{{
                                        formatDateFilter(
                                            currentInstanceWorld.fileAnalysis.standalonewindows?.created_at,
                                            'long'
                                        )
                                    }}</span>
                                </div>
                            </div>
                            <div class="box-border flex items-center p-1.5 text-[13px] cursor-default">
                                <div class="flex-1 overflow-hidden">
                                    <span class="block truncate font-medium leading-[18px]">{{
                                        t('dialog.world.info.created_at')
                                    }}</span>
                                    <span class="block truncate text-xs">{{
                                        formatDateFilter(currentInstanceWorld.ref.created_at, 'long')
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="!currentInstanceWorld.ref.id" class="mb-2 flex justify-end">
                        <InstancePlayerEventsPopover
                            :location="currentInstanceTag"
                            :instance-start-time="currentInstanceStartTime" />
                    </div>
                    <div class="mb-2" v-if="photonLoggingEnabled" ref="playerListPhotonRef">
                        <PhotonEventTable @show-chatbox-blacklist="showChatboxBlacklistDialog" />
                    </div>
                </div>
            </ResizablePanel>

            <ResizableHandle
                class="player-list__splitter"
                title="双击恢复自适应"
                @dragging="handlePlayerListSplitterDragging"
                @dblclick="resetPlayerListAdaptiveLayout" />

            <ResizablePanel :default-size="100 - summarySize" :min-size="tableMinSize" :order="2">
                <div class="current-instance-table flex h-full min-h-0 min-w-0 flex-col">
                    <DataTableLayout
                        class="[&_th]:px-2.5! [&_th]:py-0.75! [&_td]:px-2.5! [&_td]:py-0.75!"
                        :table="playerListTable"
                        auto-height
                        :loading="false"
                        :show-pagination="false"
                        :on-row-click="handlePlayerListRowClick">
                        <template #row-context-menu="{ row }">
                            <UserContextMenuContent
                                v-if="row.original?.ref?.id"
                                :user-id="row.original.ref.id"
                                state="online"
                                :location="currentInstanceTag"
                                in-current-instance>
                                <template #append>
                                    <ContextMenuItem
                                        v-if="getPlayerDisplayName(row.original)"
                                        @click="copyToClipboard(getPlayerDisplayName(row.original))">
                                        <Copy class="size-4" />
                                        {{ t('dialog.user.info.copy_display_name') }}
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        v-if="row.original.ref.id"
                                        @click="copyToClipboard(row.original.ref.id)">
                                        <IdCard class="size-4" />
                                        {{ t('dialog.user.info.copy_id') }}
                                    </ContextMenuItem>
                                </template>
                            </UserContextMenuContent>
                            <ContextMenuContent v-else>
                                <ContextMenuItem @click="selectCurrentInstanceRow(row.original)">
                                    <ExternalLink class="size-4" />
                                    {{ t('common.actions.view_details') }}
                                </ContextMenuItem>
                                <ContextMenuItem
                                    v-if="getPlayerDisplayName(row.original)"
                                    @click="copyToClipboard(getPlayerDisplayName(row.original))">
                                    <Copy class="size-4" />
                                    {{ t('dialog.user.info.copy_display_name') }}
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </template>
                    </DataTableLayout>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>

        <div v-else class="current-instance-table flex h-full min-h-0 min-w-0 flex-col">
            <div class="player-list__table-toolbar flex shrink-0 items-center border-b border-border px-1 py-1">
                <div class="ml-auto flex shrink-0">
                    <InstancePlayerEventsPopover
                        :location="currentInstanceTag"
                        :instance-start-time="currentInstanceStartTime" />
                </div>
            </div>
            <DataTableLayout
                class="[&_th]:px-2.5! [&_th]:py-0.75! [&_td]:px-2.5! [&_td]:py-0.75!"
                :table="playerListTable"
                auto-height
                :loading="false"
                :show-pagination="false"
                :on-row-click="handlePlayerListRowClick">
                <template #row-context-menu="{ row }">
                    <UserContextMenuContent
                        v-if="row.original?.ref?.id"
                        :user-id="row.original.ref.id"
                        state="online"
                        :location="currentInstanceTag"
                        in-current-instance>
                        <template #append>
                            <ContextMenuItem
                                v-if="getPlayerDisplayName(row.original)"
                                @click="copyToClipboard(getPlayerDisplayName(row.original))">
                                <Copy class="size-4" />
                                {{ t('dialog.user.info.copy_display_name') }}
                            </ContextMenuItem>
                            <ContextMenuItem
                                v-if="row.original.ref.id"
                                @click="copyToClipboard(row.original.ref.id)">
                                <IdCard class="size-4" />
                                {{ t('dialog.user.info.copy_id') }}
                            </ContextMenuItem>
                        </template>
                    </UserContextMenuContent>
                    <ContextMenuContent v-else>
                        <ContextMenuItem @click="selectCurrentInstanceRow(row.original)">
                            <ExternalLink class="size-4" />
                            {{ t('common.actions.view_details') }}
                        </ContextMenuItem>
                        <ContextMenuItem
                            v-if="getPlayerDisplayName(row.original)"
                            @click="copyToClipboard(getPlayerDisplayName(row.original))">
                            <Copy class="size-4" />
                            {{ t('dialog.user.info.copy_display_name') }}
                        </ContextMenuItem>
                    </ContextMenuContent>
                </template>
            </DataTableLayout>
        </div>
        <ChatboxBlacklistDialog
            :chatbox-blacklist-dialog="chatboxBlacklistDialog"
            @delete-chatbox-user-blacklist="deleteChatboxUserBlacklist" />
    </div>
</template>

<script setup>
    import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { Apple, Copy, ExternalLink, Home, IdCard, Image, Monitor, Smartphone } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import {
        useAppearanceSettingsStore,
        useGalleryStore,
        useInstanceStore,
        useLocationStore,
        usePhotonStore,
        useUserStore
    } from '../../stores';
    import { commaNumber, copyToClipboard, formatDateFilter } from '../../shared/utils';
    import { Badge } from '../../components/ui/badge';
    import { DataTableLayout } from '../../components/ui/data-table';
    import { ContextMenuContent, ContextMenuItem } from '../../components/ui/context-menu';
    import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable';
    import { createColumns } from './columns.jsx';
    import { useVrcxVueTable } from '../../lib/table/useVrcxVueTable';
    import { calculatePlayerListLayout } from './playerListLayout';

    import ChatboxBlacklistDialog from './dialogs/ChatboxBlacklistDialog.vue';
    import Timer from '../../components/Timer.vue';
    import { showUserDialog, lookupUser } from '../../coordinators/userCoordinator';
    import { showWorldDialog } from '../../coordinators/worldCoordinator';

    import PhotonEventTable from './components/PhotonEventTable.vue';
    import InstancePlayerEventsPopover from './components/InstancePlayerEventsPopover.vue';
    import { useUserDisplay } from '../../composables/useUserDisplay';
    import UserContextMenuContent from '../../components/UserContextMenuContent.vue';

    const { randomUserColours } = storeToRefs(useAppearanceSettingsStore());
    const { userImage } = useUserDisplay();
    const photonStore = usePhotonStore();
    const { photonLoggingEnabled, chatboxUserBlacklist } = storeToRefs(photonStore);
    const { saveChatboxUserBlacklist } = photonStore;

    const { lastLocation, lastLocationDestination, lastLocationDestinationTime } = storeToRefs(useLocationStore());
    const {
        currentInstanceLocation,
        currentInstanceWorld,
        currentInstanceUsersData,
        instanceJoinHistory
    } = storeToRefs(useInstanceStore());

    const worldImageError = ref(false);

    watch(
        () => currentInstanceWorld.value?.ref?.id,
        () => {
            worldImageError.value = false;
        }
    );
    const { getCurrentInstanceUserList } = useInstanceStore();
    const { showFullscreenImageDialog } = useGalleryStore();
    const { currentUser } = storeToRefs(useUserStore());

    const playerListRef = ref(null);
    const playerListLayoutRef = ref(null);
    const playerListSummaryPanelRef = ref(null);
    const playerListHeaderRef = ref(null);
    const playerListPhotonRef = ref(null);
    const summarySize = ref(42);
    const summaryMinSize = ref(20);
    const summaryMaxSize = ref(68);
    const tableMinSize = ref(32);
    const currentSummarySize = ref(42);
    const isPlayerListSplitterDragging = ref(false);
    const summaryOffset = ref(0);
    const summaryOffsetStorageKey = 'VRCX_playerListSummaryOffset';
    const legacyManualLayoutStorageKey = 'VRCX_playerListLayoutManual';
    const legacyPanelLayoutStorageKey = 'reka:player-list-layout';
    let playerListResizeObserver = null;

    const hasSummaryContent = computed(
        () => Boolean(currentInstanceWorld.value?.ref?.id) || Boolean(photonLoggingEnabled.value)
    );
    const currentInstanceTag = computed(() => currentInstanceLocation.value?.tag || '');
    const currentInstanceStartTime = computed(() => {
        const instanceTag = currentInstanceTag.value;
        if (!instanceTag) {
            return null;
        }

        const currentLocation = lastLocation.value;
        if (currentLocation?.location === instanceTag && currentLocation.date) {
            return currentLocation.date;
        }
        if (
            currentLocation?.location === 'traveling' &&
            lastLocationDestination.value === instanceTag &&
            lastLocationDestinationTime.value
        ) {
            return lastLocationDestinationTime.value;
        }

        const currentUserLocation = currentUser.value;
        if (currentUserLocation?.$locationTag === instanceTag && currentUserLocation.$location_at) {
            return currentUserLocation.$location_at;
        }

        const cachedStartTime = instanceJoinHistory.value?.get?.(instanceTag);
        if (cachedStartTime) {
            return cachedStartTime;
        }
        return null;
    });

    function getElement(componentRef) {
        return componentRef?.$el ?? componentRef ?? null;
    }

    function getSummaryContentHeight() {
        const headerHeight = playerListHeaderRef.value?.scrollHeight || 0;
        const photonHeight = playerListPhotonRef.value?.scrollHeight || 0;
        return headerHeight + photonHeight + (headerHeight ? 12 : 0) + (photonHeight ? 8 : 0);
    }

    function updatePlayerListAdaptiveLayout() {
        const layoutElement = getElement(playerListLayoutRef.value);
        const containerHeight = layoutElement?.getBoundingClientRect?.().height || 0;
        const layout = calculatePlayerListLayout({
            containerHeight,
            summaryContentHeight: getSummaryContentHeight(),
            summaryOffset: summaryOffset.value
        });

        summaryMinSize.value = layout.summaryMinSize;
        summaryMaxSize.value = layout.summaryMaxSize;
        tableMinSize.value = layout.tableMinSize;

        summarySize.value = layout.summarySize;
        if (!isPlayerListSplitterDragging.value) {
            playerListSummaryPanelRef.value?.resize?.(layout.summarySize);
        }
    }

    function refreshPlayerListResizeObserver() {
        playerListResizeObserver?.disconnect();
        playerListResizeObserver = null;

        if (typeof ResizeObserver === 'undefined') {
            updatePlayerListAdaptiveLayout();
            return;
        }

        playerListResizeObserver = new ResizeObserver(updatePlayerListAdaptiveLayout);
        for (const element of [
            getElement(playerListLayoutRef.value),
            playerListHeaderRef.value,
            playerListPhotonRef.value
        ]) {
            if (element) {
                playerListResizeObserver.observe(element);
            }
        }
        updatePlayerListAdaptiveLayout();
    }

    function handlePlayerListLayout(sizes) {
        if (Array.isArray(sizes) && Number.isFinite(sizes[0])) {
            currentSummarySize.value = sizes[0];
        }
    }

    function handlePlayerListSplitterDragging(dragging) {
        const isDragging = Boolean(dragging?.detail ?? dragging?.dragging ?? dragging);
        if (isPlayerListSplitterDragging.value && !isDragging) {
            const layoutElement = getElement(playerListLayoutRef.value);
            const containerHeight = layoutElement?.getBoundingClientRect?.().height || 0;
            if (containerHeight > 0) {
                const adaptiveLayout = calculatePlayerListLayout({
                    containerHeight,
                    summaryContentHeight: getSummaryContentHeight(),
                    summaryOffset: 0
                });
                const actualHeight = (currentSummarySize.value / 100) * containerHeight;
                const adaptiveHeight = (adaptiveLayout.summarySize / 100) * containerHeight;
                summaryOffset.value = actualHeight - adaptiveHeight;
                const roomTag = currentInstanceLocation.value?.tag;
                if (roomTag) {
                    localStorage.setItem(
                        summaryOffsetStorageKey,
                        JSON.stringify({
                            roomTag,
                            offset: summaryOffset.value
                        })
                    );
                }
            }
        }
        isPlayerListSplitterDragging.value = isDragging;
    }

    function resetPlayerListAdaptiveLayout() {
        summaryOffset.value = 0;
        localStorage.removeItem(summaryOffsetStorageKey);
        updatePlayerListAdaptiveLayout();
    }

    const { t } = useI18n();

    const chatboxBlacklistDialog = ref({
        visible: false,
        loading: false
    });

    /**
     *
     */
    function showChatboxBlacklistDialog() {
        const D = chatboxBlacklistDialog.value;
        D.visible = true;
    }

    /**
     *
     * @param val
     */
    function selectCurrentInstanceRow(val) {
        if (val === null) {
            return;
        }
        const ref = val.ref;
        if (ref.id) {
            showUserDialog(ref.id);
        } else {
            lookupUser(ref);
        }
    }

    function getPlayerDisplayName(player) {
        return player?.displayName || player?.ref?.displayName || '';
    }

    /**
     *
     * @param userId
     */
    async function deleteChatboxUserBlacklist(userId) {
        chatboxUserBlacklist.value.delete(userId);
        await saveChatboxUserBlacklist();
        getCurrentInstanceUserList();
    }

    /**
     *
     * @param user
     */
    async function addChatboxUserBlacklist(user) {
        chatboxUserBlacklist.value.set(user.id, user.displayName);
        await saveChatboxUserBlacklist();
        getCurrentInstanceUserList();
    }

    /**
     *
     * @param a
     * @param b
     * @param field
     */
    function sortAlphabetically(a, b, field) {
        if (!a[field] || !b[field]) return 0;
        return a[field].toLowerCase().localeCompare(b[field].toLowerCase());
    }

    const playerListColumns = computed(() =>
        createColumns({
            randomUserColours,
            chatboxUserBlacklist,
            onBlockChatbox: addChatboxUserBlacklist,
            onUnblockChatbox: deleteChatboxUserBlacklist,
            sortAlphabetically,
            userImage
        })
    );

    const { table: playerListTable } = useVrcxVueTable({
        persistKey: 'playerList',
        get data() {
            return currentInstanceUsersData.value;
        },
        columns: playerListColumns,
        enablePagination: false,
        getRowId: (row) => `${row?.ref?.id ?? ''}:${row?.displayName ?? ''}`
    });

    watch(
        playerListColumns,
        (next) => {
            playerListTable.setOptions((prev) => ({
                ...prev,
                columns: next
            }));
        },
        { immediate: true }
    );

    watch(
        photonLoggingEnabled,
        (enabled) => {
            const column = playerListTable?.getColumn?.('photonId');
            if (!column) {
                return;
            }
            column.toggleVisibility(Boolean(enabled));
        },
        { immediate: true }
    );

    const handlePlayerListRowClick = (row) => {
        selectCurrentInstanceRow(row?.original ?? null);
    };

    onMounted(async () => {
        getCurrentInstanceUserList();
        try {
            const storedLayout = JSON.parse(localStorage.getItem(summaryOffsetStorageKey) ?? 'null');
            const roomTag = currentInstanceLocation.value?.tag;
            if (storedLayout?.roomTag === roomTag && Number.isFinite(storedLayout?.offset)) {
                summaryOffset.value = storedLayout.offset;
            } else {
                localStorage.removeItem(summaryOffsetStorageKey);
            }
        } catch {
            localStorage.removeItem(summaryOffsetStorageKey);
        }
        localStorage.removeItem(legacyManualLayoutStorageKey);
        localStorage.removeItem(legacyPanelLayoutStorageKey);
        await nextTick();
        refreshPlayerListResizeObserver();
    });

    onActivated(async () => {
        getCurrentInstanceUserList();
        await nextTick();
        refreshPlayerListResizeObserver();
    });

    watch(
        () => [
            currentInstanceWorld.value?.ref?.id,
            currentInstanceWorld.value?.ref?.description,
            photonLoggingEnabled.value
        ],
        async () => {
            await nextTick();
            refreshPlayerListResizeObserver();
        }
    );

    watch(
        () => currentInstanceLocation.value?.tag,
        async (roomTag, previousRoomTag) => {
            if (roomTag === previousRoomTag) {
                return;
            }
            summaryOffset.value = 0;
            localStorage.removeItem(summaryOffsetStorageKey);
            await nextTick();
            refreshPlayerListResizeObserver();
        }
    );

    onBeforeUnmount(() => {
        playerListResizeObserver?.disconnect();
        playerListResizeObserver = null;
    });
</script>

<style scoped>
    .player-list__splitter {
        position: relative;
        z-index: 2;
        width: 100% !important;
        height: 0.625rem !important;
        flex: 0 0 0.625rem;
        cursor: row-resize;
        background: transparent !important;
        outline: none;
    }

    .player-list__splitter::before {
        position: absolute;
        top: 50%;
        right: 0;
        left: 0;
        height: 1px;
        content: '';
        background: color-mix(in srgb, var(--border) 74%, transparent);
        transform: translateY(-50%);
        transition:
            background-color 140ms ease-out,
            box-shadow 140ms ease-out;
    }

    .player-list__splitter:hover::before,
    .player-list__splitter:focus-visible::before,
    .player-list__splitter[data-resize-handle-active]::before {
        background: var(--primary);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent);
    }
</style>
