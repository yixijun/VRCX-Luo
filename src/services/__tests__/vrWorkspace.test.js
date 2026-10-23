import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    handleVrWorkspaceCommand,
    vrWorkspace,
    setVrWorkspaceActive
} from '../vrWorkspace';

afterEach(() => {
    setVrWorkspaceActive(false);
    vi.unstubAllGlobals();
});
describe('dedicated VR workspace session', () => {
    it('enables VR layout, renews capture and restores desktop presentation on close', async () => {
        vi.stubGlobal('LINUX', false);
        const capture = vi.fn(async () => true);
        const input = vi.fn(async () => true);
        vi.stubGlobal('AppApi', {
            SetVrWorkspaceCapture: capture,
            SendVrWorkspaceInput: input
        });
        await handleVrWorkspaceCommand({ type: 'open' });
        expect(vrWorkspace.active).toBe(true);
        expect(document.body.classList.contains('vr-workspace-active')).toBe(
            true
        );
        await handleVrWorkspaceCommand({
            type: 'input',
            input: { type: 'key', key: 'Escape' }
        });
        expect(input).toHaveBeenCalledWith('{"type":"key","key":"Escape"}');
        await handleVrWorkspaceCommand({ type: 'close' });
        expect(vrWorkspace.active).toBe(false);
        expect(capture).toHaveBeenLastCalledWith(false);
    });
    it('a late heartbeat cannot reopen or capture the desktop layout', async () => {
        const capture = vi.fn();
        vi.stubGlobal('AppApi', { SetVrWorkspaceCapture: capture });
        await handleVrWorkspaceCommand({ type: 'ping' });
        expect(capture).not.toHaveBeenCalled();
    });
    it('restores presentation when capture cannot start', async () => {
        vi.stubGlobal('LINUX', false);
        vi.stubGlobal('AppApi', {
            SetVrWorkspaceCapture: vi.fn(async () => false)
        });
        await expect(
            handleVrWorkspaceCommand({ type: 'open' })
        ).rejects.toThrow('无法连接');
        expect(vrWorkspace.active).toBe(false);
    });
});
