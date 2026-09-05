/**
 * @typedef {object} FileDialogOptions
 * @property {string} [defaultPath]
 * @property {string} [defaultExt]
 * @property {string} [defaultFilter]
 * @property {Array<{name: string, extensions: string[]}>} [filters]
 */

/**
 * Creates the host file-selection capability.
 *
 * @param {object} dependencies
 * @param {boolean} dependencies.isWindows
 * @param {{openFileDialog?: (filters?: Array<{name: string, extensions: string[]}>) => Promise<string | null>}} [dependencies.electronApi]
 * @param {{OpenFileSelectorDialog: (defaultPath?: string, defaultExt?: string, defaultFilter?: string) => Promise<string>}} [dependencies.appApi]
 * @returns {(options?: FileDialogOptions) => Promise<string | null | undefined>}
 */
export function createFileDialogAdapter({ isWindows, electronApi, appApi }) {
    return function openFileDialog({
        defaultPath = '',
        defaultExt = '',
        defaultFilter = 'All files (*.*)|*.*',
        filters
    } = {}) {
        if (isWindows) {
            return appApi.OpenFileSelectorDialog(
                defaultPath,
                defaultExt,
                defaultFilter
            );
        }
        return electronApi?.openFileDialog?.(filters);
    };
}

/**
 * Creates the host directory-selection capability.
 *
 * The Windows CEF bridge accepts the previous directory as a hint, while the
 * Electron bridge owns its dialog defaults and therefore takes no arguments.
 * Keeping that difference inside the adapter preserves the existing store
 * contract for both hosts.
 *
 * @param {object} dependencies
 * @param {boolean} dependencies.isWindows
 * @param {{openDirectoryDialog?: () => Promise<string | null>}} [dependencies.electronApi]
 * @param {{OpenFolderSelectorDialog: (defaultPath?: string) => Promise<string>}} [dependencies.appApi]
 * @returns {(options?: {defaultPath?: string}) => Promise<string | null | undefined>}
 */
export function createDirectoryDialogAdapter({
    isWindows,
    electronApi,
    appApi
}) {
    return function openDirectoryDialog({ defaultPath = '' } = {}) {
        if (isWindows) {
            return appApi.OpenFolderSelectorDialog(defaultPath);
        }
        return electronApi?.openDirectoryDialog?.();
    };
}

/**
 * Opens a file picker through the active host bridge.
 *
 * Host globals are resolved when called so the renderer can initialize the
 * CEF/Electron bridge before a picker is requested.
 *
 * @param {FileDialogOptions} [options]
 * @returns {Promise<string | null | undefined>}
 */
export function openFileDialog(options) {
    return createFileDialogAdapter({
        isWindows: WINDOWS,
        electronApi: window.electron,
        appApi: WINDOWS ? AppApi : undefined
    })(options);
}

/**
 * Opens a directory picker through the active host bridge.
 *
 * @param {{defaultPath?: string}} [options]
 * @returns {Promise<string | null | undefined>}
 */
export function openDirectoryDialog(options) {
    return createDirectoryDialogAdapter({
        isWindows: WINDOWS,
        electronApi: window.electron,
        appApi: WINDOWS ? AppApi : undefined
    })(options);
}
