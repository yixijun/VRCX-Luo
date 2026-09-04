import { queryClient } from './client';

/**
 * Provides the cache-side effects needed by API and lifecycle modules.
 *
 * Keeping the QueryClient implementation behind this small interface gives
 * callers a stable seam while retaining the existing invalidation semantics.
 *
 * @param {object} client
 * @returns {{invalidateActive: (queryKey: unknown[]) => Promise<unknown>, removeExact: (queryKey: unknown[]) => unknown, cancelAll: () => Promise<unknown>, clear: () => unknown}}
 */
export function createQueryCacheAdapter(client = queryClient) {
    return Object.freeze({
        invalidateActive(queryKey) {
            return client.invalidateQueries({
                queryKey,
                refetchType: 'active'
            });
        },

        removeExact(queryKey) {
            return client.removeQueries({
                queryKey,
                exact: true
            });
        },

        cancelAll() {
            return client.cancelQueries();
        },

        clear() {
            return client.clear();
        }
    });
}

export const queryCache = createQueryCacheAdapter();
