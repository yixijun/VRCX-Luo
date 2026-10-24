<template>
    <WorkspacePanel v-if="workspace" ref="workspacePanel" @close="workspace = false" />
    <section v-else class="dashboard-panel" data-dashboard-root>
        <header>
            <div class="dashboard-brand">
                <span class="dashboard-brand-icon"><i class="ri-apps-2-line" aria-hidden="true" /></span>
                <div>
                    <span class="dashboard-eyebrow">STEAMVR</span>
                    <h1>VRCX-Luo</h1>
                    <p>
                        {{ snapshot.displayName || '请先在桌面登录' }} · {{ snapshot.location || 'SteamVR 控制面板' }}
                    </p>
                </div>
            </div>
            <button data-dashboard-action :disabled="busy" @click="send('refresh')">刷新</button>
        </header>
        <button class="dashboard-workspace-entry" data-dashboard-action @click="workspace = true">
            <span class="dashboard-entry-icon"><i class="ri-layout-grid-line" aria-hidden="true" /></span
            ><span><strong>VR 工作区 · 全部功能</strong><small>好友、世界、收藏、记录与设置</small></span
            ><i class="ri-arrow-right-line" aria-hidden="true" />
        </button>
        <nav>
            <button
                v-for="item in tabs"
                :key="item.id"
                data-dashboard-action
                :class="{ active: tab === item.id }"
                @click="
                    tab = item.id;
                    page = 0;
                ">
                {{ item.label }}
            </button>
        </nav>
        <div class="message" role="status">{{ message || (busy ? '正在处理…' : '使用手柄指向按钮，按扳机操作') }}</div>

        <div v-if="confirmAction" class="confirmation">
            <h2>{{ confirmAction.label }}</h2>
            <p v-if="['join', 'accept'].includes(confirmAction.action)">请选择加入方式</p>
            <div class="buttons">
                <template v-if="['join', 'accept'].includes(confirmAction.action)">
                    <button data-dashboard-action :disabled="busy || !snapshot.gameRunning" @click="confirm('current')">
                        在运行中的 VRChat 打开
                    </button>
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
                    <button
                        v-for="item in switches"
                        :key="item.id"
                        data-dashboard-action
                        :aria-pressed="!!snapshot.settings?.[item.id]"
                        :disabled="busy || !snapshot.accountId"
                        @click="send(item.id, { value: !snapshot.settings?.[item.id] })">
                        <i :class="item.icon" class="setting-icon" aria-hidden="true" /><span class="setting-label"
                            >{{ item.label
                            }}<small>{{ snapshot.settings?.[item.id] ? '已开启' : '已关闭' }}</small></span
                        ><span class="visual-switch" :class="{ on: snapshot.settings?.[item.id] }" aria-hidden="true"
                            ><span
                        /></span>
                    </button>
                </div>
                <h2>设备状态</h2>
                <div v-if="!deviceList.length" class="empty">暂无设备数据</div>
                <div class="device-grid">
                    <div v-for="(device, index) in deviceList" :key="index" class="device">
                        <i
                            :class="device[0] === 'headset' ? 'ri-vip-diamond-line' : 'ri-gamepad-line'"
                            aria-hidden="true" /><span>{{ deviceLabel(device) }}</span>
                    </div>
                </div>
            </template>
            <template v-else-if="tab === 'friends'">
                <div class="buttons">
                    <button
                        data-dashboard-action
                        @click="
                            onlyOnline = !onlyOnline;
                            page = 0;
                        ">
                        {{ onlyOnline ? '仅在线' : '全部好友' }}</button
                    ><button
                        data-dashboard-action
                        @click="
                            onlyFavorite = !onlyFavorite;
                            page = 0;
                        ">
                        {{ onlyFavorite ? '仅星标' : '所有分组' }}
                    </button>
                </div>
                <div v-if="!filteredFriends.length" class="empty">没有符合条件的好友</div>
                <article v-for="friend in pageFriends" :key="friend.id">
                    <div>
                        <strong>{{ friend.favorite ? '★ ' : '' }}{{ friend.name }}</strong>
                        <p>{{ friend.online ? '在线' : '离线' }} {{ friend.world }}</p>
                    </div>
                    <div class="buttons">
                        <button
                            data-dashboard-action
                            :disabled="busy || !friend.canJoin"
                            @click="ask('join', friend.id, `加入 ${friend.name} 的房间`)">
                            加入
                        </button>
                        <button
                            data-dashboard-action
                            :disabled="busy || !friend.online"
                            @click="ask('invite', friend.id, `邀请 ${friend.name} 到当前房间`)">
                            邀请
                        </button>
                        <button
                            data-dashboard-action
                            :disabled="busy || !friend.online"
                            @click="ask('requestInvite', friend.id, `向 ${friend.name} 请求邀请`)">
                            请求邀请
                        </button>
                    </div>
                </article>
                <footer>
                    <button data-dashboard-action :disabled="page === 0" @click="page--">上一页</button
                    ><span>{{ page + 1 }} / {{ pageCount }} · {{ filteredFriends.length }} 人</span
                    ><button data-dashboard-action :disabled="page + 1 >= pageCount" @click="page++">下一页</button>
                </footer>
            </template>
            <template v-else>
                <div v-if="!snapshot.invites?.length" class="empty">暂无待处理邀请</div>
                <article v-for="invite in snapshot.invites" :key="invite.id">
                    <div>
                        <strong>{{ invite.name }}</strong>
                        <p>{{ invite.world }}</p>
                        <p>{{ invite.message }}</p>
                    </div>
                    <div class="buttons">
                        <button
                            data-dashboard-action
                            :disabled="busy"
                            @click="ask('accept', invite.id, `接受 ${invite.name} 的邀请`)">
                            接受并加入</button
                        ><button
                            data-dashboard-action
                            :disabled="busy"
                            @click="ask('decline', invite.id, `拒绝 ${invite.name} 的邀请`)">
                            拒绝
                        </button>
                    </div>
                </article>
            </template>
        </main>
        <span
            v-if="pointer.visible"
            class="dashboard-pointer"
            :style="{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }"></span>
    </section>
</template>

<script setup>
    import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
    import WorkspacePanel from './WorkspacePanel.vue';
    const workspace = ref(false);
    const workspacePanel = ref(null);
    const snapshot = ref({ accountId: '', friends: [], invites: [], settings: {} });
    const tab = ref('controls');
    const tabs = [
        { id: 'controls', label: '控制与设备' },
        { id: 'friends', label: '好友' },
        { id: 'invites', label: '邀请' }
    ];
    const switches = [
        { id: 'wrist', label: '手背 HUD', icon: 'ri-hand-heart-line' },
        { id: 'hud', label: 'VR 通知', icon: 'ri-notification-3-line' },
        { id: 'silent', label: '通知静音', icon: 'ri-volume-mute-line' },
        { id: 'sleep', label: '睡眠模式', icon: 'ri-moon-line' }
    ];
    const page = ref(0);
    const onlyOnline = ref(true);
    const onlyFavorite = ref(false);
    const busy = ref(false);
    const message = ref('');
    const deviceList = ref([]);
    const confirmAction = ref(null);
    const pointer = ref({ x: 0.5, y: 0.5, visible: false });
    const filteredFriends = computed(() =>
        snapshot.value.friends.filter((f) => (!onlyOnline.value || f.online) && (!onlyFavorite.value || f.favorite))
    );
    const pageCount = computed(() => Math.max(1, Math.ceil(filteredFriends.value.length / 7)));
    const pageFriends = computed(() => filteredFriends.value.slice(page.value * 7, page.value * 7 + 7));
    let pendingId = '';
    let refreshTimer;
    let responseTimer;
    function deviceLabel(device) {
        const labels = {
            headset: '头显',
            leftController: '左手柄',
            rightController: '右手柄',
            controller: '手柄',
            tracker: '追踪器',
            base: '基站'
        };
        const battery = Number(device[3]?.replace(',', '.'));
        return `${labels[device[0]] || device[0]} · ${device[1] === 'connected' ? '已连接' : '已断开'} · ${Number.isFinite(battery) ? `${Math.round(battery)}%` : '—'}${device[2] === 'charging' ? ' 充电中' : ''} · ${device[4] === 'Running_OK' ? '追踪正常' : '追踪未就绪'}`;
    }
    async function send(action, extra = {}) {
        if (busy.value) return;
        busy.value = true;
        message.value = '';
        pendingId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try {
            const accepted = await AppApiVr.SubmitDashboardAction(
                JSON.stringify({ id: pendingId, action, accountId: snapshot.value.accountId, ...extra })
            );
            if (!accepted) throw new Error('连接不可用，请稍后刷新');
            clearTimeout(responseTimer);
            responseTimer = setTimeout(() => {
                busy.value = false;
                message.value = '等待响应超时，操作可能仍在处理，请刷新确认';
            }, 30000);
        } catch (error) {
            busy.value = false;
            message.value = error.message;
        }
    }
    function receive(json) {
        const result = JSON.parse(json);
        if (result.snapshot) {
            if (result.snapshot.accountId !== snapshot.value.accountId) {
                confirmAction.value = null;
                page.value = 0;
            }
            snapshot.value = result.snapshot;
            page.value = Math.min(page.value, pageCount.value - 1);
        }
        if (result.id === pendingId) {
            clearTimeout(responseTimer);
            busy.value = false;
            message.value = result.message || '';
        }
    }
    function ask(action, targetId, label) {
        confirmAction.value = { action, targetId, label };
    }
    function confirm(mode) {
        const action = confirmAction.value;
        confirmAction.value = null;
        send(action.action, { targetId: action.targetId, mode });
    }
    function input(json) {
        if (workspace.value) {
            workspacePanel.value?.input(json);
            return;
        }
        const event = JSON.parse(json);
        const root = document.querySelector('[data-dashboard-root]');
        if (!root) return;
        if (Number.isFinite(event.scroll)) {
            root.querySelector('[data-dashboard-scroll]')?.scrollBy(0, event.scroll);
            return;
        }
        if (
            !Number.isFinite(event.x) ||
            !Number.isFinite(event.y) ||
            event.x < 0 ||
            event.x > 1 ||
            event.y < 0 ||
            event.y > 1
        )
            return;
        pointer.value = { ...event, visible: true };
        if (event.click) {
            const rect = root.getBoundingClientRect();
            const element = document.elementFromPoint(
                rect.left + Math.min(event.x * rect.width, rect.width - 0.5),
                rect.top + Math.min(event.y * rect.height, rect.height - 0.5)
            );
            const button = element?.closest('[data-dashboard-action]');
            if (button && root.contains(button) && !button.disabled) button.click();
        }
    }
    async function refresh() {
        if (!busy.value) send('refresh');
        try {
            deviceList.value = await AppApiVr.GetVRDevices();
        } catch {
            /* Host may still be starting. */
        }
    }
    onMounted(() => {
        refresh();
        refreshTimer = setInterval(refresh, 5000);
    });
    onBeforeUnmount(() => {
        clearInterval(refreshTimer);
        clearTimeout(responseTimer);
    });
    function workspaceFrame(json) {
        workspacePanel.value?.frame(json);
    }
    function workspaceStatus(json) {
        workspacePanel.value?.status(json);
    }
    defineExpose({ receive, input, workspaceFrame, workspaceStatus });
</script>

<style scoped>
    .dashboard-panel {
        position: absolute;
        top: 512px;
        left: 0;
        width: 1024px;
        height: 1024px;
        box-sizing: border-box;
        padding: 32px;
        color: var(--vr-text, #fafafa);
        background: var(--vr-bg, #18181b);
        border: 1px solid var(--vr-border-strong, #3f3f46);
        border-radius: 18px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        font-size: 22px;
        overflow: hidden;
    }
    header,
    article,
    footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }
    h1 {
        font-size: 32px;
        margin: 0;
    }
    h2 {
        font-size: 26px;
        margin: 16px 0;
    }
    p {
        color: var(--vr-text-muted, #a1a1aa);
        margin: 6px 0;
        font-size: 20px;
    }
    nav,
    .buttons {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }
    nav button {
        flex: 1;
    }
    button {
        min-height: 52px;
        padding: 10px 18px;
        border: 1px solid var(--vr-border-strong, #52525b);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        font-size: 21px;
        cursor: pointer;
    }
    button.active,
    button:hover {
        background: rgba(0, 184, 255, 0.16);
        border-color: var(--status-joinme, #00b8ff);
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    main {
        flex: 1;
        overflow: auto;
        min-height: 0;
    }
    article {
        padding: 18px 0;
        border-bottom: 1px solid var(--vr-border, #3f3f46);
    }
    article > div:first-child {
        min-width: 0;
        flex: 1;
    }
    article p {
        overflow-wrap: anywhere;
    }
    article strong {
        font-size: 23px;
    }
    .settings {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }
    .settings button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
    }
    .pill {
        color: var(--vr-text-muted, #a1a1aa);
    }
    .pill.on {
        color: var(--status-joinme, #00b8ff);
    }
    .message {
        min-height: 30px;
        color: var(--vr-text-secondary, #d4d4d8);
    }
    .empty {
        padding: 60px;
        text-align: center;
        color: var(--vr-text-muted, #a1a1aa);
    }
    .device {
        padding: 12px;
        border-bottom: 1px solid var(--vr-border, #3f3f46);
        font-size: 18px;
    }
    footer {
        padding: 20px 0;
    }
    .confirmation {
        padding: 28px;
        border: 1px solid var(--vr-border-strong, #52525b);
        border-radius: 12px;
    }
    .dashboard-pointer {
        position: absolute;
        width: 10px;
        height: 10px;
        background: var(--status-joinme, #00b8ff);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 50;
    }
    .dashboard-panel {
        padding: 28px;
        gap: 18px;
        border-radius: 22px;
    }
    .dashboard-brand {
        display: flex;
        align-items: center;
        gap: 18px;
        min-width: 0;
    }
    .dashboard-brand > div {
        min-width: 0;
    }
    .dashboard-brand-icon {
        width: 60px;
        height: 60px;
        display: grid;
        place-items: center;
        border: 1px solid var(--vr-border-strong, #3f3f46);
        border-radius: 18px;
        color: var(--status-joinme, #00b8ff);
        background: var(--vr-bg-surface, #27272a);
        font-size: 34px;
        flex-shrink: 0;
    }
    .dashboard-eyebrow {
        font-size: 13px;
        letter-spacing: 0.14em;
        color: var(--vr-text-muted, #a1a1aa);
    }
    .dashboard-brand h1 {
        font-size: 30px;
        margin-top: 2px;
    }
    .dashboard-brand p {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 700px;
        font-size: 18px;
    }
    .dashboard-workspace-entry {
        display: flex;
        gap: 18px;
        align-items: center;
        width: 100%;
        padding: 22px;
        min-height: 108px;
        background: color-mix(in oklab, var(--status-joinme, #00b8ff) 10%, var(--vr-bg-surface, #27272a));
        border-color: color-mix(in oklab, var(--status-joinme, #00b8ff) 40%, var(--vr-border-strong, #3f3f46));
        border-radius: 18px;
        text-align: left;
    }
    .dashboard-workspace-entry > span:nth-child(2) {
        flex: 1;
    }
    .dashboard-workspace-entry strong {
        font-size: 26px;
        font-weight: 600;
    }
    .dashboard-workspace-entry small {
        display: block;
        color: var(--vr-text-muted, #a1a1aa);
        font-size: 18px;
        margin-top: 6px;
    }
    .dashboard-entry-icon {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: var(--vr-bg, #18181b);
        color: var(--status-joinme, #00b8ff);
        font-size: 30px;
    }
    .dashboard-workspace-entry > i {
        color: var(--status-joinme, #00b8ff);
        font-size: 28px;
    }
    nav {
        background: var(--vr-bg-surface, #27272a);
        padding: 6px;
        border-radius: 14px;
        gap: 6px;
    }
    nav button {
        border-color: transparent;
        background: transparent;
        border-radius: 10px;
        min-height: 54px;
    }
    nav button.active {
        background: var(--vr-bg, #18181b);
        border-color: var(--vr-border-strong, #52525b);
        color: var(--status-joinme, #00b8ff);
    }
    .settings {
        gap: 14px;
    }
    .settings button {
        min-height: 100px;
        border-radius: 16px;
        justify-content: flex-start;
        gap: 18px;
    }
    .setting-icon {
        font-size: 28px;
        color: var(--vr-text-secondary, #d4d4d8);
    }
    .setting-label {
        flex: 1;
        text-align: left;
        font-size: 23px;
    }
    .setting-label small {
        display: block;
        font-size: 16px;
        color: var(--vr-text-muted, #a1a1aa);
        margin-top: 7px;
    }
    .visual-switch {
        display: flex;
        align-items: center;
        padding: 4px;
        width: 56px;
        height: 32px;
        border-radius: 20px;
        background: var(--vr-border-strong, #52525b);
        box-sizing: border-box;
        flex-shrink: 0;
    }
    .visual-switch > span {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #fff;
    }
    .visual-switch.on {
        background: var(--status-joinme, #00b8ff);
        justify-content: flex-end;
    }
    .device-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    .device {
        display: flex;
        align-items: center;
        gap: 16px;
        border: 1px solid var(--vr-border, #3f3f46);
        border-radius: 14px;
        padding: 18px;
        font-size: 18px;
        line-height: 1.5;
    }
    .device > i {
        font-size: 28px;
        color: var(--vr-text-secondary, #d4d4d8);
        flex-shrink: 0;
    }
    .message {
        font-size: 17px;
        min-height: 24px;
    }
    article {
        padding: 20px;
        margin-bottom: 12px;
        border: 1px solid var(--vr-border, #3f3f46);
        border-radius: 16px;
        background: var(--vr-bg-surface, #27272a);
    }
    .confirmation {
        padding: 28px;
        border-radius: 18px;
        background: var(--vr-bg-surface, #27272a);
    }
    button:focus-visible {
        outline: 3px solid var(--status-joinme, #00b8ff);
        outline-offset: 2px;
    }
</style>
