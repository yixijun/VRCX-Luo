/**
 * Find the pending relationship suggestion that may be shown for a user.
 *
 * @param {object} options
 * @param {boolean} options.enabled
 * @param {string} options.userId
 * @param {Array<object>} options.suggestions
 * @param {Set<string>} options.ignoredKeys
 * @param {(userIdA: string, userIdB: string) => boolean} options.isManualRelation
 * @returns {object|undefined}
 */
export function findRelationSuggestionForUser({
    enabled,
    userId,
    suggestions,
    ignoredKeys,
    isManualRelation
}) {
    if (!enabled) {
        return undefined;
    }

    return suggestions.find(
        (suggestion) =>
            (suggestion.userIdA === userId || suggestion.userIdB === userId) &&
            !ignoredKeys.has(suggestion.key) &&
            !isManualRelation(suggestion.userIdA, suggestion.userIdB)
    );
}
