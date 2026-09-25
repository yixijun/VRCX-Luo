<template>
    <div class="flex min-h-0 flex-col gap-3">
        <UserDialogResourceToolbar>
            <template #summary>
                <Button
                    class="rounded-full"
                    variant="ghost"
                    size="icon-sm"
                    :disabled="userDialog.isAvatarsLoading"
                    :aria-label="t('common.actions.refresh')"
                    @click="userDialog.ref.id === currentUser.id ? refreshUserDialogAvatars() : setUserDialogAvatarsRemote(userDialog.id)">
                    <Spinner v-if="userDialog.isAvatarsLoading" />
                    <RefreshCw v-else />
                </Button>
                <span class="user-resource-count">
                    <UserRound class="size-3.5" />
                    {{ t('dialog.user.avatars.total_count', { count: userDialogAvatars.length }) }}
                </span>
            </template>
            <template #controls>
                <UserDialogResourceSearch
                    v-model="avatarSearchQuery"
                    :placeholder="t('dialog.user.avatars.search_placeholder')" />
                <div
                    v-if="userDialog.ref.id === currentUser.id"
                    class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{{ t('dialog.user.avatars.sort_by') }}</span>
                    <Select
                        :model-value="userDialog.avatarSorting"
                        :disabled="userDialog.isAvatarsLoading"
                        @update:modelValue="changeUserDialogAvatarSorting">
                        <SelectTrigger class="w-36" size="sm" @click.stop>
                            <SelectValue :placeholder="t(`dialog.user.avatars.sort_by_${userDialog.avatarSorting}`)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">{{ t('dialog.user.avatars.sort_by_name') }}</SelectItem>
                            <SelectItem value="update">{{ t('dialog.user.avatars.sort_by_update') }}</SelectItem>
                            <SelectItem value="createdAt">{{ t('dialog.user.avatars.sort_by_uploaded') }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <span>{{ t('dialog.user.avatars.group_by') }}</span>
                    <Select
                        :model-value="userDialog.avatarReleaseStatus"
                        :disabled="userDialog.isAvatarsLoading"
                        @update:modelValue="(value) => (userDialog.avatarReleaseStatus = value)">
                        <SelectTrigger class="w-28" size="sm" @click.stop>
                            <SelectValue :placeholder="t(`dialog.user.avatars.${userDialog.avatarReleaseStatus}`)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{{ t('dialog.user.avatars.all') }}</SelectItem>
                            <SelectItem value="public">{{ t('dialog.user.avatars.public') }}</SelectItem>
                            <SelectItem value="private">{{ t('dialog.user.avatars.private') }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </template>
        </UserDialogResourceToolbar>
        <UserDialogResourceGrid
            :items="filteredUserDialogAvatars"
            :loading="userDialog.isAvatarsLoading"
            @select="showAvatarDialog($event.id)">
            <template #subtitle="{ item }">
                <span v-text="item.releaseStatus"></span>
            </template>
            <template #empty>
                <Search v-if="avatarSearchQuery.trim()" class="size-5" aria-hidden="true" />
                <span>{{
                    t(avatarSearchQuery.trim() && userDialogAvatars.length ? 'common.no_matching_records' : 'common.no_data')
                }}</span>
            </template>
        </UserDialogResourceGrid>
    </div>
</template>

<script setup>
    import { computed, ref, watch } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { storeToRefs } from 'pinia';

    import { RefreshCw, Search, UserRound } from 'lucide-vue-next';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Button } from '@/components/ui/button';
    import { Spinner } from '@/components/ui/spinner';

    import { refreshUserDialogAvatars } from '@/coordinators/userCoordinator';

    import { useAdvancedSettingsStore, useAvatarStore, useUserStore } from '../../../stores';
    import UserDialogResourceGrid from './UserDialogResourceGrid.vue';
    import UserDialogResourceSearch from './UserDialogResourceSearch.vue';
    import UserDialogResourceToolbar from './UserDialogResourceToolbar.vue';

    const { t } = useI18n();

    const userStore = useUserStore();
    const { userDialog, currentUser } = storeToRefs(userStore);
    const { sortUserDialogAvatars } = userStore;

    import { showAvatarDialog, lookupAvatars } from '../../../coordinators/avatarCoordinator';
    const { cachedAvatars } = useAvatarStore();

    const { avatarRemoteDatabase } = storeToRefs(useAdvancedSettingsStore());

    const userDialogAvatars = computed(() => {
        const { avatars, avatarReleaseStatus } = userDialog.value;
        if (avatarReleaseStatus === 'public' || avatarReleaseStatus === 'private') {
            return avatars.filter((avatar) => avatar.releaseStatus === avatarReleaseStatus);
        }
        return avatars;
    });
    const avatarSearchQuery = ref('');
    const filteredUserDialogAvatars = computed(() => {
        const avatars = userDialogAvatars.value;
        const query = avatarSearchQuery.value.trim().toLowerCase();
        if (!query) {
            return avatars;
        }
        return avatars.filter((avatar) => (avatar.name || '').toLowerCase().includes(query));
    });

    watch(
        () => userDialog.value.id,
        () => {
            avatarSearchQuery.value = '';
        }
    );

    /**
     *
     * @param userId
     */
    function setUserDialogAvatars(userId) {
        const avatars = new Set();
        userDialogAvatars.value.forEach((avatar) => {
            avatars.add(avatar.id);
        });
        for (const ref of cachedAvatars.values()) {
            if (ref.authorId === userId && !avatars.has(ref.id)) {
                userDialog.value.avatars.push(ref);
            }
        }
        sortUserDialogAvatars(userDialog.value.avatars);
    }

    /**
     *
     * @param userId
     */
    async function setUserDialogAvatarsRemote(userId) {
        if (avatarRemoteDatabase.value && userId !== currentUser.value.id) {
            userDialog.value.isAvatarsLoading = true;
            const data = await lookupAvatars('authorId', userId);
            const avatars = new Set();
            userDialogAvatars.value.forEach((avatar) => {
                avatars.add(avatar.id);
            });
            if (data && typeof data === 'object') {
                data.forEach((avatar) => {
                    if (avatar.id && !avatars.has(avatar.id)) {
                        if (avatar.authorId === userId) {
                            userDialog.value.avatars.push(avatar);
                        } else {
                            console.error(`Avatar authorId mismatch for ${avatar.id} - ${avatar.name}`);
                        }
                    }
                });
            }
            userDialog.value.avatarSorting = 'name';
            userDialog.value.avatarReleaseStatus = 'all';
            userDialog.value.isAvatarsLoading = false;
        }
        sortUserDialogAvatars(userDialog.value.avatars);
    }

    /**
     *
     * @param sortOption
     */
    function changeUserDialogAvatarSorting(sortOption) {
        const D = userDialog.value;
        D.avatarSorting = sortOption;
        sortUserDialogAvatars(D.avatars);
    }

    defineExpose({ setUserDialogAvatars, setUserDialogAvatarsRemote });
</script>
