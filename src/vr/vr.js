import { createApp } from 'vue';

import { i18n } from '../plugins/i18n';
import { initPlugins } from '../plugins';

import Vr from './Vr.vue';
import {
    createWristPointerDesktopTestApi,
    isWristPointerDesktopTestEnabled
} from './wristPointerDesktopTest';

if (isWristPointerDesktopTestEnabled()) {
    window.__VRCX_WRIST_POINTER_DESKTOP_TEST__ = true;
    window.AppApiVr = createWristPointerDesktopTestApi();
    window.SQLite = {
        Execute: async () => [],
        ExecuteJson: async () => '[]',
        ExecuteNonQuery: async () => 0
    };
    document.documentElement.style.backgroundColor = '#18181b';
    document.body.style.backgroundColor = '#18181b';
}

await initPlugins(true);

const vr = createApp(Vr);
vr.use(i18n);

vr.mount('#root');
