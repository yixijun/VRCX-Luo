/**
 * Returns whether the explicitly opt-in desktop wrist simulator is requested.
 * The query flag keeps the normal VR overlay path unchanged.
 *
 * @param {string=} search
 * @returns {boolean}
 */
export function isWristPointerDesktopTestEnabled(
    search = globalThis.location?.search ?? ''
) {
    if (typeof search !== 'string') {
        return false;
    }

    const query = search.startsWith('?') ? search.slice(1) : search;
    return new URLSearchParams(query).get('wrist-pointer-test') === '1';
}

/**
 * Creates the minimal AppApiVr surface needed to render the wrist overlay
 * without a CEF/OpenVR host.
 *
 * @returns {Record<string, () => Promise<unknown>>}
 */
export function createWristPointerDesktopTestApi() {
    return {
        VrInit: async () => undefined,
        ToggleSystemMonitor: async () => undefined,
        CurrentCulture: async () => 'en-gb',
        CustomVrScript: async () => '',
        GetVRDevices: async () => [],
        GetExecuteVrOverlayFunctionQueue: async () => [],
        GetWristPointerQueue: async () => [],
        CpuUsage: async () => 0,
        GetUptime: async () => 0
    };
}

function clampUnit(value) {
    return Math.min(1, Math.max(0, value));
}

function getNormalizedPoint(element, event, fallback) {
    const rect = element.getBoundingClientRect?.();
    const width = Number(rect?.width);
    const height = Number(rect?.height);
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);

    if (
        !rect ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0 ||
        !Number.isFinite(clientX) ||
        !Number.isFinite(clientY)
    ) {
        return fallback;
    }

    return {
        x: clampUnit((clientX - Number(rect.left)) / width),
        y: clampUnit((clientY - Number(rect.top)) / height)
    };
}

/**
 * Installs mouse input handlers for a desktop-only wrist pointer preview.
 * The returned cleanup function removes every listener that was registered.
 *
 * @param {{element?: object, onMove?: (payload: object) => void, onClick?: (payload: object) => void, hand?: string}=} options
 * @returns {() => void}
 */
export function installWristPointerDesktopTest({
    element,
    onMove,
    onClick,
    hand = 'right'
} = {}) {
    if (!element?.addEventListener || typeof onMove !== 'function') {
        return () => {};
    }

    let lastPoint = { x: 0.5, y: 0.5 };
    let routingActionClick = false;
    const emitMove = (point, visible, pressed) => {
        onMove({ ...point, visible, pressed, hand });
    };
    const handlePointerMove = (event) => {
        lastPoint = getNormalizedPoint(element, event, lastPoint);
        emitMove(lastPoint, true, false);
    };
    const handlePointerLeave = () => {
        emitMove(lastPoint, false, false);
    };
    const handlePointerDown = (event) => {
        lastPoint = getNormalizedPoint(element, event, lastPoint);
        emitMove(lastPoint, true, true);
    };
    const handlePointerUp = (event) => {
        lastPoint = getNormalizedPoint(element, event, lastPoint);
        emitMove(lastPoint, true, false);
    };
    const handleClick = (event) => {
        if (typeof onClick !== 'function' || event?.detail === 0) {
            return;
        }
        lastPoint = getNormalizedPoint(element, event, lastPoint);
        const action = event?.target?.closest?.('[data-vr-action]');
        const isExplicitAction =
            action &&
            (typeof element.contains !== 'function' ||
                element.contains(action));

        if (isExplicitAction) {
            event.preventDefault?.();
            event.stopPropagation?.();
            if (routingActionClick) {
                return;
            }
            routingActionClick = true;
            try {
                onClick({ ...lastPoint, visible: true, pressed: true, hand });
            } finally {
                routingActionClick = false;
            }
            return;
        }

        onClick({ ...lastPoint, visible: true, pressed: true, hand });
    };

    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerleave', handlePointerLeave);
    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('click', handleClick);

    return () => {
        element.removeEventListener?.('pointermove', handlePointerMove);
        element.removeEventListener?.('pointerleave', handlePointerLeave);
        element.removeEventListener?.('pointerdown', handlePointerDown);
        element.removeEventListener?.('pointerup', handlePointerUp);
        element.removeEventListener?.('click', handleClick);
    };
}
