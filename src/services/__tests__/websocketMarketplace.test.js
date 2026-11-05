import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const { reactive } = require('vue');
    return {
        user: reactive({
            currentUser: { id: 'usr_a' },
            setCurrentUserCredits: vi.fn()
        }),
        hub: reactive({ primaryId: 'usr_a', viewMode: 'primary' }),
        lifecycle: reactive({ isLoggedIn: true, isFriendsLoaded: true }),
        request: vi.fn()
    };
});
vi.mock('../accountHub', () => ({ accountHub: mocks.hub }));
vi.mock('../watchState', () => ({ watchState: mocks.lifecycle }));
vi.mock('../request', () => ({ request: mocks.request }));
vi.mock('../appConfig', () => ({
    AppDebug: { websocketDomain: 'wss://example.invalid' }
}));
vi.mock('../../stores', () => ({
    useUserStore: () => mocks.user,
    useFriendStore: () => ({}),
    useGalleryStore: () => ({}),
    useInstanceStore: () => ({}),
    useLocationStore: () => ({}),
    useNotificationStore: () => ({}),
    useSharedFeedStore: () => ({}),
    useUiStore: () => ({})
}));
vi.mock('../../stores/group', () => ({ useGroupStore: () => ({}) }));
vi.mock('../../api', () => ({}));
vi.mock('../../shared/utils', () => ({}));
vi.mock('../../coordinators/userCoordinator', () => ({}));
vi.mock('../../coordinators/groupCoordinator', () => ({}));
vi.mock('../../coordinators/friendRelationshipCoordinator', () => ({}));
vi.mock('../../coordinators/friendPresenceCoordinator', () => ({}));
vi.mock('../../coordinators/locationCoordinator', () => ({}));
import { closeWebSocket, initWebsocket } from '../websocket';

let socket;
let sequence = 0;
function receiveBalance(content) {
    socket.onmessage({
        data: JSON.stringify({
            type: 'economy-update',
            content: JSON.stringify(content),
            sequence: ++sequence
        })
    });
}
describe('marketplace websocket balance updates', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mocks.hub.primaryId = 'usr_a';
        mocks.hub.viewMode = 'primary';
        mocks.user.currentUser = { id: 'usr_a' };
        mocks.lifecycle.isLoggedIn = true;
        mocks.request.mockResolvedValue({ ok: true, token: 'test-token' });
        vi.stubGlobal(
            'WebSocket',
            class {
                close = vi.fn();
                constructor() {
                    socket = this;
                }
            }
        );
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await initWebsocket();
    });
    afterEach(() => {
        closeWebSocket();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    test('updates the primary wallet and preserves a valid zero balance', () => {
        receiveBalance({ walletBalance: 80 });
        receiveBalance({ walletBalance: 0 });
        expect(mocks.user.setCurrentUserCredits.mock.calls).toEqual([
            [80],
            [0]
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });
    test.each(['account:usr_b', 'merged'])(
        'does not write the primary wallet in %s view',
        (mode) => {
            mocks.hub.viewMode = mode;
            receiveBalance({ walletBalance: 80 });
            expect(mocks.user.setCurrentUserCredits).not.toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
        }
    );
    test('ignores a wallet update after logout', () => {
        mocks.lifecycle.isLoggedIn = false;
        receiveBalance({ walletBalance: 80 });
        expect(mocks.user.setCurrentUserCredits).not.toHaveBeenCalled();
    });
    test('treats a missing balance as unknown', () => {
        receiveBalance({});
        expect(
            mocks.user.setCurrentUserCredits
        ).toHaveBeenCalledExactlyOnceWith(null);
    });
});
