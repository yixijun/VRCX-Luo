<script setup>
    import { cn } from '@/lib/utils';

    const props = defineProps({
        class: { type: null, required: false }
    });
</script>

<template>
    <div
        data-slot="card-footer"
        :class="cn('flex min-w-0 flex-wrap items-center gap-2 px-4 [.border-t]:pt-4', props.class)">
        <slot />
    </div>
</template>
