<template>
    <Popover v-if="hasSecondarySessions" v-model:open="open">
        <PopoverTrigger as-child>
            <Button
                class="rounded-full relative p-0 overflow-hidden"
                variant="ghost"
                size="icon-sm"
                :title="t('status_bar.view_mode')">
                <Avatar class="size-7">
                    <AvatarImage v-if="activeAvatar" :src="activeAvatar" class="object-cover" />
                    <AvatarFallback class="text-[10px]">{{ activeInitial }}</AvatarFallback>
                </Avatar>
                <span
                    class="absolute bottom-0 right-0 size-2.5 rounded-full border border-sidebar"
                    :style="{ background: viewModeColor }" />
            </Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" class="w-56 p-1">
            <button
                type="button"
                class="flex w-full items-center gap-2 px-2 py-1.5 rounded text-left text-xs cursor-pointer hover:bg-accent"
                :class="{ 'bg-accent': isMergedView }"
                @click="selectViewMode('merged')">
                <span class="inline-block size-7 rounded-full bg-foreground/10 text-center leading-7 text-[10px]">
                    ALL
                </span>
                <span class="min-w-0 flex-1 truncate">{{ t('status_bar.view_merged') }}</span>
            </button>
            <button
                v-for="[id, session] in allSessions"
                :key="id"
                type="button"
                class="flex w-full items-center gap-2 px-2 py-1.5 rounded text-left text-xs cursor-pointer hover:bg-accent"
                :class="{ 'bg-accent': currentViewMode === `account:${id}` || (id === primaryId && currentViewMode === 'primary') }"
                @click="selectViewMode(id)">
                <Avatar class="size-7">
                    <AvatarImage v-if="sessionAvatar(session)" :src="sessionAvatar(session)" class="object-cover" />
                    <AvatarFallback class="text-[10px]">{{ sessionInitial(session) }}</AvatarFallback>
                </Avatar>
                <span
                    class="inline-block size-2 rounded-full shrink-0"
                    :style="{ background: getAccountColor(id) }" />
                <span class="min-w-0 flex-1 truncate">{{ sessionLabel(session, id) }}</span>
                <span v-if="id === primaryId" class="text-muted-foreground text-[10px]">P</span>
            </button>
        </PopoverContent>
    </Popover>
</template>

<script setup>
    import { computed, ref } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Button } from '@/components/ui/button';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { useUserDisplay } from '../composables/useUserDisplay';
    import { accountHub } from '../services/accountHub.js';

    const { t } = useI18n();
    const { userImage } = useUserDisplay();
    const open = ref(false);

    const hasSecondarySessions = computed(() => accountHub.hasSecondarySessions);
    const isMergedView = computed(() => accountHub.isMergedView);
    const currentViewMode = computed(() => accountHub.viewMode);
    const primaryId = computed(() => accountHub.primaryId);
    const allSessions = computed(() => [...accountHub.sessions.entries()]);

    const activeSession = computed(() => {
        const mode = accountHub.viewMode;
        if (mode === 'merged') {
            return accountHub.sessions.get(accountHub.primaryId) || allSessions.value[0]?.[1] || null;
        }
        const id = mode === 'primary' ? accountHub.primaryId : mode.replace('account:', '');
        return accountHub.sessions.get(id) || null;
    });

    const activeAvatar = computed(() => sessionAvatar(activeSession.value));
    const activeInitial = computed(() => {
        if (accountHub.viewMode === 'merged') return 'ALL';
        return sessionInitial(activeSession.value);
    });

    const viewModeColor = computed(() => {
        const mode = accountHub.viewMode;
        if (mode === 'merged') return 'var(--color-foreground, #888)';
        const id = mode === 'primary' ? accountHub.primaryId : mode.replace('account:', '');
        return accountHub.getAccountColor(id);
    });

    function getAccountColor(userId) {
        return accountHub.getAccountColor(userId);
    }

    function sessionLabel(session, fallbackId = '') {
        return session?.label || session?.userInfo?.displayName || fallbackId;
    }

    function sessionInitial(session) {
        const label = sessionLabel(session, session?.userId || '?');
        return label.slice(0, 1).toUpperCase();
    }

    function sessionAvatar(session) {
        if (!session?.userInfo) return '';
        return userImage(session.userInfo, true);
    }

    function selectViewMode(idOrMerged) {
        if (idOrMerged === 'merged') {
            accountHub.switchToMerged();
        } else {
            accountHub.switchToAccount(idOrMerged);
        }
        open.value = false;
    }
</script>
