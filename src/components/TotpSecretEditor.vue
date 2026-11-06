<template>
    <div class="space-y-3" @keydown.enter.prevent="submit">
        <p class="text-xs text-muted-foreground">{{ t('totp.local_storage') }}</p>
        <div v-if="saved" class="space-y-2">
            <p class="text-xs text-muted-foreground">{{ t('totp.saved') }}</p>
            <div v-if="code" class="rounded-md border p-3" aria-live="off">
                <p class="text-xs text-muted-foreground">{{ t('totp.current_code') }}</p>
                <p data-testid="totp-code" class="font-mono text-2xl tracking-widest select-text">{{ code }}</p>
                <p class="text-xs text-muted-foreground">{{ t('totp.expires_in', { seconds: remaining }) }}</p>
            </div>
        </div>
        <InputGroupField
            v-model="secret"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :aria-label="t('totp.secret')"
            :placeholder="t('totp.placeholder')"
            :disabled="busy" />
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-2">
                <Switch
                    :id="toggleId"
                    :model-value="allowLoginFill"
                    :disabled="busy || !permissionReady || !identity"
                    @update:model-value="setLoginFill" />
                <label :for="toggleId" class="text-sm cursor-pointer">{{ t('totp.allow_login_fill') }}</label>
            </div>
            <div class="ml-auto flex justify-end gap-2">
                <Button v-if="saved && identity" type="button" variant="outline" :disabled="busy" @click="remove">
                    {{ t('totp.remove') }}
                </Button>
                <Button type="button" :disabled="busy || !identity || !secret.trim()" @click="submit">
                    {{ t('totp.save') }}
                </Button>
            </div>
        </div>
        <p class="text-xs text-muted-foreground">{{ t('totp.allow_login_fill_hint') }}</p>
    </div>
</template>

<script setup>
    import { onBeforeUnmount, ref, useId, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { Button } from '@/components/ui/button';
    import { Switch } from '@/components/ui/switch';
    import { InputGroupField } from '@/components/ui/input-group';
    import { generateTotp, parseTotpSecret } from '../services/totp';
    import {
        hasTotpSecret,
        getTotpSecret,
        saveTotpSecret,
        removeTotpSecret,
        getTotpLoginFillAllowed,
        setTotpLoginFillAllowed
    } from '../services/totpSecrets';

    const props = defineProps({ identity: { type: Object, default: null } });
    const emit = defineEmits(['done']);
    const { t } = useI18n();
    const secret = ref('');
    const saved = ref(false);
    const code = ref('');
    const remaining = ref(30);
    const busy = ref(false);
    const error = ref('');
    const allowLoginFill = ref(false);
    const permissionReady = ref(false);
    const toggleId = useId();
    let revision = 0;
    let timer;
    let currentSecret = null;
    let lastPeriod = -1;

    function clearCode() {
        clearInterval(timer);
        currentSecret = null;
        code.value = '';
        lastPeriod = -1;
    }

    async function tick() {
        const current = revision;
        const now = Date.now();
        remaining.value = 30 - (Math.floor(now / 1000) % 30);
        const period = Math.floor(now / 30000);
        if (!currentSecret || period === lastPeriod) return;
        lastPeriod = period;
        try {
            const value = await generateTotp(currentSecret, { now });
            if (
                current === revision &&
                currentSecret &&
                lastPeriod === period &&
                Math.floor(Date.now() / 30000) === period
            )
                code.value = value;
        } catch {
            if (current === revision) {
                clearCode();
                error.value = t('totp.storage_unavailable');
            }
        }
    }

    async function loadCode(current) {
        clearCode();
        const exists = props.identity && (await hasTotpSecret(props.identity));
        if (current !== revision) return;
        saved.value = Boolean(exists);
        const stored = props.identity && (await getTotpSecret(props.identity));
        if (current !== revision) return;
        clearCode();
        saved.value = Boolean(stored);
        currentSecret = stored;
        if (!stored) return;
        await tick();
        if (current === revision && currentSecret) timer = setInterval(tick, 1000);
    }

    watch(
        () => props.identity,
        async () => {
            const current = ++revision;
            clearCode();
            secret.value = '';
            saved.value = false;
            allowLoginFill.value = false;
            permissionReady.value = false;
            error.value = '';
            try {
                const allowed = props.identity && (await getTotpLoginFillAllowed(props.identity));
                if (current !== revision) return;
                allowLoginFill.value = Boolean(allowed);
                permissionReady.value = Boolean(props.identity);
                await loadCode(current);
            } catch {
                if (current === revision) error.value = t('totp.storage_unavailable');
            }
        },
        { immediate: true }
    );

    onBeforeUnmount(() => {
        revision++;
        clearCode();
        secret.value = '';
    });

    async function setLoginFill(allowed) {
        if (busy.value || !permissionReady.value || !props.identity) return;
        busy.value = true;
        error.value = '';
        const current = revision;
        const previous = allowLoginFill.value;
        allowLoginFill.value = allowed;
        try {
            await setTotpLoginFillAllowed(props.identity, allowed);
        } catch {
            if (current === revision) {
                allowLoginFill.value = previous;
                error.value = t('totp.preference_failed');
            }
        } finally {
            busy.value = false;
        }
    }

    async function submit() {
        if (busy.value || !props.identity || !secret.value.trim()) return;
        let parsed;
        try {
            parsed = parseTotpSecret(secret.value);
        } catch {
            error.value = t('totp.invalid');
            return;
        }
        busy.value = true;
        error.value = '';
        const current = revision;
        try {
            await saveTotpSecret(props.identity, parsed);
            if (current !== revision) return;
            secret.value = '';
            await loadCode(current);
            if (current === revision) emit('done');
        } catch {
            if (current === revision) error.value = t('totp.storage_unavailable');
        } finally {
            busy.value = false;
        }
    }

    async function remove() {
        if (busy.value || !props.identity) return;
        busy.value = true;
        const current = ++revision;
        clearCode();
        try {
            await removeTotpSecret(props.identity);
            if (current !== revision) return;
            saved.value = false;
            allowLoginFill.value = false;
            secret.value = '';
            error.value = '';
            emit('done');
        } catch {
            if (current === revision) error.value = t('totp.storage_unavailable');
        } finally {
            busy.value = false;
        }
    }
</script>
