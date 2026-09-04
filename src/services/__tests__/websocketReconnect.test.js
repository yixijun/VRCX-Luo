import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    scheduleWebSocketReconnect,
    WEBSOCKET_RECONNECT_DELAY_MS
} from '../websocketReconnect';

describe('scheduleWebSocketReconnect', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('reconnects at the five-second deadline when all guards remain true', () => {
        vi.useFakeTimers();
        const reconnect = vi.fn();
        const setTimeout = vi.fn(globalThis.setTimeout);

        scheduleWebSocketReconnect({
            setTimeout,
            isLoggedIn: () => true,
            isFriendsLoaded: () => true,
            isSocketAbsent: () => true,
            reconnect
        });

        expect(setTimeout).toHaveBeenCalledWith(
            expect.any(Function),
            WEBSOCKET_RECONNECT_DELAY_MS
        );
        vi.advanceTimersByTime(WEBSOCKET_RECONNECT_DELAY_MS - 1);
        expect(reconnect).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(reconnect).toHaveBeenCalledOnce();
    });

    it.each([
        ['logged out', { isLoggedIn: false }],
        ['friends are not loaded', { isFriendsLoaded: false }],
        ['a socket is already present', { isSocketAbsent: false }]
    ])('does not reconnect when %s', (_reason, overrides) => {
        vi.useFakeTimers();
        const reconnect = vi.fn();
        scheduleWebSocketReconnect({
            setTimeout: globalThis.setTimeout,
            isLoggedIn: () => overrides.isLoggedIn ?? true,
            isFriendsLoaded: () => overrides.isFriendsLoaded ?? true,
            isSocketAbsent: () => overrides.isSocketAbsent ?? true,
            reconnect
        });

        vi.advanceTimersByTime(WEBSOCKET_RECONNECT_DELAY_MS);
        expect(reconnect).not.toHaveBeenCalled();
    });

    it('evaluates guards at callback time so logout cancels a pending reconnect', () => {
        vi.useFakeTimers();
        const reconnect = vi.fn();
        let isLoggedIn = true;
        scheduleWebSocketReconnect({
            setTimeout: globalThis.setTimeout,
            isLoggedIn: () => isLoggedIn,
            isFriendsLoaded: () => true,
            isSocketAbsent: () => true,
            reconnect
        });

        isLoggedIn = false;
        vi.advanceTimersByTime(WEBSOCKET_RECONNECT_DELAY_MS);
        expect(reconnect).not.toHaveBeenCalled();
    });
});
