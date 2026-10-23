import { afterEach, describe, expect, it, vi } from 'vitest';
import { vrWorkspace, setVrWorkspaceActive } from '../vrWorkspace';
import {
    openVrFilePicker,
    finishVrFilePicker,
    matchesVrFileFilter,
    vrFilePicker,
    chooseVrUploadFiles
} from '../vrWorkspaceFilePicker';
import { buildVrSavePath } from '../vrWorkspaceFilePicker';
import { openFileDialog, openDirectoryDialog } from '../fileDialogAdapter';

afterEach(() => {
    finishVrFilePicker();
    setVrWorkspaceActive(false);
    vi.unstubAllGlobals();
});
describe('VR file and directory selection', () => {
    it('resolves cancellation without leaving the caller pending', async () => {
        const selection = openVrFilePicker('file', {
            defaultPath: 'C:/Photos'
        });
        expect(vrFilePicker.value.defaultPath).toBe('C:/Photos');
        finishVrFilePicker();
        await expect(selection).resolves.toBe('');
    });
    it('cancels replaced requests and resolves only the current request', async () => {
        const first = openVrFilePicker('file');
        const second = openVrFilePicker('directory');
        await expect(first).resolves.toBe('');
        finishVrFilePicker('C:/Photos');
        await expect(second).resolves.toBe('C:/Photos');
    });
    it('uses VR pickers for both public facades while VR is active', async () => {
        const native = vi.fn();
        vi.stubGlobal('AppApi', {
            OpenFileSelectorDialog: native,
            OpenFolderSelectorDialog: native
        });
        vrWorkspace.active = true;
        const file = openFileDialog({ defaultExt: '.png' });
        finishVrFilePicker('C:/Photos/vr.png');
        await expect(file).resolves.toBe('C:/Photos/vr.png');
        const folder = openDirectoryDialog();
        finishVrFilePicker('C:/Photos');
        await expect(folder).resolves.toBe('C:/Photos');
        expect(native).not.toHaveBeenCalled();
    });
    it('respects host file filters including uppercase filenames and all-files filters', () => {
        expect(
            matchesVrFileFilter('IMAGE.PNG', { defaultFilter: 'PNG|*.png' })
        ).toBe(true);
        expect(
            matchesVrFileFilter('backup.exe', { defaultFilter: 'JSON|*.json' })
        ).toBe(false);
        expect(
            matchesVrFileFilter('photo.jpg', {
                filters: [{ extensions: ['png', 'jpg'] }]
            })
        ).toBe(true);
        expect(
            matchesVrFileFilter('backup.exe', { defaultFilter: 'All|*.*' })
        ).toBe(true);
    });

    it('preserves multi-file uploads through the native browser chooser seam', async () => {
        const selection = chooseVrUploadFiles('selectMultiple');
        expect(vrFilePicker.value.mode).toBe('files');
        finishVrFilePicker(['C:/one.png', 'C:/two.png']);
        await expect(selection).resolves.toEqual(['C:/one.png', 'C:/two.png']);
        const cancelled = chooseVrUploadFiles('selectSingle');
        finishVrFilePicker();
        await expect(cancelled).resolves.toEqual([]);
    });
    it('returns save paths and rejects names that escape the chosen folder', async () => {
        expect(buildVrSavePath('C:\\Photos\\', '测试.json')).toBe(
            'C:\\Photos\\测试.json'
        );
        expect(buildVrSavePath('/home/user', 'backup.json')).toBe(
            '/home/user/backup.json'
        );
        for (const name of [
            '../outside.json',
            '..',
            'a/b.json',
            'a\\b.json',
            'file.'
        ])
            expect(buildVrSavePath('C:/Photos', name)).toBe('');
        const saving = chooseVrUploadFiles('save', { filename: 'backup.json' });
        expect(vrFilePicker.value).toMatchObject({
            mode: 'save',
            filename: 'backup.json'
        });
        finishVrFilePicker('C:/Photos/backup.json');
        await expect(saving).resolves.toEqual(['C:/Photos/backup.json']);
    });
});
