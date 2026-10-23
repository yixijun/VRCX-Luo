<template>
    <div class="vr-workspace-chrome">
        <VrFilePicker v-if="vrFilePicker" :key="vrFilePicker.id" />
        <header class="vr-workspace-header">
            <button class="vr-brand" @click="home">
                <i class="ri-apps-2-line" /> <span>VRCX-Luo <small>VR 工作区</small></span>
            </button>
            <div class="vr-workspace-location">
                <strong>{{ currentTitle }}</strong
                ><span
                    >{{ user.currentUser.displayName || '请登录账户' }} ·
                    {{ location.lastLocation.name || 'SteamVR' }}</span
                >
            </div>
            <button @click="closeDialog" title="关闭最上层弹窗"><i class="ri-close-line" /> 关闭弹窗</button>
            <button @mousedown.prevent @click="showKeyboard"><i class="ri-keyboard-line" /> 键盘</button>
            <button @mousedown.prevent @click="paste">粘贴</button>
        </header>
        <aside class="vr-workspace-nav" aria-label="VR 功能导航">
            <button :class="{ selected: vrWorkspace.home && !vrWorkspace.library }" @click="home">
                <i class="ri-home-5-line" /> 功能大厅
            </button>
            <button @click="back"><i class="ri-arrow-left-line" /> 返回</button>
            <div class="vr-nav-rule" />
            <button
                v-for="section in sections"
                :key="section"
                :class="{ selected: selectedSection === section && vrWorkspace.home }"
                @click="showSection(section)">
                {{ section }}
            </button>
            <div class="vr-nav-rule" />
            <button
                :class="{ selected: !!vrWorkspace.library }"
                @click="
                    vrWorkspace.library = 'sidebar';
                    vrWorkspace.home = false;
                ">
                <i class="ri-contacts-line" /> 好友与群组
            </button>
            <button
                @click="
                    vrWorkspace.library = 'manage';
                    vrWorkspace.home = false;
                ">
                <i class="ri-user-settings-line" /> 账户与管理
            </button>
            <button @click="directAccessPaste"><i class="ri-link" /> 链接或 ID 直达</button>
            <button @click="profile"><i class="ri-account-circle-line" /> 我的资料</button>
            <div class="vr-nav-account"><AccountViewSwitcher /></div>
        </aside>
        <main v-if="vrWorkspace.home" class="vr-workspace-home">
            <div class="vr-home-intro">
                <span>全部功能</span>
                <h1>{{ selectedSection || '选择你要使用的功能' }}</h1>
                <p>扳机选择 · 摇杆滚动 · 右键菜单可用</p>
            </div>
            <div class="vr-module-grid">
                <button v-for="entry in visibleEntries" :key="entry.id" class="vr-module-card" @click="navigate(entry)">
                    <i :class="entry.icon" /><span>{{ entry.label }}</span
                    ><small>{{ entry.section }}</small
                    ><i class="ri-arrow-right-up-line vr-card-arrow" />
                </button>
            </div>
        </main>
        <section v-if="vrWorkspace.library === 'sidebar'" class="vr-workspace-library"><Sidebar /></section>
        <section v-if="vrWorkspace.library === 'manage'" class="vr-workspace-library">
            <SidebarProvider :open="true" :width="840" class="relative min-h-0 h-full"><NavMenu /></SidebarProvider>
        </section>
    </div>
</template>

<script setup>
    import { computed, onBeforeUnmount, ref } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { useUserStore } from '../../stores/user';
    import { useLocationStore } from '../../stores/location';
    import { useDashboardStore } from '../../stores/dashboard';
    import { useSearchStore } from '../../stores/search';
    import { showUserDialog } from '../../coordinators/userCoordinator';
    import { vrWorkspace, sendVrWorkspaceInput } from '../../services/vrWorkspace';
    import { showVrWorkspaceKeyboard } from '../../services/vrWorkspace';
    import AccountViewSwitcher from '../../components/AccountViewSwitcher.vue';
    import Sidebar from '../../views/Sidebar/Sidebar.vue';
    import NavMenu from '../../components/nav-menu/NavMenu.vue';
    import { SidebarProvider } from '../../components/ui/sidebar';
    import { buildVrWorkspaceCatalog } from './catalog';
    import VrFilePicker from './VrFilePicker.vue';
    import { vrFilePicker } from '../../services/vrWorkspaceFilePicker';

    const router = useRouter();
    const route = useRoute();
    const user = useUserStore();
    const location = useLocationStore();
    const dashboards = useDashboardStore();
    const { directAccessPaste } = useSearchStore();
    const selectedSection = ref('');
    const entries = computed(() => buildVrWorkspaceCatalog(router.getRoutes(), dashboards.dashboards));
    const sections = computed(() => [...new Set(entries.value.map((entry) => entry.section))]);
    const visibleEntries = computed(() =>
        selectedSection.value ? entries.value.filter((entry) => entry.section === selectedSection.value) : entries.value
    );
    const currentTitle = computed(() =>
        vrWorkspace.home
            ? '功能大厅'
            : vrWorkspace.library
              ? vrWorkspace.library === 'manage'
                  ? '账户与管理'
                  : '好友与群组'
              : entries.value.find((entry) => entry.to.name === route.name)?.label || 'VRCX-Luo'
    );
    const history = [];
    const removeAfterEach = router.afterEach((to, from, failure) => {
        if (!failure && to.fullPath !== from.fullPath) {
            history.push(from.fullPath);
            vrWorkspace.library = '';
            vrWorkspace.home = false;
        }
    });
    onBeforeUnmount(removeAfterEach);
    function home() {
        vrWorkspace.home = true;
        vrWorkspace.library = '';
        selectedSection.value = '';
    }
    function showSection(section) {
        home();
        selectedSection.value = section;
    }
    async function navigate(entry) {
        await router.push(entry.to);
        vrWorkspace.library = '';
        vrWorkspace.home = false;
    }
    async function back() {
        if (vrWorkspace.library || !history.length) {
            home();
            return;
        }
        const previous = history.pop();
        await router.replace(previous);
        history.pop(); // replace's afterEach records the page we just left.
        vrWorkspace.home = false;
    }
    function closeDialog() {
        sendVrWorkspaceInput({ type: 'key', key: 'Escape' });
    }
    function showKeyboard() {
        showVrWorkspaceKeyboard();
    }
    async function paste() {
        const text = await AppApi.GetClipboard();
        if (text && text.length <= 1024) await sendVrWorkspaceInput({ type: 'text', text });
    }
    function profile() {
        if (user.currentUser.id) showUserDialog(user.currentUser.id);
    }
</script>
