/**
 * Converts one raw LogWatcher tuple payload into the application's game-log
 * object shape.
 *
 * This module intentionally has no host, database, or store dependencies so
 * the raw tuple mapping can be tested independently from LogWatcher I/O.
 *
 * @param {string} dt
 * @param {string} type
 * @param {Array<unknown>} args
 * @returns {object}
 */
export function parseRawGameLog(dt, type, args) {
    var gameLog = {
        dt,
        type
    };

    switch (type) {
        case 'location':
            gameLog.location = args[0];
            gameLog.worldName = args[1];
            break;

        case 'location-destination':
            gameLog.location = args[0];
            break;

        case 'player-joined':
            gameLog.displayName = args[0];
            gameLog.userId = args[1];
            break;

        case 'player-left':
            gameLog.displayName = args[0];
            gameLog.userId = args[1];
            break;

        case 'notification':
            gameLog.json = args[0];
            break;

        case 'portal-spawn':
            break;

        case 'event':
            gameLog.event = args[0];
            break;

        case 'video-play':
            gameLog.videoUrl = args[0];
            gameLog.displayName = args[1];
            break;

        case 'resource-load-string':
        case 'resource-load-image':
            gameLog.resourceUrl = args[0];
            break;

        case 'video-sync':
            gameLog.timestamp = args[0];
            break;

        case 'vrcx':
            gameLog.data = args[0];
            break;

        case 'api-request':
            gameLog.url = args[0];
            break;

        case 'avatar-change':
            gameLog.displayName = args[0];
            gameLog.avatarName = args[1];
            break;

        case 'photon-id':
            gameLog.displayName = args[0];
            gameLog.photonId = args[1];
            break;

        case 'screenshot':
            gameLog.screenshotPath = args[0];
            break;

        case 'vrc-quit':
            break;

        case 'openvr-init':
            break;

        case 'desktop-mode':
            break;

        case 'udon-exception':
            gameLog.data = args[0];
            break;

        case 'sticker-spawn':
            gameLog.userId = args[0];
            gameLog.displayName = args[1];
            gameLog.inventoryId = args[2];
            break;

        default:
            break;
    }

    return gameLog;
}
