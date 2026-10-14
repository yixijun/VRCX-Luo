<template>
    <Dialog v-model:open="isOpen">
        <DialogContent class="x-dialog flex max-h-[calc(100dvh-3rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
            <DialogHeader class="shrink-0 border-b border-border/60 px-5 py-4">
                <DialogTitle>
                    {{ t('dialog.user.activity.room_activity.page_title', { name: friendName || userId }) }}
                </DialogTitle>
                <DialogDescription class="text-xs">
                    {{ t('dialog.user.activity.room_activity.page_hint') }}
                </DialogDescription>
            </DialogHeader>

            <FriendActivity
                :user-id="userId"
                :initial-period="initialPeriod"
                embedded
                class="min-h-0 flex-1"
                @close="isOpen = false" />
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { useI18n } from 'vue-i18n';

    import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import FriendActivity from './FriendActivity.vue';

    defineProps({
        userId: { type: String, default: '' },
        friendName: { type: String, default: '' },
        initialPeriod: { type: String, default: '30' }
    });

    const isOpen = defineModel('open', { type: Boolean, default: false });
    const { t } = useI18n();
</script>
