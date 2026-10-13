<template>
    <Dialog v-model:open="isVisible">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ t('view.tools.system_tools.info_completion') }}</DialogTitle>
                <DialogDescription>
                    {{ t('view.tools.system_tools.info_completion_description') }}
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-6 py-4">
                <div class="flex items-center justify-between text-sm">
                    <div class="text-muted-foreground">
                        <template v-if="!isRunning && !isDone">
                            准备好扫描 {{ totalTarget.friends }}+{{ totalTarget.tracked }} 个目标。
                        </template>
                        <template v-else>
                            本次扫描共计 {{ state.friendsTotal }}+{{ state.trackedTotal }} 个目标。
                        </template>
                    </div>
                    <div v-if="isRunning || isDone" class="flex gap-4">
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] text-muted-foreground uppercase opacity-70">Bio 更新</span>
                            <span class="text-sm font-bold text-green-500">{{ state.bioUpdated }}</span>
                        </div>
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] text-muted-foreground uppercase opacity-70">状态更新</span>
                            <span class="text-sm font-bold text-blue-500">{{ state.statusUpdated }}</span>
                        </div>
                    </div>
                </div>

                <!-- Workflow Phases Container -->
                <div class="space-y-4">
                    <!-- Phase 1: API Fetching -->
                    <div
                        class="space-y-2 relative transition-opacity duration-300"
                        :class="{ 'opacity-50': isComputingPhase || isDone }">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div v-if="state.status === 'running'" class="flex gap-1">
                                    <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                                    <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-75"></span>
                                    <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-150"></span>
                                </div>
                                <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    <template v-if="state.status === 'running'"
                                        >阶段 1/2: 遍历拉取资料与状态差分 ({{ state.done }} /
                                        {{ state.friendsTotal }}+{{ state.trackedTotal }})</template
                                    >
                                    <template v-else-if="isComputingPhase || isDone"
                                        >阶段 1/2: 全网资料差异同步已完成</template
                                    >
                                    <template v-else>阶段 1/2: 等待拉取信息差分...</template>
                                </span>
                            </div>
                            <span
                                class="text-xs font-bold font-mono"
                                :class="state.status === 'running' ? 'text-primary' : 'text-muted-foreground'"
                                >{{ fetchProgressPercent }}%</span
                            >
                        </div>
                        <Progress :model-value="fetchProgressPercent" class="h-1.5 w-full bg-secondary/50" />
                    </div>

                    <!-- Phase 2: Relationship Compute -->
                    <div
                        class="space-y-2 relative transition-opacity duration-300"
                        :class="{ 'opacity-50': isDone, 'opacity-40': !isComputingPhase && !isDone }">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div v-if="isComputingPhase" class="flex gap-1">
                                    <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                                    <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-75"></span>
                                    <span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse delay-150"></span>
                                </div>
                                <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    <template v-if="isComputingPhase"
                                        >阶段 2/2: {{ relationsStore.computingProgress.step }}...</template
                                    >
                                    <template v-else-if="isDone">阶段 2/2: 隐藏推测关系网络已生成就绪</template>
                                    <template v-else>阶段 2/2: 等待分析算力引擎启动...</template>
                                </span>
                            </div>
                            <span
                                class="text-xs font-bold font-mono"
                                :class="isComputingPhase ? 'text-primary' : 'text-muted-foreground'"
                                >{{ computeProgressPercent }}%</span
                            >
                        </div>
                        <Progress :model-value="computeProgressPercent" class="h-1.5 w-full bg-secondary/50" />
                    </div>
                </div>

                <div
                    v-if="isRunning"
                    class="text-[11px] text-center italic text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                    正在执行流水线操作中，请勿关闭弹窗以保证任务的连续性...
                </div>

                <div v-if="isDone" class="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                    <div class="flex items-center justify-between gap-3">
                        <span>{{ t(summaryKey, summaryValues) }}</span>
                        <Button
                            v-if="state.failedTargets.length"
                            variant="outline"
                            size="sm"
                            class="h-7 shrink-0"
                            @click="handleRetryFailed">
                            {{ t('view.tools.system_tools.info_completion_retry_failed') }}
                        </Button>
                    </div>
                    <div v-if="state.failureCount" class="text-muted-foreground">
                        {{ t('view.tools.system_tools.info_completion_failure_count', { count: state.failureCount }) }}
                    </div>
                </div>
            </div>

            <DialogFooter class="flex flex-row justify-between items-center sm:justify-between w-full border-t pt-4">
                <div class="flex gap-2">
                    <Button
                        v-if="!isRunning"
                        variant="default"
                        class="min-w-[120px] transition-all"
                        @click="handleStart">
                        {{
                            state.failedTargets.length
                                ? t('view.tools.system_tools.info_completion_retry_failed')
                                : isDone
                                  ? t('view.tools.system_tools.info_completion_again')
                                  : t('view.tools.system_tools.info_completion_start')
                        }}
                    </Button>
                    <Button v-else variant="destructive" class="min-w-[80px]" @click="handleCancel">
                        {{ t('view.tools.system_tools.info_completion_cancel') }}
                    </Button>
                </div>

                <Button variant="ghost" @click="isVisible = false" :disabled="isRunning">
                    {{ t('view.tools.system_tools.info_completion_close') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Button } from '@/components/ui/button';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '@/components/ui/dialog';
    import { Progress } from '@/components/ui/progress';
    import { computed, watch } from 'vue';
    import { useI18n } from 'vue-i18n';

    import {
        infoFetchState,
        runSilentInfoFetch,
        cancelInfoFetch,
        getTargetCount,
        retryFailedInfoFetch
    } from '../../../coordinators/infoFetchCoordinator';
    import { useManualRelationsStore } from '../../../stores/manualRelations';

    const props = defineProps({
        visible: {
            type: Boolean,
            required: true
        }
    });
    const emit = defineEmits(['close']);

    const { t } = useI18n();

    const state = infoFetchState;

    const isVisible = computed({
        get: () => props.visible,
        set: (v) => {
            if (!v) emit('close');
        }
    });

    const isRunning = computed(() => state.status === 'running' || state.status === 'computing');
    const isDone = computed(() => ['done', 'partial', 'failed', 'cancelled'].includes(state.status));
    const summaryKey = computed(() => {
        const keys = {
            done: 'info_completion_summary_done',
            partial: 'info_completion_summary_partial',
            failed: 'info_completion_summary_failed',
            cancelled: 'info_completion_summary_cancelled'
        };
        return `view.tools.system_tools.${keys[state.status] || keys.done}`;
    });
    const summaryValues = computed(() => ({
        processed: state.done,
        total: state.total,
        failed: state.failed
    }));

    const totalTarget = computed(() => getTargetCount());

    const isComputingPhase = computed(() => state.status === 'computing');
    const relationsStore = useManualRelationsStore();

    const fetchProgressPercent = computed(() => {
        if (state.status === 'computing' || state.status === 'done') return 100;
        if (state.total === 0) return 0;
        return Math.floor((state.done / state.total) * 100);
    });

    const computeProgressPercent = computed(() => {
        if (['done', 'partial', 'failed'].includes(state.status)) return 100;
        if (!isComputingPhase.value) return 0;
        const p = relationsStore.computingProgress;
        if (p.total === 0) return 0;
        return Math.min(100, Math.floor((p.done / p.total) * 100));
    });

    watch(isVisible, (v) => {
        if (!v && isRunning.value) {
            cancelInfoFetch();
        }
    });

    function handleStart() {
        runSilentInfoFetch();
    }

    function handleCancel() {
        cancelInfoFetch();
    }

    function handleRetryFailed() {
        retryFailedInfoFetch();
    }
</script>
