<template>
    <div class="x-container flex flex-col overflow-hidden!">
        <div class="flex shrink-0 items-center gap-3 p-1.5">
            <span class="text-lg font-semibold text-foreground">{{ t('view.settings.header') }}</span>
            <div class="relative min-w-0 flex-1 max-w-xl">
                <label for="settings-search" class="sr-only">{{ t('view.settings.search.label') }}</label>
                <Input
                    id="settings-search"
                    v-model="searchQuery"
                    type="search"
                    :placeholder="t('view.settings.search.placeholder')"
                    autocomplete="off"
                    @keydown.down.prevent="moveSelection(1)"
                    @keydown.up.prevent="moveSelection(-1)"
                    @keydown.enter.prevent="selectSelectedResult"
                    @keydown.esc="clearSearch" />
                <div
                    v-if="searchQuery.trim()"
                    class="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                    <button
                        v-for="(result, index) in searchResults"
                        :key="result.id"
                        type="button"
                        class="flex w-full flex-col items-start rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                        :class="{ 'bg-accent text-accent-foreground': index === selectedResultIndex }"
                        @mouseenter="selectedResultIndex = index"
                        @click="openSearchResult(result)">
                        <span class="font-medium">{{ result.label }}</span>
                        <span class="text-xs text-muted-foreground">{{ result.group }}</span>
                    </button>
                    <div v-if="!searchResults.length" class="px-3 py-3 text-sm text-muted-foreground">
                        {{ t('view.settings.search.no_results') }}
                    </div>
                </div>
            </div>
        </div>
        <TabsUnderline v-model="activeTab" default-value="system" :items="settingsTabs" :unmount-on-hide="false" fill>
            <template #system>
                <SystemTab />
            </template>
            <template #interface>
                <InterfaceTab />
            </template>
            <template #social>
                <SocialTab />
            </template>
            <template #notifications>
                <NotificationsTab />
            </template>
            <template #vr>
                <VrTab />
            </template>
            <template #media>
                <MediaTab />
            </template>
            <template #integrations>
                <IntegrationsTab />
            </template>
            <template #advanced>
                <AdvancedTab />
            </template>
        </TabsUnderline>
    </div>
</template>

<script setup>
    import { computed, nextTick, onBeforeMount, onMounted, ref, watch } from 'vue';
    import { useRoute, useRouter } from 'vue-router';
    import { TabsUnderline } from '@/components/ui/tabs';
    import { Input } from '@/components/ui/input';
    import { useI18n } from 'vue-i18n';

    import AdvancedTab from './components/Tabs/AdvancedTab.vue';
    import InterfaceTab from './components/Tabs/InterfaceTab.vue';
    import IntegrationsTab from './components/Tabs/IntegrationsTab.vue';
    import MediaTab from './components/Tabs/MediaTab.vue';
    import NotificationsTab from './components/Tabs/NotificationsTab.vue';
    import SocialTab from './components/Tabs/SocialTab.vue';
    import SystemTab from './components/Tabs/SystemTab.vue';
    import VrTab from './components/Tabs/VrTab.vue';
    import { searchSettingsCatalog, settingsSearchCatalog } from './settingsSearchCatalog';

    const { t } = useI18n();
    const route = useRoute();
    const router = useRouter();
    const searchQuery = ref('');
    const selectedResultIndex = ref(0);
    const activeTab = ref('system');
    const environment = {
        isLinux: globalThis.LINUX === true,
        isMacOS: typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
    };
    const settingsTabs = computed(() => [
        { value: 'system', label: t('view.settings.category.system') },
        { value: 'interface', label: t('view.settings.category.interface') },
        { value: 'social', label: t('view.settings.category.social') },
        { value: 'notifications', label: t('view.settings.category.notifications') },
        { value: 'vr', label: t('view.settings.category.vr') },
        { value: 'media', label: t('view.settings.category.media') },
        { value: 'integrations', label: t('view.settings.category.integrations') },
        { value: 'advanced', label: t('view.settings.category.advanced') }
    ]);

    const searchResults = computed(() =>
        searchSettingsCatalog(settingsSearchCatalog, searchQuery.value, t, environment)
    );

    watch(searchQuery, () => {
        selectedResultIndex.value = 0;
    });

    watch(searchResults, (results) => {
        if (selectedResultIndex.value >= results.length) {
            selectedResultIndex.value = Math.max(0, results.length - 1);
        }
    });

    function moveSelection(offset) {
        if (!searchResults.value.length) return;
        const nextIndex = selectedResultIndex.value + offset;
        selectedResultIndex.value = (nextIndex + searchResults.value.length) % searchResults.value.length;
    }

    function clearSearch() {
        searchQuery.value = '';
    }

    async function focusSetting(itemId) {
        await nextTick();
        const target = document.getElementById(`setting-${itemId}`);
        if (!target) return false;
        target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        const focusTarget = target.querySelector(
            'button:not([disabled]), input:not([disabled]), [role="combobox"], [role="switch"], [tabindex]:not([tabindex="-1"])'
        );
        (focusTarget || target).focus?.({ preventScroll: true });
        target.classList.add('settings-item-highlight');
        window.setTimeout(() => target.classList.remove('settings-item-highlight'), 1200);
        return true;
    }

    async function openSearchResult(result) {
        activeTab.value = result.tab;
        searchQuery.value = '';
        await router.replace({
            query: { ...route.query, tab: result.tab, item: result.id }
        });
        await focusSetting(result.id);
    }

    function selectSelectedResult() {
        const result = searchResults.value[selectedResultIndex.value];
        if (result) openSearchResult(result);
    }

    async function applyRouteTarget() {
        const tab = typeof route.query.tab === 'string' ? route.query.tab : '';
        const item = typeof route.query.item === 'string' ? route.query.item : '';
        if (settingsTabs.value.some((entry) => entry.value === tab)) {
            activeTab.value = tab;
        }
        if (item) {
            await focusSetting(item);
        }
    }

    onBeforeMount(() => {
        const menuItem = document.querySelector('li[role="menuitem"].is-active');

        if (menuItem) {
            menuItem.classList.remove('is-active');
        }
    });

    onMounted(applyRouteTarget);
    watch(() => [route.query.tab, route.query.item], applyRouteTarget);
</script>

<style scoped>
    :global(.settings-item-highlight) {
        animation: settings-item-highlight 1.2s ease-out;
        border-radius: 0.375rem;
    }

    @keyframes settings-item-highlight {
        0%,
        100% {
            background-color: transparent;
        }
        20% {
            background-color: color-mix(in srgb, var(--primary) 14%, transparent);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        :global(.settings-item-highlight) {
            animation: none;
            outline: 2px solid color-mix(in srgb, var(--primary) 45%, transparent);
        }
    }
</style>
