import { describe, expect, it } from 'vitest';

import {
    buildVisibleFriendSections,
    clampFriendSectionHeight,
    friendStateTone,
    friendMatchesQuery
} from '../remoteFriendSections';

describe('buildVisibleFriendSections', () => {
    it('hides empty friend sections and keeps non-empty sections visible', () => {
        const sections = buildVisibleFriendSections({
            groups: {
                favorite: [],
                active: [{ id: 'usr_active' }],
                online: [{ id: 'usr_online' }],
                offline: []
            }
        });

        expect(sections.map((section) => section.key)).toEqual([
            'active',
            'online'
        ]);
    });

    it('uses saved section heights for resizable friend sections', () => {
        const sections = buildVisibleFriendSections({
            groups: {
                favorite: [{ id: 'usr_favorite' }],
                active: [],
                online: [],
                offline: []
            },
            sectionHeights: {
                favorite: 260
            }
        });

        expect(sections).toEqual([
            {
                key: 'favorite',
                title: '特别关注',
                count: 1,
                friends: [{ id: 'usr_favorite' }],
                height: 260
            }
        ]);
    });

    it('clamps resized section heights to useful bounds', () => {
        expect(clampFriendSectionHeight(20)).toBe(90);
        expect(clampFriendSectionHeight(999)).toBe(520);
        expect(clampFriendSectionHeight(240)).toBe(240);
    });

    it('filters visible sections by friend name, world name, location and status text', () => {
        const sections = buildVisibleFriendSections({
            groups: {
                active: [
                    {
                        id: 'usr_one',
                        displayName: 'Alice',
                        worldName: 'Moonlight Station'
                    },
                    {
                        id: 'usr_two',
                        displayName: 'Bob',
                        location: 'wrld_party:123'
                    }
                ],
                online: [
                    {
                        id: 'usr_three',
                        displayName: 'Carol',
                        statusDescription: 'drawing'
                    }
                ]
            },
            query: 'moon'
        });

        expect(sections).toHaveLength(1);
        expect(sections[0].friends.map((friend) => friend.id)).toEqual([
            'usr_one'
        ]);
    });

    it('matches individual friends with the same search fields', () => {
        expect(
            friendMatchesQuery(
                {
                    displayName: 'Alice',
                    worldName: 'World Name',
                    statusDescription: 'busy'
                },
                'world'
            )
        ).toBe(true);
        expect(friendMatchesQuery({ displayName: 'Alice' }, 'bob')).toBe(false);
    });

    it('maps friend states to visual tones used by the remote friend list', () => {
        expect(friendStateTone({ state: 'active' })).toBe('active');
        expect(friendStateTone({ state: 'online' })).toBe('online');
        expect(friendStateTone({ state: 'offline' })).toBe('offline');
        expect(friendStateTone({})).toBe('offline');
    });
});
