// requires binding of LogWatcher

import { parseRawGameLog } from './gameLogParser';

class GameLogService {
    parseRawGameLog(dt, type, args) {
        return parseRawGameLog(dt, type, args);
    }

    async getAll() {
        var gameLogs = [];
        var done = false;
        while (!done) {
            var rawGameLogs = await LogWatcher.Get();
            // eslint-disable-next-line no-unused-vars
            for (var [fileName, dt, type, ...args] of rawGameLogs) {
                var gameLog = this.parseRawGameLog(dt, type, args);
                gameLogs.push(gameLog);
            }
            if (rawGameLogs.length === 0) {
                done = true;
            }
        }
        return gameLogs;
    }

    async setDateTill(dateTill) {
        await LogWatcher.SetDateTill(dateTill);
    }

    async reset() {
        await LogWatcher.Reset();
    }
}

var self = new GameLogService();
window.gameLogService = self;

export { self as default, GameLogService as LogWatcherService };
