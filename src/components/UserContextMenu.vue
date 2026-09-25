<template>
    <ContextMenu>
        <ContextMenuTrigger as-child>
            <slot />
        </ContextMenuTrigger>
        <UserContextMenuContent :user-id="userId" :state="state" :location="location">
            <template v-if="$slots.append" #append>
                <slot name="append" />
            </template>
        </UserContextMenuContent>
    </ContextMenu>
</template>

<script setup>
    import { ContextMenu, ContextMenuTrigger } from './ui/context-menu';
    import UserContextMenuContent from './UserContextMenuContent.vue';

    defineProps({
        userId: {
            type: String,
            required: true
        },
        state: {
            type: String,
            default: ''
        },
        location: {
            type: String,
            default: ''
        }
    });
</script>
