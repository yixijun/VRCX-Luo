<template>
    <button type="button" class="user-group-card" @click="handleViewDetails">
        <Avatar class="user-group-card__avatar">
            <AvatarImage :src="group.iconUrl" class="object-cover" />
            <AvatarFallback>
                <Users class="size-4 text-muted-foreground" />
            </AvatarFallback>
        </Avatar>
        <span class="user-group-card__details">
            <span class="user-group-card__name" v-text="group.name"></span>
            <span class="user-group-card__metadata">
                <span class="user-group-card__member-count">
                    <Users class="size-3" />
                    {{ group.memberCount }}
                </span>
                <TooltipWrapper
                    v-if="group.isRepresenting"
                    side="top"
                    :content="t('dialog.group.members.representing')">
                    <Tag class="size-3.5 text-primary" />
                </TooltipWrapper>
                <TooltipWrapper v-if="memberVisibility !== 'visible'" side="top">
                    <template #content>
                        <span>{{ t('dialog.group.members.visibility') }} {{ memberVisibility }}</span>
                    </template>
                    <Eye class="size-3.5 text-muted-foreground" />
                </TooltipWrapper>
            </span>
        </span>
        <ChevronRight class="user-group-card__chevron" aria-hidden="true" />
    </button>
</template>

<script setup>
    import { ChevronRight, Eye, Tag, Users } from 'lucide-vue-next';
    import { computed } from 'vue';
    import { useI18n } from 'vue-i18n';

    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

    import { showGroupDialog } from '../../../coordinators/groupCoordinator';

    const { t } = useI18n();

    const props = defineProps({
        group: {
            type: Object,
            required: true
        }
    });

    const memberVisibility = computed(
        () => props.group?.memberVisibility || props.group?.myMember?.visibility || 'visible'
    );

    function handleViewDetails() {
        showGroupDialog(props.group.id);
    }
</script>

<style scoped>
    .user-group-card {
        display: flex;
        width: 100%;
        min-width: 0;
        min-height: 3.25rem;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid color-mix(in oklab, var(--border) 76%, transparent);
        border-radius: var(--radius-lg);
        background: color-mix(in oklab, var(--card) 45%, transparent);
        padding: 0.375rem 0.5rem;
        text-align: left;
        transition:
            border-color 150ms ease,
            background-color 150ms ease,
            transform 100ms ease-out;
    }

    .user-group-card:hover {
        border-color: color-mix(in oklab, var(--primary) 38%, transparent);
        background: color-mix(in oklab, var(--accent) 48%, transparent);
    }

    .user-group-card:active {
        transform: scale(0.99);
    }

    .user-group-card:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
    }

    .user-group-card__avatar {
        width: 2rem;
        height: 2rem;
        flex: 0 0 auto;
        border-radius: var(--radius-md);
        box-shadow: 0 1px 4px color-mix(in oklab, var(--foreground) 12%, transparent);
    }

    .user-group-card__details {
        display: flex;
        min-width: 0;
        flex: 1 1 auto;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.2rem;
    }

    .user-group-card__name {
        width: 100%;
        overflow: hidden;
        font-size: 0.875rem;
        font-weight: 650;
        letter-spacing: -0.01em;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .user-group-card__metadata {
        display: inline-flex;
        min-width: 0;
        align-items: center;
        gap: 0.375rem;
        color: var(--muted-foreground);
        font-size: 0.6875rem;
        line-height: 1rem;
    }

    .user-group-card__member-count {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        border-radius: var(--radius-sm);
        background: color-mix(in oklab, var(--muted) 68%, transparent);
        padding: 0 0.3rem;
        font-variant-numeric: tabular-nums;
    }

    .user-group-card__chevron {
        width: 0.875rem;
        height: 0.875rem;
        flex: 0 0 auto;
        color: color-mix(in oklab, var(--muted-foreground) 65%, transparent);
        transition:
            color 150ms ease,
            transform 150ms ease;
    }

    .user-group-card:hover .user-group-card__chevron {
        transform: translateX(2px);
        color: var(--foreground);
    }

    @media (prefers-reduced-motion: reduce) {
        .user-group-card,
        .user-group-card__chevron {
            transition: none;
        }
    }
</style>
