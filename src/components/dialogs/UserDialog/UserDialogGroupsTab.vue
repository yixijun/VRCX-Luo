<template>
    <div class="user-groups-tab">
        <div class="user-groups-toolbar">
            <div class="user-groups-toolbar__summary">
                <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :disabled="userDialog.isGroupsLoading"
                    :aria-label="t('dialog.user.groups.refresh')"
                    @click="getUserGroups(userDialog.id)">
                    <Spinner v-if="userDialog.isGroupsLoading" />
                    <RefreshCw v-else />
                </Button>
                <span class="user-groups-count">
                    <Users class="size-3.5" />
                    {{ t('dialog.user.groups.count', { count: userDialog.userGroups.groups.length }) }}
                </span>
                <span v-if="userDialogGroupEditMode" class="user-groups-edit-hint">
                    {{ t('dialog.user.groups.hold_shift') }}
                </span>
            </div>
            <div class="user-groups-toolbar__actions">
                <template v-if="!userDialogGroupEditMode">
                    <div class="user-groups-search">
                        <Search class="user-groups-search__icon" aria-hidden="true" />
                        <Input
                            v-model="groupSearchQuery"
                            class="user-groups-search__input"
                            :placeholder="t('dialog.user.groups.search_placeholder')"
                            :aria-label="t('dialog.user.groups.search_placeholder')"
                            @click.stop />
                    </div>
                    <div class="user-groups-sort">
                        <span>{{ t('dialog.user.groups.sort_by') }}</span>
                        <Select
                            :model-value="userDialogGroupSortingKey"
                            :disabled="userDialog.isGroupsLoading"
                            @update:modelValue="setUserDialogGroupSortingByKey">
                            <SelectTrigger class="user-groups-sort__trigger" size="sm" @click.stop>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="(item, key) in userDialogGroupSortingOptions"
                                    :key="String(key)"
                                    :value="String(key)"
                                    :disabled="
                                        item === userDialogGroupSortingOptions.inGame &&
                                        userDialog.id !== currentUser.id
                                    ">
                                    {{ t(item.name) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </template>
                <Button
                    v-if="userDialogGroupEditMode"
                    variant="outline"
                    size="sm"
                    @click="exitEditModeCurrentUserGroups">
                    {{ t('dialog.user.groups.exit_edit_mode') }}
                </Button>
                <Button
                    v-else-if="currentUser.id === userDialog.id"
                    size="sm"
                    variant="outline"
                    @click="editModeCurrentUserGroups">
                    {{ t('dialog.user.groups.edit_mode') }}
                </Button>
            </div>
        </div>
        <div class="user-groups-content">
            <template v-if="userDialogGroupEditMode">
                <div class="flex flex-wrap items-start" style="margin-top: 8px; margin-bottom: 16px; max-height: unset">
                    <!-- Bulk actions dropdown (shown only in edit mode) -->
                    <Select :model-value="bulkGroupActionValue" @update:modelValue="handleBulkGroupAction">
                        <SelectTrigger size="sm" style="margin-right: 6px; margin-bottom: 6px" @click.stop>
                            <SelectValue :placeholder="t('dialog.group.actions.manage_selected')" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="visibility:visible">
                                {{ t('dialog.group.actions.visibility_everyone') }}
                            </SelectItem>
                            <SelectItem value="visibility:friends">
                                {{ t('dialog.group.actions.visibility_friends') }}
                            </SelectItem>
                            <SelectItem value="visibility:hidden">
                                {{ t('dialog.group.actions.visibility_hidden') }}
                            </SelectItem>
                            <SelectItem value="leave">
                                {{ t('dialog.user.groups.leave_group_tooltip') }}
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <!-- Select All button -->
                    <Button
                        size="sm"
                        variant="outline"
                        style="padding: 7px 16px; margin-bottom: 6px"
                        @click="selectAllGroups">
                        {{
                            userDialogGroupAllSelected
                                ? t('dialog.group.actions.deselect_all')
                                : t('dialog.group.actions.select_all')
                        }}
                    </Button>

                    <div
                        v-for="group in userDialogGroupEditGroups"
                        :key="group.id"
                        class="box-border flex items-center rounded-md p-1.5 text-[13px] cursor-pointer w-full"
                        @click="showGroupDialog(group.id)">
                        <!-- Manual checkbox -->
                        <div
                            style="
                                margin-left: 6px;
                                margin-right: 6px;
                                transform: scale(0.8);
                                transform-origin: left center;
                            "
                            @click.stop>
                            <Checkbox
                                :model-value="userDialogGroupEditSelectedGroupIds.includes(group.id)"
                                @update:modelValue="() => toggleGroupSelection(group.id)" />
                        </div>

                        <div style="margin-right: 3px; margin-left: 6px" @click.stop>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                style="display: block; padding: 7px; font-size: 9px; margin-left: 0; rotate: 180deg"
                                @click="moveGroupTop(group.id)">
                                <DownloadIcon />
                            </Button>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                style="display: block; padding: 7px; font-size: 9px; margin-left: 0"
                                @click="moveGroupBottom(group.id)">
                                <DownloadIcon />
                            </Button>
                        </div>
                        <div style="margin-right: 8px" @click.stop>
                            <Button
                                size="icon-sm"
                                variant="outline"
                                style="display: block; padding: 7px; font-size: 9px; margin-left: 0"
                                @click="moveGroupUp(group.id)">
                                <ArrowUp />
                            </Button>
                            <Button
                                size="icon-sm"
                                variant="outline"
                                style="display: block; padding: 7px; font-size: 9px; margin-left: 0"
                                @click="moveGroupDown(group.id)">
                                <ArrowDown />
                            </Button>
                        </div>
                        <div class="relative inline-block flex-none size-9 mr-2.5">
                            <Avatar class="size-9">
                                <AvatarImage :src="group.iconUrl" class="object-cover" />
                                <AvatarFallback>
                                    <Users class="size-4 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <span class="block truncate font-medium leading-[18px]" v-text="group.name"></span>
                            <span class="block truncate text-xs">
                                <TooltipWrapper
                                    v-if="group.isRepresenting"
                                    side="top"
                                    :content="t('dialog.group.members.representing')">
                                    <Tag style="margin-right: 6px" />
                                </TooltipWrapper>
                                <TooltipWrapper v-if="group.myMember?.visibility !== 'visible'" side="top">
                                    <template #content>
                                        <span
                                            >{{ t('dialog.group.members.visibility') }}
                                            {{ group.myMember.visibility }}</span
                                        >
                                    </template>
                                    <Eye style="margin-right: 6px" />
                                </TooltipWrapper>
                                <span>({{ group.memberCount }})</span>
                            </span>
                        </div>
                        <Select
                            v-if="group.myMember?.visibility"
                            :model-value="group.myMember.visibility"
                            :disabled="group.privacy !== 'default'"
                            @update:modelValue="(value) => setGroupVisibility(group.id, value)">
                            <SelectTrigger size="sm" @click.stop>
                                <SelectValue
                                    :placeholder="
                                        group.myMember.visibility === 'visible'
                                            ? t('dialog.group.tags.visible')
                                            : group.myMember.visibility === 'friends'
                                              ? t('dialog.group.tags.friends')
                                              : group.myMember.visibility === 'hidden'
                                                ? t('dialog.group.tags.hidden')
                                                : group.myMember.visibility
                                    " />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="visible">
                                    {{ t('dialog.group.actions.visibility_everyone') }}
                                </SelectItem>
                                <SelectItem value="friends">
                                    {{ t('dialog.group.actions.visibility_friends') }}
                                </SelectItem>
                                <SelectItem value="hidden">
                                    {{ t('dialog.group.actions.visibility_hidden') }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <!--//- JSON is missing isSubscribedToAnnouncements, can't be implemented-->
                        <!-- <Button size="sm" variant="outline"
                            @click.stop="
                                setGroupSubscription(group.id, !group.myMember.isSubscribedToAnnouncements)
                            ">
                            <span v-if="group.myMember.isSubscribedToAnnouncements"
                                ><BellOff style="margin-left: 6px" />
                                {{ t('dialog.group.tags.subscribed') }}</span
                            >
                            <span v-else
                                ><Bell style="margin-left: 6px" />
                                {{ t('dialog.group.tags.unsubscribed') }}</span
                            >
                        </Button> -->
                        <TooltipWrapper side="right" :content="t('dialog.user.groups.leave_group_tooltip')">
                            <Button
                                class="rounded-full h-6 w-6"
                                size="icon-sm"
                                variant="outline"
                                v-if="shiftHeld"
                                style="margin-left: 6px"
                                @click.stop="leaveGroup(group.id)">
                                <LogOut />
                            </Button>
                            <Button
                                class="rounded-full h-6 w-6 text-red-600"
                                size="icon-sm"
                                variant="outline"
                                v-else
                                style="margin-left: 6px"
                                @click.stop="leaveGroupPrompt(group.id)">
                                <LogOut />
                            </Button>
                        </TooltipWrapper>
                    </div>
                </div>
            </template>
            <template v-else-if="groupSearchActive">
                <TransitionGroup
                    v-if="allFilteredGroups.length"
                    tag="div"
                    name="user-group"
                    appear
                    class="user-group-grid">
                    <UserDialogGroupCard
                        v-for="(group, index) in allFilteredGroups"
                        :key="group.id"
                        :group="group"
                        :style="{ '--stagger-index': Math.min(index, 7) }"
                        :can-manage="currentUser.id === userDialog.id" />
                </TransitionGroup>
                <div v-else class="user-groups-empty" role="status">
                    <Search class="size-5" aria-hidden="true" />
                    <span>{{ t('dialog.user.groups.search_no_results') }}</span>
                </div>
            </template>
            <template v-else>
                <template v-if="userDialog.userGroups.ownGroups.length > 0">
                    <span class="user-groups-section__label text-base font-bold">{{
                        t('dialog.user.groups.own_groups')
                    }}</span>
                    <span class="user-groups-section__count text-xs ml-1.5"
                        >{{ userDialog.userGroups.ownGroups.length }}/{{
                            // @ts-ignore
                            cachedConfig?.constants?.GROUPS?.MAX_OWNED
                        }}</span
                    >
                    <TransitionGroup
                        tag="div"
                        name="user-group"
                        appear
                        class="user-group-grid user-group-grid--section">
                        <UserDialogGroupCard
                            v-for="(group, index) in userDialog.userGroups.ownGroups"
                            :key="group.id"
                            :group="group"
                            :style="{ '--stagger-index': Math.min(index, 7) }"
                            :can-manage="currentUser.id === userDialog.id" />
                    </TransitionGroup>
                </template>
                <template v-if="userDialog.userGroups.mutualGroups.length > 0">
                    <span class="user-groups-section__label text-base font-bold">{{
                        t('dialog.user.groups.mutual_groups')
                    }}</span>
                    <span class="user-groups-section__count text-xs ml-1.5">{{
                        userDialog.userGroups.mutualGroups.length
                    }}</span>
                    <TransitionGroup
                        tag="div"
                        name="user-group"
                        appear
                        class="user-group-grid user-group-grid--section">
                        <UserDialogGroupCard
                            v-for="(group, index) in userDialog.userGroups.mutualGroups"
                            :key="group.id"
                            :group="group"
                            :style="{ '--stagger-index': Math.min(index, 7) }"
                            :can-manage="currentUser.id === userDialog.id" />
                    </TransitionGroup>
                </template>
                <template v-if="userDialog.userGroups.remainingGroups.length > 0">
                    <span class="user-groups-section__label text-base font-bold">{{
                        t('dialog.user.groups.groups')
                    }}</span>
                    <span class="user-groups-section__count text-xs ml-1.5">
                        {{ userDialog.userGroups.remainingGroups.length }}
                        <template v-if="currentUser.id === userDialog.id">
                            /
                            <template v-if="isLocalUserVrcPlusSupporter">
                                {{ cachedConfig?.constants?.GROUPS?.MAX_JOINED_PLUS }}
                            </template>
                            <template v-else>
                                {{ cachedConfig?.constants?.GROUPS?.MAX_JOINED }}
                            </template>
                        </template>
                    </span>
                    <TransitionGroup
                        tag="div"
                        name="user-group"
                        appear
                        class="user-group-grid user-group-grid--section">
                        <UserDialogGroupCard
                            v-for="(group, index) in userDialog.userGroups.remainingGroups"
                            :key="group.id"
                            :group="group"
                            :style="{ '--stagger-index': Math.min(index, 7) }"
                            :can-manage="currentUser.id === userDialog.id" />
                    </TransitionGroup>
                </template>
                <div v-if="!userDialog.userGroups.groups.length" class="user-groups-empty" role="status">
                    <Users class="size-5" aria-hidden="true" />
                    <span>{{ t('dialog.user.groups.empty') }}</span>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
    import { ArrowDown, ArrowUp, DownloadIcon, Eye, LogOut, RefreshCw, Search, Tag, Users } from 'lucide-vue-next';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { computed, nextTick, ref, watch } from 'vue';
    import { Button } from '@/components/ui/button';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Input } from '@/components/ui/input';
    import { Spinner } from '@/components/ui/spinner';
    import { storeToRefs } from 'pinia';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';

    import UserDialogGroupCard from './UserDialogGroupCard.vue';
    import { useAuthStore, useGroupStore, useUiStore, useUserStore } from '../../../stores';
    import {
        showGroupDialog,
        applyGroup,
        saveCurrentUserGroups,
        updateInGameGroupOrder,
        leaveGroup,
        leaveGroupPrompt,
        setGroupVisibility,
        handleGroupList
    } from '../../../coordinators/groupCoordinator';
    import { compareByMemberCount, compareByName } from '../../../shared/utils';
    import { groupRequest } from '../../../api';
    import { useOptionKeySelect } from '../../../composables/useOptionKeySelect';
    import { userDialogGroupSortingOptions } from '../../../shared/constants';

    const { t } = useI18n();

    const { userDialog, currentUser, isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
    const { currentUserGroups, inGameGroupOrder } = storeToRefs(useGroupStore());
    const { cachedConfig } = storeToRefs(useAuthStore());
    const { shiftHeld } = storeToRefs(useUiStore());

    const userDialogGroupEditMode = ref(false);
    const userDialogGroupEditGroups = ref([]);
    const userDialogGroupAllSelected = ref(false);
    const userDialogGroupEditSelectedGroupIds = ref([]);

    const { selectedKey: userDialogGroupSortingKey, selectByKey: setUserDialogGroupSortingByKey } = useOptionKeySelect(
        userDialogGroupSortingOptions,
        () => userDialog.value.groupSorting,
        setUserDialogGroupSorting
    );

    const groupSearchQuery = ref('');
    const groupSearchActive = computed(() => groupSearchQuery.value.trim().length > 0);
    const allFilteredGroups = computed(() => {
        const query = groupSearchQuery.value.trim().toLowerCase();
        if (!query) return [];
        return userDialog.value.userGroups.groups.filter((g) => (g.name || '').toLowerCase().includes(query));
    });
    watch(
        () => userDialog.value.id,
        () => {
            groupSearchQuery.value = '';
        }
    );

    /**
     *
     * @param sortOrder
     */
    async function setUserDialogGroupSorting(sortOrder) {
        const D = userDialog.value;
        if (D.groupSorting.value === sortOrder.value) {
            return;
        }
        D.groupSorting = sortOrder;
        await sortCurrentUserGroups();
    }

    /**
     *
     * @param userId
     */
    async function getUserGroups(userId) {
        exitEditModeCurrentUserGroups();
        userDialog.value.isGroupsLoading = true;
        userDialog.value.userGroups = {
            groups: [],
            ownGroups: [],
            mutualGroups: [],
            remainingGroups: []
        };
        const args = await groupRequest.getGroups({ userId });
        handleGroupList(args);
        if (userId !== userDialog.value.id) {
            userDialog.value.isGroupsLoading = false;
            return;
        }
        if (userId === currentUser.value.id) {
            // update current user groups
            currentUserGroups.value.clear();
            args.json.forEach((group) => {
                const ref = applyGroup(group);
                if (!currentUserGroups.value.has(group.id)) {
                    currentUserGroups.value.set(group.id, ref);
                }
            });

            saveCurrentUserGroups();
        }
        userDialog.value.userGroups.groups = args.json;
        for (let i = 0; i < args.json.length; ++i) {
            const group = args.json[i];
            if (!group?.id) {
                console.error('getUserGroups, group ID is missing', group);
                continue;
            }
            if (group.ownerId === userId) {
                userDialog.value.userGroups.ownGroups.unshift(group);
            }
            if (userId === currentUser.value.id) {
                // skip mutual groups for current user
                if (group.ownerId !== userId) {
                    userDialog.value.userGroups.remainingGroups.unshift(group);
                }
                continue;
            }
            if (group.mutualGroup) {
                userDialog.value.userGroups.mutualGroups.unshift(group);
            }
            if (!group.mutualGroup && group.ownerId !== userId) {
                userDialog.value.userGroups.remainingGroups.unshift(group);
            }
        }
        if (userId === currentUser.value.id) {
            userDialog.value.groupSorting = userDialogGroupSortingOptions.inGame;
        } else if (userDialog.value.groupSorting.value === userDialogGroupSortingOptions.inGame.value) {
            userDialog.value.groupSorting = userDialogGroupSortingOptions.alphabetical;
        }
        await sortCurrentUserGroups();
        userDialog.value.isGroupsLoading = false;
    }

    /**
     *
     * @param a
     * @param b
     */
    function sortGroupsByInGame(a, b) {
        const aIndex = inGameGroupOrder.value.indexOf(a?.id);
        const bIndex = inGameGroupOrder.value.indexOf(b?.id);
        if (aIndex === -1 && bIndex === -1) {
            return 0;
        }
        if (aIndex === -1) {
            return 1;
        }
        if (bIndex === -1) {
            return -1;
        }
        return aIndex - bIndex;
    }

    /**
     *
     */
    async function sortCurrentUserGroups() {
        const D = userDialog.value;
        let sortMethod = () => 0;

        switch (D.groupSorting.value) {
            case 'alphabetical':
                sortMethod = compareByName;
                break;
            case 'members':
                sortMethod = compareByMemberCount;
                break;
            case 'inGame':
                sortMethod = sortGroupsByInGame;
                await updateInGameGroupOrder();
                break;
        }

        userDialog.value.userGroups.ownGroups.sort(sortMethod);
        userDialog.value.userGroups.mutualGroups.sort(sortMethod);
        userDialog.value.userGroups.remainingGroups.sort(sortMethod);
    }

    /**
     *
     */
    async function exitEditModeCurrentUserGroups() {
        userDialogGroupEditMode.value = false;
        userDialogGroupEditGroups.value = [];
        userDialogGroupEditSelectedGroupIds.value = [];
        userDialogGroupAllSelected.value = false;
        await sortCurrentUserGroups();
    }

    /**
     *
     */
    async function editModeCurrentUserGroups() {
        await updateInGameGroupOrder();
        userDialogGroupEditGroups.value = Array.from(currentUserGroups.value.values());
        userDialogGroupEditGroups.value.sort(sortGroupsByInGame);
        userDialogGroupEditMode.value = true;
    }

    /**
     *
     */
    async function saveInGameGroupOrder() {
        userDialogGroupEditGroups.value.sort(sortGroupsByInGame);
        try {
            await AppApi.SetVRChatRegistryKey(
                `VRC_GROUP_ORDER_${currentUser.value.id}`,
                JSON.stringify(inGameGroupOrder.value),
                3
            );
        } catch (err) {
            console.error(err);
            toast.error('Failed to save in-game group order');
        }
    }

    // Select all groups currently in the editable list by collecting their IDs
    /**
     *
     */
    function selectAllGroups() {
        const allSelected = userDialogGroupEditSelectedGroupIds.value.length === userDialogGroupEditGroups.value.length;

        // First update selection state
        userDialogGroupEditSelectedGroupIds.value = allSelected ? [] : userDialogGroupEditGroups.value.map((g) => g.id);
        userDialogGroupAllSelected.value = !allSelected;

        // Toggle editMode off and back on to force checkbox UI update
        userDialogGroupEditMode.value = false;
        nextTick(() => {
            userDialogGroupEditMode.value = true;
        });
    }

    const bulkGroupActionValue = ref('');

    /**
     *
     * @param value
     */
    function handleBulkGroupAction(value) {
        bulkGroupActionValue.value = value;

        if (value === 'leave') {
            bulkLeaveGroups();
        } else if (typeof value === 'string' && value.startsWith('visibility:')) {
            const newVisibility = value.slice('visibility:'.length);
            bulkSetVisibility(newVisibility);
        }

        nextTick(() => {
            bulkGroupActionValue.value = '';
        });
    }

    // Apply the given visibility to all selected groups
    /**
     *
     * @param newVisibility
     */
    async function bulkSetVisibility(newVisibility) {
        for (const groupId of userDialogGroupEditSelectedGroupIds.value) {
            setGroupVisibility(groupId, newVisibility);
        }
    }

    // Leave (remove user from) all selected groups
    /**
     *
     */
    function bulkLeaveGroups() {
        for (const groupId of userDialogGroupEditSelectedGroupIds.value) {
            leaveGroup(groupId);
        }
    }

    // Toggle individual group selection for bulk actions
    /**
     *
     * @param groupId
     */
    function toggleGroupSelection(groupId) {
        const index = userDialogGroupEditSelectedGroupIds.value.indexOf(groupId);
        if (index === -1) {
            userDialogGroupEditSelectedGroupIds.value.push(groupId);
        } else {
            userDialogGroupEditSelectedGroupIds.value.splice(index, 1);
        }
    }

    /**
     *
     * @param groupId
     */
    function moveGroupUp(groupId) {
        const index = inGameGroupOrder.value.indexOf(groupId);
        if (index > 0) {
            inGameGroupOrder.value.splice(index, 1);
            inGameGroupOrder.value.splice(index - 1, 0, groupId);
            saveInGameGroupOrder();
        }
    }

    /**
     *
     * @param groupId
     */
    function moveGroupDown(groupId) {
        const index = inGameGroupOrder.value.indexOf(groupId);
        if (index < inGameGroupOrder.value.length - 1) {
            inGameGroupOrder.value.splice(index, 1);
            inGameGroupOrder.value.splice(index + 1, 0, groupId);
            saveInGameGroupOrder();
        }
    }

    /**
     *
     * @param groupId
     */
    function moveGroupTop(groupId) {
        const index = inGameGroupOrder.value.indexOf(groupId);
        if (index > 0) {
            inGameGroupOrder.value.splice(index, 1);
            inGameGroupOrder.value.unshift(groupId);
            saveInGameGroupOrder();
        }
    }

    /**
     *
     * @param groupId
     */
    function moveGroupBottom(groupId) {
        const index = inGameGroupOrder.value.indexOf(groupId);
        if (index < inGameGroupOrder.value.length - 1) {
            inGameGroupOrder.value.splice(index, 1);
            inGameGroupOrder.value.push(groupId);
            saveInGameGroupOrder();
        }
    }

    defineExpose({ getUserGroups });
</script>

<style scoped>
    .user-groups-tab {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 0.5rem;
    }

    .user-groups-toolbar {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.375rem 0.75rem;
        border-bottom: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
        padding: 0 0 0.5rem;
    }

    .user-groups-toolbar__summary,
    .user-groups-toolbar__actions,
    .user-groups-count,
    .user-groups-sort {
        display: flex;
        min-width: 0;
        align-items: center;
    }

    .user-groups-toolbar__summary,
    .user-groups-toolbar__actions {
        gap: 0.375rem;
    }

    .user-groups-toolbar__actions {
        flex: 1 1 30rem;
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .user-groups-count {
        gap: 0.375rem;
        border-radius: 999px;
        background: color-mix(in oklab, var(--primary) 15%, transparent);
        padding: 0.25rem 0.625rem;
        color: var(--primary);
        font-size: 0.8125rem;
        font-weight: 650;
        white-space: nowrap;
    }

    .user-groups-edit-hint {
        color: var(--muted-foreground);
        font-size: 0.6875rem;
    }

    .user-groups-search {
        position: relative;
        min-width: min(100%, 12rem);
        flex: 1 1 13rem;
        max-width: 20rem;
    }

    .user-groups-search__icon {
        position: absolute;
        top: 50%;
        left: 0.75rem;
        z-index: 1;
        width: 1rem;
        height: 1rem;
        transform: translateY(-50%);
        color: var(--muted-foreground);
        pointer-events: none;
    }

    .user-groups-search__input {
        height: 2.25rem;
        padding-left: 2.25rem;
        font-size: 0.875rem;
    }

    .user-groups-sort {
        gap: 0.5rem;
        color: var(--muted-foreground);
        font-size: 0.8125rem;
        white-space: nowrap;
    }

    .user-groups-sort__trigger {
        width: 10.5rem;
        min-width: 0;
    }

    .user-groups-content {
        min-width: 0;
    }

    .user-groups-section__label {
        display: inline-block;
        margin-top: 0.375rem;
        font-size: 0.9375rem;
        letter-spacing: -0.01em;
        line-height: 1.25;
    }

    .user-groups-section__count {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: color-mix(in oklab, var(--muted) 70%, transparent);
        padding: 0.125rem 0.5rem;
        color: var(--muted-foreground);
        font-size: 0.6875rem;
        font-variant-numeric: tabular-nums;
        line-height: 1rem;
    }

    .user-group-grid {
        display: grid;
        min-width: 0;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr));
        gap: 0.375rem;
    }

    .user-group-grid--section {
        margin-top: 0.375rem;
        margin-bottom: 0.75rem;
    }

    .user-group-enter-active {
        transition:
            opacity 180ms ease-out,
            transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        transition-delay: calc(var(--stagger-index, 0) * 24ms);
    }

    .user-group-enter-from {
        transform: translateY(6px) scale(0.985);
        opacity: 0;
    }

    .user-group-leave-active {
        transition:
            opacity 110ms ease-in,
            transform 110ms ease-in;
        pointer-events: none;
    }

    .user-group-leave-to {
        transform: scale(0.98);
        opacity: 0;
    }

    .user-group-move {
        transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .user-groups-empty {
        display: flex;
        min-height: 7rem;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 1px dashed color-mix(in oklab, var(--border) 80%, transparent);
        border-radius: var(--radius-lg);
        background: color-mix(in oklab, var(--muted) 12%, transparent);
        padding: 1.25rem;
        color: var(--muted-foreground);
        font-size: 0.875rem;
        text-align: center;
    }

    @media (max-width: 42rem) {
        .user-groups-toolbar__actions {
            flex-basis: 100%;
            justify-content: flex-start;
        }

        .user-groups-search {
            max-width: none;
        }

        .user-groups-sort {
            flex: 1 1 auto;
            justify-content: space-between;
        }

        .user-groups-sort__trigger {
            flex: 1 1 auto;
            max-width: 12rem;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .user-group-enter-active,
        .user-group-leave-active,
        .user-group-move {
            transition: none;
            transition-delay: 0ms;
        }
    }
</style>
