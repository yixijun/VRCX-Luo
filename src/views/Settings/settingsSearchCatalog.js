/**
 * Stable, user-facing index for settings discovery.
 * Keep this list about navigation only: it must not read or mutate setting values.
 */
export const settingsSearchCatalog = Object.freeze([
    {
        id: 'font-family',
        tab: 'interface',
        labelKey: 'view.settings.appearance.appearance.font_family',
        groupKey: 'view.settings.appearance.appearance.header',
        aliases: ['font', '字体', '字型', 'typeface']
    },
    {
        id: 'profile-themes',
        tab: 'interface',
        labelKey: 'view.settings.appearance.appearance.vrc_profile_themes',
        groupKey: 'view.settings.appearance.appearance.header',
        aliases: ['theme', 'profile theme', '主题', '个人资料主题']
    },
    {
        id: 'close-window-action',
        tab: 'interface',
        labelKey: 'view.settings.interface.window_behavior.close_button',
        groupKey: 'view.settings.interface.window_behavior.header',
        aliases: ['close window', 'tray', 'quit', '关闭窗口', '托盘'],
        availability: { excludeMacOS: true }
    },
    {
        id: 'table-page-sizes',
        tab: 'interface',
        labelKey: 'view.settings.appearance.appearance.table_page_sizes',
        groupKey: 'view.settings.interface.lists_tables.header',
        aliases: ['density', 'compact', 'table size', '密度', '紧凑', '分页']
    },
    {
        id: 'desktop-notifications',
        tab: 'notifications',
        labelKey:
            'view.settings.notifications.notifications.desktop_notifications.enabled',
        groupKey:
            'view.settings.notifications.notifications.desktop_notifications.header',
        aliases: [
            'notification',
            'notifications',
            'desktop alert',
            '通知',
            '桌面通知'
        ]
    },
    {
        id: 'notification-sound',
        tab: 'notifications',
        labelKey:
            'view.settings.notifications.notifications.desktop_notifications.custom_sound',
        groupKey:
            'view.settings.notifications.notifications.desktop_notifications.header',
        aliases: ['sound', 'audio', 'test sound', '声音', '音效']
    },
    {
        id: 'steamvr-overlay',
        tab: 'vr',
        labelKey:
            'view.settings.notifications.notifications.steamvr_notifications.steamvr_overlay',
        groupKey: 'view.settings.vr.vr_core.header',
        aliases: ['vr overlay', 'steamvr', 'wayvr', 'overlay', '叠加层', '腕部']
    },
    {
        id: 'steamvr-dashboard',
        tab: 'vr',
        labelKey: 'view.settings.vr.vr_core.dashboard',
        groupKey: 'view.settings.vr.vr_core.header',
        aliases: [
            'steamvr dashboard',
            'steamvr panel',
            'VR 工作区',
            '底部菜单',
            'SteamVR 面板'
        ]
    },
    {
        id: 'wrist-feed-overlay',
        tab: 'vr',
        labelKey:
            'view.settings.wrist_overlay.steamvr_wrist_overlay.wrist_feed_overlay',
        groupKey: 'view.settings.wrist_overlay.steamvr_wrist_overlay.header',
        aliases: ['wrist', 'wrist overlay', '手腕', '腕部界面']
    },
    {
        id: 'proxy-settings',
        tab: 'system',
        labelKey: 'view.settings.general.application.proxy',
        groupKey: 'view.settings.general.application.header',
        aliases: ['network', 'http proxy', '代理', '网络']
    }
]);

export function isSettingsSearchEntryAvailable(entry, environment = {}) {
    if (entry?.availability?.excludeMacOS && environment.isMacOS) {
        return false;
    }
    if (entry?.availability?.excludeLinux && environment.isLinux) {
        return false;
    }
    return true;
}

export function searchSettingsCatalog(
    catalog,
    query,
    translate = (key) => key,
    environment
) {
    const normalizedQuery = String(query || '')
        .trim()
        .toLocaleLowerCase();
    if (!normalizedQuery) {
        return [];
    }

    return catalog
        .filter((entry) => isSettingsSearchEntryAvailable(entry, environment))
        .map((entry) => {
            const label = translate(entry.labelKey);
            const group = translate(entry.groupKey);
            const searchableText = [label, group, ...(entry.aliases || [])]
                .join(' ')
                .toLocaleLowerCase();
            return { ...entry, label, group, searchableText };
        })
        .filter((entry) => entry.searchableText.includes(normalizedQuery));
}
