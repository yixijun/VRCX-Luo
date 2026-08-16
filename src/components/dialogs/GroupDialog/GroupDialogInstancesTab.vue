<template>
    <div class="group-instances-tab px-1">
        <div v-if="groupDialog.instances.length" class="group-instances-list">
            <section v-for="room in groupDialog.instances" :key="room.tag" class="group-content-block group-instance">
                <div class="group-instance__header">
                    <Location :location="room.tag" class="min-w-0 text-sm font-medium" />
                    <InstanceActionBar
                        class="group-instance__actions"
                        :location="room.tag"
                        :currentlocation="lastLocation.location"
                        :instance="room.ref"
                        :friendcount="room.friendCount"
                        :refresh-tooltip="t('dialog.group.instances.refresh_players')"
                        :on-refresh="() => refreshInstancePlayerCount(room.tag)" />
                </div>
                <div v-if="room.users.length" class="group-instance__users">
                    <button
                        v-for="user in room.users"
                        :key="user.id"
                        type="button"
                        class="group-instance__user"
                        @click="showUserDialog(user.id)">
                        <div class="relative mr-2 inline-block size-8 flex-none" :class="userStatusClass(user)">
                            <Avatar class="size-8">
                                <AvatarImage :src="userImage(user)" class="object-cover" />
                                <AvatarFallback>
                                    <User class="size-4 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div class="min-w-0 flex-1">
                            <span
                                class="block truncate font-medium leading-[18px]"
                                :style="{ color: user.$userColour }"
                                v-text="user.displayName" />
                            <span v-if="user.location === 'traveling'" class="block truncate text-xs">
                                <Spinner class="mr-1 inline-block" />
                                <Timer :epoch="user.$travelingToTime" />
                            </span>
                            <span v-else class="block truncate text-xs">
                                <Timer :epoch="user.$location_at" />
                            </span>
                        </div>
                    </button>
                </div>
            </section>
        </div>
        <p v-else class="group-instances-empty">{{ t('dialog.group.instances.empty') }}</p>
    </div>
</template>

<script setup>
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Spinner } from '@/components/ui/spinner';
    import { User } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import InstanceActionBar from '../../InstanceActionBar.vue';
    import { refreshInstancePlayerCount } from '../../../coordinators/instanceCoordinator';
    import { showUserDialog } from '../../../coordinators/userCoordinator';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import { useGroupStore, useLocationStore } from '../../../stores';

    const { t } = useI18n();
    const { userImage, userStatusClass } = useUserDisplay();
    const { groupDialog } = storeToRefs(useGroupStore());
    const { lastLocation } = storeToRefs(useLocationStore());
</script>

<style scoped>
    .group-instances-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
        gap: 0.75rem;
    }

    .group-instance {
        width: 100%;
        padding: 0.75rem;
    }

    .group-instance__header {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.375rem 0.5rem;
    }

    .group-instance__actions {
        min-width: 0;
        margin-left: auto;
        flex-wrap: wrap;
        gap: 0.375rem;
        font-size: 0.75rem;
    }

    .group-instance__users {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 10rem), 1fr));
        gap: 0.25rem 0.5rem;
        margin-top: 0.5rem;
    }

    .group-instance__user {
        display: flex;
        min-width: 0;
        cursor: pointer;
        align-items: center;
        border: 0;
        border-radius: var(--radius-md);
        padding: 0.375rem;
        color: inherit;
        font: inherit;
        font-size: 0.8125rem;
        text-align: left;
        background: transparent;
        transition:
            background-color 140ms ease-out,
            transform 100ms ease-out;
    }

    .group-instance__user:hover {
        background: var(--accent);
    }

    .group-instance__user:active {
        transform: scale(0.985);
    }

    .group-instance__user:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 1px;
    }

    .group-instances-empty {
        margin: 0;
        padding: 2rem 0;
        color: var(--muted-foreground);
        font-size: 0.8125rem;
        text-align: center;
    }

    @media (prefers-reduced-motion: reduce) {
        .group-instance__user {
            transition: none;
        }
    }
</style>
