<template>
    <div class="absolute inset-0 flex flex-col items-center overflow-y-auto px-4 pt-12">
        <div class="absolute top-0 left-0 m-1.5">
            <LoginSettingsDialog />
            <TooltipWrapper v-if="!noUpdater" side="top" :content="t('view.login.updater')">
                <Button class="rounded-full mr-2 text-xs" size="icon-sm" variant="ghost" @click="showVRCXUpdateDialog">
                    <span class="relative inline-flex items-center justify-center">
                        <ArrowBigDownDash />
                        <span
                            v-if="pendingVRCXUpdate"
                            class="absolute -top-0.5 -right-1 h-1.5 w-1.5 rounded-full bg-red-500"></span>
                    </span>
                </Button>
            </TooltipWrapper>
            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <TooltipWrapper side="top" :content="t('view.login.language')">
                        <Button class="rounded-full text-xs" size="icon-sm" variant="ghost">
                            <Languages />
                        </Button>
                    </TooltipWrapper>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="max-h-80 overflow-y-auto text-xs">
                    <DropdownMenuCheckboxItem
                        v-for="language in languageCodes"
                        :key="language"
                        :model-value="appLanguage === language"
                        @select="changeAppLanguage(language)">
                        {{ getLanguageName(language) }}
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <div class="my-auto flex w-full max-w-sm flex-col" :class="{ 'sm:max-w-3xl': hasSavedCredentials }">
            <Alert
                v-if="vrcStatusStore.hasIssue"
                :variant="vrcStatusStore.isMajor ? 'destructive' : 'warning'"
                class="cursor-pointer mb-3 hover:opacity-80 transition-opacity"
                @click="vrcStatusStore.openStatusPage()">
                <TriangleAlert class="size-4" />
                <AlertTitle class="truncate">{{ t('status_bar.servers_issue') }}</AlertTitle>
                <AlertDescription class="truncate">
                    {{ vrcStatusStore.statusText }}
                </AlertDescription>
            </Alert>
            <div class="flex flex-col gap-2 sm:flex-row">
                <div class="flex min-w-0 flex-col p-4 sm:flex-1">
                    <h2 class="mb-4 text-center text-lg font-semibold">{{ t('view.login.login') }}</h2>
                    <QrLogin v-model:active="qrActive">
                        <form id="login-form" @submit.prevent="onSubmit">
                            <FieldGroup v-show="!qrActive" class="gap-3">
                                <VeeField v-slot="{ field, errors }" name="username">
                                    <Field :data-invalid="!!errors.length">
                                        <FieldLabel for="login-form-username" class="text-foreground">
                                            {{ t('view.login.field.username') }}
                                        </FieldLabel>
                                        <FieldContent>
                                            <InputGroupField
                                                id="login-form-username"
                                                input-class="text-sm"
                                                :model-value="field.value"
                                                autocomplete="off"
                                                name="username"
                                                :placeholder="t('view.login.field.username')"
                                                :aria-invalid="!!errors.length"
                                                @update:modelValue="field.onChange"
                                                @blur="field.onBlur" />
                                            <FieldError v-if="errors.length" :errors="errors" />
                                        </FieldContent>
                                    </Field>
                                </VeeField>
                                <VeeField v-slot="{ field, errors, handleChange }" name="password">
                                    <Field :data-invalid="!!errors.length">
                                        <FieldLabel for="login-form-password" class="text-foreground">
                                            {{ t('view.login.field.password') }}
                                        </FieldLabel>
                                        <FieldContent>
                                            <InputGroupField
                                                id="login-form-password"
                                                input-class="text-sm"
                                                :model-value="field.value"
                                                type="password"
                                                autocomplete="off"
                                                name="password"
                                                :placeholder="t('view.login.field.password')"
                                                :aria-invalid="!!errors.length"
                                                show-password
                                                @keydown.delete="handleChange('', false)"
                                                @update:modelValue="field.onChange"
                                                @blur="field.onBlur" />
                                            <FieldError v-if="errors.length" :errors="errors" />
                                        </FieldContent>
                                    </Field>
                                </VeeField>
                            </FieldGroup>
                            <div class="mt-3 flex items-center justify-between gap-2 text-sm">
                                <label class="flex w-fit items-center gap-2">
                                    <Checkbox v-model="loginForm.saveCredentials" />
                                    <span>{{ t('view.login.field.saveCredentials') }}</span>
                                </label>
                                <ResetPasswordDialog />
                            </div>

                            <Button v-show="!qrActive" type="submit" size="lg" class="mt-4 w-full">{{
                                t('view.login.login')
                            }}</Button>
                        </form>
                    </QrLogin>
                    <Button
                        variant="outline"
                        size="lg"
                        class="mt-2 w-full"
                        @click="openExternalLink('https://vrchat.com/home/register')"
                        >{{ t('view.login.register') }}</Button
                    >
                </div>

                <div v-if="hasSavedCredentials" class="shrink-0 border-t sm:border-t-0 sm:border-l" />

                <div v-if="hasSavedCredentials" class="flex min-w-0 flex-col p-4 sm:flex-1">
                    <h2 class="mb-4 text-center text-lg font-semibold">
                        {{ t('view.login.savedAccounts') }}
                    </h2>
                    <div class="x-scroll-wrapper mt-2">
                        <div class="x-saved-account-list">
                            <Item
                                v-for="user in savedCredentials"
                                :key="user.user.id"
                                class="cursor-pointer hover:bg-muted p-2 border-0"
                                @click="clickSavedLogin(user)">
                                <ItemMedia @click.stop>
                                    <div class="flex items-center cursor-pointer" @click.stop>
                                        <button
                                            class="relative flex items-center justify-center size-5 mr-2 rounded-full border text-[10px] font-bold transition-all shrink-0"
                                            :class="
                                                getAccountOrderIndex(user.user.id) >= 0
                                                    ? 'border-transparent text-white'
                                                    : 'border-muted-foreground/40 text-muted-foreground hover:border-foreground'
                                            "
                                            :style="
                                                getAccountOrderIndex(user.user.id) >= 0
                                                    ? { background: getAccountBadgeColor(user.user.id) }
                                                    : {}
                                            "
                                            @click="toggleAccountSelection(user.user.id)">
                                            {{ getAccountBadgeLabel(user.user.id) }}
                                        </button>
                                        <Avatar class="rounded-full size-10">
                                            <AvatarImage :src="savedAccountImage(user.user)" />
                                            <AvatarFallback>
                                                <User class="size-5 text-muted-foreground" />
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                </ItemMedia>
                                <ItemContent class="min-w-0">
                                    <ItemTitle class="truncate max-w-full">{{ user.user.displayName }}</ItemTitle>
                                    <ItemDescription class="truncate text-xs!">
                                        {{ user.user.username }}
                                    </ItemDescription>
                                    <ItemDescription v-if="user.loginParams.endpoint" class="truncate text-xs!">
                                        {{ user.loginParams.endpoint }}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions @click.stop>
                                    <TotpSettingsDialog
                                        v-if="user.loginParams.username"
                                        :username="user.loginParams.username"
                                        :endpoint="user.loginParams.endpoint || AppDebug.endpointDomainVrchat"
                                        :account-label="user.user.displayName" />
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        class="cursor-pointer rounded-full"
                                        @click="clickDeleteSavedLogin(user.user.id)"
                                        ><Trash2 class="text-sm"
                                    /></Button>
                                </ItemActions>
                            </Item>
                        </div>
                    </div>
                    <Button
                        v-if="selectedAccountOrder.length >= 2"
                        variant="outline"
                        size="sm"
                        class="w-full mt-2"
                        :disabled="multiLoginLoading"
                        @click="clickMultiLogin">
                        {{ t('view.login.loginSelected', { count: selectedAccountOrder.length }) }}
                    </Button>
                </div>
            </div>
        </div>

        <div
            class="x-legal-notice-container flex max-w-3xl flex-col gap-1 pt-12 pb-8 text-center text-xs text-muted-foreground">
            <p>
                &copy; 2019-2026
                <a
                    class="cursor-pointer text-foreground hover:underline"
                    @click="openExternalLink('https://github.com/pypy-vrc')"
                    >pypy</a
                >
                &amp;
                <a
                    class="cursor-pointer text-foreground hover:underline"
                    @click="openExternalLink('https://github.com/Natsumi-sama')"
                    >Natsumi</a
                >
                &amp;
                <a
                    class="cursor-pointer text-foreground hover:underline"
                    @click="openExternalLink('https://github.com/Map1en')"
                    >Map1en</a
                >
            </p>
            <p>{{ t('view.settings.general.legal_notice.info') }}</p>
            <p>{{ t('view.settings.general.legal_notice.disclaimer1') }}</p>
            <p>{{ t('view.settings.general.legal_notice.disclaimer2') }}</p>
        </div>
    </div>
</template>

<script setup>
    import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
    import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
    import {
        DropdownMenu,
        DropdownMenuCheckboxItem,
        DropdownMenuContent,
        DropdownMenuTrigger
    } from '@/components/ui/dropdown-menu';
    import { onBeforeMount, onBeforeUnmount, reactive, ref, watch, computed } from 'vue';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
    import { ArrowBigDownDash, Languages, Trash2, TriangleAlert, User } from 'lucide-vue-next';
    import { Field as VeeField, useForm } from 'vee-validate';
    import { useRoute, useRouter } from 'vue-router';
    import { Button } from '@/components/ui/button';
    import { Checkbox } from '@/components/ui/checkbox';
    import { InputGroupField } from '@/components/ui/input-group';
    import { storeToRefs } from 'pinia';
    import { toTypedSchema } from '@vee-validate/zod';
    import { useI18n } from 'vue-i18n';
    import { z } from 'zod';
    import {
        useAppearanceSettingsStore,
        useAuthStore,
        useModalStore,
        useVrcStatusStore,
        useVRCXUpdaterStore
    } from '../../stores';
    import { getLanguageName, languageCodes, resolveSystemLanguage } from '../../localization';
    import { tForLocale } from '../../plugins';
    import { openExternalLink } from '../../shared/utils';
    import configRepository from '../../services/config';
    import { useUserDisplay } from '../../composables/useUserDisplay';
    import { watchState } from '../../services/watchState';
    import { accountHub } from '../../services/accountHub.js';
    import LoginSettingsDialog from './Dialog/LoginSettingsDialog.vue';
    import ResetPasswordDialog from './Dialog/ResetPasswordDialog.vue';
    import TotpSettingsDialog from './Dialog/TotpSettingsDialog.vue';
    import { AppDebug } from '../../services/appConfig';
    import QrLogin from './components/QrLogin.vue';
    const { userImage } = useUserDisplay();
    const { showVRCXUpdateDialog } = useVRCXUpdaterStore();
    const router = useRouter();
    const route = useRoute();
    const { loginForm } = storeToRefs(useAuthStore());
    const { relogin, deleteSavedLogin, login, getAllSavedCredentials } = useAuthStore();
    const { noUpdater, pendingVRCXUpdate } = storeToRefs(useVRCXUpdaterStore());

    const appearanceSettingsStore = useAppearanceSettingsStore();
    const { appLanguage } = storeToRefs(appearanceSettingsStore);
    const { changeAppLanguage } = appearanceSettingsStore;
    const modalStore = useModalStore();

    const vrcStatusStore = useVrcStatusStore();

    const { t } = useI18n();

    const savedCredentials = ref({});
    const hasSavedCredentials = computed(() => Object.keys(savedCredentials.value).length !== 0);
    const qrActive = ref(false);
    const requiredMessage = 'Required';
    /** Ordered list of selected account user IDs. Index 0 = primary. */
    const selectedAccountOrder = ref([]);
    const multiLoginLoading = ref(false);

    const formSchema = toTypedSchema(
        z.object({
            username: z.string().min(1, requiredMessage),
            password: z.string().min(1, requiredMessage)
        })
    );

    const { handleSubmit, resetForm, values } = useForm({
        validationSchema: formSchema,
        initialValues: {
            username: loginForm.value.username,
            password: loginForm.value.password
        }
    });

    watch(qrActive, (active) => {
        if (active) {
            resetForm({ values: { username: '', password: '' } });
        }
    });

    /**
     *
     * @param userId
     */
    async function clickDeleteSavedLogin(userId) {
        await deleteSavedLogin(userId);
        await updateSavedCredentials();
    }

    /**
     *
     * @param user
     */
    async function clickSavedLogin(user) {
        try {
            await relogin(user);
        } catch {
            // relogin already handles user-facing error display (toast)
        }
        await updateSavedCredentials();
    }

    // ── Multi-account ordered selection ──────────────────────────────────────────

    const BADGE_COLOURS = ['#4ade80', '#60a5fa', '#fb923c', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];

    /**
     * Toggle selection of an account for multi-login.
     * Maintains insertion order — first selected = primary.
     * @param {string} userId
     */
    function toggleAccountSelection(userId) {
        const idx = selectedAccountOrder.value.indexOf(userId);
        if (idx >= 0) {
            selectedAccountOrder.value = selectedAccountOrder.value.filter((id) => id !== userId);
        } else {
            selectedAccountOrder.value = [...selectedAccountOrder.value, userId];
        }
    }

    function getAccountOrderIndex(userId) {
        return selectedAccountOrder.value.indexOf(userId);
    }

    function getAccountBadgeLabel(userId) {
        const idx = getAccountOrderIndex(userId);
        if (idx < 0) return '';
        if (idx === 0) return '主';
        return String(idx);
    }

    function getAccountBadgeColor(userId) {
        const idx = getAccountOrderIndex(userId);
        if (idx < 0) return '#888';
        return BADGE_COLOURS[idx % BADGE_COLOURS.length];
    }

    function savedAccountImage(user) {
        if (!user) return '';
        return (
            user.userIcon ||
            user.profilePicOverrideThumbnail ||
            user.profilePicOverride ||
            user.thumbnailUrl ||
            user.currentAvatarThumbnailImageUrl ||
            user.currentAvatarImageUrl ||
            ''
        );
    }

    /**
     * Log in the first selected account normally, then add the rest as secondary sessions.
     */
    async function clickMultiLogin() {
        if (selectedAccountOrder.value.length < 2) return;
        multiLoginLoading.value = true;
        try {
            const creds = Object.values(savedCredentials.value);
            const [primaryId, ...secondaryIds] = selectedAccountOrder.value;
            const primaryEntry = creds.find((c) => c.user.id === primaryId);
            if (!primaryEntry) return;

            // Login primary account the normal way
            await relogin(primaryEntry);
            if (!watchState.isLoggedIn) return;

            // Login secondary accounts via accountHub
            for (const secId of secondaryIds) {
                const secEntry = creds.find((c) => c.user.id === secId);
                if (secEntry) {
                    try {
                        await accountHub.addSession(secEntry);
                    } catch (e) {
                        console.warn('[MultiLogin] Failed to add secondary session:', secId, e);
                    }
                }
            }

            if (accountHub.hasSecondarySessions) {
                accountHub.switchToMerged();
            }
        } finally {
            multiLoginLoading.value = false;
        }
    }

    const onSubmit = handleSubmit(async (formValues) => {
        loginForm.value.username = formValues.username ?? '';
        loginForm.value.password = formValues.password ?? '';
        await login();
        await updateSavedCredentials();
    });

    /**
     *
     */
    async function updateSavedCredentials() {
        savedCredentials.value = await getAllSavedCredentials();
    }

    /**
     *
     */
    function postLoginRedirect() {
        const redirect = route.query.redirect;
        if (typeof redirect === 'string' && redirect.startsWith('/') && redirect !== '/login') {
            return redirect;
        }
        return '/feed';
    }

    watch(
        () => watchState.isLoggedIn,
        (isLoggedIn) => {
            if (isLoggedIn) {
                router.replace(postLoginRedirect());
            }
        }
    );

    watch(
        () => loginForm.value.loading,
        (loading) => {
            if (!loading) {
                updateSavedCredentials();
            }
        }
    );
    let isActive = true;
    let isLanguagePromptOpen = false;

    async function detectAndPromptLanguage() {
        try {
            const savedLanguage = await configRepository.getString('VRCX_appLanguage');
            if (savedLanguage || !isActive) return;

            const systemLanguage = await AppApi.CurrentLanguage();
            if (!systemLanguage || !isActive) return;

            const matchedCode = resolveSystemLanguage(systemLanguage, languageCodes);

            if (!matchedCode || matchedCode === 'en') {
                if (isActive) await changeAppLanguage('en');
                return;
            }

            const languageName = getLanguageName(matchedCode);
            const [promptTitle, promptDescription, promptConfirmText, promptCancelText] = await Promise.all([
                tForLocale(matchedCode, 'view.login.language_detect.title'),
                tForLocale(matchedCode, 'view.login.language_detect.description', {
                    language: languageName
                }),
                tForLocale(matchedCode, 'dialog.alertdialog.confirm'),
                tForLocale(matchedCode, 'dialog.alertdialog.cancel')
            ]);

            isLanguagePromptOpen = true;
            const { ok } = await modalStore.confirm({
                title: promptTitle,
                description: promptDescription,
                confirmText: promptConfirmText,
                cancelText: promptCancelText
            });
            isLanguagePromptOpen = false;

            if (!isActive) return;

            // Re-check: user may have manually switched language while the dialog was open
            const currentLanguage = await configRepository.getString('VRCX_appLanguage');
            if (currentLanguage || !isActive) return;

            if (ok) {
                await changeAppLanguage(matchedCode);
            } else {
                await changeAppLanguage('en');
            }
        } catch (error) {
            isLanguagePromptOpen = false;
            console.error('Language detection failed:', error);
        }
    }

    onBeforeMount(async () => {
        await updateSavedCredentials();
        detectAndPromptLanguage();
    });

    onBeforeUnmount(() => {
        isActive = false;
        if (isLanguagePromptOpen) {
            modalStore.handleCancel();
            isLanguagePromptOpen = false;
        }
        resetForm({
            values: {
                username: '',
                password: ''
            }
        });
        loginForm.value.username = '';
        loginForm.value.password = '';
        loginForm.value.endpoint = '';
        loginForm.value.websocket = '';
        savedCredentials.value = {};
    });

    watch(
        values,
        (formValues) => {
            loginForm.value.username = formValues.username ?? '';
            loginForm.value.password = formValues.password ?? '';
        },
        { deep: true }
    );
</script>
