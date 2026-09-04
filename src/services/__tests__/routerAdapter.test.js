import { describe, expect, it, vi } from 'vitest';

import { redirectToLogin } from '../routerAdapter';

describe('redirectToLogin', () => {
    it('redirects non-login routes through the injected router', async () => {
        const replace = vi.fn(() => Promise.resolve());
        const loadRouter = vi.fn(async () => ({
            router: {
                currentRoute: { value: { name: 'home' } },
                replace
            }
        }));

        await redirectToLogin({ loadRouter });

        expect(loadRouter).toHaveBeenCalledOnce();
        expect(replace).toHaveBeenCalledWith({ name: 'login' });
    });

    it('does not navigate when the login route is already active', async () => {
        const replace = vi.fn(() => Promise.resolve());

        await redirectToLogin({
            loadRouter: async () => ({
                router: {
                    currentRoute: { value: { name: 'login' } },
                    replace
                }
            })
        });

        expect(replace).not.toHaveBeenCalled();
    });

    it('swallows a rejected navigation just like the compatibility path', async () => {
        const replace = vi.fn(() => Promise.reject(new Error('cancelled')));

        await expect(
            redirectToLogin({
                loadRouter: async () => ({
                    router: {
                        currentRoute: { value: { name: 'settings' } },
                        replace
                    }
                })
            })
        ).resolves.toBeUndefined();
    });
});
