import { describe, expect, it } from 'vitest';
import { createFriendPresenceFeed } from '../friendPresenceFeed';

const input = {
    createdAt: '2026-09-04T00:00:00.000Z',
    userId: 'usr-friend',
    displayName: 'Friend',
    location: 'wrld_world:instance',
    worldName: 'World',
    groupName: 'Group',
    time: 5000
};

describe('createFriendPresenceFeed', () => {
    it('creates an Offline record from supplied values', () => {
        expect(
            createFriendPresenceFeed({ ...input, transition: 'offline' })
        ).toEqual({
            created_at: '2026-09-04T00:00:00.000Z',
            type: 'Offline',
            userId: 'usr-friend',
            displayName: 'Friend',
            location: 'wrld_world:instance',
            worldName: 'World',
            groupName: 'Group',
            time: 5000
        });
    });

    it('creates an Online record without changing the supplied values', () => {
        expect(
            createFriendPresenceFeed({ ...input, transition: 'online' })
        ).toEqual({
            created_at: '2026-09-04T00:00:00.000Z',
            type: 'Online',
            userId: 'usr-friend',
            displayName: 'Friend',
            location: 'wrld_world:instance',
            worldName: 'World',
            groupName: 'Group',
            time: 5000
        });
    });

    it('returns no record for an unsupported transition', () => {
        expect(
            createFriendPresenceFeed({ ...input, transition: 'active' })
        ).toBeUndefined();
    });
});
