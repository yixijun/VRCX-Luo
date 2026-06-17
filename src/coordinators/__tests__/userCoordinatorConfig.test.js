import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authStore: {
        setCachedConfig: vi.fn()
    },
    userStore: {}
}));

vi.mock('vue-sonner', () => ({
    toast: {
        error: vi.fn(),
        info: vi.fn()
    }
}));

vi.mock('../memoCoordinator', () => ({
    getUserMemo: vi.fn()
}));

vi.mock('../../api', () => ({
    avatarRequest: {},
    instanceRequest: {},
    queryRequest: {},
    userRequest: {}
}));

vi.mock('../../services/request', () => ({
    processBulk: vi.fn(),
    request: vi.fn()
}));

vi.mock('../../services/appConfig', () => ({
    AppDebug: {
        endpointDomain: 'https://example.com'
    }
}));

vi.mock('../../services/database', () => ({
    database: {}
}));

vi.mock('../../queries', () => ({
    patchUserFromEvent: vi.fn()
}));

vi.mock('../../services/watchState', () => ({
    watchState: {}
}));

vi.mock('../avatarCoordinator', () => ({
    applyAvatar: vi.fn(),
    removeAvatarFromCache: vi.fn(),
    showAvatarDialog: vi.fn()
}));

vi.mock('../favoriteCoordinator', () => ({
    applyFavorite: vi.fn()
}));

vi.mock('../userSessionCoordinator', () => ({
    runAvatarSwapFlow: vi.fn(),
    runFirstLoginFlow: vi.fn(),
    runHomeLocationSyncFlow: vi.fn(),
    runPostApplySyncFlow: vi.fn()
}));

vi.mock('../userEventCoordinator', () => ({
    runHandleUserUpdateFlow: vi.fn()
}));

vi.mock('../locationCoordinator', () => ({
    runUpdateCurrentUserLocationFlow: vi.fn()
}));

vi.mock('../friendPresenceCoordinator', () => ({
    runUpdateFriendFlow: vi.fn()
}));

vi.mock('../friendRelationshipCoordinator', () => ({
    userOnFriend: vi.fn()
}));

vi.mock('../groupCoordinator', () => ({
    handleGroupRepresented: vi.fn()
}));

vi.mock('../searchIndexCoordinator', () => ({
    syncFriendSearchIndex: vi.fn()
}));

vi.mock('../../shared/utils', () => ({
    arraysMatch: vi.fn(),
    computeUserPlatform: vi.fn(),
    createDefaultUserRef: vi.fn(),
    diffObjectProps: vi.fn(),
    evictMapCache: vi.fn(() => ({ deletedCount: 0 })),
    extractFileId: vi.fn(),
    findUserByDisplayName: vi.fn(),
    getWorldName: vi.fn(),
    isRealInstance: vi.fn(() => false),
    parseLocation: vi.fn(() => ({})),
    sanitizeUserJson: vi.fn()
}));

vi.mock('../../stores/settings/appearance', () => ({
    useAppearanceSettingsStore: () => ({})
}));

vi.mock('../../stores/auth', () => ({
    useAuthStore: () => mocks.authStore
}));

vi.mock('../../stores/avatar', () => ({
    useAvatarStore: () => ({})
}));

vi.mock('../../stores/favorite', () => ({
    useFavoriteStore: () => ({})
}));

vi.mock('../../stores/friend', () => ({
    useFriendStore: () => ({})
}));

vi.mock('../../stores/game', () => ({
    useGameStore: () => ({})
}));

vi.mock('../../stores/settings/general', () => ({
    useGeneralSettingsStore: () => ({})
}));

vi.mock('../../stores/instance', () => ({
    useInstanceStore: () => ({})
}));

vi.mock('../../stores/location', () => ({
    useLocationStore: () => ({})
}));

vi.mock('../../stores/moderation', () => ({
    useModerationStore: () => ({})
}));

vi.mock('../../stores/notification', () => ({
    useNotificationStore: () => ({})
}));

vi.mock('../../stores/photon', () => ({
    usePhotonStore: () => ({})
}));

vi.mock('../../stores/search', () => ({
    useSearchStore: () => ({})
}));

vi.mock('../../stores/sharedFeed', () => ({
    useSharedFeedStore: () => ({})
}));

vi.mock('../../stores/ui', () => ({
    useUiStore: () => ({})
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => mocks.userStore
}));

vi.mock('../../stores/manualRelations', () => ({
    useManualRelationsStore: () => ({})
}));

vi.mock('noty', () => ({
    default: vi.fn()
}));

describe('handleConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.userStore = {};
    });

    it('does not block config initialization when user store language setters are unavailable', async () => {
        const { handleConfig } = await import('../userCoordinator');
        const config = {
            whiteListedAssetUrls: {},
            constants: {
                LANGUAGE: {
                    SPOKEN_LANGUAGE_OPTIONS: {
                        cmn: 'Chinese',
                        eng: 'English'
                    }
                }
            }
        };

        expect(() => handleConfig({ json: config })).not.toThrow();
        expect(mocks.authStore.setCachedConfig).toHaveBeenCalledWith(config);
    });

    it('falls back to writable store fields when language setters are missing', async () => {
        mocks.userStore = {
            subsetOfLanguages: [],
            languageDialog: {
                languages: []
            },
            $patch: vi.fn((patcher) => patcher(mocks.userStore))
        };
        const { handleConfig } = await import('../userCoordinator');

        handleConfig({
            json: {
                whiteListedAssetUrls: {},
                constants: {
                    LANGUAGE: {
                        SPOKEN_LANGUAGE_OPTIONS: {
                            cmn: 'Chinese',
                            eng: 'English'
                        }
                    }
                }
            }
        });

        expect(mocks.userStore.subsetOfLanguages).toEqual({
            cmn: 'Chinese',
            eng: 'English'
        });
        expect(mocks.userStore.languageDialog.languages).toEqual([
            { key: 'cmn', value: 'Chinese' },
            { key: 'eng', value: 'English' }
        ]);
    });
});
