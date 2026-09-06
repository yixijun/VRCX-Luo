<template>
    <!-- The wrist texture is attached to the selected controller by OpenVR. -->
    <span
        v-show="visible"
        class="wrist-origin-marker"
        data-wrist-origin="controller"
        data-origin-anchor="overlay-origin"
        data-position-space="tracked-device-relative"
        :data-pointer-hand="hand"
        :class="{ pressed }"
        :style="style"
        aria-hidden="true"></span>
</template>

<script setup>
    import { computed } from 'vue';

    import { getWristPointerStyle } from '../wristPointer';

    const props = defineProps({
        x: {
            type: Number,
            default: 0.5
        },
        y: {
            type: Number,
            default: 0.5
        },
        visible: {
            type: Boolean,
            default: true
        },
        pressed: {
            type: Boolean,
            default: false
        },
        hand: {
            type: String,
            default: 'right'
        }
    });

    const style = computed(() => getWristPointerStyle(props));
</script>

<style scoped>
    .wrist-origin-marker {
        position: absolute;
        z-index: 30;
        width: 8px;
        height: 8px;
        transform: translate(-50%, -50%);
        color: var(--status-joinme, #00b8ff);
        border-radius: 50%;
        background: currentColor;
        opacity: 0.9;
        pointer-events: none;
        box-shadow: 0 0 6px rgba(0, 184, 255, 0.65);
        transition:
            left 60ms linear,
            top 60ms linear,
            transform 60ms ease;
    }

    .wrist-origin-marker.pressed {
        transform: translate(-50%, -50%) scale(1.35);
    }
</style>
