import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => {
    const { reactive } = require('vue');
    return {
        hub: reactive({ primaryId: 'usr_a', viewMode: 'primary' }),
        lifecycle: reactive({ isLoggedIn: true, isFriendsLoaded: false }),
        processBulk: vi.fn(),
        getProductPurchases: vi.fn(),
        ui: { clearDialogCrumbs: vi.fn() }
    };
});
vi.mock('../../services/accountHub', () => ({ accountHub: mocks.hub }));
vi.mock('../../services/watchState', () => ({ watchState: mocks.lifecycle }));
vi.mock('../../services/appConfig', () => ({ AppDebug: {} }));
vi.mock('../../services/database', () => ({
    database: { getAllUserNotes: vi.fn().mockResolvedValue([]) }
}));
vi.mock('../../services/request', () => ({ processBulk: mocks.processBulk }));
vi.mock('../../shared/utils', () => ({}));
vi.mock('../../shared/utils/profileEditor', () => ({
    getProfileEditorSeed: vi.fn()
}));
vi.mock('../../coordinators/memoCoordinator', () => ({
    getAllUserMemos: vi.fn()
}));
vi.mock('../../coordinators/locationCoordinator', () => ({
    runUpdateCurrentUserLocationFlow: vi.fn()
}));
vi.mock('../../coordinators/searchIndexCoordinator', () => ({
    syncFriendSearchIndex: vi.fn()
}));
vi.mock('../settings/appearance', () => ({
    useAppearanceSettingsStore: () => ({})
}));
vi.mock('../friend', () => ({ useFriendStore: () => ({}) }));
vi.mock('../instance', () => ({ useInstanceStore: () => ({}) }));
vi.mock('../location', () => ({ useLocationStore: () => ({}) }));
vi.mock('../ui', () => ({ useUiStore: () => mocks.ui }));
vi.mock('../../api', () => ({
    marketplaceRequest: { getProductPurchases: mocks.getProductPurchases },
    cosmeticsRequest: {},
    instanceRequest: {},
    userRequest: { getUserNotes: vi.fn().mockResolvedValue({ json: [] }) }
}));
import { useUserStore } from '../user';

let user;
describe('user marketplace state lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.hub.viewMode = 'primary';
        mocks.lifecycle.isLoggedIn = true;
        setActivePinia(createPinia());
        user = useUserStore();
        user.setCurrentUser({ id: 'usr_a' });
        user.setCurrentUserCredits(100);
        user.setCachedPurchases([
            { purchaseId: 'purchase_a', buyerId: 'usr_a' }
        ]);
    });
    afterEach(() => user.$dispose());
    test('clears wallet and ownership synchronously when the current account changes', () => {
        user.setCurrentUser({ id: 'usr_b' });
        expect(user.currentUserCredits).toBeNull();
        expect(user.cachedPurchases.size).toBe(0);
    });
    test('does not clear wallet for a same-account profile update', () => {
        user.setCurrentUser({ id: 'usr_a', displayName: 'Updated' });
        expect(user.currentUserCredits).toBe(100);
        expect(user.cachedPurchases.size).toBe(1);
    });
    test('clears wallet and ownership immediately on merged view and logout', () => {
        mocks.hub.viewMode = 'merged';
        expect(user.currentUserCredits).toBeNull();
        expect(user.cachedPurchases.size).toBe(0);
        user.setCurrentUserCredits(200);
        mocks.lifecycle.isLoggedIn = false;
        expect(user.currentUserCredits).toBeNull();
        expect(user.cachedPurchases.size).toBe(0);
    });
    test('does not start a primary purchase refresh in a secondary view', async () => {
        mocks.hub.viewMode = 'account:usr_b';
        await user.getAllProductPurchases();
        expect(mocks.processBulk).not.toHaveBeenCalled();
    });
    test('stops paginated refresh after switching away and back', async () => {
        mocks.processBulk.mockImplementation(async ({ fn, params }) => {
            mocks.hub.viewMode = 'merged';
            mocks.hub.viewMode = 'primary';
            expect(await fn(params)).toEqual({ json: [], params });
        });
        await user.getAllProductPurchases();
        expect(mocks.processBulk).toHaveBeenCalledTimes(1);
        expect(mocks.getProductPurchases).not.toHaveBeenCalled();
    });
});
