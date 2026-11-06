<template>
    <SettingsGroup :title="t('totp.manage')">
        <p class="text-sm">{{ currentUser.displayName }}</p>
        <TotpSecretEditor v-if="identity" :key="currentUser.id" :identity="identity" />
        <p v-else class="text-xs text-muted-foreground">{{ t('totp.missing_identity') }}</p>
    </SettingsGroup>
</template>

<script setup>
    import { onBeforeUnmount, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';
    import { useAuthStore, useUserStore } from '@/stores';
    import { AppDebug } from '@/services/appConfig';
    import TotpSecretEditor from '@/components/TotpSecretEditor.vue';
    import SettingsGroup from './SettingsGroup.vue';

    const { t } = useI18n();
    const authStore = useAuthStore();
    const { currentTotpIdentity } = storeToRefs(authStore);
    const { currentUser } = storeToRefs(useUserStore());
    const identity = ref(null);
    let revision = 0;
    onBeforeUnmount(() => {
        revision++;
    });

    watch(
        [() => currentUser.value.id, currentTotpIdentity],
        async ([id, active]) => {
            const current = ++revision;
            identity.value = null;
            if (!id) return;
            if (active) {
                identity.value = active;
                return;
            }
            try {
                const saved = await authStore.getSavedCredentials(id);
                if (current !== revision) return;
                identity.value = saved?.loginParams?.username
                    ? {
                          username: saved.loginParams.username,
                          endpoint: saved.loginParams.endpoint || AppDebug.endpointDomainVrchat
                      }
                    : null;
            } catch {
                if (current === revision) identity.value = active;
            }
        },
        { immediate: true }
    );
</script>
