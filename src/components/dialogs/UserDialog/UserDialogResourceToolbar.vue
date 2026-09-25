<template>
    <div class="user-resource-toolbar">
        <div class="user-resource-toolbar__summary">
            <slot name="summary" />
        </div>
        <div class="user-resource-toolbar__controls">
            <slot name="controls" />
        </div>
    </div>
</template>

<style scoped>
    .user-resource-toolbar {
        display: flex;
        min-width: 0;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.375rem 0.75rem;
        border-bottom: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
        padding: 0 0 0.5rem;
    }

    .user-resource-toolbar__summary,
    .user-resource-toolbar__controls {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 0.375rem;
    }

    .user-resource-toolbar__summary {
        flex: 0 0 auto;
    }

    .user-resource-toolbar__controls {
        flex: 1 1 30rem;
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    :slotted(.user-resource-count) {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        border-radius: 999px;
        background: color-mix(in oklab, var(--primary) 15%, transparent);
        padding: 0.25rem 0.625rem;
        color: var(--primary);
        font-size: 0.8125rem;
        font-weight: 650;
        white-space: nowrap;
    }

    @media (max-width: 42rem) {
        .user-resource-toolbar__controls {
            flex-basis: 100%;
            justify-content: flex-start;
        }
    }
</style>
