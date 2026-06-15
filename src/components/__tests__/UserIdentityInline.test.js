import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { reactive } from 'vue';

const { fetchMock } = vi.hoisted(() => ({
    fetchMock: vi.fn(() => Promise.resolve({ json: {} }))
}));

const cachedUsers = reactive(
    new Map([
        [
            'usr_1',
            {
                id: 'usr_1',
                displayName: 'Cached User',
                profilePicOverrideThumbnail: 'https://example.com/profile.png'
            }
        ]
    ])
);

const cachedUserIdsByDisplayName = reactive(
    new Map([['Cached User', new Set(['usr_1'])]])
);

vi.mock('../../stores', () => ({
    useUserStore: () => ({
        cachedUsers,
        cachedUserIdsByDisplayName
    }),
    useFriendStore: () => ({
        friends: new Map()
    })
}));

vi.mock('../../composables/useUserDisplay', () => ({
    useUserDisplay: () => ({
        userImage: (user) => user?.profilePicOverrideThumbnail || ''
    })
}));

vi.mock('../../api/queryRequest', () => ({
    default: {
        fetch: fetchMock
    }
}));

vi.mock('../ui/avatar', () => ({
    Avatar: {
        template: '<span><slot /></span>',
        props: ['class']
    },
    AvatarImage: {
        template: '<img :src="src" />',
        props: ['src', 'class', 'loading']
    },
    AvatarFallback: {
        template: '<span><slot /></span>'
    }
}));

vi.mock('lucide-vue-next', () => ({
    User: {
        template: '<span />'
    }
}));

import UserIdentityInline from '../UserIdentityInline.vue';
import { __resetUserIdentityHydrationForTests } from '../../composables/useUserIdentityHydration';

describe('UserIdentityInline.vue', () => {
    beforeEach(() => {
        fetchMock.mockClear();
        __resetUserIdentityHydrationForTests();
    });

    it('resolves avatar from local user cache when only userId is provided', () => {
        const wrapper = mount(UserIdentityInline, {
            props: {
                userId: 'usr_1'
            }
        });

        expect(wrapper.text()).toContain('Cached User');
        expect(wrapper.find('img').attributes('src')).toBe(
            'https://example.com/profile.png'
        );
    });

    it('prefers cached display name when displayName is a user id placeholder', () => {
        const wrapper = mount(UserIdentityInline, {
            props: {
                userId: 'usr_1',
                displayName:
                    'usr_11111111-1111-4111-8111-111111111111'
            }
        });

        expect(wrapper.text()).toContain('Cached User');
        expect(wrapper.text()).not.toContain(
            'usr_11111111-1111-4111-8111-111111111111'
        );
    });

    it('hydrates an unknown user once when a valid userId has no cached avatar', async () => {
        vi.useFakeTimers();

        mount(UserIdentityInline, {
            props: {
                userId: 'usr_11111111-1111-4111-8111-111111111111',
                displayName: 'Unknown User'
            }
        });
        mount(UserIdentityInline, {
            props: {
                userId: 'usr_11111111-1111-4111-8111-111111111111',
                displayName: 'Unknown User'
            }
        });

        await nextTick();
        await vi.runOnlyPendingTimersAsync();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('user.dialog', {
            userId: 'usr_11111111-1111-4111-8111-111111111111'
        });

        vi.useRealTimers();
    });
});
