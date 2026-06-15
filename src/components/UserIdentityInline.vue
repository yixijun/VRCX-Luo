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
    import { computed, watch } from 'vue';
    import { User } from 'lucide-vue-next';

    import {
        hydrateUserIdentity,
        shouldHydrateUserIdentity
    } from '../composables/useUserIdentityHydration';
    import { getUserIdentity } from '../composables/useUserIdentityDisplay';
    import { useUserDisplay } from '../composables/useUserDisplay';
    import { useFriendStore, useUserStore } from '../stores';
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
        },
        hydrateMissing: {
            type: Boolean,
            default: true
        }
    });

    const userStore = useUserStore();
    const friendStore = useFriendStore();
    const { userImage } = useUserDisplay();

    const resolvedUser = computed(() => {
        if (props.user) {
            return props.user;
        }
        if (props.userId) {
            return userStore.cachedUsers.get(props.userId) || friendStore.friends.get(props.userId)?.ref || null;
        }
        if (props.displayName) {
            const userIds = userStore.cachedUserIdsByDisplayName?.get(props.displayName);
            const firstUserId = userIds?.values?.().next?.().value;
            if (firstUserId) {
                return userStore.cachedUsers.get(firstUserId) || friendStore.friends.get(firstUserId)?.ref || null;
            }
            for (const friend of friendStore.friends.values()) {
                if (friend?.ref?.displayName === props.displayName || friend?.name === props.displayName) {
                    return friend.ref || null;
                }
            }
        }
        return null;
    });

    const resolvedImageResolver = computed(() => props.imageResolver || userImage);

    const identity = computed(() =>
        getUserIdentity({
            user: resolvedUser.value,
            userId: props.userId,
            displayName: props.displayName,
            imageUrl: props.imageUrl,
            imageResolver: resolvedImageResolver.value
        })
    );

    function hydrateMissingIdentity() {
        if (!props.hydrateMissing) {
            return;
        }
        const userId = props.userId || resolvedUser.value?.id || '';
        if (
            shouldHydrateUserIdentity({
                user: resolvedUser.value,
                userId,
                imageUrl: props.imageUrl,
                imageResolver: resolvedImageResolver.value
            })
        ) {
            hydrateUserIdentity(userId);
        }
    }

    watch(
        () => [
            props.userId,
            props.imageUrl,
            identity.value.imageUrl,
            resolvedUser.value?.id,
            resolvedUser.value?.profilePicOverrideThumbnail,
            resolvedUser.value?.currentAvatarThumbnailImageUrl,
            resolvedUser.value?.userIcon
        ],
        hydrateMissingIdentity,
        { immediate: true, flush: 'post' }
    );
</script>
