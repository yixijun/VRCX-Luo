<template>
    <Dialog v-model:open="form.visible">
        <DialogContent class="sm:max-w-125">
            <DialogHeader>
                <DialogTitle>{{ t('dialog.group_gallery_create.header') }}</DialogTitle>
                <DialogDescription>{{ groupName }}</DialogDescription>
            </DialogHeader>
            <FieldGroup class="gap-4">
                <Field>
                    <FieldLabel>{{ t('dialog.group_gallery_create.name') }}</FieldLabel>
                    <FieldContent><Input v-model="form.name" maxlength="64" /></FieldContent>
                </Field>
                <Field>
                    <FieldLabel>{{ t('dialog.group_gallery_create.description') }}</FieldLabel>
                    <FieldContent><Textarea v-model="form.description" class="min-h-20 resize-none" /></FieldContent>
                </Field>
                <label class="inline-flex items-center gap-2 text-sm">
                    <Checkbox v-model="form.membersOnly" />
                    <span>{{ t('dialog.group_gallery_create.members_only') }}</span>
                </label>
            </FieldGroup>
            <DialogFooter>
                <Button variant="secondary" @click="form.visible = false">{{
                    t('dialog.group_gallery_create.cancel')
                }}</Button>
                <Button :disabled="saving" @click="submit">
                    <Spinner v-if="saving" />
                    {{ t('dialog.group_gallery_create.create') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup>
    import { computed, ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { toast } from 'vue-sonner';
    import { Button } from '@/components/ui/button';
    import { Checkbox } from '@/components/ui/checkbox';
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '@/components/ui/dialog';
    import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field';
    import { Input } from '@/components/ui/input';
    import { Spinner } from '@/components/ui/spinner';
    import { Textarea } from '@/components/ui/textarea';
    import { groupRequest } from '@/api';

    const props = defineProps({
        dialogData: { type: Object, required: true },
        groupName: { type: String, default: '' }
    });
    const emit = defineEmits(['created']);
    const { t } = useI18n();
    const saving = ref(false);
    const form = computed(() => props.dialogData);

    async function submit() {
        const D = form.value;
        if (!D.name.trim()) {
            toast.warning(t('dialog.group_gallery_create.required'));
            return;
        }
        saving.value = true;
        try {
            const args = await groupRequest.createGroupGallery({
                groupId: D.groupId,
                name: D.name.trim(),
                description: D.description.trim(),
                membersOnly: D.membersOnly,
                roleIdsToAutoApprove: null,
                roleIdsToManage: null,
                roleIdsToSubmit: null,
                roleIdsToView: null
            });
            D.visible = false;
            toast.success(t('dialog.group_gallery_create.success'));
            emit('created', args.json);
        } catch (error) {
            toast.error(error?.message || t('dialog.group_gallery_create.failed'));
        } finally {
            saving.value = false;
        }
    }
</script>
