<template>
    <span class="inline-flex min-w-0 items-center gap-1.5 align-middle cursor-pointer" @click="openUserDialog">
        <Avatar v-if="userImageUrl" class="size-5 shrink-0">
            <AvatarImage :src="userImageUrl" class="object-cover" />
            <AvatarFallback>
                <User class="size-3 text-muted-foreground" />
            </AvatarFallback>
        </Avatar>
        <span class="min-w-0 truncate">{{ username }}</span>
    </span>
</template>

<script setup>
    import { ref, watch } from 'vue';
    import { User } from 'lucide-vue-next';

    import { queryRequest } from '../api';
    import { showUserDialog } from '../coordinators/userCoordinator';
    import { useUserDisplay } from '../composables/useUserDisplay';
    import { getUserIdentity } from '../composables/useUserIdentityDisplay';
    import { useFriendStore, useUserStore } from '../stores';
    import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

    const props = defineProps({
        userid: String,
        location: String,
        forceUpdateKey: Number,
        user: {
            type: Object,
            default: null
        },
        image: {
            type: String,
            default: ''
        },
        hint: {
            type: String,
            default: ''
        }
    });

    const username = ref(props.userid);
    const userImageUrl = ref('');
    const { userImage } = useUserDisplay();
    const userStore = useUserStore();
    const friendStore = useFriendStore();

    /**
     *
     */
    async function parse() {
        const cachedUser =
            props.user ||
            userStore.cachedUsers.get(props.userid) ||
            friendStore.friends.get(props.userid)?.ref ||
            null;
        const identity = getUserIdentity({
            user: cachedUser,
            userId: props.userid,
            displayName: props.hint,
            imageUrl: props.image,
            imageResolver: userImage
        });

        username.value = identity.displayName;
        userImageUrl.value = identity.imageUrl;

        if (props.hint || cachedUser?.displayName) {
            return;
        } else if (props.userid) {
            const args = await queryRequest.fetch('user.dialog', { userId: props.userid });
            const fetchedIdentity = getUserIdentity({
                user: args?.json,
                userId: props.userid,
                imageUrl: userImageUrl.value,
                imageResolver: userImage
            });
            username.value = fetchedIdentity.displayName;
            userImageUrl.value = fetchedIdentity.imageUrl;
        }
    }

    /**
     *
     */
    function openUserDialog() {
        showUserDialog(props.userid);
    }

    watch([() => props.userid, () => props.location, () => props.forceUpdateKey, () => props.user, () => props.image], parse, { immediate: true });
</script>
