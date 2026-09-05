const SESSIONS_DATE_RANGE_MAX_DAYS = 7;

/**
 * @param {string} value
 * @returns {number}
 */
export function toSessionsEpoch(value) {
    if (!value) return 0;
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? 0 : ts;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeSessionsSearch(value) {
    return String(value ?? '')
        .trim()
        .toUpperCase();
}

/**
 * @param {{ dateRangeActive: boolean, search: string }} options
 * @returns {boolean}
 */
export function isSessionsGlobalSearchMode({ dateRangeActive, search }) {
    return !dateRangeActive && normalizeSessionsSearch(search).length > 0;
}

/**
 * @param {object} location
 * @param {{ dateRangeActive: boolean, dateFrom: string, dateTo: string }} options
 * @returns {boolean}
 */
export function isSessionsLocationInDateRange(
    location,
    { dateRangeActive, dateFrom, dateTo }
) {
    if (!dateRangeActive) {
        return true;
    }

    const createdAt = toSessionsEpoch(location?.created_at);
    if (dateFrom) {
        const from = toSessionsEpoch(dateFrom);
        if (createdAt < from) {
            return false;
        }
    }
    if (dateTo) {
        const to = toSessionsEpoch(dateTo);
        if (createdAt > to) {
            return false;
        }
    }
    return true;
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {[string, string]}
 */
export function clampSessionsDateRange(from, to) {
    const start = String(from ?? '');
    const end = String(to ?? '');
    const startTs = toSessionsEpoch(start);
    const endTs = toSessionsEpoch(end);
    if (!startTs || !endTs) {
        return [start, end];
    }

    const lower = Math.min(startTs, endTs);
    const upper = Math.max(startTs, endTs);
    if (upper - lower <= SESSIONS_DATE_RANGE_MAX_DAYS * 86400000) {
        return startTs <= endTs ? [start, end] : [end, start];
    }

    const clampedEnd = new Date(
        lower + SESSIONS_DATE_RANGE_MAX_DAYS * 86400000
    ).toISOString();
    return startTs <= endTs ? [start, clampedEnd] : [clampedEnd, start];
}

/**
 * @param {object} event
 * @param {string} value
 * @returns {boolean}
 */
export function isSessionsMemberSearchMatch(event, value) {
    if (!event) {
        return false;
    }

    return [event.displayName]
        .map((item) => String(item ?? '').toUpperCase())
        .some((item) => item.includes(value));
}

/**
 * @param {object} event
 * @param {string} value
 * @param {Function} gameLogSearchFilter
 * @returns {boolean}
 */
export function isSessionsEventSearchMatch(
    event,
    value,
    gameLogSearchFilter
) {
    if (!event) {
        return false;
    }
    if (event.type === 'JoinGroup' || event.type === 'LeftGroup') {
        return Array.isArray(event.members)
            ? event.members.some((member) =>
                  isSessionsMemberSearchMatch(member, value)
              )
            : false;
    }
    if (gameLogSearchFilter(event, value)) {
        return true;
    }
    return [event.displayName, event.videoName, event.videoUrl]
        .map((item) => String(item ?? '').toUpperCase())
        .some((item) => item.includes(value));
}

/**
 * @param {object} segment
 * @param {string} value
 * @returns {boolean}
 */
export function isSessionsSegmentHeaderSearchMatch(segment, value) {
    return [segment.worldName]
        .map((item) => String(item ?? '').toUpperCase())
        .some((item) => item.includes(value));
}

/**
 * @param {Array<object>} events
 * @param {{ vipFilter: boolean, eventFilters: Array<string> }} options
 * @returns {Array<object>}
 */
export function filterSessionsEventsByFilters(
    events,
    { vipFilter, eventFilters }
) {
    let result = events;

    if (vipFilter) {
        result = result.filter(
            (event) => event.type === 'VideoPlay' || event.isFavorite
        );
    }

    if (eventFilters.length > 0) {
        result = result.filter((event) => eventFilters.includes(event.type));
    }

    return result;
}

/**
 * @param {Array<object>} segments
 * @returns {Array<object>}
 */
export function dropEmptySessionsSegments(segments) {
    return segments.filter(
        (segment) => segment.events && segment.events.length > 0
    );
}

/**
 * @param {Array<object>} segments
 * @param {{ dateRangeActive: boolean, dateFrom: string, dateTo: string }} options
 * @returns {Array<object>}
 */
export function filterSessionsSegmentsByDateRange(
    segments,
    { dateRangeActive, dateFrom, dateTo }
) {
    if (!dateRangeActive) {
        return segments;
    }
    return segments.filter((segment) =>
        isSessionsLocationInDateRange(segment, {
            dateRangeActive,
            dateFrom,
            dateTo
        })
    );
}

/**
 * @param {Array<object>} segments
 * @param {{ search: string, searchLimit: number, gameLogSearchFilter: Function }} options
 * @returns {Array<object>}
 */
export function applySessionsSearchFilter(
    segments,
    { search, searchLimit, gameLogSearchFilter }
) {
    const value = normalizeSessionsSearch(search);
    if (!value) {
        return dropEmptySessionsSegments(segments);
    }

    const filtered = [];
    for (const segment of segments) {
        if (isSessionsSegmentHeaderSearchMatch(segment, value)) {
            filtered.push(segment);
            continue;
        }

        const events = Array.isArray(segment.events)
            ? segment.events.flatMap((event) => {
                  if (
                      event.type === 'JoinGroup' ||
                      event.type === 'LeftGroup'
                  ) {
                      if (!Array.isArray(event.members)) {
                          return [];
                      }
                      const matchedMembers = event.members.filter((member) =>
                          isSessionsMemberSearchMatch(member, value)
                      );
                      return matchedMembers.map((member) => ({
                          ...member,
                          type:
                              event.type === 'JoinGroup'
                                  ? 'OnPlayerJoined'
                                  : 'OnPlayerLeft',
                          location: segment.location
                      }));
                  }

                  return isSessionsEventSearchMatch(
                      event,
                      value,
                      gameLogSearchFilter
                  )
                      ? [event]
                      : [];
              })
            : [];
        if (events.length > 0) {
            filtered.push({
                ...segment,
                events
            });
        }
    }
    return filtered.slice(0, searchLimit);
}

export { SESSIONS_DATE_RANGE_MAX_DAYS };
