import { toast as sonnerToast } from 'vue-sonner';

const TOAST_METHODS = [
    'dismiss',
    'error',
    'info',
    'loading',
    'success',
    'warning'
];

/**
 * Builds the small toast interface consumed by coordinators.
 *
 * @param {object} toastImplementation
 * @returns {object}
 */
export function createToastAdapter(toastImplementation) {
    return Object.fromEntries(
        TOAST_METHODS.map((method) => [
            method,
            (...args) => toastImplementation[method](...args)
        ])
    );
}

/**
 * Default renderer adapter. Coordinators depend on this interface instead of
 * importing the UI library directly.
 */
export const toast = createToastAdapter(sonnerToast);
