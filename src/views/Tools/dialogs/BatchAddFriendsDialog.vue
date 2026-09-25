<template>
    <Dialog :open="props.visible" @update:open="handleOpenChange">
        <DialogContent class="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{{ t('dialog.batch_add_friends.title') }}</DialogTitle>
                <DialogDescription>{{ t('dialog.batch_add_friends.description') }}</DialogDescription>
            </DialogHeader>

            <Textarea
                v-model="input"
                :disabled="isProcessing"
                :placeholder="t('dialog.batch_add_friends.input_placeholder')"
                class="min-h-36 resize-y font-mono text-xs" />

            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                    {{ t('dialog.batch_add_friends.ready_count', { count: userIds.length }) }}
                </span>
                <span v-if="duplicateCount">
                    {{ t('dialog.batch_add_friends.duplicate_count', { count: duplicateCount }) }}
                </span>
                <span v-if="invalidLineCount" class="text-destructive">
                    {{ t('dialog.batch_add_friends.invalid_lines', { count: invalidLineCount }) }}
                </span>
            </div>

            <div class="flex items-center justify-end gap-2">
                <Button variant="ghost" :disabled="isProcessing || !input" @click="clearInput">
                    {{ t('dialog.batch_add_friends.clear') }}
                </Button>
                <Button v-if="isProcessing" variant="secondary" @click="requestCancel">
                    {{ t('dialog.batch_add_friends.stop') }}
                </Button>
                <Button v-else :disabled="!userIds.length" @click="startBatchAdd">
                    <UserPlus class="size-4" />
                    {{ t('dialog.batch_add_friends.start') }}
                </Button>
            </div>

            <section v-if="results.length" class="flex min-h-0 flex-col gap-2">
                <div v-if="isProcessing || progressCurrent" class="flex flex-col gap-1.5">
                    <div class="flex justify-between text-xs text-muted-foreground">
                        <span>{{ t('dialog.batch_add_friends.progress') }}</span>
                        <span>{{ progressCurrent }}/{{ progressTotal }}</span>
                    </div>
                    <Progress :model-value="progressPercent" class="h-2" />
                </div>

                <div class="max-h-64 overflow-y-auto rounded-lg border">
                    <div
                        v-for="result in results"
                        :key="result.id"
                        class="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                        <div class="min-w-0">
                            <div class="truncate text-sm font-medium">{{ result.displayName || result.id }}</div>
                            <div class="truncate font-mono text-[11px] text-muted-foreground">{{ result.id }}</div>
                        </div>
                        <span :class="['shrink-0 text-xs', statusClass(result.status)]" :title="result.error">
                            {{ t(`dialog.batch_add_friends.status.${result.status}`) }}
                        </span>
                    </div>
                </div>

                <p v-if="runComplete" class="text-xs text-muted-foreground">
                    {{
                        t('dialog.batch_add_friends.summary', {
                            sent: sentCount,
                            skipped: skippedCount,
                            failed: failedCount,
                            cancelled: cancelledCount
                        })
                    }}
                </p>
            </section>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, ref } from 'vue';
    import { UserPlus } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Progress } from '@/components/ui/progress';
    import { Textarea } from '@/components/ui/textarea';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';

    import { friendRequest, userRequest } from '../../../api';
    import { handleFriendRequestSent } from '../../../coordinators/friendRelationshipCoordinator';
    import { useModalStore, useUserStore } from '../../../stores';

    const props = defineProps({ visible: { type: Boolean, default: false } });
    const emit = defineEmits(['close']);
    const { t } = useI18n();
    const modalStore = useModalStore();
    const userStore = useUserStore();

    const USER_ID_PATTERN = /usr_[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i;
    const USER_ID_GLOBAL_PATTERN = /usr_[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/gi;
    const input = ref('');
    const results = ref([]);
    const isProcessing = ref(false);
    const cancelRequested = ref(false);
    const runComplete = ref(false);
    const progressCurrent = ref(0);
    const progressTotal = ref(0);

    const parsedIds = computed(() => input.value.match(USER_ID_GLOBAL_PATTERN) || []);
    const userIds = computed(() => [...new Set(parsedIds.value.map((id) => id.toLowerCase()))]);
    const duplicateCount = computed(() => parsedIds.value.length - userIds.value.length);
    const invalidLineCount = computed(
        () => input.value.split(/\r?\n/).filter((line) => line.trim() && !USER_ID_PATTERN.test(line)).length
    );
    const progressPercent = computed(() =>
        progressTotal.value ? Math.floor((progressCurrent.value / progressTotal.value) * 100) : 0
    );
    const sentCount = computed(
        () => results.value.filter((result) => ['sent', 'added'].includes(result.status)).length
    );
    const skippedCount = computed(
        () =>
            results.value.filter((result) => ['already_friend', 'outgoing', 'incoming', 'self'].includes(result.status))
                .length
    );
    const failedCount = computed(
        () => results.value.filter((result) => ['not_found', 'failed'].includes(result.status)).length
    );
    const cancelledCount = computed(() => results.value.filter((result) => result.status === 'cancelled').length);

    function handleOpenChange(open) {
        if (!open) {
            if (isProcessing.value) {
                cancelRequested.value = true;
            }
            emit('close');
        }
    }

    function statusClass(status) {
        if (['sent', 'added'].includes(status)) return 'text-green-500';
        if (['not_found', 'failed'].includes(status)) return 'text-destructive';
        if (status === 'checking') return 'text-primary';
        return 'text-muted-foreground';
    }

    function clearInput() {
        input.value = '';
        results.value = [];
        runComplete.value = false;
        progressCurrent.value = 0;
        progressTotal.value = 0;
    }

    function requestCancel() {
        cancelRequested.value = true;
    }

    async function startBatchAdd() {
        if (isProcessing.value || !userIds.value.length) {
            return;
        }

        const ids = [...userIds.value];
        const confirmation = await modalStore.confirm({
            title: t('dialog.batch_add_friends.confirm_title'),
            description: t('dialog.batch_add_friends.confirm_description', { count: ids.length }),
            confirmText: t('dialog.batch_add_friends.start'),
            cancelText: t('confirm.cancel_button')
        });
        if (!confirmation.ok) {
            return;
        }

        results.value = ids.map((id) => ({ id, displayName: '', status: 'waiting', error: '' }));
        progressCurrent.value = 0;
        progressTotal.value = ids.length;
        runComplete.value = false;
        cancelRequested.value = false;
        isProcessing.value = true;

        try {
            for (const result of results.value) {
                if (cancelRequested.value) {
                    result.status = 'cancelled';
                    progressCurrent.value++;
                    continue;
                }

                result.status = 'checking';
                try {
                    if (result.id === userStore.currentUser.id) {
                        result.status = 'self';
                    } else {
                        let userRef = userStore.cachedUsers.get(result.id);
                        if (!userRef) {
                            const userArgs = await userRequest.getUser({ userId: result.id });
                            userRef = userArgs.ref;
                        }
                        result.displayName = userRef?.displayName || '';

                        const statusArgs = await friendRequest.getFriendStatus({
                            userId: result.id,
                            currentUserId: userStore.currentUser.id
                        });
                        if (statusArgs.json.isFriend) {
                            result.status = 'already_friend';
                        } else if (statusArgs.json.outgoingRequest) {
                            result.status = 'outgoing';
                        } else if (statusArgs.json.incomingRequest) {
                            result.status = 'incoming';
                        } else if (cancelRequested.value) {
                            result.status = 'cancelled';
                        } else {
                            const sentArgs = await friendRequest.sendFriendRequest({ userId: result.id });
                            handleFriendRequestSent(sentArgs);
                            result.status = sentArgs.json.success ? 'added' : 'sent';
                        }
                    }
                } catch (err) {
                    result.status = err?.status === 404 ? 'not_found' : 'failed';
                    result.error = err?.status ? String(err.status) : String(err?.message || '');
                    if (err?.status === 429 || err?.status === -1) {
                        cancelRequested.value = true;
                    }
                }

                progressCurrent.value++;
                if (!cancelRequested.value && progressCurrent.value < progressTotal.value) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }

            if (cancelRequested.value && progressCurrent.value < progressTotal.value) {
                for (const result of results.value) {
                    if (result.status === 'waiting') {
                        result.status = 'cancelled';
                    }
                }
            }

            if (failedCount.value) {
                toast.warning(
                    t('dialog.batch_add_friends.summary', {
                        sent: sentCount.value,
                        skipped: skippedCount.value,
                        failed: failedCount.value,
                        cancelled: cancelledCount.value
                    })
                );
            } else if (sentCount.value) {
                toast.success(
                    t('dialog.batch_add_friends.summary', {
                        sent: sentCount.value,
                        skipped: skippedCount.value,
                        failed: failedCount.value,
                        cancelled: cancelledCount.value
                    })
                );
            }
        } finally {
            isProcessing.value = false;
            runComplete.value = true;
        }
    }
</script>
