import { describe, expect, test, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const stores = vi.hoisted(() => ({
    userDialog: {
        __v_isRef: true,
        value: {
        id: 'usr_target',
        loading: false,
        isFriend: false,
        friend: null,
        mutualFriendCount: 3,
        previousDisplayNames: [],
        ref: {
            id: 'usr_target',
            displayName: 'Very Long Display Name That Should Remain Visible At High Zoom',
            status: 'active',
            statusDescription: 'A status description that should wrap instead of disappearing.',
            pronouns: 'they/them',
            profilePicOverrideThumbnail: '',
            profilePicOverride: '',
            currentAvatarThumbnailImageUrl: 'https://example.com/avatar.png',
            currentAvatarImageUrl: 'https://example.com/avatar-full.png',
            userIcon: 'https://example.com/icon.png',
            $languages: [{ key: 'eng', value: 'English' }],
            $trustClass: 'x-tag-known',
            $trustLevel: 'Known User',
            $platform: 'standalonewindows',
            $customTag: '',
            badges: [
                {
                    badgeId: 'bdg_1',
                    badgeName: 'Test Badge',
                    badgeDescription: 'Badge description',
                    badgeImageUrl: 'https://example.com/badge.png',
                    hidden: false
                }
            ]
        }
        }
    },
    currentUser: {
        __v_isRef: true,
        value: {
            id: 'usr_current',
            username: 'current-user'
        }
    },
    toggleFollow: vi.fn(),
    showFullscreenImageDialog: vi.fn()
}));

vi.mock('pinia', async (importOriginal) => ({
    ...(await importOriginal()),
    storeToRefs: (store) => store
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key) => key })
}));

vi.mock('../../../../stores', () => ({
    useUserStore: () => ({
        userDialog: stores.userDialog,
        currentUser: stores.currentUser
    }),
    useGalleryStore: () => ({
        showFullscreenImageDialog: stores.showFullscreenImageDialog
    }),
    useAutoFollowStore: () => ({
        isActive: false,
        targetFriendId: '',
        statusText: '',
        toggleFollow: stores.toggleFollow
    })
}));

vi.mock('../../../../composables/useUserDisplay', () => ({
    useUserDisplay: () => ({
        userImage: () => 'https://example.com/icon.png',
        userStatusClass: () => 'x-user-status-active'
    })
}));

vi.mock('../../../../services/database', () => ({
    database: {
        getFriendLogHistoryForUserId: vi.fn().mockResolvedValue([])
    }
}));

vi.mock('../../../../shared/utils', async (importOriginal) => ({
    ...(await importOriginal()),
    formatDateFilter: (value) => value,
    isFriendOnline: () => false,
    isRealInstance: () => false,
    languageClass: (key) => `flag-${key}`,
    openDiscordProfile: vi.fn()
}));

vi.mock('lucide-vue-next', () => ({
    Apple: { template: '<i />' },
    ChevronDown: { template: '<i />' },
    IdCard: { template: '<i />' },
    Image: { template: '<i />' },
    Monitor: { template: '<i />' },
    Navigation: { template: '<i />' },
    Shield: { template: '<i />' },
    Smartphone: { template: '<i />' },
    UserPlus: { template: '<i />' },
    Users: { template: '<i />' }
}));

import UserSummaryHeader from '../UserSummaryHeader.vue';

describe('UserSummaryHeader.vue', () => {
    test('keeps the avatar, details and action area in a wrapping high-zoom layout', () => {
        const wrapper = shallowMount(UserSummaryHeader, {
            props: {
                getUserStateText: () => 'Active',
                copyUserDisplayName: vi.fn(),
                toggleBadgeVisibility: vi.fn(),
                toggleBadgeShowcased: vi.fn(),
                userDialogCommand: vi.fn()
            },
            global: {
                stubs: {
                    TooltipWrapper: { template: '<span><slot /><slot name="content" /></span>' },
                    Badge: { template: '<span><slot /></span>' },
                    Button: { template: '<button><slot /></button>' },
                    Checkbox: { template: '<input type="checkbox" />' },
                    Popover: { template: '<div><slot /></div>' },
                    PopoverContent: { template: '<div><slot /></div>' },
                    PopoverTrigger: { template: '<div><slot /></div>' },
                    UserActionDropdown: { template: '<div data-testid="user-summary-dropdown" />' }
                }
            }
        });

        expect(wrapper.find('[data-testid="user-summary-media"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="user-summary-details"]').text()).toContain('Very Long Display Name');
        expect(wrapper.find('[data-testid="user-summary-badges"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="user-summary-actions"]').exists()).toBe(true);

        expect(wrapper.find('[data-testid="user-summary-header"]').classes()).toEqual(
            expect.arrayContaining(['flex-wrap', 'min-w-0'])
        );
        expect(wrapper.find('[data-testid="user-summary-details"]').classes()).toEqual(
            expect.arrayContaining(['min-w-0', 'basis-72'])
        );
    });
});
