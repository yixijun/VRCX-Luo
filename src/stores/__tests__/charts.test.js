import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
    friends: undefined,
    currentUser: null,
    trackedNonFriends: new Map(),
    toast: vi.fn()
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key
    })
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: vi.fn()
    })
}));

vi.mock('vue-sonner', () => ({
    toast: Object.assign(mocks.toast, {
        info: mocks.toast,
        success: mocks.toast,
        warning: mocks.toast,
        error: mocks.toast
    })
}));

vi.mock('../friend', () => ({
    useFriendStore: () => ({
        friends: mocks.friends
    })
}));

vi.mock('../user', () => ({
    useUserStore: () => ({
        currentUser: mocks.currentUser
    })
}));

vi.mock('../trackedNonFriends', () => ({
    useTrackedNonFriendsStore: () => ({
        trackedUsers: mocks.trackedNonFriends
    })
}));

vi.mock('../../services/database', () => ({
    database: {}
}));

vi.mock('../../api', () => ({
    userRequest: {}
}));

vi.mock('../../shared/utils', () => ({
    createRateLimiter: () => ({
        wait: vi.fn(() => Promise.resolve())
    }),
    executeWithBackoff: vi.fn((fn) => fn())
}));

describe('charts store', () => {
    it('does not crash during startup when friends are not initialized', async () => {
        setActivePinia(createPinia());

        const { useChartsStore } = await import('../charts');

        expect(() => useChartsStore()).not.toThrow();
    });
});
