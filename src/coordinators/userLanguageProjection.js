/**
 * Projects the configured spoken-language map into the dialog list shape.
 * `for...in` is intentional: it preserves the legacy enumerable-key order
 * and inherited enumerable behavior of the configuration payload.
 *
 * @param {Record<string, unknown>|undefined|null} languages
 * @returns {Array<{key: string, value: unknown}>}
 */
export function createUserLanguageEntries(languages) {
    const data = [];
    if (!languages) {
        return data;
    }
    for (const key in languages) {
        data.push({
            key,
            value: languages[key]
        });
    }
    return data;
}
