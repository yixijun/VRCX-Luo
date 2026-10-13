/**
 * Normalize the local world favorite search input before deciding whether
 * search mode is active or filtering entries.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeWorldFavoriteSearch(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

/**
 * Filter the already de-duplicated world favorite entries.
 *
 * @param {Array} entries
 * @param {unknown} searchInput
 * @param {'name'|'tag'} mode
 * @returns {Array}
 */
export function filterWorldFavoriteEntries(
    entries,
    searchInput,
    mode = 'name'
) {
    const search = normalizeWorldFavoriteSearch(searchInput);
    if (!search || !Array.isArray(entries)) {
        return [];
    }

    const isTagMode = mode === 'tag';
    return entries.filter((ref) => {
        if (
            !ref ||
            typeof ref.id === 'undefined' ||
            typeof ref.name === 'undefined'
        ) {
            return false;
        }
        if (isTagMode) {
            if (Array.isArray(ref.tags)) {
                return ref.tags.some(
                    (tag) =>
                        tag.startsWith('author_tag_') &&
                        tag.substring(11).toLowerCase().includes(search)
                );
            }
            return false;
        }
        const authorName = ref.authorName || '';
        return (
            ref.name.toLowerCase().includes(search) ||
            authorName.toLowerCase().includes(search)
        );
    });
}
