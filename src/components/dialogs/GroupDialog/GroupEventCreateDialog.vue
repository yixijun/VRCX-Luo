<template>
    <Dialog v-model:open="form.visible">
        <DialogContent class="sm:max-w-162.5">
            <DialogHeader>
                <DialogTitle>{{ t('dialog.group_event_create.header') }}</DialogTitle>
                <DialogDescription>{{ groupName }}</DialogDescription>
            </DialogHeader>

            <FieldGroup class="gap-4">
                <Field>
                    <FieldLabel>{{ t('dialog.group_event_create.title') }}</FieldLabel>
                    <FieldContent><Input v-model="form.title" maxlength="64" /></FieldContent>
                </Field>
                <div class="grid gap-4 sm:grid-cols-2">
                    <Field>
                        <FieldLabel>{{ t('dialog.group_event_create.starts_at') }}</FieldLabel>
                        <FieldContent><Input v-model="form.startsAt" type="datetime-local" /></FieldContent>
                    </Field>
                    <Field>
                        <FieldLabel>{{ t('dialog.group_event_create.ends_at') }}</FieldLabel>
                        <FieldContent><Input v-model="form.endsAt" type="datetime-local" /></FieldContent>
                    </Field>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                    <Field>
                        <FieldLabel>{{ t('dialog.group_event_create.access') }}</FieldLabel>
                        <FieldContent>
                            <Select v-model="form.accessType">
                                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="public">{{ t('dialog.group_event_create.public') }}</SelectItem>
                                    <SelectItem value="group">{{
                                        t('dialog.group_event_create.group_only')
                                    }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </FieldContent>
                    </Field>
                    <Field>
                        <FieldLabel>{{ t('dialog.group_event_create.category') }}</FieldLabel>
                        <FieldContent>
                            <Select v-model="form.category">
                                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem v-for="category in categories" :key="category" :value="category">
                                        {{ t(`dialog.group_event_create.categories.${category}`) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </FieldContent>
                    </Field>
                </div>
                <Field>
                    <FieldLabel>{{ t('dialog.group_event_create.description') }}</FieldLabel>
                    <FieldContent><Textarea v-model="form.description" class="min-h-24 resize-none" /></FieldContent>
                </Field>
                <label class="inline-flex items-center gap-2 text-sm">
                    <Checkbox v-model="form.sendCreationNotification" />
                    <span>{{ t('dialog.group_event_create.send_notification') }}</span>
                </label>
            </FieldGroup>

            <DialogFooter>
                <Button variant="secondary" @click="form.visible = false">{{
                    t('dialog.group_event_create.cancel')
                }}</Button>
                <Button :disabled="saving" @click="submit">
                    <Spinner v-if="saving" />
                    {{ t('dialog.group_event_create.create') }}
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
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const categories = [
        'arts',
        'avatars',
        'dance',
        'education',
        'exploration',
        'film_media',
        'gaming',
        'hangout',
        'music',
        'other',
        'performance',
        'roleplaying',
        'wellness'
    ];

    async function submit() {
        const D = form.value;
        const startsAt = new Date(D.startsAt);
        const endsAt = new Date(D.endsAt);
        if (
            !D.title.trim() ||
            !D.description.trim() ||
            Number.isNaN(startsAt.valueOf()) ||
            Number.isNaN(endsAt.valueOf())
        ) {
            toast.warning(t('dialog.group_event_create.required'));
            return;
        }
        if (endsAt <= startsAt) {
            toast.warning(t('dialog.group_event_create.invalid_time'));
            return;
        }
        saving.value = true;
        try {
            const args = await groupRequest.createGroupEvent({
                groupId: D.groupId,
                title: D.title.trim(),
                description: D.description.trim(),
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
                accessType: D.accessType,
                category: D.category,
                tags: [],
                roleIds: [],
                isDraft: false,
                sendCreationNotification: D.sendCreationNotification,
                featured: false,
                hostEarlyJoinMinutes: 60,
                guestEarlyJoinMinutes: 5,
                closeInstanceAfterEndMinutes: 5,
                usesInstanceOverflow: true
            });
            D.visible = false;
            toast.success(t('dialog.group_event_create.success'));
            emit('created', args.json);
        } catch (error) {
            toast.error(error?.message || t('dialog.group_event_create.failed'));
        } finally {
            saving.value = false;
        }
    }
</script>
