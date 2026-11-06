import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, reactive } from 'vue';

import { links } from '../../shared/constants/link';

const mockWatchState = reactive({
    isLoggedIn: false,
    isFriendsLoaded: false,
    isFavoritesLoaded: false
});

const mocks = vi.hoisted(() => ({
    toast: {
        dismiss: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn()
    },
    request: vi.fn(),
    authRequest: {
        getConfig: vi.fn(),
        verifyTOTP: vi.fn(),
        verifyEmailOTP: vi.fn()
    },
    runLoginSuccessFlow: vi.fn(),
    runLogoutFlow: vi.fn(),
    runHandleAutoLoginFlow: vi.fn(),
    getCurrentUser: vi.fn(),
    initWebsocket: vi.fn(),
    advancedSettingsStore: {
        enablePrimaryPassword: false,
        setEnablePrimaryPassword: vi.fn(),
        setEnablePrimaryPasswordConfigRepository: vi.fn(),
        runAvatarAutoCleanup: vi.fn()
    },
    generalSettingsStore: {
        autoLoginDelayEnabled: false,
        autoLoginDelaySeconds: 0
    },
    modalStore: {
        prompt: vi.fn(),
        otpPrompt: vi.fn(),
        confirm: vi.fn(),
        alert: vi.fn()
    },
    updateLoopStore: {
        setNextCurrentUserRefresh: vi.fn(),
        setIpcTimeout: vi.fn()
    },
    userStore: {
        currentUser: {
            id: 'usr_me',
            displayName: 'Tester'
        },
        setUserDialogVisible: vi.fn()
    },
    vrcxStore: {
        waitForDatabaseInit: vi.fn().mockResolvedValue(true)
    },
    configRepository: {
        getString: vi.fn(),
        getBool: vi.fn(),
        setString: vi.fn(),
        setBool: vi.fn(),
        remove: vi.fn()
    },
    webApiService: {
        clearCookies: vi.fn().mockResolvedValue(undefined),
        getCookies: vi.fn().mockResolvedValue([]),
        setCookies: vi.fn().mockResolvedValue(undefined)
    },
    security: {
        encrypt: vi.fn(),
        decrypt: vi.fn()
    },
    notyShow: vi.fn(),
    appDebug: {
        endpointDomain: '',
        websocketDomain: '',
        endpointDomainVrchat: 'https://vrchat.com',
        websocketDomainVrchat: 'wss://pubsub.vrchat.com',
        errorNoty: null
    }
}));

vi.mock('vue-sonner', () => ({
    toast: mocks.toast
}));
vi.mock('../../services/totpSecrets', () => ({
    removeTotpSecret: vi.fn()
}));
vi.mock('../manualRelations', () => ({
    useManualRelationsStore: () => ({ clearCurrentUserRelations: vi.fn() })
}));
vi.mock('../trackedNonFriends', () => ({
    useTrackedNonFriendsStore: () => ({ clearTrackedNonFriends: vi.fn() })
}));
vi.mock('../activity', () => ({ useActivityStore: () => ({}) }));

vi.mock('noty', () => ({
    default: vi.fn().mockImplementation(function NotyMock() {
        this.show = (...args) => mocks.notyShow(...args);
    })
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key
    })
}));
vi.mock('../../plugins/i18n', () => ({
    i18n: { global: { t: (key) => key } }
}));

vi.mock('../../services/request', () => ({
    request: (...args) => mocks.request(...args)
}));

vi.mock('../../api', () => ({
    authRequest: mocks.authRequest
}));

vi.mock('../../coordinators/authCoordinator', () => ({
    runLoginSuccessFlow: (...args) => mocks.runLoginSuccessFlow(...args),
    runLogoutFlow: (...args) => mocks.runLogoutFlow(...args)
}));

vi.mock('../../coordinators/authAutoLoginCoordinator', () => ({
    runHandleAutoLoginFlow: (...args) => mocks.runHandleAutoLoginFlow(...args)
}));

vi.mock('../../coordinators/userCoordinator', () => ({
    getCurrentUser: (...args) => mocks.getCurrentUser(...args)
}));

vi.mock('../../services/appConfig', () => ({
    AppDebug: mocks.appDebug,
    isApiLogSuppressed: vi.fn(() => true),
    logWebRequest: vi.fn()
}));

vi.mock('../../shared/utils', () => ({
    escapeTag: (value) => value
}));

vi.mock('../../services/database', () => ({
    database: new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (prop === '__esModule') return false;
                return vi.fn().mockResolvedValue(undefined);
            }
        }
    )
}));

vi.mock('../../services/security', () => ({
    default: mocks.security
}));

vi.mock('../../services/webapi', () => ({
    default: mocks.webApiService
}));

vi.mock('../../services/watchState', () => ({
    watchState: mockWatchState
}));

vi.mock('../../services/config', () => ({
    default: mocks.configRepository
}));

vi.mock('../../services/websocket', () => ({
    initWebsocket: (...args) => mocks.initWebsocket(...args),
    closeWebSocket: vi.fn()
}));

vi.mock('../../stores/settings/advanced', () => ({
    useAdvancedSettingsStore: () => mocks.advancedSettingsStore
}));

vi.mock('../../stores/settings/general', () => ({
    useGeneralSettingsStore: () => mocks.generalSettingsStore
}));

vi.mock('../../stores/modal', () => ({
    useModalStore: () => mocks.modalStore
}));

vi.mock('../../stores/updateLoop', () => ({
    useUpdateLoopStore: () => mocks.updateLoopStore
}));

vi.mock('../../stores/user', () => ({
    useUserStore: () => mocks.userStore
}));

vi.mock('../../stores/vrcx', () => ({
    useVrcxStore: () => mocks.vrcxStore
}));

vi.mock('worker-timers', () => ({
    setTimeout: vi.fn()
}));

function flushPromises() {
    return Promise.resolve().then(() => Promise.resolve());
}

function makeAuthError(message, status = 401) {
    const err = new Error(message);
    err.status = status;
    err.endpoint = 'auth/user';
    return err;
}

async function createAuthStore() {
    setActivePinia(createPinia());
    const { useAuthStore } = await import('../auth');
    const store = useAuthStore();
    await flushPromises();
    return store;
}

async function failManualLogin(store, error) {
    mocks.authRequest.getConfig.mockResolvedValueOnce({ json: {} });
    mocks.request.mockRejectedValueOnce(error);
    await store.login().catch(() => {});
    await flushPromises();
}

async function failSavedAccountLogin(store, error, overrides = {}) {
    const savedUser = {
        user: { id: 'usr_saved', displayName: 'Saved User' },
        loginParams: {
            username: 'saved@example.com',
            password: 'password',
            endpoint: '',
            websocket: '',
            ...overrides
        }
    };
    mocks.authRequest.getConfig.mockResolvedValueOnce({ json: {} });
    mocks.request.mockRejectedValueOnce(error);
    await store.relogin(savedUser).catch(() => {});
    await flushPromises();
}

async function succeedManualLogin(store) {
    mocks.authRequest.getConfig.mockResolvedValueOnce({ json: {} });
    mocks.request.mockResolvedValueOnce({
        id: 'usr_me',
        displayName: 'Tester'
    });
    await store.login().catch(() => {});
    mockWatchState.isLoggedIn = true;
    await nextTick();
    await flushPromises();
}

describe('useAuthStore login failure toast policy', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-23T00:00:00.000Z'));
        vi.clearAllMocks();
        mocks.authRequest.verifyTOTP.mockResolvedValue({
            json: { verified: true }
        });

        mocks.configRepository.getString.mockImplementation(
            (_key, defaultValue = '') => Promise.resolve(defaultValue)
        );
        mocks.configRepository.getBool.mockImplementation(
            (_key, defaultValue = false) => Promise.resolve(defaultValue)
        );
        mocks.configRepository.setString.mockResolvedValue(undefined);
        mocks.configRepository.setBool.mockResolvedValue(undefined);
        mocks.configRepository.remove.mockResolvedValue(undefined);
        mocks.authRequest.getConfig.mockResolvedValue({ json: {} });
        mocks.request.mockReset();
        mocks.request.mockResolvedValue({});
        mocks.toast.warning.mockReturnValue('login-network-issue-toast');
        mocks.runLoginSuccessFlow.mockReset();
        mocks.runLogoutFlow.mockReset();
        mocks.runHandleAutoLoginFlow.mockReset();
        mocks.getCurrentUser.mockReset().mockResolvedValue({});
        mocks.initWebsocket.mockReset();
        mocks.notyShow.mockReset();
        mocks.toast.warning.mockReset();
        mocks.toast.warning.mockReturnValue('login-network-issue-toast');
        mocks.toast.success.mockReset();
        mocks.toast.error.mockReset();
        mocks.toast.info.mockReset();
        mocks.toast.dismiss.mockReset();
        mocks.advancedSettingsStore.enablePrimaryPassword = false;
        mockWatchState.isLoggedIn = false;
        mockWatchState.isFriendsLoaded = false;
        mockWatchState.isFavoritesLoaded = false;
        mocks.userStore.currentUser = {
            id: 'usr_me',
            displayName: 'Tester'
        };
        mocks.vrcxStore.waitForDatabaseInit.mockResolvedValue(true);

        globalThis.AppApi = {
            CheckGameRunning: vi.fn(),
            FlashWindow: vi.fn(),
            IPCAnnounceStart: vi.fn(),
            OpenLink: vi.fn()
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('shows a single warning toast on the third manual login failure inside 90 seconds', async () => {
        const store = await createAuthStore();
        store.loginForm.username = 'tester@example.com';
        store.loginForm.password = 'password';

        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:00:30.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.warning).not.toHaveBeenCalled();

        vi.setSystemTime(new Date('2026-03-23T00:01:00.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
        expect(mocks.toast.warning).toHaveBeenCalledWith(
            'message.auth.login_network_issue_hint_title',
            expect.objectContaining({
                description:
                    'message.auth.login_network_issue_hint_description',
                duration: Infinity,
                action: expect.objectContaining({
                    label: 'common.actions.open',
                    onClick: expect.any(Function)
                })
            })
        );
        mocks.toast.warning.mock.calls[0][1].action.onClick();
        expect(globalThis.AppApi.OpenLink).toHaveBeenCalledWith(
            links.troubleshootingAuthUserConnectionIssues
        );
    });

    test('does not count explicit password errors toward the warning threshold', async () => {
        const store = await createAuthStore();
        store.loginForm.username = 'tester@example.com';
        store.loginForm.password = 'password';

        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:00:20.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:00:40.000Z'));
        await failManualLogin(
            store,
            makeAuthError('Invalid Username/Email or Password', 401)
        );

        expect(mocks.toast.warning).not.toHaveBeenCalled();
    });

    test('does not trigger the warning during auto-login retries', async () => {
        const store = await createAuthStore();
        store.setAttemptingAutoLogin(true);

        const savedUser = {
            user: { id: 'usr_me', displayName: 'Tester' },
            loginParams: {
                username: 'tester@example.com',
                password: 'password',
                endpoint: '',
                websocket: ''
            }
        };

        mocks.authRequest.getConfig.mockResolvedValue({ json: {} });
        mocks.request.mockRejectedValueOnce(makeAuthError('Unauthorized', 401));
        await store.relogin(savedUser).catch(() => {});
        await flushPromises();

        expect(mocks.toast.warning).not.toHaveBeenCalled();
        expect(mocks.runHandleAutoLoginFlow).not.toHaveBeenCalled();
    });

    test('counts saved-account relogin failures together with manual login failures', async () => {
        const store = await createAuthStore();
        store.loginForm.username = 'tester@example.com';
        store.loginForm.password = 'password';

        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:00:30.000Z'));
        await failSavedAccountLogin(store, makeAuthError('Unauthorized', 401), {
            username: 'tester@example.com'
        });

        expect(mocks.toast.warning).not.toHaveBeenCalled();

        vi.setSystemTime(new Date('2026-03-23T00:01:00.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
    });

    test('resets the failure window after a successful login', async () => {
        const store = await createAuthStore();
        store.loginForm.username = 'tester@example.com';
        store.loginForm.password = 'password';

        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:00:30.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:01:00.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.warning).toHaveBeenCalledTimes(1);

        vi.setSystemTime(new Date('2026-03-23T00:01:05.000Z'));
        await succeedManualLogin(store);
        expect(mocks.toast.dismiss).toHaveBeenCalledWith(
            'login-network-issue-toast'
        );

        mocks.toast.warning.mockClear();
        mocks.toast.dismiss.mockClear();

        mockWatchState.isLoggedIn = false;
        await nextTick();

        vi.setSystemTime(new Date('2026-03-23T00:01:10.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:01:30.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.warning).not.toHaveBeenCalled();
    });

    test('resets the failure window when the user edits the login form', async () => {
        const store = await createAuthStore();
        store.loginForm.username = 'tester@example.com';
        store.loginForm.password = 'password';

        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:00:20.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        expect(mocks.toast.warning).not.toHaveBeenCalled();

        store.loginForm.username = 'tester2@example.com';
        await nextTick();

        vi.setSystemTime(new Date('2026-03-23T00:00:35.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.warning).not.toHaveBeenCalled();
    });

    test('dismisses the sticky warning when credentials change before the next submit', async () => {
        const store = await createAuthStore();
        store.loginForm.username = 'tester@example.com';
        store.loginForm.password = 'password';

        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:00:30.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));
        vi.setSystemTime(new Date('2026-03-23T00:01:00.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.warning).toHaveBeenCalledTimes(1);

        store.loginForm.password = 'new-password';
        vi.setSystemTime(new Date('2026-03-23T00:01:10.000Z'));
        await failManualLogin(store, makeAuthError('Unauthorized', 401));

        expect(mocks.toast.dismiss).toHaveBeenCalledWith(
            'login-network-issue-toast'
        );
        expect(mocks.toast.warning).toHaveBeenCalledTimes(1);
    });

    describe('automatic login completion toast', () => {
        test('announces success after TOTP verification fetches the authenticated account', async () => {
            const store = await createAuthStore();
            const saved = {
                user: { id: 'usr_saved', displayName: 'Saved User' },
                loginParams: { username: 'alice', password: 'password' }
            };
            vi.spyOn(store, 'getSavedCredentials').mockResolvedValue(saved);
            mocks.request.mockResolvedValueOnce({
                requiresTwoFactorAuth: ['totp']
            });
            mocks.modalStore.otpPrompt
                .mockResolvedValueOnce({ ok: true, value: 'totp' })
                .mockResolvedValueOnce({ ok: true, value: '123456' });
            mocks.getCurrentUser.mockImplementationOnce(async () => {
                await store.handleCurrentUserUpdate(saved.user);
                return { json: saved.user };
            });
            const { runHandleAutoLoginFlow } = await vi.importActual(
                '../../coordinators/authAutoLoginCoordinator'
            );
            await runHandleAutoLoginFlow({ isOnline: () => true });
            expect(mocks.authRequest.verifyTOTP).toHaveBeenCalledWith({
                code: '123456'
            });
            expect(store.authenticatedUserId).toBe('usr_saved');
            expect(mocks.toast.success).toHaveBeenCalledExactlyOnceWith(
                'message.auth.auto_login_success'
            );
        });

        test('announces success after this attempt receives an authenticated user, before background initialization finishes', async () => {
            const store = await createAuthStore();
            const saved = {
                user: { id: 'usr_saved', displayName: 'Saved User' },
                loginParams: { username: 'alice', password: 'password' }
            };
            vi.spyOn(store, 'getSavedCredentials').mockResolvedValue(saved);
            mocks.request.mockResolvedValueOnce(saved.user);
            const { runHandleAutoLoginFlow } = await vi.importActual(
                '../../coordinators/authAutoLoginCoordinator'
            );
            await runHandleAutoLoginFlow({ isOnline: () => true });
            expect(mockWatchState.isLoggedIn).toBe(false);
            expect(store.authenticatedUserId).toBe('usr_saved');
            expect(mocks.toast.success).toHaveBeenCalledExactlyOnceWith(
                'message.auth.auto_login_success'
            );
        });

        test('clears the previous success before a cancelled new attempt', async () => {
            const store = await createAuthStore();
            await store.handleCurrentUserUpdate({ id: 'usr_saved' });
            expect(store.authenticatedUserId).toBe('usr_saved');
            const saved = {
                user: { id: 'usr_saved', displayName: 'Saved User' },
                loginParams: { username: 'alice', password: 'password' }
            };
            vi.spyOn(store, 'getSavedCredentials').mockResolvedValue(saved);
            mocks.request.mockResolvedValueOnce({
                requiresTwoFactorAuth: ['totp']
            });
            mocks.modalStore.otpPrompt.mockResolvedValueOnce({
                ok: false,
                reason: 'cancel',
                value: ''
            });
            const { runHandleAutoLoginFlow } = await vi.importActual(
                '../../coordinators/authAutoLoginCoordinator'
            );
            await runHandleAutoLoginFlow({ isOnline: () => true });
            expect(store.authenticatedUserId).toBe('');
            expect(mocks.toast.success).not.toHaveBeenCalled();
        });

        test('still reports an API failure as a failure', async () => {
            const store = await createAuthStore();
            const saved = {
                user: { id: 'usr_saved', displayName: 'Saved User' },
                loginParams: { username: 'alice', password: 'password' }
            };
            vi.spyOn(store, 'getSavedCredentials').mockResolvedValue(saved);
            mocks.request.mockRejectedValueOnce(
                new Error('Network unavailable')
            );
            const { runHandleAutoLoginFlow } = await vi.importActual(
                '../../coordinators/authAutoLoginCoordinator'
            );
            await runHandleAutoLoginFlow({ isOnline: () => true });
            expect(mocks.toast.success).not.toHaveBeenCalled();
            expect(mocks.toast.error).toHaveBeenCalledWith(
                'message.auth.auto_login_failed'
            );
            expect(store.attemptingAutoLogin).toBe(false);
        });

        test.each(['cancel', 'dismiss', 'replaced'])(
            'does not announce success after verification choice is %s',
            async (reason) => {
                const store = await createAuthStore();
                const saved = {
                    user: { id: 'usr_saved', displayName: 'Saved User' },
                    loginParams: { username: 'alice', password: 'password' }
                };
                vi.spyOn(store, 'getSavedCredentials').mockResolvedValue(saved);
                mocks.request.mockResolvedValueOnce({
                    requiresTwoFactorAuth: ['totp', 'emailOtp']
                });
                mocks.modalStore.otpPrompt.mockResolvedValueOnce({
                    ok: false,
                    reason,
                    value: ''
                });
                const { runHandleAutoLoginFlow } = await vi.importActual(
                    '../../coordinators/authAutoLoginCoordinator'
                );
                await runHandleAutoLoginFlow({ isOnline: () => true });
                expect(mocks.modalStore.otpPrompt).toHaveBeenCalledWith(
                    expect.objectContaining({ mode: 'choice' })
                );
                expect(mockWatchState.isLoggedIn).toBe(false);
                expect(mocks.getCurrentUser).not.toHaveBeenCalled();
                expect(mocks.toast.success).not.toHaveBeenCalled();
                expect(mocks.toast.error).not.toHaveBeenCalled();
                expect(store.attemptingAutoLogin).toBe(false);
                expect(store.loginForm.loading).toBe(false);
            }
        );
    });

    describe('interactive TOTP login', () => {
        async function startChallenge(store, methods = ['totp', 'emailOtp']) {
            store.loginForm.username = 'alice';
            store.loginForm.password = 'password';
            await nextTick();
            mocks.request.mockResolvedValueOnce({
                requiresTwoFactorAuth: methods
            });
            const pending = store.login();
            for (let i = 0; i < 10; i++) await flushPromises();
            return { pending };
        }
        test('waits for a method choice and explicit code entry before verifying', async () => {
            const store = await createAuthStore();
            let choose, enter;
            mocks.modalStore.otpPrompt
                .mockImplementationOnce(
                    () =>
                        new Promise((r) => {
                            choose = r;
                        })
                )
                .mockImplementationOnce(
                    () =>
                        new Promise((r) => {
                            enter = r;
                        })
                );
            const { pending } = await startChallenge(store);
            let finished = false;
            pending.then(() => {
                finished = true;
            });
            expect(mocks.modalStore.otpPrompt).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    mode: 'choice',
                    methods: ['totp', 'emailOtp']
                })
            );
            expect(mocks.authRequest.verifyTOTP).not.toHaveBeenCalled();
            choose({ ok: true, value: 'totp' });
            await flushPromises();
            expect(finished).toBe(false);
            expect(mocks.modalStore.otpPrompt).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    mode: 'totp',
                    totpIdentity: {
                        username: 'alice',
                        endpoint: mocks.appDebug.endpointDomainVrchat
                    }
                })
            );
            enter({ ok: true, value: '123456' });
            await pending;
            expect(mocks.authRequest.verifyTOTP).toHaveBeenCalledWith({
                code: '123456'
            });
            expect(mocks.getCurrentUser).toHaveBeenCalledTimes(1);
        });
        test('uses email verification when chosen', async () => {
            const store = await createAuthStore();
            mocks.authRequest.verifyEmailOTP.mockResolvedValue({
                json: { verified: true }
            });
            mocks.modalStore.otpPrompt
                .mockResolvedValueOnce({ ok: true, value: 'emailOtp' })
                .mockResolvedValueOnce({ ok: true, value: '654321' });
            const { pending } = await startChallenge(store);
            await pending;
            expect(mocks.authRequest.verifyEmailOTP).toHaveBeenCalledWith({
                code: '654321'
            });
            expect(mocks.authRequest.verifyTOTP).not.toHaveBeenCalled();
        });
        test('rejects a method not offered by the server', async () => {
            const store = await createAuthStore();
            mocks.modalStore.otpPrompt.mockResolvedValueOnce({
                ok: true,
                value: 'emailOtp'
            });
            const { pending } = await startChallenge(store, ['totp']);
            await pending;
            expect(mocks.modalStore.otpPrompt).toHaveBeenCalledTimes(1);
            expect(mocks.authRequest.verifyTOTP).not.toHaveBeenCalled();
            expect(mocks.authRequest.verifyEmailOTP).not.toHaveBeenCalled();
        });
        test('does not verify after cancelling the chooser', async () => {
            const store = await createAuthStore();
            mocks.modalStore.otpPrompt.mockResolvedValueOnce({
                ok: false,
                reason: 'dismiss',
                value: ''
            });
            const { pending } = await startChallenge(store);
            await pending;
            expect(mocks.authRequest.verifyTOTP).not.toHaveBeenCalled();
            expect(mocks.getCurrentUser).not.toHaveBeenCalled();
        });
        test('discards a method choice after logout', async () => {
            const store = await createAuthStore();
            let choose;
            mocks.modalStore.otpPrompt.mockImplementationOnce(
                () =>
                    new Promise((r) => {
                        choose = r;
                    })
            );
            const { pending } = await startChallenge(store);
            await store.handleLogoutEvent();
            choose({ ok: true, value: 'totp' });
            await pending;
            expect(mocks.modalStore.otpPrompt).toHaveBeenCalledTimes(1);
            expect(mocks.authRequest.verifyTOTP).not.toHaveBeenCalled();
        });
    });
});
