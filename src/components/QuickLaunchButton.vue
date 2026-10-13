<template>
    <Teleport v-if="teleportTarget" :to="teleportTarget">
        <div :style="wrapperStyle">
            <QuickLaunchMenu />
        </div>
    </Teleport>

    <div v-else :style="wrapperStyle">
        <QuickLaunchMenu />
    </div>
</template>

<script setup>
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuLabel,
        DropdownMenuSeparator,
        DropdownMenuTrigger
    } from '@/components/ui/dropdown-menu';
    import { CirclePlay, Headset, Loader2, Monitor, Rocket } from 'lucide-vue-next';
    import { Button } from '@/components/ui/button';
    import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import { toast } from 'vue-sonner';
    import { useI18n } from 'vue-i18n';

    import { useGameStore, useLaunchStore, useModalStore } from '@/stores';
    import { STEAMVR_START_STATUS, waitForSteamVRRunning } from '@/shared/utils/steamvrStartup.js';

    const props = defineProps({
        target: { type: [String, Object], default: null },
        bottom: { type: Number, default: 20 },
        right: { type: Number, default: 20 },
        raisedBottom: { type: Number, default: 68 },
        visibilityHeight: { type: Number, default: 400 },
        teleport: { type: Boolean, default: true },
        teleportTo: { type: [Boolean, String, Object], default: null }
    });

    const { t } = useI18n();
    const gameStore = useGameStore();
    const launchStore = useLaunchStore();
    const modalStore = useModalStore();

    const isLaunching = ref(false);
    const isRaised = ref(false);
    let containerEl = null;
    let activeSteamVRWait = null;

    const QuickLaunchMenu = defineComponent({
        name: 'QuickLaunchMenu',
        setup() {
            return () =>
                h(DropdownMenu, null, {
                    default: () => [
                        h(
                            DropdownMenuTrigger,
                            { asChild: true },
                            {
                                default: () =>
                                    h(
                                        Button,
                                        {
                                            'data-testid': 'quick-launch-button',
                                            size: 'icon',
                                            variant: 'secondary',
                                            class: 'h-9 w-9 rounded-full p-0 shadow',
                                            title: t('quick_launch.tooltip'),
                                            disabled: isLaunching.value
                                        },
                                        {
                                            default: () =>
                                                isLaunching.value
                                                    ? h(Loader2, { class: 'h-4 w-4 animate-spin' })
                                                    : h(Rocket, { class: 'h-4 w-4' })
                                        }
                                    )
                            }
                        ),
                        h(
                            DropdownMenuContent,
                            { align: 'end', side: 'top', class: 'w-52' },
                            {
                                default: () => [
                                    h(DropdownMenuLabel, null, () => t('quick_launch.header')),
                                    h(DropdownMenuSeparator),
                                    h(DropdownMenuItem, { onClick: launchDesktop }, () => [
                                        h(Monitor, { class: 'size-4' }),
                                        t('quick_launch.vrchat_desktop')
                                    ]),
                                    h(DropdownMenuItem, { onClick: launchVr }, () => [
                                        h(Headset, { class: 'size-4' }),
                                        t('quick_launch.vrchat_vr')
                                    ]),
                                    h(DropdownMenuItem, { onClick: startSteamVR }, () => [
                                        h(CirclePlay, { class: 'size-4' }),
                                        t('quick_launch.steamvr')
                                    ])
                                ]
                            }
                        )
                    ]
                });
        }
    });

    function resolveElement(target) {
        if (!target) return null;
        if (typeof target === 'string') return document.querySelector(target);
        if (typeof target === 'object') {
            if ('value' in target) return target.value;
            if ('$el' in target) return target.$el;
        }
        return target;
    }

    function getScrollTop() {
        if (!containerEl || typeof containerEl.scrollTop !== 'number') {
            return window.scrollY || document.documentElement.scrollTop || 0;
        }
        return containerEl.scrollTop || 0;
    }

    function handleScroll() {
        isRaised.value = getScrollTop() >= props.visibilityHeight;
    }

    function bind() {
        containerEl = resolveElement(props.target);
        const target = containerEl && typeof containerEl.addEventListener === 'function' ? containerEl : window;
        target.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
    }

    function unbind() {
        const target = containerEl || window;
        target.removeEventListener('scroll', handleScroll);
    }

    onMounted(() => {
        bind();
    });

    watch(
        () => props.target,
        () => {
            unbind();
            bind();
        }
    );

    onBeforeUnmount(() => {
        activeSteamVRWait?.cancel();
        unbind();
    });

    const teleportTarget = computed(() => {
        if (props.teleportTo !== null && props.teleportTo !== undefined) {
            if (props.teleportTo === true) return 'body';
            if (props.teleportTo === false) return null;
            return resolveElement(props.teleportTo);
        }
        return props.teleport ? 'body' : null;
    });

    const isBodyTeleport = computed(() => teleportTarget.value === 'body' || teleportTarget.value === document.body);
    const currentBottom = computed(() => (isRaised.value ? props.raisedBottom : props.bottom));

    const wrapperStyle = computed(() => {
        if (isBodyTeleport.value) {
            return `position:fixed; right:${props.right}px; bottom:${currentBottom.value}px; z-index:50; pointer-events:auto; transition: bottom 160ms ease, transform 160ms ease, opacity 160ms ease;`;
        }
        return `position:absolute; right:${props.right}px; bottom:${currentBottom.value}px; z-index:50; pointer-events:auto; transition: bottom 160ms ease, transform 160ms ease, opacity 160ms ease;`;
    });

    async function refreshSteamVRState() {
        try {
            const running = await AppApi.IsSteamVRRunning();
            gameStore.setIsSteamVRRunning?.(running);
            return running;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    function showSteamVRTimeout(retry) {
        toast.error(t('quick_launch.steamvr_timeout'), {
            action: {
                label: t('quick_launch.retry'),
                onClick: () => {
                    void retry?.();
                }
            }
        });
    }

    async function runSteamVRStart({ retry } = {}) {
        try {
            const currentState = await refreshSteamVRState();
            if (currentState === null) {
                toast.error(t('quick_launch.steamvr_detection_failed'));
                return false;
            }
            if (currentState) {
                toast.success(t('quick_launch.steamvr_running'));
                return true;
            }
            const started = await AppApi.StartSteamVR();
            if (!started) {
                toast.error(t('message.launch.steamvr_not_found'));
                return false;
            }
            toast.info(t('quick_launch.steamvr_starting'));
            activeSteamVRWait = waitForSteamVRRunning({
                checkRunning: async () => {
                    const running = await refreshSteamVRState();
                    if (running === null) {
                        throw new Error('Unable to detect SteamVR state');
                    }
                    return running;
                }
            });
            const result = await activeSteamVRWait.promise;
            activeSteamVRWait = null;
            if (result.status === STEAMVR_START_STATUS.RUNNING) {
                toast.success(t('quick_launch.steamvr_detected'));
                return true;
            }
            if (result.status === STEAMVR_START_STATUS.TIMEOUT) {
                showSteamVRTimeout(retry);
                return false;
            }
            if (result.status === STEAMVR_START_STATUS.CANCELLED) {
                return false;
            }
            toast.error(t('quick_launch.steamvr_detection_failed'));
            return false;
        } catch (error) {
            console.error(error);
            toast.error(t('quick_launch.steamvr_failed'));
            return false;
        }
    }

    async function startSteamVR() {
        if (isLaunching.value) {
            return false;
        }
        isLaunching.value = true;
        try {
            return await runSteamVRStart({ retry: startSteamVR });
        } finally {
            isLaunching.value = false;
        }
    }

    async function ensureSteamVRForVrLaunch(retry) {
        const currentState = await refreshSteamVRState();
        if (currentState === true) {
            return true;
        }
        if (currentState === null) {
            toast.error(t('quick_launch.steamvr_detection_failed'));
            return false;
        }
        const { ok, reason } = await modalStore.confirm({
            description: t('dialog.launch.steamvr_not_running_warning'),
            title: t('dialog.launch.steamvr_not_running_title'),
            confirmText: t('dialog.launch.open_steamvr'),
            cancelText: t('dialog.launch.confirm_no')
        });
        if (!ok) {
            return reason === 'cancel';
        }
        return runSteamVRStart({ retry });
    }

    async function launchDesktop() {
        if (isLaunching.value) {
            return;
        }
        isLaunching.value = true;
        try {
            await launchStore.launchVRChat(true);
        } finally {
            isLaunching.value = false;
        }
    }

    async function launchVr() {
        if (isLaunching.value) {
            return;
        }
        isLaunching.value = true;
        try {
            if (!(await ensureSteamVRForVrLaunch(launchVr))) {
                return;
            }
            await launchStore.launchVRChat(false);
        } finally {
            isLaunching.value = false;
        }
    }
</script>
