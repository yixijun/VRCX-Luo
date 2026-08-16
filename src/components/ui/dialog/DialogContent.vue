<script setup>
    import {
        DialogClose,
        DialogContent,
        DialogDescription,
        DialogPortal,
        useForwardPropsEmits,
        VisuallyHidden
    } from 'reka-ui';
    import { inject, onBeforeUnmount, ref, watch } from 'vue';
    import { X } from 'lucide-vue-next';
    import { acquireModalPortalLayer } from '@/lib/modalPortalLayers';
    import { cn } from '@/lib/utils';
    import { reactiveOmit } from '@vueuse/core';

    import { DIALOG_OPEN_INJECTION_KEY } from './context';

    import DialogOverlay from './DialogOverlay.vue';

    defineOptions({
        inheritAttrs: false
    });

    const props = defineProps({
        forceMount: { type: Boolean, required: false },
        disableOutsidePointerEvents: { type: Boolean, required: false },
        asChild: { type: Boolean, required: false },
        as: { type: null, required: false },
        class: { type: null, required: false },
        showCloseButton: { type: Boolean, required: false, default: true }
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

    const injectedOpen = inject(DIALOG_OPEN_INJECTION_KEY, null);
    const open = injectedOpen ?? ref(true);

    const portalLayer = acquireModalPortalLayer();
    const portalTo = portalLayer.element;

    watch(
        open,
        (isOpen) => {
            if (isOpen) {
                portalLayer.bringToFront();
            }
        },
        { immediate: true }
    );

    onBeforeUnmount(() => {
        portalLayer.release();
    });
</script>

<template>
    <DialogPortal :to="portalTo">
        <DialogOverlay />
        <DialogContent
            data-slot="dialog-content"
            v-bind="{ ...$attrs, ...forwarded }"
            :class="
                cn(
                    'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-1.5rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border/80 p-5 shadow-xl duration-150 sm:max-w-lg',
                    'max-h-[calc(100dvh-1.5rem)] min-w-0 overflow-y-auto overscroll-contain',
                    props.class
                )
            ">
            <slot />

            <VisuallyHidden as-child>
                <DialogDescription />
            </VisuallyHidden>

            <DialogClose
                v-if="showCloseButton"
                data-slot="dialog-close"
                class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-3 right-3 grid size-8 place-items-center rounded-md opacity-70 transition-[opacity,background-color,transform] duration-150 hover:bg-accent hover:opacity-100 active:scale-90 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer">
                <X />
                <span class="sr-only">Close</span>
            </DialogClose>
        </DialogContent>
    </DialogPortal>
</template>
