import { describe, expect, it, vi } from 'vitest';

import { recordBioSnapshotForUser } from '../bioSnapshotCoordinator';

describe('recordBioSnapshotForUser', () => {
    it('records a profile bio when the legacy user response had no bio', async () => {
        const database = {
            getLastBioChangeForUser: vi.fn().mockResolvedValue(null),
            addBioToDatabase: vi.fn()
        };

        await expect(
            recordBioSnapshotForUser({
                database,
                userId: 'usr-friend',
                currentUserId: 'usr-current',
                currentBio: 'new profile bio',
                previousBio: undefined,
                isFriend: true,
                displayName: 'Friend',
                createdAt: '2026-09-18T00:00:00.000Z'
            })
        ).resolves.toBe(true);

        expect(database.addBioToDatabase).toHaveBeenCalledWith({
            created_at: '2026-09-18T00:00:00.000Z',
            userId: 'usr-friend',
            displayName: 'Friend',
            bio: 'new profile bio',
            previousBio: ''
        });
    });

    it('does not duplicate an event-flow record or an unchanged snapshot', async () => {
        const database = {
            getLastBioChangeForUser: vi.fn().mockResolvedValue({ bio: 'same bio' }),
            addBioToDatabase: vi.fn()
        };

        await expect(
            recordBioSnapshotForUser({
                database,
                userId: 'usr-friend',
                currentUserId: 'usr-current',
                currentBio: 'new bio',
                previousBio: 'old bio',
                isFriend: true,
                displayName: 'Friend'
            })
        ).resolves.toBe(false);

        await expect(
            recordBioSnapshotForUser({
                database,
                userId: 'usr-friend',
                currentUserId: 'usr-current',
                currentBio: 'same bio',
                previousBio: 'old bio',
                isFriend: false,
                displayName: 'Friend'
            })
        ).resolves.toBe(false);

        expect(database.addBioToDatabase).not.toHaveBeenCalled();
    });
});
