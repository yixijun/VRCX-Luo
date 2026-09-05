import { describe, expect, it, vi } from 'vitest';

import { createClipboardAdapter } from '../clipboardAdapter';

describe('createClipboardAdapter', () => {
    it('reads clipboard text through the Electron bridge on Linux', async () => {
        const getClipboardText = vi
            .fn()
            .mockResolvedValue('electron clipboard');
        const getClipboard = createClipboardAdapter({
            isLinux: true,
            electronApi: { getClipboardText }
        });

        await expect(getClipboard()).resolves.toBe('electron clipboard');
        expect(getClipboardText).toHaveBeenCalledOnce();
    });

    it('reads clipboard text through the CEF bridge on Windows', async () => {
        const GetClipboard = vi.fn().mockResolvedValue('cef clipboard');
        const getClipboard = createClipboardAdapter({
            isLinux: false,
            electronApi: { getClipboardText: vi.fn() },
            appApi: { GetClipboard }
        });

        await expect(getClipboard()).resolves.toBe('cef clipboard');
        expect(GetClipboard).toHaveBeenCalledOnce();
    });

    it('keeps the CEF failure fallback as an empty string', async () => {
        const error = new Error('clipboard unavailable');
        const logError = vi.fn();
        const getClipboard = createClipboardAdapter({
            isLinux: false,
            electronApi: { getClipboardText: vi.fn() },
            appApi: { GetClipboard: vi.fn().mockRejectedValue(error) },
            logError
        });

        await expect(getClipboard()).resolves.toBe('');
        expect(logError).toHaveBeenCalledWith(error);
    });
});
