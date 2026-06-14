import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';

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

describe('UserIdentityInline.vue', () => {
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
});
