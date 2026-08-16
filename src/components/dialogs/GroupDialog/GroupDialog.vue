<template>
    <div class="group-dialog flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <DialogHeader class="sr-only">
            <DialogTitle>{{ groupDialog.ref?.name || t('dialog.group.info.header') }}</DialogTitle>
            <DialogDescription>
                {{ groupDialog.ref?.description || groupDialog.ref?.name || t('dialog.group.info.header') }}
            </DialogDescription>
        </DialogHeader>
        <div
            ref="workspaceRef"
            class="group-dialog__workspace"
            :style="{ '--group-sidebar-width': `${sidebarWidth}px` }">
            <div class="group-dialog__summary">
                <div class="group-dialog__body">
                    <div class="group-header min-w-0 flex-1">
                        <div class="group-dialog__title-row">
                            <span v-if="groupDialog.ref.ownerId === currentUser.id" class="shrink-0">👑</span>
                            <button
                                type="button"
                                class="group-dialog__title"
                                @click="copyToClipboard(groupDialog.ref.name)"
                                v-text="groupDialog.ref.name"></button>
                            <span class="group-discriminator shrink-0 font-mono text-xs text-muted-foreground">
                                {{ groupDialog.ref.shortCode }}.{{ groupDialog.ref.discriminator }}
                            </span>
                            <span class="group-dialog__languages">
                                <TooltipWrapper v-for="item in groupDialog.ref.$languages" :key="item.key" side="top">
                                    <template #content>
                                        <span>{{ item.value }} ({{ item.key }})</span>
                                    </template>
                                    <span class="flags" :class="languageClass(item.key)"></span>
                                </TooltipWrapper>
                            </span>
                        </div>
                        <div class="group-dialog__owner-row mt-1">
                            <span
                                class="cursor-pointer text-sm text-muted-foreground"
                                @click="showUserDialog(groupDialog.ref.ownerId)"
                                v-text="groupDialog.ownerDisplayName"></span>
                            <div v-if="groupDialog.ref.links?.length" class="group-dialog__links">
                                <TooltipWrapper
                                    v-for="(link, index) in groupDialog.ref.links"
                                    :key="`${link}-${index}`"
                                    side="top">
                                    <template #content>
                                        <span v-text="link" />
                                    </template>
                                    <button
                                        v-if="link"
                                        type="button"
                                        class="group-dialog__link"
                                        @click="openExternalLink(link)">
                                        <img :src="getFaviconUrl(link)" alt="" loading="lazy" />
                                    </button>
                                </TooltipWrapper>
                            </div>
                        </div>
                        <div class="group-tags mt-1 flex flex-wrap items-center">
                            <Badge v-if="groupDialog.ref.isVerified" variant="outline" class="group-dialog__tag">
                                {{ t('dialog.group.tags.verified') }}
                            </Badge>
                            <Badge
                                v-if="groupDialog.ref.privacy === 'private'"
                                variant="outline"
                                class="group-dialog__tag">
                                {{ t('dialog.group.tags.private') }}
                            </Badge>
                            <Badge
                                v-if="groupDialog.ref.privacy === 'default'"
                                variant="outline"
                                class="group-dialog__tag">
                                {{ t('dialog.group.tags.public') }}
                            </Badge>
                            <Badge
                                v-if="groupDialog.ref.joinState === 'open'"
                                variant="outline"
                                class="group-dialog__tag">
                                {{ t('dialog.group.tags.open') }}
                            </Badge>
                            <Badge
                                v-else-if="groupDialog.ref.joinState === 'request'"
                                variant="outline"
                                class="group-dialog__tag">
                                {{ t('dialog.group.tags.request') }}
                            </Badge>
                            <Badge
                                v-else-if="groupDialog.ref.joinState === 'invite'"
                                variant="outline"
                                class="group-dialog__tag">
                                {{ t('dialog.group.tags.invite') }}
                            </Badge>
                            <Badge
                                v-else-if="groupDialog.ref.joinState === 'closed'"
                                variant="outline"
                                class="group-dialog__tag">
                                {{ t('dialog.group.tags.closed') }}
                            </Badge>
                            <Badge v-if="groupDialog.inGroup" variant="outline" class="group-dialog__tag">
                                {{ t('dialog.group.tags.joined') }}
                            </Badge>
                            <Badge
                                v-if="groupDialog.ref.myMember && groupDialog.ref.myMember.bannedAt"
                                variant="outline"
                                class="group-dialog__tag">
                                {{ t('dialog.group.tags.banned') }}
                            </Badge>
                            <template v-if="groupDialog.inGroup && groupDialog.ref.myMember">
                                <Badge
                                    v-if="groupDialog.ref.myMember.visibility === 'visible'"
                                    variant="outline"
                                    class="group-dialog__tag">
                                    {{ t('dialog.group.tags.visible') }}
                                </Badge>
                                <Badge
                                    v-else-if="groupDialog.ref.myMember.visibility === 'friends'"
                                    variant="outline"
                                    class="group-dialog__tag">
                                    {{ t('dialog.group.tags.friends') }}
                                </Badge>
                                <Badge
                                    v-else-if="groupDialog.ref.myMember.visibility === 'hidden'"
                                    variant="outline"
                                    class="group-dialog__tag">
                                    {{ t('dialog.group.tags.hidden') }}
                                </Badge>
                                <Badge
                                    v-if="groupDialog.ref.myMember.isSubscribedToAnnouncements"
                                    variant="outline"
                                    class="group-dialog__tag">
                                    {{ t('dialog.group.tags.subscribed') }}
                                </Badge>
                            </template>
                        </div>
                        <div class="mt-2">
                            <pre
                                v-show="groupDialog.ref.name !== groupDialog.ref.description"
                                class="group-dialog__description font-[inherit] text-xs"
                                v-text="groupDialog.ref.description"></pre>
                        </div>
                    </div>
                    <div class="group-dialog__actions">
                        <DropdownMenu v-if="canCreateGroupContent">
                            <DropdownMenuTrigger as-child>
                                <Button
                                    class="rounded-full"
                                    variant="outline"
                                    size="icon-sm"
                                    :aria-label="t('dialog.group.actions.create_content')">
                                    <Plus />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem v-if="canManageCalendar" @click="showGroupEventCreateDialog">
                                    <CalendarPlus class="size-4" />
                                    {{ t('dialog.group.actions.create_event') }}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    v-if="canManageAnnouncements"
                                    @click="showGroupPostEditDialog(groupDialog.id, null)">
                                    <Megaphone class="size-4" />
                                    {{ t('dialog.group.actions.create_announcement') }}
                                </DropdownMenuItem>
                                <DropdownMenuItem v-if="canManageGalleries" @click="showGroupGalleryCreateDialog">
                                    <Images class="size-4" />
                                    {{ t('dialog.group.actions.create_gallery') }}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <template v-if="groupDialog.inGroup && groupDialog.ref?.myMember">
                            <TooltipWrapper
                                v-if="groupDialog.ref.myMember?.isRepresenting"
                                side="top"
                                :content="t('dialog.group.actions.unrepresent_tooltip')">
                                <Button
                                    class="mr-1 rounded-full"
                                    variant="secondary"
                                    size="icon-sm"
                                    @click="clearGroupRepresentation(groupDialog.id)">
                                    <BookmarkCheck />
                                </Button>
                            </TooltipWrapper>
                            <TooltipWrapper v-else side="top" :content="t('dialog.group.actions.represent_tooltip')">
                                <span>
                                    <Button
                                        class="mr-1 rounded-full"
                                        variant="outline"
                                        size="icon-sm"
                                        :disabled="groupDialog.ref.privacy === 'private'"
                                        @click="setGroupRepresentation(groupDialog.id)">
                                        <Bookmark />
                                    </Button>
                                </span>
                            </TooltipWrapper>
                        </template>
                        <template v-else-if="groupDialog.ref.myMember?.membershipStatus === 'requested'">
                            <TooltipWrapper side="top" :content="t('dialog.group.actions.cancel_join_request_tooltip')">
                                <span>
                                    <Button
                                        class="mr-1 rounded-full"
                                        variant="outline"
                                        size="icon-sm"
                                        @click="cancelGroupRequest(groupDialog.id)">
                                        <X />
                                    </Button>
                                </span>
                            </TooltipWrapper>
                        </template>
                        <template v-else-if="groupDialog.ref.myMember?.membershipStatus === 'invited'">
                            <TooltipWrapper side="top" :content="t('dialog.group.actions.pending_request_tooltip')">
                                <span>
                                    <Button
                                        class="mr-1 rounded-full"
                                        variant="outline"
                                        size="icon-sm"
                                        @click="joinGroup(groupDialog.id)">
                                        <Check />
                                    </Button>
                                </span>
                            </TooltipWrapper>
                        </template>
                        <template v-else>
                            <TooltipWrapper
                                v-if="groupDialog.ref.joinState === 'request'"
                                side="top"
                                :content="t('dialog.group.actions.request_join_tooltip')">
                                <Button
                                    class="mr-1 rounded-full"
                                    variant="outline"
                                    size="icon-sm"
                                    @click="joinGroup(groupDialog.id)">
                                    <MessageSquare />
                                </Button>
                            </TooltipWrapper>
                            <TooltipWrapper
                                v-if="groupDialog.ref.joinState === 'invite'"
                                side="top"
                                :content="t('dialog.group.actions.invite_required_tooltip')">
                                <span>
                                    <Button class="mr-1 rounded-full" variant="outline" size="icon-sm" disabled>
                                        <MessageSquare />
                                    </Button>
                                </span>
                            </TooltipWrapper>
                            <TooltipWrapper
                                v-if="groupDialog.ref.joinState === 'open'"
                                side="top"
                                :content="t('dialog.group.actions.join_group_tooltip')">
                                <Button
                                    class="mr-1 rounded-full"
                                    variant="outline"
                                    size="icon-sm"
                                    @click="joinGroup(groupDialog.id)">
                                    <Check />
                                </Button>
                            </TooltipWrapper>
                        </template>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button
                                    class="rounded-full"
                                    :variant="
                                        groupDialog.ref.membershipStatus === 'userblocked' ? 'destructive' : 'outline'
                                    "
                                    size="icon-sm">
                                    <MoreHorizontal />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem @click="groupDialogCommand('Refresh')">
                                    <RefreshCw class="size-4" />
                                    {{ t('dialog.group.actions.refresh') }}
                                </DropdownMenuItem>
                                <DropdownMenuItem @click="groupDialogCommand('Share')">
                                    <Share2 class="size-4" />
                                    {{ t('dialog.group.actions.share') }}
                                </DropdownMenuItem>
                                <template v-if="groupDialog.inGroup">
                                    <template v-if="groupDialog.ref.myMember">
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            v-if="groupDialog.ref.myMember.isSubscribedToAnnouncements"
                                            @click="groupDialogCommand('Unsubscribe To Announcements')">
                                            <BellOff class="size-4" />
                                            {{ t('dialog.group.actions.unsubscribe') }}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            v-else
                                            @click="groupDialogCommand('Subscribe To Announcements')">
                                            <Bell class="size-4" />
                                            {{ t('dialog.group.actions.subscribe') }}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            v-if="hasGroupPermission(groupDialog.ref, 'group-invites-manage')"
                                            @click="groupDialogCommand('Invite To Group')">
                                            <MessageSquare class="size-4" />
                                            {{ t('dialog.group.actions.invite_to_group') }}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            :disabled="!hasGroupModerationPermission(groupDialog.ref)"
                                            @click="groupDialogCommand('Moderation Tools')">
                                            <Settings class="size-4" />
                                            {{ t('dialog.group.actions.moderation_tools') }}
                                        </DropdownMenuItem>
                                        <template
                                            v-if="groupDialog.ref.myMember && groupDialog.ref.privacy === 'default'">
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem @click="groupDialogCommand('Visibility Everyone')">
                                                <Eye class="size-4" />
                                                <Check
                                                    v-if="groupDialog.ref.myMember.visibility === 'visible'"
                                                    class="size-4" />
                                                {{ t('dialog.group.actions.visibility_everyone') }}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem @click="groupDialogCommand('Visibility Friends')">
                                                <Eye class="size-4" />
                                                <Check
                                                    v-if="groupDialog.ref.myMember.visibility === 'friends'"
                                                    class="size-4" />
                                                {{ t('dialog.group.actions.visibility_friends') }}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem @click="groupDialogCommand('Visibility Hidden')">
                                                <Eye class="size-4" />
                                                <Check
                                                    v-if="groupDialog.ref.myMember.visibility === 'hidden'"
                                                    class="size-4" />
                                                {{ t('dialog.group.actions.visibility_hidden') }}
                                            </DropdownMenuItem>
                                        </template>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            variant="destructive"
                                            @click="groupDialogCommand('Leave Group')">
                                            <Trash2 class="size-4" />
                                            {{ t('dialog.group.actions.leave') }}
                                        </DropdownMenuItem>
                                    </template>
                                </template>
                                <template v-else>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        v-if="groupDialog.ref.membershipStatus === 'userblocked'"
                                        variant="destructive"
                                        @click="groupDialogCommand('Unblock Group')">
                                        <CheckCircle class="size-4" />
                                        {{ t('dialog.group.actions.unblock') }}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem v-else @click="groupDialogCommand('Block Group')">
                                        <XCircle class="size-4" />
                                        {{ t('dialog.group.actions.block') }}
                                    </DropdownMenuItem>
                                </template>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            <div
                class="group-dialog__splitter"
                role="separator"
                aria-orientation="vertical"
                :aria-label="t('dialog.group.resize_sidebar')"
                :aria-valuenow="sidebarWidth"
                tabindex="0"
                @pointerdown="startSidebarResize"
                @keydown.left.prevent="resizeSidebarBy(16)"
                @keydown.right.prevent="resizeSidebarBy(-16)">
                <div class="group-dialog__splitter-grip"></div>
            </div>
            <div class="group-dialog__main">
                <div class="group-dialog__hero">
                    <img
                        v-if="!groupDialog.loading && !bannerError"
                        :src="groupDialog.ref.bannerUrl"
                        class="group-dialog__banner"
                        @click="showFullscreenImageDialog(groupDialog.ref.bannerUrl)"
                        @error="bannerError = true"
                        loading="lazy" />
                    <div v-else-if="!groupDialog.loading" class="group-dialog__banner-fallback">
                        <Image class="size-8 text-muted-foreground" />
                    </div>
                    <div class="group-dialog__icon">
                        <img
                            v-if="!groupDialog.loading && !imageError"
                            :src="groupDialog.ref.iconUrl"
                            class="size-full cursor-pointer object-cover"
                            @click="showFullscreenImageDialog(groupDialog.ref.iconUrl)"
                            @error="imageError = true"
                            loading="lazy" />
                        <div
                            v-else-if="!groupDialog.loading"
                            class="flex size-full items-center justify-center bg-muted">
                            <Image class="size-7 text-muted-foreground" />
                        </div>
                    </div>
                </div>
                <TabsUnderline
                    v-model="groupDialog.activeTab"
                    class="group-dialog__tabs"
                    :items="groupDialogTabs"
                    :unmount-on-hide="false"
                    fill
                    @update:modelValue="groupDialogTabClick">
                    <template #Info>
                        <GroupDialogInfoTab
                            :show-group-post-edit-dialog="showGroupPostEditDialog"
                            :confirm-delete-group-post="confirmDeleteGroupPost" />
                    </template>
                    <template #Events>
                        <GroupDialogEventsTab :confirm-delete-group-event="confirmDeleteGroupEvent" />
                    </template>
                    <template #Instances>
                        <GroupDialogInstancesTab />
                    </template>
                    <template #Posts>
                        <GroupDialogPostsTab
                            :show-group-post-edit-dialog="showGroupPostEditDialog"
                            :confirm-delete-group-post="confirmDeleteGroupPost" />
                    </template>
                    <template #Members>
                        <GroupDialogMembersTab ref="membersTabRef" />
                    </template>
                    <template #Photos>
                        <GroupDialogPhotosTab ref="photosTabRef" />
                    </template>
                    <template #JSON>
                        <DialogJsonTab
                            :tree-data="treeData"
                            :tree-data-key="treeData?.group?.id"
                            :dialog-id="groupDialog.id"
                            :dialog-ref="groupDialog.ref"
                            @refresh="refreshGroupDialogTreeData()" />
                    </template>
                </TabsUnderline>
            </div>
        </div>
        <GroupPostEditDialog :dialog-data="groupPostEditDialog" :selected-gallery-file="selectedGalleryFile" />
        <GroupEventCreateDialog
            :dialog-data="groupEventCreateDialog"
            :group-name="groupDialog.ref.name"
            @created="handleGroupEventCreated" />
        <GroupGalleryCreateDialog
            :dialog-data="groupGalleryCreateDialog"
            :group-name="groupDialog.ref.name"
            @created="handleGroupGalleryCreated" />
    </div>
</template>

<script setup>
    import {
        Bell,
        BellOff,
        Bookmark,
        BookmarkCheck,
        CalendarPlus,
        Check,
        CheckCircle,
        Eye,
        Image,
        Images,
        Megaphone,
        MessageSquare,
        MoreHorizontal,
        Plus,
        RefreshCw,
        Settings,
        Share2,
        Trash2,
        X,
        XCircle
    } from 'lucide-vue-next';
    import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
    import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { TabsUnderline } from '@/components/ui/tabs';
    import { storeToRefs } from 'pinia';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';

    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuSeparator,
        DropdownMenuTrigger
    } from '../../ui/dropdown-menu';
    import {
        copyToClipboard,
        getFaviconUrl,
        hasGroupModerationPermission,
        hasGroupPermission,
        languageClass,
        openExternalLink,
        removeFromArray
    } from '../../../shared/utils';
    import { useGalleryStore, useGroupStore, useModalStore, useUserStore } from '../../../stores';
    import {
        getGroupDialogGroup,
        showGroupDialog,
        leaveGroupPrompt,
        setGroupVisibility,
        setGroupSubscription
    } from '../../../coordinators/groupCoordinator';
    import { groupRequest, queryRequest } from '../../../api';
    import { queryKeys, refetchActiveEntityQuery } from '../../../queries';
    import { Badge } from '../../ui/badge';
    import { formatJsonVars } from '../../../shared/utils/base/ui';

    import DialogJsonTab from '../DialogJsonTab.vue';
    import GroupDialogInfoTab from './GroupDialogInfoTab.vue';
    import GroupDialogEventsTab from './GroupDialogEventsTab.vue';
    import GroupDialogInstancesTab from './GroupDialogInstancesTab.vue';
    import GroupEventCreateDialog from './GroupEventCreateDialog.vue';
    import GroupGalleryCreateDialog from './GroupGalleryCreateDialog.vue';
    import { useGroupDialogCommands } from './useGroupDialogCommands';
    import GroupDialogMembersTab from './GroupDialogMembersTab.vue';
    import GroupDialogPhotosTab from './GroupDialogPhotosTab.vue';
    import GroupDialogPostsTab from './GroupDialogPostsTab.vue';
    import GroupPostEditDialog from './GroupPostEditDialog.vue';
    import { showUserDialog } from '../../../coordinators/userCoordinator';
    import configRepository from '../../../services/config';

    const { t } = useI18n();
    const groupDialogTabs = computed(() => [
        { value: 'Info', label: t('dialog.group.info.header') },
        { value: 'Posts', label: t('dialog.group.posts.header') },
        { value: 'Instances', label: t('dialog.group.instances.header') },
        { value: 'Events', label: t('dialog.group.events.header') },
        { value: 'Members', label: t('dialog.group.members.header') },
        { value: 'Photos', label: t('dialog.group.gallery.header') },
        { value: 'JSON', label: t('dialog.group.json.header') }
    ]);

    const modalStore = useModalStore();

    const { currentUser } = storeToRefs(useUserStore());
    const { groupDialog, inviteGroupDialog } = storeToRefs(useGroupStore());
    const { updateGroupPostSearch, showGroupMemberModerationDialog } = useGroupStore();

    const { showFullscreenImageDialog } = useGalleryStore();
    const sidebarWidth = ref(288);
    const workspaceRef = ref(null);
    let resizingSidebar = false;

    const canManageCalendar = computed(() => hasGroupPermission(groupDialog.value.ref, 'group-calendar-manage'));
    const canManageAnnouncements = computed(
        () =>
            hasGroupPermission(groupDialog.value.ref, 'group-announcements-manage') ||
            hasGroupPermission(groupDialog.value.ref, 'group-announcement-manage')
    );
    const canManageGalleries = computed(() => hasGroupPermission(groupDialog.value.ref, 'group-galleries-manage'));
    const canCreateGroupContent = computed(
        () => canManageCalendar.value || canManageAnnouncements.value || canManageGalleries.value
    );

    const { groupDialogCommand } = useGroupDialogCommands(groupDialog, {
        t,
        modalStore,
        currentUser,
        showGroupDialog,
        leaveGroupPrompt,
        setGroupVisibility,
        setGroupSubscription,
        showGroupMemberModerationDialog,
        showInviteGroupDialog: (groupId, userId) => {
            if (groupId) {
                inviteGroupDialog.value.groupId = groupId;
            }
            if (userId) {
                inviteGroupDialog.value.userId = userId;
            }
            inviteGroupDialog.value.visible = true;
        },
        showGroupPostEditDialog,
        groupRequest
    });

    const groupDialogTabCurrentName = ref('0');
    const treeData = ref({});
    const imageError = ref(false);
    const bannerError = ref(false);

    watch(
        () => groupDialog.value.id,
        () => {
            imageError.value = false;
            bannerError.value = false;
        }
    );
    const membersTabRef = ref(null);
    const photosTabRef = ref(null);

    const selectedGalleryFile = ref({
        selectedFileId: '',
        selectedImageUrl: ''
    });
    const groupPostEditDialog = reactive({
        visible: false,
        groupRef: {},
        title: '',
        text: '',
        sendNotification: true,
        visibility: 'group',
        roleIds: [],
        postId: '',
        groupId: ''
    });
    const groupEventCreateDialog = reactive({
        visible: false,
        groupId: '',
        title: '',
        description: '',
        startsAt: '',
        endsAt: '',
        accessType: 'public',
        category: 'other',
        sendCreationNotification: true
    });
    const groupGalleryCreateDialog = reactive({
        visible: false,
        groupId: '',
        name: '',
        description: '',
        membersOnly: false
    });

    onMounted(async () => {
        const storedWidth = await configRepository.getInt('VRCX_groupDialogSidebarWidth', 288);
        if (Number.isFinite(storedWidth)) {
            sidebarWidth.value = Math.min(420, Math.max(240, storedWidth));
        }
    });

    onBeforeUnmount(() => stopSidebarResize(false));

    function startSidebarResize(event) {
        if (window.matchMedia('(max-width: 60rem)').matches) {
            return;
        }
        resizingSidebar = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        document.body.classList.add('group-dialog-is-resizing');
        window.addEventListener('pointermove', handleSidebarResize);
        window.addEventListener('pointerup', finishSidebarResize, { once: true });
    }

    function handleSidebarResize(event) {
        if (!resizingSidebar || !workspaceRef.value) {
            return;
        }
        const rect = workspaceRef.value.getBoundingClientRect();
        const maxWidth = Math.min(420, Math.max(240, rect.width - 420));
        sidebarWidth.value = Math.round(Math.min(maxWidth, Math.max(240, rect.right - event.clientX)));
    }

    function finishSidebarResize() {
        stopSidebarResize(true);
    }

    function stopSidebarResize(save) {
        if (!resizingSidebar) {
            return;
        }
        resizingSidebar = false;
        document.body.classList.remove('group-dialog-is-resizing');
        window.removeEventListener('pointermove', handleSidebarResize);
        window.removeEventListener('pointerup', finishSidebarResize);
        if (save) {
            configRepository.setInt('VRCX_groupDialogSidebarWidth', sidebarWidth.value);
        }
    }

    function resizeSidebarBy(delta) {
        sidebarWidth.value = Math.min(420, Math.max(240, sidebarWidth.value + delta));
        configRepository.setInt('VRCX_groupDialogSidebarWidth', sidebarWidth.value);
    }

    function toLocalDateTimeInput(date) {
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function showGroupEventCreateDialog() {
        const startsAt = new Date(Date.now() + 60 * 60 * 1000);
        startsAt.setMinutes(Math.ceil(startsAt.getMinutes() / 15) * 15, 0, 0);
        const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
        Object.assign(groupEventCreateDialog, {
            visible: true,
            groupId: groupDialog.value.id,
            title: '',
            description: '',
            startsAt: toLocalDateTimeInput(startsAt),
            endsAt: toLocalDateTimeInput(endsAt),
            accessType: 'public',
            category: 'other',
            sendCreationNotification: true
        });
    }

    function showGroupGalleryCreateDialog() {
        Object.assign(groupGalleryCreateDialog, {
            visible: true,
            groupId: groupDialog.value.id,
            name: '',
            description: '',
            membersOnly: false
        });
    }

    function handleGroupEventCreated(event) {
        groupDialog.value.calendar = [event, ...(groupDialog.value.calendar ?? [])];
        groupDialog.value.activeTab = 'Events';
    }

    async function handleGroupGalleryCreated(gallery) {
        const galleries = groupDialog.value.ref.galleries ?? [];
        if (!galleries.some((item) => item.id === gallery.id)) {
            groupDialog.value.ref.galleries = [...galleries, gallery];
        }
        groupDialog.value.activeTab = 'Photos';
        await nextTick();
        photosTabRef.value?.getGroupGalleries();
    }

    watch(
        () => groupDialog.value.isGetGroupDialogGroupLoading,
        (val) => {
            if (val) {
                loadLastActiveTab();
            }
        }
    );

    /**
     *
     * @param groupId
     */
    function setGroupRepresentation(groupId) {
        handleGroupRepresentationChange(groupId, true);
    }
    /**
     *
     * @param groupId
     */
    function clearGroupRepresentation(groupId) {
        handleGroupRepresentationChange(groupId, false);
    }

    /**
     *
     */

    /**
     *
     * @param groupId
     * @param isSet
     */
    function handleGroupRepresentationChange(groupId, isSet) {
        groupRequest
            .setGroupRepresentation(groupId, {
                isRepresenting: isSet
            })
            .then((args) => {
                if (groupDialog.value.visible && groupDialog.value.id === args.groupId) {
                    updateGroupDialogData({
                        ...groupDialog.value,
                        ref: { ...groupDialog.value.ref, isRepresenting: args.params.isRepresenting }
                    });
                    getGroupDialogGroup(groupId);
                }
                refetchActiveEntityQuery(queryKeys.representedGroup(currentUser.value.id));
            });
    }

    /**
     *
     * @param id
     */
    function cancelGroupRequest(id) {
        groupRequest
            .cancelGroupRequest({
                groupId: id
            })
            .then(() => {
                if (groupDialog.value.visible && groupDialog.value.id === id) {
                    getGroupDialogGroup(id);
                }
            });
    }
    /**
     *
     * @param post
     */
    function confirmDeleteGroupPost(post) {
        modalStore
            .confirm({
                description: t('confirm.delete_post'),
                title: t('confirm.title'),
                destructive: true
            })
            .then(({ ok }) => {
                if (!ok) return;
                groupRequest
                    .deleteGroupPost({
                        groupId: post.groupId,
                        postId: post.id
                    })
                    .then((args) => {
                        const D = groupDialog.value;
                        if (D.id !== args.params.groupId) {
                            return;
                        }

                        const postId = args.params.postId;
                        // remove existing post
                        for (const item of D.posts) {
                            if (item.id === postId) {
                                removeFromArray(D.posts, item);
                                break;
                            }
                        }
                        // remove/update announcement
                        if (postId === D.announcement.id) {
                            if (D.posts.length > 0) {
                                D.announcement = D.posts[0];
                            } else {
                                D.announcement = {};
                            }
                        }
                        updateGroupPostSearch();
                    });
            })
            .catch(() => {});
    }

    async function confirmDeleteGroupEvent(event) {
        const { ok } = await modalStore.confirm({
            description: t('confirm.delete_group_event', { title: event.title }),
            title: t('confirm.title'),
            destructive: true
        });
        if (!ok) {
            return;
        }

        try {
            const args = await groupRequest.deleteGroupEvent({
                groupId: groupDialog.value.id,
                eventId: event.id
            });
            if (groupDialog.value.id === args.params.groupId) {
                groupDialog.value.calendar = (groupDialog.value.calendar ?? []).filter(
                    (item) => item.id !== args.params.eventId
                );
            }
            toast.success(t('dialog.group_calendar.event_card.deleted'));
        } catch (error) {
            toast.error(error?.message || t('dialog.group_calendar.event_card.delete_failed'));
        }
    }

    /**
     *
     * @param gallery
     */

    /**
     *
     * @param id
     */
    function joinGroup(id) {
        if (!id) {
            return null;
        }
        return groupRequest
            .joinGroup({
                groupId: id
            })
            .then((args) => {
                if (groupDialog.value.visible && groupDialog.value.id === id) {
                    updateGroupDialogData({
                        ...groupDialog.value,
                        inGroup: args.json.membershipStatus === 'member'
                    });
                    // groupDialog.value.inGroup = json.membershipStatus === 'member';
                    getGroupDialogGroup(id);
                }
                if (args.json.membershipStatus === 'member') {
                    toast.success(t('message.group.joined'));
                } else if (args.json.membershipStatus === 'requested') {
                    toast.success(t('message.group.join_request_sent'));
                }
                return args;
            });
    }

    /**
     *
     * @param tabName
     */
    function handleGroupDialogTab(tabName) {
        groupDialog.value.lastActiveTab = tabName;
        if (tabName === 'Members') {
            membersTabRef.value?.getGroupDialogGroupMembers();
        } else if (tabName === 'Photos') {
            photosTabRef.value?.getGroupGalleries();
        } else if (tabName === 'JSON') {
            refreshGroupDialogTreeData();
        }
    }

    /**
     *
     */
    function loadLastActiveTab() {
        handleGroupDialogTab(groupDialog.value.lastActiveTab);
    }

    /**
     *
     * @param tabName
     */
    function groupDialogTabClick(tabName) {
        if (tabName === groupDialogTabCurrentName.value) {
            if (tabName === 'JSON') {
                refreshGroupDialogTreeData();
            }
            return;
        }
        handleGroupDialogTab(tabName);
        groupDialogTabCurrentName.value = tabName;
    }

    /**
     *
     * @param groupId
     * @param post
     */
    function showGroupPostEditDialog(groupId, post) {
        const D = groupPostEditDialog;
        D.sendNotification = true;
        D.groupRef = {};
        D.title = '';
        D.text = '';
        D.visibility = 'group';
        D.roleIds = [];
        D.postId = '';
        D.groupId = groupId;
        selectedGalleryFile.value = {
            selectedFileId: '',
            selectedImageUrl: ''
        };

        if (post) {
            D.title = post.title;
            D.text = post.text;
            D.visibility = post.visibility;
            D.roleIds = post.roleIds;
            D.postId = post.id;
            selectedGalleryFile.value = {
                selectedFileId: post.imageId,
                selectedImageUrl: post.imageUrl
            };
        }
        queryRequest.fetch('group.dialog', { groupId }).then((args) => {
            D.groupRef = args.ref;
        });
        D.visible = true;
    }

    /**
     *
     */
    /**
     *
     */
    function refreshGroupDialogTreeData() {
        const D = groupDialog.value;
        treeData.value = {
            group: formatJsonVars(D.ref),
            posts: D.posts,
            instances: D.instances,
            members: D.members,
            galleries: D.galleries
        };
    }

    /**
     *
     * @param obj
     */
    function updateGroupDialogData(obj) {
        groupDialog.value = {
            ...groupDialog.value,
            ...obj
        };
    }
</script>

<style scoped>
    .group-dialog {
        position: relative;
    }

    .group-dialog__summary {
        grid-area: sidebar;
        display: flex;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
        gap: 0.875rem;
        align-items: start;
        overflow: visible;
        border-left: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
        padding: 3.25rem 0 0 1rem;
        scrollbar-width: thin;
    }

    .group-dialog__workspace {
        display: grid;
        grid-template-areas: 'main splitter sidebar';
        grid-template-columns: minmax(0, 1fr) 0.625rem var(--group-sidebar-width, 18rem);
        min-height: 0;
        flex: 1;
        gap: 0;
    }

    .group-dialog__icon {
        position: absolute;
        bottom: -1.625rem;
        left: 1rem;
        z-index: 1;
        width: 4.75rem;
        aspect-ratio: 1;
        overflow: hidden;
        border-radius: var(--radius-lg);
        border: 3px solid var(--background);
        background: var(--muted);
        box-shadow:
            0 5px 16px color-mix(in srgb, black 32%, transparent),
            inset 0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent);
    }

    .group-dialog__body {
        display: flex;
        height: 100%;
        width: 100%;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .group-dialog__summary .group-header {
        width: 100%;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: thin;
    }

    .group-dialog__title-row {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem 0.5rem;
    }

    .group-dialog__title {
        min-width: 0;
        max-width: 100%;
        cursor: pointer;
        overflow: hidden;
        padding: 0;
        color: var(--foreground);
        font: inherit;
        font-size: 1.125rem;
        font-weight: 600;
        line-height: 1.3;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: transparent;
        border: 0;
        border-radius: var(--radius-sm);
    }

    .group-dialog__title:hover {
        color: var(--primary);
    }

    .group-dialog__title:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
    }

    .group-dialog__languages {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
    }

    .group-dialog__languages .flags {
        display: inline-block;
        margin: 0;
    }

    .group-dialog__owner-row {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.5rem;
    }

    .group-dialog__links {
        display: inline-flex;
        min-width: 0;
        align-items: center;
        gap: 0.25rem;
    }

    .group-dialog__link {
        display: inline-flex;
        width: 1.5rem;
        height: 1.5rem;
        flex: none;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: var(--radius-sm);
        padding: 0.25rem;
        background: transparent;
    }

    .group-dialog__link img {
        width: 1rem;
        height: 1rem;
        object-fit: contain;
    }

    .group-dialog__link:hover {
        background: var(--accent);
    }

    .group-dialog__link:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 1px;
    }

    .group-tags {
        gap: 0.375rem;
    }

    .group-dialog__tag {
        min-height: 1.375rem;
        margin-top: 0.25rem;
        border-color: transparent;
        padding-inline: 0.5rem;
        color: var(--muted-foreground);
        background: color-mix(in srgb, var(--muted) 62%, transparent);
        font-weight: 500;
    }

    .group-dialog__description {
        width: 100%;
        max-height: none;
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: 1.5;
    }

    .group-dialog__actions {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 2;
        display: flex;
        flex: none;
        align-items: center;
        gap: 0.125rem;
        padding: 0.1875rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--muted) 58%, transparent);
    }

    .group-dialog__actions :deep(button) {
        margin: 0;
        border-color: transparent;
        box-shadow: none;
    }

    .group-dialog__tabs :deep([role='tablist']) {
        padding-inline: 0.125rem;
        background: color-mix(in srgb, var(--background) 92%, transparent);
    }

    .group-dialog__main {
        grid-area: main;
        display: flex;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
        padding-right: 0.75rem;
    }

    .group-dialog__splitter {
        grid-area: splitter;
        position: relative;
        z-index: 3;
        display: flex;
        width: 0.625rem;
        cursor: col-resize;
        touch-action: none;
        align-items: center;
        justify-content: center;
        outline: none;
    }

    .group-dialog__splitter::before {
        position: absolute;
        inset-block: 0;
        left: 50%;
        width: 1px;
        content: '';
        background: color-mix(in srgb, var(--border) 74%, transparent);
        transform: translateX(-50%);
        transition: background-color 140ms ease-out;
    }

    .group-dialog__splitter-grip {
        position: relative;
        z-index: 1;
        width: 0.25rem;
        height: 2.25rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--muted-foreground) 42%, transparent);
        opacity: 0;
        transform: scaleY(0.75);
        transition:
            opacity 140ms ease-out,
            transform 140ms ease-out,
            background-color 140ms ease-out;
    }

    .group-dialog__splitter:hover::before,
    .group-dialog__splitter:focus-visible::before {
        background: var(--primary);
    }

    .group-dialog__splitter:hover .group-dialog__splitter-grip,
    .group-dialog__splitter:focus-visible .group-dialog__splitter-grip {
        background: var(--primary);
        opacity: 1;
        transform: scaleY(1);
    }

    .group-dialog__hero {
        position: relative;
        flex: none;
        margin-bottom: 1.75rem;
    }

    .group-dialog__banner,
    .group-dialog__banner-fallback {
        width: 100%;
        aspect-ratio: 6 / 1;
        border-radius: var(--radius-md);
    }

    .group-dialog__banner {
        display: block;
        cursor: pointer;
        object-fit: cover;
    }

    .group-dialog__banner-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--muted);
    }

    .group-dialog__tabs {
        min-width: 0;
        min-height: 0;
    }

    .group-dialog__tabs :deep([role='tab']) {
        height: 2.375rem;
        padding-inline: 0.75rem;
    }

    .group-dialog__tabs :deep([role='tabpanel']) {
        padding-top: 0.75rem;
    }

    @media (max-width: 60rem) {
        .group-dialog__workspace {
            grid-template-areas:
                'sidebar'
                'main';
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto minmax(0, 1fr);
        }

        .group-dialog__summary {
            max-height: min(13rem, 30vh);
            overflow-y: auto;
            border-left: 0;
            border-bottom: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
            padding: 3.25rem 0 0.75rem;
        }

        .group-dialog__main {
            padding-right: 0;
        }

        .group-dialog__splitter {
            display: none;
        }
    }

    @media (max-width: 44rem) {
        .group-dialog__summary {
            padding-top: 0;
        }

        .group-dialog__actions {
            position: static;
            align-self: flex-end;
        }

        .group-dialog__hero {
            margin-bottom: 1.5rem;
        }

        .group-dialog__icon {
            bottom: -1.375rem;
            left: 0.75rem;
            width: 4.25rem;
        }
    }

    @media (prefers-reduced-motion: no-preference) {
        .group-dialog__title {
            transition: color 140ms ease-out;
        }
    }

    :global(body.group-dialog-is-resizing) {
        cursor: col-resize;
        user-select: none;
    }
</style>
