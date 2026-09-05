import { describe, expect, it, vi } from 'vitest';

import { createFileDialogAdapter } from '../fileDialogAdapter';

describe('createFileDialogAdapter', () => {
    it('forwards CEF selector arguments and the selected path', async () => {
        const OpenFileSelectorDialog = vi
            .fn()
            .mockResolvedValue('C:/sounds/notify.wav');
        const openFileDialog = createFileDialogAdapter({
            isWindows: true,
            appApi: { OpenFileSelectorDialog }
        });

        await expect(
            openFileDialog({
                defaultPath: '',
                defaultExt: '.wav',
                defaultFilter: 'Audio Files (*.wav)|*.wav'
            })
        ).resolves.toBe('C:/sounds/notify.wav');
        expect(OpenFileSelectorDialog).toHaveBeenCalledWith(
            '',
            '.wav',
            'Audio Files (*.wav)|*.wav'
        );
    });

    it('forwards Electron filters and its selected path', async () => {
        const filters = [
            { name: 'Audio Files', extensions: ['wav', 'mp3'] },
            { name: 'All files', extensions: ['*'] }
        ];
        const electronOpenFileDialog = vi
            .fn()
            .mockResolvedValue('/home/user/notify.mp3');
        const openFileDialog = createFileDialogAdapter({
            isWindows: false,
            electronApi: { openFileDialog: electronOpenFileDialog }
        });

        await expect(openFileDialog({ filters })).resolves.toBe(
            '/home/user/notify.mp3'
        );
        expect(electronOpenFileDialog).toHaveBeenCalledWith(filters);
    });

    it('preserves host-specific cancellation values', async () => {
        const cefOpenFileDialog = createFileDialogAdapter({
            isWindows: true,
            appApi: {
                OpenFileSelectorDialog: vi.fn().mockResolvedValue('')
            }
        });
        const electronOpenFileDialog = createFileDialogAdapter({
            isWindows: false,
            electronApi: {
                openFileDialog: vi.fn().mockResolvedValue(null)
            }
        });

        await expect(cefOpenFileDialog()).resolves.toBe('');
        await expect(electronOpenFileDialog()).resolves.toBeNull();
    });

    it('does not swallow selector errors', async () => {
        const error = new Error('dialog unavailable');
        const openFileDialog = createFileDialogAdapter({
            isWindows: true,
            appApi: {
                OpenFileSelectorDialog: vi.fn().mockRejectedValue(error)
            }
        });

        await expect(openFileDialog()).rejects.toBe(error);
    });
});
