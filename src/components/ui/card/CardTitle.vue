<script setup>
    import { cn } from '@/lib/utils';

    const props = defineProps({
        class: { type: null, required: false }
    });
</script>

<template>
    <h3 data-slot="card-title" :class="cn('min-w-0 text-base leading-tight font-semibold', props.class)">
        <slot />
    </h3>
</template>
