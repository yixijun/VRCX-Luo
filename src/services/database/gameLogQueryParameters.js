/**
 * Resolves the legacy game-log filter list into the boolean flags used by
 * the read queries. An empty list keeps the historical "all types" meaning.
 *
 * @param {Array<string>} filters
 * @param {Record<string, string>} filterMap
 * @returns {Record<string, boolean>}
 */
export function resolveGameLogFilterFlags(filters, filterMap) {
    const flags = /** @type {Record<string, boolean>} */ (
        Object.fromEntries(
            Object.values(filterMap).map((key) => [key, false])
        )
    );

    if (filters.length === 0) {
        for (const key of Object.values(filterMap)) {
            flags[key] = true;
        }
        return flags;
    }

    for (const filter of filters) {
        const key = filterMap[filter];
        if (key) {
            flags[key] = true;
        }
    }
    return flags;
}

/**
 * Builds the parameterized VIP predicate used by location/search queries.
 *
 * @param {Array<string>} vipList
 * @returns {{ query: string, args: Record<string, string> }}
 */
export function buildParameterizedVipFilter(vipList) {
    let query = '';
    const args = /** @type {Record<string, string>} */ ({});
    if (vipList.length > 0) {
        const placeholders = [];
        vipList.forEach((vip, i) => {
            const key = `@vip_${i}`;
            args[key] = vip;
            placeholders.push(key);
        });
        query = `AND user_id IN (${placeholders.join(', ')})`;
    }
    return { query, args };
}

/**
 * Builds the escaped literal VIP predicate retained by the lookup query.
 *
 * @param {Array<string>} vipList
 * @returns {string}
 */
export function buildEscapedVipFilter(vipList) {
    if (vipList.length === 0) {
        return '';
    }
    const values = vipList.map((vip) => `'${vip.replaceAll("'", "''")}'`);
    return `AND user_id IN (${values.join(', ')})`;
}

export const GAME_LOG_LOCATION_FILTER_MAP = {
    Location: 'location',
    OnPlayerJoined: 'onplayerjoined',
    OnPlayerLeft: 'onplayerleft',
    PortalSpawn: 'portalspawn',
    VideoPlay: 'videoplay',
    StringLoad: 'resourceload_string',
    ImageLoad: 'resourceload_image'
};

export const GAME_LOG_TABLE_FILTER_MAP = {
    ...GAME_LOG_LOCATION_FILTER_MAP,
    Event: 'msgevent',
    External: 'external'
};
