/**
 * Projects Group language ids into the localized entries shown by the UI.
 *
 * Unknown ids are ignored exactly as in the legacy coordinator, while empty
 * or false-y localized values remain valid entries.
 *
 * @param {object} dependencies
 * @param {Array<string>|undefined} dependencies.languages
 * @param {Record<string, unknown>} dependencies.subsetOfLanguages
 * @returns {Array<{key: string, value: unknown}>}
 */
export function createGroupLanguageEntries({ languages, subsetOfLanguages }) {
    const entries = [];
    if (!languages) {
        return entries;
    }
    for (const language of languages) {
        const value = subsetOfLanguages[language];
        if (typeof value === 'undefined') {
            continue;
        }
        entries.push({
            key: language,
            value
        });
    }
    return entries;
}
