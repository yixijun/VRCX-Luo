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

    return instances.reduce((total, instance) => {
        const count = Number(instance?.joinLeavesCount);
        return total + (Number.isFinite(count) && count > 0 ? count : 1);
    }, 0);
}

export { countSharedRoomVisits };
