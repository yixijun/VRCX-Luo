/**
 * Projects the shared read-query column shape used by the game-log tables.
 *
 * The database query methods keep ownership of SQL and filtering; this module
 * only owns the stable row-to-entity mapping that they share.
 *
 * @param {Array<unknown>} dbRow
 * @returns {object}
 */
export function projectGameLogRow(dbRow) {
    const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: dbRow[2]
    };

    switch (dbRow[2]) {
        case 'Location':
            row.location = dbRow[4];
            row.worldId = dbRow[7];
            row.worldName = dbRow[8];
            row.time = dbRow[6];
            row.groupName = dbRow[9];
            break;
        case 'OnPlayerJoined':
        case 'OnPlayerLeft':
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.time = dbRow[6];
            break;
        case 'PortalSpawn':
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.instanceId = dbRow[10];
            row.worldName = dbRow[8];
            break;
        case 'VideoPlay':
            row.videoUrl = dbRow[11];
            row.videoName = dbRow[12];
            row.videoId = dbRow[13];
            row.location = dbRow[4];
            row.displayName = dbRow[3];
            row.userId = dbRow[5];
            break;
        case 'Event':
            row.data = dbRow[16];
            break;
        case 'External':
            row.message = dbRow[17];
            row.displayName = dbRow[3];
            row.userId = dbRow[5];
            row.location = dbRow[4];
            break;
        case 'StringLoad':
        case 'ImageLoad':
            row.resourceUrl = dbRow[14];
            row.location = dbRow[4];
            break;
    }

    return row;
}
