/**
 * aggregatedView – utilities for building the merged cross-account view.
 *
 * Provides:
 *  - mergeFriends(sessions, primaryFriends)  →  Map of merged friend ctx objects
 *  - lookupAggregatedFeed(prefixes, filters, vipList, limit)  →  merged feed rows
 */

import { accountHub } from './accountHub.js';
import sqliteService from './sqlite.js';

// ── Merged friends list ────────────────────────────────────────────────────────

/**
 * Build a merged Map of friend context objects from all active sessions.
 * For each userId, we pick the "best" location (most specific / most recent).
 * The resulting ctx objects include a `$accountIds` array indicating which
 * accounts consider this person a friend.
 *
 * @param {import('../stores/friend').SortedFriend[]} primarySortedFriends
 *   The `sortedFriends` array from the primary account's FriendStore.
 * @returns {Map<string, object>}
 */
export function mergeFriends(primarySortedFriends) {
    const merged = new Map();

    // 1. Start with the primary account's friends
    for (const ctx of primarySortedFriends) {
        if (!ctx || !ctx.id) continue;
        const entry = {
            ...ctx,
            $accountIds: [accountHub.primaryId],
            $accountColor: accountHub.getAccountColor(accountHub.primaryId)
        };
        merged.set(ctx.id, entry);
    }

    // 2. Overlay secondary accounts
    for (const session of accountHub.secondarySessions) {
        for (const [userId, ctx] of session.friendsCache) {
            if (merged.has(userId)) {
                // Already in map – mark as shared friend, pick online state
                const existing = merged.get(userId);
                if (!existing.$accountIds.includes(session.userId)) {
                    existing.$accountIds.push(session.userId);
                }
                // Prefer the 'online' state
                if (ctx.state === 'online' && existing.state !== 'online') {
                    existing.state = 'online';
                    if (ctx.ref?.location && ctx.ref.location !== 'offline') {
                        existing.ref = existing.ref || ctx.ref;
                    }
                }
            } else {
                merged.set(userId, {
                    ...ctx,
                    $accountIds: [session.userId],
                    $accountColor: accountHub.getAccountColor(session.userId)
                });
            }
        }
    }

    return merged;
}

// ── Aggregated feed ────────────────────────────────────────────────────────────

const BASE_COLUMNS = [
    '_prefix', 'id', 'created_at', 'user_id', 'display_name', 'type',
    'location', 'world_name', 'previous_location', 'time', 'group_name',
    'status', 'status_description', 'previous_status', 'previous_status_description',
    'bio', 'previous_bio',
    'owner_id', 'avatar_name',
    'current_avatar_image_url', 'current_avatar_thumbnail_image_url',
    'previous_current_avatar_image_url', 'previous_current_avatar_thumbnail_image_url'
].join(', ');

function buildUnionSelectsForPrefix(prefix, filters) {
    let gps = true, status = true, bio = true, avatar = true, online = true, offline = true;

    if (filters.length > 0) {
        gps = status = bio = avatar = online = offline = false;
        for (const f of filters) {
            if (f === 'GPS') gps = true;
            else if (f === 'Status') status = true;
            else if (f === 'Bio') bio = true;
            else if (f === 'Avatar') avatar = true;
            else if (f === 'Online') online = true;
            else if (f === 'Offline') offline = true;
        }
    }

    const selects = [];
    const N = '@perTable';

    if (gps) {
        selects.push(
            `SELECT * FROM (SELECT '${prefix}' AS _prefix, id, created_at, user_id, display_name, 'GPS' AS type, location, world_name, previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${prefix}_feed_gps WHERE 1=1 ORDER BY id DESC LIMIT ${N})`
        );
    }
    if (status) {
        selects.push(
            `SELECT * FROM (SELECT '${prefix}' AS _prefix, id, created_at, user_id, display_name, 'Status' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, status, status_description, previous_status, previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${prefix}_feed_status WHERE 1=1 ORDER BY id DESC LIMIT ${N})`
        );
    }
    if (bio) {
        selects.push(
            `SELECT * FROM (SELECT '${prefix}' AS _prefix, id, created_at, user_id, display_name, 'Bio' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, bio, previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${prefix}_feed_bio WHERE 1=1 ORDER BY id DESC LIMIT ${N})`
        );
    }
    if (avatar) {
        selects.push(
            `SELECT * FROM (SELECT '${prefix}' AS _prefix, id, created_at, user_id, display_name, 'Avatar' AS type, NULL AS location, NULL AS world_name, NULL AS previous_location, NULL AS time, NULL AS group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, owner_id, avatar_name, current_avatar_image_url, current_avatar_thumbnail_image_url, previous_current_avatar_image_url, previous_current_avatar_thumbnail_image_url FROM ${prefix}_feed_avatar WHERE 1=1 ORDER BY id DESC LIMIT ${N})`
        );
    }
    if (online || offline) {
        let typeFilter = '';
        if (online && !offline) typeFilter = "AND type = 'Online'";
        else if (offline && !online) typeFilter = "AND type = 'Offline'";
        selects.push(
            `SELECT * FROM (SELECT '${prefix}' AS _prefix, id, created_at, user_id, display_name, type, location, world_name, NULL AS previous_location, time, group_name, NULL AS status, NULL AS status_description, NULL AS previous_status, NULL AS previous_status_description, NULL AS bio, NULL AS previous_bio, NULL AS owner_id, NULL AS avatar_name, NULL AS current_avatar_image_url, NULL AS current_avatar_thumbnail_image_url, NULL AS previous_current_avatar_image_url, NULL AS previous_current_avatar_thumbnail_image_url FROM ${prefix}_feed_online_offline WHERE 1=1 ${typeFilter} ORDER BY id DESC LIMIT ${N})`
        );
    }

    return selects;
}

function parseDbRow(dbRow) {
    const prefix = dbRow[0];
    const type = dbRow[5];
    const row = {
        _prefix: prefix,
        rowId: dbRow[1],
        created_at: dbRow[2],
        userId: dbRow[3],
        displayName: dbRow[4],
        type
    };

    // Attempt to map prefix to an accountId if it belongs to one of our sessions
    row.$accountId = null;
    row.$accountColor = null;
    row.$accountLabel = null;
    const session = accountHub.allSessions.find(s => s.dbPrefix === prefix);
    if (session) {
        row.$accountId = session.userId;
        row.$accountColor = accountHub.getAccountColor(session.userId);
        row.$accountLabel = session.label || session.userInfo?.displayName || session.userId;
    } else if (prefix === accountHub.primaryPrefix) {
        row.$accountId = accountHub.primaryId;
        row.$accountColor = accountHub.getAccountColor(accountHub.primaryId);
        row.$accountLabel = 'Primary';
    }

    switch (type) {
        case 'GPS':
            row.location = dbRow[6];
            row.worldName = dbRow[7];
            row.previousLocation = dbRow[8];
            row.time = dbRow[9];
            row.groupName = dbRow[10];
            break;
        case 'Status':
            row.status = dbRow[11];
            row.statusDescription = dbRow[12];
            row.previousStatus = dbRow[13];
            row.previousStatusDescription = dbRow[14];
            break;
        case 'Bio':
            row.bio = dbRow[15];
            row.previousBio = dbRow[16];
            break;
        case 'Avatar':
            row.ownerId = dbRow[17];
            row.avatarName = dbRow[18];
            row.currentAvatarImageUrl = dbRow[19];
            row.currentAvatarThumbnailImageUrl = dbRow[20];
            row.previousCurrentAvatarImageUrl = dbRow[21];
            row.previousCurrentAvatarThumbnailImageUrl = dbRow[22];
            break;
        case 'Online':
        case 'Offline':
            row.location = dbRow[6];
            row.worldName = dbRow[7];
            row.time = dbRow[9];
            row.groupName = dbRow[10];
            break;
    }
    return row;
}

/**
 * Query the merged feed from all active account prefixes.
 * @param {string[]} prefixes  DB table prefixes for all accounts
 * @param {string[]} filters   Feed type filters ([], ['GPS'], ['Online','Offline'], ...)
 * @param {number}   [limit=500]
 * @returns {Promise<object[]>}
 */
export async function lookupAggregatedFeed(prefixes, filters = [], limit = 500) {
    if (!prefixes || prefixes.length === 0) return [];

    const allSelects = [];
    for (const prefix of prefixes) {
        const selects = buildUnionSelectsForPrefix(prefix, filters);
        allSelects.push(...selects);
    }

    if (allSelects.length === 0) return [];

    const rows = [];
    await sqliteService.execute(
        (dbRow) => { rows.push(parseDbRow(dbRow)); },
        `SELECT ${BASE_COLUMNS} FROM (${allSelects.join(' UNION ALL ')}) ORDER BY created_at DESC, id DESC LIMIT @limit`,
        {
            '@perTable': limit,
            '@limit': limit
        }
    );
    return rows;
}
