<template>
    <div class="wrist-origin-marker" data-wrist-origin="controller" data-origin-anchor="center" aria-hidden="true">
        <span class="wrist-origin-marker__line wrist-origin-marker__line--horizontal"></span>
        <span class="wrist-origin-marker__line wrist-origin-marker__line--vertical"></span>
        <span class="wrist-origin-marker__ring"></span>
        <span class="wrist-origin-marker__dot"></span>
    </div>
</template>

<style scoped>
    .wrist-origin-marker {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 30;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        transform: translate(-50%, -50%);
        color: var(--status-joinme, #00b8ff);
        opacity: 0.78;
        pointer-events: none;
        filter: drop-shadow(0 0 3px rgba(0, 184, 255, 0.35));
    }

    .wrist-origin-marker__line {
        position: absolute;
        display: block;
        background: currentColor;
    }

    .wrist-origin-marker__line--horizontal {
        width: 100%;
        height: 1px;
    }

    .wrist-origin-marker__line--vertical {
        width: 1px;
        height: 100%;
    }

    .wrist-origin-marker__ring {
        position: relative;
        z-index: 1;
        display: block;
        width: 14px;
        height: 14px;
        border: 1px solid currentColor;
        border-radius: 50%;
        background: rgba(24, 24, 27, 0.42);
        box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.18);
    }

    .wrist-origin-marker__dot {
        position: absolute;
        z-index: 2;
        display: block;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 5px currentColor;
    }
</style>
