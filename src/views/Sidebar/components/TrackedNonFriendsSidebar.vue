<template>
    <div class="relative h-full">
        <div class="h-full w-full overflow-auto overflow-x-hidden">
            <div class="px-1.5 py-2.5">
                <div v-if="trackedList.length === 0" class="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs">
                    <span>{{ t('side_panel.tracked_nonfriends.empty') }}</span>
                </div>
                <div v-else class="flex flex-col gap-0.5">
                    <div
                        v-for="entry in enrichedList"
                        :key="entry.userId"
                        class="box-border flex items-center p-1.5 text-[13px] cursor-pointer hover:bg-muted/50 hover:rounded-lg group"
                        @click="entry.userId && showUserDialog(entry.userId)">
                        <div
                            v-if="entry.ref"
                            class="relative inline-block flex-none size-9 mr-2.5"
                            :class="userStatusClass(entry.ref)">
                            <Avatar class="size-full rounded-full">
                                <AvatarImage :src="userImage(entry.ref)" class="object-cover" />
                                <AvatarFallback>
                                    <User class="size-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div v-else class="relative inline-block flex-none size-9 mr-2.5">
                            <Avatar class="size-full rounded-full">
                                <AvatarFallback>
                                    <User class="size-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden h-9 flex flex-col justify-between">
                            <span
                                class="block truncate font-medium leading-[18px]"
                                :style="entry.ref ? { color: entry.ref.$userColour } : undefined">
                                <UserIdentityInline
                                    :user="entry.ref"
                                    :user-id="entry.userId"
                                    :display-name="entry.displayName"
                                    :image-resolver="userImage"
                                    avatar-class="hidden" />
                            </span>
                            <span class="block truncate text-xs text-muted-foreground">
                                {{ entry.ref ? entry.ref.statusDescription : '' }}
                            </span>
                        </div>
                        <TooltipWrapper side="left" :content="t('side_panel.tracked_nonfriends.remove_tooltip')">
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                class="opacity-0 group-hover:opacity-100 ml-1 flex-none"
                                @click.stop="removeEntry(entry.userId)">
                                <X class="size-3.5" />
                            </Button>
                        </TooltipWrapper>
                    </div>
                </div>
            </div>
        </div>

        <!-- Floating add button (styled like 自动跟随) -->
        <div class="absolute bottom-5 right-4 z-10">
            <button type="button" class="add-tracked-btn" :aria-label="t('side_panel.tracked_nonfriends.add_button')" @click="openAddDialog">
                {{ t('side_panel.tracked_nonfriends.add_button') }}
                <UserPlus class="w-3.5 h-3.5 ml-1.5" />
            </button>
        </div>

        <!-- Add tracked non-friend dialog -->
        <Dialog v-model:open="addDialogOpen">
            <DialogContent class="w-[360px] max-w-[95vw]" @open-auto-focus.prevent>
                <DialogHeader>
                    <DialogTitle>{{ t('side_panel.tracked_nonfriends.add_dialog_title') }}</DialogTitle>
                    <DialogDescription>
                        {{ t('side_panel.tracked_nonfriends.add_dialog_hint') }}
                    </DialogDescription>
                </DialogHeader>

                <!-- Step 1: input usr_xxx -->
                <template v-if="addStep === 'input'">
                    <div class="flex flex-col gap-3 py-2">
                        <Input
                            v-model="addInput"
                            :placeholder="t('side_panel.tracked_nonfriends.add_input_placeholder')"
                            :disabled="isVerifying"
                            @keydown.enter="verifyUser" />
                        <p v-if="addError" class="text-sm text-destructive">{{ addError }}</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="closeAddDialog">{{ t('dialog.alertdialog.cancel') }}</Button>
                        <Button :disabled="!addInput.trim() || isVerifying" @click="verifyUser">
                            <Spinner v-if="isVerifying" class="mr-2" />
                            {{ t('dialog.alertdialog.confirm') }}
                        </Button>
                    </DialogFooter>
                </template>

                <!-- Step 2: confirm identity -->
                <template v-else-if="addStep === 'confirm'">
                    <div class="flex items-center gap-3 py-2">
                        <Avatar class="size-12 rounded-full flex-none">
                            <AvatarImage v-if="verifiedUser" :src="userImage(verifiedUser)" class="object-cover" />
                            <AvatarFallback><User class="size-5" /></AvatarFallback>
                        </Avatar>
                        <div>
                            <p class="font-medium">
                                {{ t('side_panel.tracked_nonfriends.add_confirm_question', { name: verifiedUser?.displayName || addInput }) }}
                            </p>
                            <p class="text-xs text-muted-foreground">{{ addInput }}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" @click="addStep = 'input'">{{ t('side_panel.tracked_nonfriends.add_back') }}</Button>
                        <Button @click="confirmAdd">{{ t('dialog.alertdialog.confirm') }}</Button>
                    </DialogFooter>
                </template>
            </DialogContent>
        </Dialog>
    </div>
</template>

<script setup>
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Input } from '@/components/ui/input';
    import { Spinner } from '@/components/ui/spinner';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { User, UserPlus, X } from 'lucide-vue-next';
    import { computed, ref } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useTrackedNonFriendsStore } from '../../../stores/trackedNonFriends';
    import { useUserStore } from '../../../stores/user';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { showUserDialog } from '../../../coordinators/userCoordinator';
    import { userRequest } from '../../../api';
    import UserIdentityInline from '../../../components/UserIdentityInline.vue';

    const { t } = useI18n();
    const { userImage, userStatusClass } = useUserDisplay();

    const trackedStore = useTrackedNonFriendsStore();
    const { trackedList } = storeToRefs(trackedStore);

    const userStore = useUserStore();

    const enrichedList = computed(() =>
        trackedList.value.map((entry) => ({
            ...entry,
            ref: userStore.cachedUsers.get(entry.userId) || null
        }))
    );

    async function removeEntry(userId) {
        await trackedStore.removeTrackedNonFriend(userId);
    }

    // ---- Add tracked non-friend dialog ----
    const addDialogOpen = ref(false);
    const addStep = ref('input'); // 'input' | 'confirm'
    const addInput = ref('');
    const addError = ref('');
    const isVerifying = ref(false);
    const verifiedUser = ref(null);

    function openAddDialog() {
        addInput.value = '';
        addError.value = '';
        addStep.value = 'input';
        verifiedUser.value = null;
        addDialogOpen.value = true;
    }

    function closeAddDialog() {
        addDialogOpen.value = false;
    }

    async function verifyUser() {
        const userId = addInput.value.trim();
        if (!userId) return;
        addError.value = '';
        isVerifying.value = true;
        try {
            const result = await userRequest.getUser({ userId });
            const userData = result?.ref;
            if (!userData) throw new Error('no_data');
            verifiedUser.value = userData;
            addStep.value = 'confirm';
        } catch (err) {
            addError.value = t('side_panel.tracked_nonfriends.add_verify_error');
        } finally {
            isVerifying.value = false;
        }
    }

    async function confirmAdd() {
        const user = verifiedUser.value;
        if (!user) return;
        await trackedStore.addTrackedNonFriend(user.id, user.displayName);
        closeAddDialog();
    }
</script>

<style scoped>
    .add-tracked-btn {
        display: inline-flex;
        align-items: center;
        padding: 6px 14px;
        border-radius: 9999px;
        border: none;
        background: rgba(59, 130, 246, 0.4);
        backdrop-filter: blur(4px);
        color: white;
        font-size: 13px;
        font-weight: 500;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .add-tracked-btn:hover {
        background: rgba(59, 130, 246, 0.55);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .add-tracked-btn:active {
        transform: scale(0.96);
    }
</style>
