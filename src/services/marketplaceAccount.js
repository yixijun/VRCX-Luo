import { effectScope, watch } from 'vue';
import { accountHub } from './accountHub';
import { watchState } from './watchState';

// The default HTTP client belongs to the primary login, not the selected view.
export function isPrimaryMarketplaceAccount(userId) {
    return Boolean(
        watchState.isLoggedIn &&
        userId &&
        accountHub.viewMode === 'primary' &&
        (!accountHub.primaryId || accountHub.primaryId === userId)
    );
}

export function watchMarketplaceAccount(getUserId, onChange) {
    return watch(
        [
            getUserId,
            () => accountHub.viewMode,
            () => watchState.isLoggedIn,
            // Registering the same primary just after login is not a switch.
            () => accountHub.primaryId || getUserId()
        ],
        onChange,
        { flush: 'sync' }
    );
}

/** Capture one account lifetime, including switches away and back. */
export function captureMarketplaceAccount(getUserId) {
    const userId = getUserId();
    let invalidated = !isPrimaryMarketplaceAccount(userId);
    // Requests can outlive their caller's component scope. Keep watching until
    // the response settles, then release this detached scope in finally.
    const scope = effectScope(true);
    scope.run(() =>
        watchMarketplaceAccount(getUserId, () => {
            invalidated = true;
        })
    );
    return {
        userId,
        isCurrent: () =>
            !invalidated &&
            getUserId() === userId &&
            isPrimaryMarketplaceAccount(userId),
        dispose: () => scope.stop()
    };
}
