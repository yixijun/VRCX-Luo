<template>
    <div
        class="shrink-0 h-[22px] flex items-center bg-sidebar border-t border-border text-xs select-none overflow-hidden"
        style="font-family: var(--font-mono-cjk)"
        @contextmenu.prevent>
        <ContextMenu>
            <ContextMenuTrigger as-child>
                <div class="flex items-center w-full h-full px-2">
                    <!-- Multi-account view mode switcher (only when secondary sessions are active) -->
                    <template v-if="false && hasSecondarySessions">
                        <Popover v-model:open="viewModePopoverOpen">
                            <PopoverTrigger as-child>
                                <div
                                    class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border cursor-pointer hover:bg-accent shrink-0"
                                    :title="t('status_bar.view_mode')">
                                    <span
                                        class="inline-block size-2 rounded-full shrink-0"
                                        :style="{ background: viewModeColor }" />
                                    <span class="text-[11px] text-foreground">{{ viewModeLabel }}</span>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent side="top" class="w-48 p-1">
                                <div
                                    class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-xs"
                                    :class="{ 'bg-accent': isMergedView }"
                                    @click="selectViewMode('merged')">
                                    <span class="inline-block size-2 rounded-full bg-foreground/40" />
                                    {{ t('status_bar.view_merged') }}
                                </div>
                                <div
                                    v-for="[id, session] in allSessions"
                                    :key="id"
                                    class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-xs"
                                    :class="{ 'bg-accent': currentViewMode === `account:${id}` || (id === primaryId && currentViewMode === 'primary') }"
                                    @click="selectViewMode(id)">
                                    <span
                                        class="inline-block size-2 rounded-full shrink-0"
                                        :style="{ background: getAccountColor(id) }" />
                                    {{ session.label || session.userInfo?.displayName || id }}
                                    <span v-if="id === primaryId" class="text-muted-foreground ml-auto text-[10px]">★</span>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </template>
                    <!-- Left section -->
                    <div
                        class="flex items-center flex-1 min-w-0 overflow-hidden [&>*:first-child]:pl-0.5"
                        style="
                            mask-image: linear-gradient(to right, black calc(100% - 20px), transparent 100%);
                            -webkit-mask-image: linear-gradient(to right, black calc(100% - 20px), transparent 100%);
                        ">
                        <TooltipWrapper
                            v-if="visibility.proxy"
                            :content="
                                vrcxStore.proxyServer
                                    ? `${t('status_bar.proxy')}: ${vrcxStore.proxyServer}`
                                    : t('status_bar.proxy')
                            "
                            side="top">
                            <div
                                class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border cursor-pointer hover:bg-accent"
                                :style="statusBarItemStyle('proxy')"
                                @click="handleProxyClick">
                                <span
                                    class="inline-block size-2 rounded-full shrink-0"
                                    :class="vrcxStore.proxyServer ? 'bg-status-online' : 'bg-status-offline-alt'" />
                                <span class="text-foreground text-[11px]">{{
                                    vrcxStore.proxyServer || t('status_bar.proxy')
                                }}</span>
                            </div>
                        </TooltipWrapper>

                        <TooltipWrapper
                            v-if="!isMacOS && visibility.steamvr"
                            :content="
                                gameStore.isSteamVRRunning
                                    ? t('status_bar.steamvr_running')
                                    : t('status_bar.steamvr_stopped')
                            "
                            side="top">
                            <div
                                class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border"
                                :style="statusBarItemStyle('steamvr')">
                                <span
                                    class="inline-block size-2 rounded-full shrink-0"
                                    :class="
                                        gameStore.isSteamVRRunning ? 'bg-status-online' : 'bg-status-offline-alt'
                                    " />
                                <span class="text-foreground text-[11px]">{{ t('status_bar.steamvr') }}</span>
                            </div>
                        </TooltipWrapper>

                        <HoverCard
                            v-if="!isMacOS && visibility.vrchat"
                            v-model:open="gameHoverOpen"
                            :open-delay="50"
                            :close-delay="50">
                            <HoverCardTrigger as-child>
                                <div
                                    class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border"
                                    :style="statusBarItemStyle('vrchat')">
                                    <span
                                        class="inline-block size-2 rounded-full shrink-0"
                                        :class="
                                            gameStore.isGameRunning ? 'bg-status-online' : 'bg-status-offline-alt'
                                        " />
                                    <span class="text-foreground text-[11px]">{{ t('status_bar.game') }}</span>
                                    <span v-if="gameStore.isGameRunning" class="text-[10px] text-foreground">{{
                                        gameSessionText
                                    }}</span>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent
                                v-if="gameStore.isGameRunning && userStore.currentUser.$online_for"
                                class="w-auto min-w-[160px] px-3 py-2"
                                side="top"
                                align="start"
                                :side-offset="4">
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-[11px] text-muted-foreground">{{
                                            t('status_bar.game_started_at')
                                        }}</span>
                                        <span class="text-[11px] text-foreground">{{ gameStartedAtText }}</span>
                                    </div>
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-[11px] text-muted-foreground">{{
                                            t('status_bar.game_session_duration')
                                        }}</span>
                                        <span class="text-[11px] text-foreground">{{ gameSessionDetailText }}</span>
                                    </div>
                                </div>
                            </HoverCardContent>
                            <HoverCardContent
                                v-else-if="!gameStore.isGameRunning && gameStore.lastSessionDurationMs > 0"
                                class="w-auto min-w-[160px] px-3 py-2"
                                side="top"
                                align="start"
                                :side-offset="4">
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-[11px] text-muted-foreground">{{
                                            t('status_bar.game_last_session')
                                        }}</span>
                                        <span class="text-[11px] text-foreground">{{ lastSessionText }}</span>
                                    </div>
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-[11px] text-muted-foreground">{{
                                            t('status_bar.game_last_offline')
                                        }}</span>
                                        <span class="text-[11px] text-foreground">{{ lastOfflineTimeText }}</span>
                                    </div>
                                </div>
                            </HoverCardContent>
                        </HoverCard>

                        <TooltipWrapper v-if="visibility.autoFollow" :content="autoFollowTooltip" side="top">
                            <div
                                data-testid="auto-follow-status"
                                class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border"
                                :class="{ 'cursor-pointer hover:bg-accent': autoFollowStore.isActive }"
                                :style="statusBarItemStyle('autoFollow')"
                                @click="cancelAutoFollow">
                                <span
                                    class="inline-block size-2 rounded-full shrink-0"
                                    :class="autoFollowStatusClass" />
                                <span class="text-foreground text-[11px]">{{ t('status_bar.auto_follow') }}</span>
                                <span
                                    v-if="autoFollowStore.isActive && autoFollowStore.targetFriendName"
                                    class="text-[10px] text-foreground max-w-[120px] truncate">{{
                                    autoFollowStore.targetFriendName
                                }}</span>
                            </div>
                        </TooltipWrapper>

                        <HoverCard v-if="visibility.servers" v-model:open="serversHoverOpen">
                            <HoverCardTrigger as-child>
                                <TooltipWrapper
                                    v-if="!vrcStatusStore.hasIssue"
                                    :content="t('status_bar.servers_ok')"
                                    side="top">
                                    <div
                                        class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border cursor-pointer hover:bg-accent"
                                        :style="statusBarItemStyle('servers')"
                                        @click="vrcStatusStore.openStatusPage()">
                                        <span class="inline-block size-2 rounded-full shrink-0 bg-status-online" />
                                        <span class="text-foreground text-[11px]">{{ t('status_bar.servers') }}</span>
                                    </div>
                                </TooltipWrapper>
                                <div
                                    v-else
                                    class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border cursor-pointer hover:bg-accent"
                                    :style="statusBarItemStyle('servers')"
                                    @click="vrcStatusStore.openStatusPage()">
                                    <span
                                        class="inline-block size-2 rounded-full shrink-0"
                                        :class="vrcStatusStore.isMajor ? 'bg-destructive' : 'bg-status-askme'" />
                                    <span class="text-foreground text-[11px]">{{ t('status_bar.servers') }}</span>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent
                                v-if="vrcStatusStore.hasIssue"
                                class="w-[280px] px-3 py-2.5"
                                side="top"
                                align="start"
                                :side-offset="4">
                                <div class="flex items-center gap-1.5 mb-1.5">
                                    <span
                                        class="inline-block size-2 rounded-full shrink-0"
                                        :class="vrcStatusStore.isMajor ? 'bg-destructive' : 'bg-status-askme'" />
                                    <span class="font-semibold text-xs text-foreground">{{
                                        t('status_bar.servers_issue')
                                    }}</span>
                                </div>
                                <p class="text-[11px] text-muted-foreground m-0 leading-[1.4]">
                                    {{ vrcStatusStore.statusText }}
                                </p>
                            </HoverCardContent>
                        </HoverCard>

                        <TooltipWrapper v-if="visibility.ws" :content="wsTooltip" side="top">
                            <div
                                class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border"
                                :style="statusBarItemStyle('ws')">
                                <span
                                    class="inline-block size-2 rounded-full shrink-0"
                                    :class="wsState.connected ? 'bg-status-online' : 'bg-status-offline-alt'" />
                                <span class="text-foreground text-[11px]">WebSocket</span>
                                <canvas ref="wsCanvasRef" class="shrink-0 rounded-sm" />
                                <span class="text-[10px] text-foreground">{{
                                    t('status_bar.ws_avg_per_minute', { count: msgsPerMinuteAvg })
                                }}</span>
                            </div>
                        </TooltipWrapper>

                        <div
                            v-if="visibility.nowPlaying && nowPlaying.url"
                            class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border min-w-0 max-w-[400px]"
                            :style="statusBarItemStyle('nowPlaying')">
                            <i v-if="!isYouTubeNowPlaying" class="ri-play-fill text-[10px] shrink-0" />
                            <i v-if="isYouTubeNowPlaying" class="ri-youtube-fill text-[#FF0000] shrink-0 text-[12px]" />
                            <TooltipWrapper v-else :content="nowPlaying.url" side="top">
                                <span
                                    class="text-[10px] shrink-0 truncate max-w-[180px] cursor-pointer hover:text-foreground"
                                    @click="handleNowPlayingClick"
                                    >{{ nowPlaying.url }}</span
                                >
                            </TooltipWrapper>
                            <TooltipWrapper :content="nowPlaying.name" side="top">
                                <span
                                    class="text-[11px] text-foreground truncate cursor-pointer"
                                    @click="handleNowPlayingClick"
                                    >{{ nowPlaying.name }}</span
                                >
                            </TooltipWrapper>
                            <template v-if="nowPlaying.playing">
                                <div
                                    class="shrink-0 h-[4px] rounded-full bg-muted overflow-hidden ml-1"
                                    style="width: 40px"
                                    :title="`${nowPlayingElapsedText} / ${nowPlayingLengthText}`">
                                    <div
                                        class="h-full rounded-full bg-foreground/60 transition-[width] duration-1000 ease-linear"
                                        :style="{ width: `${nowPlaying.percentage}%` }" />
                                </div>
                                <span class="text-[10px] tabular-nums shrink-0">
                                    {{ nowPlayingElapsedText }} / {{ nowPlayingLengthText }}
                                </span>
                            </template>
                        </div>
                    </div>

                    <!-- Right section -->
                    <div class="flex items-center shrink-0 ml-auto [&>*:last-child]:border-r-0 [&>*:last-child]:pr-0.5">
                        <template v-if="visibility.clocks">
                            <Popover
                                v-for="(clock, idx) in visibleClocks"
                                :key="idx"
                                v-model:open="clockPopoverOpen[idx]">
                                <PopoverTrigger as-child>
                                    <div
                                        class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border cursor-pointer hover:bg-accent"
                                        :style="statusBarItemStyle('clocks')">
                                        <span class="text-[10px] text-foreground">{{ formatClock(clock) }}</span>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent class="w-[280px]" side="top" align="center">
                                    <div class="flex flex-col gap-2 p-1">
                                        <label class="text-xs font-medium">{{ t('status_bar.timezone') }}</label>
                                        <Select
                                            :model-value="String(clock.offset)"
                                            @update:modelValue="(offset) => updateClockTimezone(idx, offset)">
                                            <SelectTrigger size="sm">
                                                <SelectValue :placeholder="t('status_bar.timezone')" />
                                            </SelectTrigger>
                                            <SelectContent class="max-h-60">
                                                <SelectGroup>
                                                    <SelectItem
                                                        v-for="opt in timezoneOptions"
                                                        :key="opt.value"
                                                        :value="String(opt.value)">
                                                        <div class="flex w-full items-center justify-end font-mono">
                                                            {{ opt.label }}
                                                        </div>
                                                    </SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </template>

                        <TooltipWrapper
                            v-if="visibility.zoom"
                            :content="t('status_bar.zoom_tooltip')"
                            side="top"
                            :disabled="zoomEditing">
                            <div
                                class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border cursor-pointer hover:bg-accent"
                                :style="statusBarItemStyle('zoom')"
                                @click="toggleZoomEdit">
                                <template v-if="zoomEditing">
                                    <span class="text-[10px] text-foreground">{{ t('status_bar.zoom') }}</span>
                                    <NumberField
                                        v-model="zoomLevel"
                                        :step="0.01"
                                        :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: 2 }"
                                        class="w-20"
                                        @click.stop
                                        @update:modelValue="setZoomLevel">
                                        <NumberFieldContent>
                                            <NumberFieldDecrement />
                                            <NumberFieldInput
                                                ref="zoomInputRef"
                                                class="h-[18px] text-[11px] px-0.5 text-center"
                                                @blur="zoomEditing = false"
                                                @keydown.enter="zoomEditing = false"
                                                @keydown.escape="zoomEditing = false" />
                                            <NumberFieldIncrement />
                                        </NumberFieldContent>
                                    </NumberField>
                                </template>
                                <template v-else>
                                    <span class="text-[10px] text-foreground">{{ t('status_bar.zoom') }}</span>
                                    <span class="text-[10px] text-foreground">{{ formattedZoomLevel }}%</span>
                                </template>
                            </div>
                        </TooltipWrapper>

                        <TooltipWrapper
                            v-if="visibility.profileInfoSync"
                            :content="infoFetchTooltip"
                            side="top">
                            <div
                                class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border cursor-pointer hover:bg-accent"
                                :style="statusBarItemStyle('profileInfoSync')"
                                @click="runSilentInfoFetch">
                                <!-- Running: yellow spinner -->
                                <svg
                                    v-if="infoFetchState.status === 'running'"
                                    class="size-3 shrink-0 animate-spin"
                                    viewBox="0 0 16 16"
                                    fill="none">
                                    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" class="text-muted-foreground/30" />
                                    <path d="M14 8a6 6 0 0 0-6-6" stroke="#eab308" stroke-width="2" stroke-linecap="round" />
                                </svg>
                                <!-- Done: green check -->
                                <svg
                                    v-else-if="infoFetchState.status === 'done'"
                                    class="size-3 shrink-0 text-green-500"
                                    viewBox="0 0 16 16"
                                    fill="none">
                                    <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
                                    <path d="M5 8.5l2 2 4-4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                                <!-- Idle: grey circle -->
                                <span
                                    v-else
                                    class="inline-block size-2 rounded-full shrink-0 bg-status-offline-alt" />
                                <span class="text-[10px] text-foreground">{{ t('status_bar.info_sync') }}</span>
                                <span
                                    v-if="infoFetchState.status === 'running'"
                                    class="text-[10px] text-foreground">
                                    {{ infoFetchState.done }}/{{ infoFetchState.total }}
                                </span>
                            </div>
                        </TooltipWrapper>

                        <TooltipWrapper v-if="visibility.uptime" :content="t('status_bar.app_uptime')" side="top">
                            <div
                                class="flex items-center gap-1 px-2 h-[22px] whitespace-nowrap border-r border-border"
                                :style="statusBarItemStyle('uptime')">
                                <span class="text-[10px] text-foreground">{{ t('status_bar.app_uptime_short') }}</span>
                                <span class="text-[10px] text-foreground">{{ appUptimeText }}</span>
                            </div>
                        </TooltipWrapper>
                    </div>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuCheckboxItem
                    v-if="!isMacOS"
                    :model-value="visibility.vrchat"
                    @select.prevent
                    @update:model-value="toggleVisibility('vrchat')">
                    {{ t('status_bar.game') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    :model-value="visibility.autoFollow"
                    @select.prevent
                    @update:model-value="toggleVisibility('autoFollow')">
                    {{ t('status_bar.auto_follow') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    :model-value="visibility.servers"
                    @select.prevent
                    @update:model-value="toggleVisibility('servers')">
                    {{ t('status_bar.servers') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    v-if="!isMacOS"
                    :model-value="visibility.steamvr"
                    @select.prevent
                    @update:model-value="toggleVisibility('steamvr')">
                    {{ t('status_bar.steamvr') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    :model-value="visibility.proxy"
                    @select.prevent
                    @update:model-value="toggleVisibility('proxy')">
                    {{ t('status_bar.proxy') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    :model-value="visibility.ws"
                    @select.prevent
                    @update:model-value="toggleVisibility('ws')">
                    WebSocket
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    :model-value="visibility.profileInfoSync"
                    @select.prevent
                    @update:model-value="toggleVisibility('profileInfoSync')">
                    {{ t('view.tools.system_tools.info_completion') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    :model-value="visibility.nowPlaying"
                    @select.prevent
                    @update:model-value="toggleVisibility('nowPlaying')">
                    {{ t('status_bar.now_playing') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    :model-value="visibility.uptime"
                    @select.prevent
                    @update:model-value="toggleVisibility('uptime')">
                    {{ t('status_bar.app_uptime_short') }}
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem
                    v-if="!isMacOS"
                    :model-value="visibility.zoom"
                    @select.prevent
                    @update:model-value="toggleVisibility('zoom')">
                    {{ t('status_bar.zoom') }}
                </ContextMenuCheckboxItem>
                <ContextMenuSeparator />
                <ContextMenuSub>
                    <ContextMenuSubTrigger>{{ t('status_bar.clocks') }}</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <ContextMenuCheckboxItem
                            :model-value="clockCount === 0"
                            @select.prevent
                            @update:model-value="setClockCount('0')">
                            {{ t('status_bar.clocks_none') }}
                        </ContextMenuCheckboxItem>
                        <ContextMenuCheckboxItem
                            :model-value="clockCount === 1"
                            @select.prevent
                            @update:model-value="setClockCount('1')">
                            1 {{ t('status_bar.clocks_label') }}
                        </ContextMenuCheckboxItem>
                        <ContextMenuCheckboxItem
                            :model-value="clockCount === 2"
                            @select.prevent
                            @update:model-value="setClockCount('2')">
                            2 {{ t('status_bar.clocks_label') }}
                        </ContextMenuCheckboxItem>
                        <ContextMenuCheckboxItem
                            :model-value="clockCount === 3"
                            @select.prevent
                            @update:model-value="setClockCount('3')">
                            3 {{ t('status_bar.clocks_label') }}
                        </ContextMenuCheckboxItem>
                    </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSub>
                    <ContextMenuSubTrigger>{{ t('status_bar.reorder') }}</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        <template v-for="item in orderMenuItems" :key="item.key">
                            <ContextMenuSub>
                                <ContextMenuSubTrigger>{{ item.label }}</ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                    <ContextMenuItem
                                        :disabled="item.index === 0"
                                        @select.prevent="moveStatusBarItem(item.key, -1)">
                                        {{ t('status_bar.move_up') }}
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        :disabled="item.index === statusBarOrder.length - 1"
                                        @select.prevent="moveStatusBarItem(item.key, 1)">
                                        {{ t('status_bar.move_down') }}
                                    </ContextMenuItem>
                                </ContextMenuSubContent>
                            </ContextMenuSub>
                        </template>
                    </ContextMenuSubContent>
                </ContextMenuSub>
            </ContextMenuContent>
        </ContextMenu>
    </div>
</template>

<script setup>
    import {
        ContextMenu,
        ContextMenuCheckboxItem,
        ContextMenuContent,
        ContextMenuItem,
        ContextMenuSeparator,
        ContextMenuSub,
        ContextMenuSubContent,
        ContextMenuSubTrigger,
        ContextMenuTrigger
    } from '@/components/ui/context-menu';
    import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import {
        NumberField,
        NumberFieldContent,
        NumberFieldDecrement,
        NumberFieldIncrement,
        NumberFieldInput
    } from '@/components/ui/number-field';
    import {
        useGameLogStore,
        useGameStore,
        useGeneralSettingsStore,
        useAutoFollowStore,
        useUserStore,
        useVrcStatusStore,
        useVrcxStore
    } from '@/stores';
    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import { formatSeconds, timeToText } from '@/shared/utils';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { useIntervalFn, useNow } from '@vueuse/core';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { useI18n } from 'vue-i18n';
    import { openExternalLink } from '@/shared/utils/appActions';
    import { wsState } from '@/services/websocket';
    import { infoFetchState, runSilentInfoFetch } from '@/coordinators/infoFetchCoordinator';

    import dayjs from 'dayjs';
    import timezone from 'dayjs/plugin/timezone';
    import utc from 'dayjs/plugin/utc';

    import {
        defaultVisibility,
        defaultOrder,
        formatAppUptime,
        formatUtcHour,
        normalizeOrder,
        normalizeClock,
        normalizeUtcHour,
        parseClockOffset
    } from './statusBarUtils';

    import configRepository from '../services/config';
    import { accountHub } from '../services/accountHub.js';

    dayjs.extend(utc);
    dayjs.extend(timezone);

    const { t } = useI18n();

    // ── Multi-account view mode switcher ────────────────────────────────────────
    const viewModePopoverOpen = ref(false);

    const hasSecondarySessions = computed(() => accountHub.hasSecondarySessions);
    const isMergedView = computed(() => accountHub.isMergedView);
    const currentViewMode = computed(() => accountHub.viewMode);
    const primaryId = computed(() => accountHub.primaryId);
    const allSessions = computed(() => [...accountHub.sessions.entries()]);

    function getAccountColor(userId) {
        return accountHub.getAccountColor(userId);
    }

    const viewModeLabel = computed(() => {
        const mode = accountHub.viewMode;
        if (mode === 'merged') return t('status_bar.view_merged');
        if (mode === 'primary') {
            const s = accountHub.sessions.get(accountHub.primaryId);
            return s?.label || t('status_bar.view_primary');
        }
        const id = mode.replace('account:', '');
        const s = accountHub.sessions.get(id);
        return s?.label || id.slice(0, 6);
    });

    const viewModeColor = computed(() => {
        const mode = accountHub.viewMode;
        if (mode === 'merged') return 'var(--color-foreground, #888)';
        const id = mode === 'primary' ? accountHub.primaryId : mode.replace('account:', '');
        return accountHub.getAccountColor(id);
    });

    function selectViewMode(idOrMerged) {
        if (idOrMerged === 'merged') {
            accountHub.switchToMerged();
        } else {
            accountHub.switchToAccount(idOrMerged);
        }
        viewModePopoverOpen.value = false;
    }

    const isMacOS = computed(() => navigator.platform.includes('Mac'));

    const gameStore = useGameStore();
    const gameLogStore = useGameLogStore();
    const userStore = useUserStore();
    const vrcxStore = useVrcxStore();
    const vrcStatusStore = useVrcStatusStore();
    const generalSettingsStore = useGeneralSettingsStore();
    const autoFollowStore = useAutoFollowStore();

    const { nowPlaying } = storeToRefs(gameLogStore);

    const nowPlayingElapsedText = computed(() => {
        if (!nowPlaying.value.playing) return '';
        return formatSeconds(Math.floor(nowPlaying.value.elapsed));
    });

    const nowPlayingLengthText = computed(() => {
        if (!nowPlaying.value.length) return '';
        return formatSeconds(nowPlaying.value.length);
    });

    function handleNowPlayingClick() {
        const url = nowPlaying.value.url;
        if (url) {
            openExternalLink(url);
        }
    }

    const isYouTubeNowPlaying = computed(() => /youtu\.?be/i.test(nowPlaying.value.url));

    // --- Game session timer ---
    const gameHoverOpen = ref(false);

    const gameSessionText = computed(() => {
        if (!gameStore.isGameRunning || !userStore.currentUser.$online_for) return '';
        const elapsed = now.value - userStore.currentUser.$online_for;
        return elapsed > 0 ? timeToText(elapsed) : '';
    });

    const gameStartedAtText = computed(() => {
        if (!userStore.currentUser.$online_for) return '-';
        return dayjs(userStore.currentUser.$online_for).format('MM/DD HH:mm');
    });

    const gameSessionDetailText = computed(() => {
        if (!gameStore.isGameRunning || !userStore.currentUser.$online_for) return '-';
        const elapsed = now.value - userStore.currentUser.$online_for;
        return elapsed > 0 ? timeToText(elapsed, true) : '-';
    });

    const lastSessionText = computed(() => {
        if (gameStore.lastSessionDurationMs <= 0) return '-';
        return timeToText(gameStore.lastSessionDurationMs);
    });

    const lastOfflineTimeText = computed(() => {
        if (gameStore.lastOfflineAt <= 0) return '-';
        return dayjs(gameStore.lastOfflineAt).format('MM/DD HH:mm');
    });

    const autoFollowTooltip = computed(() =>
        !autoFollowStore.isActive
            ? `${t('status_bar.auto_follow')}：${t('status_bar.auto_follow_inactive')}`
            : autoFollowStore.statusText
              ? `${t('status_bar.auto_follow')}：${autoFollowStore.statusText}`
              : `${t('status_bar.auto_follow')}：${autoFollowStore.targetFriendName || t('status_bar.auto_follow_active')}`
    );

    const autoFollowStatusClass = computed(() => {
        if (!autoFollowStore.isActive) {
            return 'bg-status-offline-alt';
        }
        return autoFollowStore.isJoining ? 'bg-status-askme' : 'bg-status-online';
    });

    async function cancelAutoFollow() {
        if (!autoFollowStore.isActive) {
            return;
        }
        await autoFollowStore.stopFollow({ confirm: true });
    }

    // --- Servers status HoverCard ---
    const serversHoverOpen = ref(false);
    let serversHoverTimer = null;

    watch(
        () => vrcStatusStore.hasIssue,
        (hasIssue) => {
            if (hasIssue && visibility.servers) {
                serversHoverOpen.value = true;
                clearTimeout(serversHoverTimer);
                serversHoverTimer = setTimeout(() => {
                    serversHoverOpen.value = false;
                }, 5000);
            } else {
                serversHoverOpen.value = false;
                clearTimeout(serversHoverTimer);
            }
        }
    );

    const VISIBILITY_KEY = 'VRCX_statusBarVisibility';
    const ORDER_KEY = 'VRCX_statusBarOrder';

    const visibility = reactive({ ...defaultVisibility });
    const statusBarOrder = ref([...defaultOrder]);

    const statusBarLabels = computed(() => ({
        proxy: t('status_bar.proxy'),
        steamvr: t('status_bar.steamvr'),
        vrchat: t('status_bar.game'),
        autoFollow: t('status_bar.auto_follow'),
        servers: t('status_bar.servers'),
        ws: 'WebSocket',
        profileInfoSync: t('view.tools.system_tools.info_completion'),
        nowPlaying: t('status_bar.now_playing'),
        uptime: t('status_bar.app_uptime_short'),
        clocks: t('status_bar.clocks'),
        zoom: t('status_bar.zoom')
    }));

    const orderMenuItems = computed(() =>
        statusBarOrder.value
            .map((key, index) => ({
                key,
                index,
                label: statusBarLabels.value[key] ?? key
            }))
            .filter((item) => (item.key !== 'vrchat' && item.key !== 'steamvr' && item.key !== 'zoom') || !isMacOS.value)
    );

    /**
     *
     * @param key
     * @returns {{ order: number }}
     */
    function statusBarItemStyle(key) {
        const index = statusBarOrder.value.indexOf(key);
        return { order: index >= 0 ? index : statusBarOrder.value.length };
    }

    /**
     *
     */
    function saveStatusBarOrder() {
        configRepository.setString(ORDER_KEY, JSON.stringify(statusBarOrder.value));
    }

    /**
     *
     * @param key
     * @param direction
     */
    function moveStatusBarItem(key, direction) {
        const order = [...statusBarOrder.value];
        const index = order.indexOf(key);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
            return;
        }
        [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
        statusBarOrder.value = order;
        saveStatusBarOrder();
    }

    /**
     *
     * @param key
     */
    function toggleVisibility(key) {
        visibility[key] = !visibility[key];
        configRepository.setString(VISIBILITY_KEY, JSON.stringify(visibility));
    }

    // --- WebSocket message rate + sparkline ---

    const GRAPH_POINTS = 60;
    const WS_CANVAS_WIDTH = 48;
    const WS_CANVAS_HEIGHT = 12;
    const msgHistory = ref(new Array(GRAPH_POINTS).fill(0));
    const msgsLastMinute = ref(0);
    let lastMsgCount = wsState.messageCount;

    const wsCanvasRef = ref(null);
    const now = useNow({ interval: 1000 });

    useIntervalFn(() => {
        const delta = wsState.messageCount - lastMsgCount;
        lastMsgCount = wsState.messageCount;

        const arr = msgHistory.value;
        arr.shift();
        arr.push(delta);
        msgHistory.value = arr;

        // Sum of messages in the last 60 seconds
        msgsLastMinute.value = arr.reduce((a, b) => a + b, 0);

        drawSparkline();
    }, 1000);

    const msgsPerMinuteAvg = computed(() => Math.round(msgsLastMinute.value));

    /**
     *
     */
    function drawSparkline() {
        const canvas = wsCanvasRef.value;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(WS_CANVAS_WIDTH * dpr);
        canvas.height = Math.floor(WS_CANVAS_HEIGHT * dpr);
        canvas.style.width = `${WS_CANVAS_WIDTH}px`;
        canvas.style.height = `${WS_CANVAS_HEIGHT}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = WS_CANVAS_WIDTH;
        const h = WS_CANVAS_HEIGHT;
        const data = msgHistory.value;

        const fg = resolveCssColor('--foreground', '#cfd3dc');
        ctx.clearRect(0, 0, w, h);

        const max = Math.max(...data, 1);
        const step = w / (data.length - 1);

        // Only draw the sparkline stroke (no background, grid, or fill area)
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const x = i * step;
            const y = h - (data[i] / max) * (h - 2);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    /**
     *
     * @param variableName
     * @param fallback
     */
    function resolveCssColor(variableName, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
        if (!value) return fallback;
        if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || value.startsWith('oklch')) {
            return value;
        }
        return `hsl(${value})`;
    }

    const wsTooltip = computed(() => {
        const state = wsState.connected ? t('status_bar.ws_connected') : t('status_bar.ws_disconnected');
        return `WebSocket: ${state}`;
    });

    const infoFetchTooltip = computed(() => {
        if (infoFetchState.status === 'running') {
            return t('view.tools.system_tools.info_completion_tooltip_running', {
                done: infoFetchState.done,
                total: infoFetchState.total,
                bio: infoFetchState.bioUpdated,
                status: infoFetchState.statusUpdated
            });
        }
        if (infoFetchState.status === 'done') {
            return t('view.tools.system_tools.info_completion_tooltip_done', {
                bio: infoFetchState.bioUpdated,
                status: infoFetchState.statusUpdated
            });
        }
        return t('view.tools.system_tools.info_completion_tooltip_idle');
    });

    const appUptimeText = computed(() => {
        const elapsedSeconds = Math.floor((now.value - vrcxStore.appStartAt) / 1000);
        return formatAppUptime(elapsedSeconds);
    });

    const CLOCKS_KEY = 'VRCX_statusBarClocks';
    const CLOCK_COUNT_KEY = 'VRCX_statusBarClockCount';
    const localOffset = normalizeUtcHour(dayjs().utcOffset() / 60);
    const defaultClocks = [{ offset: localOffset }, { offset: 0 }, { offset: localOffset < 0 ? 9 : -5 }];

    const clocks = ref(defaultClocks.map((c) => ({ ...c })));
    const clockCount = ref(2);
    const clockPopoverOpen = reactive([false, false, false]);

    const visibleClocks = computed(() => clocks.value.slice(0, clockCount.value));

    /**
     *
     */
    function saveClocks() {
        configRepository.setString(CLOCKS_KEY, JSON.stringify(clocks.value));
    }

    /**
     *
     * @param val
     */
    function setClockCount(val) {
        clockCount.value = Number(val);
        configRepository.setString(CLOCK_COUNT_KEY, String(clockCount.value));
        if (clockCount.value > 0) {
            visibility.clocks = true;
            configRepository.setString(VISIBILITY_KEY, JSON.stringify(visibility));
        }
    }

    /**
     *
     * @param clock
     * @returns {string}
     */
    function formatClock(clock) {
        try {
            const current = dayjs(now.value).utcOffset(normalizeUtcHour(clock.offset) * 60);
            const time = current.format('HH:mm');
            return `${time} ${formatUtcHour(clock.offset)}`;
        } catch {
            return '??:?? UTC+0';
        }
    }

    /**
     *
     * @param idx
     * @param offsetValue
     */
    function updateClockTimezone(idx, offsetValue) {
        clocks.value[idx].offset = parseClockOffset(offsetValue);
        saveClocks();
        clockPopoverOpen[idx] = false;
    }

    const timezoneOptions = computed(() => {
        return Array.from({ length: 27 }, (_, i) => {
            const value = i - 12;
            return { value, label: formatUtcHour(value) };
        });
    });

    onMounted(async () => {
        const [savedVis, savedClocks, savedClockCount, savedOrder] = await Promise.all([
            configRepository.getString(VISIBILITY_KEY, null),
            configRepository.getString(CLOCKS_KEY, null),
            configRepository.getString(CLOCK_COUNT_KEY, null),
            configRepository.getString(ORDER_KEY, null)
        ]);
        if (savedVis) {
            try {
                Object.assign(visibility, JSON.parse(savedVis));
            } catch {
                // ignore
            }
        }
        if (savedClocks) {
            try {
                const parsed = JSON.parse(savedClocks);
                if (Array.isArray(parsed) && parsed.length === 3) {
                    clocks.value = parsed.map(normalizeClock);
                }
            } catch {
                // ignore
            }
        }
        if (savedClockCount !== null) {
            const n = Number(savedClockCount);
            if (n >= 0 && n <= 3) clockCount.value = n;
        }
        if (savedOrder) {
            try {
                statusBarOrder.value = normalizeOrder(JSON.parse(savedOrder));
            } catch {
                statusBarOrder.value = [...defaultOrder];
            }
        }

        drawSparkline();
    });

    onBeforeUnmount(() => {
        clearTimeout(serversHoverTimer);
    });

    watch(
        () => visibility.ws,
        (enabled) => {
            if (enabled) {
                nextTick(() => {
                    drawSparkline();
                });
            }
        }
    );

    const zoomLevel = ref(100);
    const formattedZoomLevel = computed(() => Number(zoomLevel.value || 0).toFixed(2));
    const zoomEditing = ref(false);
    const zoomInputRef = ref(null);

    if (!isMacOS.value) {
        initZoom();
    }

    /**
     *
     */
    async function initZoom() {
        try {
            zoomLevel.value = Number((((await AppApi.GetZoom()) + 10) * 10).toFixed(2));
        } catch {
            // AppApi not available
        }
    }

    /**
     *
     */
    function setZoomLevel() {
        try {
            zoomLevel.value = Number(Number(zoomLevel.value || 0).toFixed(2));
            AppApi.SetZoom(zoomLevel.value / 10 - 10);
        } catch {
            // AppApi not available
        }
    }

    /**
     *
     */
    async function toggleZoomEdit() {
        if (zoomEditing.value) {
            zoomEditing.value = false;
            return;
        }
        await initZoom();
        zoomEditing.value = true;
        await nextTick();
        zoomInputRef.value?.$el?.focus?.();
    }

    /**
     *
     */
    function handleProxyClick() {
        generalSettingsStore.promptProxySettings();
    }
</script>
