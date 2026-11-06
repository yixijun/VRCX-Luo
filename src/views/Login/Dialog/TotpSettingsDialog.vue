<template>
    <Dialog v-model:open="open">
        <DialogTrigger as-child>
            <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                class="rounded-full"
                :aria-label="t('totp.manage')"
                :title="t('totp.manage')">
                <KeyRound class="size-4" />
            </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{{ t('totp.manage') }}</DialogTitle>
                <DialogDescription>{{ accountLabel }}</DialogDescription>
            </DialogHeader>
            <TotpSecretEditor v-if="open" :identity="identity" />
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { KeyRound } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogHeader,
        DialogTitle,
        DialogTrigger
    } from '@/components/ui/dialog';
    import TotpSecretEditor from '../../../components/TotpSecretEditor.vue';
    const props = defineProps({
        username: { type: String, required: true },
        endpoint: { type: String, required: true },
        accountLabel: { type: String, required: true }
    });
    const { t } = useI18n();
    const open = ref(false);
    const identity = computed(() => ({ username: props.username, endpoint: props.endpoint }));
</script>
