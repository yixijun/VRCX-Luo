/**
 * Creates the serialized queue used to mark notifications as seen.
 *
 * The queue owns only deduplication and retry sequencing. Store mutations and
 * request implementations are injected at the seam so callers retain their
 * existing state and API behavior.
 *
 * @param {object} dependencies
 * @param {Function} dependencies.executeWithBackoff
 * @param {Function} dependencies.seeNotificationV2
 * @param {Function} dependencies.seeNotification
 * @param {Function} dependencies.onV2Seen
 * @param {Function} dependencies.onLegacySeen
 * @param {Function} dependencies.onV2Failure
 * @param {Function} [dependencies.warn]
 * @returns {object}
 */
export function createNotificationSeenQueue({
    executeWithBackoff,
    seeNotificationV2,
    seeNotification,
    onV2Seen,
    onLegacySeen,
    onV2Failure,
    warn = console.warn
}) {
    const queue = [];
    const seenIds = new Set();
    let processing = false;

    async function processQueue() {
        if (processing) return;
        processing = true;
        let item;
        while ((item = queue.shift())) {
            const { id, version } = item;
            try {
                await executeWithBackoff(
                    async () => {
                        if (version >= 2) {
                            const args = await seeNotificationV2({
                                notificationId: id
                            });
                            onV2Seen({
                                params: { notificationId: id },
                                json: { ...args.json, seen: true }
                            });
                        } else {
                            await seeNotification({ notificationId: id });
                            onLegacySeen(id);
                        }
                    },
                    {
                        maxRetries: 3,
                        baseDelay: 1000,
                        shouldRetry: (err) =>
                            err?.status === 429 ||
                            (err?.message || '').includes('429')
                    }
                );
            } catch {
                warn('Failed to mark notification as seen:', id);
                if (version >= 2) {
                    onV2Failure(id);
                }
            }
        }
        processing = false;
    }

    function enqueue(id, version = 1) {
        if (seenIds.has(id)) return;
        seenIds.add(id);
        queue.push({ id, version });
        processQueue();
    }

    return Object.freeze({ enqueue, processQueue });
}
