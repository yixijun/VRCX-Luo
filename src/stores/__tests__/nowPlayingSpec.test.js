import { describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { createNowPlayingSpecHandler } from '../gameLog/nowPlayingSpec';

function setup() {
    const nowPlaying = ref({ url: '' });
    const setNowPlaying = vi.fn(async (entry) => {
        nowPlaying.value = { url: entry.videoUrl, name: entry.videoName, length: entry.videoLength };
    });
    const clearNowPlaying = vi.fn(() => { nowPlaying.value = { url: '' }; });
    const handler = createNowPlayingSpecHandler({
        nowPlaying, setNowPlaying, clearNowPlaying,
        startNowPlayingTicker: vi.fn(), updateNowPlayingVideoName: vi.fn(), addGameLogVideo: vi.fn()
    });
    const send = (event, seconds = 0) => handler.handleNowPlayingEvent({ data: JSON.stringify(event), dt: new Date(Date.UTC(2026, 0, 1, 0, 0, seconds)).toISOString() }, 'wrld_test:1');
    return { nowPlaying, setNowPlaying, clearNowPlaying, ...handler, send };
}
const media = (id, more = {}) => ({ id, type: 'mediaChange', mediaUrl: `https://example.com/${id}`, mediaName: id, mediaLength: 120, ...more });

describe('nowplaying log protocol', () => {
    test('keeps progress continuous across pause, seek, speed changes and resume', async () => {
        const { send, nowPlaying } = setup();
        await send(media('screen'));
        await send({ id: 'screen', type: 'mediaPause', mediaTime: 15 }, 20);
        expect(nowPlaying.value).toMatchObject({ paused: true, elapsed: 15 });
        await send({ id: 'screen', type: 'mediaSeek', mediaTime: 30 }, 25);
        expect(nowPlaying.value.elapsed).toBe(30);
        await send({ id: 'screen', type: 'mediaInfo', mediaSpeed: 2 }, 30);
        await send({ id: 'screen', type: 'mediaPlay' }, 35);
        expect(nowPlaying.value).toMatchObject({ paused: false, elapsed: 30, speed: 2 });
        await send({ id: 'screen', type: 'mediaPause' }, 40);
        expect(nowPlaying.value.elapsed).toBe(40);
    });
    test('follows priority producers and falls back when they stop', async () => {
        const { send, nowPlaying, resetNowPlayingProducers, hasNowPlayingProducer } = setup();
        await send(media('priority', { highPriority: true }));
        await send(media('other'), 1);
        expect(nowPlaying.value.url).toBe('https://example.com/priority');
        await send({ id: 'priority', type: 'mediaStop' }, 2);
        expect(nowPlaying.value.url).toBe('https://example.com/other');
        expect(hasNowPlayingProducer()).toBe(true);
        resetNowPlayingProducers();
        expect(hasNowPlayingProducer()).toBe(false);
    });
    test('hides private media URLs and resolves YouTube thumbnails', async () => {
        const { send, nowPlaying, setNowPlaying } = setup();
        await send(media('private', { hideUrl: true }));
        expect(nowPlaying.value).toMatchObject({ url: 'private', urlHidden: true });
        await send(media('youtube', { mediaUrl: 'https://youtu.be/abcdefghijk' }), 1);
        expect(setNowPlaying.mock.lastCall[0].thumbnailUrl).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
    });
});
