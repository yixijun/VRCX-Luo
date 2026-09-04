export const CURRENT_USER_REFRESH_SECONDS = 300;

/**
 * Creates the current-user refresh task used by the update loop.
 *
 * The task owns only its countdown. The effect that refreshes the user is
 * injected by the caller so this module does not depend on Pinia or a host
 * API.
 *
 * @param {object} dependencies
 * @param {() => void} dependencies.getCurrentUser
 * @param {number} [dependencies.interval=300]
 * @returns {{ tick: () => void, reset: () => void, setNext: (value: number) => void }}
 */
export function createCurrentUserTask({
    getCurrentUser,
    interval = CURRENT_USER_REFRESH_SECONDS
}) {
    let nextRefresh = interval;

    return {
        tick() {
            if (--nextRefresh <= 0) {
                nextRefresh = interval;
                getCurrentUser();
            }
        },

        reset() {
            nextRefresh = interval;
        },

        setNext(value) {
            nextRefresh = value;
        }
    };
}
