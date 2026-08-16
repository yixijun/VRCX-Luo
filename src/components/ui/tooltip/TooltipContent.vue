<script setup>
    import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from 'reka-ui';
    import { cn } from '@/lib/utils';
    import { reactiveOmit } from '@vueuse/core';

    defineOptions({
        inheritAttrs: false
    });

    const props = defineProps({
        forceMount: { type: Boolean, required: false },
        ariaLabel: { type: String, required: false },
        asChild: { type: Boolean, required: false },
        as: { type: null, required: false },
        side: { type: null, required: false },
        sideOffset: { type: Number, required: false, default: 4 },
        align: { type: null, required: false },
        alignOffset: { type: Number, required: false },
        avoidCollisions: { type: Boolean, required: false },
        collisionBoundary: { type: null, required: false },
        collisionPadding: { type: [Number, Object], required: false },
        arrowPadding: { type: Number, required: false },
        sticky: { type: String, required: false },
        hideWhenDetached: { type: Boolean, required: false },
        positionStrategy: { type: String, required: false },
        updatePositionStrategy: { type: String, required: false },
        class: { type: null, required: false }
    });

    const emits = defineEmits(['escapeKeyDown', 'pointerDownOutside']);

    const delegatedProps = reactiveOmit(props, 'class');
    const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <TooltipPortal>
        <TooltipContent
            data-slot="tooltip-content"
            v-bind="{ ...forwarded, ...$attrs }"
            :class="
                cn(
                    'bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-12000 w-fit max-w-[min(22rem,calc(100vw-1rem))] rounded-md px-2.5 py-1.5 text-xs leading-relaxed text-balance shadow-lg duration-100',
                    props.class
                )
            ">
            <slot />

            <TooltipArrow
                class="bg-foreground fill-foreground z-12000 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
        </TooltipContent>
    </TooltipPortal>
</template>
