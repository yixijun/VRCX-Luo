<template>
    <div class="relative h-full">
        <div class="h-full w-full overflow-auto overflow-x-hidden">
            <div class="px-1.5 py-2.5">
                <div class="mb-2 px-1 text-xs text-muted-foreground">
                    {{ t('side_panel.inactive_friends.description', { days: inactiveFriendDays }) }}
                </div>
                <div class="flex flex-col gap-0.5">
                    <div
                        v-for="friend in inactiveFriends"
                        :key="friend.id"
                        class="box-border flex cursor-pointer items-center p-1.5 text-[13px] hover:bg-muted/50 hover:rounded-lg"
                        @click="showUserDialog(friend.id)">
                        <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(friend.ref)">
                            <Avatar class="size-full rounded-full">
                                <AvatarImage :src="userImage(friend.ref, true)" class="object-cover" />
                                <AvatarFallback>
                                    <User class="size-5 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="flex-1 overflow-hidden h-9 flex flex-col justify-between">
                            <span
                                class="block truncate font-medium leading-[18px]"
                                :style="{ color: friend.ref?.$userColour }">
                                {{ friend.ref?.displayName || friend.name || friend.id }}
                            </span>
                            <span class="block truncate text-xs text-muted-foreground">
                                {{
                                    t('side_panel.inactive_friends.last_login', {
                                        time: formatDateFilter(friend.ref?.last_login, 'short')
                                    })
                                }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { User } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useAppearanceSettingsStore, useFriendStore } from '../../../stores';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { showUserDialog } from '../../../coordinators/userCoordinator';
    import { formatDateFilter } from '../../../shared/utils';

    const { t } = useI18n();
    const { userImage, userStatusClass } = useUserDisplay();
    const { inactiveFriends } = storeToRefs(useFriendStore());
    const { inactiveFriendDays } = storeToRefs(useAppearanceSettingsStore());
</script>
