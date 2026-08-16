<script setup>
    import { computed, useAttrs } from 'vue';
    import { cn } from '@/lib/utils';
    import { useVModel } from '@vueuse/core';

    const props = defineProps({
        class: { type: null, required: false },
        defaultValue: { type: [String, Number], required: false },
        modelValue: { type: [String, Number], required: false }
    });

    const emits = defineEmits(['update:modelValue']);
    const attrs = useAttrs();

    const modelValue = useVModel(props, 'modelValue', emits, {
        passive: true,
        defaultValue: props.defaultValue
    });

    const autosizeClass = computed(() => {
        const raw = attrs['data-autosize'];
        const isAutosize = raw === '' || raw === true || raw === 'true';
        return isAutosize ? 'field-sizing-content' : '[field-sizing:fixed]';
    });
</script>

<template>
    <textarea
        v-model="modelValue"
        data-slot="textarea"
        :class="
            cn(
                'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-20 w-full rounded-md border bg-background/70 px-3 py-2 text-base leading-relaxed shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 outline-none hover:border-ring/40 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                autosizeClass,
                props.class
            )
        " />
</template>
