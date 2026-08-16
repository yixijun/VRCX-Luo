<template>
    <div v-if="groupDialog.visible" class="group-members-tab">
        <div class="group-content-block group-members-toolbar">
            <div class="group-members-toolbar__title">
                <span
                    v-if="hasGroupPermission(groupDialog.ref, 'group-members-viewall')"
                    class="group-content-block__title"
                    >{{ t('dialog.group.members.all_members') }}</span
                >
                <span v-else class="group-content-block__title">{{ t('dialog.group.members.friends_only') }}</span>
                <span v-if="groupDialog.memberSearch.length" class="group-content-block__meta"
                    >{{ groupDialog.memberSearchResults.length }}/{{ groupDialog.ref.memberCount }}</span
                >
                <span v-else class="group-content-block__meta"
                    >{{ groupDialog.members.length }}/{{ groupDialog.ref.memberCount }}</span
                >
            </div>
            <div class="group-members-toolbar__actions">
                <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :loading="isGroupMembersLoading"
                    circle
                    @click="loadAllGroupMembers">
                    <Spinner v-if="isGroupMembersLoading" /><RefreshCcw v-else
                /></Button>
                <Button
                    class="rounded-full"
                    size="icon-sm"
                    variant="ghost"
                    @click="downloadAndSaveJson(`${groupDialog.id}_members`, groupDialog.members)">
                    <Download class="h-4 w-4" />
                </Button>
            </div>
            <div v-if="hasGroupPermission(groupDialog.ref, 'group-members-manage')" class="group-members-filters">
                <span class="group-content-block__meta">{{ t('dialog.group.members.sort_by') }}</span>
                <Select
                    v-model="groupDialogMemberSortValue"
                    :disabled="isGroupMembersLoading || groupDialog.memberSearch.length > 0">
                    <SelectTrigger class="h-8 min-w-0 flex-1 sm:w-45">
                        <SelectValue :placeholder="t('dialog.group.members.sort_by')" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="item in groupDialogSortingOptions" :key="item.value" :value="item.value">
                            {{ t(item.name) }}
                        </SelectItem>
                    </SelectContent>
                </Select>
                <span class="group-content-block__meta">{{ t('dialog.group.members.filter') }}</span>
                <div class="group-members-filter-select">
                    <VirtualCombobox
                        v-model="groupDialogMemberFilterKey"
                        :groups="groupDialogMemberFilterGroups"
                        :disabled="isGroupMembersLoading || groupDialog.memberSearch.length > 0"
                        :placeholder="t('dialog.group.members.filter')"
                        :search-placeholder="t('dialog.group.members.search')"
                        :clearable="false"
                        :close-on-select="true">
                        <template #trigger="{ text }">
                            <span class="truncate">
                                {{ text || t('dialog.group.members.filter') }}
                            </span>
                        </template>
                    </VirtualCombobox>
                </div>
            </div>
            <InputGroupField
                v-model="groupDialog.memberSearch"
                :disabled="!hasGroupPermission(groupDialog.ref, 'group-members-manage')"
                clearable
                size="sm"
                :placeholder="t('dialog.group.members.search')"
                @input="groupMembersSearch" />
        </div>
        <div v-if="groupDialog.memberSearch.length" class="group-content-block group-members-grid">
            <div
                v-for="user in groupDialog.memberSearchResults"
                :key="user.id"
                class="group-member-item"
                @click="showUserDialog(user.userId)">
                <div class="relative inline-block flex-none size-9 mr-2.5">
                    <Avatar class="size-9">
                        <AvatarImage :src="userImage(user.user)" class="object-cover" />
                        <AvatarFallback>
                            <User class="size-4 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
                </div>
                <div class="flex-1 overflow-hidden">
                    <span
                        class="block truncate font-medium leading-[18px]"
                        :style="{ color: user.user?.$userColour }"
                        v-text="user.user?.displayName" />
                    <span class="block truncate text-xs">
                        <template v-if="hasGroupPermission(groupDialog.ref, 'group-members-manage')">
                            <TooltipWrapper
                                v-if="user.isRepresenting"
                                side="top"
                                :content="t('dialog.group.members.representing')">
                                <Tag style="margin-right: 6px" />
                            </TooltipWrapper>
                            <TooltipWrapper v-if="user.visibility !== 'visible'" side="top">
                                <template #content>
                                    <span>{{ t('dialog.group.members.visibility') }} {{ user.visibility }}</span>
                                </template>
                                <Eye style="margin-right: 6px" />
                            </TooltipWrapper>
                            <TooltipWrapper
                                v-if="!user.isSubscribedToAnnouncements"
                                side="top"
                                :content="t('dialog.group.members.unsubscribed_announcements')">
                                <MessageSquare style="margin-right: 6px" />
                            </TooltipWrapper>
                            <TooltipWrapper v-if="user.managerNotes" side="top">
                                <template #content>
                                    <span>{{ t('dialog.group.members.manager_notes') }}</span>
                                    <br />
                                    <span>{{ user.managerNotes }}</span>
                                </template>
                                <Pencil style="margin-right: 6px" />
                            </TooltipWrapper>
                        </template>
                        <template v-for="roleId in user.roleIds" :key="roleId">
                            <template v-for="role in groupDialog.ref.roles" :key="role.id + roleId"
                                ><span v-if="role.id === roleId" v-text="role.name" /></template
                            ><template v-if="user.roleIds.indexOf(roleId) < user.roleIds.length - 1"
                                ><span>,&nbsp;</span></template
                            >
                        </template>
                    </span>
                </div>
            </div>
        </div>
        <ul v-else-if="groupDialog.members.length > 0" class="group-content-block group-members-grid infinite-list">
            <li
                v-for="user in groupDialog.members"
                :key="user.id"
                class="group-member-item infinite-list-item"
                @click="showUserDialog(user.userId)">
                <div class="relative inline-block flex-none size-9 mr-2.5">
                    <Avatar class="size-9">
                        <AvatarImage :src="userImage(user.user)" class="object-cover" />
                        <AvatarFallback>
                            <User class="size-4 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
                </div>
                <div class="flex-1 overflow-hidden">
                    <span
                        class="block truncate font-medium leading-[18px]"
                        :style="{ color: user.user?.$userColour }"
                        v-text="user.user?.displayName" />
                    <span class="block truncate text-xs">
                        <template v-if="hasGroupPermission(groupDialog.ref, 'group-members-manage')">
                            <TooltipWrapper
                                v-if="user.isRepresenting"
                                side="top"
                                :content="t('dialog.group.members.representing')">
                                <Tag style="margin-right: 6px" />
                            </TooltipWrapper>
                            <TooltipWrapper v-if="user.visibility !== 'visible'" side="top">
                                <template #content>
                                    <span>{{ t('dialog.group.members.visibility') }} {{ user.visibility }}</span>
                                </template>
                                <Eye style="margin-right: 6px" />
                            </TooltipWrapper>
                            <TooltipWrapper
                                v-if="!user.isSubscribedToAnnouncements"
                                side="top"
                                :content="t('dialog.group.members.unsubscribed_announcements')">
                                <MessageSquare style="margin-right: 6px" />
                            </TooltipWrapper>
                            <TooltipWrapper v-if="user.managerNotes" side="top">
                                <template #content>
                                    <span>{{ t('dialog.group.members.manager_notes') }}</span>
                                    <br />
                                    <span>{{ user.managerNotes }}</span>
                                </template>
                                <Pencil style="margin-right: 6px" />
                            </TooltipWrapper>
                        </template>
                        <template v-for="roleId in user.roleIds" :key="roleId">
                            <template v-for="role in groupDialog.ref.roles" :key="roleId + role.id"
                                ><span v-if="role.id === roleId" v-text="role.name" /></template
                            ><template v-if="user.roleIds.indexOf(roleId) < user.roleIds.length - 1"
                                ><span>&nbsp;</span></template
                            >
                        </template>
                    </span>
                </div>
            </li>
            <li v-if="!isGroupMembersDone" class="group-members-load-more" @click="loadMoreGroupMembers">
                <div v-if="!isGroupMembersLoading" class="flex-1 overflow-hidden">
                    <span class="block truncate font-medium leading-[18px]">{{
                        t('dialog.group.members.load_more')
                    }}</span>
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup>
    import { Download, Eye, MessageSquare, Pencil, RefreshCcw, Tag, User } from 'lucide-vue-next';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Button } from '@/components/ui/button';
    import { InputGroupField } from '@/components/ui/input-group';
    import { Spinner } from '@/components/ui/spinner';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { downloadAndSaveJson, hasGroupPermission } from '../../../shared/utils';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { useGroupStore, useUserStore } from '../../../stores';
    import { applyGroupMember, handleGroupMember } from '../../../coordinators/groupCoordinator';
    import { groupDialogSortingOptions } from '../../../shared/constants';
    import { useGroupMembers } from './useGroupMembers';
    import { showUserDialog } from '../../../coordinators/userCoordinator';

    const { userImage } = useUserDisplay();
    const { t } = useI18n();

    const { currentUser } = storeToRefs(useUserStore());
    const { groupDialog } = storeToRefs(useGroupStore());

    const {
        isGroupMembersDone,
        isGroupMembersLoading,
        groupDialogMemberSortValue,
        groupDialogMemberFilterKey,
        groupDialogMemberFilterGroups,
        groupMembersSearch,
        getGroupDialogGroupMembers,
        loadMoreGroupMembers,
        loadAllGroupMembers
    } = useGroupMembers(groupDialog, { currentUser, applyGroupMember, handleGroupMember, t });

    defineExpose({
        getGroupDialogGroupMembers
    });
</script>

<style scoped>
    .group-members-tab {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 0.75rem;
    }

    .group-members-toolbar {
        display: grid;
        min-width: 0;
        grid-template-columns: minmax(0, auto) minmax(0, 1fr);
        align-items: center;
        gap: 0.625rem 0.875rem;
        padding: 0.75rem;
    }

    .group-members-toolbar__title,
    .group-members-toolbar__actions,
    .group-members-filters {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.5rem;
    }

    .group-members-toolbar__actions {
        justify-self: end;
    }

    .group-members-filters {
        grid-column: 1 / -1;
        flex-wrap: wrap;
    }

    .group-members-filter-select {
        min-width: min(100%, 12rem);
        flex: 1;
    }

    .group-members-toolbar :deep(.input-group-field) {
        grid-column: 1 / -1;
        min-width: 0;
    }

    .group-members-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
        gap: 0.25rem;
        max-height: min(28rem, 55vh);
        overflow: auto;
        margin: 0;
        padding: 0.5rem;
        list-style: none;
    }

    .group-member-item {
        display: flex;
        min-width: 0;
        cursor: pointer;
        align-items: center;
        border-radius: var(--radius-lg);
        padding: 0.375rem;
        font-size: 0.8125rem;
        transition:
            background-color var(--motion-fast) ease,
            transform var(--motion-fast) ease;
    }

    .group-member-item:hover {
        background: var(--surface-hover);
    }

    .group-member-item:active {
        transform: scale(0.985);
    }

    .group-members-load-more {
        grid-column: 1 / -1;
        min-height: 2.75rem;
        cursor: pointer;
        padding: 0.625rem;
        text-align: center;
    }

    @media (max-width: 36rem) {
        .group-members-toolbar {
            grid-template-columns: minmax(0, 1fr) auto;
        }

        .group-members-filters {
            align-items: stretch;
            flex-direction: column;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .group-member-item {
            transition: none;
        }
    }
</style>
