export const INVENTORY_NOTIFICATION_INTERVAL_SECONDS = 10800;
export const INVENTORY_NOTIFICATION_INITIAL_DELAY_SECONDS = 60;

/**
 * Check for redeemable inventory and store items without delaying other tasks.
 * @param {object} dependencies
 * @param {Function} dependencies.checkInventoryBundles
 * @param {Function} dependencies.checkFreeStoreItems
 * @param {(error: unknown) => void} [dependencies.onError]
 * @returns {{tick: () => void, reset: () => void}}
 */
export function createInventoryNotificationTask({
    checkInventoryBundles,
    checkFreeStoreItems,
    onError = console.error
}) {
    let remaining = INVENTORY_NOTIFICATION_INITIAL_DELAY_SECONDS;
    let pending = false;
    return {
        tick() {
            if (--remaining > 0 || pending) return;
            remaining = INVENTORY_NOTIFICATION_INTERVAL_SECONDS;
            pending = true;
            Promise.resolve()
                .then(() =>
                    Promise.all([
                        checkInventoryBundles(),
                        checkFreeStoreItems()
                    ])
                )
                .catch(onError)
                .finally(() => {
                    pending = false;
                });
        },
        reset() {
            remaining = INVENTORY_NOTIFICATION_INITIAL_DELAY_SECONDS;
        }
    };
}
