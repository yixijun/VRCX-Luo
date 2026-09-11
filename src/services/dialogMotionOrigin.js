import { ref } from 'vue';

/**
 * The most recent UI element that requested an origin-aware dialog.
 *
 * Keeping this state outside a domain store avoids changing the public dialog
 * coordinator signatures while still allowing a card to provide its geometry.
 */
export const dialogMotionOrigin = ref(null);

function normalizeRect(rect) {
    if (!rect) {
        return null;
    }

    const values = ['left', 'top', 'width', 'height'].map((key) =>
        Number(rect[key])
    );
    if (
        values.some((value) => !Number.isFinite(value)) ||
        values[2] <= 0 ||
        values[3] <= 0
    ) {
        return null;
    }

    const [left, top, width, height] = values;
    return { left, top, width, height };
}

/**
 * Capture the visible rectangle of a source element (or a DOMRect-like
 * object) for the next origin-aware dialog transition.
 *
 * @param {Element|DOMRect|object|null} source
 */
export function setDialogMotionOrigin(source) {
    let rect = source;
    if (typeof source?.getBoundingClientRect === 'function') {
        try {
            rect = source.getBoundingClientRect();
        } catch {
            rect = null;
        }
    }

    dialogMotionOrigin.value = normalizeRect(rect);
}

export function clearDialogMotionOrigin() {
    dialogMotionOrigin.value = null;
}
