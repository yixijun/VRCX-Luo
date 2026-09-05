import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import policy from '../../../src-electron/rendererSourcePolicy.cjs';

const {
    assertTrustedRendererSource,
    createTrustedRendererGuard,
    getRendererSourceUrl,
    isTrustedRendererSource
} = policy;

const appRoot = path.resolve('C:/VRCX-Luo');
const packagedIndexUrl = pathToFileURL(
    path.join(appRoot, 'build/html/index.html')
).href;
const packagedVrUrl = pathToFileURL(
    path.join(appRoot, 'build/html/vr.html')
).href;

function createEvent(url, fallbackUrl = url) {
    return {
        senderFrame: { url },
        sender: { getURL: vi.fn(() => fallbackUrl) }
    };
}

describe('renderer source policy', () => {
    it('trusts only the packaged renderer documents', () => {
        expect(
            isTrustedRendererSource(createEvent(`${packagedIndexUrl}#/feed`), {
                appRoot
            })
        ).toBe(true);
        expect(
            isTrustedRendererSource(createEvent(`${packagedVrUrl}?overlay=1`), {
                appRoot
            })
        ).toBe(true);
        expect(
            isTrustedRendererSource(
                createEvent(
                    pathToFileURL(path.join(appRoot, 'build/html/other.html'))
                        .href
                ),
                { appRoot }
            )
        ).toBe(false);
    });

    it('allows the exact hot-reload documents only when explicitly enabled', () => {
        const devIndex = createEvent('http://localhost:9000/index.html');
        const devVr = createEvent('http://localhost:9000/vr.html#overlay');
        const devOther = createEvent('http://localhost:9000/devtools.html');

        expect(
            isTrustedRendererSource(devIndex, {
                appRoot,
                allowDevServer: false
            })
        ).toBe(false);
        expect(
            isTrustedRendererSource(devIndex, { appRoot, allowDevServer: true })
        ).toBe(true);
        expect(
            isTrustedRendererSource(devVr, { appRoot, allowDevServer: true })
        ).toBe(true);
        expect(
            isTrustedRendererSource(devOther, {
                appRoot,
                allowDevServer: true
            })
        ).toBe(false);
        expect(
            isTrustedRendererSource(
                createEvent('http://127.0.0.1:9000/index.html'),
                { appRoot, allowDevServer: true }
            )
        ).toBe(false);
    });

    it('uses the sender frame URL and rejects missing or untrusted sources', () => {
        const fallback = createEvent('about:blank', packagedIndexUrl);
        expect(getRendererSourceUrl(fallback)).toBe('about:blank');
        expect(isTrustedRendererSource(fallback, { appRoot })).toBe(false);

        const legacyEvent = {
            sender: { getURL: vi.fn(() => packagedIndexUrl) }
        };
        expect(getRendererSourceUrl(legacyEvent)).toBe(packagedIndexUrl);
        expect(isTrustedRendererSource(legacyEvent, { appRoot })).toBe(true);

        expect(() =>
            assertTrustedRendererSource(createEvent('https://example.com'), {
                appRoot
            })
        ).toThrow(/not trusted/);
        expect(() => assertTrustedRendererSource({}, { appRoot })).toThrow(
            /not trusted/
        );
    });

    it('guards an IPC handler without changing its arguments or return value', async () => {
        const implementation = vi.fn((event, value) =>
            Promise.resolve([event, value])
        );
        const guarded = createTrustedRendererGuard({ appRoot })(implementation);
        const event = createEvent(packagedIndexUrl);

        await expect(guarded(event, 'payload')).resolves.toEqual([
            event,
            'payload'
        ]);
        expect(implementation).toHaveBeenCalledWith(event, 'payload');
        expect(() =>
            guarded(createEvent('https://example.com'), 'payload')
        ).toThrow(/not trusted/);
    });
});
