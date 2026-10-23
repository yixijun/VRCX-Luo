import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

const launch = {
    showLaunchDialog: vi.fn(),
    launchGame: vi.fn(),
    tryOpenInstanceInVrc: vi.fn()
};
const game = { isGameRunning: false, setIsSteamVRRunning: vi.fn() };
const confirm = vi.fn();
const requests = {
    sendNotificationResponse: vi.fn(),
    sendInviteResponse: vi.fn(),
    hideNotification: vi.fn()
};
let useNotificationStore;

beforeAll(async () => {
    // Isolate store collaborators while exercising the real public invite action.
    const stores = {
        'settings/advanced': 'useAdvancedSettingsStore',
        'settings/appearance': 'useAppearanceSettingsStore',
        favorite: 'useFavoriteStore',
        friend: 'useFriendStore',
        'settings/general': 'useGeneralSettingsStore',
        group: 'useGroupStore',
        instance: 'useInstanceStore',
        location: 'useLocationStore',
        'settings/notifications': 'useNotificationsSettingsStore',
        sharedFeed: 'useSharedFeedStore',
        ui: 'useUiStore',
        user: 'useUserStore',
        'settings/wristOverlay': 'useWristOverlaySettingsStore'
    };
    for (const [path, name] of Object.entries(stores)) {
        vi.doMock(`../../${path}`, () => ({
            [name]: () => ({ removeNotify: vi.fn() })
        }));
    }
    vi.doMock('../../game', () => ({ useGameStore: () => game }));
    vi.doMock('../../launch', () => ({ useLaunchStore: () => launch }));
    vi.doMock('../../modal', () => ({ useModalStore: () => ({ confirm }) }));
    vi.doMock('../../invite', () => ({
        useInviteStore: () => ({ inviteResponseMessageTable: { data: [{}] } })
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
                'createDefaultNotificationRef',
                'createDefaultNotificationV2Ref',
                'executeWithBackoff',
                'findUserByDisplayName',
                'parseLocation',
                'parseNotificationDetails',
                'sanitizeNotificationJson',
                'userImage'
            ].map((name) => [name, vi.fn()])
        ),
        createInviteResponseParams: (rsvp) => ({ responseSlot: 0, rsvp }),
        removeFromArray: (items, item) => {
            const index = items.indexOf(item);
            if (index !== -1) items.splice(index, 1);
        }
    }));
    vi.doMock('../../../api', () => ({
        notificationRequest: requests,
        friendRequest: {},
        instanceRequest: {},
        miscRequest: {},
        queryRequest: {}
    }));
    vi.doMock('../../../services/database', () => ({
        database: { expireNotificationV2: vi.fn() },
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
        watchState: { isLoggedIn: false }
    }));
    vi.doMock('../../../plugins/router', () => ({
        router: { currentRoute: ref({}) }
    }));
    vi.doMock('vue-i18n', () => ({ useI18n: () => ({ t: (key) => key }) }));
    ({ useNotificationStore } = await import('../index.js'));
});

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    confirm.mockResolvedValue({ ok: true });
    game.isGameRunning = false;
});

describe('accepting an invite', () => {
    test.each(['vr', 'desktop', 'current'])('reuses the launch flow with the mode selected in SteamVR: %s', async (mode) => {
        const row = { id: `dashboard-${mode}`, type: 'invite', location: 'wrld_test:123', shortName: 'access-token' };
        expect(await useNotificationStore().acceptInviteAndLaunch(row, {dashboardConfirmed: true, mode})).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(launch.showLaunchDialog).not.toHaveBeenCalled();
        if (mode === 'current') expect(launch.tryOpenInstanceInVrc).toHaveBeenCalledWith('wrld_test:123', 'access-token');
        else expect(launch.launchGame).toHaveBeenCalledWith('wrld_test:123', 'access-token', mode === 'desktop');
    });

    test('does not accept an invitation before a SteamVR launch mode is selected', async () => {
        const row = {id: 'no-mode', type: 'invite', location: 'wrld_test:123'};
        expect(await useNotificationStore().acceptInviteAndLaunch(row, {dashboardConfirmed: true})).toBe(false);
        expect(requests.sendInviteResponse).not.toHaveBeenCalled();
        expect(launch.launchGame).not.toHaveBeenCalled();
    });

    test.each([false, true])(
        'opens the launch page when game running = %s',
        async (running) => {
            game.isGameRunning = running;
            const store = useNotificationStore();
            const row = {
                id: 'invite-1',
                type: 'invite',
                version: 2,
                data: { worldId: 'wrld_test', instanceId: '123' },
                details: { shortName: 'invite-token' },
                responses: [{ type: 'accept', data: 'response-token' }]
            };

            expect(await store.acceptInviteAndLaunch(row)).toBe(true);
            expect(requests.sendNotificationResponse).toHaveBeenCalledWith({
                notificationId: row.id,
                responseType: 'accept',
                responseData: 'response-token'
            });
            expect(launch.showLaunchDialog).toHaveBeenCalledWith(
                'wrld_test:123',
                'invite-token'
            );
            expect(launch.launchGame).not.toHaveBeenCalled();
            expect(launch.tryOpenInstanceInVrc).not.toHaveBeenCalled();
        }
    );

    test('opens the same page for legacy invites and preserves the access token', async () => {
        const store = useNotificationStore();
        const row = {
            id: 'legacy-1',
            type: 'invite',
            details: { worldId: 'wrld_test:456' },
            shortName: 'legacy-token'
        };
        expect(await store.acceptInviteAndLaunch(row)).toBe(true);
        expect(requests.sendInviteResponse).toHaveBeenCalledWith(
            { responseSlot: 0, rsvp: true },
            row.id
        );
        expect(requests.hideNotification).toHaveBeenCalledWith({
            notificationId: row.id
        });
        expect(launch.showLaunchDialog).toHaveBeenCalledWith(
            'wrld_test:456',
            'legacy-token'
        );
    });

    test('cancelling the confirmation leaves the invitation and game untouched', async () => {
        confirm.mockResolvedValue({ ok: false });
        expect(
            await useNotificationStore().acceptInviteAndLaunch({
                id: 'cancel-1',
                type: 'invite',
                location: 'wrld_test:123'
            })
        ).toBe(false);
        expect(requests.sendInviteResponse).not.toHaveBeenCalled();
        expect(requests.sendNotificationResponse).not.toHaveBeenCalled();
        expect(launch.showLaunchDialog).not.toHaveBeenCalled();
        expect(launch.launchGame).not.toHaveBeenCalled();
    });

    test('preserves access tokens from V2 notification data', async () => {
        const row = {
            id: 'data-1',
            type: 'invite',
            version: 2,
            data: { location: 'wrld_test:789', shortName: 'data-token' },
            responses: [{ type: 'join' }]
        };
        expect(await useNotificationStore().acceptInviteAndLaunch(row)).toBe(
            true
        );
        expect(launch.showLaunchDialog).toHaveBeenCalledWith(
            'wrld_test:789',
            'data-token'
        );
    });

    test('does not open the launch page if accepting the invite fails', async () => {
        requests.sendNotificationResponse.mockRejectedValueOnce(
            new Error('request failed')
        );
        const errorLog = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            expect(
                await useNotificationStore().acceptInviteAndLaunch({
                    id: 'failed-1',
                    type: 'invite',
                    version: 2,
                    location: 'wrld_test:123',
                    responses: [{ type: 'accept' }]
                })
            ).toBe(false);
            expect(launch.showLaunchDialog).not.toHaveBeenCalled();
            expect(launch.launchGame).not.toHaveBeenCalled();
        } finally {
            errorLog.mockRestore();
        }
    });
});
