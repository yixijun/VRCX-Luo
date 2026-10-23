import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVrDashboardController } from '../vrDashboardController';

describe('SteamVR dashboard command boundary', () => {
    let deps, process, ctx;
    const command = (action, extra = {}) => JSON.stringify({id: 'one', accountId: 'account-a', action, ...extra});
    beforeEach(() => {
        ctx = {accountId: 'account-a', friends: [{id: 'friend', location: 'current-location'}], invites: [{id: 'invite'}]};
        deps = {context: () => ctx, snapshot: () => ({accountId: ctx.accountId}), publish: vi.fn(), settings: vi.fn(), join: vi.fn(), invite: vi.fn(), respond: vi.fn()};
        process = createVrDashboardController(deps);
    });
    it('rejects stale account commands and returns the current snapshot', async () => {
        ctx.accountId = 'account-b';
        await process(command('invite', {targetId: 'friend'}));
        expect(deps.invite).not.toHaveBeenCalled();
        expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ok: false, snapshot: {accountId: 'account-b'}}));
    });
    it('clears stale UI on logout without executing settings', async () => {
        ctx.accountId = '';
        await process(command('wrist', {value: false}));
        expect(deps.settings).not.toHaveBeenCalled();
        expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ok: false, snapshot: {accountId: ''}}));
    });
    it.each(['vr', 'desktop', 'current'])('uses the current friend and explicit %s mode', async (mode) => {
        await process(command('join', {targetId: 'friend', mode, location: 'untrusted-location'}));
        expect(deps.join).toHaveBeenCalledWith(ctx.friends[0], mode);
    });
    it('requires a mode before accepting or joining', async () => {
        await process(command('accept', {targetId: 'invite'}));
        await process(command('join', {id: 'two', targetId: 'friend'}));
        expect(deps.respond).not.toHaveBeenCalled();
        expect(deps.join).not.toHaveBeenCalled();
    });
    it('does not act on removed friends or handled invitations', async () => {
        await process(command('requestInvite', {targetId: 'removed'}));
        await process(command('decline', {id: 'two', targetId: 'expired'}));
        expect(deps.invite).not.toHaveBeenCalled();
        expect(deps.respond).not.toHaveBeenCalled();
    });
    it('passes explicit switch values and rejects non-booleans', async () => {
        await process(command('hud', {value: false}));
        await process(command('silent', {id: 'two', value: 'false'}));
        expect(deps.settings).toHaveBeenCalledExactlyOnceWith('hud', false);
    });
    it('does not resend completed commands', async () => {
        const json = command('invite', {targetId: 'friend'});
        await process(json);
        await process(json);
        expect(deps.invite).toHaveBeenCalledTimes(1);
    });
    it('a rejected concurrent command cannot release another command lock', async () => {
        let complete;
        deps.invite.mockImplementation(() => new Promise((resolve) => {complete = resolve;}));
        const first = process(command('invite', {targetId: 'friend'}));
        await process(command('wrist', {id: 'two', value: true}));
        await process(command('hud', {id: 'three', value: true}));
        expect(deps.settings).not.toHaveBeenCalled();
        complete();
        await first;
        await process(command('hud', {id: 'four', value: true}));
        expect(deps.settings).toHaveBeenCalledExactlyOnceWith('hud', true);
    });
    it('reports action failures to the VR UI', async () => {
        deps.respond.mockRejectedValue(new Error('network unavailable'));
        await process(command('decline', {targetId: 'invite'}));
        expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ok: false, message: 'network unavailable'}));
    });
});
