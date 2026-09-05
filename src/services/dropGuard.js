/**
 * Registers the global drop guard used by the renderer shell.
 *
 * @param {object} documentRef
 * @returns {() => void}
 */
export function installBodyDropGuard(documentRef) {
    const doc = /** @type {{body: {
        addEventListener: (eventName: string, listener: Function) => void,
        removeEventListener: (eventName: string, listener: Function) => void
    }}} */ (documentRef);
    const body = doc.body;

    /** @param {{preventDefault: () => void}} event */
    function preventDrop(event) {
        event.preventDefault();
    }

    body.addEventListener('drop', preventDrop);
    return () => {
        body.removeEventListener('drop', preventDrop);
    };
}
