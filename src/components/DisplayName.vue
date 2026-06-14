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
    import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

    const props = defineProps({
        userid: String,
        location: String,
        forceUpdateKey: Number,
        hint: {
            type: String,
            default: ''
        }
    });

    const username = ref(props.userid);
    const userImageUrl = ref('');
    const { userImage } = useUserDisplay();

    /**
     *
     */
    async function parse() {
        username.value = props.userid;
        userImageUrl.value = '';
        if (props.hint) {
            username.value = props.hint;
        } else if (props.userid) {
            const args = await queryRequest.fetch('user.dialog', { userId: props.userid });
            if (args?.json?.displayName) {
                username.value = args.json.displayName;
            }
            userImageUrl.value = userImage(args?.json, true, '64');
        }
    }

    /**
     *
     */
    function openUserDialog() {
        showUserDialog(props.userid);
    }

    watch([() => props.userid, () => props.location, () => props.forceUpdateKey], parse, { immediate: true });
</script>
