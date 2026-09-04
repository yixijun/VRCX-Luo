/**
 * Builds the grouped local favorite entity projection used by the world and
 * avatar coordinators. Database order is intentionally reversed within each
 * group by unshifting, matching the legacy read path.
 *
 * @param {Array<object>} favorites
 * @param {object} dependencies
 * @param {string} dependencies.idKey
 * @param {(id: string) => object|undefined} dependencies.resolveRef
 * @returns {Record<string, Array<object>>}
 */
export function projectLocalFavoriteEntities(favorites, { idKey, resolveRef }) {
    const localFavorites = Object.create(null);

    for (let i = 0; i < favorites.length; ++i) {
        const favorite = favorites[i];
        const groupName = favorite.groupName;
        if (!localFavorites[groupName]) {
            localFavorites[groupName] = [];
        }

        const objectId = favorite[idKey];
        const ref = resolveRef(objectId);
        localFavorites[groupName].unshift(
            typeof ref === 'undefined' ? { id: objectId } : ref
        );
    }

    if (Object.keys(localFavorites).length === 0) {
        localFavorites.Favorites = [];
    }

    return localFavorites;
}
