<script setup>
    import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
    import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Clock, Globe, History, Image, Users } from 'lucide-vue-next';
    import { storeToRefs } from 'pinia';
    import { useI18n } from 'vue-i18n';

    import { useQuickSearchStore } from '../stores/quickSearch';
    import QuickSearchSync from './QuickSearchSync.vue';
    import UserIdentityInline from './UserIdentityInline.vue';

    const quickSearchStore = useQuickSearchStore();
    const {
        isOpen,
        query,
        friendResults,
        ownAvatarResults,
        favoriteAvatarResults,
        favoriteWorldResults,
        recentlyMetResults,
        recentBeenResults,
        hasResults
    } = storeToRefs(quickSearchStore);
    const { selectResult } = quickSearchStore;
    const { t } = useI18n();

    /**
     * @param item
     */
    function handleSelect(item) {
        selectResult(item);
    }
</script>

<template>
    <Dialog v-model:open="isOpen">
        <DialogContent class="overflow-hidden p-0 sm:max-w-2xl" :show-close-button="false">
            <DialogHeader class="sr-only">
                <DialogTitle>{{ t('side_panel.search_placeholder') }}</DialogTitle>
                <DialogDescription>{{ t('side_panel.search_placeholder') }}</DialogDescription>
            </DialogHeader>
            <Command>
                <!-- Sync filterState.search → store.query -->
                <QuickSearchSync />
                <CommandInput :placeholder="t('side_panel.search_placeholder')" />
                <CommandList class="max-h-[min(400px,50vh)] overflow-y-auto overflow-x-hidden">
                    <template v-if="!query">
                        <CommandGroup
                            v-if="recentlyMetResults.length > 0"
                            :heading="t('side_panel.search_recently_met')">
                            <CommandItem
                                v-for="user in recentlyMetResults"
                                :key="user.userId"
                                :value="'recently-met-' + user.userId"
                                class="gap-3"
                                @select="handleSelect({ id: user.userId, type: 'recentlyMet' })">
                                <Clock class="size-4 text-muted-foreground" />
                                <UserIdentityInline
                                    :user-id="user.userId"
                                    :display-name="user.displayName"
                                    :image-url="user.imageUrl"
                                    avatar-class="size-5" />
                            </CommandItem>
                        </CommandGroup>

                        <CommandGroup
                            v-if="recentBeenResults.length > 0"
                            :heading="t('side_panel.search_recently_joined')">
                            <CommandItem
                                v-for="loc in recentBeenResults"
                                :key="loc.worldId"
                                :value="'recently-joined-' + loc.worldId"
                                class="gap-3"
                                @select="handleSelect({ id: loc.worldId, type: 'recentlyJoined' })">
                                <History class="size-4 text-muted-foreground" />
                                <span class="truncate">{{ loc.worldName }}</span>
                            </CommandItem>
                        </CommandGroup>

                        <CommandGroup v-if="recentlyMetResults.length === 0 && recentBeenResults.length === 0" :heading="t('side_panel.search_categories')">
                            <CommandItem :value="'hint-friends'" disabled class="gap-3 opacity-70">
                                <Users class="size-4" />
                                <span class="flex-1">{{ t('side_panel.search_friends') }}</span>
                            </CommandItem>
                            <CommandItem :value="'hint-recently-met'" disabled class="gap-3 opacity-70">
                                <Clock class="size-4" />
                                <span class="flex-1">{{ t('side_panel.search_recently_met') }}</span>
                            </CommandItem>
                            <CommandItem :value="'hint-fav-worlds'" disabled class="gap-3 opacity-70">
                                <Globe class="size-4" />
                                <span class="flex-1">{{ t('side_panel.search_fav_worlds') }}</span>
                            </CommandItem>
                            <CommandItem :value="'hint-recently-been'" disabled class="gap-3 opacity-70">
                                <History class="size-4" />
                                <span class="flex-1">{{ t('side_panel.search_recently_joined') }}</span>
                            </CommandItem>
                            <CommandItem :value="'hint-own-avatars'" disabled class="gap-3 opacity-70">
                                <Image class="size-4" />
                                <span class="flex-1">{{ t('side_panel.search_own_avatars') }}</span>
                            </CommandItem>
                            <CommandItem :value="'hint-fav-avatars'" disabled class="gap-3 opacity-70">
                                <Image class="size-4" />
                                <span class="flex-1">{{ t('side_panel.search_fav_avatars') }}</span>
                            </CommandItem>
                        </CommandGroup>
                    </template>

                    <template v-else>
                        <div v-if="!hasResults" class="py-6 text-center text-sm text-muted-foreground">
                            {{ t('side_panel.search_no_results') }}
                        </div>

                        <CommandGroup v-if="friendResults.length > 0" :heading="t('side_panel.friends')">
                            <CommandItem
                                v-for="item in friendResults"
                                :key="item.id"
                                :value="[item.name, item.memo, item.note, item.bio, item.id].filter(Boolean).join(' ')"
                                class="gap-3"
                                @select="handleSelect(item)">
                                <div class="flex flex-col min-w-0">
                                    <UserIdentityInline
                                        :user="item.ref"
                                        :user-id="item.id"
                                        :display-name="item.name"
                                        :image-url="item.imageUrl"
                                        :name-style="{ color: item.ref?.$userColour }"
                                        avatar-class="size-5" />
                                    <span
                                        v-if="item.matchedField !== 'name' && item.memo"
                                        class="truncate text-xs text-muted-foreground">
                                        Memo: {{ item.memo }}
                                    </span>
                                    <span
                                        v-if="item.matchedField !== 'name' && item.note"
                                        class="truncate text-xs text-muted-foreground">
                                        Note: {{ item.note }}
                                    </span>
                                    <span
                                        v-if="item.matchedField === 'bio' && item.bio"
                                        class="truncate text-xs text-muted-foreground">
                                        Bio: {{ item.bio }}
                                    </span>
                                </div>
                            </CommandItem>
                        </CommandGroup>

                        <CommandGroup
                            v-if="recentlyMetResults.length > 0"
                            :heading="t('side_panel.search_recently_met')">
                            <CommandItem
                                v-for="user in recentlyMetResults"
                                :key="user.userId"
                                :value="'recently-met-' + user.userId"
                                class="gap-3"
                                @select="handleSelect({ id: user.userId, type: 'recentlyMet' })">
                                <Clock class="size-4 text-muted-foreground" />
                                <UserIdentityInline
                                    :user-id="user.userId"
                                    :display-name="user.displayName"
                                    :image-url="user.imageUrl"
                                    avatar-class="size-5" />
                            </CommandItem>
                        </CommandGroup>

                        <CommandGroup
                            v-if="favoriteWorldResults.length > 0"
                            :heading="t('side_panel.search_fav_worlds')">
                            <CommandItem
                                v-for="item in favoriteWorldResults"
                                :key="item.id"
                                :value="item.name + ' fav ' + item.id"
                                class="gap-3"
                                @select="handleSelect(item)">
                                <img
                                    v-if="item.imageUrl"
                                    :src="item.imageUrl"
                                    class="size-6 rounded object-cover"
                                    loading="lazy" />
                                <Globe v-else class="size-4" />
                                <span class="truncate">{{ item.name }}</span>
                            </CommandItem>
                        </CommandGroup>

                        <CommandGroup
                            v-if="recentBeenResults.length > 0"
                            :heading="t('side_panel.search_recently_joined')">
                            <CommandItem
                                v-for="loc in recentBeenResults"
                                :key="loc.worldId"
                                :value="'recently-joined-' + loc.worldId"
                                class="gap-3"
                                @select="handleSelect({ id: loc.worldId, type: 'recentlyJoined' })">
                                <History class="size-4 text-muted-foreground" />
                                <span class="truncate">{{ loc.worldName }}</span>
                            </CommandItem>
                        </CommandGroup>

                        <CommandGroup v-if="ownAvatarResults.length > 0" :heading="t('side_panel.search_own_avatars')">
                            <CommandItem
                                v-for="item in ownAvatarResults"
                                :key="item.id"
                                :value="item.name + ' own ' + item.id"
                                class="gap-3"
                                @select="handleSelect(item)">
                                <img
                                    v-if="item.imageUrl"
                                    :src="item.imageUrl"
                                    class="size-6 rounded object-cover"
                                    loading="lazy" />
                                <Image v-else class="size-4" />
                                <span class="truncate">{{ item.name }}</span>
                            </CommandItem>
                        </CommandGroup>

                        <CommandGroup
                            v-if="favoriteAvatarResults.length > 0"
                            :heading="t('side_panel.search_fav_avatars')">
                            <CommandItem
                                v-for="item in favoriteAvatarResults"
                                :key="item.id"
                                :value="item.name + ' fav ' + item.id"
                                class="gap-3"
                                @select="handleSelect(item)">
                                <img
                                    v-if="item.imageUrl"
                                    :src="item.imageUrl"
                                    class="size-6 rounded object-cover"
                                    loading="lazy" />
                                <Image v-else class="size-4" />
                                <span class="truncate">{{ item.name }}</span>
                            </CommandItem>
                        </CommandGroup>
                    </template>
                </CommandList>
            </Command>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
    /* Scale up the entire Command UI */

    /* Taller input wrapper */
    :deep([data-slot='command-input-wrapper']) {
        height: 3rem; /* h-12 */
        gap: 0.625rem;
    }

    /* Larger input text */
    :deep([data-slot='command-input']) {
        font-size: 0.9375rem; /* ~15px */
        height: 2.75rem;
    }

    /* Larger search icon in input */
    :deep([data-slot='command-input-wrapper'] > .lucide-search) {
        width: 1.25rem; /* size-5 */
        height: 1.25rem;
    }

    /* Bigger list items */
    :deep([data-slot='command-item']) {
        font-size: 0.9375rem;
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
    }

    /* Bigger group headings */
    :deep([data-slot='command-group-heading']) {
        font-size: 0.8125rem; /* ~13px */
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
    }
</style>
