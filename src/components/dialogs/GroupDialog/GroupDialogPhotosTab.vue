<template>
    <input ref="uploadInputRef" class="hidden" type="file" accept="image/*" @change="uploadToCurrentGallery" />
    <TabsUnderline
        v-model="groupDialogGalleryCurrentName"
        :items="groupGalleryTabs"
        :unmount-on-hide="false"
        class="mt-2.5">
        <template
            v-for="(gallery, index) in groupDialog.ref.galleries"
            :key="`label-${index}`"
            v-slot:[`label-${index}`]>
            <span class="text-base font-bold" v-text="gallery.name" />
            <i class="x-status-icon" style="margin-left: 6px" :class="groupGalleryStatus(gallery)" />
            <span class="text-muted-foreground text-xs ml-1.5">{{
                groupDialog.galleries[gallery.id] ? groupDialog.galleries[gallery.id].length : 0
            }}</span>
        </template>
        <template
            v-for="(gallery, index) in groupDialog.ref.galleries"
            :key="`content-${index}`"
            v-slot:[String(index)]>
            <section class="group-content-block group-gallery-block">
                <div class="group-gallery-content-header">
                    <div class="min-w-0">
                        <div class="group-content-block__title" v-text="gallery.name" />
                        <div
                            class="group-content-block__meta group-gallery-description"
                            v-text="gallery.description || '-'" />
                    </div>
                    <div class="group-gallery-content-actions">
                        <TooltipWrapper :content="t('dialog.group.gallery.refresh')" side="top">
                            <Button
                                class="group-gallery-refresh rounded-full"
                                variant="outline"
                                size="icon-sm"
                                :disabled="isGroupGalleryLoading || isUploading"
                                @click="getGroupGalleries">
                                <Spinner v-if="isGroupGalleryLoading" />
                                <RefreshCw v-else />
                            </Button>
                        </TooltipWrapper>
                        <TooltipWrapper
                            v-if="canUploadToGallery(gallery)"
                            :content="t('dialog.group.gallery.upload')"
                            side="top">
                            <Button
                                class="group-gallery-upload rounded-full"
                                variant="outline"
                                size="icon-sm"
                                :disabled="isGroupGalleryLoading || isUploading"
                                @click="openUploadPicker">
                                <Spinner v-if="isUploading && currentGallery?.id === gallery.id" />
                                <Upload v-else />
                            </Button>
                        </TooltipWrapper>
                    </div>
                </div>
                <div class="group-gallery-grid">
                    <button
                        v-for="image in groupDialog.galleries[gallery.id]"
                        :key="image.id"
                        type="button"
                        class="group-gallery-image"
                        @click="showFullscreenImageDialog(image.imageUrl)">
                        <div class="size-full">
                            <img
                                :src="image.imageUrl"
                                class="size-full object-cover"
                                @error="
                                    $event.target.style.display = 'none';
                                    $event.target.nextElementSibling.style.display = 'flex';
                                "
                                loading="lazy" />
                            <div class="hidden size-full items-center justify-center bg-muted">
                                <Image class="size-8 text-muted-foreground" />
                            </div>
                        </div>
                    </button>
                    <div
                        v-if="!groupDialog.galleries[gallery.id]?.length"
                        class="group-content-block__empty group-gallery-empty">
                        -
                    </div>
                </div>
            </section>
        </template>
    </TabsUnderline>
</template>

<script setup>
    import { Button } from '@/components/ui/button';
    import { Image, RefreshCw, Upload } from 'lucide-vue-next';
    import { Spinner } from '@/components/ui/spinner';
    import { TabsUnderline } from '@/components/ui/tabs';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { computed, ref } from 'vue';
    import { storeToRefs } from 'pinia';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';

    import { groupRequest, vrcPlusImageRequest } from '../../../api';
    import { useGalleryStore, useGroupStore } from '../../../stores';
    import { hasGroupPermission } from '../../../shared/utils';
    import { useGroupGalleries } from './useGroupGalleries';

    const { t } = useI18n();
    const { groupDialog } = storeToRefs(useGroupStore());
    const { showFullscreenImageDialog } = useGalleryStore();
    const uploadInputRef = ref(null);
    const isUploading = ref(false);

    const {
        isGroupGalleryLoading,
        groupDialogGalleryCurrentName,
        groupGalleryTabs,
        groupGalleryStatus,
        getGroupGalleries
    } = useGroupGalleries(groupDialog);

    const currentGallery = computed(
        () => groupDialog.value.ref.galleries?.[Number(groupDialogGalleryCurrentName.value)] ?? null
    );

    function canUploadToGallery(gallery) {
        if (!gallery) {
            return false;
        }
        if (hasGroupPermission(groupDialog.value.ref, 'group-galleries-manage')) {
            return true;
        }
        const allowedRoleIds = gallery.roleIdsToSubmit;
        const currentRoleIds = groupDialog.value.ref.myMember?.roleIds ?? [];
        return Array.isArray(allowedRoleIds) && allowedRoleIds.some((id) => currentRoleIds.includes(id));
    }

    const canUploadToCurrentGallery = computed(() => canUploadToGallery(currentGallery.value));

    function openUploadPicker() {
        uploadInputRef.value?.click();
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(btoa(String(reader.result)));
            reader.onerror = () => reject(reader.error);
            reader.readAsBinaryString(file);
        });
    }

    async function uploadToCurrentGallery(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';
        const gallery = currentGallery.value;
        if (!file || !gallery || !canUploadToCurrentGallery.value) {
            return;
        }
        if (file.size >= 100_000_000) {
            toast.error(t('message.file.too_large'));
            return;
        }
        if (!file.type.startsWith('image/')) {
            toast.error(t('message.file.not_image'));
            return;
        }

        isUploading.value = true;
        try {
            const imageData = await readFileAsBase64(file);
            const uploadArgs = await vrcPlusImageRequest.uploadGalleryImage(imageData);
            await groupRequest.addGroupGalleryImage({
                groupId: groupDialog.value.id,
                galleryId: gallery.id,
                fileId: uploadArgs.json.id
            });
            await getGroupGalleries();
            const index = groupDialog.value.ref.galleries.findIndex((item) => item.id === gallery.id);
            groupDialogGalleryCurrentName.value = String(Math.max(0, index));
            toast.success(t('dialog.group.gallery.uploaded'));
        } catch (error) {
            toast.error(error?.message || t('dialog.group.gallery.upload_failed'));
        } finally {
            isUploading.value = false;
        }
    }

    defineExpose({
        getGroupGalleries
    });
</script>

<style scoped>
    .group-gallery-block {
        overflow: visible;
    }

    .group-gallery-content-header {
        display: flex;
        min-height: 3.25rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.75rem 0.875rem;
        border-bottom: 1px solid var(--border-subtle);
    }

    .group-gallery-content-actions {
        display: flex;
        flex: none;
        align-items: center;
        gap: 0.25rem;
    }

    .group-gallery-description {
        margin-top: 0.1875rem;
        overflow-wrap: anywhere;
    }

    .group-gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
        gap: 0.625rem;
        max-height: min(36rem, 62vh);
        overflow-y: auto;
        padding: 0.75rem;
    }

    .group-gallery-image {
        position: relative;
        min-width: 0;
        aspect-ratio: 4 / 3;
        cursor: pointer;
        overflow: hidden;
        border: 0;
        border-radius: var(--radius-lg);
        padding: 0;
        background: var(--muted);
        transition:
            box-shadow var(--motion-base) ease,
            transform var(--motion-fast) ease;
    }

    .group-gallery-image img {
        transition: transform 220ms ease;
    }

    .group-gallery-image:hover {
        box-shadow: var(--shadow-surface);
        transform: translateY(-1px);
    }

    .group-gallery-image:hover img {
        transform: scale(1.025);
    }

    .group-gallery-image:focus-visible {
        outline: 0;
        box-shadow: var(--shadow-floating);
    }

    .group-gallery-empty {
        grid-column: 1 / -1;
    }

    @media (prefers-reduced-motion: reduce) {
        .group-gallery-image,
        .group-gallery-image img {
            transition: none;
        }
    }
</style>
