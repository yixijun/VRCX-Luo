<template>
    <div class="instance-tab min-w-0 pb-3">
        <div class="instance-summary">
            <span class="instance-summary-item">
                <User />
                {{ t('dialog.world.instances.public_count', { count: worldDialog.ref.publicOccupants }) }}
            </span>
            <span class="instance-summary-item">
                <LockKeyhole />
                {{
                    t('dialog.world.instances.private_count', {
                        count: worldDialog.ref.privateOccupants
                    })
                }}
            </span>
            <span class="instance-summary-item">
                <Check />
                {{
                    t('dialog.world.instances.capacity_count', {
                        count: worldDialog.ref.recommendedCapacity,
                        max: worldDialog.ref.capacity
                    })
                }}
            </span>
        </div>
        <div class="instance-room-list">
            <div v-for="(room, roomIndex) in worldDialog.rooms" :key="room.id">
                <template v-if="isAgeGatedInstancesVisible || !(room.ageGate || room.location?.includes('~ageGate'))">
                    <section class="instance-room" :style="{ '--room-index': Math.min(roomIndex, 8) }">
                        <div class="instance-room-header">
                            <div class="instance-room-location min-w-0">
                                <LocationWorld
                                    class="text-sm"
                                    :locationobject="room.$location"
                                    :currentuserid="currentUser.id"
                                    :worlddialogshortname="worldDialog.$location.shortName" />
                            </div>
                            <InstanceActionBar
                                class="instance-room-actions text-sm"
                                :location="room.$location.tag"
                                :launch-location="room.tag"
                                :instance-location="room.tag"
                                :shortname="room.$location.shortName"
                                :currentlocation="lastLocation.location"
                                :instance="room.ref"
                                :friendcount="room.friendCount"
                                :refresh-tooltip="t('dialog.world.instances.refresh_instance_info')"
                                :show-history="!!instanceJoinHistory.get(room.$location.tag)"
                                :history-tooltip="t('dialog.previous_instances.info')"
                                :on-refresh="() => refreshInstancePlayerCount(room.tag)"
                                :on-history="() => showPreviousInstancesInfoDialog(room.location)" />
                        </div>
                        <div v-if="room.$location.userId || room.users.length" class="instance-player-grid">
                            <div
                                v-if="room.$location.userId"
                                class="instance-player is-creator"
                                @click="showUserDialog(room.$location.userId)">
                                <template v-if="room.$location.user">
                                    <div
                                        class="relative inline-block flex-none size-9"
                                        :class="userStatusClass(room.$location.user)">
                                        <Avatar class="size-9">
                                            <AvatarImage
                                                :src="userImage(room.$location.user, true)"
                                                class="object-cover" />
                                            <AvatarFallback>
                                                <User class="size-4 text-muted-foreground" />
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div class="min-w-0 flex-1 overflow-hidden">
                                        <span
                                            class="block truncate font-medium leading-[18px]"
                                            :style="{ color: room.$location.user.$userColour }"
                                            v-text="room.$location.user.displayName" />
                                        <span class="block truncate text-xs">
                                            {{ t('dialog.world.instances.instance_creator') }}
                                        </span>
                                    </div>
                                </template>
                                <span v-else v-text="room.$location.userId" />
                            </div>
                            <div
                                v-for="user in room.users"
                                :key="user.id"
                                class="instance-player"
                                @click="showUserDialog(user.id)">
                                <div class="relative inline-block flex-none size-9" :class="userStatusClass(user)">
                                    <Avatar class="size-9">
                                        <AvatarImage :src="userImage(user, true)" class="object-cover" />
                                        <AvatarFallback>
                                            <User class="size-4 text-muted-foreground" />
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <div class="min-w-0 flex-1 overflow-hidden">
                                    <span
                                        class="block truncate font-medium leading-[18px]"
                                        :style="{ color: user.$userColour }"
                                        v-text="user.displayName" />
                                    <span v-if="user.location === 'traveling'" class="block truncate text-xs">
                                        <Spinner class="inline-block mr-1" />
                                        <Timer :epoch="user.$travelingToTime" />
                                    </span>
                                    <span v-else class="block truncate text-xs">
                                        <Timer :epoch="user.$location_at" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { Check, LockKeyhole, User } from 'lucide-vue-next';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Spinner } from '@/components/ui/spinner';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { refreshInstancePlayerCount } from '../../../coordinators/instanceCoordinator';
    import { useUserDisplay } from '../../../composables/useUserDisplay';
    import {
        useAppearanceSettingsStore,
        useInstanceStore,
        useLocationStore,
        useUserStore,
        useWorldStore
    } from '../../../stores';

    import InstanceActionBar from '../../InstanceActionBar.vue';
    import { showUserDialog } from '../../../coordinators/userCoordinator';

    const { t } = useI18n();
    const { userImage, userStatusClass } = useUserDisplay();

    const { isAgeGatedInstancesVisible } = storeToRefs(useAppearanceSettingsStore());

    const { currentUser } = storeToRefs(useUserStore());
    const { worldDialog } = storeToRefs(useWorldStore());
    const { lastLocation } = storeToRefs(useLocationStore());
    const { showPreviousInstancesInfoDialog } = useInstanceStore();
    const { instanceJoinHistory } = storeToRefs(useInstanceStore());
</script>

<style scoped>
    .instance-tab {
        container-type: inline-size;
    }

    .instance-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .instance-summary-item {
        display: inline-flex;
        min-height: 2rem;
        align-items: center;
        gap: 0.4rem;
        border: 0;
        border-radius: 0.5rem;
        background: color-mix(in oklch, var(--muted) 72%, transparent);
        padding: 0.35rem 0.65rem;
        color: var(--muted-foreground);
        font-size: 0.75rem;
        font-weight: 550;
    }

    .instance-summary-item :deep(svg) {
        width: 0.9rem;
        height: 0.9rem;
        color: var(--foreground);
    }

    .instance-room-list {
        display: grid;
        gap: 0.75rem;
    }

    .instance-room {
        min-width: 0;
        overflow: hidden;
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
        background: color-mix(in oklch, var(--card) 95%, var(--foreground) 5%);
        box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
        animation: room-arrive 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        animation-delay: calc(var(--room-index) * 24ms);
        transition:
            box-shadow 160ms ease,
            transform 160ms ease;
    }

    .instance-room:hover {
        box-shadow: 0 7px 20px rgb(0 0 0 / 12%);
        transform: translateY(-1px);
    }

    .instance-room-header {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.7rem 0.75rem;
    }

    .instance-room-location {
        overflow: hidden;
    }

    .instance-room-actions {
        flex: 0 0 auto;
    }

    .instance-player-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
        gap: 0.4rem;
        border-top: 1px solid var(--border-subtle);
        padding: 0.55rem;
        background: color-mix(in oklch, var(--muted) 35%, transparent);
    }

    .instance-player {
        display: flex;
        min-width: 0;
        cursor: pointer;
        align-items: center;
        gap: 0.6rem;
        border: 0;
        border-radius: 0.5rem;
        padding: 0.45rem 0.55rem;
        font-size: 0.8125rem;
        transition:
            background-color 140ms ease,
            box-shadow 140ms ease,
            transform 140ms ease;
    }

    .instance-player:hover {
        background: var(--surface-hover);
        box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
        transform: translateY(-1px);
    }

    .instance-player:active {
        transform: scale(0.98);
    }

    .instance-player.is-creator {
        background: color-mix(in oklch, var(--primary) 6%, transparent);
    }

    @container (max-width: 34rem) {
        .instance-room-header {
            align-items: flex-start;
            flex-direction: column;
        }

        .instance-room-actions {
            width: 100%;
        }
    }

    @keyframes room-arrive {
        from {
            opacity: 0;
            transform: translateY(0.4rem) scale(0.99);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .instance-room {
            animation: none;
        }

        .instance-room:hover,
        .instance-player:hover,
        .instance-player:active {
            transform: none;
        }
    }
</style>
