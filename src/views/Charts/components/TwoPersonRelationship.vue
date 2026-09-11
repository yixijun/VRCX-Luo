<template>
    <div id="chart" ref="twoPersonRef" class="x-container">
        <div class="pt-4">
            <BackToTop :target="twoPersonRef" :right="30" :bottom="30" :teleport="false" />
            <div class="options-container mt-0 flex flex-col gap-2">
                <div class="flex items-center gap-2">
                    <span class="shrink-0">{{ t('view.charts.two_person_relationship.header') }}</span>
                    <HoverCard>
                        <HoverCardTrigger as-child>
                            <Info class="ml-1 text-xs opacity-70" />
                        </HoverCardTrigger>
                        <HoverCardContent side="bottom" align="start" class="w-80">
                            <div class="text-xs">
                                {{ t('view.charts.two_person_relationship.tips.description') }}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                </div>

                <div class="flex items-center gap-2">
                    <!-- Friend Selector A -->
                    <div class="min-w-0 flex-1">
                        <VirtualCombobox
                            :model-value="selectedFriendAId"
                            @update:modelValue="handleFriendASelect"
                            :groups="friendPickerGroupsA"
                            :placeholder="t('view.charts.two_person_relationship.select_friend_a')"
                            :search-placeholder="t('view.charts.two_person_relationship.search_friend')"
                            :close-on-select="true"
                            :deselect-on-reselect="true">
                            <template #item="{ item, selected }">
                                <div
                                    class="flex w-full items-center p-1.5 in-[.is-compact-table]:p-1! text-[13px] in-[.is-compact-table]:text-[12px]!">
                                    <template v-if="item.user">
                                        <div
                                            class="relative mr-2.5 in-[.is-compact-table]:mr-1.5! inline-block size-9 in-[.is-compact-table]:size-7! in-[.is-comfortable-table]:size-8! flex-none"
                                            :class="userStatusClass(item.user)">
                                            <img
                                                class="size-full rounded-full object-cover"
                                                :src="userImage(item.user)"
                                                loading="lazy" />
                                        </div>
                                        <div class="flex-1 overflow-hidden">
                                            <span
                                                class="block truncate font-medium leading-[18px]"
                                                :style="{ color: item.user.$userColour }">
                                                {{ item.user.displayName }}
                                            </span>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <span>{{ item.label }}</span>
                                    </template>
                                    <Check :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
                                </div>
                            </template>
                        </VirtualCombobox>
                    </div>

                    <TooltipWrapper :content="t('view.charts.two_person_relationship.swap_friends')" side="top">
                        <Button
                            class="shrink-0 rounded-full"
                            size="icon"
                            variant="ghost"
                            :disabled="!selectedFriendAId && !selectedFriendBId"
                            @click="swapFriends">
                            <ArrowLeftRight class="size-4" />
                        </Button>
                    </TooltipWrapper>

                    <!-- Friend Selector B -->
                    <div class="min-w-0 flex-1">
                        <VirtualCombobox
                            :model-value="selectedFriendBId"
                            @update:modelValue="handleFriendBSelect"
                            :groups="friendPickerGroupsB"
                            :placeholder="t('view.charts.two_person_relationship.select_friend_b')"
                            :search-placeholder="t('view.charts.two_person_relationship.search_friend')"
                            :close-on-select="true"
                            :deselect-on-reselect="true">
                            <template #item="{ item, selected }">
                                <div
                                    class="flex w-full items-center p-1.5 in-[.is-compact-table]:p-1! text-[13px] in-[.is-compact-table]:text-[12px]!">
                                    <template v-if="item.user">
                                        <div
                                            class="relative mr-2.5 in-[.is-compact-table]:mr-1.5! inline-block size-9 in-[.is-compact-table]:size-7! in-[.is-comfortable-table]:size-8! flex-none"
                                            :class="userStatusClass(item.user)">
                                            <img
                                                class="size-full rounded-full object-cover"
                                                :src="userImage(item.user)"
                                                loading="lazy" />
                                        </div>
                                        <div class="flex-1 overflow-hidden">
                                            <span
                                                class="block truncate font-medium leading-[18px]"
                                                :style="{ color: item.user.$userColour }">
                                                {{ item.user.displayName }}
                                            </span>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <span>{{ item.label }}</span>
                                    </template>
                                    <Check :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
                                </div>
                            </template>
                        </VirtualCombobox>
                    </div>

                    <!-- Refresh Button -->
                    <TooltipWrapper :content="t('view.charts.two_person_relationship.refresh')" side="top">
                        <Button
                            variant="ghost"
                            size="icon"
                            class="shrink-0 rounded-full"
                            :disabled="!selectedFriendAId || !selectedFriendBId || isLoading"
                            @click="loadData">
                            <RefreshCcw :class="['size-4', isLoading ? 'animate-spin' : '']" />
                        </Button>
                    </TooltipWrapper>

                    <div class="ml-auto flex shrink-0 items-center gap-2 px-0.5">
                        <span class="shrink-0 text-sm">
                            {{ t('view.charts.two_person_relationship.show_self_presence') }}
                        </span>
                        <Switch v-model="showSelfPresence" />
                    </div>
                </div>
            </div>

            <div v-if="isLoading" class="mt-[100px] flex items-center justify-center">
                <RefreshCcw class="size-6 animate-spin text-muted-foreground" />
            </div>

            <div
                v-else-if="!selectedFriendAId || !selectedFriendBId"
                class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Users class="size-12 opacity-20" />
                <p>{{ t('view.charts.two_person_relationship.no_friend_selected') }}</p>
            </div>

            <div
                v-else-if="sharedInstances.length === 0"
                class="mt-[100px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <DataTableEmpty type="nodata" />
            </div>

            <template v-else>
                <div
                    class="mx-auto mt-3 flex max-w-[900px] flex-wrap items-center gap-2 in-[.is-compact-table]:mt-1.5! in-[.is-comfortable-table]:mt-2!">
                    <div
                        class="flex items-center gap-2 rounded-lg border-0 px-3 py-2 in-[.is-compact-table]:py-1! in-[.is-comfortable-table]:py-1.5!">
                        <Clock class="size-3.5 text-muted-foreground" />
                        <span class="text-sm in-[.is-compact-table]:text-xs! font-medium">{{
                            timeToText(totalCoexistenceTime, true)
                        }}</span>
                        <span class="text-xs text-muted-foreground">
                            {{ t('view.charts.two_person_relationship.total_coexistence_time') }}
                        </span>
                    </div>
                    <div
                        class="flex items-center gap-2 rounded-lg border-0 px-3 py-2 in-[.is-compact-table]:py-1! in-[.is-comfortable-table]:py-1.5!">
                        <Hash class="size-3.5 text-muted-foreground" />
                        <span class="text-sm in-[.is-compact-table]:text-xs! font-medium">{{
                            sharedInstances.length
                        }}</span>
                        <span class="text-xs text-muted-foreground">
                            {{ t('view.charts.two_person_relationship.instance_count') }}
                        </span>
                    </div>
                    <div
                        class="flex items-center gap-2 rounded-lg border-0 px-3 py-2 in-[.is-compact-table]:py-1! in-[.is-comfortable-table]:py-1.5!">
                        <MapPin class="size-3.5 text-muted-foreground" />
                        <span class="text-sm in-[.is-compact-table]:text-xs! font-medium">{{
                            sharedRoomVisitCount
                        }}</span>
                        <span class="text-xs text-muted-foreground">
                            {{ t('view.charts.two_person_relationship.shared_room_visit_count') }}
                        </span>
                    </div>
                </div>

                <TooltipWrapper
                    v-if="sharedWorldRanking.length"
                    :content="t('view.charts.two_person_relationship.shared_world_ranking')"
                    side="top">
                    <Button
                        variant="outline"
                        size="sm"
                        class="shrink-0 gap-1.5 rounded-lg"
                        @click="isSharedWorldRankingOpen = true">
                        <MapPin class="size-3.5" />
                        <span>{{ t('view.charts.two_person_relationship.shared_world_ranking') }}</span>
                        <span class="text-xs text-muted-foreground tabular-nums">{{ sharedWorldRanking.length }}</span>
                    </Button>
                </TooltipWrapper>

                <SharedWorldRankingDialog
                    v-model:open="isSharedWorldRankingOpen"
                    :items="sharedWorldRanking"
                    @select="openInstanceDialog" />

                <div
                    class="mx-auto mt-3 in-[.is-compact-table]:mt-1.5! in-[.is-comfortable-table]:mt-2! max-w-[900px] flex flex-col gap-3 pb-8">
                    <button
                        v-for="item in sharedInstances"
                        :key="item.location + '_' + item.friendALeave"
                        type="button"
                        class="group flex w-full items-center gap-3 rounded-lg border-0 p-3 text-left transition-all hover:bg-accent hover:shadow-sm"
                        @click="openInstanceDialog(item.location)">
                        <div class="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">
                            {{ item.formattedDate }}
                        </div>

                        <div class="min-w-0 flex-1">
                            <Location :location="item.location" />
                            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <TooltipWrapper
                                    v-if="item.instanceCreatorName"
                                    :content="t('view.charts.two_person_relationship.instance_creator')"
                                    side="top">
                                    <span class="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Crown class="size-3 shrink-0" />
                                        <span class="truncate max-w-[120px]">{{ item.instanceCreatorName }}</span>
                                    </span>
                                </TooltipWrapper>
                                <TooltipWrapper
                                    v-if="item.maxPlayerCount != null"
                                    :content="t('view.charts.two_person_relationship.max_player_count')"
                                    side="top">
                                    <span class="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Users class="size-3 shrink-0" />
                                        <span class="tabular-nums">{{ item.maxPlayerCount }}</span>
                                    </span>
                                </TooltipWrapper>
                            </div>
                        </div>

                        <div class="flex shrink-0 flex-col items-end gap-1.5">
                            <div class="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
                                <span
                                    v-if="item.joinLeavesCount > 1"
                                    class="text-[10px] bg-muted px-1.5 py-0.5 rounded opacity-80 leading-none tabular-nums">
                                    {{ item.joinLeavesCount }} 次进出
                                </span>
                                <Clock class="size-3 shrink-0" />
                                <span class="font-medium tabular-nums">{{
                                    timeToText(item.coexistenceTime, true)
                                }}</span>
                            </div>

                            <div class="flex items-center gap-2">
                                <span
                                    v-if="showSelfPresence"
                                    :class="[
                                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                        item.selfPresent
                                            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                    ]">
                                    {{
                                        item.selfPresent
                                            ? t('view.charts.two_person_relationship.self_present')
                                            : t('view.charts.two_person_relationship.self_not_present')
                                    }}
                                </span>
                                <span
                                    :class="[
                                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                        item.initiator === 'mutual'
                                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                            : item.initiator === 'unknown'
                                              ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                                              : 'text-orange-600 dark:text-orange-400'
                                    ]"
                                    :style="
                                        item.initiator === 'leftPlayer'
                                            ? {
                                                  background:
                                                      'linear-gradient(to right, rgb(249 115 22 / 0.3), rgb(249 115 22 / 0))'
                                              }
                                            : item.initiator === 'rightPlayer'
                                              ? {
                                                    background:
                                                        'linear-gradient(to left, rgb(249 115 22 / 0.3), rgb(249 115 22 / 0))'
                                                }
                                              : {}
                                    ">
                                    {{ t('view.charts.two_person_relationship.initiator_' + item.initiator) }}
                                </span>
                            </div>
                        </div>
                    </button>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
    defineOptions({ name: 'ChartsTwoPersonRelationship' });

    import { computed, onMounted, ref } from 'vue';
    import { ArrowLeftRight, Check, Clock, Crown, Hash, Info, MapPin, RefreshCcw, Users } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import dayjs from 'dayjs';

    import BackToTop from '@/components/BackToTop.vue';
    import { Button } from '@/components/ui/button';
    import { DataTableEmpty } from '@/components/ui/data-table';
    import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
    import { Switch } from '@/components/ui/switch';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';
    import TooltipWrapper from '@/components/ui/tooltip/TooltipWrapper.vue';
    import Location from '@/components/Location.vue';
    import SharedWorldRankingDialog from './SharedWorldRankingDialog.vue';

    import { showWorldDialog } from '@/coordinators/worldCoordinator';
    import { database } from '@/services/database';
    import { parseLocation } from '@/shared/utils/locationParser';
    import { timeToText } from '@/shared/utils';
    import { useAppearanceSettingsStore, useFriendStore, useTrackedNonFriendsStore, useUserStore } from '@/stores';
    import { useUserDisplay } from '@/composables/useUserDisplay';
    import { buildSharedWorldRanking, countSharedRoomVisits } from './twoPersonRelationshipStats';

    const { t } = useI18n();

    const twoPersonRef = ref(null);
    const selectedFriendAId = ref(null);
    const selectedFriendBId = ref(null);
    const isLoading = ref(false);
    const rawResults = ref([]);
    const selfPresenceMap = ref(new Map());
    const maxPlayerCountMap = ref(new Map());
    const showSelfPresence = ref(false);
    const isSharedWorldRankingOpen = ref(false);

    const appearanceStore = useAppearanceSettingsStore();
    const { dtHour12 } = storeToRefs(appearanceStore);
    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const trackedStore = useTrackedNonFriendsStore();
    const { friends } = storeToRefs(friendStore);
    const { trackedList } = storeToRefs(trackedStore);
    const { currentUser } = storeToRefs(userStore);
    const cachedUsers = userStore.cachedUsers;

    const { userImage, userStatusClass } = useUserDisplay();

    function buildFriendItems(excludeId) {
        return allFriendItems.value.filter((item) => item.value !== excludeId);
    }

    const allFriendItems = computed(() => {
        const items = [];
        const seenIds = new Set();
        const selfId = currentUser.value?.id;

        // 1. Friends
        for (const [friendId, friend] of friends.value.entries()) {
            if (friendId === selfId) continue;
            const cached = cachedUsers.get(friendId);
            const displayName = friend.displayName || cached?.displayName || friendId;
            items.push({
                value: friendId,
                label: displayName,
                search: displayName,
                user: cached || null
            });
            seenIds.add(friendId);
        }

        // 2. Tracked Non-Friends
        for (const item of trackedList.value) {
            if (item.userId === selfId || seenIds.has(item.userId)) continue;
            const cached = cachedUsers.get(item.userId);
            const displayName = item.displayName || cached?.displayName || item.userId;
            items.push({
                value: item.userId,
                label: displayName,
                search: displayName,
                user: cached || null
            });
            seenIds.add(item.userId);
        }

        items.sort((a, b) => a.label.localeCompare(b.label));
        return items;
    });

    const friendPickerGroupsA = computed(() => [
        {
            key: 'friends',
            label: t('side_panel.friends'),
            items: selectedFriendBId.value ? buildFriendItems(selectedFriendBId.value) : allFriendItems.value
        }
    ]);
    const friendPickerGroupsB = computed(() => [
        {
            key: 'friends',
            label: t('side_panel.friends'),
            items: selectedFriendAId.value ? buildFriendItems(selectedFriendAId.value) : allFriendItems.value
        }
    ]);

    function resolveDisplayName(userId) {
        if (!userId) return null;
        const cached = cachedUsers.get(userId);
        return cached?.displayName || userId;
    }

    function computeSelfPresent(location, overlapStart, overlapEnd) {
        const sessions = selfPresenceMap.value.get(location);
        if (!sessions || sessions.length === 0) return false;
        for (const session of sessions) {
            const selfLeaveMs = dayjs(session.selfLeave).valueOf();
            const selfJoinMs = selfLeaveMs - Math.max(0, session.selfTime);
            if (selfJoinMs < overlapEnd && selfLeaveMs > overlapStart) {
                return true;
            }
        }
        return false;
    }

    const sharedInstances = computed(() => {
        const dateFormat = dtHour12.value ? 'YYYY-MM-DD hh:mm A' : 'YYYY-MM-DD HH:mm';
        const THREE_MINUTES = 3 * 60 * 1000;

        const firstMeetingByLocation = new Map();
        for (const row of rawResults.value) {
            const aLeave = dayjs(row.friendALeave).valueOf();
            const bLeave = dayjs(row.friendBLeave).valueOf();
            const aJoin = aLeave - Math.max(0, row.friendATime);
            const bJoin = bLeave - Math.max(0, row.friendBTime);
            const overlapStart = Math.max(aJoin, bJoin);
            const existing = firstMeetingByLocation.get(row.location);
            if (!existing || overlapStart < existing.overlapStart) {
                firstMeetingByLocation.set(row.location, { overlapStart, aJoin, bJoin });
            }
        }
        const grouped = new Map();

        rawResults.value.forEach((row) => {
            const friendATime = Math.max(0, row.friendATime);
            const friendBTime = Math.max(0, row.friendBTime);
            const friendALeaveMs = dayjs(row.friendALeave).valueOf();
            const friendAJoin = friendALeaveMs - friendATime;
            const friendBLeaveMs = dayjs(row.friendBLeave).valueOf();
            const friendBJoin = friendBLeaveMs - friendBTime;
            const overlapStart = Math.max(friendAJoin, friendBJoin);
            const overlapEnd = Math.min(friendALeaveMs, friendBLeaveMs);
            const coexistenceTime = Math.max(0, overlapEnd - overlapStart);

            if (!grouped.has(row.location)) {
                const parsedLoc = parseLocation(row.location);
                const instanceCreatorId = parsedLoc.userId || null;
                const instanceCreatorName = resolveDisplayName(instanceCreatorId);
                const maxPlayerCount = maxPlayerCountMap.value.get(row.location) ?? null;
                const selfPresent = computeSelfPresent(row.location, overlapStart, overlapEnd);

                const first = firstMeetingByLocation.get(row.location);
                let initiator = 'mutual';
                if (first) {
                    const joinTimeDiffMs = Math.abs(first.aJoin - first.bJoin);
                    if (joinTimeDiffMs > THREE_MINUTES) {
                        initiator = first.aJoin > first.bJoin ? 'leftPlayer' : 'rightPlayer';
                    } else if (selfPresent) {
                        let isSnapshot = false;
                        const mySessions = selfPresenceMap.value.get(row.location) || [];
                        for (const my of mySessions) {
                            const myJoin = dayjs(my.selfLeave).valueOf() - Math.max(0, my.selfTime);
                            if (
                                Math.abs(first.aJoin - myJoin) <= THREE_MINUTES &&
                                Math.abs(first.bJoin - myJoin) <= THREE_MINUTES
                            ) {
                                isSnapshot = true;
                                break;
                            }
                        }

                        if (isSnapshot) {
                            initiator = 'unknown';
                        }
                    }
                }

                grouped.set(row.location, {
                    location: row.location,
                    friendALeave: friendALeaveMs,
                    coexistenceTime,
                    joinLeavesCount: 1,
                    formattedDate: dayjs(friendALeaveMs).format(dateFormat),
                    instanceCreatorName,
                    maxPlayerCount,
                    selfPresent,
                    initiator
                });
            } else {
                const existing = grouped.get(row.location);
                existing.coexistenceTime += coexistenceTime;
                existing.joinLeavesCount += 1;
                // selfPresent should be true if it was true in ANY of the segments
                existing.selfPresent =
                    existing.selfPresent || computeSelfPresent(row.location, overlapStart, overlapEnd);
                if (friendALeaveMs > existing.friendALeave) {
                    existing.friendALeave = friendALeaveMs;
                    existing.formattedDate = dayjs(friendALeaveMs).format(dateFormat);
                }
            }
        });

        return Array.from(grouped.values()).sort((a, b) => b.friendALeave - a.friendALeave);
    });

    const totalCoexistenceTime = computed(() => {
        return sharedInstances.value.reduce((acc, item) => acc + item.coexistenceTime, 0);
    });

    const sharedRoomVisitCount = computed(() => countSharedRoomVisits(sharedInstances.value));
    const sharedWorldRanking = computed(() => buildSharedWorldRanking(sharedInstances.value));

    async function loadData() {
        if (!selectedFriendAId.value || !selectedFriendBId.value) return;
        isLoading.value = true;
        try {
            const results = await database.getCoInstanceHistoryBetweenFriends(
                selectedFriendAId.value,
                selectedFriendBId.value
            );
            rawResults.value = results;

            const locations = [...new Set(results.map((r) => r.location))];

            const [selfMap, maxMap] = await Promise.all([
                currentUser.value?.id
                    ? database.getSelfPresenceForLocations(currentUser.value.id, locations)
                    : Promise.resolve(new Map()),
                database.getMaxPlayerCountForLocations(locations)
            ]);

            selfPresenceMap.value = selfMap;
            maxPlayerCountMap.value = maxMap;
        } catch (error) {
            console.error('Error loading co-instance history:', error);
            rawResults.value = [];
            selfPresenceMap.value = new Map();
            maxPlayerCountMap.value = new Map();
        } finally {
            isLoading.value = false;
        }
    }

    function handleFriendASelect(friendId) {
        selectedFriendAId.value = friendId || null;
        rawResults.value = [];
        selfPresenceMap.value = new Map();
        maxPlayerCountMap.value = new Map();
        if (friendId && selectedFriendBId.value) {
            loadData();
        }
    }

    function handleFriendBSelect(friendId) {
        selectedFriendBId.value = friendId || null;
        rawResults.value = [];
        selfPresenceMap.value = new Map();
        maxPlayerCountMap.value = new Map();
        if (friendId && selectedFriendAId.value) {
            loadData();
        }
    }

    function swapFriends() {
        const tmp = selectedFriendAId.value;
        selectedFriendAId.value = selectedFriendBId.value;
        selectedFriendBId.value = tmp;
        rawResults.value = [];
        selfPresenceMap.value = new Map();
        maxPlayerCountMap.value = new Map();
        if (selectedFriendAId.value && selectedFriendBId.value) {
            loadData();
        }
    }

    function openInstanceDialog(location) {
        if (location) {
            showWorldDialog(location);
        }
    }

    onMounted(() => {
        // We've removed manual height management; .x-container handles it now.
    });
</script>
