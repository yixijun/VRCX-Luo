import { describe, expect, test, vi } from 'vitest';
import {
    createInventoryNotificationTask,
    INVENTORY_NOTIFICATION_INITIAL_DELAY_SECONDS,
    INVENTORY_NOTIFICATION_INTERVAL_SECONDS
} from '../updateLoopTasks/inventoryNotificationTask';

const settle = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
function tick(task, seconds) {
    for (let i = 0; i < seconds; i++) task.tick();
}

describe('inventory notification task', () => {
    test('waits after login, repeats every three hours, and resets on login changes', async () => {
        const checkInventoryBundles = vi.fn();
        const checkFreeStoreItems = vi.fn();
        const task = createInventoryNotificationTask({
            checkInventoryBundles,
            checkFreeStoreItems
        });
        tick(task, INVENTORY_NOTIFICATION_INITIAL_DELAY_SECONDS - 1);
        await settle();
        expect(checkInventoryBundles).not.toHaveBeenCalled();
        task.tick();
        await settle();
        expect(checkInventoryBundles).toHaveBeenCalledTimes(1);
        expect(checkFreeStoreItems).toHaveBeenCalledTimes(1);
        tick(task, INVENTORY_NOTIFICATION_INTERVAL_SECONDS - 1);
        await settle();
        expect(checkInventoryBundles).toHaveBeenCalledTimes(1);
        task.tick();
        await settle();
        expect(checkInventoryBundles).toHaveBeenCalledTimes(2);
        task.reset();
        tick(task, INVENTORY_NOTIFICATION_INITIAL_DELAY_SECONDS);
        await settle();
        expect(checkInventoryBundles).toHaveBeenCalledTimes(3);
    });

    test('does not overlap pending requests and recovers after errors', async () => {
        let reject;
        const onError = vi.fn();
        const checkInventoryBundles = vi.fn().mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                })
        );
        const checkFreeStoreItems = vi.fn();
        const task = createInventoryNotificationTask({
            checkInventoryBundles,
            checkFreeStoreItems,
            onError
        });
        tick(task, 60);
        await settle();
        task.reset();
        tick(task, 100);
        await settle();
        expect(checkInventoryBundles).toHaveBeenCalledTimes(1);
        const error = new Error('offline');
        reject(error);
        await settle();
        expect(onError).toHaveBeenCalledWith(error);
        task.tick();
        await settle();
        expect(checkInventoryBundles).toHaveBeenCalledTimes(2);
    });
});
