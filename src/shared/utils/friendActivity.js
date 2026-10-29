import { parseLocation } from './locationParser';

const DAY_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_GAP_MIN_MS = 60 * 1000;
const RESTRICTED_STATUSES = new Set(['ask me', 'busy']);

function toTimestamp(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : NaN;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : NaN;
}

function toDuration(value) {
    const duration = Number(value);
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function normalizeStatus(status) {
    return String(status || '')
        .trim()
        .toLowerCase()
        .replaceAll('_', ' ');
}

function isRestrictedStatus(status) {
    return RESTRICTED_STATUSES.has(normalizeStatus(status));
}

function getPrivacyState(location, status) {
    const parsed = parseLocation(location);
    if (isRestrictedStatus(status)) {
        if (
            parsed.isPrivate ||
            parsed.isOffline ||
            parsed.isTraveling ||
            !location
        ) {
            return 'suspected-private';
        }
        if (!parsed.isRealInstance) {
            return 'unknown';
        }
        return 'status-restricted';
    }
    if (
        parsed.isPrivate ||
        parsed.isOffline ||
        parsed.isTraveling ||
        !parsed.isRealInstance
    ) {
        return 'unknown';
    }
    return 'confirmed';
}

function clipSegment(startAt, endAt, rangeStartMs, rangeEndMs) {
    const start = Math.max(startAt, rangeStartMs);
    const end = Math.min(endAt, rangeEndMs);
    return end > start ? { startAt: start, endAt: end } : null;
}

function makeRecord({
    id,
    location,
    worldName = '',
    groupName = '',
    startAt,
    endAt,
    isOpenTail = false,
    status = '',
    statusDescription = '',
    sourceCreatedAt = null,
    sourceKind = 'gps'
}) {
    const privacyState = getPrivacyState(location, status);
    return {
        id,
        location: location || '',
        worldName: worldName || '',
        groupName: groupName || '',
        startAt,
        endAt: isOpenTail ? null : endAt,
        durationMs: Math.max(0, endAt - startAt),
        isOpenTail,
        status: normalizeStatus(status),
        statusDescription: statusDescription || '',
        privacyState,
        isKnownLocation:
            privacyState === 'confirmed' ||
            privacyState === 'status-restricted',
        sourceCreatedAt,
        sourceKind
    };
}

function applyStatusTimeline(baseRecord, statusEvents, rangeEndMs) {
    const { startAt, endAt: visibleEndAt } = baseRecord;
    const endAt = baseRecord.isOpenTail ? rangeEndMs : visibleEndAt;
    if (!Number.isFinite(endAt) || endAt <= startAt) {
        return [];
    }

    let status = '';
    let statusDescription = '';
    for (const event of statusEvents) {
        if (event.createdAt <= startAt) {
            status = event.status;
            statusDescription = event.statusDescription;
        } else {
            break;
        }
    }

    const boundaries = statusEvents.filter(
        (event) => event.createdAt > startAt && event.createdAt < endAt
    );
    const records = [];
    let cursor = startAt;
    let segmentIndex = 0;
    for (const boundary of [...boundaries, { createdAt: endAt }]) {
        const segmentEnd = Math.min(boundary.createdAt, endAt);
        if (segmentEnd > cursor) {
            records.push(
                makeRecord({
                    ...baseRecord,
                    id: `${baseRecord.id}:${segmentIndex++}`,
                    startAt: cursor,
                    endAt: segmentEnd,
                    isOpenTail: baseRecord.isOpenTail && segmentEnd === endAt,
                    status,
                    statusDescription
                })
            );
        }
        if (boundary.createdAt < endAt) {
            status = boundary.status;
            statusDescription = boundary.statusDescription;
            cursor = boundary.createdAt;
        }
    }
    return records;
}

function createRawSessions(rows, rangeStartMs, rangeEndMs) {
    const orderedRows = [...(rows || [])]
        .map((row) => ({
            ...row,
            createdAtMs: toTimestamp(row.createdAt || row.created_at)
        }))
        .filter((row) => Number.isFinite(row.createdAtMs))
        .sort((a, b) => a.createdAtMs - b.createdAtMs);

    const worldNames = new Map();
    const groupNames = new Map();
    for (const row of orderedRows) {
        const location = row.location || '';
        if (location && row.worldName) {
            worldNames.set(location, row.worldName);
        }
        if (location && row.groupName) {
            groupNames.set(location, row.groupName);
        }
    }

    const sessions = [];
    for (const row of orderedRows) {
        const location =
            row.kind === 'gps'
                ? row.previousLocation || ''
                : row.location || '';
        const duration = toDuration(row.time);
        if (!location || duration <= 0) {
            continue;
        }
        const clipped = clipSegment(
            row.createdAtMs - duration,
            row.createdAtMs,
            rangeStartMs,
            rangeEndMs
        );
        if (!clipped) {
            continue;
        }
        sessions.push({
            id: `${row.kind}:${row.sourceId ?? row.id ?? row.createdAtMs}`,
            location,
            worldName:
                row.kind === 'gps'
                    ? worldNames.get(location) || ''
                    : row.worldName || worldNames.get(location) || '',
            groupName:
                row.kind === 'gps'
                    ? groupNames.get(location) || ''
                    : row.groupName || groupNames.get(location) || '',
            ...clipped,
            isOpenTail: false,
            sourceCreatedAt: row.createdAtMs,
            sourceKind: row.kind
        });
    }
    return sessions;
}

function createUnknownGaps(sessions) {
    const ordered = [...sessions].sort((a, b) => a.startAt - b.startAt);
    const gaps = [];
    for (let index = 1; index < ordered.length; index++) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        if (
            previous.sourceKind === 'unknown' ||
            current.sourceKind === 'unknown'
        ) {
            continue;
        }
        if (current.startAt - previous.endAt < UNKNOWN_GAP_MIN_MS) {
            continue;
        }
        gaps.push({
            id: `unknown:${previous.endAt}:${current.startAt}`,
            location: '',
            worldName: '',
            groupName: '',
            startAt: previous.endAt,
            endAt: current.startAt,
            isOpenTail: false,
            sourceCreatedAt: current.startAt,
            sourceKind: 'unknown'
        });
    }
    return gaps;
}

function normalizeStatusEvents(statusRows, rangeStartMs, rangeEndMs) {
    return [...(statusRows || [])]
        .map((row) => ({
            createdAt: toTimestamp(row.createdAt || row.created_at),
            status: normalizeStatus(row.status),
            statusDescription:
                row.statusDescription || row.status_description || ''
        }))
        .filter(
            (event) =>
                Number.isFinite(event.createdAt) &&
                event.createdAt <= rangeEndMs
        )
        .sort((a, b) => a.createdAt - b.createdAt)
        .filter((event, index, events) => {
            if (event.createdAt >= rangeStartMs) {
                return true;
            }
            const firstInRange = events.findIndex(
                (candidate) => candidate.createdAt >= rangeStartMs
            );
            return (
                index ===
                (firstInRange < 0 ? events.length - 1 : firstInRange - 1)
            );
        });
}

/**
 * Builds room-activity records from the existing GPS and presence feeds.
 * A GPS/offline row closes the preceding location; the current cached
 * location can be passed separately as an open-ended record.
 */
function buildFriendActivitySessions({
    rows = [],
    statusRows = [],
    rangeStartMs = 0,
    rangeEndMs = Date.now(),
    currentSession = null,
    unknownTailStartAt = null
}) {
    const boundedStart = Math.max(0, Number(rangeStartMs) || 0);
    const boundedEnd = Number(rangeEndMs) || Date.now();
    const rawSessions = createRawSessions(rows, boundedStart, boundedEnd);
    if (currentSession?.location) {
        const startAt = toTimestamp(currentSession.startAt);
        if (Number.isFinite(startAt) && startAt < boundedEnd) {
            const clipped = clipSegment(
                startAt,
                boundedEnd,
                boundedStart,
                boundedEnd
            );
            if (clipped) {
                rawSessions.push({
                    id: 'current',
                    location: currentSession.location,
                    worldName: currentSession.worldName || '',
                    groupName: currentSession.groupName || '',
                    ...clipped,
                    isOpenTail: true,
                    sourceCreatedAt: null,
                    sourceKind: 'current'
                });
            }
        }
    }

    const unknownStartAt = toTimestamp(unknownTailStartAt);
    if (Number.isFinite(unknownStartAt) && unknownStartAt < boundedEnd) {
        const clipped = clipSegment(
            unknownStartAt,
            boundedEnd,
            boundedStart,
            boundedEnd
        );
        if (clipped) {
            rawSessions.push({
                id: 'unknown-tail',
                location: '',
                worldName: '',
                groupName: '',
                ...clipped,
                isOpenTail: true,
                sourceCreatedAt: null,
                sourceKind: 'unknown'
            });
        }
    }

    const statusEvents = normalizeStatusEvents(
        statusRows,
        boundedStart,
        boundedEnd
    );
    const sessionsWithUnknownGaps = [
        ...rawSessions,
        ...createUnknownGaps(rawSessions)
    ];
    const records = sessionsWithUnknownGaps.flatMap((session) =>
        applyStatusTimeline(session, statusEvents, boundedEnd)
    );

    return records.sort((a, b) => {
        const aTime = a.isOpenTail ? boundedEnd : a.endAt || 0;
        const bTime = b.isOpenTail ? boundedEnd : b.endAt || 0;
        return bTime - aTime || b.startAt - a.startAt;
    });
}

function getFriendActivityRangeStart(rangeDays, now = Date.now()) {
    const days = Number(rangeDays);
    return days > 0 ? now - days * DAY_MS : 0;
}

function getCurrentFriendActivitySession(
    ref,
    worldName = '',
    groupName = '',
    now = Date.now()
) {
    const location = ref?.location || '';
    const startAt = toTimestamp(ref?.$location_at);
    const parsed = parseLocation(location);
    if (
        !location ||
        ref?.state !== 'online' ||
        parsed.isOffline ||
        parsed.isTraveling ||
        !Number.isFinite(startAt) ||
        startAt >= now
    ) {
        return null;
    }
    return { location, startAt, worldName, groupName };
}

function navigateToFriendActivityPage({
    userId,
    period = '30',
    closeDialog,
    push
}) {
    if (!userId || typeof closeDialog !== 'function' || typeof push !== 'function') {
        return false;
    }

    closeDialog();
    push({
        name: 'friend-activity',
        params: { id: userId },
        query: { period: period === '0' ? 'all' : period }
    });
    return true;
}

export {
    DAY_MS,
    RESTRICTED_STATUSES,
    buildFriendActivitySessions,
    getCurrentFriendActivitySession,
    getFriendActivityRangeStart,
    isRestrictedStatus,
    navigateToFriendActivityPage,
    toTimestamp
};
