<template>
    <section ref="root" class="workspace-panel">
        <header>
            <div>
                <strong>VRCX-Luo · VR 工作区</strong
                ><span>{{ error || (image ? '扳机选择 · 摇杆滚动 · 按住扳机拖动' : '正在载入 VR 工作区…') }}</span>
            </div>
            <button data-workspace-button @click="command('keyboard')">键盘</button
            ><button data-workspace-button @click="key('SelectAll')">全选</button
            ><button data-workspace-button @click="key('Backspace')">退格</button
            ><button data-workspace-button @click="key('Enter')">回车</button
            ><button data-workspace-button @click="rightClick">右键</button
            ><button data-workspace-button @click="key('Escape')">关闭弹窗</button
            ><button data-workspace-button @click="$emit('close')">快捷控制</button>
        </header>
        <div ref="imageArea" class="workspace-image">
            <img v-if="image" :src="image" alt="VRCX-Luo VR 工作区" draggable="false" />
            <div v-else class="workspace-loading">
                <i class="ri-apps-2-line" />
                <h2>VR 工作区</h2>
                <p>{{ error || '正在连接当前账户与功能页面' }}</p>
                <button v-if="error" data-workspace-button @click="command('open')">重试</button>
            </div>
        </div>
        <span
            v-if="pointer.visible"
            class="workspace-pointer"
            :style="{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }" />
    </section>
</template>

<script setup>
    import { onBeforeUnmount, onMounted, ref } from 'vue';
    import { mapWorkspacePoint } from '../workspace/input';
    defineEmits(['close']);
    const root = ref(null);
    const imageArea = ref(null);
    const image = ref('');
    const error = ref('');
    const pointer = ref({ x: 0.5, y: 0.5, visible: false });
    let heartbeat, timeout;
    let pressed = false;
    let last = { x: 0.5, y: 0.5 };
    let lastMove = 0;
    let pressedButton = 'left';
    let viewport = { width: 1280, height: 1024 };
    async function command(type, input) {
        try {
            const ok = await AppApiVr.SubmitDashboardAction(
                JSON.stringify({
                    id: `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    action: 'workspace',
                    type,
                    input
                })
            );
            if (!ok) error.value = '连接已断开，请重试';
        } catch {
            error.value = '连接已断开，请重试';
        }
    }
    function key(key) {
        command('input', { type: 'key', key });
    }
    function rightClick() {
        command('input', { type: 'down', ...last, button: 'right', pressed: true });
        command('input', { type: 'up', ...last, button: 'right' });
    }
    function frame(json) {
        const data = JSON.parse(json);
        if (!data.image?.startsWith('data:image/jpeg;base64,')) return;
        image.value = data.image;
        if (data.width > 0 && data.height > 0) viewport = { width: data.width, height: data.height };
        error.value = '';
        clearTimeout(timeout);
    }
    function status(json) {
        const result = JSON.parse(json);
        error.value = result.error || '';
        if (result.closed) image.value = '';
    }
    function input(json) {
        const event = JSON.parse(json);
        if (!root.value) return;
        if (Number.isFinite(event.scroll)) {
            command('input', {
                type: 'scroll',
                ...last,
                deltaY: Math.max(-1200, Math.min(1200, event.scroll)),
                deltaX: Math.max(-1200, Math.min(1200, event.scrollX || 0))
            });
            return;
        }
        pointer.value = { ...event, visible: true };
        const rect = root.value.getBoundingClientRect();
        const mapped = mapWorkspacePoint(
            rect,
            imageArea.value.getBoundingClientRect(),
            event.x,
            event.y,
            viewport.width,
            viewport.height
        );
        if (!mapped) {
            if (event.phase === 'up' && pressed) {
                command('input', { type: 'up', ...last, button: pressedButton });
                pressed = false;
            }
            if (event.click) {
                const target = document
                    .elementFromPoint(rect.left + event.x * rect.width, rect.top + event.y * rect.height)
                    ?.closest('[data-workspace-button]');
                if (target && root.value.contains(target) && !target.disabled) target.click();
            }
            return;
        }
        if (!image.value || error.value) return;
        last = mapped;
        const button = event.button || 'left';
        if (event.phase === 'down') {
            pressed = true;
            pressedButton = button;
            command('input', { type: 'down', ...mapped, button, pressed: true });
        } else if (event.phase === 'up') {
            if (pressed) command('input', { type: 'up', ...mapped, button: pressedButton });
            pressed = false;
        } else if (event.click) {
            command('input', { type: 'down', ...mapped, button, pressed: true });
            command('input', { type: 'up', ...mapped, button });
        } else if (Date.now() - lastMove >= 30) {
            lastMove = Date.now();
            command('input', { type: 'move', ...mapped, pressed, button: pressed ? pressedButton : button });
        }
    }
    onMounted(() => {
        command('open');
        heartbeat = setInterval(() => command('ping'), 3000);
        timeout = setTimeout(() => {
            if (!image.value) error.value = '工作区未响应，请重试';
        }, 12000);
    });
    onBeforeUnmount(() => {
        clearInterval(heartbeat);
        clearTimeout(timeout);
        if (pressed) command('input', { type: 'up', ...last, button: pressedButton });
        command('close');
    });
    defineExpose({ frame, status, input });
</script>

<style scoped>
    .workspace-panel {
        position: absolute;
        left: 0;
        top: 512px;
        width: 1024px;
        height: 1024px;
        background: var(--vr-bg);
        color: var(--vr-text);
        overflow: hidden;
        border-radius: 18px;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--vr-border-strong);
        box-sizing: border-box;
    }
    header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 18px 20px;
        min-height: 86px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--vr-border-strong);
    }
    header > div {
        flex: 1;
        min-width: 0;
    }
    strong {
        font-size: 22px;
        display: block;
    }
    header span {
        font-size: 15px;
        color: var(--vr-text-secondary);
        display: block;
        margin-top: 6px;
    }
    button {
        min-height: 50px;
        border: 1px solid var(--vr-border-strong);
        border-radius: 10px;
        background: var(--vr-bg-surface);
        color: var(--vr-text);
        font-size: 18px;
        padding: 10px 14px;
        cursor: pointer;
    }
    button:hover {
        border-color: var(--status-joinme);
    }
    button:active {
        transform: scale(0.98);
    }
    .workspace-image {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
    }
    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        user-select: none;
        pointer-events: none;
    }
    .workspace-loading {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
    }
    .workspace-loading > i {
        font-size: 56px;
        color: var(--status-joinme);
    }
    h2 {
        font-size: 30px;
    }
    p {
        font-size: 20px;
        color: var(--vr-text-secondary);
    }
    .workspace-pointer {
        position: absolute;
        width: 10px;
        height: 10px;
        background: var(--status-joinme);
        border: 2px solid white;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 100;
    }
</style>
