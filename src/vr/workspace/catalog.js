const sections = {
    feed: ['动态与房间', '活动动态', 'ri-rss-line'],
    'friends-locations': ['动态与房间', '好友房间', 'ri-map-pin-line'],
    'game-log': ['动态与房间', '游戏日志', 'ri-file-list-line'],
    'player-list': ['动态与房间', '当前玩家', 'ri-team-line'],
    search: ['发现', '搜索用户、世界、模型和群组', 'ri-search-line'],
    'favorite-friends': ['社交与收藏', '星标好友', 'ri-user-star-line'],
    'favorite-worlds': ['社交与收藏', '收藏的世界', 'ri-earth-line'],
    'favorite-avatars': ['社交与收藏', '收藏的模型', 'ri-star-line'],
    'friend-log': ['社交与收藏', '好友日志', 'ri-contacts-book-line'],
    'friend-list': ['社交与收藏', '好友列表', 'ri-group-line'],
    moderation: ['社交与收藏', '玩家管理', 'ri-shield-user-line'],
    notification: ['社交与收藏', '通知中心', 'ri-notification-line'],
    'my-avatars': ['发现', '我的模型', 'ri-user-settings-line'],
    'charts-instance': ['图表与记录', '房间活动', 'ri-history-line'],
    'charts-mutual': ['图表与记录', '共同好友', 'ri-group-line'],
    'charts-hot-worlds': ['图表与记录', '热门世界', 'ri-fire-line'],
    'charts-two-person': ['图表与记录', '双人关系', 'ri-links-line'],
    'charts-timeline': ['图表与记录', '关系时间线', 'ri-time-line'],
    tools: ['工具与设置', '全部工具', 'ri-tools-line'],
    gallery: ['工具与设置', '照片图库', 'ri-image-line'],
    'screenshot-metadata': ['工具与设置', '截图信息', 'ri-file-info-line'],
    settings: ['工具与设置', '全部设置', 'ri-settings-3-line']
};

/** Derive entries from the actual router so future pages cannot silently disappear in VR. */
export function buildVrWorkspaceCatalog(routes, dashboards = []) {
    const entries = [];
    for (const route of routes) {
        if (
            !route.name ||
            route.name === 'login' ||
            route.redirect ||
            route.children?.length
        )
            continue;
        if (route.name === 'dashboard') {
            for (const dashboard of dashboards)
                entries.push({
                    id: `dashboard-${dashboard.id}`,
                    section: '自定义面板',
                    label: dashboard.name,
                    icon: dashboard.icon || 'ri-dashboard-line',
                    to: { name: 'dashboard', params: { id: dashboard.id } }
                });
            continue;
        }
        if (route.path?.includes(':')) continue;
        const [section, label, icon] = sections[route.name] || [
            '其他功能',
            String(route.meta?.title || route.name),
            'ri-apps-line'
        ];
        entries.push({
            id: route.name,
            section,
            label,
            icon,
            to: { name: route.name }
        });
    }
    return entries;
}
