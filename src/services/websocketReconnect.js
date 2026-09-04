/**
 * Delay used for reconnecting a closed WebSocket.
 */
export const WEBSOCKET_RECONNECT_DELAY_MS = 5000;

/**
 * Schedules a reconnect attempt behind explicit state and timer capabilities.
 *
 * @param {object} dependencies
 * @param {function} dependencies.setTimeout
 * @param {function} dependencies.isLoggedIn
 * @param {function} dependencies.isFriendsLoaded
 * @param {function} dependencies.isSocketAbsent
 * @param {function} dependencies.reconnect
 * @returns {*}
 */
export function scheduleWebSocketReconnect({
    setTimeout,
    isLoggedIn,
    isFriendsLoaded,
    isSocketAbsent,
    reconnect
}) {
    return setTimeout(() => {
        if (isLoggedIn() && isFriendsLoaded() && isSocketAbsent()) {
            reconnect();
        }
    }, WEBSOCKET_RECONNECT_DELAY_MS);
}
