import { describe, expect, it, vi } from 'vitest';

import {
    createDirectoryDialogAdapter,
    createFileDialogAdapter
} from '../fileDialogAdapter';

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

describe('createDirectoryDialogAdapter', () => {
    it('forwards the CEF default path and selected directory', async () => {
        const OpenFolderSelectorDialog = vi
            .fn()
            .mockResolvedValue('C:/VRCX/prints');
        const openDirectoryDialog = createDirectoryDialogAdapter({
            isWindows: true,
            appApi: { OpenFolderSelectorDialog }
        });

        await expect(
            openDirectoryDialog({ defaultPath: 'C:/VRCX' })
        ).resolves.toBe('C:/VRCX/prints');
        expect(OpenFolderSelectorDialog).toHaveBeenCalledWith('C:/VRCX');
    });

    it('uses the Electron directory picker without a CEF-only path argument', async () => {
        const electronOpenDirectoryDialog = vi
            .fn()
            .mockResolvedValue('/home/user/prints');
        const openDirectoryDialog = createDirectoryDialogAdapter({
            isWindows: false,
            electronApi: { openDirectoryDialog: electronOpenDirectoryDialog }
        });

        await expect(
            openDirectoryDialog({ defaultPath: '/home/user' })
        ).resolves.toBe('/home/user/prints');
        expect(electronOpenDirectoryDialog).toHaveBeenCalledWith();
    });

    it('preserves host-specific directory cancellation values', async () => {
        const cefOpenDirectoryDialog = createDirectoryDialogAdapter({
            isWindows: true,
            appApi: {
                OpenFolderSelectorDialog: vi.fn().mockResolvedValue('')
            }
        });
        const electronOpenDirectoryDialog = createDirectoryDialogAdapter({
            isWindows: false,
            electronApi: {
                openDirectoryDialog: vi.fn().mockResolvedValue(null)
            }
        });

        await expect(cefOpenDirectoryDialog()).resolves.toBe('');
        await expect(electronOpenDirectoryDialog()).resolves.toBeNull();
    });
});
