<script setup>
    import { TabsList } from 'reka-ui';
    import { cn } from '@/lib/utils';
    import { reactiveOmit } from '@vueuse/core';

    const props = defineProps({
        loop: { type: Boolean, required: false },
        asChild: { type: Boolean, required: false },
        as: { type: null, required: false },
        class: { type: null, required: false }
    });

    const delegatedProps = reactiveOmit(props, 'class');
</script>

<template>
    <TabsList
        data-slot="tabs-list"
        v-bind="delegatedProps"
        :class="
            cn(
                'bg-muted/80 text-muted-foreground inline-flex min-h-9 max-w-full w-fit items-center justify-start overflow-x-auto rounded-lg border border-border/60 p-[3px] scrollbar-hidden',
                props.class
            )
        ">
        <slot />
    </TabsList>
</template>
