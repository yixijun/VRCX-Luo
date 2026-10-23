const ACTIONS = new Set(['refresh', 'wrist', 'hud', 'silent', 'sleep', 'join', 'invite', 'requestInvite', 'accept', 'decline']);

/** A single-account command boundary shared by CEF and Electron dashboards. */
export function createVrDashboardController(deps) {
    const completed = new Set();
    let busy = false;
    return async (json) => {
        let request;
        let ownsBusy = false;
        try {
            request = JSON.parse(json);
            if (!request || typeof request.id !== 'string' || !request.id.length || request.id.length > 80 || !ACTIONS.has(request.action)) throw new Error('无效操作');
            if (busy || completed.has(request.id)) throw new Error('操作正在处理中，请勿重复点击');
            completed.add(request.id);
            if (completed.size > 256) completed.delete(completed.values().next().value);
            busy = true;
            ownsBusy = true;
            const context = deps.context();
            if (!context.accountId) throw new Error('请先在桌面登录 VRCX-Luo');
            if (request.action !== 'refresh' && request.accountId !== context.accountId) throw new Error('账户已切换，请刷新面板后重试');
            if (['wrist', 'hud', 'silent', 'sleep'].includes(request.action)) {
                if (typeof request.value !== 'boolean') throw new Error('无效开关状态');
                await deps.settings(request.action, request.value);
            } else if (['join', 'invite', 'requestInvite'].includes(request.action)) {
                const friend = context.friends.find((item) => item.id === request.targetId);
                if (!friend) throw new Error('该好友已不在当前账户中');
                if (request.action === 'join') {
                    if (!['current', 'vr', 'desktop'].includes(request.mode)) throw new Error('请选择加入方式');
                    await deps.join(friend, request.mode);
                } else await deps.invite(friend, request.action === 'requestInvite');
            } else if (['accept', 'decline'].includes(request.action)) {
                const row = context.invites.find((item) => item.id === request.targetId);
                if (!row) throw new Error('邀请已失效或已处理');
                if (request.action === 'accept' && !['current', 'vr', 'desktop'].includes(request.mode)) throw new Error('请选择加入方式');
                await deps.respond(row, request.action === 'accept', request.mode);
            }
            deps.publish({ id: request.id, ok: true, message: request.action === 'refresh' ? '' : ['join', 'accept'].includes(request.action) ? '已提交加入请求，请在 VRChat 中确认' : '操作已完成', snapshot: deps.snapshot() });
        } catch (error) {
            deps.publish({ id: request?.id, ok: false, message: error.message, snapshot: deps.snapshot() });
        } finally { if (ownsBusy) busy = false; }
    };
}
