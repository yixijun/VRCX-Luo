import { reactive } from 'vue';
import { toast } from 'vue-sonner';

// Presentation state only. The workspace uses the owning renderer's existing stores.
export const vrWorkspace = reactive({
    active: false,
    home: true,
    library: '',
    error: ''
});

export function setVrWorkspaceActive(active) {
    vrWorkspace.active = active;
    if (active) vrWorkspace.home = true;
    else vrWorkspace.library = '';
    document.body.classList.toggle('vr-workspace-active', active);
}

export function sendVrWorkspaceInput(input) {
    return LINUX
        ? window.electron.sendVrWorkspaceInput(input)
        : AppApi.SendVrWorkspaceInput(JSON.stringify(input));
}

export function showVrWorkspaceKeyboard() {
    const focused = document.activeElement;
    if (
        !focused?.matches(
            'input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, [contenteditable=true]'
        )
    ) {
        toast.info('请先选择要输入文字的输入框');
        return;
    }
    AppApi.ExecuteVrOverlayFunction(
        'dashboardShowKeyboard',
        JSON.stringify({
            password: focused?.getAttribute('type') === 'password',
            multiline: focused?.tagName === 'TEXTAREA'
        })
    );
}

export async function handleVrWorkspaceCommand(request) {
    if (request.type === 'open' || request.type === 'ping') {
        if (request.type === 'ping' && !vrWorkspace.active) return;
        if (request.type === 'open') setVrWorkspaceActive(true);
        const available = LINUX
            ? await window.electron.setVrWorkspaceCapture(true)
            : await AppApi.SetVrWorkspaceCapture(true);
        if (!available) {
            setVrWorkspaceActive(false);
            throw new Error('VR 工作区暂时无法连接，请稍后重试');
        }
    } else if (request.type === 'close') {
        setVrWorkspaceActive(false);
        if (LINUX) await window.electron.setVrWorkspaceCapture(false);
        else await AppApi.SetVrWorkspaceCapture(false);
    } else if (request.type === 'input' && vrWorkspace.active) {
        await sendVrWorkspaceInput(request.input);
    } else if (request.type === 'keyboard' && vrWorkspace.active) {
        showVrWorkspaceKeyboard();
    }
}
