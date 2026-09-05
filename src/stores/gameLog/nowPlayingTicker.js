const NOW_PLAYING_TICK_MS = 1000;

/**
 * Creates the now-playing progress ticker without depending on a Store,
 * worker-timers implementation, or wall-clock singleton.
 *
 * @param {object} deps
 * @param {Function} deps.getNowPlaying
 * @param {Function} deps.clearNowPlaying
 * @param {Function} deps.formatSeconds
 * @param {Function} deps.updateView
 * @param {Function} deps.schedule
 * @param {Function} [deps.now]
 * @returns {{ updateNowPlaying: Function }}
 */
export function createNowPlayingTicker({
    getNowPlaying,
    clearNowPlaying,
    formatSeconds,
    updateView,
    schedule,
    now = () => Date.now()
}) {
    function updateNowPlaying() {
        const nowPlaying = getNowPlaying();
        if (!nowPlaying.playing) {
            return;
        }

        const nowSeconds = now() / 1000;
        nowPlaying.elapsed =
            Math.round((nowSeconds - nowPlaying.startTime) * 10) / 10;
        if (nowPlaying.elapsed >= nowPlaying.length) {
            clearNowPlaying();
            return;
        }
        nowPlaying.remainingText = formatSeconds(
            nowPlaying.length - nowPlaying.elapsed
        );
        nowPlaying.percentage =
            Math.round(
                ((nowPlaying.elapsed * 100) / nowPlaying.length) * 10
            ) / 10;
        updateView();
        schedule(updateNowPlaying, NOW_PLAYING_TICK_MS);
    }

    return { updateNowPlaying };
}

export { NOW_PLAYING_TICK_MS };
