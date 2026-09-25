<template>
    <template v-if="(isFriendOnline(userDialog.friend) || currentUser.id === userDialog.id) && userDialog.$location">
        <div class="flex flex-col gap-2.5 mb-2.5">
            <div class="user-info-card rounded-lg bg-(--profile-card) p-3">
                <div class="flex items-center justify-between mb-2 pb-1 border-b border-muted-foreground/20">
                    <span
                        class="text-[10px] font-bold uppercase tracking-wide"
                        :style="{ color: userDialog.theme.subtextColor }">
                        {{ t('dialog.user.info.current_instance') }}
                    </span>
                    <span v-if="isRealInstance(userDialog.$location.tag)">
                        <InstanceActionBar
                            class="mb-1"
                            :showButtons="true"
                            :buttonStyle="{ color: userDialog.theme.iconColor }"
                            :showInstanceInfo="false"
                            :location="userDialog.$location.tag"
                            :shortname="userDialog.$location.shortName"
                            :currentlocation="lastLocation.location"
                            :instance="userDialog.instance?.ref"
                            :friendcount="userDialog.instance?.friendCount"
                            :refresh-tooltip="t('dialog.user.info.refresh_instance_info')"
                            :on-refresh="() => refreshInstancePlayerCount(userDialog.$location.tag)" />
                    </span>
                </div>
                <div v-if="userDialog.$location.isOffline">
                    <span class="text-sm text-muted-foreground">{{ t('location.offline') }}</span>
                </div>
                <div v-if="userDialog.$location.isPrivate">
                    <span class="text-sm text-muted-foreground">{{ t('location.private') }}</span>
                </div>
                <div class="flex flex-col">
                    <div
                        v-if="isRealInstance(userDialog.$location.tag)"
                        class="flex items-start gap-1.5 justify-between">
                        <div class="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                            <span
                                class="text-md text-foreground cursor-pointer block truncate"
                                @click="showWorldDialog(userDialog.$location.tag)"
                                :title="userDialog.instance?.ref?.world?.name"
                                >{{ userDialog.instance?.ref?.world?.name }}</span
                            >
                            <div class="flex min-w-0 flex-wrap items-start gap-1.5">
                                <LocationWorld
                                    class="text-sm inline-flex min-w-0 w-fit max-w-full border-muted-foreground/30"
                                    :locationobject="userDialog.$location"
                                    :currentuserid="currentUser.id" />
                                <InstanceActionBar
                                    class="text-sm inline-flex max-w-full shrink-0 border-muted-foreground/30"
                                    :showButtons="false"
                                    :showInstanceInfo="true"
                                    :location="userDialog.$location.tag"
                                    :shortname="userDialog.$location.shortName"
                                    :currentlocation="lastLocation.location"
                                    :instance="userDialog.instance?.ref"
                                    :friendcount="userDialog.instance?.friendCount"
                                    :refresh-tooltip="t('dialog.user.info.refresh_instance_info')"
                                    :on-refresh="() => refreshInstancePlayerCount(userDialog.$location.tag)" />
                            </div>
                        </div>
                        <img
                            v-if="!userDialog.loading"
                            :src="userDialog.instance?.ref?.world?.thumbnailImageUrl"
                            class="h-15 w-20 cursor-pointer rounded-md object-cover"
                            @click="showFullscreenImageDialog(userDialog.instance?.ref?.world?.imageUrl)"
                            loading="lazy" />
                    </div>
                    <div class="user-instance-members">
                        <div
                            v-if="userDialog.$location.userId"
                            class="user-instance-member user-instance-member--owner box-border flex items-center rounded-md p-1.5 text-[13px] cursor-pointer"
                            @click="showUserDialog(userDialog.$location.userId)">
                            <template v-if="userDialog.$location.user">
                                <div
                                    class="relative inline-block flex-none size-9 mr-2.5"
                                    :class="userStatusClass(userDialog.$location.user)">
                                    <Avatar class="size-9">
                                        <AvatarImage
                                            :src="userImage(userDialog.$location.user, true)"
                                            class="object-cover" />
                                        <AvatarFallback>
                                            <User class="size-4 text-muted-foreground" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <IconFrame :icon-frame="userDialog.$location.user.iconFrame" />
                                </div>
                                <div class="flex-1 overflow-hidden">
                                    <span
                                        class="block truncate font-medium leading-[18px]"
                                        :style="{ color: userDialog.$location.user.$userColour }"
                                        v-text="userDialog.$location.user.displayName"></span>
                                    <span class="block truncate text-xs">{{
                                        t('dialog.user.info.instance_creator')
                                    }}</span>
                                </div>
                            </template>
                            <span v-else v-text="userDialog.$location.userId"></span>
                        </div>
                        <div
                            v-for="user in userDialog.users || []"
                            :key="user.id"
                            class="user-instance-member box-border flex items-center rounded-md p-1.5 text-[13px] cursor-pointer"
                            @click="showUserDialog(user.id)">
                            <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(user)">
                                <Avatar class="size-9">
                                    <AvatarImage :src="userImage(user, true)" class="object-cover" />
                                    <AvatarFallback>
                                        <User class="size-4 text-muted-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <IconFrame :icon-frame="user.iconFrame" />
                            </div>
                            <div class="flex-1 overflow-hidden">
                                <span
                                    class="block truncate font-medium leading-[18px]"
                                    :style="{ color: user.$userColour }"
                                    v-text="user.displayName"></span>
                                <span v-if="user.location === 'traveling'" class="block truncate text-xs">
                                    <Spinner class="inline-block mr-1" />
                                    <Timer :epoch="user.$travelingToTime" />
                                </span>
                                <span v-else class="block truncate text-xs">
                                    <Timer :epoch="user.$location_at" />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </template>

    <div class="@container">
        <div class="grid gap-2.5 grid-cols-1 @[560px]:grid-cols-[minmax(0,1fr)_230px]" style="align-items: start">
            <div class="flex flex-col gap-2.5">
                <div class="user-info-card rounded-lg bg-(--profile-card) p-3">
                    <div class="flex items-center justify-between mb-2 pb-2 border-b border-muted-foreground/20">
                        <span
                            class="text-[10px] font-bold uppercase tracking-wide"
                            :style="{ color: userDialog.theme.subtextColor }">
                            {{ t('dialog.user.info.bio') }}
                        </span>
                        <div class="flex items-center gap-1">
                            <Button
                                v-if="translationApi && dialogBio"
                                class="h-5 w-5"
                                size="icon-sm"
                                variant="ghost"
                                @click="translateBio">
                                <Spinner v-if="translateLoading" class="size-3" />
                                <Languages v-else class="h-3 w-3" :style="{ color: userDialog.theme.iconColor }" />
                            </Button>
                            <Button
                                v-if="userDialog.id"
                                class="h-5 w-5"
                                size="icon-sm"
                                variant="ghost"
                                :aria-label="t('dialog.user.info.bio_archive')"
                                @click="showBioArchive">
                                <Archive class="h-3 w-3" :style="{ color: userDialog.theme.iconColor }" />
                            </Button>
                            <Button
                                v-if="currentUser.id !== userDialog.id"
                                class="h-5 w-5"
                                size="icon-sm"
                                :variant="bioDiffEnabled ? 'secondary' : 'ghost'"
                                :aria-label="t('dialog.user.info.bio_diff_toggle')"
                                @click="toggleBioDiff">
                                <History class="h-3 w-3" :style="{ color: userDialog.theme.iconColor }" />
                            </Button>
                            <Button
                                v-if="userDialog.id === currentUser.id"
                                class="h-5 w-5"
                                size="icon-sm"
                                variant="ghost"
                                @click="emit('showBioDialog')">
                                <Pencil class="h-3 w-3" :style="{ color: userDialog.theme.iconColor }" />
                            </Button>
                        </div>
                    </div>
                    <pre
                        v-if="bioDiffEnabled && bioDiffHtml"
                        class="text-xs leading-5.5 font-[inherit]"
                        style="white-space: pre-wrap; max-height: 210px; overflow-y: auto"
                        v-html="bioDiffHtml"></pre>
                    <pre
                        v-else
                        class="text-xs font-[inherit]"
                        style="white-space: pre-wrap; max-height: 210px; overflow-y: auto"
                        >{{ bioCache.translated || dialogBio || '—' }}</pre
                    >
                    <div v-if="dialogBioLinks.length" class="flex flex-wrap items-center gap-1.5 mt-2">
                        <TooltipWrapper v-for="(link, index) in dialogBioLinks" :key="index">
                            <template #content>
                                <span v-text="link"></span>
                            </template>
                            <img
                                :src="getFaviconUrl(link)"
                                style="width: 16px; height: 16px; vertical-align: middle; cursor: pointer"
                                @click.stop="openExternalLink(link)"
                                loading="lazy" />
                        </TooltipWrapper>
                    </div>
                </div>

                <div
                    v-if="!hideUserNotes"
                    class="user-info-card rounded-lg bg-(--profile-card) p-3 cursor-pointer"
                    @click="isEditNoteAndMemoDialogVisible = true">
                    <div class="flex items-center justify-between mb-2 pb-2 border-b border-muted-foreground/20">
                        <span
                            class="text-[10px] font-bold uppercase tracking-wide"
                            :style="{ color: userDialog.theme.subtextColor }">
                            {{ t('dialog.user.info.note') }}
                        </span>
                        <Button class="h-5 w-5" size="icon-sm" variant="ghost">
                            <Pencil class="h-3 w-3" :style="{ color: userDialog.theme.iconColor }" />
                        </Button>
                    </div>
                    <pre
                        v-if="userDialog.note"
                        class="text-xs font-[inherit]"
                        style="white-space: pre-wrap; max-height: 210px; overflow-y: auto"
                        >{{ userDialog.note }}</pre
                    >
                    <pre class="text-xs font-[inherit] text-muted-foreground" v-else>—</pre>
                </div>

                <div
                    v-if="!hideUserMemos"
                    class="user-info-card rounded-lg bg-(--profile-card) p-3 cursor-pointer"
                    @click="isEditNoteAndMemoDialogVisible = true">
                    <div class="flex items-center justify-between mb-2 pb-2 border-b border-muted-foreground/20">
                        <span
                            class="text-[10px] font-bold uppercase tracking-wide"
                            :style="{ color: userDialog.theme.subtextColor }">
                            {{ t('dialog.user.info.memo') }}
                        </span>
                        <Button class="h-5 w-5" size="icon-sm" variant="ghost">
                            <Pencil class="h-3 w-3" :style="{ color: userDialog.theme.iconColor }" />
                        </Button>
                    </div>
                    <pre
                        v-if="userDialog.memo"
                        class="text-xs font-[inherit]"
                        style="white-space: pre-wrap; max-height: 210px; overflow-y: auto"
                        >{{ userDialog.memo }}</pre
                    >
                    <pre class="text-xs font-[inherit] text-muted-foreground" v-else>—</pre>
                </div>
            </div>

            <div class="flex flex-col gap-2.5">
                <div class="user-info-card rounded-lg bg-(--profile-card) p-3">
                    <div class="flex items-center justify-between mb-2 pb-2 border-b border-muted-foreground/20">
                        <span
                            class="text-[10px] font-bold uppercase tracking-wide"
                            :style="{ color: userDialog.theme.subtextColor }">
                            {{ t('dialog.user.info.vrcx_info') }}
                            <span
                                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                <TooltipWrapper side="top" :content="t('dialog.user.info.vrcx_info_tooltip')">
                                    <Info class="h-3 w-3 shrink-0" :style="{ color: userDialog.theme.iconColor }" />
                                </TooltipWrapper>
                            </span>
                        </span>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <TooltipWrapper
                            side="top"
                            :content="formatDateFilter(userOnlineForTimestamp(userDialog), 'long')"
                            :disabled="!userOnlineForTimestamp(userDialog)">
                            <template #content>
                                <span>{{ formatDateFilter(userOnlineForTimestamp(userDialog), 'long') }}</span>
                            </template>
                            <div class="flex justify-between items-start gap-2 text-xs">
                                <span class="text-muted-foreground shrink-0">
                                    {{
                                        userDialog.ref.state === 'online' && userDialog.ref.$online_for
                                            ? t('dialog.user.info.online_for')
                                            : t('dialog.user.info.offline_for')
                                    }}
                                </span>
                                <span class="text-right text-muted-foreground">{{
                                    timeAgo(userOnlineForTimestamp(userDialog))
                                }}</span>
                            </div>
                        </TooltipWrapper>

                        <template v-if="currentUser.id !== userDialog.id">
                            <TooltipWrapper
                                side="top"
                                :disabled="!userDialog.lastSeen"
                                :content="formatDateFilter(userDialog.lastSeen, 'long')">
                                <div class="flex justify-between items-start gap-2 text-xs">
                                    <span class="text-muted-foreground shrink-0">{{
                                        t('dialog.user.info.last_seen')
                                    }}</span>
                                    <span class="text-right text-muted-foreground">{{
                                        timeAgo(userDialog.lastSeen)
                                    }}</span>
                                </div>
                            </TooltipWrapper>
                            <TooltipWrapper side="top" :disabled="(userDialog.dateFriendedInfo || []).length === 0">
                                <template #content>
                                    <template v-if="(userDialog.dateFriendedInfo || []).length === 1">
                                        {{ formatDateFilter(userDialog.dateFriended, 'long') }}
                                    </template>
                                    <template v-else>
                                        <template v-for="ref in userDialog.dateFriendedInfo || []" :key="ref.type">
                                            <span>{{ ref.type }}: {{ formatDateFilter(ref.created_at, 'long') }}</span
                                            ><br />
                                        </template>
                                    </template>
                                </template>
                                <div class="flex justify-between items-start gap-2 text-xs">
                                    <span class="text-muted-foreground shrink-0">
                                        {{
                                            userDialog.unFriended
                                                ? t('dialog.user.info.unfriended')
                                                : t('dialog.user.info.friended')
                                        }}
                                    </span>
                                    <span class="text-right text-muted-foreground">{{
                                        timeAgo(userDialog.dateFriended)
                                    }}</span>
                                </div>
                            </TooltipWrapper>
                            <TooltipWrapper
                                side="top"
                                :content="timeToText(userDialog.timeSpent, true)"
                                :disabled="!userDialog.timeSpent">
                                <div class="flex justify-between items-start gap-2 text-xs">
                                    <span class="text-muted-foreground shrink-0">{{
                                        t('dialog.user.info.time_together')
                                    }}</span>
                                    <span class="text-right text-muted-foreground">{{
                                        timeAgo(Date.now() - userDialog.timeSpent)
                                    }}</span>
                                </div>
                            </TooltipWrapper>
                            <TooltipWrapper side="top" :content="t('dialog.user.info.open_previous_instance')">
                                <div
                                    class="flex justify-between items-start gap-2 text-xs cursor-pointer hover:text-foreground"
                                    @click="showPreviousInstancesListDialog(userDialog.ref)">
                                    <span class="text-muted-foreground shrink-0">{{
                                        t('dialog.user.info.join_count')
                                    }}</span>
                                    <span class="text-right text-muted-foreground">{{
                                        userDialog.joinCount || '—'
                                    }}</span>
                                </div>
                            </TooltipWrapper>
                        </template>
                        <template v-else>
                            <TooltipWrapper side="top" :content="t('dialog.user.info.open_previous_instance')">
                                <div
                                    class="flex justify-between items-start gap-2 text-xs cursor-pointer hover:text-foreground"
                                    @click="showPreviousInstancesListDialog(userDialog.ref)">
                                    <span class="text-muted-foreground shrink-0">{{
                                        t('dialog.user.info.play_time')
                                    }}</span>
                                    <span class="text-right text-muted-foreground">{{
                                        timeAgo(Date.now() - userDialog.timeSpent)
                                    }}</span>
                                </div>
                            </TooltipWrapper>
                        </template>
                    </div>
                </div>

                <div class="user-info-card rounded-lg bg-(--profile-card) p-3">
                    <div
                        class="text-[10px] font-bold uppercase tracking-wide mb-2 pb-2 border-b border-muted-foreground/20"
                        :style="{ color: userDialog.theme.subtextColor }">
                        {{ t('dialog.user.info.header') }}
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <TooltipWrapper side="top">
                            <template #content>
                                <span
                                    >{{ t('dialog.user.info.last_login') }}
                                    {{ formatDateFilter(userDialog.ref.last_login, 'long') }}</span
                                >
                                <br />
                                <span
                                    >{{ t('dialog.user.info.last_activity') }}
                                    {{ formatDateFilter(userDialog.ref.last_activity, 'long') }}</span
                                >
                            </template>
                            <div class="flex justify-between items-start gap-2 text-xs">
                                <span class="text-muted-foreground shrink-0">{{
                                    t('dialog.user.info.last_activity')
                                }}</span>
                                <span class="text-right text-muted-foreground">
                                    {{ timeAgo(userDialog.ref.last_activity) }}
                                </span>
                            </div>
                        </TooltipWrapper>

                        <TooltipWrapper
                            side="top"
                            :content="formatDateFilter(userDialog.ref.date_joined, 'date')"
                            :disabled="!userDialog.ref.date_joined">
                            <div class="flex justify-between items-start gap-2 text-xs">
                                <span class="text-muted-foreground shrink-0">{{
                                    t('dialog.user.info.date_joined')
                                }}</span>
                                <span
                                    class="text-right text-muted-foreground"
                                    v-text="timeAgo(userDialog.ref.date_joined)"></span>
                            </div>
                        </TooltipWrapper>

                        <template v-if="currentUser.id === userDialog.id">
                            <TooltipWrapper side="top">
                                <template #content>
                                    <span>{{ t('view.profile.profile.refresh') }}</span>
                                </template>
                                <div
                                    class="flex justify-between items-start gap-2 text-xs cursor-pointer hover:text-foreground"
                                    @click="getVRChatCredits()">
                                    <span class="text-muted-foreground shrink-0">{{
                                        t('view.profile.profile.vrchat_credits')
                                    }}</span>
                                    <span class="text-right text-muted-foreground">{{
                                        vrchatCredit ?? t('view.profile.profile.refresh')
                                    }}</span>
                                </div>
                            </TooltipWrapper>
                        </template>

                        <div v-if="currentUser.id !== userDialog.id" class="flex justify-between items-center text-xs">
                            <span class="text-muted-foreground">{{ t('dialog.user.info.avatar_cloning') }}</span>
                            <span class="text-muted-foreground">{{
                                userDialog.ref.allowAvatarCopying
                                    ? t('dialog.user.info.avatar_cloning_allow')
                                    : t('dialog.user.info.avatar_cloning_deny')
                            }}</span>
                        </div>
                        <template v-else>
                            <div
                                class="flex justify-between items-center text-xs cursor-pointer hover:text-foreground"
                                @click="toggleAvatarCopying">
                                <span class="text-muted-foreground">{{ t('dialog.user.info.avatar_cloning') }}</span>
                                <span class="text-muted-foreground">{{
                                    currentUser.allowAvatarCopying
                                        ? t('dialog.user.info.avatar_cloning_allow')
                                        : t('dialog.user.info.avatar_cloning_deny')
                                }}</span>
                            </div>
                            <div
                                class="flex justify-between items-center text-xs cursor-pointer hover:text-foreground"
                                @click="toggleAllowBooping">
                                <span class="text-muted-foreground">{{ t('dialog.user.info.booping') }}</span>
                                <span class="text-muted-foreground">{{
                                    currentUser.isBoopingEnabled
                                        ? t('dialog.user.info.avatar_cloning_allow')
                                        : t('dialog.user.info.avatar_cloning_deny')
                                }}</span>
                            </div>
                            <div
                                class="flex justify-between items-center text-xs cursor-pointer hover:text-foreground"
                                @click="toggleSharedConnectionsOptOut">
                                <span class="text-muted-foreground">{{
                                    t('dialog.user.info.show_mutual_friends')
                                }}</span>
                                <span class="text-muted-foreground">{{
                                    currentUser.hasSharedConnectionsOptOut
                                        ? t('dialog.user.info.avatar_cloning_deny')
                                        : t('dialog.user.info.avatar_cloning_allow')
                                }}</span>
                            </div>
                            <div
                                class="flex justify-between items-center text-xs cursor-pointer hover:text-foreground"
                                @click="toggleDiscordFriendsOptOut">
                                <span class="text-muted-foreground">{{
                                    t('dialog.user.info.show_discord_connections')
                                }}</span>
                                <span class="text-muted-foreground">{{
                                    currentUser.hasDiscordFriendsOptOut
                                        ? t('dialog.user.info.avatar_cloning_deny')
                                        : t('dialog.user.info.avatar_cloning_allow')
                                }}</span>
                            </div>
                        </template>
                    </div>
                </div>

                <div class="user-info-card rounded-lg bg-(--profile-card) p-3">
                    <div
                        class="text-[10px] font-bold uppercase tracking-wide mb-2 pb-2 border-b border-muted-foreground/20"
                        :style="{ color: userDialog.theme.subtextColor }">
                        {{ t('dialog.user.info.id') }}
                    </div>
                    <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="min-w-0 truncate text-muted-foreground" :title="userDialog.id">{{
                            userDialog.id
                        }}</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button
                                    class="h-6 w-6 flex-none"
                                    size="icon-sm"
                                    variant="ghost"
                                    :aria-label="t('dialog.user.info.id_tooltip')">
                                    <Copy class="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem @click="copyUserId(userDialog.id)">
                                    {{ t('dialog.user.info.copy_id') }}
                                </DropdownMenuItem>
                                <DropdownMenuItem @click="copyUserURL(userDialog.id)">
                                    {{ t('dialog.user.info.copy_url') }}
                                </DropdownMenuItem>
                                <DropdownMenuItem @click="copyUserDisplayName(userDialog.ref.displayName)">
                                    {{ t('dialog.user.info.copy_display_name') }}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div
                    v-if="userDialog.ref.id === currentUser.id && currentUser.homeLocation"
                    class="user-info-card rounded-lg bg-(--profile-card) p-3">
                    <div
                        class="text-[10px] font-bold uppercase tracking-wide mb-2 pb-2 border-b border-muted-foreground/20"
                        :style="{ color: userDialog.theme.subtextColor }">
                        {{ t('dialog.user.info.home_location') }}
                    </div>
                    <div
                        class="flex items-center justify-between gap-2 text-xs cursor-pointer"
                        @click="showWorldDialog(currentUser.homeLocation)">
                        <span class="truncate" v-text="userDialog.$homeLocationName"></span>
                        <Button
                            class="rounded-full h-5 w-5 flex-none"
                            size="icon-sm"
                            variant="ghost"
                            @click.stop="resetHome()">
                            <Trash2 class="h-3 w-3" :style="{ color: userDialog.theme.iconColor }" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <EditNoteAndMemoDialog v-model:visible="isEditNoteAndMemoDialogVisible" />
    <Dialog v-model:open="bioArchiveVisible">
        <DialogContent class="x-dialog sm:max-w-2xl">
            <DialogHeader>
                <div class="flex items-center justify-between gap-3 pr-8">
                    <DialogTitle>{{ t('dialog.user.info.bio_archive') }}</DialogTitle>
                    <label class="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{{ t('dialog.user.info.bio_diff_toggle') }}</span>
                        <Switch v-model="bioArchiveDiffEnabled" />
                    </label>
                </div>
            </DialogHeader>
            <div
                class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{{
                        t('dialog.user.info.bio_archive_selected', { count: bioArchiveSelectedIds.length })
                    }}</span>
                    <Button variant="ghost" size="sm" class="h-7 px-2" @click="toggleBioArchiveSelectAll">
                        {{
                            bioArchiveSelectedIds.length === bioArchiveRecords.length && bioArchiveRecords.length > 0
                                ? t('dialog.user.info.bio_archive_clear_selection')
                                : t('dialog.user.info.bio_archive_select_all')
                        }}
                    </Button>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="bioArchiveSelectedIds.length !== 2"
                        @click="bioArchiveComparisonVisible = true">
                        {{ t('dialog.user.info.bio_archive_compare') }}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        :disabled="bioArchiveSelectedIds.length === 0"
                        @click="confirmBioArchiveDelete(bioArchiveSelectedIds)">
                        <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                        {{ t('dialog.user.info.bio_archive_delete_selected', { count: bioArchiveSelectedIds.length }) }}
                    </Button>
                </div>
            </div>
            <div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                <div v-if="bioArchiveLoading" class="text-sm text-muted-foreground">...</div>
                <div v-else-if="bioArchiveRecords.length === 0" class="text-sm text-muted-foreground">-</div>
                <div
                    v-for="(record, index) in bioArchiveRecords"
                    :key="record.id"
                    class="rounded-md border border-border/60 bg-card p-3 shadow-sm">
                    <div class="mb-2 flex items-center justify-between gap-2">
                        <label class="flex min-w-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <input
                                v-model="bioArchiveSelectedIds"
                                type="checkbox"
                                :value="record.id"
                                class="h-4 w-4 shrink-0 accent-primary"
                                @change="bioArchiveComparisonVisible = false" />
                            <span class="truncate">{{ formatDateFilter(record.createdAt, 'long') }}</span>
                        </label>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            :aria-label="t('dialog.user.info.bio_archive_delete_record')"
                            :title="t('dialog.user.info.bio_archive_delete_record')"
                            @click="confirmBioArchiveDelete([record.id])">
                            <Trash2 class="h-3.5 w-3.5 text-destructive" />
                        </Button>
                    </div>
                    <pre
                        v-if="bioArchiveDiffEnabled"
                        class="text-xs leading-5.5 font-[inherit]"
                        style="white-space: pre-wrap; margin: 0"
                        v-html="bioArchiveDiff(record, index)"></pre>
                    <pre v-else class="text-xs leading-5.5 font-[inherit]" style="white-space: pre-wrap; margin: 0">{{
                        record.bio || '-'
                    }}</pre>
                </div>
            </div>
        </DialogContent>
    </Dialog>
    <Dialog v-model:open="bioArchiveComparisonVisible">
        <DialogContent class="x-dialog sm:max-w-5xl">
            <DialogHeader>
                <div class="flex items-center justify-between gap-3 pr-8">
                    <DialogTitle>{{ t('dialog.user.info.bio_archive_compare') }}</DialogTitle>
                    <Button variant="outline" size="sm" @click="bioArchiveComparisonVisible = false">
                        {{ t('dialog.user.info.bio_archive_close_compare') }}
                    </Button>
                </div>
            </DialogHeader>
            <div v-if="selectedBioArchiveRecords.length === 2" class="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2">
                <section class="min-h-0 overflow-hidden rounded-md border border-border/60 bg-card">
                    <header
                        class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                        <span class="text-xs font-semibold text-muted-foreground">
                            {{ t('dialog.user.info.bio_archive_older') }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                            {{ formatDateFilter(selectedBioArchiveRecords[0].createdAt, 'long') }}
                        </span>
                    </header>
                    <pre
                        class="max-h-[65vh] overflow-auto p-3 text-sm leading-6 font-[inherit]"
                        style="white-space: pre-wrap; margin: 0"
                        v-if="bioArchiveDiffEnabled"
                        v-html="bioArchiveOlderComparisonHtml"></pre>
                    <pre
                        v-else
                        class="max-h-[65vh] overflow-auto p-3 text-sm leading-6 font-[inherit]"
                        style="white-space: pre-wrap; margin: 0"
                        >{{ selectedBioArchiveRecords[0].bio || '-' }}</pre
                    >
                </section>
                <section class="min-h-0 overflow-hidden rounded-md border border-border/60 bg-card">
                    <header
                        class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                        <span class="text-xs font-semibold text-muted-foreground">
                            {{ t('dialog.user.info.bio_archive_newer') }}
                        </span>
                        <span class="text-xs text-muted-foreground">
                            {{ formatDateFilter(selectedBioArchiveRecords[1].createdAt, 'long') }}
                        </span>
                    </header>
                    <pre
                        class="max-h-[65vh] overflow-auto p-3 text-sm leading-6 font-[inherit]"
                        style="white-space: pre-wrap; margin: 0"
                        v-if="bioArchiveDiffEnabled"
                        v-html="bioArchiveNewerComparisonHtml"></pre>
                    <pre
                        v-else
                        class="max-h-[65vh] overflow-auto p-3 text-sm leading-6 font-[inherit]"
                        style="white-space: pre-wrap; margin: 0"
                        >{{ selectedBioArchiveRecords[1].bio || '-' }}</pre
                    >
                </section>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Archive, Copy, History, Info, Languages, Pencil, Trash2, User } from 'lucide-vue-next';
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Switch } from '@/components/ui/switch';
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuTrigger
    } from '@/components/ui/dropdown-menu';
    import IconFrame from '@/components/IconFrame.vue';
    import { computed, ref, watch } from 'vue';
    import { Button } from '@/components/ui/button';
    import { Spinner } from '@/components/ui/spinner';
    import { storeToRefs } from 'pinia';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';

    import {
        copyToClipboard,
        formatDateFilter,
        getFaviconUrl,
        isFriendOnline,
        isRealInstance,
        openExternalLink,
        timeToText,
        userOnlineForTimestamp,
        timeAgo
    } from '../../../shared/utils';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { refreshInstancePlayerCount } from '../../../coordinators/instanceCoordinator';
    import {
        useAdvancedSettingsStore,
        useAppearanceSettingsStore,
        useInstanceStore,
        useLocationStore,
        useModalStore,
        useUserStore,
        useGalleryStore
    } from '../../../stores';
    import { showWorldDialog } from '../../../coordinators/worldCoordinator';
    import { queryRequest, userRequest } from '../../../api';
    import { database } from '../../../services/database';
    import { formatBioArchiveDiff, formatLatestBioDiff } from '../../../shared/utils/bioArchiveDiff';
    import { formatDifference } from '../../../views/Feed/columns.jsx';

    import InstanceActionBar from '../../InstanceActionBar.vue';
    import { showUserDialog } from '../../../coordinators/userCoordinator';

    import EditNoteAndMemoDialog from './EditNoteAndMemoDialog.vue';

    const { t } = useI18n();

    const modalStore = useModalStore();
    const instanceStore = useInstanceStore();

    const { hideUserNotes, hideUserMemos } = storeToRefs(useAppearanceSettingsStore());
    const { bioLanguage, translationApi, translationApiType } = storeToRefs(useAdvancedSettingsStore());
    const { translateText } = useAdvancedSettingsStore();
    const { userDialog, currentUser } = storeToRefs(useUserStore());
    const { toggleSharedConnectionsOptOut, toggleDiscordFriendsOptOut } = useUserStore();
    const { fullscreenImageDialog } = storeToRefs(useGalleryStore());

    const { lastLocation } = storeToRefs(useLocationStore());
    const { userImage, userStatusClass } = useUserDisplay();

    const bioCache = ref({
        userId: null,
        translated: null
    });
    const dialogBio = computed(() => userDialog.value.publicProfileRef?.bio ?? userDialog.value.ref?.bio ?? '');
    const dialogBioLinks = computed(
        () => userDialog.value.publicProfileRef?.bioLinks ?? userDialog.value.ref?.bioLinks ?? []
    );

    const isEditNoteAndMemoDialogVisible = ref(false);
    const vrchatCredit = ref(null);
    const translateLoading = ref(false);
    const bioDiffEnabled = ref(true);
    const bioDiffHtml = ref('');
    const bioArchiveVisible = ref(false);
    const bioArchiveLoading = ref(false);
    const bioArchiveDiffEnabled = ref(true);
    const bioArchiveRecords = ref([]);
    const bioArchiveSelectedIds = ref([]);
    const bioArchiveComparisonVisible = ref(false);
    const selectedBioArchiveRecords = computed(() =>
        bioArchiveRecords.value
            .filter((record) => bioArchiveSelectedIds.value.includes(record.id))
            .sort((first, second) => Number(first.id) - Number(second.id))
    );
    const bioArchiveComparisonDiffHtml = computed(() => {
        const [olderRecord, newerRecord] = selectedBioArchiveRecords.value;
        if (!olderRecord || !newerRecord) {
            return '';
        }
        return formatBioArchiveDiff(olderRecord.bio || '', newerRecord.bio || '', formatDifference);
    });
    const bioArchiveOlderComparisonHtml = computed(() =>
        bioArchiveComparisonDiffHtml.value.replace(/<span class="x-text-added">[\s\S]*?<\/span>/g, '')
    );
    const bioArchiveNewerComparisonHtml = computed(() =>
        bioArchiveComparisonDiffHtml.value.replace(/<span class="x-text-removed">[\s\S]*?<\/span>/g, '')
    );
    let bioDiffRequestId = 0;

    async function loadBioDiff() {
        const requestId = ++bioDiffRequestId;
        const dialogUserId = userDialog.value.id;
        if (!dialogUserId) {
            bioDiffHtml.value = '';
            return;
        }
        let records;
        try {
            records = await database.getRecentBioChangesForUser(dialogUserId, 50);
        } catch {
            if (requestId === bioDiffRequestId) {
                bioDiffHtml.value = '';
            }
            return;
        }
        if (requestId !== bioDiffRequestId || dialogUserId !== userDialog.value.id) {
            return;
        }
        if (!records || records.length === 0) {
            bioDiffHtml.value = '';
            return;
        }
        bioDiffHtml.value = formatLatestBioDiff(records[0], dialogBio.value, formatDifference);
    }

    function toggleBioDiff() {
        bioDiffEnabled.value = !bioDiffEnabled.value;
        if (bioDiffEnabled.value) {
            loadBioDiff();
        }
    }

    async function showBioArchive() {
        bioArchiveVisible.value = true;
        bioArchiveSelectedIds.value = [];
        bioArchiveComparisonVisible.value = false;
        await reloadBioArchiveRecords();
    }

    async function reloadBioArchiveRecords() {
        bioArchiveLoading.value = true;
        try {
            bioArchiveRecords.value = (await database.getRecentBioChangesForUser(userDialog.value.id, 100)) || [];
        } catch {
            bioArchiveRecords.value = [];
        } finally {
            bioArchiveLoading.value = false;
        }
    }

    function toggleBioArchiveSelectAll() {
        if (bioArchiveSelectedIds.value.length === bioArchiveRecords.value.length) {
            bioArchiveSelectedIds.value = [];
        } else {
            bioArchiveSelectedIds.value = bioArchiveRecords.value.map((record) => record.id);
        }
        bioArchiveComparisonVisible.value = false;
    }

    async function confirmBioArchiveDelete(ids) {
        const recordIds = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
        if (recordIds.length === 0) {
            return;
        }
        const isBatch = recordIds.length > 1;
        const { ok } = await modalStore.confirm({
            title: t('dialog.user.info.bio_archive_delete_title'),
            description: t(
                isBatch
                    ? 'dialog.user.info.bio_archive_delete_selected_confirm'
                    : 'dialog.user.info.bio_archive_delete_record_confirm',
                { count: recordIds.length }
            ),
            confirmText: t('common.actions.delete'),
            cancelText: t('common.actions.cancel'),
            destructive: true
        });
        if (!ok) {
            return;
        }
        try {
            if (recordIds.length === 1) {
                await database.deleteBioArchiveRecord(userDialog.value.id, recordIds[0]);
            } else {
                await database.deleteBioArchiveRecords(userDialog.value.id, recordIds);
            }
            bioArchiveSelectedIds.value = [];
            bioArchiveComparisonVisible.value = false;
            await reloadBioArchiveRecords();
            await loadBioDiff();
            toast.success(t('dialog.user.info.bio_archive_deleted', { count: recordIds.length }));
        } catch {
            toast.error(t('dialog.user.info.bio_archive_delete_failed'));
        }
    }

    function bioArchiveDiff(record, index) {
        const previousArchiveRecord = bioArchiveRecords.value[index + 1];
        const previousBio = previousArchiveRecord?.bio ?? record.previousBio ?? '';
        return formatBioArchiveDiff(previousBio, record.bio || '', formatDifference);
    }

    watch(
        () => ({
            visible: userDialog.value.visible,
            id: userDialog.value.id,
            loading: userDialog.value.loading,
            bio: dialogBio.value,
            bioSnapshotVersion: userDialog.value.bioSnapshotVersion
        }),
        ({ visible, id }) => {
            if (!visible || !id) {
                bioDiffHtml.value = '';
                return;
            }
            if (id !== bioCache.value.userId) {
                bioCache.value = {
                    userId: null,
                    translated: null
                };
                bioDiffHtml.value = '';
            }
            if (bioDiffEnabled.value) {
                loadBioDiff();
            }
        },
        { immediate: true }
    );

    function onTabActivated() {
        if (currentUser.value.id === userDialog.value.id && vrchatCredit.value === null) {
            getVRChatCredits();
        }
    }

    function showEditNoteAndMemoDialog() {
        isEditNoteAndMemoDialogVisible.value = true;
    }

    async function translateBio() {
        if (translateLoading.value) {
            return;
        }
        const bio = dialogBio.value;
        if (!bio) {
            return;
        }

        const targetLang = bioLanguage.value;

        if (bioCache.value.userId !== userDialog.value.id) {
            bioCache.value.userId = userDialog.value.id;
            bioCache.value.translated = null;
        }

        if (bioCache.value.translated) {
            bioCache.value.translated = null;
            return;
        }

        translateLoading.value = true;
        try {
            const providerLabel = translationApiType.value === 'openai' ? 'OpenAI' : 'Google';
            const translated = await translateText(`${bio}\n\nTranslated by ${providerLabel}`, targetLang);
            if (!translated) {
                throw new Error('No translation returned');
            }

            bioCache.value.translated = translated;
        } catch (err) {
            console.error('Translation failed:', err);
        } finally {
            translateLoading.value = false;
        }
    }

    /**
     * @param userRef
     */
    function showPreviousInstancesListDialog(userRef) {
        instanceStore.showPreviousInstancesListDialog('user', userRef);
    }

    function toggleAvatarCopying() {
        userRequest.saveCurrentUser({
            allowAvatarCopying: !currentUser.value.allowAvatarCopying
        });
    }

    function toggleAllowBooping() {
        userRequest.saveCurrentUser({
            isBoopingEnabled: !currentUser.value.isBoopingEnabled
        });
    }

    function copyUserId(userId) {
        copyToClipboard(userId, t('message.user.id_copied'));
    }

    function copyUserURL(userId) {
        copyToClipboard(`https://vrchat.com/home/user/${userId}`, t('message.user.url_copied'));
    }

    function copyUserDisplayName(displayName) {
        copyToClipboard(displayName, t('message.user.display_name_copied'));
    }

    function resetHome() {
        modalStore
            .confirm({
                description: t('confirm.command_question', {
                    command: t('dialog.user.actions.reset_home')
                }),
                title: t('confirm.title')
            })
            .then(({ ok }) => {
                if (!ok) return;
                userRequest
                    .saveCurrentUser({
                        homeLocation: ''
                    })
                    .then((args) => {
                        toast.success(t('message.user.home_reset'));
                        return args;
                    });
            })
            .catch(() => {});
    }

    function getVRChatCredits() {
        queryRequest.fetch('vrchatCredits').then((args) => (vrchatCredit.value = args.json?.balance));
    }

    /**
     * @param imageUrl
     * @param fileName
     */
    function showFullscreenImageDialog(imageUrl, fileName) {
        if (!imageUrl) {
            return;
        }
        const D = fullscreenImageDialog.value;
        D.imageUrl = imageUrl;
        D.fileName = fileName;
        D.visible = true;
    }

    const emit = defineEmits(['showBioDialog']);

    defineExpose({
        onTabActivated,
        showEditNoteAndMemoDialog,
        showFullscreenImageDialog
    });
</script>

<style scoped>
    .user-info-card {
        min-width: 0;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        border-radius: var(--radius-xl);
        padding: 1rem;
        background: var(--surface-panel);
        box-shadow: 0 2px 8px rgb(0 0 0 / 5%);
    }

    .user-info-card:focus-within {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
    }

    .user-instance-members {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(8.5rem, 100%), 9rem));
        justify-content: start;
        gap: 0.375rem;
        max-height: 12rem;
        overflow-y: auto;
        margin-top: 0.5rem;
        scrollbar-gutter: stable;
    }

    .user-instance-member {
        min-width: 0;
        border-radius: var(--radius-lg);
    }

    .user-instance-member--owner {
        border: 1px solid color-mix(in srgb, var(--primary) 50%, var(--border));
        background: color-mix(in srgb, var(--primary) 7%, transparent);
    }

    .user-instance-member:hover {
        background: color-mix(in srgb, var(--foreground) 6%, transparent);
    }

    /* formatDifference returns these markers for the bio diff view. Keep the
       visual treatment local to the profile tab so the raw bio remains plain
       text everywhere else. */
    :deep(.x-text-removed) {
        text-decoration: line-through;
        color: #ff6b6b;
        background-color: rgb(255 0 0 / 18%);
        padding: 2px 2px;
        border-radius: var(--radius-xs);
    }

    :deep(.x-text-added) {
        color: #4ade80;
        background-color: rgb(76 255 80 / 18%);
        padding: 2px 2px;
        border-radius: var(--radius-xs);
    }

    @media (prefers-reduced-motion: reduce) {
        .user-info-card {
            transition: none;
        }

        .user-info-card:hover,
        .user-info-card:focus-within {
            transform: none;
        }
    }
</style>
