<template>
    <nav class="wrist-page-tabs" aria-label="Wrist pages">
        <button
            v-for="page in pages"
            :key="page.id"
            class="wrist-page-tab"
            :class="{ active: modelValue === page.id }"
            :data-vr-action="`wrist-page-${page.id}`"
            type="button"
            :aria-label="page.label"
            :title="page.label"
            :aria-current="modelValue === page.id ? 'page' : undefined"
            @click="$emit('update:modelValue', page.id)">
            <component :is="page.icon" :size="16" :stroke-width="2.2" aria-hidden="true" />
        </button>
    </nav>
</template>

<script setup>
    import { Activity, Cpu, Rss } from 'lucide-vue-next';

    defineProps({
        modelValue: {
            type: String,
            default: 'feed'
        }
    });

    defineEmits(['update:modelValue']);

    const pages = [
        { id: 'feed', label: 'Feed', icon: Rss },
        { id: 'devices', label: 'Devices', icon: Cpu },
        { id: 'status', label: 'Status', icon: Activity }
    ];
</script>

<style scoped>
    .wrist-page-tabs {
        display: flex;
        flex: 0 0 29px;
        align-items: center;
        gap: 3px;
        padding: 3px 6px;
        border-bottom: 1px solid var(--vr-border);
        background: rgba(39, 39, 42, 0.72);
    }

    .wrist-page-tab {
        display: inline-flex;
        flex: 1 1 0;
        align-items: center;
        justify-content: center;
        min-width: 0;
        height: 22px;
        padding: 0;
        color: var(--vr-text-muted);
        border: 1px solid transparent;
        border-radius: 5px;
        background: transparent;
        cursor: pointer;
        transition:
            color 120ms ease,
            background 120ms ease,
            border-color 120ms ease;
    }

    .wrist-page-tab:hover,
    .wrist-page-tab:focus-visible {
        color: var(--vr-text);
        border-color: var(--vr-border-strong);
        background: rgba(255, 255, 255, 0.08);
        outline: none;
    }

    .wrist-page-tab.active {
        color: var(--vr-text);
        border-color: rgba(0, 184, 255, 0.45);
        background: rgba(0, 184, 255, 0.16);
        box-shadow: inset 0 -1px 0 var(--status-joinme);
    }
</style>
