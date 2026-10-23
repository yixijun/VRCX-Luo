import { shallowRef } from 'vue';

export const vrFilePicker = shallowRef(null);
let resolvePicker;
let pickerId = 0;
/** @param {string | string[]} path */
export function finishVrFilePicker(path = '') {
    vrFilePicker.value = null;
    resolvePicker?.(path);
    resolvePicker = null;
}
export async function chooseVrUploadFiles(mode, options = {}) {
    const pickerMode =
        mode === 'selectMultiple'
            ? 'files'
            : ['directory', 'save'].includes(mode)
              ? mode
              : 'file';
    const result = await openVrFilePicker(pickerMode, options);
    return Array.isArray(result) ? result : result ? [result] : [];
}

export function buildVrSavePath(folder, name) {
    if (
        !folder ||
        typeof name !== 'string' ||
        !name.trim() ||
        /^[.]+$/.test(name) ||
        /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
        /[. ]$/.test(name)
    )
        return '';
    const separator = folder.includes('\\') ? '\\' : '/';
    return `${folder.replace(/[\\/]+$/, '')}${separator}${name}`;
}
export function openVrFilePicker(mode, options = {}) {
    finishVrFilePicker();
    vrFilePicker.value = { mode, ...options, id: ++pickerId };
    return new Promise((resolve) => {
        resolvePicker = resolve;
    });
}
export function matchesVrFileFilter(name, options = {}) {
    const extensions =
        options.filters?.flatMap((filter) => filter.extensions || []) ||
        (options.defaultFilter?.match(/\*\.([a-z0-9*]+)/gi) || []).map(
            (pattern) => pattern.slice(2)
        );
    if (
        !extensions?.length ||
        extensions.includes('*') ||
        options.defaultFilter?.includes('*.*')
    )
        return true;
    return extensions.some((extension) =>
        name
            .toLowerCase()
            .endsWith(`.${extension.replace(/^\./, '').toLowerCase()}`)
    );
}
