<template>
    <template v-if="groupDialog.visible">
        <div class="group-posts-tab">
            <div class="group-content-block group-posts-toolbar">
                <span class="group-content-block__title"
                    >{{ t('dialog.group.posts.posts_count') }} {{ groupDialog.posts.length }}</span
                >
                <InputGroupField
                    v-model="groupDialog.postsSearch"
                    clearable
                    size="sm"
                    :placeholder="t('dialog.group.posts.search_placeholder')"
                    @input="updateGroupPostSearch" />
            </div>
            <div class="group-posts-list">
                <Card v-for="post in groupDialog.postsFiltered" :key="post.id" class="group-post cursor-default">
                    <CardHeader class="group-post__header">
                        <CardTitle class="group-post__title" v-text="post.title" />
                        <div v-if="post.authorId" class="group-content-block__actions group-post__actions">
                            <TooltipWrapper v-if="post.roleIds.length" side="top">
                                <template #content>
                                    <span>{{ t('dialog.group.posts.visibility') }}</span>
                                </template>
                                <Eye class="size-4 text-muted-foreground" />
                            </TooltipWrapper>
                            <TooltipWrapper
                                v-if="hasGroupPermission(groupDialog.ref, 'group-announcement-manage')"
                                side="top"
                                :content="t('dialog.group.posts.edit_tooltip')">
                                <Button
                                    size="icon-sm"
                                    class="h-7 w-7"
                                    variant="ghost"
                                    @click="showGroupPostEditDialog(groupDialog.id, post)">
                                    <Pencil class="size-4" />
                                </Button>
                            </TooltipWrapper>
                            <TooltipWrapper
                                v-if="hasGroupPermission(groupDialog.ref, 'group-announcement-manage')"
                                side="top"
                                :content="t('dialog.group.posts.delete_tooltip')">
                                <Button
                                    size="icon-sm"
                                    class="h-7 w-7"
                                    variant="ghost"
                                    @click="confirmDeleteGroupPost(post)">
                                    <Trash2 class="size-4" />
                                </Button>
                            </TooltipWrapper>
                        </div>
                    </CardHeader>
                    <CardContent class="group-post__body">
                        <div v-if="post.imageUrl" class="group-post__image">
                            <div class="cursor-pointer" @click="showFullscreenImageDialog(post.imageUrl)">
                                <img
                                    :src="post.imageUrl"
                                    class="size-16 rounded-md object-cover"
                                    @error="
                                        $event.target.style.display = 'none';
                                        $event.target.nextElementSibling.style.display = 'flex';
                                    "
                                    loading="lazy" />
                                <div class="hidden size-full items-center justify-center rounded-md bg-muted">
                                    <Image class="size-5 text-muted-foreground" />
                                </div>
                            </div>
                        </div>
                        <pre
                            class="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words text-xs font-[inherit] leading-relaxed"
                            >{{ post.text || '-' }}</pre
                        >
                    </CardContent>
                    <CardFooter v-if="post.authorId" class="group-post__footer group-content-block__meta">
                        <TooltipWrapper v-if="post.roleIds.length" side="top">
                            <template #content>
                                <span>{{ t('dialog.group.posts.visibility') }}</span>
                                <br />
                                <template v-for="roleId in post.roleIds" :key="roleId">
                                    <template v-for="role in groupDialog.ref.roles" :key="role.id + roleId"
                                        ><span v-if="role.id === roleId" v-text="role.name" />
                                    </template>
                                    <template v-if="post.roleIds.indexOf(roleId) < post.roleIds.length - 1"
                                        ><span>,&nbsp;</span></template
                                    >
                                </template>
                            </template>
                            <Eye class="mr-1.5 size-4" />
                        </TooltipWrapper>
                        <DisplayName :userid="post.authorId" class="mr-1.5" />
                        <span v-if="post.editorId" class="mr-1.5"
                            >({{ t('dialog.group.posts.edited_by') }} <DisplayName :userid="post.editorId" />)</span
                        >
                        <TooltipWrapper side="bottom">
                            <template #content>
                                <span
                                    >{{ t('dialog.group.posts.created_at') }}
                                    {{ formatDateFilter(post.createdAt, 'long') }}</span
                                >
                                <template v-if="post.updatedAt !== post.createdAt">
                                    <br />
                                    <span
                                        >{{ t('dialog.group.posts.edited_at') }}
                                        {{ formatDateFilter(post.updatedAt, 'long') }}</span
                                    >
                                </template>
                            </template>
                            <Timer :epoch="Date.parse(post.updatedAt)" />
                        </TooltipWrapper>
                    </CardFooter>
                </Card>
            </div>
        </div>
    </template>
</template>

<script setup>
    import { Eye, Image, Pencil, Trash2 } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
    import { InputGroupField } from '@/components/ui/input-group';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { formatDateFilter, hasGroupPermission } from '../../../shared/utils';
    import { useGalleryStore, useGroupStore } from '../../../stores';

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
    const { updateGroupPostSearch } = useGroupStore();
    const { showFullscreenImageDialog } = useGalleryStore();
</script>

<style scoped>
    .group-posts-tab,
    .group-posts-list {
        display: grid;
        min-width: 0;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
        gap: 1rem;
        padding: 0.125rem;
    }

    .group-posts-toolbar {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        padding: 0.625rem 0.75rem;
    }

    .group-posts-toolbar :deep(.input-group-field) {
        min-width: 0;
        flex: 1;
    }

    .group-post {
        min-height: 10rem;
        overflow: hidden;
        border: 0;
        border-radius: calc(var(--radius-lg) + 2px);
        padding: 0;
        background: var(--surface-raised);
        box-shadow:
            0 1px 2px color-mix(in oklch, black 12%, transparent),
            0 4px 14px color-mix(in oklch, black 7%, transparent);
        transition:
            box-shadow var(--motion-base) ease,
            transform var(--motion-fast) ease;
    }

    .group-post:hover {
        box-shadow: var(--shadow-floating);
        transform: translateY(-1px);
    }

    .group-post__header,
    .group-post__footer {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.5rem;
    }

    .group-post__header {
        justify-content: space-between;
        grid-template-columns: minmax(0, 1fr) auto;
        padding: 0.75rem 0.875rem;
        border-bottom: 1px solid var(--border-subtle);
        background: color-mix(in oklch, var(--surface-raised) 72%, transparent);
    }

    .group-post__title {
        overflow: hidden;
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .group-post__actions {
        opacity: 0;
        transition: opacity var(--motion-fast) ease;
    }

    .group-post:hover .group-post__actions,
    .group-post:focus-within .group-post__actions {
        opacity: 1;
    }

    .group-post__body {
        display: flex;
        min-width: 0;
        flex: 1;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.875rem;
    }

    .group-post__image {
        width: 5.5rem;
        aspect-ratio: 1;
        flex: none;
        overflow: hidden;
        border: 0;
        border-radius: var(--radius-lg);
    }

    .group-post__image > div,
    .group-post__image img {
        width: 100%;
        height: 100%;
    }

    .group-post__footer {
        flex-wrap: wrap;
        margin-top: auto;
        padding: 0.625rem 0.875rem;
        border-top: 1px solid var(--border-subtle);
        background: color-mix(in oklch, var(--muted) 34%, transparent);
    }

    @media (max-width: 34rem) {
        .group-posts-toolbar {
            align-items: stretch;
            flex-direction: column;
        }

        .group-post__body {
            flex-direction: column;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .group-post,
        .group-post__actions {
            transition: none;
        }
    }
</style>
