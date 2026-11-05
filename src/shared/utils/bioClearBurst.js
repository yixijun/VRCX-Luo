const BIO_CLEAR_CLUSTER_WINDOW_MS = 5 * 60 * 1000;

/**
 * Find the newest run of Bio-clear records containing at least three rows in
 * any five-minute window. User identity is intentionally ignored.
 * @param {Array<{id: number, createdAt: string}>} records
 * @param {number} [windowMs]
 * @returns {{rows: Array<object>, start: object, end: object} | null}
 */
export function findSuspiciousBioClearBurst(
    records,
    windowMs = BIO_CLEAR_CLUSTER_WINDOW_MS
) {
    const sorted = records
        .map((record) => ({ ...record, time: Date.parse(record.createdAt) }))
        .filter((record) => Number.isFinite(record.time))
        .sort((a, b) => a.time - b.time || a.id - b.id);

    for (let end = sorted.length - 1; end >= 2; end--) {
        let start = end;
        while (
            start > 0 &&
            sorted[end].time - sorted[start - 1].time <= windowMs
        ) {
            start--;
        }
        if (end - start + 1 < 3) continue;

        // Treat events separated by no more than the detection window as one
        // burst, including any matching rows newer than the triggering triple.
        let burstStart = start;
        let burstEnd = end;
        while (
            burstStart > 0 &&
            sorted[burstStart].time - sorted[burstStart - 1].time <= windowMs
        ) {
            burstStart--;
        }
        while (
            burstEnd < sorted.length - 1 &&
            sorted[burstEnd + 1].time - sorted[burstEnd].time <= windowMs
        ) {
            burstEnd++;
        }

        const rows = sorted.slice(burstStart, burstEnd + 1);
        return { rows, start: rows[0], end: rows.at(-1) };
    }

    return null;
}
