<template>
    <span class="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
        <Avatar :class="['shrink-0 rounded-full', avatarClass]">
            <AvatarImage :src="identity.imageUrl" :class="avatarImageClass" loading="lazy" />
            <AvatarFallback>
                <User class="size-3 text-muted-foreground" />
            </AvatarFallback>
        </Avatar>
        <span class="min-w-0 truncate" :class="nameClass" :style="nameStyle">
            {{ identity.displayName }}
        </span>
        <slot />
    </span>
</template>

<script setup>
    import { computed } from 'vue';
    import { User } from 'lucide-vue-next';

    import { getUserIdentity } from '../composables/useUserIdentityDisplay';
    import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

    const props = defineProps({
        user: {
            type: Object,
            default: null
        },
        userId: {
            type: String,
            default: ''
        },
        displayName: {
            type: String,
            default: ''
        },
        imageUrl: {
            type: String,
            default: ''
        },
        imageResolver: {
            type: Function,
            default: null
        },
        nameClass: {
            type: [String, Array, Object],
            default: ''
        },
        nameStyle: {
            type: [String, Object, Array],
            default: null
        },
        avatarClass: {
            type: [String, Array, Object],
            default: 'size-5'
        },
        avatarImageClass: {
            type: [String, Array, Object],
            default: 'object-cover'
        }
    });

    const identity = computed(() =>
        getUserIdentity({
            user: props.user,
            userId: props.userId,
            displayName: props.displayName,
            imageUrl: props.imageUrl,
            imageResolver: props.imageResolver
        })
    );
</script>
