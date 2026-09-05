/**
 * @typedef {{
 *     type?: string,
 *     id?: string,
 *     label?: string,
 *     [key: string]: unknown
 * }} DialogCrumb
 */

/**
 * Appends a dialog crumb while preserving the existing de-duplication rules.
 *
 * @param {DialogCrumb[]} items
 * @param {DialogCrumb} data
 * @returns {void}
 */
export function pushDialogCrumb(items, data) {
    const { type, id, label } = data;
    if (!type || !id) {
        return;
    }
    const last = items[items.length - 1];
    if (last && last.type === type && last.id === id) {
        if (label && last.label !== label) {
            last.label = label;
        }
        return;
    }
    const existingIndex = items.findIndex(
        (item) => item.type === type && item.id === id
    );
    if (existingIndex !== -1) {
        items.splice(existingIndex + 1);
        if (label) {
            items[existingIndex].label = label;
        }
        return;
    }
    if (!data.label) {
        data.label = id;
    }
    items.push(data);
}

/**
 * Updates the label of an existing dialog crumb.
 *
 * @param {DialogCrumb[]} items
 * @param {string} type
 * @param {string} id
 * @param {string} label
 * @returns {void}
 */
export function setDialogCrumbLabel(items, type, id, label) {
    if (!type || !id || !label) {
        return;
    }
    const item = items.find(
        (entry) => entry.type === type && entry.id === id
    );
    if (item) {
        item.label = label;
    }
}

/**
 * Truncates dialog crumbs after the requested target.
 *
 * @param {DialogCrumb[]} items
 * @param {number} index
 * @returns {void}
 */
export function jumpDialogCrumb(items, index) {
    if (index < 0 || index >= items.length) {
        return;
    }
    items.splice(index + 1);
}

/**
 * Creates the empty dialog crumb state used by the Store.
 *
 * @returns {DialogCrumb[]}
 */
export function clearDialogCrumbs() {
    return [];
}
