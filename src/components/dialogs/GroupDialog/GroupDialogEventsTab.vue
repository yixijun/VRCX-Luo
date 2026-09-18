<template>
    <div class="group-events-tab px-1">
        <section class="group-content-block group-events-section">
            <h3 class="group-events-heading">{{ t('dialog.group.info.upcoming_events') }}</h3>
            <div v-if="upcomingCalenderEvents.length" class="grid-view group-events-grid">
                <GroupCalendarEventCard
                    v-for="event in upcomingCalenderEvents"
                    :key="event.id"
                    :event="event"
                    :is-following="event.userInterest?.isFollowing"
                    :can-delete="canManageCalendar"
                    :can-edit="canManageCalendar"
                    mode="grid"
                    card-class="group-dialog-grid-card"
                    @update-following-calendar-data="updateFollowingCalendarData"
                    @delete="confirmDeleteGroupEvent"
                    @edit="showEditGroupEventDialog(event, groupDialog.ref)" />
            </div>
            <p v-else class="group-events-empty">{{ t('dialog.group_calendar.no_events') }}</p>
        </section>

        <section class="group-content-block group-events-section">
            <h3 class="group-events-heading">{{ t('dialog.group.info.past_events') }}</h3>
            <div v-if="pastCalenderEvents.length" class="grid-view group-events-grid">
                <GroupCalendarEventCard
                    v-for="event in pastCalenderEvents"
                    :key="event.id"
                    :event="event"
                    :is-following="event.userInterest?.isFollowing"
                    :can-delete="canManageCalendar"
                    :can-edit="canManageCalendar"
                    mode="grid"
                    card-class="group-dialog-grid-card"
                    @update-following-calendar-data="updateFollowingCalendarData"
                    @delete="confirmDeleteGroupEvent"
                    @edit="showEditGroupEventDialog(event, groupDialog.ref)" />
            </div>
            <p v-else class="group-events-empty">{{ t('dialog.group_calendar.no_events') }}</p>
        </section>
    </div>
</template>

<script setup>
    import { computed } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import GroupCalendarEventCard from '../../../views/Tools/components/GroupCalendarEventCard.vue';
    import { hasGroupPermission } from '../../../shared/utils';
    import { useGroupStore } from '../../../stores';
    import { useGroupCalendarEvents } from './useGroupCalendarEvents';

    defineProps({
        confirmDeleteGroupEvent: {
            type: Function,
            required: true
        }
    });

    const { t } = useI18n();
    const { groupDialog } = storeToRefs(useGroupStore());
    const { showEditGroupEventDialog } = useGroupStore();
    const canManageCalendar = computed(() => hasGroupPermission(groupDialog.value.ref, 'group-calendar-manage'));
    const { pastCalenderEvents, upcomingCalenderEvents, updateFollowingCalendarData } =
        useGroupCalendarEvents(groupDialog);
</script>

<style scoped>
    .group-events-tab {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .group-events-section {
        min-width: 0;
        padding: 0.875rem;
    }

    .group-events-heading {
        margin: 0 0 0.75rem;
        color: var(--foreground);
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .group-events-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr));
        gap: 0.75rem;
        padding: 0;
    }

    .group-events-empty {
        margin: 0;
        padding: 1.5rem 0;
        color: var(--muted-foreground);
        font-size: 0.8125rem;
        text-align: center;
    }
</style>
