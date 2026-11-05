import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { reactive, ref } from 'vue';

const user = reactive({
    currentUser: { id: 'usr_primary' },
    isLocalUserVrcPlusSupporter: false,
    ownedListingIds: new Set(),
    ownedProductIds: new Set(),
    getAllProductPurchases: vi.fn()
});
const settings = reactive({ freeStoreItemNotifications: true });
const hub = reactive({ primaryId: 'usr_primary', viewMode: 'primary' });
const lifecycle = reactive({ isLoggedIn: true });
const getShelves = vi.fn();
const purchase = vi.fn();
const errorToast = vi.fn();
let useNotificationStore;
let pinia;

beforeAll(async () => {
    for (const [path, name] of Object.entries({
        'settings/advanced': 'useAdvancedSettingsStore',
        'settings/appearance': 'useAppearanceSettingsStore',
        favorite: 'useFavoriteStore',
        friend: 'useFriendStore',
        game: 'useGameStore',
        'settings/general': 'useGeneralSettingsStore',
        group: 'useGroupStore',
        instance: 'useInstanceStore',
        invite: 'useInviteStore',
        launch: 'useLaunchStore',
        location: 'useLocationStore',
        modal: 'useModalStore',
        sharedFeed: 'useSharedFeedStore',
        ui: 'useUiStore',
        'settings/wristOverlay': 'useWristOverlaySettingsStore'
    })) {
        vi.doMock(`../../${path}`, () => ({ [name]: () => ({}) }));
    }
    vi.doMock('../../user', () => ({ useUserStore: () => user }));
    vi.doMock('../../settings/notifications', () => ({
        useNotificationsSettingsStore: () => settings
    }));
    for (const [path, name] of Object.entries({
        memoCoordinator: 'getUserMemo',
        friendRelationshipCoordinator: 'handleFriendAdd',
        groupCoordinator: 'showGroupDialog',
        userCoordinator: 'showUserDialog',
        worldCoordinator: 'showWorldDialog'
    })) {
        vi.doMock(`../../../coordinators/${path}`, () => ({ [name]: vi.fn() }));
    }
    vi.doMock('../../../shared/utils', () => ({
        ...Object.fromEntries(
            [
                'applyBoopLegacyHandling',
                'checkCanInvite',
                'createInviteResponseParams',
                'createDefaultNotificationRef',
                'createDefaultNotificationV2Ref',
                'executeWithBackoff',
                'findUserByDisplayName',
                'parseLocation',
                'parseNotificationDetails',
                'removeFromArray',
                'sanitizeNotificationJson',
                'userImage'
            ].map((name) => [name, vi.fn()])
        ),
        replaceBioSymbols: (value) => value
    }));
    vi.doMock('../../../shared/constants', () => ({
        VRCHAT_STORE_IDS: ['store_a', 'store_b']
    }));
    vi.doMock('../../../api', () => ({
        marketplaceRequest: {
            getStoreShelves: getShelves,
            purchaseListing: purchase
        },
        notificationRequest: {},
        friendRequest: {},
        instanceRequest: {},
        miscRequest: {},
        queryRequest: {},
        inventoryRequest: {}
    }));
    vi.doMock('../../../services/database', () => ({
        database: {},
        dbVars: {}
    }));
    vi.doMock('../../../services/config', () => ({
        default: {
            getString: vi.fn(async (_key, fallback) => fallback),
            getArray: vi.fn(async () => []),
            setArray: vi.fn(async () => {})
        }
    }));
    vi.doMock('../../../services/appConfig', () => ({ AppDebug: {} }));
    vi.doMock('../../../services/watchState', () => ({
        watchState: lifecycle
    }));
    vi.doMock('../../../services/accountHub', () => ({ accountHub: hub }));
    vi.doMock('../../../plugins/router', () => ({
        router: { currentRoute: ref({}) }
    }));
    vi.doMock('vue-i18n', () => ({ useI18n: () => ({ t: (key) => key }) }));
    vi.doMock('vue-sonner', () => ({ toast: { error: errorToast } }));
    ({ useNotificationStore } = await import('../index.js'));
});

function listing(id, overrides = {}) {
    return { id, displayName: id, active: true, priceTokens: 0, ...overrides };
}

function serve(listings) {
    getShelves.mockResolvedValue({ json: [{ listings }] });
}

beforeEach(() => {
    vi.clearAllMocks();
    user.currentUser = { id: 'usr_primary' };
    user.isLocalUserVrcPlusSupporter = false;
    user.ownedListingIds = new Set();
    user.ownedProductIds = new Set();
    settings.freeStoreItemNotifications = true;
    hub.primaryId = 'usr_primary';
    hub.viewMode = 'primary';
    lifecycle.isLoggedIn = true;
    pinia = createPinia();
    setActivePinia(pinia);
    user.getAllProductPurchases.mockResolvedValue();
    serve([listing('free')]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    pinia._s.forEach((store) => store.$dispose());
    vi.restoreAllMocks();
});

describe('free store item menu', () => {
    test('manually reopens previously notified items even when reminders are disabled', async () => {
        const store = useNotificationStore();
        await store.checkFreeStoreItems();
        expect(
            store.freeStoreItemDialog.listings.map((item) => item.id)
        ).toEqual(['free']);
        store.freeStoreItemDialog.visible = false;
        await store.checkFreeStoreItems();
        expect(store.freeStoreItemDialog.visible).toBe(false);
        settings.freeStoreItemNotifications = false;
        await store.checkFreeStoreItems({ manual: true });
        expect(store.freeStoreItemDialog.visible).toBe(true);
        expect(
            store.freeStoreItemDialog.listings.map((item) => item.id)
        ).toEqual(['free']);
        expect(purchase).not.toHaveBeenCalled();
    });

    test('keeps automatic reminders disabled while allowing an empty manual menu', async () => {
        settings.freeStoreItemNotifications = false;
        serve([]);
        const store = useNotificationStore();
        await store.checkFreeStoreItems();
        expect(getShelves).not.toHaveBeenCalled();
        await store.checkFreeStoreItems({ manual: true });
        expect(store.freeStoreItemDialog).toEqual({
            visible: true,
            listings: []
        });
    });

    test('deduplicates shelves and excludes inactive, paid, unknown-price and owned items', async () => {
        user.ownedListingIds.add('owned_listing');
        user.ownedProductIds.add('product_owned');
        serve([
            listing('free'),
            listing('inactive', { active: false }),
            listing('paid', { priceTokens: 1 }),
            listing('unknown', { priceTokens: undefined }),
            listing('null', { priceTokens: null }),
            listing('owned_listing'),
            listing('owned_product', { productIds: ['product_owned'] }),
            listing('partially_owned', {
                productIds: ['product_owned', 'product_new']
            })
        ]);
        const store = useNotificationStore();
        await store.checkFreeStoreItems({ manual: true });
        expect(
            store.freeStoreItemDialog.listings.map((item) => item.id)
        ).toEqual(['free', 'partially_owned']);
    });

    test.each([false, true])(
        'uses the applicable VRC+ price when membership = %s',
        async (supporter) => {
            user.isLocalUserVrcPlusSupporter = supporter;
            serve([
                listing('plus_free', {
                    priceTokens: 100,
                    vrcPlusDiscountPrice: 0
                })
            ]);
            const store = useNotificationStore();
            await store.checkFreeStoreItems({ manual: true });
            expect(
                store.freeStoreItemDialog.listings.map((item) => item.id)
            ).toEqual(supporter ? ['plus_free'] : []);
        }
    );

    test('offers a free bundle without also offering the products inside it', async () => {
        serve([
            listing('single', { productIds: ['product_a'] }),
            listing('bundle', { productIds: ['product_a', 'product_b'] })
        ]);
        const store = useNotificationStore();
        await store.checkFreeStoreItems({ manual: true });
        expect(
            store.freeStoreItemDialog.listings.map((item) => item.id)
        ).toEqual(['bundle']);
    });

    test('does not duplicate a pending request and allows reopening after it finishes', async () => {
        let resolve;
        getShelves.mockReturnValue(
            new Promise((done) => {
                resolve = done;
            })
        );
        const store = useNotificationStore();
        const pending = store.checkFreeStoreItems({ manual: true });
        expect(store.isFreeStoreItemsLoading).toBe(true);
        await store.checkFreeStoreItems({ manual: true });
        expect(getShelves).toHaveBeenCalledTimes(2);
        resolve({ json: [{ listings: [listing('free')] }] });
        await pending;
        expect(store.isFreeStoreItemsLoading).toBe(false);
        store.freeStoreItemDialog.visible = false;
        serve([listing('free')]);
        await store.checkFreeStoreItems({ manual: true });
        expect(store.freeStoreItemDialog.visible).toBe(true);
        expect(store.freeStoreItemDialog.listings).toHaveLength(1);
    });

    test.each(['account:usr_other', 'merged'])(
        'blocks requests in %s view',
        async (mode) => {
            hub.viewMode = mode;
            const store = useNotificationStore();
            await store.checkFreeStoreItems({ manual: true });
            expect(getShelves).not.toHaveBeenCalled();
            expect(store.freeStoreItemDialog.visible).toBe(false);
        }
    );

    test('ignores a response after switching away and back to the primary account', async () => {
        let resolve;
        getShelves.mockReturnValue(
            new Promise((done) => {
                resolve = done;
            })
        );
        const store = useNotificationStore();
        const pending = store.checkFreeStoreItems({ manual: true });
        hub.viewMode = 'merged';
        hub.viewMode = 'primary';
        resolve({ json: [{ listings: [listing('free')] }] });
        await pending;
        expect(store.freeStoreItemDialog.visible).toBe(false);
        expect(store.isFreeStoreItemsLoading).toBe(false);
    });

    test('reports a manual load failure and permits retry without purchasing', async () => {
        getShelves.mockRejectedValue(new Error('offline'));
        const store = useNotificationStore();
        await store.checkFreeStoreItems({ manual: true });
        expect(errorToast).toHaveBeenCalledWith(
            'view.search.store.free_items_load_failed'
        );
        expect(store.freeStoreItemDialog.visible).toBe(false);
        expect(store.isFreeStoreItemsLoading).toBe(false);
        serve([listing('free')]);
        await store.checkFreeStoreItems({ manual: true });
        expect(store.freeStoreItemDialog.visible).toBe(true);
        expect(purchase).not.toHaveBeenCalled();
    });
});
