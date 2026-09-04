/**
 * Resolves an image input selector without exposing DOM access to a coordinator.
 *
 * @param {string|function|object} selector
 * @param {Document} [documentRef]
 * @returns {object|null}
 */
export function resolveInputElement(selector, documentRef = document) {
    if (!selector) {
        return null;
    }
    if (typeof selector === 'function') {
        return selector();
    }
    if (typeof selector === 'string') {
        return documentRef.querySelector(selector);
    }
    return selector;
}
