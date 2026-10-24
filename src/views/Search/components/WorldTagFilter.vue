<template>
    <Collapsible v-model:open="expanded" class="contents">
        <CollapsibleTrigger as-child>
            <Button variant="outline" size="sm">
                <i class="ri-price-tag-3-line" aria-hidden="true" />
                {{ t('view.search.world.tags_label') }}
                <span v-if="modelValue.trim()" class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                <i class="ri-arrow-down-s-line" :class="{ 'rotate-180': expanded }" aria-hidden="true" />
            </Button>
        </CollapsibleTrigger>
        <CollapsibleContent class="basis-full rounded-lg border bg-muted/20 p-3 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium">{{ t('view.search.world.tags_label') }}</span>
                <InputGroupField
                    :model-value="modelValue"
                    :placeholder="t('view.search.world.tags_placeholder')"
                    :aria-label="t('view.search.world.tags_label')"
                    class="min-w-48 flex-1"
                    clearable
                    @input="$emit('update:modelValue', $event)"
                    @keyup.enter="$emit('search')" />
                <Button variant="outline" @click="$emit('search')">{{ t('view.search.world.search_tags') }}</Button>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
                <span class="mr-1 text-xs text-muted-foreground">{{ t('view.search.world.common_tags') }}</span>
                <Button
                    v-for="tag in presets"
                    :key="tag"
                    variant="ghost"
                    size="sm"
                    :title="tag"
                    @click="selectTag(tag)">
                    {{ t(`view.search.world.tag_presets.${tag}`) }}
                </Button>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('view.search.world.tags_hint') }}</p>
        </CollapsibleContent>
    </Collapsible>
</template>

<script setup>
    import { useI18n } from 'vue-i18n';
    import { ref } from 'vue';
    import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
    import { Button } from '@/components/ui/button';
    import { InputGroupField } from '@/components/ui/input-group';
    defineProps({ modelValue: { type: String, default: '' } });
    const emit = defineEmits(['update:modelValue', 'search']);
    const { t } = useI18n();
    const expanded = ref(false);
    const presets = ['social', 'game', 'chill', 'sleep', 'avatar', 'music'];
    function selectTag(tag) {
        emit('update:modelValue', tag);
        emit('search');
    }
</script>
