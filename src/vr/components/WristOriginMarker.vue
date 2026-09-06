<template>
    <!-- The wrist texture is attached to the selected controller by OpenVR. -->
    <span
        class="wrist-origin-marker"
        data-wrist-origin="controller"
        data-origin-anchor="overlay-origin"
        data-position-space="tracked-device-relative"
        aria-hidden="true"></span>
</template>

<style scoped>
    .wrist-origin-marker {
        position: absolute;
        top: 50%;
        left: 50%;
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
    }
</style>
