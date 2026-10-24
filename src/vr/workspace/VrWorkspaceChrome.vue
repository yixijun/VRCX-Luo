<template>
    <div class="vr-workspace-chrome">
        <VrFilePicker v-if="vrFilePicker" :key="vrFilePicker.id" />
        <header class="vr-workspace-header">
            <button class="vr-brand" @click="home">
                <i class="ri-apps-2-line" aria-hidden="true" /> <span>VRCX-Luo <small>VR 工作区</small></span>
            </button>
            <button class="vr-back-button" @click="back">
                <i class="ri-arrow-left-line" aria-hidden="true" /> 返回
            </button>
            <div class="vr-workspace-location">
                <strong>{{ currentTitle }}</strong
                ><span>{{ location.lastLocation.name || 'SteamVR' }}</span>
            </div>
            <div class="vr-header-tools">
                <button @mousedown.prevent @click="showKeyboard">
                    <i class="ri-keyboard-line" aria-hidden="true" /> 键盘
                </button>
                <button @mousedown.prevent @click="paste">
                    <i class="ri-clipboard-line" aria-hidden="true" /> 粘贴
                </button>
                <button class="vr-icon-button" @click="closeDialog" aria-label="关闭最上层弹窗" title="关闭最上层弹窗">
                    <i class="ri-close-line" aria-hidden="true" />
                </button>
            </div>
        </header>
        <aside class="vr-workspace-nav" aria-label="VR 功能导航">
            <button :class="{ selected: vrWorkspace.home && !vrWorkspace.library && !selectedSection }" @click="home">
                <i class="ri-home-5-line" /> 功能大厅
            </button>
            <button :class="{ selected: vrWorkspace.library === 'sidebar' }" @click="openLibrary('sidebar')">
                <i class="ri-contacts-line" aria-hidden="true" /> 好友与群组
            </button>
            <span class="vr-nav-caption">浏览</span>
            <div class="vr-nav-sections">
                <button
                    v-for="section in sections"
                    :key="section"
                    :class="{ selected: selectedSection === section && vrWorkspace.home }"
                    @click="showSection(section)">
                    <i :class="workspaceSectionMeta(section).icon" aria-hidden="true" /> {{ section }}
                </button>
            </div>
            <div class="vr-nav-bottom">
                <button @click="directAccessPaste"><i class="ri-link" aria-hidden="true" /> 链接直达</button>
                <button :class="{ selected: vrWorkspace.library === 'manage' }" @click="openLibrary('manage')">
                    <i class="ri-settings-4-line" aria-hidden="true" /> 账户与管理
                </button>
                <button class="vr-profile-button" @click="profile">
                    <span class="vr-profile-mark">{{ (user.currentUser.displayName || '?').slice(0, 1) }}</span
                    ><span
                        ><strong>{{ user.currentUser.displayName || '未登录' }}</strong
                        ><small>我的资料</small></span
                    >
                </button>
                <div class="vr-nav-account"><AccountViewSwitcher /></div>
            </div>
        </aside>
        <VrWorkspaceHome
            v-if="vrWorkspace.home"
            :entries="entries"
            :sections="sections"
            :selected-section="selectedSection"
            :display-name="user.currentUser.displayName"
            :location-name="location.lastLocation.name"
            @navigate="navigate"
            @select-section="showSection"
            @open-library="openLibrary" />
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
    import { buildVrWorkspaceCatalog, workspaceSectionMeta } from './catalog';
    import VrWorkspaceHome from './VrWorkspaceHome.vue';
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
    const currentTitle = computed(() =>
        vrWorkspace.home
            ? selectedSection.value || '功能大厅'
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
    function openLibrary(library) {
        vrWorkspace.library = library;
        vrWorkspace.home = false;
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
