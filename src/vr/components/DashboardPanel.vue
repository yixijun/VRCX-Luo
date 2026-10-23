<template>
    <WorkspacePanel v-if="workspace" ref="workspacePanel" @close="workspace = false" />
    <section v-else class="dashboard-panel" data-dashboard-root>
        <header>
            <div><h1>VRCX-Luo</h1><p>{{ snapshot.displayName || '请先在桌面登录' }} · {{ snapshot.location || 'SteamVR 控制面板' }}</p></div>
            <button data-dashboard-action :disabled="busy" @click="send('refresh')">刷新</button>
            <button data-dashboard-action @click="workspace = true">VR 工作区 · 全部功能</button>
        </header>
        <nav>
            <button v-for="item in tabs" :key="item.id" data-dashboard-action :class="{active: tab === item.id}" @click="tab = item.id; page = 0">{{ item.label }}</button>
        </nav>
        <div class="message" role="status">{{ message || (busy ? '正在处理…' : '使用手柄指向按钮，按扳机操作') }}</div>

        <div v-if="confirmAction" class="confirmation">
            <h2>{{ confirmAction.label }}</h2>
            <p v-if="['join', 'accept'].includes(confirmAction.action)">请选择加入方式</p>
            <div class="buttons">
                <template v-if="['join', 'accept'].includes(confirmAction.action)">
                    <button data-dashboard-action :disabled="busy || !snapshot.gameRunning" @click="confirm('current')">在运行中的 VRChat 打开</button>
                    <button data-dashboard-action :disabled="busy" @click="confirm('vr')">VR 启动</button>
                    <button data-dashboard-action :disabled="busy" @click="confirm('desktop')">桌面启动</button>
                </template>
                <button v-else data-dashboard-action :disabled="busy" @click="confirm()">确认</button>
                <button data-dashboard-action :disabled="busy" @click="confirmAction = null">取消</button>
            </div>
        </div>

        <main v-else data-dashboard-scroll>
            <template v-if="tab === 'controls'">
                <div class="settings">
                    <button v-for="item in switches" :key="item.id" data-dashboard-action :disabled="busy || !snapshot.accountId" @click="send(item.id, {value: !snapshot.settings?.[item.id]})">
                        <span>{{ item.label }}</span><span class="pill" :class="{on: snapshot.settings?.[item.id]}">{{ snapshot.settings?.[item.id] ? '已开启' : '已关闭' }}</span>
                    </button>
                </div>
                <h2>设备状态</h2>
                <div v-if="!deviceList.length" class="empty">暂无设备数据</div>
                <div v-for="(device, index) in deviceList" :key="index" class="device">{{ deviceLabel(device) }}</div>
            </template>
            <template v-else-if="tab === 'friends'">
                <div class="buttons"><button data-dashboard-action @click="onlyOnline = !onlyOnline; page = 0">{{ onlyOnline ? '仅在线' : '全部好友' }}</button><button data-dashboard-action @click="onlyFavorite = !onlyFavorite; page = 0">{{ onlyFavorite ? '仅星标' : '所有分组' }}</button></div>
                <div v-if="!filteredFriends.length" class="empty">没有符合条件的好友</div>
                <article v-for="friend in pageFriends" :key="friend.id">
                    <div><strong>{{ friend.favorite ? '★ ' : '' }}{{ friend.name }}</strong><p>{{ friend.online ? '在线' : '离线' }} {{ friend.world }}</p></div>
                    <div class="buttons">
                        <button data-dashboard-action :disabled="busy || !friend.canJoin" @click="ask('join', friend.id, `加入 ${friend.name} 的房间`)">加入</button>
                        <button data-dashboard-action :disabled="busy || !friend.online" @click="ask('invite', friend.id, `邀请 ${friend.name} 到当前房间`)">邀请</button>
                        <button data-dashboard-action :disabled="busy || !friend.online" @click="ask('requestInvite', friend.id, `向 ${friend.name} 请求邀请`)">请求邀请</button>
                    </div>
                </article>
                <footer><button data-dashboard-action :disabled="page === 0" @click="page--">上一页</button><span>{{ page+1 }} / {{ pageCount }} · {{ filteredFriends.length }} 人</span><button data-dashboard-action :disabled="page+1 >= pageCount" @click="page++">下一页</button></footer>
            </template>
            <template v-else>
                <div v-if="!snapshot.invites?.length" class="empty">暂无待处理邀请</div>
                <article v-for="invite in snapshot.invites" :key="invite.id">
                    <div><strong>{{ invite.name }}</strong><p>{{ invite.world }}</p><p>{{ invite.message }}</p></div>
                    <div class="buttons"><button data-dashboard-action :disabled="busy" @click="ask('accept', invite.id, `接受 ${invite.name} 的邀请`)">接受并加入</button><button data-dashboard-action :disabled="busy" @click="ask('decline', invite.id, `拒绝 ${invite.name} 的邀请`)">拒绝</button></div>
                </article>
            </template>
        </main>
        <span v-if="pointer.visible" class="dashboard-pointer" :style="{left: `${pointer.x*100}%`,top: `${pointer.y*100}%`}"></span>
    </section>
</template>

<script setup>
    import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
    import WorkspacePanel from './WorkspacePanel.vue';
    const workspace = ref(false);
    const workspacePanel = ref(null);
    const snapshot = ref({ accountId: '', friends: [], invites: [], settings: {} });
    const tab = ref('controls');
    const tabs = [{id: 'controls', label: '控制与设备'}, {id: 'friends', label: '好友'}, {id: 'invites', label: '邀请'}];
    const switches = [{id: 'wrist', label: '手背 HUD'}, {id: 'hud', label: 'VR 通知'}, {id: 'silent', label: '通知静音'}, {id: 'sleep', label: '睡眠模式'}];
    const page = ref(0);
    const onlyOnline = ref(true);
    const onlyFavorite = ref(false);
    const busy = ref(false);
    const message = ref('');
    const deviceList = ref([]);
    const confirmAction = ref(null);
    const pointer = ref({x: .5, y: .5, visible: false});
    const filteredFriends = computed(() => snapshot.value.friends.filter((f) => (!onlyOnline.value || f.online) && (!onlyFavorite.value || f.favorite)));
    const pageCount = computed(() => Math.max(1, Math.ceil(filteredFriends.value.length / 7)));
    const pageFriends = computed(() => filteredFriends.value.slice(page.value*7, page.value*7+7));
    let pendingId = '';
    let refreshTimer;
    let responseTimer;
    function deviceLabel(device) {
        const labels = {headset: '头显', leftController: '左手柄', rightController: '右手柄', controller: '手柄', tracker: '追踪器', base: '基站'};
        const battery = Number(device[3]?.replace(',', '.'));
        return `${labels[device[0]] || device[0]} · ${device[1] === 'connected' ? '已连接' : '已断开'} · ${Number.isFinite(battery) ? `${Math.round(battery)}%` : '—'}${device[2] === 'charging' ? ' 充电中' : ''} · ${device[4] === 'Running_OK' ? '追踪正常' : '追踪未就绪'}`;
    }
    async function send(action, extra = {}) {
        if (busy.value) return;
        busy.value = true;
        message.value = '';
        pendingId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try {
            const accepted = await AppApiVr.SubmitDashboardAction(JSON.stringify({id: pendingId, action, accountId: snapshot.value.accountId, ...extra}));
            if (!accepted) throw new Error('连接不可用，请稍后刷新');
            clearTimeout(responseTimer);
            responseTimer = setTimeout(() => { busy.value = false; message.value = '等待响应超时，操作可能仍在处理，请刷新确认'; }, 30000);
        } catch (error) { busy.value = false; message.value = error.message; }
    }
    function receive(json) {
        const result = JSON.parse(json);
        if (result.snapshot) {
            if (result.snapshot.accountId !== snapshot.value.accountId) { confirmAction.value = null; page.value = 0; }
            snapshot.value = result.snapshot;
            page.value = Math.min(page.value, pageCount.value-1);
        }
        if (result.id === pendingId) {
            clearTimeout(responseTimer);
            busy.value = false;
            message.value = result.message || '';
        }
    }
    function ask(action, targetId, label) { confirmAction.value = {action, targetId, label}; }
    function confirm(mode) {
        const action = confirmAction.value;
        confirmAction.value = null;
        send(action.action, {targetId: action.targetId, mode});
    }
    function input(json) {
        if (workspace.value) { workspacePanel.value?.input(json); return; }
        const event = JSON.parse(json);
        const root = document.querySelector('[data-dashboard-root]');
        if (!root) return;
        if (Number.isFinite(event.scroll)) { root.querySelector('[data-dashboard-scroll]')?.scrollBy(0, event.scroll); return; }
        if (!Number.isFinite(event.x) || !Number.isFinite(event.y) || event.x < 0 || event.x > 1 || event.y < 0 || event.y > 1) return;
        pointer.value = {...event, visible: true};
        if (event.click) {
            const rect = root.getBoundingClientRect();
            const element = document.elementFromPoint(rect.left+Math.min(event.x*rect.width,rect.width-.5),rect.top+Math.min(event.y*rect.height,rect.height-.5));
            const button = element?.closest('[data-dashboard-action]');
            if (button && root.contains(button) && !button.disabled) button.click();
        }
    }
    async function refresh() {
        if (!busy.value) send('refresh');
        try { deviceList.value = await AppApiVr.GetVRDevices(); } catch { /* Host may still be starting. */ }
    }
    onMounted(() => { refresh(); refreshTimer = setInterval(refresh, 5000); });
    onBeforeUnmount(() => { clearInterval(refreshTimer); clearTimeout(responseTimer); });
    function workspaceFrame(json) { workspacePanel.value?.frame(json); }
    function workspaceStatus(json) { workspacePanel.value?.status(json); }
    defineExpose({ receive, input, workspaceFrame, workspaceStatus });
</script>

<style scoped>
    .dashboard-panel { position:absolute; top:512px; left:0; width:1024px; height:1024px; box-sizing:border-box; padding:32px; color:var(--vr-text,#fafafa); background:var(--vr-bg,#18181b); border:1px solid var(--vr-border-strong,#3f3f46); border-radius:18px; display:flex; flex-direction:column; gap:20px; font-size:22px; overflow:hidden; }
    header,article,footer { display:flex; align-items:center; justify-content:space-between; gap:16px; }
    h1 { font-size:32px; margin:0; } h2 { font-size:26px; margin:16px 0; } p { color:var(--vr-text-muted,#a1a1aa); margin:6px 0; font-size:20px; }
    nav,.buttons { display:flex; gap:12px; flex-wrap:wrap; } nav button { flex:1; }
    button { min-height:52px; padding:10px 18px; border:1px solid var(--vr-border-strong,#52525b); border-radius:10px; background:rgba(255,255,255,.06); color:inherit; font-size:21px; cursor:pointer; }
    button.active,button:hover { background:rgba(0,184,255,.16); border-color:var(--status-joinme,#00b8ff); } button:disabled { opacity:.4; cursor:default; }
    main { flex:1; overflow:auto; min-height:0; } article { padding:18px 0; border-bottom:1px solid var(--vr-border,#3f3f46); } article>div:first-child { min-width:0; flex:1; } article p { overflow-wrap:anywhere; } article strong { font-size:23px; }
    .settings { display:grid; grid-template-columns:1fr 1fr; gap:16px; } .settings button { display:flex; align-items:center; justify-content:space-between; padding:20px; } .pill { color:var(--vr-text-muted,#a1a1aa); } .pill.on { color:var(--status-joinme,#00b8ff); }
    .message { min-height:30px; color:var(--vr-text-secondary,#d4d4d8); } .empty { padding:60px; text-align:center; color:var(--vr-text-muted,#a1a1aa); } .device { padding:12px; border-bottom:1px solid var(--vr-border,#3f3f46); font-size:18px; } footer { padding:20px 0; } .confirmation { padding:28px; border:1px solid var(--vr-border-strong,#52525b); border-radius:12px; }
    .dashboard-pointer { position:absolute; width:10px; height:10px; background:var(--status-joinme,#00b8ff); border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; z-index:50; }
</style>
