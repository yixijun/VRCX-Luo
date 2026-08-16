<template>
    <div class="group-info-content">
        <section class="group-content-block group-info-block">
            <div class="group-content-block__header">
                <div class="min-w-0">
                    <div class="group-content-block__title">{{ t('dialog.group.info.announcement') }}</div>
                    <div class="group-info-announcement-title" v-text="groupDialog.announcement.title || '-'" />
                </div>
                <div
                    v-if="
                        groupDialog.announcement.id && hasGroupPermission(groupDialog.ref, 'group-announcement-manage')
                    "
                    class="group-content-block__actions group-info-actions">
                    <TooltipWrapper side="top" :content="t('dialog.group.posts.edit_tooltip')">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            @click="showGroupPostEditDialog(groupDialog.id, groupDialog.announcement)">
                            <Pencil class="size-4" />
                        </Button>
                    </TooltipWrapper>
                    <TooltipWrapper side="top" :content="t('dialog.group.posts.delete_tooltip')">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            @click="confirmDeleteGroupPost(groupDialog.announcement)">
                            <Trash2 class="size-4" />
                        </Button>
                    </TooltipWrapper>
                </div>
            </div>
            <div class="group-content-block__body group-info-announcement-body">
                <div v-if="groupDialog.announcement.imageUrl" class="group-info-announcement-media">
                    <img
                        v-if="!announcementPhotoError"
                        :src="groupDialog.announcement.imageUrl"
                        class="size-16 cursor-pointer rounded-md object-cover"
                        loading="lazy"
                        @click="showFullscreenImageDialog(groupDialog.announcement.imageUrl)"
                        @error="announcementPhotoError = true" />
                    <div v-else class="flex size-16 items-center justify-center rounded-md bg-muted">
                        <Image class="size-5 text-muted-foreground" />
                    </div>
                </div>
                <pre class="group-info-copy">{{ groupDialog.announcement.text || '-' }}</pre>
            </div>
            <div v-if="groupDialog.announcement.id" class="group-info-announcement-meta group-content-block__meta">
                <TooltipWrapper v-if="groupDialog.announcement.roleIds?.length" side="top">
                    <template #content>
                        <span>{{ t('dialog.group.posts.visibility') }}</span>
                        <br />
                        <template v-for="roleId in groupDialog.announcement.roleIds" :key="roleId">
                            <template v-for="role in groupDialog.ref.roles" :key="roleId + role.id">
                                <span v-if="role.id === roleId" v-text="role.name" />
                            </template>
                        </template>
                    </template>
                    <Eye class="size-4" />
                </TooltipWrapper>
                <DisplayName :userid="groupDialog.announcement.authorId" />
                <span v-if="groupDialog.announcement.editorId">
                    ({{ t('dialog.group.posts.edited_by') }}
                    <DisplayName :userid="groupDialog.announcement.editorId" />)
                </span>
                <TooltipWrapper side="bottom">
                    <template #content>
                        <span
                            >{{ t('dialog.group.posts.created_at') }}
                            {{ formatDateFilter(groupDialog.announcement.createdAt, 'long') }}</span
                        >
                        <template v-if="groupDialog.announcement.updatedAt !== groupDialog.announcement.createdAt">
                            <br />
                            <span
                                >{{ t('dialog.group.posts.edited_at') }}
                                {{ formatDateFilter(groupDialog.announcement.updatedAt, 'long') }}</span
                            >
                        </template>
                    </template>
                    <Timer :epoch="Date.parse(groupDialog.announcement.updatedAt)" />
                </TooltipWrapper>
            </div>
        </section>

        <section class="group-content-block group-info-block">
            <div class="group-content-block__header">
                <div class="group-content-block__title">{{ t('dialog.group.info.rules') }}</div>
            </div>
            <div class="group-content-block__body">
                <pre class="group-info-copy">{{ groupDialog.ref.rules || '-' }}</pre>
            </div>
        </section>

        <div class="group-info-grid">
            <div class="group-content-block group-info-field">
                <span class="group-content-block__title">{{ t('dialog.group.info.members') }}</span>
                <span class="group-content-block__meta"
                    >{{ groupDialog.ref.memberCount }} ({{ groupDialog.ref.onlineMemberCount }})</span
                >
            </div>
            <div class="group-content-block group-info-field">
                <span class="group-content-block__title">{{ t('dialog.group.info.created_at') }}</span>
                <span class="group-content-block__meta">{{ formatDateFilter(groupDialog.ref.createdAt, 'long') }}</span>
            </div>
            <button
                type="button"
                class="group-content-block group-info-field group-info-field--button"
                @click="showPreviousInstancesListDialog(groupDialog.ref)">
                <span class="group-content-block__title">{{ t('dialog.group.info.last_visited') }}</span>
                <span class="group-info-field__value">
                    <span class="group-content-block__meta">{{ formatDateFilter(groupDialog.lastVisit, 'long') }}</span>
                    <MoreHorizontal class="size-4" />
                </span>
            </button>
            <div class="group-content-block group-info-field">
                <span class="group-content-block__title">{{ t('dialog.group.info.url') }}</span>
                <span class="group-info-field__value">
                    <span class="group-content-block__meta truncate" v-text="groupDialog.ref.$url" />
                    <TooltipWrapper side="top" :content="t('dialog.group.info.url_tooltip')">
                        <Button size="icon-sm" variant="ghost" @click="copyToClipboard(groupDialog.ref.$url)"
                            ><Copy class="size-4"
                        /></Button>
                    </TooltipWrapper>
                </span>
            </div>
            <div class="group-content-block group-info-field">
                <span class="group-content-block__title">{{ t('dialog.group.info.id') }}</span>
                <span class="group-info-field__value">
                    <span class="group-content-block__meta truncate" v-text="groupDialog.id" />
                    <TooltipWrapper side="top" :content="t('dialog.group.info.id_tooltip')">
                        <Button size="icon-sm" variant="ghost" @click="copyToClipboard(groupDialog.id)"
                            ><Copy class="size-4"
                        /></Button>
                    </TooltipWrapper>
                </span>
            </div>
        </div>

        <div v-if="groupDialog.ref.membershipStatus === 'member'" class="group-info-grid">
            <div class="group-content-block group-info-field">
                <span class="group-content-block__title">{{ t('dialog.group.info.joined_at') }}</span>
                <span class="group-content-block__meta">{{
                    formatDateFilter(groupDialog.ref.myMember.joinedAt, 'long')
                }}</span>
            </div>
            <div class="group-content-block group-info-field">
                <span class="group-content-block__title">{{ t('dialog.group.info.roles') }}</span>
                <span v-if="groupDialog.memberRoles.length === 0" class="group-content-block__meta">-</span>
                <span v-else class="group-content-block__meta truncate">
                    <template v-for="(role, rIndex) in groupDialog.memberRoles" :key="role.id || rIndex">
                        <TooltipWrapper side="top">
                            <template #content>
                                <span>{{ t('dialog.group.info.role') }} {{ role.name }}</span
                                ><br />
                                <span>{{ t('dialog.group.info.role_description') }} {{ role.description }}</span
                                ><br />
                                <span
                                    >{{
                                        role.updatedAt
                                            ? t('dialog.group.info.role_updated_at')
                                            : t('dialog.group.info.role_created_at')
                                    }}
                                    {{ formatDateFilter(role.updatedAt || role.createdAt, 'long') }}</span
                                >
                            </template>
                            <span>{{ role.name }}{{ rIndex < groupDialog.memberRoles.length - 1 ? ', ' : '' }}</span>
                        </TooltipWrapper>
                    </template>
                </span>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { Copy, Eye, Image, MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import { ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { copyToClipboard, formatDateFilter, hasGroupPermission } from '../../../shared/utils';
    import { useGalleryStore, useGroupStore, useInstanceStore } from '../../../stores';

    defineProps({
        showGroupPostEditDialog: {
            type: Function,
            required: true
        },
        confirmDeleteGroupPost: {
            type: Function,
            required: true
        }
    });

    const { t } = useI18n();
    const { groupDialog } = storeToRefs(useGroupStore());
    const { showFullscreenImageDialog } = useGalleryStore();
    const instanceStore = useInstanceStore();

    const announcementPhotoError = ref(false);

    watch(
        () => groupDialog.value.id,
        () => {
            announcementPhotoError.value = false;
        }
    );

    /**
     *
     * @param groupRef
     */
    function showPreviousInstancesListDialog(groupRef) {
        instanceStore.showPreviousInstancesListDialog('group', groupRef);
    }
</script>

<style scoped>
    .group-info-content {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 0.75rem;
        padding-inline: 0.125rem;
    }

    .group-info-announcement-title {
        display: block;
        margin-top: 0.125rem;
        overflow: hidden;
        color: var(--muted-foreground);
        font-size: 0.75rem;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .group-info-announcement-body {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .group-info-announcement-media {
        flex: none;
    }

    .group-info-copy {
        min-width: 0;
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font: inherit;
        font-size: 0.75rem;
        line-height: 1.55;
    }

    .group-info-announcement-meta {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.375rem;
        padding: 0 0.875rem 0.75rem;
    }

    .group-info-actions {
        opacity: 0;
        transition: opacity var(--motion-fast) ease;
    }

    .group-info-block:hover .group-info-actions,
    .group-info-block:focus-within .group-info-actions {
        opacity: 1;
    }

    .group-info-grid {
        display: grid;
        min-width: 0;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
        gap: 0.75rem;
    }

    .group-info-field {
        display: flex;
        min-height: 4rem;
        flex-direction: column;
        justify-content: center;
        gap: 0.25rem;
        padding: 0.75rem 0.875rem;
        text-align: left;
    }

    .group-info-field--button {
        width: 100%;
        cursor: pointer;
        color: inherit;
        font: inherit;
    }

    .group-info-field--button:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
    }

    .group-info-field__value {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 0.375rem;
    }

    @media (max-width: 34rem) {
        .group-info-announcement-body {
            flex-direction: column;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .group-info-actions {
            transition: none;
        }
    }
</style>
