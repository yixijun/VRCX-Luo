<template>
    <Dialog :open="visible" @update:open="(open) => (open ? null : emit('close'))">
        <DialogContent class="sm:max-w-180">
            <DialogHeader>
                <DialogTitle class="flex items-center gap-2">
                    <span>{{ t('view.tools.system_tools.memory_cleanup') }}</span>
                    <TooltipWrapper
                        side="right"
                        :content="t('view.tools.system_tools.memory_cleanup_16gb_notice')">
                        <span
                            class="inline-flex size-5 items-center justify-center rounded-full border border-muted-foreground/40 text-xs text-muted-foreground">
                            !
                        </span>
                    </TooltipWrapper>
                </DialogTitle>
            </DialogHeader>

            <div class="space-y-4">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div class="rounded-md border bg-muted/20 p-3">
                        <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{{ t('view.tools.system_tools.memory_cleanup_load') }}</span>
                            <span>{{ memoryLoadPercent }}%</span>
                        </div>
                        <Progress :model-value="memoryLoadPercent" class="mt-3 h-2" />
                        <div class="mt-2 text-sm font-medium">
                            {{ formatBytes(snapshot?.MemoryLoadBytes) }} /
                            {{ formatBytes(snapshot?.TotalAvailableMemoryBytes) }}
                        </div>
                    </div>
                    <div class="rounded-md border bg-muted/20 p-3">
                        <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{{ t('view.tools.system_tools.memory_cleanup_available') }}</span>
                            <span>{{ availableMemoryPercent }}%</span>
                        </div>
                        <Progress :model-value="availableMemoryPercent" class="mt-3 h-2" />
                        <div class="mt-2 text-sm font-medium">{{ formatBytes(availableMemoryBytes) }}</div>
                    </div>
                    <div class="rounded-md border bg-muted/20 p-3">
                        <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{{ t('view.tools.system_tools.memory_cleanup_target_total') }}</span>
                            <span>{{ targetProcessPercent }}%</span>
                        </div>
                        <Progress :model-value="targetProcessPercent" class="mt-3 h-2" />
                        <div class="mt-2 text-sm font-medium">
                            {{ formatBytes(snapshot?.TargetProcessWorkingSetBytes) }}
                        </div>
                    </div>
                </div>

                <Alert v-if="result">
                    <AlertTitle>{{ t('view.tools.system_tools.memory_cleanup_result') }}</AlertTitle>
                    <AlertDescription>
                        {{
                            t('view.tools.system_tools.memory_cleanup_freed', {
                                size: formatBytes(result.FreedBytes)
                            })
                        }}
                        <Progress :model-value="freedMemoryPercent" class="mt-3 h-2" />
                        <div v-if="result.Deep?.Operations?.length" class="mt-3 space-y-1">
                            <div
                                v-for="operation in result.Deep.Operations"
                                :key="`${operation.Kind}-${operation.Name}`"
                                class="flex items-center justify-between gap-3 text-xs">
                                <span class="text-muted-foreground">
                                    {{ operationLabel(operation.Name) }}
                                </span>
                                <span :class="operation.Ok ? 'text-emerald-500' : 'text-destructive'">
                                    {{
                                        operation.Ok
                                            ? t('view.tools.system_tools.memory_cleanup_operation_ok')
                                            : t('view.tools.system_tools.memory_cleanup_operation_failed')
                                    }}
                                </span>
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>

                <div class="max-h-72 overflow-auto rounded-md border">
                    <table class="w-full text-sm">
                        <thead class="sticky top-0 bg-background">
                            <tr class="border-b">
                                <th class="px-3 py-2 text-left font-medium">
                                    {{ t('view.tools.system_tools.memory_cleanup_process') }}
                                </th>
                                <th class="px-3 py-2 text-right font-medium">
                                    {{ t('view.tools.system_tools.memory_cleanup_working_set') }}
                                </th>
                                <th class="px-3 py-2 text-right font-medium">
                                    {{ t('view.tools.system_tools.memory_cleanup_private') }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="process in snapshot?.Processes || []" :key="`${process.Name}-${process.Id}`" class="border-b">
                                <td class="px-3 py-2">
                                    <div class="font-medium">{{ process.Name }}</div>
                                    <div class="text-xs text-muted-foreground">PID {{ process.Id }}</div>
                                </td>
                                <td class="px-3 py-2 text-right">{{ formatBytes(process.WorkingSetBytes) }}</td>
                                <td class="px-3 py-2 text-right">{{ formatBytes(process.PrivateMemoryBytes) }}</td>
                            </tr>
                            <tr v-if="!loading && !(snapshot?.Processes || []).length">
                                <td colspan="3" class="px-3 py-6 text-center text-muted-foreground">
                                    {{ t('view.tools.system_tools.memory_cleanup_empty') }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p class="text-xs text-muted-foreground">
                    {{ t('view.tools.system_tools.memory_cleanup_notice') }}
                </p>
            </div>

            <DialogFooter>
                <Button variant="secondary" :disabled="loading" @click="refreshSnapshot">
                    {{ t('common.actions.refresh') }}
                </Button>
                <Button :disabled="loading" @click="cleanup(false)">
                    {{ t('view.tools.system_tools.memory_cleanup_run') }}
                </Button>
                <Button
                    variant="destructive"
                    :disabled="loading"
                    :title="deepCleanupTitle"
                    @click="handleDeepCleanup">
                    {{ deepCleanupLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';

    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Progress } from '@/components/ui/progress';
    import { TooltipWrapper } from '@/components/ui/tooltip';

    const props = defineProps({
        visible: { type: Boolean, default: false }
    });

    const emit = defineEmits(['close']);

    const { t } = useI18n();
    const loading = ref(false);
    const snapshot = ref(null);
    const result = ref(null);

    const memoryLoadPercent = computed(() =>
        percent(snapshot.value?.MemoryLoadBytes, snapshot.value?.TotalAvailableMemoryBytes)
    );
    const availableMemoryBytes = computed(() =>
        Math.max(0, Number(snapshot.value?.TotalAvailableMemoryBytes || 0) - Number(snapshot.value?.MemoryLoadBytes || 0))
    );
    const availableMemoryPercent = computed(() =>
        Math.max(0, 100 - memoryLoadPercent.value)
    );
    const targetProcessPercent = computed(() =>
        percent(snapshot.value?.TargetProcessWorkingSetBytes, snapshot.value?.TotalAvailableMemoryBytes)
    );
    const freedMemoryPercent = computed(() =>
        percent(result.value?.FreedBytes, result.value?.Before?.TargetProcessWorkingSetBytes)
    );
    const isAdministrator = computed(() => Boolean(snapshot.value?.IsAdministrator));
    const deepCleanupLabel = computed(() =>
        isAdministrator.value
            ? t('view.tools.system_tools.memory_cleanup_deep_run')
            : t('view.tools.system_tools.memory_cleanup_request_admin')
    );
    const deepCleanupTitle = computed(() =>
        isAdministrator.value
            ? t('view.tools.system_tools.memory_cleanup_deep_tooltip')
            : t('view.tools.system_tools.memory_cleanup_request_admin_tooltip')
    );

    function parseApiJson(value) {
        if (!value) {
            return null;
        }
        return typeof value === 'string' ? JSON.parse(value) : value;
    }

    function formatBytes(value) {
        const bytes = Number(value || 0);
        if (!bytes) {
            return '0 MB';
        }
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / 1024 ** index).toFixed(index < 2 ? 0 : 1)} ${units[index]}`;
    }

    function percent(value, total) {
        const numerator = Number(value || 0);
        const denominator = Number(total || 0);
        if (!numerator || !denominator) {
            return 0;
        }
        return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
    }

    function operationLabel(name) {
        return t(`view.tools.system_tools.memory_cleanup_operation_${name}`);
    }

    async function refreshSnapshot() {
        loading.value = true;
        try {
            snapshot.value = parseApiJson(await AppApi.GetMemoryCleanupSnapshot());
        } catch (err) {
            console.error(err);
            toast.error(t('view.tools.system_tools.memory_cleanup_failed'));
        } finally {
            loading.value = false;
        }
    }

    async function cleanup(deep) {
        loading.value = true;
        try {
            result.value = parseApiJson(await AppApi.CleanupMemory(deep));
            snapshot.value = result.value?.After || snapshot.value;
            toast.success(t('view.tools.system_tools.memory_cleanup_done'));
        } catch (err) {
            console.error(err);
            toast.error(t('view.tools.system_tools.memory_cleanup_failed'));
        } finally {
            loading.value = false;
        }
    }

    async function handleDeepCleanup() {
        if (isAdministrator.value) {
            await cleanup(true);
            return;
        }

        loading.value = true;
        try {
            const ok = await AppApi.RestartAsAdministrator();
            if (!ok) {
                toast.error(t('view.tools.system_tools.memory_cleanup_admin_failed'));
            }
        } catch (err) {
            console.error(err);
            toast.error(t('view.tools.system_tools.memory_cleanup_admin_failed'));
        } finally {
            loading.value = false;
        }
    }

    watch(
        () => props.visible,
        (visible) => {
            if (visible) {
                result.value = null;
                refreshSnapshot();
            }
        },
        { immediate: true }
    );
</script>
