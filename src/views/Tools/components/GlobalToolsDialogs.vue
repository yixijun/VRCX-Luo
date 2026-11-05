<template>
    <GroupCalendarDialog :visible="groupCalendar" @close="closeDialog('groupCalendar')" />
    <BatchAddFriendsDialog :visible="batchAddFriends" @close="closeDialog('batchAddFriends')" />
    <BlockedGroupsDialog :isBlockedGroupsDialogVisible="blockedGroups" @close="closeDialog('blockedGroups')" />
    <GroupInvitesDialog :isGroupInvitesDialogVisible="groupInvites" @close="closeDialog('groupInvites')" />
    <NoteExportDialog :isNoteExportDialogVisible="noteExport" @close="closeDialog('noteExport')" />
    <ExportDiscordNamesDialog v-model:discordNamesDialogVisible="exportDiscordNames" :friends="friends" />
    <ExportFriendsListDialog v-model:isExportFriendsListDialogVisible="exportFriendsList" :friends="friends" />
    <ExportAvatarsListDialog v-model:isExportAvatarsListDialogVisible="exportAvatarsList" />
    <EditInviteMessageDialog
        v-model:isEditInviteMessagesDialogVisible="editInviteMessages"
        @close="closeDialog('editInviteMessages')" />
    <RegistryBackupDialog />
    <AutoChangeStatusDialog
        :isAutoChangeStatusDialogVisible="autoChangeStatus"
        @close="closeDialog('autoChangeStatus')" />
    <ProfileCompletionDialog :visible="infoCompletion" @close="closeDialog('infoCompletion')" />
    <MemoryCleanupDialog :visible="memoryCleanup" @close="closeDialog('memoryCleanup')" />
    <ModerationReportsDialog
        :isModerationReportsDialogVisible="moderationReports"
        @close="closeDialog('moderationReports')" />
    <PurchaseHistoryDialog :isPurchaseHistoryDialogVisible="purchaseHistory" @close="closeDialog('purchaseHistory')" />
    <InfoPushDialog :isInfoPushDialogVisible="infoPush" @close="closeDialog('infoPush')" />
</template>

<script setup>
    import { storeToRefs } from 'pinia';
    import { useFriendStore, useToolsStore } from '../../../stores';
    import AutoChangeStatusDialog from '../dialogs/AutoChangeStatusDialog.vue';
    import BatchAddFriendsDialog from '../dialogs/BatchAddFriendsDialog.vue';
    import ProfileCompletionDialog from '../dialogs/ProfileCompletionDialog.vue';
    import RegistryBackupDialog from '../dialogs/RegistryBackupDialog.vue';
    import BlockedGroupsDialog from '../dialogs/BlockedGroupsDialog.vue';
    import EditInviteMessageDialog from '../dialogs/EditInviteMessagesDialog.vue';
    import ExportAvatarsListDialog from '../dialogs/ExportAvatarsListDialog.vue';
    import ExportDiscordNamesDialog from '../dialogs/ExportDiscordNamesDialog.vue';
    import ExportFriendsListDialog from '../dialogs/ExportFriendsListDialog.vue';
    import GroupCalendarDialog from '../dialogs/GroupCalendarDialog.vue';
    import MemoryCleanupDialog from '../dialogs/MemoryCleanupDialog.vue';
    import GroupInvitesDialog from '../dialogs/GroupInvitesDialog.vue';
    import InfoPushDialog from '../dialogs/InfoPushDialog.vue';
    import ModerationReportsDialog from '../dialogs/ModerationReportsDialog.vue';
    import PurchaseHistoryDialog from '../dialogs/PurchaseHistoryDialog.vue';
    import NoteExportDialog from '../dialogs/NoteExportDialog.vue';
    const { friends } = storeToRefs(useFriendStore());
    const toolsStore = useToolsStore();
    const {
        batchAddFriends,
        autoChangeStatus,
        infoCompletion,
        blockedGroups,
        editInviteMessages,
        exportAvatarsList,
        exportDiscordNames,
        exportFriendsList,
        groupCalendar,
        memoryCleanup,
        groupInvites,
        infoPush,
        moderationReports,
        purchaseHistory,
        noteExport
    } = storeToRefs(toolsStore);

    const { closeDialog } = toolsStore;
</script>
