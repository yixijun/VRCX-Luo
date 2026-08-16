import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockRequest = vi.fn();
const mockInvalidateQueries = vi.fn().mockResolvedValue();
const mockApplyGroup = vi.fn((json) => json);

vi.mock('../../services/request', () => ({
    request: (...args) => mockRequest(...args)
}));

vi.mock('../../stores', () => ({
    useGroupStore: () => ({
        applyGroup: (...args) => mockApplyGroup(...args)
    }),
    useUserStore: () => ({
        currentUser: { id: 'usr_me' }
    })
}));

vi.mock('../../queries', () => ({
    queryClient: {
        invalidateQueries: (...args) => mockInvalidateQueries(...args)
    },
    entityQueryPolicies: {
        user: {},
        avatar: {},
        world: {},
        worldCollection: {}
    }
}));

import groupRequest from '../group';

describe('group query sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('group mutations invalidate scoped active group queries', async () => {
        mockRequest.mockResolvedValue({ ok: true });

        await groupRequest.setGroupRepresentation('grp_1', {
            isRepresenting: true
        });
        await groupRequest.deleteGroupPost({
            groupId: 'grp_1',
            postId: 'post_1'
        });
        await groupRequest.deleteGroupEvent({
            groupId: 'grp_1',
            eventId: 'event_1'
        });
        await groupRequest.setGroupMemberProps('usr_me', 'grp_1', {
            visibility: 'visible'
        });

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(4);
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['group', 'grp_1'],
            refetchType: 'active'
        });
    });

    test('creating group content uses the official endpoints and refreshes the group', async () => {
        mockRequest.mockResolvedValue({ id: 'created_1' });

        await groupRequest.createGroupGallery({
            groupId: 'grp_1',
            name: 'Gallery',
            description: '',
            membersOnly: false
        });
        await groupRequest.createGroupEvent({
            groupId: 'grp_1',
            title: 'Event',
            description: 'Description',
            startsAt: '2026-08-13T12:00:00.000Z',
            endsAt: '2026-08-13T14:00:00.000Z',
            accessType: 'public',
            category: 'other',
            sendCreationNotification: true
        });
        await groupRequest.addGroupGalleryImage({
            groupId: 'grp_1',
            galleryId: 'gallery_1',
            fileId: 'file_1'
        });

        expect(mockRequest).toHaveBeenNthCalledWith(
            1,
            'groups/grp_1/galleries',
            expect.objectContaining({ method: 'POST' })
        );
        expect(mockRequest).toHaveBeenNthCalledWith(
            2,
            'calendar/grp_1/event',
            expect.objectContaining({ method: 'POST' })
        );
        expect(mockRequest).toHaveBeenNthCalledWith(
            3,
            'groups/grp_1/galleries/gallery_1/images',
            {
                method: 'POST',
                params: { fileId: 'file_1' }
            }
        );
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    });
});
