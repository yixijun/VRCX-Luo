const DEFAULT_POINTER = Object.freeze({
    x: 0.5,
    y: 0.5,
    visible: false,
    pressed: false,
    hand: 'right'
});

function clampUnit(value, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }
    return Math.min(1, Math.max(0, numericValue));
}

function parsePointerPayload(payload) {
    if (typeof payload !== 'string') {
        return payload;
    }

    try {
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

/**
 * Normalizes the host-side ray intersection payload before it reaches the UI.
 * The host may send either the CEF JSON argument or the Electron queue object.
 */
export function normalizeWristPointer(payload) {
    const value = parsePointerPayload(payload);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...DEFAULT_POINTER };
    }

    return {
        x: clampUnit(value.x, DEFAULT_POINTER.x),
        y: clampUnit(value.y, DEFAULT_POINTER.y),
        visible: value.visible !== false,
        pressed: value.pressed === true,
        hand: typeof value.hand === 'string' ? value.hand : DEFAULT_POINTER.hand
    };
}

export function getWristPointerStyle(pointer) {
    const normalizedPointer = normalizeWristPointer(pointer);
    return {
        left: `${normalizedPointer.x * 100}%`,
        top: `${normalizedPointer.y * 100}%`
    };
}

/**
 * Delivers a trigger release only to an explicitly opted-in wrist action.
 * Returning a boolean keeps the host bridge independent from DOM details.
 */
export function dispatchWristPointerClick(
    payload,
    documentRef = globalThis.document
) {
    const pointer = normalizeWristPointer(payload);
    if (!pointer.visible || !documentRef?.querySelector) {
        return false;
    }

    const wristElement = documentRef.querySelector('.wrist');
    if (!wristElement || !documentRef.elementFromPoint) {
        return false;
    }

    const rect = wristElement.getBoundingClientRect();
    const clientX = rect.left + pointer.x * rect.width;
    const clientY = rect.top + pointer.y * rect.height;
    const element = documentRef.elementFromPoint(clientX, clientY);
    const action = element?.closest?.('[data-vr-action]');
    if (
        !action ||
        !wristElement.contains(action) ||
        typeof action.click !== 'function'
    ) {
        return false;
    }

    action.click();
    return true;
}

export const defaultWristPointer = DEFAULT_POINTER;
