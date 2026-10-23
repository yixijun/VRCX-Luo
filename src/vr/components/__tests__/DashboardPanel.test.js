import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import DashboardPanel from '../DashboardPanel.vue';

describe('SteamVR dashboard panel', () => {
    let wrapper;
    let submit;
    const snapshot = {accountId: 'account', displayName: 'Player', gameRunning: false, location: 'World', settings: {wrist: true}, friends: [{id: 'friend', name: 'Friend', online: true, canJoin: true}], invites: []};
    const button = (label) => wrapper.findAll('button').find((item) => item.text() === label);
    beforeEach(async () => {
        vi.useFakeTimers();
        submit = vi.fn(async () => true);
        vi.stubGlobal('AppApiVr', {SubmitDashboardAction: submit, GetVRDevices: vi.fn(async () => [])});
        wrapper = mount(DashboardPanel, {attachTo: document.body});
        await flushPromises();
        wrapper.vm.receive(JSON.stringify({id: JSON.parse(submit.mock.calls[0][0]).id, ok: true, snapshot}));
        await wrapper.vm.$nextTick();
    });
    afterEach(() => {wrapper.unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();});
    it('requires an inline mode choice before joining a friend', async () => {
        await button('好友').trigger('click');
        await button('加入').trigger('click');
        expect(submit).toHaveBeenCalledTimes(1);
        expect(button('在运行中的 VRChat 打开').element.disabled).toBe(true);
        await button('桌面启动').trigger('click');
        expect(JSON.parse(submit.mock.lastCall[0])).toMatchObject({action: 'join', mode: 'desktop', targetId: 'friend', accountId: 'account'});
    });
    it('requires confirmation before sending a real invitation', async () => {
        await button('好友').trigger('click');
        await wrapper.findAll('button').find((item) => item.text() === '邀请' && item.element.closest('article')).trigger('click');
        expect(submit).toHaveBeenCalledTimes(1);
        await button('取消').trigger('click');
        expect(submit).toHaveBeenCalledTimes(1);
    });
    it('clears old-account confirmations when the account changes', async () => {
        await button('好友').trigger('click');
        await button('加入').trigger('click');
        wrapper.vm.receive(JSON.stringify({snapshot: {...snapshot, accountId: 'new-account'}}));
        await wrapper.vm.$nextTick();
        expect(button('桌面启动')).toBeUndefined();
    });
    it.each([0, 1])('routes native edge coordinates %s to the correct atlas UI position', async (y) => {
        const root = wrapper.find('[data-dashboard-root]').element;
        vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({left: 0, top: 512, width: 1024, height: 1024});
        const target = button('好友').element;
        const hitTest = vi.fn(() => target);
        Object.defineProperty(document, 'elementFromPoint', {value: hitTest, configurable: true});
        wrapper.vm.input(JSON.stringify({x: 1, y, click: true}));
        await wrapper.vm.$nextTick();
        expect(hitTest).toHaveBeenCalledWith(1023.5, 512 + Math.min(y*1024, 1023.5));
        expect(button('加入')).toBeDefined();
    });
    it('does not invoke disabled or outside controls', () => {
        const disabled = button('刷新').element;
        disabled.disabled = true;
        Object.defineProperty(document, 'elementFromPoint', {value: () => disabled, configurable: true});
        wrapper.vm.input(JSON.stringify({x: .5, y: .5, click: true}));
        wrapper.vm.input(JSON.stringify({x: -1, y: 0, click: true}));
        expect(submit).toHaveBeenCalledTimes(1);
    });
});
