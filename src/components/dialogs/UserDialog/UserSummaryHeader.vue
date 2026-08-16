<template>
    <div data-testid="user-summary-header" class="flex min-w-0 flex-wrap items-start gap-4">
        <div
            data-testid="user-summary-media"
            class="shrink-0 overflow-hidden rounded-xl"
            style="height: 120px; width: 160px">
            <img
                v-if="
                    !userDialog.loading &&
                    !profileImageError &&
                    (userDialog.ref.profilePicOverrideThumbnail || userDialog.ref.profilePicOverride)
                "
                class="cursor-pointer"
                :src="userDialog.ref.profilePicOverrideThumbnail || userDialog.ref.profilePicOverride"
                style="height: 120px; width: 160px; border-radius: var(--radius-xl); object-fit: cover"
                @click="showFullscreenImageDialog(userDialog.ref.profilePicOverride)"
                @error="profileImageError = true"
                loading="lazy" />
            <img
                v-else-if="!userDialog.loading && !profileImageError && userDialog.ref.currentAvatarThumbnailImageUrl"
                class="cursor-pointer"
                :src="userDialog.ref.currentAvatarThumbnailImageUrl"
                style="height: 120px; width: 160px; border-radius: var(--radius-xl); object-fit: cover"
                @click="showFullscreenImageDialog(userDialog.ref.currentAvatarImageUrl)"
                @error="profileImageError = true"
                loading="lazy" />
            <div
                v-else-if="!userDialog.loading"
                class="flex items-center justify-center bg-muted"
                style="height: 120px; width: 160px; border-radius: var(--radius-xl)">
                <Image class="size-8 text-muted-foreground" />
            </div>
        </div>
        <div data-testid="user-summary-body" class="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div data-testid="user-summary-details" class="min-w-0 flex-1 basis-72">
                <div class="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
                    <TooltipWrapper v-if="userDialog.ref.status" side="top">
                        <template #content>
                            <span>{{ getUserStateText(userDialog.ref) }}</span>
                        </template>
                        <i class="x-user-status" :class="userStatusClass(userDialog.ref)"></i>
                    </TooltipWrapper>
                    <template v-if="userDialog.previousDisplayNames.length > 0">
                        <TooltipWrapper side="bottom">
                            <template #content>
                                <span>{{ t('dialog.user.previous_display_names') }}</span>
                                <div
                                    v-for="data in userDialog.previousDisplayNames"
                                    :key="data.displayName"
                                    placement="top">
                                    <span>{{ data.displayName }}</span>
                                    <span v-if="data.updated_at">
                                        &horbar; {{ formatDateFilter(data.updated_at, 'long') }}</span
                                    >
                                </div>
                            </template>
                            <ChevronDown class="inline-block" />
                        </TooltipWrapper>
                    </template>
                    <span
                        class="mx-1 min-w-0 cursor-pointer break-words font-bold"
                        v-text="userDialog.ref.displayName"
                        @click="copyUserDisplayName(userDialog.ref.displayName)"></span>
                    <TooltipWrapper v-if="userDialog.ref.pronouns" side="top" :content="t('dialog.user.pronouns')">
                        <span
                            class="x-grey font-mono text-xs"
                            style="margin-right: 6px"
                            v-text="userDialog.ref.pronouns"></span>
                    </TooltipWrapper>
                    <TooltipWrapper v-for="item in userDialog.ref.$languages" :key="item.key" side="top">
                        <template #content>
                            <span>{{ item.value }} ({{ item.key }})</span>
                        </template>
                        <span
                            class="flags"
                            :class="languageClass(item.key)"
                            style="display: inline-block; margin-right: 6px"></span>
                    </TooltipWrapper>
                    <template v-if="userDialog.ref.id === currentUser.id">
                        <span
                            class="x-grey font-mono text-xs"
                            style="margin-right: 8px; cursor: pointer"
                            v-text="currentUser.username"
                            @click="copyUserDisplayName(currentUser.username)"></span>
                    </template>
                </div>
                <div
                    data-testid="user-summary-tags"
                    class="mt-2 flex flex-wrap items-center gap-1"
                    v-show="!userDialog.loading">
                    <Popover @update:open="handleTrustHistoryOpen">
                        <PopoverTrigger asChild>
                            <Badge
                                as="button"
                                type="button"
                                variant="outline"
                                class="name cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                :class="userDialog.ref.$trustClass"
                                :title="t('dialog.user.tags.trust_level')">
                                <Shield class="h-4 w-4" /> {{ userDialog.ref.$trustLevel }}
                            </Badge>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" class="w-82 p-0 overflow-hidden">
                            <div class="border-b px-4 py-3">
                                <div class="text-sm font-semibold">等级时间</div>
                                <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>当前等级</span>
                                    <Badge variant="outline" class="name" :class="userDialog.ref.$trustClass">
                                        {{ userDialog.ref.$trustLevel }}
                                    </Badge>
                                </div>
                            </div>
                            <div class="max-h-72 overflow-y-auto p-2">
                                <div
                                    v-if="trustHistoryLoading"
                                    class="px-2 py-6 text-center text-sm text-muted-foreground">
                                    加载中...
                                </div>
                                <div v-else-if="trustHistoryTimeline.length" class="space-y-1">
                                    <div
                                        v-for="item in trustHistoryTimeline"
                                        :key="item.id"
                                        class="rounded-md px-2 py-2 hover:bg-accent/50">
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="inline-flex h-9 min-w-20 items-center justify-center gap-1 rounded-md border bg-background/70 px-2 text-xs font-semibold shadow-xs"
                                                :class="item.fromMeta.className"
                                                :title="item.from || '-'">
                                                <Shield class="size-3.5" />
                                                {{ item.fromMeta.shortLabel }}
                                            </span>
                                            <span class="text-xs text-muted-foreground">→</span>
                                            <span
                                                class="inline-flex h-9 min-w-20 items-center justify-center gap-1 rounded-md border bg-background/70 px-2 text-xs font-semibold shadow-xs"
                                                :class="item.toMeta.className"
                                                :title="item.to || '-'">
                                                <Shield class="size-3.5" />
                                                {{ item.toMeta.shortLabel }}
                                            </span>
                                        </div>
                                        <div class="mt-0.5 text-xs text-muted-foreground">
                                            {{ formatDateFilter(item.createdAt, 'long') }}
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="px-2 py-5 text-sm text-muted-foreground">暂无本地等级变更记录。</div>
                            </div>
                            <div class="border-t px-4 py-2 text-xs text-muted-foreground">
                                只显示 VRCX 本地记录到的好友等级变化。
                            </div>
                        </PopoverContent>
                    </Popover>
                    <TooltipWrapper
                        v-if="userDialog.ref.ageVerified && userDialog.ref.ageVerificationStatus"
                        side="top"
                        :content="t('dialog.user.tags.age_verified')">
                        <Badge variant="outline" class="text-[#3b82f6] border-[#3b82f6]!">
                            <template v-if="userDialog.ref.ageVerificationStatus === '18+'">
                                <IdCard class="h-4 w-4" /> 18+
                            </template>
                            <template v-else>
                                <IdCard class="h-4 w-4 text-base" />
                            </template>
                        </Badge>
                    </TooltipWrapper>
                    <TooltipWrapper
                        v-if="userDialog.isFriend && userDialog.friend"
                        side="top"
                        :content="t('dialog.user.tags.friend_number')">
                        <Badge variant="outline" class="text-amber-400 border-amber-400!">
                            <UserPlus class="h-4 w-4" />
                            {{ userDialog.ref.$friendNumber ? userDialog.ref.$friendNumber : '' }}
                        </Badge>
                    </TooltipWrapper>
                    <TooltipWrapper
                        v-if="userDialog.mutualFriendCount"
                        side="top"
                        :content="t('dialog.user.tags.mutual_friends')">
                        <Badge variant="outline" class="border-zinc-500/50! dark:border-zinc-400!">
                            <Users class="h-4 w-4" />
                            {{ userDialog.mutualFriendCount }}
                        </Badge>
                    </TooltipWrapper>
                    <TooltipWrapper
                        v-if="userDialog.ref.discordId"
                        side="top"
                        :content="t('dialog.user.tags.open_in_discord')">
                        <Badge
                            variant="outline"
                            class="text-[#7289da] border-[#7289da]! cursor-pointer"
                            @click="openDiscordProfile(userDialog.ref.discordId)">
                            <i class="ri-discord-line text-xs"></i>
                            {{ t('dialog.user.tags.discord') }}
                        </Badge>
                    </TooltipWrapper>
                    <Badge v-if="userDialog.ref.$isTroll" variant="outline" class="x-tag-troll">
                        {{ t('view.settings.appearance.user_colors.trust_levels.nuisance') }}
                    </Badge>
                    <Badge v-if="userDialog.ref.$isProbableTroll" variant="outline" class="x-tag-troll">
                        {{ t('view.favorite.avatars.almost_nuisance') }}
                    </Badge>
                    <Badge v-if="userDialog.ref.$isModerator" variant="outline" class="x-tag-vip">
                        {{ t('dialog.user.tags.vrchat_team') }}
                    </Badge>

                    <TooltipWrapper v-if="userDialog.ref.$platform === 'standalonewindows'" side="top" content="PC">
                        <Badge variant="outline" class="text-platform-pc border-platform-pc!">
                            <Monitor class="m-0.5 text-platform-pc" />
                        </Badge>
                    </TooltipWrapper>
                    <TooltipWrapper v-else-if="userDialog.ref.$platform === 'android'" side="top" content="Android">
                        <Badge variant="outline" class="text-platform-quest border-platform-quest!">
                            <Smartphone class="m-0.5 text-platform-quest" />
                        </Badge>
                    </TooltipWrapper>
                    <TooltipWrapper v-else-if="userDialog.ref.$platform === 'ios'" side="top" content="iOS">
                        <Badge variant="outline" class="text-platform-ios border-platform-ios">
                            <Apple class="m-0.5 text-platform-ios" />
                        </Badge>
                    </TooltipWrapper>
                    <Badge v-else-if="userDialog.ref.$platform" variant="outline" class="text-muted-foreground">
                        {{ userDialog.ref.$platform }}
                    </Badge>

                    <Badge
                        v-if="userDialog.ref.$customTag"
                        variant="outline"
                        class="name"
                        :style="{
                            color: userDialog.ref.$customTagColour,
                            'border-color': userDialog.ref.$customTagColour
                        }"
                        >{{ userDialog.ref.$customTag }}</Badge
                    >
                </div>
                <div data-testid="user-summary-badges" class="mt-1 flex flex-wrap items-center gap-1">
                    <TooltipWrapper v-for="badge in userDialog.ref.badges" :key="badge.badgeId" side="top">
                        <template #content>
                            <span>{{ badge.badgeName }}</span>
                            <span v-if="badge.hidden">&nbsp;(Hidden)</span>
                        </template>
                        <div style="display: inline-block">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <img
                                        class="cursor-pointer hover:grayscale-0"
                                        :src="badge.badgeImageUrl"
                                        style="
                                            flex: none;
                                            height: 32px;
                                            width: 32px;
                                            border-radius: var(--radius-sm);
                                            object-fit: cover;
                                            margin-top: 6px;
                                            margin-right: 6px;
                                        "
                                        :class="{ grayscale: badge.hidden }"
                                        loading="lazy" />
                                </PopoverTrigger>
                                <PopoverContent side="bottom" class="w-75">
                                    <img
                                        :src="badge.badgeImageUrl"
                                        :class="['cursor-pointer', 'max-w-full', 'max-h-full']"
                                        @click="showFullscreenImageDialog(badge.badgeImageUrl)"
                                        loading="lazy" />
                                    <br />
                                    <div style="display: block; width: 275px; word-break: normal">
                                        <span>{{ badge.badgeName }}</span>
                                        <br />
                                        <span class="x-grey text-xs">{{ badge.badgeDescription }}</span>
                                        <br />
                                        <span v-if="badge.assignedAt" class="x-grey font-mono text-xs">
                                            {{ t('dialog.user.badges.assigned') }}:
                                            {{ formatDateFilter(badge.assignedAt, 'long') }}
                                        </span>
                                        <template v-if="userDialog.id === currentUser.id">
                                            <br />
                                            <label class="inline-flex items-center gap-2" style="margin-top: 6px">
                                                <Checkbox
                                                    v-model="badge.hidden"
                                                    @update:modelValue="toggleBadgeVisibility(badge)" />
                                                <span>{{ t('dialog.user.badges.hidden') }}</span>
                                            </label>
                                            <br />
                                            <label class="inline-flex items-center gap-2">
                                                <Checkbox
                                                    v-model="badge.showcased"
                                                    @update:modelValue="toggleBadgeShowcased(badge)" />
                                                <span>{{ t('dialog.user.badges.showcased') }}</span>
                                            </label>
                                        </template>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </TooltipWrapper>
                </div>
                <div class="mt-1 min-w-0">
                    <span class="break-words text-xs" v-text="userDialog.ref.statusDescription"></span>
                </div>
                <div data-testid="user-summary-context" class="user-summary-context">
                    <div data-testid="avatar-info-card" class="user-summary-context-item">
                        <div class="user-summary-context-icon" aria-hidden="true">
                            <Box class="size-3.5" />
                        </div>
                        <div class="user-summary-context-copy">
                            <div class="flex min-w-0 items-center gap-1">
                                <span class="truncate text-[11px] font-medium text-muted-foreground">
                                    {{
                                        userDialog.id !== currentUser.id &&
                                        userDialog.ref.profilePicOverride &&
                                        userDialog.ref.currentAvatarImageUrl
                                            ? t('dialog.user.info.avatar_info_last_seen')
                                            : t('dialog.user.info.avatar_info')
                                    }}
                                </span>
                                <TooltipWrapper
                                    v-if="userDialog.ref.profilePicOverride && !userDialog.ref.currentAvatarImageUrl"
                                    side="top"
                                    :content="t('dialog.user.info.vrcplus_hides_avatar')">
                                    <Info class="size-3.5 text-muted-foreground" />
                                </TooltipWrapper>
                            </div>
                            <AvatarInfo
                                :key="userDialog.id"
                                :imageurl="userDialog.ref.currentAvatarImageUrl"
                                :userid="userDialog.id"
                                :avatartags="userDialog.ref.currentAvatarTags"
                                :showtags="false"
                                class="block min-w-0 max-w-full text-xs" />
                        </div>
                    </div>

                    <div data-testid="represented-group-card" class="user-summary-context-item">
                        <Avatar
                            class="size-7! shrink-0 rounded-md!"
                            :class="userDialog.representedGroup?.iconUrl ? 'cursor-pointer' : ''"
                            :style="{
                                background: userDialog.isRepresentedGroupLoading ? 'var(--muted)' : ''
                            }"
                            @click="showRepresentedGroupImage">
                            <AvatarImage
                                :src="userDialog.representedGroup?.$thumbnailUrl"
                                @load="userDialog.isRepresentedGroupLoading = false"
                                @error="userDialog.isRepresentedGroupLoading = false" />
                            <AvatarFallback class="rounded-md!">
                                <Users class="size-3.5 text-muted-foreground" />
                            </AvatarFallback>
                        </Avatar>
                        <div class="user-summary-context-copy">
                            <div class="truncate text-[11px] font-medium text-muted-foreground">
                                {{ t('dialog.user.info.represented_group') }}
                            </div>
                            <button
                                v-if="userDialog.representedGroup?.isRepresenting"
                                type="button"
                                :title="userDialog.representedGroup.name"
                                class="block max-w-full cursor-pointer truncate text-left text-xs font-medium hover:underline"
                                @click="showGroupDialog(userDialog.representedGroup.groupId)">
                                <span v-if="userDialog.representedGroup.ownerId === userDialog.id"
                                    >&#x1F451;&nbsp;</span
                                >
                                <span>{{ userDialog.representedGroup.name }}</span>
                                <span class="text-muted-foreground">
                                    ({{ userDialog.representedGroup.memberCount }})</span
                                >
                            </button>
                            <span v-else class="text-xs text-muted-foreground">-</span>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="userDialog.ref.userIcon" class="shrink-0">
                <img
                    v-if="!userIconError"
                    class="cursor-pointer"
                    :src="userImage(userDialog.ref, true, '256', true)"
                    style="flex: none; width: 120px; height: 120px; border-radius: var(--radius-xl); object-fit: cover"
                    @click="showFullscreenImageDialog(userDialog.ref.userIcon)"
                    @error="userIconError = true"
                    loading="lazy" />
                <div
                    v-else
                    class="flex items-center justify-center bg-muted"
                    style="width: 120px; height: 120px; border-radius: var(--radius-xl)">
                    <Image class="size-8 text-muted-foreground" />
                </div>
            </div>

            <div data-testid="user-summary-actions" class="user-summary-actions ml-auto self-start">
                <TooltipWrapper v-if="canShowAutoFollow" side="top" :content="autoFollowTooltip">
                    <Button
                        class="rounded-full"
                        :variant="isCurrentUserAutoFollowTarget ? 'default' : 'outline'"
                        size="icon-sm"
                        @click="toggleAutoFollow">
                        <Navigation />
                    </Button>
                </TooltipWrapper>
                <UserActionDropdown :user-dialog-command="userDialogCommand" />
            </div>
        </div>
    </div>
</template>

<script setup>
    import {
        Apple,
        Box,
        ChevronDown,
        IdCard,
        Image,
        Info,
        Monitor,
        Navigation,
        Shield,
        Smartphone,
        UserPlus,
        Users
    } from 'lucide-vue-next';
    import { computed, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import {
        formatDateFilter,
        isFriendOnline,
        isRealInstance,
        languageClass,
        openDiscordProfile
    } from '../../../shared/utils';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
    import { useAutoFollowStore, useGalleryStore, useUserStore } from '../../../stores';
    import { database } from '../../../services/database';
    import { Badge } from '../../ui/badge';
    import { Button } from '../../ui/button';
    import { Checkbox } from '../../ui/checkbox';
    import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';

    import AvatarInfo from '../../AvatarInfo.vue';
    import UserActionDropdown from './UserActionDropdown.vue';
    import { buildTrustLevelTimeline } from './trustLevelHistory';
    import { showGroupDialog } from '../../../coordinators/groupCoordinator';

    const props = defineProps({
        getUserStateText: {
            type: Function,
            required: true
        },

        copyUserDisplayName: {
            type: Function,
            required: true
        },
        toggleBadgeVisibility: {
            type: Function,
            required: true
        },
        toggleBadgeShowcased: {
            type: Function,
            required: true
        },
        userDialogCommand: {
            type: Function,
            required: true
        }
    });

    const { t } = useI18n();

    const { userDialog, currentUser } = storeToRefs(useUserStore());

    const { showFullscreenImageDialog } = useGalleryStore();
    const { userImage, userStatusClass } = useUserDisplay();
    const autoFollowStore = useAutoFollowStore();

    const profileImageError = ref(false);
    const userIconError = ref(false);
    const trustHistoryLoading = ref(false);
    const trustHistoryRows = ref([]);
    const trustHistoryLoadedUserId = ref('');

    const isCurrentUserAutoFollowTarget = computed(
        () => autoFollowStore.isActive && autoFollowStore.targetFriendId === userDialog.value.id
    );
    const canShowAutoFollow = computed(
        () =>
            currentUser.value.id !== userDialog.value.id &&
            userDialog.value.isFriend &&
            isFriendOnline(userDialog.value.friend) &&
            isRealInstance(userDialog.value.ref?.travelingToLocation || userDialog.value.ref?.location)
    );
    const trustHistoryTimeline = computed(() => buildTrustLevelTimeline(trustHistoryRows.value));
    const autoFollowTooltip = computed(() =>
        isCurrentUserAutoFollowTarget.value ? autoFollowStore.statusText || '跟随中' : '自动跟随'
    );

    watch(
        () => userDialog.value.id,
        () => {
            profileImageError.value = false;
            userIconError.value = false;
            trustHistoryRows.value = [];
            trustHistoryLoadedUserId.value = '';
        }
    );

    const getUserStateText = props.getUserStateText;
    const copyUserDisplayName = props.copyUserDisplayName;
    const toggleBadgeVisibility = props.toggleBadgeVisibility;
    const toggleBadgeShowcased = props.toggleBadgeShowcased;
    const userDialogCommand = props.userDialogCommand;

    async function toggleAutoFollow() {
        await autoFollowStore.toggleFollow(userDialog.value.ref);
    }

    function showRepresentedGroupImage() {
        const imageUrl = userDialog.value.representedGroup?.iconUrl;
        if (imageUrl) {
            showFullscreenImageDialog(imageUrl);
        }
    }

    async function handleTrustHistoryOpen(open) {
        if (!open) {
            return;
        }

        const userId = userDialog.value?.id || userDialog.value?.ref?.id;
        if (!userId || trustHistoryLoadedUserId.value === userId) {
            return;
        }

        trustHistoryLoading.value = true;
        try {
            const rows = await database.getFriendLogHistoryForUserId(userId, ['TrustLevel']);
            if ((userDialog.value?.id || userDialog.value?.ref?.id) !== userId) {
                return;
            }
            trustHistoryRows.value = Array.isArray(rows) ? rows : [];
            trustHistoryLoadedUserId.value = userId;
        } catch (error) {
            console.error(error);
            trustHistoryRows.value = [];
            trustHistoryLoadedUserId.value = userId;
        } finally {
            trustHistoryLoading.value = false;
        }
    }
</script>

<style scoped>
    .user-summary-context {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        min-width: 0;
        align-items: start;
        column-gap: 1.25rem;
        row-gap: 0.625rem;
        margin-top: 0.625rem;
        max-width: 42rem;
    }

    .user-summary-context-item {
        display: flex;
        min-height: 2.25rem;
        min-width: 0;
        align-items: center;
        gap: 0.5rem;
        padding-block: 0.125rem;
    }

    .user-summary-context-copy {
        min-width: 0;
        width: 100%;
    }

    .user-summary-context-icon {
        display: flex;
        width: 1.75rem;
        height: 1.75rem;
        flex: none;
        align-items: center;
        justify-content: center;
        color: var(--muted-foreground);
    }

    @media (max-width: 48rem) {
        .user-summary-context {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    .user-summary-actions {
        display: flex;
        flex: none;
        align-items: center;
        gap: 0.125rem;
        padding: 0.1875rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--muted) 58%, transparent);
    }

    .user-summary-actions :deep(button) {
        margin: 0;
        border-color: transparent;
        box-shadow: none;
    }
</style>
