import { describe, expect, test, vi } from 'vitest';

import { createQueryResourceRegistry } from '../queryResourceRegistry';

function createDependencies() {
    const requests = {
        avatarRequest: { getAvatar: vi.fn() },
        favoriteRequest: { getFavoriteLimits: vi.fn() },
        friendRequest: { getFriends: vi.fn() },
        groupRequest: {
            getGroup: vi.fn(),
            getGroupMember: vi.fn(),
            getGroupMembers: vi.fn(),
            getGroupGallery: vi.fn(),
            getGroupCalendar: vi.fn(),
            getGroupCalendarEvent: vi.fn(),
            getRepresentedGroup: vi.fn()
        },
        inventoryRequest: { getUserInventoryItem: vi.fn() },
        miscRequest: {
            getFileAnalysis: vi.fn(),
            hasWorldPersistData: vi.fn(),
            getVisits: vi.fn(),
            getFile: vi.fn(),
            getVRChatCredits: vi.fn()
        },
        userRequest: { getUser: vi.fn(), getMutualCounts: vi.fn() },
        vrcPlusIconRequest: { getFileList: vi.fn() },
        vrcPlusImageRequest: { getPrints: vi.fn() },
        worldRequest: { getWorld: vi.fn(), getWorlds: vi.fn() }
    };
    const queryKeys = {
        user: (id) => ['user', id],
        avatar: (id) => ['avatar', id],
        world: (id) => ['world', id],
        worldsByUser: (params) => ['worlds', params],
        group: (id, includeRoles) => ['group', id, Boolean(includeRoles)],
        groupMember: (params) => ['group', 'member', params],
        groupMembers: (params) => ['group', 'members', params],
        groupGallery: (params) => ['group', 'gallery', params],
        groupCalendar: (id) => ['group', id, 'calendar'],
        groupCalendarEvent: (params) => ['group', 'event', params],
        avatarGallery: (id) => ['avatar', id, 'gallery'],
        favoriteLimits: () => ['favorite', 'limits'],
        userInventoryItem: (params) => ['inventory', params],
        fileAnalysis: (params) => ['analysis', params],
        worldPersistData: (id) => ['world', id, 'persistData'],
        mutualCounts: (id) => ['user', id, 'mutualCounts'],
        visits: () => ['visits'],
        file: (id) => ['file', id],
        avatarStyles: () => ['avatar', 'styles'],
        representedGroup: (id) => ['user', id, 'representedGroup'],
        vrchatCredits: () => ['credits']
    };
    const policy = { staleTime: 10, gcTime: 20, retry: 1 };
    const policies = new Proxy(
        {},
        {
            get: () => policy
        }
    );
    return { requests, queryKeys, policies };
}

describe('query resource registry', () => {
    test('builds immutable resource definitions from injected dependencies', () => {
        const registry = createQueryResourceRegistry(createDependencies());

        expect(Object.isFrozen(registry)).toBe(true);
        expect(registry.user.key({ userId: 'usr_1' })).toEqual([
            'user',
            'usr_1'
        ]);
        expect(registry['user.dialog'].policy.staleTime).toBe(60_000);
        expect(registry['user.force'].policy.staleTime).toBe(0);
    });

    test('passes resource parameters to the selected transport implementation', async () => {
        const dependencies = createDependencies();
        const args = { groupId: 'grp_1' };
        const expected = { json: { id: 'grp_1' } };
        dependencies.requests.groupRequest.getGroup.mockResolvedValue(expected);
        const registry = createQueryResourceRegistry(dependencies);

        await expect(registry.group.queryFn(args)).resolves.toBe(expected);
        expect(
            dependencies.requests.groupRequest.getGroup
        ).toHaveBeenCalledWith(args);
    });
});
