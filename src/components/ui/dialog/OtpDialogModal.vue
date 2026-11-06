<script setup>
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '@/components/ui/dialog';
    import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
    import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { generateTotp } from '@/services/totp';
    import { getTotpSecret, hasTotpSecret } from '@/services/totpSecrets';
    import { Button } from '@/components/ui/button';
    import { storeToRefs } from 'pinia';
    import { useModalStore } from '@/stores';

    const modalStore = useModalStore();
    const { t } = useI18n();

    const {
        otpOpen,
        otpTitle,
        otpDescription,
        otpOkText,
        otpCancelText,
        otpDismissible,
        otpMode,
        otpTotpIdentity,
        otpMethods
    } = storeToRefs(modalStore);

    const otpValue = ref('');
    const saved = ref(false);
    const filling = ref(false);
    const fillError = ref('');
    let revision = 0;
    let fillingValue = false;
    onBeforeUnmount(() => {
        revision++;
        otpValue.value = '';
    });

    async function fillCode() {
        const current = revision;
        filling.value = true;
        fillError.value = '';
        try {
            const secret = await getTotpSecret(otpTotpIdentity.value);
            if (!secret) throw new Error('Missing key');
            const code = await generateTotp(secret);
            if (current !== revision) return;
            fillingValue = true;
            otpValue.value = code;
            await nextTick();
        } catch {
            if (current === revision) fillError.value = t('totp.storage_unavailable');
        } finally {
            fillingValue = false;
            if (current === revision) filling.value = false;
        }
    }

    function onComplete(value) {
        if (otpMode.value === 'totp' || fillingValue) {
            otpValue.value = value;
            return;
        }
        modalStore.handleOtpOk(value);
    }

    function onSubmit() {
        if (!otpValue.value) return;
        modalStore.handleOtpOk(otpValue.value);
    }

    function onEscapeKeyDown(event) {
        if (!otpDismissible.value) {
            event.preventDefault();
            return;
        }
        modalStore.handleOtpDismiss(otpValue.value);
    }

    function onPointerDownOutside(event) {
        if (!otpDismissible.value) {
            event.preventDefault();
            return;
        }
        modalStore.handleOtpDismiss(otpValue.value);
    }

    function onInteractOutside(event) {
        if (!otpDismissible.value) {
            event.preventDefault();
            return;
        }
        modalStore.handleOtpDismiss(otpValue.value);
    }

    function handleCancel() {
        modalStore.handleOtpCancel(otpValue.value);
    }

    function stripNonAlphanumeric(value) {
        return value.replace(/[^a-z0-9]/gi, '');
    }

    watch(
        [otpOpen, otpTotpIdentity, otpTitle, otpMode],
        async ([open]) => {
            const current = ++revision;
            otpValue.value = '';
            saved.value = false;
            filling.value = false;
            fillError.value = '';
            if (!open || otpMode.value !== 'totp' || !otpTotpIdentity.value) return;
            const exists = await hasTotpSecret(otpTotpIdentity.value).catch(() => false);
            if (current === revision) saved.value = exists;
        },
        { immediate: true }
    );
</script>

<template>
    <Dialog :open="otpOpen" @update:open="modalStore.setOtpOpen">
        <DialogContent
            :show-close-button="false"
            @escapeKeyDown="onEscapeKeyDown"
            @pointerDownOutside="onPointerDownOutside"
            @interactOutside="onInteractOutside">
            <form @submit.prevent="onSubmit">
                <DialogHeader class="mb-5">
                    <DialogTitle>{{ otpTitle }}</DialogTitle>
                    <DialogDescription>{{
                        otpMode === 'choice' ? t('totp.available_methods') : otpDescription
                    }}</DialogDescription>
                </DialogHeader>

                <div class="flex justify-center">
                    <div v-if="otpMode === 'choice'" class="flex flex-col gap-3 w-full">
                        <Button
                            type="button"
                            :disabled="!otpMethods.includes('emailOtp')"
                            @click="modalStore.handleOtpOk('emailOtp')">
                            {{ t('totp.email_method') }}
                        </Button>
                        <Button
                            type="button"
                            :disabled="!otpMethods.includes('totp')"
                            @click="modalStore.handleOtpOk('totp')">
                            {{ t('totp.totp_method') }}
                        </Button>
                    </div>
                    <!-- TOTP / EmailOTP: 6 numeric digits -->
                    <InputOTP
                        v-if="otpMode === 'totp' || otpMode === 'emailOtp'"
                        v-model="otpValue"
                        :maxlength="6"
                        autofocus
                        inputmode="numeric"
                        @complete="onComplete">
                        <InputOTPGroup>
                            <InputOTPSlot v-for="i in 6" :key="i - 1" :index="i - 1" />
                        </InputOTPGroup>
                    </InputOTP>

                    <!-- OTP (recovery code): 4+4 alphanumeric with separator -->
                    <InputOTP
                        v-if="otpMode === 'otp'"
                        v-model="otpValue"
                        :maxlength="8"
                        autofocus
                        inputmode="text"
                        :paste-transformer="stripNonAlphanumeric"
                        @complete="onComplete">
                        <InputOTPGroup>
                            <InputOTPSlot v-for="i in 4" :key="i - 1" :index="i - 1" />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                            <InputOTPSlot v-for="i in 4" :key="i + 3" :index="i + 3" />
                        </InputOTPGroup>
                    </InputOTP>
                </div>

                <div v-if="otpMode === 'totp'" class="mt-3 space-y-3">
                    <Button
                        v-if="saved"
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="filling"
                        @click="fillCode">
                        {{ t('totp.fill_code') }}
                    </Button>
                    <p v-if="fillError" role="alert" class="text-sm text-destructive">{{ fillError }}</p>
                </div>

                <DialogFooter class="mt-5">
                    <Button type="button" variant="outline" @click="handleCancel">
                        {{ otpCancelText }}
                    </Button>
                    <Button v-if="otpMode !== 'choice'" type="submit">
                        {{ otpOkText }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
