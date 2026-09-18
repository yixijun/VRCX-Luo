<script setup>
    import {
        Breadcrumb,
        BreadcrumbEllipsis,
        BreadcrumbItem,
        BreadcrumbLink,
        BreadcrumbList,
        BreadcrumbPage,
        BreadcrumbSeparator
    } from '@/components/ui/breadcrumb';
    import {
        useAppearanceSettingsStore,
        useAvatarStore,
        useGroupStore,
        useInstanceStore,
        useUiStore,
        useUserStore,
        useWorldStore
    } from '@/stores';
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuTrigger
    } from '@/components/ui/dropdown-menu';
    import { Dialog, DialogContent } from '@/components/ui/dialog';
    import { ArrowLeft } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import { TooltipWrapper } from '@/components/ui/tooltip';
    import { computed, onBeforeUnmount, ref, watch } from 'vue';
    import { storeToRefs } from 'pinia';

    import AvatarDialog from './AvatarDialog/AvatarDialog.vue';
    import GroupDialog from './GroupDialog/GroupDialog.vue';
    import PreviousInstancesInfoDialog from './PreviousInstancesDialog/PreviousInstancesInfoDialog.vue';
    import PreviousInstancesListDialog from './PreviousInstancesDialog/PreviousInstancesListDialog.vue';
    import UserDialog from './UserDialog/UserDialog.vue';
    import WorldDialog from './WorldDialog/WorldDialog.vue';
    import { clearDialogMotionOrigin, dialogMotionOrigin } from '@/services/dialogMotionOrigin';
    import { profileBackgrounds } from '@/shared/constants/backgrounds';

    const avatarStore = useAvatarStore();
    const groupStore = useGroupStore();
    const instanceStore = useInstanceStore();
    const uiStore = useUiStore();
    const userStore = useUserStore();
    const worldStore = useWorldStore();
    const appearanceSettingsStore = useAppearanceSettingsStore();

    const { previousInstancesInfoDialog, previousInstancesListDialog } = storeToRefs(instanceStore);

    const dialogCrumbs = computed(() => uiStore.dialogCrumbs);
    const activeType = computed(() => {
        const type = (() => {
            if (previousInstancesInfoDialog.value.visible) {
                return 'previous-instances-info';
            }
            if (previousInstancesListDialog.value.visible) {
                return `previous-instances-${previousInstancesListDialog.value.variant}`;
            }
            if (userStore.userDialog.visible) {
                return 'user';
            }
            if (worldStore.worldDialog.visible) {
                return 'world';
            }
            if (avatarStore.avatarDialog.visible) {
                return 'avatar';
            }
            if (groupStore.groupDialog.visible) {
                return 'group';
            }
            return null;
        })();
        return type;
    });
    const renderedType = ref(null);
    let closeTimer;
    const CLOSE_ANIMATION_DURATION = 220;

    watch(
        activeType,
        (type) => {
            if (type) {
                if (closeTimer) {
                    clearTimeout(closeTimer);
                    closeTimer = undefined;
                }
                renderedType.value = type;
                return;
            }

            if (!renderedType.value) {
                return;
            }

            // Dialogs opened through the existing coordinator path keep their
            // original immediate-unmount behaviour. Only a source-aware
            // opening needs the short retention window for its close motion.
            if (!dialogMotionOrigin.value) {
                renderedType.value = null;
                return;
            }

            closeTimer = setTimeout(() => {
                if (!activeType.value) {
                    renderedType.value = null;
                }
                closeTimer = undefined;
            }, CLOSE_ANIMATION_DURATION);
        },
        { immediate: true }
    );

    onBeforeUnmount(() => {
        if (closeTimer) {
            clearTimeout(closeTimer);
        }
        clearDialogMotionOrigin();
    });

    const effectiveType = computed(() => renderedType.value || activeType.value);
    const activeComponent = computed(() => {
        switch (effectiveType.value) {
            case 'user':
                return UserDialog;
            case 'world':
                return WorldDialog;
            case 'avatar':
                return AvatarDialog;
            case 'group':
                return GroupDialog;
            case 'previous-instances-info':
                return PreviousInstancesInfoDialog;
            case 'previous-instances-user':
                return PreviousInstancesListDialog;
            case 'previous-instances-user-created':
                return PreviousInstancesListDialog;
            case 'previous-instances-world':
                return PreviousInstancesListDialog;
            case 'previous-instances-group':
                return PreviousInstancesListDialog;
            default:
                return null;
        }
    });
    const activeComponentProps = computed(() => {
        switch (effectiveType.value) {
            case 'previous-instances-user':
                return { variant: 'user' };
            case 'previous-instances-user-created':
                return { variant: 'user-created' };
            case 'previous-instances-world':
                return { variant: 'world' };
            case 'previous-instances-group':
                return { variant: 'group' };
            default:
                return {};
        }
    });
    const isOpen = computed({
        get: () => activeType.value !== null,
        set: (value) => {
            if (!value) {
                uiStore.closeMainDialog();
            }
        }
    });

    const dialogMotionClass = computed(() => (dialogMotionOrigin.value ? 'dialog-origin-aware' : ''));
    const dialogMotionStyle = computed(() => {
        const origin = dialogMotionOrigin.value;
        if (!origin) {
            return undefined;
        }

        return {
            '--dialog-origin-x': `${origin.left + origin.width / 2}px`,
            '--dialog-origin-y': `${origin.top + origin.height / 2}px`
        };
    });

    const dialogProfileStyle = computed(() => {
        if (effectiveType.value !== 'user' || !appearanceSettingsStore.displayVRCProfileBackgrounds) {
            return {};
        }
        const profile = userStore.userDialog.publicProfileRef || {};
        const configuredOpacity = Number(appearanceSettingsStore.profileBackgroundOpacity);
        const opacity = Number.isFinite(configuredOpacity)
            ? Math.min(1, Math.max(0, configuredOpacity))
            : 0.5;
        const overlay = appearanceSettingsStore.isDarkMode
            ? `rgba(0, 0, 0, ${1 - opacity})`
            : `rgba(255, 255, 255, ${1 - opacity})`;
        const normalizeColor = (value) => {
            const normalized = String(value || '').replace(/^#/, '');
            return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : 'var(--background)';
        };
        if (profile.backgroundType === 'gradient') {
            return {
                overflow: 'hidden',
                backgroundClip: 'padding-box',
                backgroundImage: `linear-gradient(${overlay}, ${overlay}), linear-gradient(180deg, ${normalizeColor(profile.backgroundGradientTop)}, ${normalizeColor(profile.backgroundGradientBottom)})`
            };
        }
        if (profile.backgroundType === 'texture') {
            const background = profileBackgrounds.find((item) => item.id === profile.backgroundTextureId);
            if (background) {
                return {
                    overflow: 'hidden',
                    backgroundClip: 'padding-box',
                    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${background.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'top center',
                    backgroundRepeat: 'no-repeat'
                };
            }
        }
        return { overflow: 'hidden', backgroundClip: 'padding-box' };
    });

    watch(renderedType, (type) => {
        if (!type) {
            clearDialogMotionOrigin();
        }
    });

    const dialogClass = computed(() => {
        switch (effectiveType.value) {
            case 'world':
                return 'x-dialog main-entity-dialog sm:max-w-235 overflow-hidden flex flex-col';
            case 'avatar':
                return 'x-dialog main-entity-dialog sm:max-w-235 overflow-hidden flex flex-col';
            case 'group':
                return 'x-dialog main-entity-dialog group-main-dialog w-[calc(100vw-2rem)] sm:max-w-[60rem] overflow-hidden flex flex-col';
            case 'previous-instances-info':
            case 'previous-instances-user':
            case 'previous-instances-user-created':
            case 'previous-instances-world':
            case 'previous-instances-group':
                return 'x-dialog previous-instances-dialog h-[calc(100dvh-3rem)] sm:max-w-250 overflow-hidden flex flex-col';
            case 'user':
            default:
                return 'x-dialog main-entity-dialog sm:max-w-235 overflow-hidden flex flex-col';
        }
    });

    const shouldShowBreadcrumbs = computed(() => dialogCrumbs.value.length > 1);
    const shouldCollapseBreadcrumbs = computed(() => dialogCrumbs.value.length > 5);
    const middleBreadcrumbs = computed(() => {
        if (!shouldCollapseBreadcrumbs.value) {
            return [];
        }
        return dialogCrumbs.value.slice(1, -2);
    });
    const backCrumbLabel = computed(() => {
        if (dialogCrumbs.value.length < 2) {
            return '';
        }
        const backCrumb = dialogCrumbs.value[dialogCrumbs.value.length - 2];
        return backCrumb?.label || backCrumb?.id || '';
    });

    function handleBreadcrumbClick(index) {
        uiStore.handleBreadcrumbClick(index);
    }

    function handlePointerDownOutside(event) {
        const target = event.detail?.originalEvent?.target;
        if (target instanceof Element && target.closest('[data-main-dialog-interactive]')) {
            event.preventDefault();
        }
    }
</script>

<template>
    <Dialog v-if="renderedType" v-model:open="isOpen">
        <DialogContent
            :class="[dialogClass, dialogMotionClass]"
            :style="[dialogMotionStyle, dialogProfileStyle]"
            :show-close-button="false"
            @pointerDownOutside="handlePointerDownOutside">
            <Breadcrumb v-if="shouldShowBreadcrumbs" class="mb-2 flex-shrink-0">
                <BreadcrumbList>
                    <TooltipWrapper :content="backCrumbLabel" :disabled="!backCrumbLabel" :delayDuration="500">
                        <Button variant="ghost" size="icon-sm" @click="handleBreadcrumbClick(dialogCrumbs.length - 2)">
                            <ArrowLeft />
                            <span class="sr-only">{{ backCrumbLabel }}</span>
                        </Button>
                    </TooltipWrapper>
                    <template v-if="shouldCollapseBreadcrumbs">
                        <BreadcrumbItem>
                            <TooltipWrapper
                                :content="dialogCrumbs[0]?.label || dialogCrumbs[0]?.id"
                                :delayDuration="500">
                                <BreadcrumbLink as-child>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="max-w-40 justify-start truncate text-left"
                                        @click="handleBreadcrumbClick(0)">
                                        {{ dialogCrumbs[0]?.label || dialogCrumbs[0]?.id }}
                                    </Button>
                                </BreadcrumbLink>
                            </TooltipWrapper>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger class="flex items-center gap-1">
                                    <BreadcrumbEllipsis class="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem
                                        v-for="(crumb, index) in middleBreadcrumbs"
                                        :key="`${crumb.type}-${crumb.id}`"
                                        @click="handleBreadcrumbClick(index + 1)">
                                        {{ crumb.label || crumb.id }}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <TooltipWrapper
                                :content="
                                    dialogCrumbs[dialogCrumbs.length - 2]?.label ||
                                    dialogCrumbs[dialogCrumbs.length - 2]?.id
                                "
                                :delayDuration="500">
                                <BreadcrumbLink as-child>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        class="max-w-40 justify-start truncate text-left"
                                        @click="handleBreadcrumbClick(dialogCrumbs.length - 2)">
                                        {{
                                            dialogCrumbs[dialogCrumbs.length - 2]?.label ||
                                            dialogCrumbs[dialogCrumbs.length - 2]?.id
                                        }}
                                    </Button>
                                </BreadcrumbLink>
                            </TooltipWrapper>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage class="max-w-40 truncate">
                                {{
                                    dialogCrumbs[dialogCrumbs.length - 1]?.label ||
                                    dialogCrumbs[dialogCrumbs.length - 1]?.id
                                }}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </template>
                    <template v-else>
                        <template v-for="(crumb, index) in dialogCrumbs" :key="`${crumb.type}-${crumb.id}`">
                            <BreadcrumbItem>
                                <TooltipWrapper
                                    v-if="index < dialogCrumbs.length - 1"
                                    :content="crumb.label || crumb.id"
                                    :delayDuration="500">
                                    <BreadcrumbLink as-child>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="max-w-40 justify-start truncate text-left"
                                            @click="handleBreadcrumbClick(index)">
                                            {{ crumb.label || crumb.id }}
                                        </Button>
                                    </BreadcrumbLink>
                                </TooltipWrapper>
                                <BreadcrumbPage v-else class="max-w-40 truncate">
                                    {{ crumb.label || crumb.id }}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator v-if="index < dialogCrumbs.length - 1" />
                        </template>
                    </template>
                </BreadcrumbList>
            </Breadcrumb>

            <Transition name="dialog-panel" mode="out-in">
                <component
                    :is="activeComponent"
                    v-if="activeComponent"
                    v-bind="activeComponentProps"
                    :key="effectiveType" />
            </Transition>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
    :deep(.main-entity-dialog) {
        max-height: calc(100dvh - 3rem);
        border-color: color-mix(in oklch, var(--border) 78%, var(--foreground) 8%);
        box-shadow:
            0 24px 70px rgb(0 0 0 / 32%),
            0 4px 16px rgb(0 0 0 / 18%);
    }

    :deep(.group-main-dialog) {
        width: min(60rem, calc(100vw - 2rem));
    }

    :deep(.previous-instances-dialog) {
        max-height: calc(100dvh - 3rem);
        background: var(--background);
    }

    .dialog-panel-enter-active {
        transition:
            opacity 140ms ease-out,
            transform 160ms cubic-bezier(0.2, 0.75, 0.25, 1);
    }

    .dialog-panel-leave-active {
        transition:
            opacity 100ms ease-in,
            transform 120ms ease-in;
    }

    .dialog-panel-enter-from {
        opacity: 0;
        transform: translateY(6px);
    }

    .dialog-panel-leave-to {
        opacity: 0;
        transform: translateY(-4px);
    }

    @media (max-height: 42rem) {
        :deep(.main-entity-dialog) {
            max-height: calc(100dvh - 1.5rem);
        }

        :deep(.previous-instances-dialog) {
            height: calc(100dvh - 1.5rem);
            max-height: calc(100dvh - 1.5rem);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .dialog-panel-enter-active,
        .dialog-panel-leave-active {
            transition: opacity 80ms linear;
        }

        .dialog-panel-enter-from,
        .dialog-panel-leave-to {
            transform: none;
        }
    }
</style>
