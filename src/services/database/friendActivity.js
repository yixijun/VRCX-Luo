import { dbVars } from '../database';
import sqliteService from '../sqlite.js';

const friendActivity = {
    async getFriendActivityRows({
        userId,
        fromIso,
        beforeIso = '',
        limit = 500
    }) {
        const results = [];
        const beforeQuery = beforeIso ? 'AND created_at < @beforeIso' : '';
        await sqliteService.execute(
            (row) => {
                results.push({
                    kind: row[0],
                    sourceId: row[1],
                    createdAt: row[2],
                    location: row[3] || '',
                    worldName: row[4] || '',
                    previousLocation: row[5] || '',
                    time: row[6],
                    groupName: row[7] || ''
                });
            },
            `SELECT kind, source_id, created_at, location, world_name, previous_location, time, group_name
             FROM (
                 SELECT 'gps' AS kind, id AS source_id, created_at, location, world_name, previous_location, time, group_name
                 FROM ${dbVars.userPrefix}_feed_gps
                 WHERE user_id = @userId AND created_at >= @fromIso ${beforeQuery}
                 UNION ALL
                 SELECT 'offline' AS kind, id AS source_id, created_at, location, world_name, '' AS previous_location, time, group_name
                 FROM ${dbVars.userPrefix}_feed_online_offline
                 WHERE user_id = @userId AND type = 'Offline' AND created_at >= @fromIso ${beforeQuery}
             )
             ORDER BY created_at DESC, source_id DESC
             LIMIT @limit`,
            {
                '@userId': userId,
                '@fromIso': fromIso,
                ...(beforeIso ? { '@beforeIso': beforeIso } : {}),
                '@limit': limit
            }
        );
        return results;
    },

    async getFriendActivityStatusRows({ userId, fromIso, beforeIso = '' }) {
        const results = [];
        const beforeQuery = beforeIso ? 'AND created_at < @beforeIso' : '';
        await sqliteService.execute(
            (row) => {
                results.push({
                    createdAt: row[0],
                    status: row[1] || '',
                    statusDescription: row[2] || ''
                });
            },
            `SELECT created_at, status, status_description
             FROM (
                 SELECT created_at, status, status_description, id
                 FROM ${dbVars.userPrefix}_feed_status
                 WHERE user_id = @userId AND created_at < @fromIso
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1
             )
             UNION ALL
             SELECT created_at, status, status_description
             FROM ${dbVars.userPrefix}_feed_status
             WHERE user_id = @userId AND created_at >= @fromIso ${beforeQuery}
             ORDER BY created_at ASC`,
            {
                '@userId': userId,
                '@fromIso': fromIso,
                ...(beforeIso ? { '@beforeIso': beforeIso } : {})
            }
        );
        return results;
    }
};

export { friendActivity };
