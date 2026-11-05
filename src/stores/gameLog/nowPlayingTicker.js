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
 * @param {Function} [deps.onTick]
 * @returns {{ updateNowPlaying: Function }}
 */
export function createNowPlayingTicker({
    getNowPlaying,
    clearNowPlaying,
    formatSeconds,
    updateView,
    schedule,
    now = () => Date.now(),
    onTick = () => {}
}) {
    function updateNowPlaying() {
        onTick();
        const nowPlaying = getNowPlaying();
        if (!nowPlaying.playing) {
            return;
        }

        const nowSeconds = now() / 1000;
        if (!nowPlaying.paused) {
            nowPlaying.elapsed =
                Math.round(
                    (nowSeconds - nowPlaying.startTime) *
                        (nowPlaying.speed ?? 1) *
                        10
                ) / 10;
        }
        if (nowPlaying.elapsed >= nowPlaying.length) {
            if (!nowPlaying.spec) {
                clearNowPlaying();
                return;
            }
            nowPlaying.elapsed = nowPlaying.length;
        }
        nowPlaying.remainingText = formatSeconds(
            nowPlaying.length - nowPlaying.elapsed
        );
        nowPlaying.percentage =
            Math.round(((nowPlaying.elapsed * 100) / nowPlaying.length) * 10) /
            10;
        updateView();
        if (!nowPlaying.paused && nowPlaying.elapsed < nowPlaying.length) {
            schedule(updateNowPlaying, NOW_PLAYING_TICK_MS);
        }
    }

    return { updateNowPlaying };
}

export { NOW_PLAYING_TICK_MS };
