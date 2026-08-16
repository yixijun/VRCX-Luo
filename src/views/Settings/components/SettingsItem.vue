<template>
    <div class="settings-item min-h-9 min-w-0 py-1">
        <div class="flex flex-col gap-0.5 min-w-0 flex-1">
            <span class="text-sm leading-snug font-medium text-foreground">{{ label }}</span>
            <span v-if="description" class="text-xs leading-relaxed text-muted-foreground">{{ description }}</span>
        </div>
        <div class="settings-item-control flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
            <slot />
        </div>
    </div>
</template>

<script setup>
    defineProps({
        label: { type: String, required: true },
        description: { type: String, default: '' }
    });
</script>

<style scoped>
    .settings-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem 1.5rem;
    }

    @container settings-group (max-width: 30rem) {
        .settings-item {
            grid-template-columns: minmax(0, 1fr);
            align-items: start;
        }

        .settings-item-control {
            width: 100%;
            justify-content: flex-start;
        }
    }
</style>
