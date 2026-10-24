<template>
    <main class="vr-workspace-home">
        <template v-if="!selectedSection">
            <section class="vr-home-hero">
                <div class="vr-hero-copy">
                    <span class="vr-eyebrow">VRCX-Luo · SteamVR</span>
                    <h1>你的 VR 工作台</h1>
                    <p>你好，{{ displayName || '欢迎回来' }}</p>
                    <div class="vr-room-summary">
                        <i class="ri-map-pin-2-line" aria-hidden="true" /><span>{{
                            locationName || '当前没有可见的房间位置'
                        }}</span>
                    </div>
                </div>
                <div class="vr-hero-actions">
                    <button class="vr-primary-action" @click="$emit('openLibrary', 'sidebar')">
                        <i class="ri-contacts-line" aria-hidden="true" /> 好友与群组
                        <i class="ri-arrow-right-line" aria-hidden="true" />
                    </button>
                    <button v-if="notificationEntry" @click="$emit('navigate', notificationEntry)">
                        <i class="ri-notification-3-line" aria-hidden="true" /> 查看通知
                    </button>
                </div>
            </section>
            <section v-if="quickEntries.length" class="vr-home-section">
                <div class="vr-section-heading">
                    <h2>常用入口</h2>
                    <span>一步直达</span>
                </div>
                <div class="vr-quick-grid">
                    <button
                        v-for="entry in quickEntries"
                        :key="entry.id"
                        class="vr-quick-card"
                        @click="$emit('navigate', entry)">
                        <i :class="entry.icon" class="vr-tile-icon" aria-hidden="true" /><span>{{ entry.label }}</span
                        ><i class="ri-arrow-right-up-line vr-card-arrow" aria-hidden="true" />
                    </button>
                </div>
            </section>
            <section class="vr-home-section">
                <div class="vr-section-heading">
                    <h2>全部功能</h2>
                    <span>按类别浏览</span>
                </div>
                <div class="vr-category-grid">
                    <button
                        v-for="section in sections"
                        :key="section"
                        class="vr-category-card"
                        @click="$emit('selectSection', section)">
                        <i :class="sectionMeta(section).icon" class="vr-category-icon" aria-hidden="true" />
                        <strong>{{ section }}</strong
                        ><span>{{ entries.filter((entry) => entry.section === section).length }} 项功能</span>
                        <i class="ri-arrow-right-line vr-card-arrow" aria-hidden="true" />
                    </button>
                </div>
            </section>
        </template>
        <template v-else>
            <div class="vr-page-intro">
                <span class="vr-eyebrow">功能分类</span>
                <h1>{{ selectedSection }}</h1>
                <p>{{ sectionMeta(selectedSection).description }}</p>
            </div>
            <div class="vr-module-grid">
                <button
                    v-for="entry in visibleEntries"
                    :key="entry.id"
                    class="vr-module-card"
                    @click="$emit('navigate', entry)">
                    <i :class="entry.icon" class="vr-tile-icon" aria-hidden="true" /><span>{{ entry.label }}</span
                    ><i class="ri-arrow-right-up-line vr-card-arrow" aria-hidden="true" />
                </button>
            </div>
        </template>
        <footer class="vr-workspace-hints">
            <span><i class="ri-cursor-line" aria-hidden="true" /> 扳机选择</span
            ><span><i class="ri-scroll-to-bottom-line" aria-hidden="true" /> 摇杆滚动</span
            ><span>顶部工具栏可打开键盘与右键</span>
        </footer>
    </main>
</template>

<script setup>
    import { computed } from 'vue';
    import { workspaceSectionMeta as sectionMeta } from './catalog';
    const props = defineProps({
        entries: { type: Array, default: () => [] },
        sections: { type: Array, default: () => [] },
        selectedSection: { type: String, default: '' },
        displayName: { type: String, default: '' },
        locationName: { type: String, default: '' }
    });
    defineEmits(['navigate', 'selectSection', 'openLibrary']);
    const quickIds = ['friends-locations', 'search', 'favorite-worlds', 'player-list', 'feed', 'settings'];
    const quickEntries = computed(() =>
        quickIds.map((id) => props.entries.find((entry) => entry.id === id)).filter(Boolean)
    );
    const notificationEntry = computed(() => props.entries.find((entry) => entry.id === 'notification'));
    const visibleEntries = computed(() => props.entries.filter((entry) => entry.section === props.selectedSection));
</script>
