import { database } from './database';
import {
    buildFriendActivitySessions,
    getCurrentFriendActivitySession,
    getFriendActivityRangeStart
} from '../shared/utils/friendActivity';

const DEFAULT_PAGE_SIZE = 25;
const RAW_PAGE_LIMIT = 500;
const TRACKING_STARTED_AT = Date.now();

function toIso(timestamp) {
    return new Date(timestamp).toISOString();
}

async function loadFriendActivityPage({
    userId,
    rangeDays = 30,
    beforeAt = null,
    limit = DEFAULT_PAGE_SIZE,
    currentSession = null,
    unknownTailStartAt = null,
    now = Date.now
}) {
    if (!userId) {
        return { items: [], hasMore: false, nextBeforeAt: null };
    }

    const nowMs = now();
    const rangeStartMs = getFriendActivityRangeStart(rangeDays, nowMs);
    const pageEndMs = beforeAt ? Math.min(Number(beforeAt), nowMs) : nowMs;
    const rawLimit = Math.max(RAW_PAGE_LIMIT, Number(limit) * 12);
    const [rows, statusRows] = await Promise.all([
        database.getFriendActivityRows({
            userId,
            fromIso: toIso(rangeStartMs),
            beforeIso: beforeAt ? toIso(pageEndMs) : '',
            limit: rawLimit
        }),
        database.getFriendActivityStatusRows({
            userId,
            fromIso: toIso(rangeStartMs),
            beforeIso: beforeAt ? toIso(pageEndMs) : ''
        })
    ]);

    const items = buildFriendActivitySessions({
        rows,
        statusRows,
        rangeStartMs,
        rangeEndMs: pageEndMs,
        currentSession: beforeAt ? null : currentSession,
        unknownTailStartAt: beforeAt ? null : unknownTailStartAt
    });
    const visibleItems = items.slice(
        0,
        Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE)
    );
    const lastItem = visibleItems[visibleItems.length - 1];
    const nextBeforeAt = lastItem
        ? lastItem.sourceCreatedAt || lastItem.endAt || lastItem.startAt
        : null;

    return {
        items: visibleItems,
        hasMore: rows.length >= rawLimit || items.length > visibleItems.length,
        nextBeforeAt
    };
}

function getFriendActivityCurrentState(
    ref,
    worldName = '',
    groupName = '',
    now = Date.now()
) {
    if (ref?.state !== 'online') {
        return { currentSession: null, unknownTailStartAt: null };
    }
    const currentSession = getCurrentFriendActivitySession(
        ref,
        worldName,
        groupName,
        now
    );
    if (currentSession && currentSession.startAt >= TRACKING_STARTED_AT) {
        return { currentSession, unknownTailStartAt: null };
    }
    return { currentSession: null, unknownTailStartAt: TRACKING_STARTED_AT };
}

async function loadFriendActivityPreview({
    userId,
    rangeDays = 30,
    currentSession = null,
    unknownTailStartAt = null,
    now = Date.now
}) {
    const result = await loadFriendActivityPage({
        userId,
        rangeDays,
        limit: 5,
        currentSession,
        unknownTailStartAt,
        now
    });
    return result.items;
}

export {
    getFriendActivityCurrentState,
    loadFriendActivityPage,
    loadFriendActivityPreview
};
