<script setup>
    import { PopoverContent, PopoverPortal, useForwardPropsEmits } from 'reka-ui';
    import { cn } from '@/lib/utils';
    import { reactiveOmit } from '@vueuse/core';

    defineOptions({
        inheritAttrs: false
    });

    const props = defineProps({
        forceMount: { type: Boolean, required: false },
        side: { type: null, required: false },
        sideOffset: { type: Number, required: false, default: 4 },
        sideFlip: { type: Boolean, required: false },
        align: { type: null, required: false, default: 'center' },
        alignOffset: { type: Number, required: false },
        alignFlip: { type: Boolean, required: false },
        avoidCollisions: { type: Boolean, required: false },
        collisionBoundary: { type: null, required: false },
        collisionPadding: { type: [Number, Object], required: false },
        arrowPadding: { type: Number, required: false },
        sticky: { type: String, required: false },
        hideWhenDetached: { type: Boolean, required: false },
        positionStrategy: { type: String, required: false },
        updatePositionStrategy: { type: String, required: false },
        disableUpdateOnLayoutShift: { type: Boolean, required: false },
        prioritizePosition: { type: Boolean, required: false },
        reference: { type: null, required: false },
        asChild: { type: Boolean, required: false },
        as: { type: null, required: false },
        disableOutsidePointerEvents: { type: Boolean, required: false },
        class: { type: null, required: false }
    });
    const emits = defineEmits([
        'escapeKeyDown',
        'pointerDownOutside',
        'focusOutside',
        'interactOutside',
        'openAutoFocus',
        'closeAutoFocus'
    ]);

    const delegatedProps = reactiveOmit(props, 'class');

    const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <PopoverPortal>
        <PopoverContent
            data-slot="popover-content"
            v-bind="{ ...$attrs, ...forwarded }"
            :class="
                cn(
                    'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 z-12000 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-border/80 p-4 shadow-lg origin-(--reka-popover-content-transform-origin) outline-hidden duration-150',
                    props.class
                )
            ">
            <slot />
        </PopoverContent>
    </PopoverPortal>
</template>
