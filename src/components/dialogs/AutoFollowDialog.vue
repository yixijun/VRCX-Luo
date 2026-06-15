<template>
    <Dialog :open="open" @update:open="$emit('update:open', $event)">
        <DialogContent v-if="open" class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>自动跟随</DialogTitle>
                <DialogDescription>
                    请选择一个目前在线且是蓝灯或绿灯（Join Me / Online）的好友进行跟随。
                </DialogDescription>
            </DialogHeader>

            <div class="flex flex-col space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                <template v-if="availableFriends.length > 0">
                    <div
                        v-for="friend in availableFriends"
                        :key="friend.id"
                        class="flex items-center p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                        @click="selectFriend(friend)"
                    >
                        <div class="relative block h-10 w-10 flex-none mr-3" :class="userStatusClass(friend.ref)">
                            <Avatar class="h-full w-full rounded-full">
                                <AvatarImage :src="userImage(friend.ref)" class="object-cover" />
                                <AvatarFallback>
                                    <User class="h-5 w-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden">
                            <span class="block truncate font-medium text-sm" :style="{ color: friend.ref?.$userColour }">
                                {{ friend.ref?.displayName }}
                            </span>
                            <span class="block truncate text-xs text-muted-foreground">
                                <Location
                                    v-if="isRealInstance(friend.ref?.$locationTag) || isRealInstance(friend.ref?.$travelingToLocation)"
                                    :location="friend.ref?.$locationTag"
                                    :traveling="friend.ref?.$travelingToLocation"
                                    :link="false"
                                />
                                <template v-else>
                                    {{ friend.ref?.statusDescription || friend.ref?.status }}
                                </template>
                            </span>
                        </div>
                    </div>
                </template>
                <div v-else class="text-center py-8 text-muted-foreground text-sm">
                    没有符合条件的好友在线
                </div>
            </div>

            <DialogFooter class="sm:justify-start">
                <Button type="button" variant="secondary" @click="$emit('update:open', false)">
                    {{ t('dialog.close') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { User } from 'lucide-vue-next';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import Location from '../Location.vue';

import { useFriendStore } from '../../stores/friend';
import { useAutoFollowStore } from '../../stores/autoFollow';
import { useUserDisplay } from '../../composables/useUserDisplay';
import { isRealInstance } from '../../shared/utils';

defineProps({
    open: {
        type: Boolean,
        required: true
    }
});

const emit = defineEmits(['update:open']);

const { t } = useI18n();
const friendStore = useFriendStore();
const autoFollowStore = useAutoFollowStore();
const { onlineFriends } = storeToRefs(friendStore);
const { userImage, userStatusClass } = useUserDisplay();

const availableFriends = computed(() => {
    return onlineFriends.value.filter(f => {
        return f.ref?.status === 'join me' || f.ref?.status === 'active';
    });
});

function selectFriend(friend) {
    autoFollowStore.startFollow(friend.ref, { confirm: true, initialJoin: true, launchMode: 'desktop' });
    emit('update:open', false);
}
</script>
