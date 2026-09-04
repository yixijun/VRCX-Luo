import { describe, expect, test, vi } from 'vitest';

import { createQueryCacheAdapter } from '../queryCache';

function createClient() {
    return {
        invalidateQueries: vi.fn().mockResolvedValue('invalidated'),
        removeQueries: vi.fn().mockReturnValue('removed'),
        cancelQueries: vi.fn().mockResolvedValue('cancelled'),
        clear: vi.fn().mockReturnValue('cleared')
    };
}

describe('query cache adapter', () => {
    test('invalidates active queries with the legacy scope options', async () => {
        const client = createClient();
        const cache = createQueryCacheAdapter(client);

        await expect(cache.invalidateActive(['group', 'grp_1'])).resolves.toBe(
            'invalidated'
        );

        expect(client.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['group', 'grp_1'],
            refetchType: 'active'
        });
    });

    test('removes only the exact query key', () => {
        const client = createClient();
        const cache = createQueryCacheAdapter(client);

        expect(cache.removeExact(['file', 'file_1'])).toBe('removed');
        expect(client.removeQueries).toHaveBeenCalledWith({
            queryKey: ['file', 'file_1'],
            exact: true
        });
    });

    test('exposes lifecycle cancellation and clear operations', async () => {
        const client = createClient();
        const cache = createQueryCacheAdapter(client);

        await expect(cache.cancelAll()).resolves.toBe('cancelled');
        expect(cache.clear()).toBe('cleared');
        expect(client.cancelQueries).toHaveBeenCalledWith();
        expect(client.clear).toHaveBeenCalledWith();
    });

    test('returns an immutable adapter interface', () => {
        const cache = createQueryCacheAdapter(createClient());

        expect(Object.isFrozen(cache)).toBe(true);
    });
});
