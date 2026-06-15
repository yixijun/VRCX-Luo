import queryRequest from '../api/queryRequest';

const USER_ID_RE =
    /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY_USER_ID = 'usr_00000000-0000-0000-0000-000000000000';
const ATTEMPT_COOLDOWN_MS = 10 * 60 * 1000;
const REQUEST_SPACING_MS = 700;
const MAX_CONCURRENT_REQUESTS = 2;
const MAX_PENDING_REQUESTS = 80;
const MAX_ATTEMPT_CACHE_SIZE = 2000;

const pendingQueue = [];
const pendingIds = new Set();
const inFlightIds = new Set();
const lastAttemptAt = new Map();

let activeRequests = 0;
let queueTimer = null;
let lastDispatchAt = 0;

function trimAttemptCache() {
    if (lastAttemptAt.size <= MAX_ATTEMPT_CACHE_SIZE) {
        return;
    }
    const firstKey = lastAttemptAt.keys().next().value;
    if (firstKey) {
        lastAttemptAt.delete(firstKey);
    }
}

export function isHydratableUserId(userId) {
    return Boolean(userId && userId !== EMPTY_USER_ID && USER_ID_RE.test(userId));
}

function recentlyAttempted(userId) {
    const lastAttempt = lastAttemptAt.get(userId) || 0;
    return Date.now() - lastAttempt < ATTEMPT_COOLDOWN_MS;
}

function scheduleQueue(delay = 0) {
    if (queueTimer) {
        return;
    }
    queueTimer = window.setTimeout(processQueue, delay);
}

function processQueue() {
    queueTimer = null;

    while (
        activeRequests < MAX_CONCURRENT_REQUESTS &&
        pendingQueue.length > 0
    ) {
        const elapsed = Date.now() - lastDispatchAt;
        if (lastDispatchAt && elapsed < REQUEST_SPACING_MS) {
            scheduleQueue(REQUEST_SPACING_MS - elapsed);
            return;
        }

        const userId = pendingQueue.shift();
        pendingIds.delete(userId);

        if (inFlightIds.has(userId)) {
            continue;
        }

        activeRequests += 1;
        inFlightIds.add(userId);
        lastDispatchAt = Date.now();

        queryRequest
            .fetch('user.dialog', { userId })
            .catch((err) => {
                console.debug('Failed to hydrate user identity:', userId, err);
            })
            .finally(() => {
                activeRequests -= 1;
                inFlightIds.delete(userId);
                if (pendingQueue.length > 0) {
                    scheduleQueue(REQUEST_SPACING_MS);
                }
            });
    }
}

export function shouldHydrateUserIdentity({
    user = null,
    userId = '',
    imageUrl = '',
    imageResolver = null
} = {}) {
    const resolvedUserId = userId || user?.id || user?.userId || '';
    if (!isHydratableUserId(resolvedUserId) || imageUrl) {
        return false;
    }
    if (!user) {
        return true;
    }
    return !imageResolver?.(user, true, '64');
}

export function hydrateUserIdentity(userId) {
    if (!isHydratableUserId(userId)) {
        return false;
    }
    if (
        recentlyAttempted(userId) ||
        pendingIds.has(userId) ||
        inFlightIds.has(userId) ||
        pendingQueue.length >= MAX_PENDING_REQUESTS
    ) {
        return false;
    }

    lastAttemptAt.set(userId, Date.now());
    trimAttemptCache();
    pendingIds.add(userId);
    pendingQueue.push(userId);
    scheduleQueue();
    return true;
}

export function __resetUserIdentityHydrationForTests() {
    pendingQueue.length = 0;
    pendingIds.clear();
    inFlightIds.clear();
    lastAttemptAt.clear();
    activeRequests = 0;
    lastDispatchAt = 0;
    if (queueTimer) {
        window.clearTimeout(queueTimer);
        queueTimer = null;
    }
}
