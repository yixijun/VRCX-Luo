<template>
    <div class="flex flex-col gap-10 py-2">
        <!-- Discord Rich Presence -->
        <SettingsGroup :title="t('view.settings.discord_presence.discord_presence.header')">
            <template #description>
                <p class="m-0">{{ t('view.settings.discord_presence.discord_presence.description') }}</p>
                <p class="m-0 cursor-pointer hover:text-foreground transition-colors" @click="showVRChatConfig">
                    {{ t('view.settings.discord_presence.discord_presence.enable_tooltip') }}
                </p>
            </template>

            <SettingsItem :label="t('view.settings.discord_presence.discord_presence.enable')">
                <Switch
                    :model-value="discordActive"
                    @update:modelValue="
                        setDiscordActive();
                        saveDiscordOption();
                    " />
            </SettingsItem>

            <SettingsItem
                :label="t('view.settings.discord_presence.discord_presence.world_integration')"
                :description="t('view.settings.discord_presence.discord_presence.world_integration_tooltip')">
                <Switch
                    :model-value="discordWorldIntegration"
                    :disabled="!discordActive"
                    @update:modelValue="
                        setDiscordWorldIntegration();
                        saveDiscordOption();
                    " />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.discord_presence.discord_presence.instance_type_player_count')">
                <Switch
                    :model-value="discordInstance"
                    :disabled="!discordActive"
                    @update:modelValue="
                        setDiscordInstance();
                        saveDiscordOption();
                    " />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.discord_presence.discord_presence.show_current_platform')">
                <Switch
                    :model-value="discordShowPlatform"
                    :disabled="!discordActive || !discordInstance"
                    @update:modelValue="
                        setDiscordShowPlatform();
                        saveDiscordOption();
                    " />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.discord_presence.discord_presence.show_details_in_private')">
                <Switch
                    :model-value="!discordHideInvite"
                    :disabled="!discordActive"
                    @update:modelValue="
                        setDiscordHideInvite();
                        saveDiscordOption();
                    " />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.discord_presence.discord_presence.join_button')">
                <Switch
                    :model-value="discordJoinButton"
                    :disabled="!discordActive"
                    @update:modelValue="
                        setDiscordJoinButton();
                        saveDiscordOption();
                    " />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.discord_presence.discord_presence.show_images')">
                <Switch
                    :model-value="!discordHideImage"
                    :disabled="!discordActive"
                    @update:modelValue="
                        setDiscordHideImage();
                        saveDiscordOption();
                    " />
            </SettingsItem>

            <SettingsItem
                :label="t('view.settings.discord_presence.discord_presence.display_world_name_as_discord_status')">
                <Switch
                    :model-value="discordWorldNameAsDiscordStatus"
                    :disabled="!discordActive"
                    @update:modelValue="
                        setDiscordWorldNameAsDiscordStatus();
                        saveDiscordOption();
                    " />
            </SettingsItem>
        </SettingsGroup>

        <!-- Translation API -->
        <SettingsGroup :title="t('view.settings.advanced.advanced.translation_api.header')">
            <SettingsItem
                :label="t('view.settings.advanced.advanced.translation_api.enable')"
                :description="t('view.settings.advanced.advanced.translation_api.enable_tooltip')">
                <Switch
                    :model-value="translationApi"
                    @update:modelValue="changeTranslationAPI('VRCX_translationAPI')" />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.advanced.advanced.translation_api.translation_api_key')">
                <Button size="sm" variant="outline" @click="showTranslationApiDialog">
                    <Languages class="h-4 w-4 mr-1.5" />
                    {{ t('view.settings.advanced.advanced.translation_api.translation_api_key') }}
                </Button>
            </SettingsItem>
        </SettingsGroup>

        <!-- YouTube API -->
        <SettingsGroup :title="t('view.settings.advanced.advanced.youtube_api.header')">
            <SettingsItem
                :label="t('view.settings.advanced.advanced.youtube_api.enable')"
                :description="t('view.settings.advanced.advanced.youtube_api.enable_tooltip')">
                <Switch :model-value="youTubeApi" @update:modelValue="changeYouTubeApi('VRCX_youtubeAPI')" />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.advanced.advanced.youtube_api.youtube_api_key')">
                <Button size="sm" variant="outline" @click="showYouTubeApiDialog">{{
                    t('view.settings.advanced.advanced.youtube_api.youtube_api_key')
                }}</Button>
            </SettingsItem>
        </SettingsGroup>

        <!-- Remote Database -->
        <SettingsGroup :title="t('view.settings.advanced.advanced.remote_database.header')">
            <SettingsItem
                :label="t('view.settings.advanced.advanced.remote_database.enable')"
                :description="t('view.settings.advanced.advanced.remote_database.enable_description')">
                <Switch
                    :model-value="avatarRemoteDatabase"
                    @update:modelValue="setAvatarRemoteDatabase(!avatarRemoteDatabase)" />
            </SettingsItem>

            <SettingsItem :label="t('view.settings.advanced.advanced.remote_database.avatar_database_provider')">
                <Button size="sm" variant="outline" @click="showAvatarProviderDialog">{{
                    t('view.settings.advanced.advanced.remote_database.avatar_database_provider')
                }}</Button>
            </SettingsItem>
        </SettingsGroup>

        <SettingsGroup title="网页远控">
            <template #description>
                <p class="m-0">在局域网浏览器中查看并操控当前已登录的 VRCX。</p>
                <p v-if="remoteAccessStore.url" class="m-0">
                    <span class="text-foreground">{{ remoteAccessStore.url }}</span>
                </p>
                <p v-if="remoteAccessStore.error" class="m-0 text-destructive">
                    {{ remoteAccessStore.error }}
                </p>
            </template>

            <SettingsItem label="启用网页远控" description="默认关闭，启用后同一局域网设备可访问。">
                <Switch
                    :model-value="remoteAccessStore.enabled"
                    :disabled="!remoteAccessStore.hasPassword"
                    @update:modelValue="remoteAccessStore.setEnabled" />
            </SettingsItem>

            <SettingsItem label="访问端口" description="默认 23580，端口被占用时不会启动。">
                <Input
                    class="w-28"
                    type="number"
                    min="1024"
                    max="65535"
                    :model-value="String(remoteAccessStore.port)"
                    @change="remoteAccessStore.setPort($event.target.value)" />
            </SettingsItem>

            <SettingsItem label="访问密码" description="密码仅用于换取网页会话令牌，不会明文保存。">
                <div class="flex items-center gap-2">
                    <Input
                        v-model="remotePassword"
                        class="w-44"
                        type="password"
                        placeholder="设置访问密码" />
                    <Button size="sm" variant="outline" @click="saveRemotePassword">保存</Button>
                </div>
            </SettingsItem>

            <SettingsItem label="隐私模式" description="隐藏私密位置、通知正文等敏感内容。">
                <Switch
                    :model-value="remoteAccessStore.privacyMode"
                    @update:modelValue="remoteAccessStore.setPrivacyMode" />
            </SettingsItem>

            <SettingsItem label="访问地址">
                <div class="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="!remoteAccessStore.url"
                        @click="copyRemoteUrl">
                        复制地址
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="!remoteAccessStore.hasPassword"
                        @click="remoteAccessStore.refreshStatus">
                        刷新状态
                    </Button>
                </div>
            </SettingsItem>
        </SettingsGroup>

        <TranslationApiDialog v-model:isTranslationApiDialogVisible="isTranslationApiDialogVisible" />
        <YouTubeApiDialog v-model:isYouTubeApiDialogVisible="isYouTubeApiDialogVisible" />
        <AvatarProviderDialog v-model:isAvatarProviderDialogVisible="isAvatarProviderDialogVisible" />
    </div>
</template>

<script setup>
    import { ref } from 'vue';
    import { Languages } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Switch } from '@/components/ui/switch';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';

    import {
        useAdvancedSettingsStore,
        useAvatarProviderStore,
        useDiscordPresenceSettingsStore,
        useRemoteAccessStore,
        useVrStore
    } from '@/stores';

    import AvatarProviderDialog from '../../dialogs/AvatarProviderDialog.vue';
    import TranslationApiDialog from '../../dialogs/TranslationApiDialog.vue';
    import YouTubeApiDialog from '../../dialogs/YouTubeApiDialog.vue';
    import SettingsGroup from '../SettingsGroup.vue';
    import SettingsItem from '../SettingsItem.vue';

    const { t } = useI18n();
    const remoteAccessStore = useRemoteAccessStore();
    const remotePassword = ref('');

    const advancedSettingsStore = useAdvancedSettingsStore();
    const { updateVRLastLocation, updateOpenVR } = useVrStore();

    const {
        setDiscordActive,
        setDiscordInstance,
        setDiscordHideInvite,
        setDiscordJoinButton,
        setDiscordHideImage,
        setDiscordShowPlatform,
        setDiscordWorldIntegration,
        setDiscordWorldNameAsDiscordStatus,
        saveDiscordOption
    } = useDiscordPresenceSettingsStore();

    const {
        discordActive,
        discordInstance,
        discordHideInvite,
        discordJoinButton,
        discordHideImage,
        discordShowPlatform,
        discordWorldIntegration,
        discordWorldNameAsDiscordStatus
    } = storeToRefs(useDiscordPresenceSettingsStore());

    const { showVRChatConfig } = advancedSettingsStore;

    const { avatarRemoteDatabase, youTubeApi, translationApi } = storeToRefs(advancedSettingsStore);

    const { setAvatarRemoteDatabase } = advancedSettingsStore;

    const { isAvatarProviderDialogVisible } = storeToRefs(useAvatarProviderStore());
    const { showAvatarProviderDialog } = useAvatarProviderStore();

    const isYouTubeApiDialogVisible = ref(false);
    const isTranslationApiDialogVisible = ref(false);

    remoteAccessStore.init();

    /**
     *
     */
    function showYouTubeApiDialog() {
        isYouTubeApiDialogVisible.value = true;
    }

    /**
     *
     */
    function showTranslationApiDialog() {
        isTranslationApiDialogVisible.value = true;
    }

    async function saveRemotePassword() {
        if (remotePassword.value.length < 6) {
            toast.error('访问密码至少需要 6 位');
            return;
        }
        await remoteAccessStore.setPassword(remotePassword.value);
        remotePassword.value = '';
        toast.success('网页远控密码已保存');
    }

    async function copyRemoteUrl() {
        if (!remoteAccessStore.url) {
            return;
        }
        await navigator.clipboard.writeText(remoteAccessStore.url);
        toast.success('访问地址已复制');
    }

    /**
     *
     * @param configKey
     */
    async function changeYouTubeApi(configKey = '') {
        if (configKey === 'VRCX_youtubeAPI') {
            advancedSettingsStore.setYouTubeApi();
        }
        updateVRLastLocation();
        updateOpenVR();
    }

    /**
     *
     * @param configKey
     */
    async function changeTranslationAPI(configKey = '') {
        if (configKey === 'VRCX_translationAPI') {
            advancedSettingsStore.setTranslationApi();
        }
    }
</script>
