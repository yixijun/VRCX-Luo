<template>
    <div class="user-resource-search">
        <Search class="user-resource-search__icon" aria-hidden="true" />
        <Input
            :model-value="modelValue"
            class="user-resource-search__input"
            :placeholder="placeholder"
            :aria-label="placeholder"
            @update:model-value="emit('update:modelValue', $event)"
            @click.stop />
    </div>
</template>

<script setup>
    import { Search } from 'lucide-vue-next';
    import { Input } from '@/components/ui/input';

    defineProps({
        modelValue: {
            type: String,
            default: ''
        },
        placeholder: {
            type: String,
            required: true
        }
    });

    const emit = defineEmits(['update:modelValue']);
</script>

<style scoped>
    .user-resource-search {
        position: relative;
        min-width: min(100%, 12rem);
        flex: 1 1 13rem;
        max-width: 20rem;
    }

    .user-resource-search__icon {
        position: absolute;
        top: 50%;
        left: 0.75rem;
        z-index: 1;
        width: 1rem;
        height: 1rem;
        transform: translateY(-50%);
        color: var(--muted-foreground);
        pointer-events: none;
    }

    .user-resource-search__input {
        height: 2.25rem;
        padding-left: 2.25rem;
        font-size: 0.875rem;
    }

    @media (max-width: 42rem) {
        .user-resource-search {
            max-width: none;
        }
    }
</style>
