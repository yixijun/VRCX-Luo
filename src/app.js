import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';

import {
    i18n,
    initComponents,
    initPlugins,
    initRouter,
    initSentry
} from './plugins';
import { initPiniaPlugins, pinia } from './stores';
import { queryClient } from './queries';
import { initAccountHubWatcher } from './services/accountHub.js';
import { initRemoteAccessBridge } from './services/remoteAccessBridge.js';
import { initRemoteAccessOnStartup } from './services/remoteAccessStartup.js';

import App from './App.vue';

await initPlugins();
await initPiniaPlugins();

// #region | Hey look it's most of VRCX!

const app = createApp(App);

app.use(pinia).use(i18n).use(VueQueryPlugin, { queryClient });
initComponents(app);
initRouter(app);
await initSentry(app);

// Initialise multi-account hub watcher (after Pinia is up)
initAccountHubWatcher();
initRemoteAccessBridge();
await initRemoteAccessOnStartup();

app.mount('#root');
