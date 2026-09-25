<template>
    <TransitionGroup
        v-if="items.length"
        tag="ul"
        name="user-resource"
        appear
        class="user-resource-grid">
        <li
            v-for="(item, index) in items"
            :key="item[keyField] || item.id"
            class="min-w-0"
            :style="{ '--stagger-index': Math.min(index, 7) }">
            <button
                type="button"
                class="user-resource-card"
                :aria-label="item[titleField]"
                @click="emit('select', item)">
                <Avatar class="user-resource-card__avatar">
                    <AvatarImage v-if="item[imageField]" :src="item[imageField]" class="object-cover" />
                    <AvatarFallback>
                        <Image class="size-4 text-muted-foreground" />
                    </AvatarFallback>
                </Avatar>
                <span class="user-resource-card__details">
                    <span class="user-resource-card__name" v-text="item[titleField]"></span>
                    <span v-if="$slots.subtitle" class="user-resource-card__subtitle">
                        <slot name="subtitle" :item="item" />
                    </span>
                </span>
                <ChevronRight class="user-resource-card__chevron" aria-hidden="true" />
            </button>
        </li>
    </TransitionGroup>
    <div v-else-if="!loading" class="user-resource-empty" role="status">
        <slot name="empty">
            <Image class="size-5" aria-hidden="true" />
            <span>{{ t('common.no_data') }}</span>
        </slot>
    </div>
</template>

<script setup>
    import { ChevronRight, Image } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

    const { t } = useI18n();
    const emit = defineEmits(['select']);

    defineProps({
        items: {
            type: Array,
            default: () => []
        },
        keyField: {
            type: String,
            default: 'id'
        },
        titleField: {
            type: String,
            default: 'name'
        },
        imageField: {
            type: String,
            default: 'thumbnailImageUrl'
        },
        loading: {
            type: Boolean,
            default: false
        }
    });
</script>

<style scoped>
    .user-resource-grid {
        display: grid;
        min-width: 0;
        max-height: min(52vh, 36rem);
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr));
        gap: 0.375rem;
        overflow: auto;
        margin: 0;
        padding: 0.0625rem;
        list-style: none;
    }

    .user-resource-enter-active {
        transition:
            opacity 180ms ease-out,
            transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        transition-delay: calc(var(--stagger-index, 0) * 24ms);
    }

    .user-resource-enter-from {
        transform: translateY(6px) scale(0.985);
        opacity: 0;
    }

    .user-resource-leave-active {
        transition:
            opacity 110ms ease-in,
            transform 110ms ease-in;
        pointer-events: none;
    }

    .user-resource-leave-to {
        transform: scale(0.98);
        opacity: 0;
    }

    .user-resource-move {
        transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .user-resource-card {
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

    .user-resource-card:hover {
        border-color: color-mix(in oklab, var(--primary) 38%, transparent);
        background: color-mix(in oklab, var(--accent) 48%, transparent);
    }

    .user-resource-card:active {
        transform: scale(0.99);
    }

    .user-resource-card:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
    }

    .user-resource-card__avatar {
        width: 2rem;
        height: 2rem;
        flex: 0 0 auto;
        box-shadow: 0 1px 4px color-mix(in oklab, var(--foreground) 12%, transparent);
    }

    .user-resource-card__details {
        display: flex;
        min-width: 0;
        flex: 1 1 auto;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.3rem;
    }

    .user-resource-card__name {
        max-width: 100%;
        overflow: hidden;
        font-size: 0.875rem;
        font-weight: 650;
        letter-spacing: -0.01em;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .user-resource-card__subtitle {
        max-width: 100%;
        overflow: hidden;
        color: var(--muted-foreground);
        font-size: 0.6875rem;
        line-height: 0.95rem;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .user-resource-card__chevron {
        width: 1rem;
        height: 1rem;
        flex: 0 0 auto;
        color: color-mix(in oklab, var(--muted-foreground) 65%, transparent);
        transition:
            color 150ms ease,
            transform 150ms ease;
    }

    .user-resource-card:hover .user-resource-card__chevron {
        transform: translateX(2px);
        color: var(--foreground);
    }

    .user-resource-empty {
        display: flex;
        min-height: 7rem;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 1px dashed color-mix(in oklab, var(--border) 80%, transparent);
        border-radius: var(--radius-lg);
        background: color-mix(in oklab, var(--muted) 12%, transparent);
        padding: 1.25rem;
        color: var(--muted-foreground);
        font-size: 0.875rem;
        text-align: center;
    }

    @media (prefers-reduced-motion: reduce) {
        .user-resource-card,
        .user-resource-card__chevron,
        .user-resource-enter-active,
        .user-resource-leave-active,
        .user-resource-move {
            transition: none;
        }
    }
</style>
