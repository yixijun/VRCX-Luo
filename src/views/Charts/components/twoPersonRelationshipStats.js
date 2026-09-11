import { parseLocation } from '@/shared/utils/locationParser';

function getVisitCount(instance) {
    const count = Number(instance?.joinLeavesCount);
    return Number.isFinite(count) && count > 0 ? count : 1;
}

/**
 * Count the shared room visits represented by the grouped relationship rows.
 * A row can represent multiple entries into the same room, so the grouped
 * room count alone is not enough for visit statistics.
 *
 * @param {Array<{joinLeavesCount?: number}>} instances
 * @returns {number}
 */
function countSharedRoomVisits(instances) {
    if (!Array.isArray(instances)) return 0;

    return instances.reduce(
        (total, instance) => total + getVisitCount(instance),
        0
    );
}

/**
 * Build a compact ranking of worlds visited together by two players.
 * Different room instances of the same world are merged and their visit
 * counts are accumulated.
 *
 * @param {Array<{
 *     location?: string,
 *     joinLeavesCount?: number,
 *     coexistenceTime?: number,
 *     friendALeave?: number
 * }>} instances
 * @param {number} [limit] Optional positive cap. Omit it to return every world.
 * @returns {Array<{
 *     worldId: string,
 *     latestLocation: string,
 *     visitCount: number,
 *     totalCoexistenceTime: number
 * }>}
 */
function buildSharedWorldRanking(instances, limit = null) {
    if (!Array.isArray(instances)) return [];

    const grouped = new Map();
    for (const instance of instances) {
        const location = String(instance?.location || '');
        const worldId = parseLocation(location).worldId;
        if (!worldId) continue;

        const leaveAt = Number(instance?.friendALeave);
        const current = grouped.get(worldId);
        if (!current) {
            grouped.set(worldId, {
                worldId,
                latestLocation: location,
                latestVisitedAt: Number.isFinite(leaveAt) ? leaveAt : 0,
                visitCount: getVisitCount(instance),
                totalCoexistenceTime: Math.max(
                    0,
                    Number(instance?.coexistenceTime) || 0
                )
            });
            continue;
        }

        current.visitCount += getVisitCount(instance);
        current.totalCoexistenceTime += Math.max(
            0,
            Number(instance?.coexistenceTime) || 0
        );
        if (Number.isFinite(leaveAt) && leaveAt > current.latestVisitedAt) {
            current.latestVisitedAt = leaveAt;
            current.latestLocation = location;
        }
    }

    const maxItems =
        Number.isFinite(Number(limit)) && Number(limit) > 0
            ? Math.floor(Number(limit))
            : null;
    const ranking = Array.from(grouped.values())
        .sort(
            (a, b) =>
                b.visitCount - a.visitCount ||
                b.totalCoexistenceTime - a.totalCoexistenceTime ||
                b.latestVisitedAt - a.latestVisitedAt
        )
        .slice(0, maxItems ?? undefined);

    return ranking.map(({ latestVisitedAt, ...item }) => item);
}

export { buildSharedWorldRanking, countSharedRoomVisits };
