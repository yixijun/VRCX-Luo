<script setup>
    import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
    import { computed, nextTick, ref, toRefs, watch } from 'vue';

    const props = defineProps({
        modelValue: String,
        defaultValue: String,
        items: {
            type: Array,
            required: true,
            validator: (value) =>
                Array.isArray(value) &&
                value.every(
                    (item) =>
                        item &&
                        (typeof item.value === 'string' || typeof item.value === 'number') &&
                        typeof item.label === 'string'
                )
        },
        ariaLabel: { type: String, default: '' },

        variant: { type: String, default: 'fit' },
        unmountOnHide: { type: Boolean, default: false },
        fill: { type: Boolean, default: false },
        sticky: { type: Boolean, default: false }
    });

    const emit = defineEmits(['update:modelValue']);
    const { modelValue, defaultValue, items, ariaLabel, variant, unmountOnHide, fill, sticky } = toRefs(props);

    const itemsList = computed(() => (Array.isArray(items.value) ? items.value : []));

    const resolvedDefault = computed(() => {
        return defaultValue.value ?? itemsList.value?.[0]?.value;
    });

    const isValueValid = (value) => itemsList.value.some((item) => item?.value === value);

    const innerValue = ref(isValueValid(modelValue.value) ? modelValue.value : resolvedDefault.value);
    const tabsListRef = ref(null);

    watch(modelValue, (v) => {
        if (isValueValid(v)) {
            innerValue.value = v;
        }
    });

    watch([itemsList, defaultValue], () => {
        if (!isValueValid(innerValue.value)) {
            innerValue.value = resolvedDefault.value;
            return;
        }

        if (modelValue.value !== undefined && modelValue.value !== null && !isValueValid(modelValue.value)) {
            innerValue.value = resolvedDefault.value;
        }
    });

    function onValueChange(v) {
        innerValue.value = v;
        emit('update:modelValue', v);
    }

    function scrollActiveTabIntoView() {
        nextTick(() => {
            const list = tabsListRef.value?.$el ?? tabsListRef.value;
            list?.querySelector?.('[role="tab"][data-state="active"]')?.scrollIntoView?.({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        });
    }

    function handleTabsWheel(event) {
        const list = tabsListRef.value?.$el ?? tabsListRef.value;
        if (!list || list.scrollWidth <= list.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            return;
        }
        event.preventDefault();
        list.scrollLeft += event.deltaY;
    }

    watch(innerValue, scrollActiveTabIntoView);

    const triggerClass = computed(() => {
        return [
            'relative inline-flex cursor-pointer min-h-10 shrink-0 items-center justify-center rounded-t-md px-3.5 text-sm font-medium whitespace-nowrap',
            'text-muted-foreground transition-[color,background-color,transform] duration-150 hover:bg-accent/45 hover:text-foreground active:scale-[0.97]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=active]:text-primary',
            variant.value === 'equal' ? 'flex-1' : '',
            variant.value === 'pill' ? 'rounded-full' : ''
        ].join(' ');
    });

    const listClass = computed(() => {
        return [
            'tabs-underline-list relative flex w-full max-w-full shrink-0 items-center gap-1 overflow-x-auto overscroll-x-contain border-b border-border px-1 scrollbar-hidden',
            variant.value === 'pill' ? 'rounded-full bg-muted p-1' : '',
            sticky.value ? 'sticky top-0 z-10 bg-background/92 backdrop-blur-md' : ''
        ].join(' ');
    });
</script>

<template>
    <TabsRoot
        :model-value="innerValue"
        :default-value="resolvedDefault"
        :class="['w-full min-w-0', fill ? 'flex min-h-0 flex-col' : '']"
        :unmount-on-hide="unmountOnHide"
        @update:modelValue="onValueChange">
        <TabsList ref="tabsListRef" :class="listClass" :aria-label="ariaLabel || undefined" @wheel="handleTabsWheel">
            <TabsIndicator
                class="pointer-events-none absolute left-0 bottom-0 h-0.5 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) transition-[width,translate] duration-150 ease-out">
                <div class="h-full w-full rounded-full bg-primary" />
            </TabsIndicator>

            <TabsTrigger
                v-for="it in itemsList"
                :key="it.value"
                :value="it.value"
                :disabled="it.disabled"
                :class="triggerClass">
                <slot :name="`label-${it.value}`">{{ it.label }}</slot>
            </TabsTrigger>
        </TabsList>

        <TabsContent
            v-for="it in itemsList"
            :key="it.value"
            :value="it.value"
            :class="[
                'tabs-underline-content pt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
                fill ? 'min-h-0 flex-1 overflow-y-auto' : ''
            ]">
            <slot :name="it.value" />
        </TabsContent>
    </TabsRoot>
</template>

<style scoped>
    .tabs-underline-list {
        scroll-behavior: smooth;
        scroll-snap-type: x proximity;
        mask-image: linear-gradient(to right, transparent 0, black 0.5rem, black calc(100% - 0.5rem), transparent 100%);
    }

    .tabs-underline-list :deep([role='tab']) {
        scroll-snap-align: nearest;
    }

    .tabs-underline-content[data-state='active'] {
        animation: tab-content-arrive 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    @keyframes tab-content-arrive {
        from {
            opacity: 0;
            transform: translateY(0.25rem);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .tabs-underline-list {
            scroll-behavior: auto;
        }

        .tabs-underline-content[data-state='active'] {
            animation: none;
        }
    }
</style>
