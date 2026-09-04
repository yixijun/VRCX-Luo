import { describe, expect, it, vi } from 'vitest';

import { createFriendLocationPayload } from '../websocketFriendLocation';

function createLocationParser() {
    return vi.fn((value) => ({
        instanceId: `${value}-instance`,
        worldId: `${value}-world`
    }));
}

describe('createFriendLocationPayload', () => {
    it('normalizes a complete friend-location payload and forces online state', () => {
        const parseLocation = createLocationParser();
        const content = {
            userId: 'usr-content',
            location: 'wrld-new:instance',
            worldId: 'wrld-new',
            travelingToLocation: 'wrld-next:instance',
            user: {
                id: 'usr-friend',
                displayName: 'Friend',
                state: 'offline'
            }
        };

        const result = createFriendLocationPayload(content, parseLocation);

        expect(result).toEqual({
            hasUser: true,
            locationJson: {
                location: 'wrld-new:instance',
                worldId: 'wrld-new',
                instanceId: 'wrld-new:instance-instance',
                travelingToLocation: 'wrld-next:instance',
                travelingToWorld: 'wrld-next:instance-world',
                travelingToInstance: 'wrld-next:instance-instance',
                id: 'usr-friend',
                displayName: 'Friend',
                state: 'online'
            }
        });
        expect(parseLocation).toHaveBeenNthCalledWith(1, 'wrld-new:instance');
        expect(parseLocation).toHaveBeenNthCalledWith(2, 'wrld-next:instance');
    });

    it('keeps the fallback payload when the event has no embedded user', () => {
        const parseLocation = createLocationParser();
        const content = {
            userId: 'usr-fallback',
            location: 'wrld-new:instance',
            worldId: 'wrld-new',
            travelingToLocation: 'traveling'
        };

        const result = createFriendLocationPayload(content, parseLocation);

        expect(result).toEqual({
            hasUser: false,
            locationJson: {
                id: 'usr-fallback',
                location: 'wrld-new:instance',
                worldId: 'wrld-new',
                instanceId: 'wrld-new:instance-instance',
                travelingToLocation: 'traveling',
                travelingToWorld: 'traveling-world',
                travelingToInstance: 'traveling-instance'
            }
        });
    });
});
