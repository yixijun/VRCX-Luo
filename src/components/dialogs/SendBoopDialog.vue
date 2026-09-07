<template>
    <Dialog v-model:open="sendBoopDialog.visible">
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{{ t('dialog.boop_dialog.header') }}</DialogTitle>
            </DialogHeader>
            <span>{{ displayName }}</span>

            <div v-if="sendBoopDialog.visible" class="mt-2">
                <Popover v-model:open="emojiPickerOpen">
                    <PopoverTrigger as-child>
                        <Button
                            variant="outline"
                            role="combobox"
                            :aria-expanded="emojiPickerOpen"
                            class="w-full justify-between">
                            <span v-if="selectedDefaultEmoji" class="flex items-center gap-2">
                                <span
                                    class="inline-flex size-6 items-center justify-center text-lg leading-none"
                                    role="img"
                                    :aria-label="selectedDefaultEmoji.label"
                                    :title="selectedDefaultEmoji.label">
                                    {{ selectedDefaultEmoji.glyph }}
                                </span>
                                <span class="truncate">{{ selectedDefaultEmoji.label }}</span>
                            </span>
                            <span v-else class="truncate text-muted-foreground">
                                {{ t('dialog.boop_dialog.select_default_emoji') }}
                            </span>
                            <ChevronDown class="size-4 shrink-0 opacity-60" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-[--reka-popover-trigger-width] min-w-60 p-2">
                        <Input
                            v-model="emojiSearch"
                            :placeholder="t('dialog.boop_dialog.select_default_emoji')"
                            type="search"
                            class="mb-2 h-9" />
                        <div
                            class="grid max-h-60 grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-1.5 overflow-y-auto rounded-md bg-muted/30 p-1.5">
                            <button
                                v-for="item in filteredDefaultEmojiItems"
                                :key="item.value"
                                type="button"
                                class="relative flex aspect-square min-w-0 cursor-pointer items-center justify-center rounded-md text-lg leading-none transition-colors duration-100 hover:bg-muted"
                                :class="item.value === fileId ? 'bg-muted ring-1 ring-primary/60' : ''"
                                :aria-label="item.label"
                                :title="item.label"
                                @click="selectDefaultEmoji(item.value)">
                                <span role="img" :aria-label="item.label">{{ item.glyph }}</span>
                                <CheckIcon
                                    v-if="item.value === fileId"
                                    class="absolute right-1 bottom-1 size-3.5 text-primary" />
                            </button>
                            <span
                                v-if="filteredDefaultEmojiItems.length === 0"
                                class="col-span-full px-2 py-5 text-center text-xs text-muted-foreground">
                                {{ t('side_panel.search_no_results') }}
                            </span>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <div
                v-if="isLocalUserVrcPlusSupporter"
                style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    gap: 6px;
                    margin-top: 8px;
                    max-height: 600px;
                    overflow-y: auto;
                ">
                <div
                    v-for="image in emojiTable"
                    :key="image.id"
                    data-testid="custom-emoji-option"
                    role="button"
                    tabindex="0"
                    :aria-pressed="image.id === fileId"
                    :class="[
                        'group relative cursor-pointer overflow-hidden rounded-xl border-2 p-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
                        image.id === fileId
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/50'
                            : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
                    ]"
                    @click="fileId = image.id"
                    @keydown.enter.prevent="fileId = image.id"
                    @keydown.space.prevent="fileId = image.id">
                    <div
                        v-if="
                            image.versions &&
                            image.versions.length > 0 &&
                            image.versions[image.versions.length - 1].file.url
                        "
                        data-testid="custom-emoji-preview"
                        class="aspect-square w-full overflow-hidden rounded-[inherit]">
                        <Emoji
                            :imageUrl="image.versions[image.versions.length - 1].file.url"
                            class="size-full"></Emoji>
                    </div>
                    <span
                        v-if="image.id === fileId"
                        data-testid="custom-emoji-selected"
                        class="pointer-events-none absolute top-1.5 right-1.5 z-10 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                        <CheckIcon class="size-3.5" aria-hidden="true" />
                    </span>
                </div>
            </div>

            <DialogFooter>
                <Button size="sm" variant="outline" class="mr-2" @click="showGalleryPage">{{
                    t('dialog.boop_dialog.emoji_manager')
                }}</Button>
                <Button size="sm" variant="secondary" class="mr-2" @click="closeDialog">{{
                    t('dialog.boop_dialog.cancel')
                }}</Button>
                <Button size="sm" :disabled="!sendBoopDialog.userId" @click="sendBoop">{{
                    t('dialog.boop_dialog.send')
                }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { computed, ref, watch } from 'vue';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Check as CheckIcon, ChevronDown } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { miscRequest, notificationRequest, queryRequest } from '../../api';
    import { useGalleryStore, useNotificationStore, useUserStore } from '../../stores';
    import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
    import { photonEmojis } from '../../shared/constants/photon.js';
    import { getDefaultBoopEmoji, toDefaultBoopEmojiId } from '../../shared/constants/boopEmoji.js';

    import Emoji from '../Emoji.vue';

    const { t } = useI18n();

    const { sendBoopDialog } = storeToRefs(useUserStore());
    const { notificationTable } = storeToRefs(useNotificationStore());
    const { showGalleryPage, refreshEmojiTable } = useGalleryStore();
    const { emojiTable } = storeToRefs(useGalleryStore());
    const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
    const { isNotificationExpired, handleNotificationV2Hide } = useNotificationStore();

    const fileId = ref('');
    const displayName = ref('');
    const emojiSearch = ref('');
    const emojiPickerOpen = ref(false);

    watch(
        () => sendBoopDialog.value.visible,
        (visible) => {
            if (visible) {
                displayName.value = '';
                emojiSearch.value = '';
                emojiPickerOpen.value = false;
                queryRequest.fetch('user.dialog', { userId: sendBoopDialog.value.userId }).then((user) => {
                    displayName.value = user.ref.displayName;
                });
            }
            if (visible && isLocalUserVrcPlusSupporter && emojiTable.value.length === 0) {
                refreshEmojiTable();
            }
        }
    );

    /**
     *
     */
    function closeDialog() {
        sendBoopDialog.value.visible = false;
    }

    /**
     *
     * @param emojiName
     */
    function getEmojiValue(emojiName) {
        if (!emojiName) {
            return '';
        }
        return toDefaultBoopEmojiId(emojiName);
    }

    const defaultEmojiItems = computed(() =>
        photonEmojis.map((emojiName) => ({
            value: getEmojiValue(emojiName),
            label: emojiName,
            search: emojiName,
            glyph: getDefaultBoopEmoji(getEmojiValue(emojiName))?.glyph || '✨'
        }))
    );

    const selectedDefaultEmoji = computed(() =>
        defaultEmojiItems.value.find((item) => item.value === fileId.value)
    );

    const filteredDefaultEmojiItems = computed(() => {
        const search = emojiSearch.value.trim().toLowerCase();
        if (!search) return defaultEmojiItems.value;
        return defaultEmojiItems.value.filter((item) => item.search.toLowerCase().includes(search));
    });

    function selectDefaultEmoji(value) {
        fileId.value = fileId.value === value ? '' : value;
        emojiPickerOpen.value = false;
        emojiSearch.value = '';
    }

    /**
     *
     */
    function sendBoop() {
        const D = sendBoopDialog.value;
        dismissBoop(D.userId);
        const params = {
            userId: D.userId
        };
        if (fileId.value) {
            params.emojiId = fileId.value;
        }
        miscRequest.sendBoop(params);
        D.visible = false;
    }

    /**
     *
     * @param userId
     */
    function dismissBoop(userId) {
        // JANK: This is a hack to remove boop notifications when responding
        const array = notificationTable.value.data;
        for (let i = array.length - 1; i >= 0; i--) {
            const ref = array[i];
            if (ref.type !== 'boop' || isNotificationExpired(ref) || ref.link !== `user:${userId}`) {
                continue;
            }
            console.log('Dismissing boop notification with id', ref.id);
            handleNotificationV2Hide(ref.id);
            notificationRequest.hideNotificationV2(ref.id);
        }
    }
</script>
