<template>
    <Dialog v-model:open="isOpen">
        <DialogContent class="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
                <DialogTitle>{{ t('view.charts.mutual_friend.manual_relations.dialog_title') }}</DialogTitle>
            </DialogHeader>

            <Tabs default-value="list" class="flex-1 flex flex-col overflow-hidden">
                <TabsList class="grid w-full grid-cols-2">
                    <TabsTrigger value="list">{{
                        t('view.charts.mutual_friend.manual_relations.tab_list')
                    }}</TabsTrigger>
                    <TabsTrigger value="suggest">{{
                        t('view.charts.mutual_friend.manual_relations.tab_suggest')
                    }}</TabsTrigger>
                </TabsList>

                <!-- List Tab -->
                <TabsContent value="list" class="flex-1 flex flex-col gap-4 mt-4 overflow-hidden">
                    <!-- Manual Add Form -->
                    <div class="flex flex-col gap-3 rounded-md border-0 bg-muted/30 p-4">
                        <div class="grid grid-cols-2 gap-4">
                            <Field>
                                <FieldLabel>{{ t('view.charts.mutual_friend.manual_relations.user_a') }}</FieldLabel>
                                <FieldContent>
                                    <VirtualCombobox
                                        v-model="selectedUserA"
                                        :groups="friendPickerGroups"
                                        :placeholder="t('view.charts.mutual_friend.manual_relations.user_placeholder')"
                                        searchable>
                                        <template #item="{ item, selected }">
                                            <UserPickerItem :item="item" :selected="selected" />
                                        </template>
                                    </VirtualCombobox>
                                </FieldContent>
                            </Field>
                            <Field>
                                <FieldLabel>{{ t('view.charts.mutual_friend.manual_relations.user_b') }}</FieldLabel>
                                <FieldContent>
                                    <VirtualCombobox
                                        v-model="selectedUserB"
                                        :groups="friendPickerGroups"
                                        :placeholder="t('view.charts.mutual_friend.manual_relations.user_placeholder')"
                                        searchable>
                                        <template #item="{ item, selected }">
                                            <UserPickerItem :item="item" :selected="selected" />
                                        </template>
                                    </VirtualCombobox>
                                </FieldContent>
                            </Field>
                        </div>
                        <div class="flex items-center justify-between">
                            <span v-if="addError" class="text-xs text-destructive">{{ addError }}</span>
                            <div v-else></div>
                            <Button :disabled="!canAdd" @click="addRelation">
                                {{ t('view.charts.mutual_friend.manual_relations.add_button') }}
                            </Button>
                        </div>
                    </div>

                    <!-- Relations List -->
                    <div class="flex-1 overflow-y-auto pr-2">
                        <div
                            v-if="enrichedRelations.length === 0"
                            class="text-center py-8 text-muted-foreground italic">
                            {{ t('view.charts.mutual_friend.manual_relations.list_empty') }}
                        </div>
                        <div v-else class="flex flex-col gap-2">
                            <div
                                v-for="rel in enrichedRelations"
                                :key="`${rel.userIdA}-${rel.userIdB}`"
                                class="flex items-center justify-between rounded-md border-0 bg-card p-3 shadow-sm">
                                <div class="flex items-center gap-3 overflow-hidden">
                                    <button
                                        class="font-medium underline underline-offset-2 truncate hover:text-primary transition-colors"
                                        @click="showUserDialog(rel.userIdA)">
                                        {{ rel.nameA }}
                                    </button>
                                    <span class="text-muted-foreground shrink-0 text-xs">↔</span>
                                    <button
                                        class="font-medium underline underline-offset-2 truncate hover:text-primary transition-colors"
                                        @click="showUserDialog(rel.userIdB)">
                                        {{ rel.nameB }}
                                    </button>
                                </div>
                                <div class="flex items-center gap-4 shrink-0">
                                    <Tooltip v-if="rel.suggestion">
                                        <TooltipTrigger>
                                            <div
                                                class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                {{ rel.suggestion.displayScore }}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <pre class="text-xs font-sans whitespace-pre-wrap leading-relaxed">{{
                                                rel.suggestion.tooltip
                                            }}</pre>
                                        </TooltipContent>
                                    </Tooltip>
                                    <span class="text-[11px] text-muted-foreground">{{ formatDate(rel.addedAt) }}</span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        class="h-8 w-8 text-destructive hover:bg-destructive/10"
                                        @click="deleteRelation(rel.userIdA, rel.userIdB)">
                                        <Trash2 class="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <!-- Suggest Tab -->
                <TabsContent value="suggest" class="flex-1 flex flex-col gap-4 mt-4 overflow-hidden">
                    <div class="flex flex-col gap-3 shrink-0">
                        <p class="text-sm text-muted-foreground">
                            {{ t('view.charts.mutual_friend.manual_relations.suggest_description') }}
                        </p>
                        <Button :disabled="isSuggesting" @click="runSuggestion">
                            <Spinner v-if="isSuggesting" class="mr-2" />
                            {{ t('view.charts.mutual_friend.manual_relations.suggest_button') }}
                        </Button>
                    </div>

                    <div class="flex-1 overflow-y-auto pr-2 pb-4">
                        <div v-if="suggestions.length > 0" class="flex flex-col gap-1 mt-2">
                            <div
                                class="flex items-center gap-3 px-2 text-[10px] text-muted-foreground font-bold opacity-70 sticky top-0 bg-background z-10 py-1">
                                <div class="flex-1 min-w-0">关系人</div>
                                <div class="w-[60px] text-right">得分</div>
                                <div class="w-[60px]"></div>
                            </div>
                            <div
                                v-for="s in suggestions"
                                :key="s.key"
                                class="flex items-center gap-3 p-2 hover:bg-accent/50 rounded-lg group">
                                <div class="flex-1 flex items-center gap-1 text-sm overflow-hidden min-w-0">
                                    <button
                                        class="underline underline-offset-2 truncate hover:text-primary max-w-[140px]"
                                        @click="showUserDialog(s.userIdA)">
                                        {{ s.nameA }}
                                    </button>
                                    <span class="text-muted-foreground shrink-0">↔</span>
                                    <button
                                        class="underline underline-offset-2 truncate hover:text-primary max-w-[140px]"
                                        @click="showUserDialog(s.userIdB)">
                                        {{ s.nameB }}
                                    </button>
                                </div>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            class="text-[14px] font-mono font-medium text-foreground shrink-0 cursor-help w-[60px] text-right">
                                            {{ s.displayScore }}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <pre class="text-xs font-sans whitespace-pre-wrap leading-relaxed">{{
                                            s.tooltip
                                        }}</pre>
                                    </TooltipContent>
                                </Tooltip>
                                <Button
                                    v-if="!s.isAdded"
                                    size="sm"
                                    variant="outline"
                                    class="w-[60px] h-8"
                                    @click="confirmSuggestion(s)">
                                    添加
                                </Button>
                                <div
                                    v-else
                                    class="text-xs text-muted-foreground w-[60px] flex items-center justify-center">
                                    <CheckIcon class="w-3 h-3 mr-1" /> 已记录
                                </div>
                            </div>
                        </div>
                        <div v-else-if="hasSuggested && !isSuggesting" class="text-sm text-muted-foreground mt-2">
                            没有找到合适的推荐配对。尝试去抓取更多共同好友数据，或在更多房间产生日志记录。
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { Badge } from '@/components/ui/badge';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
    import { Spinner } from '@/components/ui/spinner';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
    import { VirtualCombobox } from '@/components/ui/virtual-combobox';
    import { Check as CheckIcon, Trash2 } from 'lucide-vue-next';
    import { computed, defineComponent, h, ref } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import dayjs from 'dayjs';

    import { useManualRelationsStore } from '../../../stores/manualRelations';
    import { useFriendStore, useTrackedNonFriendsStore, useUserStore } from '../../../stores';
    import { database } from '../../../services/database';
    import { showUserDialog } from '../../../coordinators/userCoordinator';
    import { parseLocation } from '../../../shared/utils/locationParser';

    const isOpen = defineModel('open', { type: Boolean, default: false });
    const { t } = useI18n();

    const manualRelationsStore = useManualRelationsStore();
    const { relationsList } = storeToRefs(manualRelationsStore);

    const friendStore = useFriendStore();
    const userStore = useUserStore();
    const trackedStore = useTrackedNonFriendsStore();
    const { friends } = storeToRefs(friendStore);
    const { trackedList } = storeToRefs(trackedStore);
    const { currentUser } = storeToRefs(userStore);
    const cachedUsers = userStore.cachedUsers;

    // ---- User picker helper component ----
    const UserPickerItem = defineComponent({
        props: { item: Object, selected: Boolean },
        render() {
            const { item, selected } = this;
            return h('div', { class: 'flex w-full items-center p-1.5 text-[13px]' }, [
                h('div', { class: 'flex-1 overflow-hidden' }, [
                    h('span', { class: 'block truncate font-medium' }, item?.label || '')
                ]),
                h(CheckIcon, { class: ['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0'] })
            ]);
        }
    });

    // ---- Picker groups (friends + tracked users) ----
    const friendPickerGroups = computed(() => {
        const items = [];
        const seenIds = new Set();

        // 1. Friends
        for (const [id, ctx] of friends.value.entries()) {
            const displayName = ctx.ref?.displayName || ctx.name || id;
            items.push({ value: id, label: displayName, search: displayName });
            seenIds.add(id);
        }

        // 2. Tracked Non-Friends
        for (const item of trackedList.value) {
            if (!seenIds.has(item.userId)) {
                const displayName = item.displayName || item.userId;
                items.push({ value: item.userId, label: displayName, search: displayName });
                seenIds.add(item.userId);
            }
        }

        items.sort((a, b) => a.label.localeCompare(b.label));
        return [{ key: 'users', label: '全部追踪目标', items }];
    });

    // ---- Enrich relation list with display names ----
    const enrichedRelations = computed(() =>
        relationsList.value.map((r) => {
            const key = manualRelationsStore.pairKey(r.userIdA, r.userIdB);
            const suggestion = manualRelationsStore.cachedSuggestions.find((s) => s.key === key);
            return {
                ...r,
                nameA: cachedUsers.get(r.userIdA)?.displayName || r.userIdA,
                nameB: cachedUsers.get(r.userIdB)?.displayName || r.userIdB,
                suggestion
            };
        })
    );

    function formatDate(iso) {
        return iso ? dayjs(iso).format('YYYY-MM-DD') : '';
    }

    // ---- Add relation ----
    const selectedUserA = ref(null);
    const selectedUserB = ref(null);
    const addError = ref('');

    const canAdd = computed(
        () => selectedUserA.value && selectedUserB.value && selectedUserA.value !== selectedUserB.value
    );

    async function addRelation() {
        addError.value = '';
        if (!canAdd.value) return;
        if (manualRelationsStore.isManualRelation(selectedUserA.value, selectedUserB.value)) {
            addError.value = t('view.charts.mutual_friend.manual_relations.already_exists');
            return;
        }
        await manualRelationsStore.addManualRelation(selectedUserA.value, selectedUserB.value, 'friend');
        selectedUserA.value = null;
        selectedUserB.value = null;
    }

    async function deleteRelation(idA, idB) {
        await manualRelationsStore.removeManualRelation(idA, idB);
    }

    const suggestions = computed(() => {
        return manualRelationsStore.cachedSuggestions.filter(
            (s) => !s.isAdded && !manualRelationsStore.ignoredSuggestionKeys.has(s.key)
        );
    });
    const isSuggesting = ref(false);
    const hasSuggested = ref(false);

    async function runSuggestion() {
        isSuggesting.value = true;
        hasSuggested.value = false;
        try {
            await manualRelationsStore.computeSuggestions();
        } finally {
            isSuggesting.value = false;
            hasSuggested.value = true;
        }
    }

    function dismissSuggestion(s) {
        manualRelationsStore.ignoreSuggestion(s.key);
    }

    async function confirmSuggestion(s) {
        await manualRelationsStore.addManualRelation(s.userIdA, s.userIdB, 'friend');
        manualRelationsStore.ignoreSuggestion(s.key);
    }
</script>
