<script setup>
    import { computed } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { Button } from '@/components/ui/button';

    const props = defineProps({
        modelValue: { type: String, default: '#ffffff' },
        label: { type: String, default: null },
        disabled: { type: Boolean, default: false },
        clearable: { type: Boolean, default: false },
        emptyValue: { type: String, default: '#ffffff' }
    });

    const emit = defineEmits(['update:modelValue', 'change']);
    const { t } = useI18n();

    const color = computed(() => {
        const value = String(props.modelValue || '').trim();
        return /^#[0-9a-f]{6}$/i.test(value) ? value : props.emptyValue;
    });

    function updateColor(event) {
        const value = event.target.value;
        emit('update:modelValue', value);
        emit('change', value);
    }

    function clearColor(event) {
        event.stopPropagation();
        if (!props.disabled && props.clearable) {
            emit('update:modelValue', props.emptyValue);
            emit('change', props.emptyValue);
        }
    }
</script>

<template>
    <Button variant="outline" size="sm" class="relative inline-flex items-center gap-2 px-2" :disabled="disabled">
        <span class="size-4 rounded-sm border border-border shadow-inner" :style="{ backgroundColor: color }" />
        <span class="text-xs font-mono uppercase">{{ label || color }}</span>
        <span
            v-if="clearable && modelValue"
            role="button"
            tabindex="0"
            class="ml-1 text-muted-foreground hover:text-foreground"
            :aria-label="t('common.actions.delete')"
            @click="clearColor">
            ×
        </span>
        <input
            class="absolute inset-0 cursor-pointer opacity-0"
            type="color"
            :value="color"
            :disabled="disabled"
            :aria-label="label || t('dialog.edit_profile.color')"
            @input="updateColor" />
    </Button>
</template>
