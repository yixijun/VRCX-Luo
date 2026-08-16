<template>
    <div @click="confirm" class="flex min-w-0 max-w-full cursor-pointer items-center align-top">
        <span v-if="avatarName" class="flex min-w-0 items-center truncate" :title="avatarName"
            >{{ avatarName }} <Lock v-if="avatarType && avatarType === '(own)'" class="h-4 w-4 ml-1"
        /></span>
        <span v-else class="flex min-w-0 items-center truncate text-muted-foreground">{{
            t('dialog.user.info.unknown_avatar')
        }}</span>
        <TooltipWrapper v-if="showtags && avatarTags" class="ml-1 min-w-0">
            <template #content>
                <span class="truncate">{{ avatarTags }}</span>
            </template>
            <span class="truncate text-xs text-muted-foreground">{{ avatarTags }}</span>
        </TooltipWrapper>
    </div>
</template>

<script setup>
    import { ref, watch } from 'vue';
    import { Lock } from 'lucide-vue-next';
    import { useI18n } from 'vue-i18n';

    import { TooltipWrapper } from './ui/tooltip';
    import { getAvatarName, showAvatarAuthorDialog } from '../coordinators/avatarCoordinator';

    const { t } = useI18n();

    const props = defineProps({
        imageurl: String,
        userid: String,
        hintownerid: String,
        hintavatarname: [String, Object],
        avatartags: Array,
        showtags: {
            type: Boolean,
            default: true
        }
    });

    const avatarName = ref('');
    const avatarType = ref('');
    const avatarTags = ref('');
    let ownerId = '';

    const parse = async () => {
        ownerId = '';
        avatarName.value = '';
        avatarType.value = '';
        avatarTags.value = '';

        if (!props.imageurl) {
            avatarName.value = '';
        } else if (props.hintownerid) {
            if (typeof props.hintavatarname === 'string') {
                avatarName.value = props.hintavatarname;
            }
            ownerId = props.hintownerid;
        } else {
            try {
                const info = await getAvatarName(props.imageurl);
                avatarName.value = info.avatarName;
                ownerId = info.ownerId;
            } catch {
                console.error('Failed to fetch avatar name');
            }
        }

        if (typeof props.userid === 'undefined' || !ownerId) {
            avatarType.value = '';
        } else if (ownerId === props.userid) {
            avatarType.value = '(own)';
        } else {
            avatarType.value = '(public)';
        }

        if (Array.isArray(props.avatartags)) {
            avatarTags.value = props.avatartags.map((tag) => String(tag).replace('content_', '')).join(', ');
        }
    };

    const confirm = () => {
        if (!props.imageurl) return;
        showAvatarAuthorDialog(props.userid, ownerId, props.imageurl);
    };

    watch([() => props.imageurl, () => props.userid, () => props.avatartags], parse, { immediate: true });
</script>
