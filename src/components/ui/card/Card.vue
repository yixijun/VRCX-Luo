<script setup>
    import { cn } from '@/lib/utils';

    const props = defineProps({
        class: { type: null, required: false }
    });
</script>

<template>
    <div
        data-slot="card"
        :class="cn('bg-card text-card-foreground flex min-w-0 flex-col gap-4 rounded-lg border-0 py-4', props.class)">
        <slot />
    </div>
</template>
