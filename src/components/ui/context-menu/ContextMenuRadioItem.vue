<script setup>
    import { reactiveOmit } from '@vueuse/core';
    import { Circle } from 'lucide-vue-next';
    import { ContextMenuItemIndicator, ContextMenuRadioItem, useForwardPropsEmits } from 'reka-ui';
    import { cn } from '@/lib/utils';

    const props = defineProps({
        value: { type: null, required: true },
        disabled: { type: Boolean, required: false },
        textValue: { type: String, required: false },
        asChild: { type: Boolean, required: false },
        as: { type: null, required: false },
        class: { type: null, required: false }
    });
    const emits = defineEmits(['select']);

    const delegatedProps = reactiveOmit(props, 'class');

    const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
    <ContextMenuRadioItem
        data-slot="context-menu-radio-item"
        v-bind="forwarded"
        :class="
            cn(
                'focus:bg-accent focus:text-accent-foreground relative flex min-h-7 cursor-pointer items-center gap-1.5 rounded-sm py-1 pr-2 pl-7 text-xs outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-3.5',
                props.class
            )
        ">
        <span class="pointer-events-none absolute left-1.5 flex size-3.5 items-center justify-center">
            <ContextMenuItemIndicator>
                <slot name="indicator-icon">
                    <Circle class="size-2 fill-current" />
                </slot>
            </ContextMenuItemIndicator>
        </span>
        <slot />
    </ContextMenuRadioItem>
</template>
