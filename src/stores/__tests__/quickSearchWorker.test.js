import { beforeEach, describe, expect, test, vi } from 'vitest';

function setupWorkerHarness() {
    const sent = [];
    let handler = null;

    globalThis.self = {
        addEventListener: vi.fn((event, cb) => {
            if (event === 'message') handler = cb;
        }),
        postMessage: vi.fn((payload) => {
            sent.push(payload);
        })
    };

    return {
        sent,
        dispatch: (data) => handler?.({ data })
    };
}

describe('quickSearchWorker message protocol', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    test('returns empty search result for short query', async () => {
        const harness = setupWorkerHarness();
        await import('../quickSearchWorker.js');

        harness.dispatch({
            type: 'search',
            payload: {
                seq: 7,
                query: 'a',
                currentUserId: 'usr_me',
                language: 'en-US'
            }
        });

        expect(harness.sent).toHaveLength(1);
        expect(harness.sent[0]).toEqual({
            type: 'searchResult',
            payload: {
                seq: 7,
                friends: [],
                ownAvatars: [],
                favAvatars: [],
                ownWorlds: [],
                favWorlds: [],
                ownGroups: [],
                joinedGroups: []
            }
        });
    });

    test('deduplicates favorites and joined groups against own results', async () => {
        const harness = setupWorkerHarness();
        await import('../quickSearchWorker.js');

        harness.dispatch({
            type: 'updateIndex',
            payload: {
                friends: [],
                avatars: [
                    {
                        id: 'avtr_1',
                        name: 'Alpha Avatar',
                        authorId: 'usr_me',
                        imageUrl: ''
                    }
                ],
                worlds: [
                    {
                        id: 'wrld_1',
                        name: 'Alpha World',
                        authorId: 'usr_me',
                        imageUrl: ''
                    }
                ],
                groups: [
                    {
                        id: 'grp_1',
                        name: 'Alpha Group',
                        ownerId: 'usr_me',
                        imageUrl: ''
                    }
                ],
                favAvatars: [
                    { id: 'avtr_1', name: 'Alpha Avatar', imageUrl: '' }
                ],
                favWorlds: [{ id: 'wrld_1', name: 'Alpha World', imageUrl: '' }]
            }
        });

        harness.dispatch({
            type: 'search',
            payload: {
                seq: 8,
                query: 'Alpha',
                currentUserId: 'usr_me',
                language: 'en-US'
            }
        });

        const result = harness.sent.at(-1);
        expect(result.type).toBe('searchResult');
        expect(result.payload.seq).toBe(8);
        expect(result.payload.ownAvatars).toHaveLength(1);
        expect(result.payload.favAvatars).toHaveLength(0);
        expect(result.payload.ownWorlds).toHaveLength(1);
        expect(result.payload.favWorlds).toHaveLength(0);
        expect(result.payload.ownGroups).toHaveLength(1);
        expect(result.payload.joinedGroups).toHaveLength(0);
    });

    test('matches fuzzy names and Chinese pinyin initials', async () => {
        const harness = setupWorkerHarness();
        await import('../quickSearchWorker.js');

        harness.dispatch({
            type: 'updateIndex',
            payload: {
                friends: [
                    { id: 'u_fuzzy', name: 'Summer World', imageUrl: '' },
                    { id: 'u_pinyin', name: '曦晨六时', imageUrl: '' }
                ],
                avatars: [],
                worlds: [],
                groups: [],
                favAvatars: [],
                favWorlds: []
            }
        });

        harness.dispatch({
            type: 'search',
            payload: {
                seq: 9,
                query: 'smr',
                currentUserId: null,
                language: 'en-US'
            }
        });
        expect(harness.sent.at(-1).payload.friends.map((item) => item.id)).toContain(
            'u_fuzzy'
        );

        harness.dispatch({
            type: 'search',
            payload: {
                seq: 10,
                query: 'xcs',
                currentUserId: null,
                language: 'zh-CN'
            }
        });
        expect(harness.sent.at(-1).payload.friends.map((item) => item.id)).toContain(
            'u_pinyin'
        );
    });
});
