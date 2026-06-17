import './remote.css';
import logoUrl from '../../images/VRCX.png';
import { photonEmojis } from '../shared/constants/photon.js';
import {
    buildVisibleFriendSections,
    clampFriendSectionHeight,
    friendStateTone
} from './remoteFriendSections.js';
import {
    canRequestBrowserNotificationPermission,
    collectFreshNotifications,
    getBrowserNotificationState
} from './remoteNotifications.js';
import {
    getSubmenuDirection,
    shouldCloseContextMenu
} from './remoteContextMenu.js';

const TOKEN_KEY = 'vrcxRemoteToken';
const FRIEND_SECTION_HEIGHTS_KEY = 'vrcxRemoteFriendSectionHeights';

const state = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    snapshot: null,
    socket: null,
    selectedFriendId: '',
    view: 'feed',
    status: 'disconnected',
    error: '',
    busyAction: '',
    searchText: '',
    friendSearchText: '',
    feedSearchText: '',
    feedFilter: 'all',
    statusDescriptionDraft: '',
    statusDescriptionUserId: '',
    contextMenu: null,
    toasts: [],
    knownNotificationIds: new Set(),
    notificationSnapshotReady: false,
    notificationPermissionRequesting: false,
    notificationUnavailableNotified: false,
    friendSectionHeights: loadFriendSectionHeights()
};

const root = document.getElementById('root');
document.documentElement.classList.add('dark');

const navItems = [
    ['feed', '好友动态', 'ri-rss-line'],
    ['friends', '好友位置', 'ri-user-heart-line'],
    ['logs', '游戏日志', 'ri-history-line'],
    ['instances', '房间玩家列表', 'ri-group-line'],
    ['search', '搜索', 'ri-search-line'],
    ['favorites', '收藏&星标', 'ri-star-line'],
    ['notifications', '通知', 'ri-notification-3-line'],
    ['avatars', '我的模型', 'ri-shirt-line']
];

const feedFilters = [
    ['all', '所有'],
    ['location', '位置变动'],
    ['online', '上线'],
    ['offline', '下线'],
    ['status', '状态变动'],
    ['avatar', '模型变动'],
    ['profile', '简介变更']
];

const statusOptions = [
    ['active', '在线'],
    ['join me', '欢迎加入'],
    ['ask me', '需要询问'],
    ['busy', '请勿打扰']
];

const ACTION_SUCCESS_MESSAGES = {
    'user.setStatus': '状态已更新',
    'user.open': '已在主程序打开资料',
    'friend.requestInvite': '请求邀请已发送',
    'friend.selfInvite': '自我邀请已发送',
    'instance.open': '已打开加入界面',
    'instance.launch': '已发送启动加入指令',
    'ui.clearNotificationCenter': '通知中心已清理',
    'notification.see': '通知已标记已读',
    'notification.hide': '通知已隐藏',
    'notification.respondInvite': '邀请响应已发送',
    'notification.markAllSeen': '通知已全部标记已读',
    'friend.refresh': '好友列表已刷新',
    'user.boop': '戳一戳已发送',
    'autoFollow.start': '自动跟随已启动',
    'autoFollow.stop': '自动跟随已停止',
    'search.user': '搜索已完成'
};

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') {
            node.className = value;
        } else if (key === 'text') {
            node.textContent = value ?? '';
        } else if (key === 'html') {
            node.innerHTML = value ?? '';
        } else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value !== false && value !== null && value !== undefined) {
            node.setAttribute(key, String(value));
        }
    }
    node.append(...children.filter(Boolean));
    return node;
}

function safeText(value, fallback = '暂无') {
    return value ? String(value) : fallback;
}

function friendLocationText(friend) {
    return (
        friend?.locationName ||
        friend?.worldName ||
        friend?.statusDescription ||
        statusLabel(friend?.state)
    );
}

function isRemoteUser(user) {
    return String(user?.id || '').startsWith('usr_');
}

function findSnapshotUser(snap, userId) {
    if (!userId) {
        return null;
    }
    return (
        (snap?.friends || []).find((item) => item.id === userId) ||
        (snap?.location?.users || []).find((item) => item.id === userId) ||
        (snap?.search?.users || []).find((item) => item.id === userId) ||
        (snap?.favorites?.friends || []).find((item) => item.id === userId) ||
        null
    );
}

function isJoinableLocation(location) {
    return String(location || '').startsWith('wrld_');
}

function loadFriendSectionHeights() {
    try {
        const value = JSON.parse(
            localStorage.getItem(FRIEND_SECTION_HEIGHTS_KEY) || '{}'
        );
        return value && typeof value === 'object' ? value : {};
    } catch {
        return {};
    }
}

function saveFriendSectionHeights() {
    localStorage.setItem(
        FRIEND_SECTION_HEIGHTS_KEY,
        JSON.stringify(state.friendSectionHeights)
    );
}

function formatTime(value) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function statusLabel(value) {
    return (
        {
            active: '在线',
            online: '在线',
            offline: '离线',
            'join me': '欢迎加入',
            'ask me': '需要询问',
            busy: '请勿打扰'
        }[value] || safeText(value, '未知')
    );
}

function connectionLabel() {
    return (
        {
            connected: '已连接',
            disconnected: '未连接',
            error: '连接异常'
        }[state.status] || state.status
    );
}

function firstGlyph(value) {
    return safeText(value, '?').trim().slice(0, 1).toUpperCase();
}

function avatarUrl(user) {
    return (
        user?.userIcon ||
        user?.profilePicOverride ||
        user?.currentAvatarThumbnailImageUrl ||
        user?.imageUrl ||
        ''
    );
}

function renderAvatar(user, className = 'avatar') {
    const url = avatarUrl(user);
    if (!url) {
        return el('span', {
            class: `${className} avatar-fallback`,
            text: firstGlyph(user?.displayName || user?.name || user?.id)
        });
    }
    return el('img', {
        class: className,
        src: url,
        alt: '',
        referrerpolicy: 'no-referrer',
        onError: (event) => {
            event.currentTarget.replaceWith(
                el('span', {
                    class: `${className} avatar-fallback`,
                    text: firstGlyph(
                        user?.displayName || user?.name || user?.id
                    )
                })
            );
        }
    });
}

function actionAllowed(snap, type) {
    return !snap?.capabilities || snap.capabilities.includes(type);
}

async function api(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
}

async function login(event) {
    event.preventDefault();
    state.error = '';
    try {
        const password = event.currentTarget.password.value;
        const result = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        state.token = result.token;
        localStorage.setItem(TOKEN_KEY, state.token);
        await refreshSnapshot();
        connectSocket();
    } catch (err) {
        state.error = err.message;
        renderLogin();
    }
}

async function logout() {
    try {
        await api('/api/auth/logout', { method: 'POST' });
    } catch {
        // Browser-side logout should still clear the saved session.
    }
    state.token = '';
    state.snapshot = null;
    state.selectedFriendId = '';
    state.socket?.close();
    localStorage.removeItem(TOKEN_KEY);
    render();
}

async function refreshSnapshot() {
    applySnapshot(await api('/api/snapshot'));
    state.error = '';
    render();
}

function applySnapshot(snapshot) {
    state.snapshot = snapshot;
    observeRemoteNotifications(snapshot);
}

function connectSocket() {
    state.socket?.close();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(
        `${proto}//${location.host}/ws?token=${encodeURIComponent(state.token)}`
    );
    state.socket = socket;
    socket.onopen = () => {
        state.status = 'connected';
        render();
    };
    socket.onclose = () => {
        state.status = 'disconnected';
        render();
        if (state.token) {
            setTimeout(connectSocket, 3000);
        }
    };
    socket.onerror = () => {
        state.status = 'error';
        render();
    };
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'snapshot') {
            applySnapshot(message.data);
            render();
        } else if (message.type === 'action-result' && message.ok === false) {
            notify(message.error || '远控动作失败', 'error');
        }
    };
}

async function action(type, payload = {}, options = {}) {
    state.busyAction = type;
    state.error = '';
    state.contextMenu = null;
    render();
    try {
        await api('/api/action', {
            method: 'POST',
            body: JSON.stringify({
                type,
                payload,
                requestId: crypto.randomUUID?.() || String(Date.now())
            })
        });
        notify(
            options.successMessage || ACTION_SUCCESS_MESSAGES[type] || '操作已发送',
            'success'
        );
        await refreshSnapshot();
    } catch (err) {
        state.error = err.message;
        notify(err.message, 'error');
        render();
    } finally {
        state.busyAction = '';
        render();
    }
}

function openUserContextMenu(event, user, source = 'user') {
    event.preventDefault();
    event.stopPropagation();
    if (user?.id) {
        state.selectedFriendId = user.id;
    }
    state.contextMenu = {
        type: 'user',
        userId: user?.id || '',
        source,
        x: event.clientX,
        y: event.clientY
    };
    render();
}

function openFriendContextMenu(event, friend) {
    openUserContextMenu(event, friend, 'friend');
}

function openMeContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const snap = state.snapshot;
    const currentUserId = snap?.currentUser?.id || '';
    if (state.statusDescriptionUserId !== currentUserId) {
        state.statusDescriptionDraft = snap?.status?.description || '';
        state.statusDescriptionUserId = currentUserId;
    }
    state.contextMenu = {
        type: 'me',
        x: event.clientX,
        y: event.clientY
    };
    render();
}

function closeContextMenu() {
    if (!state.contextMenu) {
        return;
    }
    state.contextMenu = null;
    render();
}

function closeContextMenuOnOutsidePointer(event) {
    if (!shouldCloseContextMenu(event.target)) {
        return;
    }
    closeContextMenu();
}

function defaultEmojiId(name) {
    return `default_${String(name).replace(/ /g, '_').toLowerCase()}`;
}

function notify(message, tone = 'info') {
    const id = `${Date.now()}-${Math.random()}`;
    state.toasts.push({ id, message, tone });
    window.setTimeout(() => {
        state.toasts = state.toasts.filter((toast) => toast.id !== id);
        render();
    }, 3600);
}

function requestBrowserNotifications() {
    const permissionState = currentBrowserNotificationState();
    if (permissionState === 'unsupported') {
        notify('当前浏览器不支持网页通知', 'error');
        return;
    }
    if (permissionState === 'insecure') {
        notify('当前局域网 HTTP 页面不能启用浏览器通知，请使用 HTTPS 或 localhost。', 'error');
        return;
    }
    if (
        !canRequestBrowserNotificationPermission(
            permissionState,
            state.notificationPermissionRequesting
        )
    ) {
        notify(
            permissionState === 'granted' ? '网页通知已启用' : '网页通知未授权',
            permissionState === 'granted' ? 'success' : 'error'
        );
        return;
    }
    state.notificationPermissionRequesting = true;
    Notification.requestPermission()
        .then((permission) => {
            notify(
                permission === 'granted' ? '网页通知已启用' : '网页通知未授权',
                permission === 'granted' ? 'success' : 'error'
            );
        })
        .finally(() => {
            state.notificationPermissionRequesting = false;
            render();
        });
}

function pushBrowserNotification(title, body) {
    const permissionState = currentBrowserNotificationState();
    if (permissionState !== 'granted') {
        notifyBrowserNotificationUnavailable(permissionState);
        return;
    }
    try {
        new Notification(title, {
            body,
            icon: logoUrl
        });
    } catch {
        // Browser notifications are best-effort; in-page toast still shows.
    }
}

function observeRemoteNotifications(snapshot) {
    const notifications = snapshot?.notifications || [];
    const { currentIds, fresh } = collectFreshNotifications(
        state.knownNotificationIds,
        notifications
    );
    if (!state.notificationSnapshotReady) {
        state.knownNotificationIds = currentIds;
        state.notificationSnapshotReady = true;
        return;
    }
    state.knownNotificationIds = currentIds;
    if (!fresh.length) {
        return;
    }
    const first = fresh[0];
    const title = fresh.length > 1 ? `收到 ${fresh.length} 条新通知` : '收到新通知';
    const body = first.senderUsername || first.type || 'VRCX 网页远控';
    notify(`${title}: ${body}`, 'info');
    pushBrowserNotification(title, body);
}

function currentBrowserNotificationState() {
    return getBrowserNotificationState({
        notificationApi: window.Notification,
        isSecureContext: window.isSecureContext,
        hostname: location.hostname
    });
}

function notifyBrowserNotificationUnavailable(permissionState) {
    if (state.notificationUnavailableNotified) {
        return;
    }
    if (permissionState === 'insecure') {
        notify('当前局域网 HTTP 页面不能弹出浏览器通知，已改用页面内提示。', 'info');
    } else if (permissionState === 'denied') {
        notify('浏览器通知未授权，已改用页面内提示。', 'info');
    }
    state.notificationUnavailableNotified = true;
}

function button(text, attrs = {}) {
    return el('button', {
        class: attrs.class || 'action-button',
        text: attrs.busy && state.busyAction ? '处理中...' : text,
        disabled: attrs.disabled || Boolean(attrs.action && state.busyAction),
        onClick: attrs.onClick
    });
}

function actionButton(text, type, payload, disabled = false, className) {
    return button(text, {
        class: className,
        action: true,
        disabled,
        onClick: () => action(type, payload)
    });
}

function renderLogin() {
    root.replaceChildren(
        el('main', { class: 'login-shell' }, [
            el('section', { class: 'login-panel' }, [
                el('div', { class: 'brand-large' }, [
                    el('img', { src: logoUrl, class: 'logo', alt: '' }),
                    el('div', {}, [
                        el('h1', { text: 'VRCX-Luo 网页远控' }),
                        el('p', { text: '连接正在运行的 VRCX 主程序' })
                    ])
                ]),
                state.error
                    ? el('p', { class: 'error-text', text: state.error })
                    : '',
                el('form', { onSubmit: login }, [
                    el('input', {
                        name: 'password',
                        type: 'password',
                        placeholder: '访问密码',
                        autocomplete: 'current-password',
                        required: true
                    }),
                    el('button', { type: 'submit', text: '连接' })
                ])
            ])
        ])
    );
}

function renderNavItem([view, label, icon]) {
    return el(
        'button',
        {
            class: `nav-item ${state.view === view ? 'active' : ''}`,
            title: label,
            onClick: () => {
                state.view = view;
                render();
            }
        },
        [el('i', { class: icon }), el('span', { text: label })]
    );
}

function renderFeedFilter([value, label]) {
    return el('button', {
        class: `segment-button ${state.feedFilter === value ? 'active' : ''}`,
        text: label,
        onClick: () => {
            state.feedFilter = value;
            render();
        }
    });
}

function renderBadge(text, tone = '') {
    return el('span', { class: `badge ${tone}`, text });
}

function renderFriend(friend, compact = false) {
    const selected = state.selectedFriendId === friend.id;
    const tone = friendStateTone(friend);
    return el(
        'button',
        {
            class: `friend-row friend-${tone} ${selected ? 'selected' : ''} ${
                compact ? 'compact' : ''
            }`,
            title: `${safeText(friend.displayName, friend.id)}\n${friendLocationText(friend)}`,
            onClick: () => {
                state.selectedFriendId = friend.id;
                state.view = 'friends';
                render();
            },
            onContextMenu: (event) => openFriendContextMenu(event, friend)
        },
        [
            el('span', { class: 'avatar-wrap' }, [
                renderAvatar(friend),
                el('span', { class: `state-dot ${tone}` })
            ]),
            el('span', { class: 'friend-main' }, [
                el('strong', {
                    text: safeText(friend.displayName, friend.id)
                }),
                el('small', {
                    text: friendLocationText(friend)
                })
            ])
        ]
    );
}

function renderUserRow(user, compact = false) {
    const tone = friendStateTone(user);
    return el(
        'button',
        {
            class: `friend-row friend-${tone} ${compact ? 'compact' : ''}`,
            title: `${safeText(user.displayName, user.id)}\n${friendLocationText(user)}`,
            onClick: () => action('user.open', { userId: user.id }),
            onContextMenu: (event) => openUserContextMenu(event, user, 'user')
        },
        [
            el('span', { class: 'avatar-wrap' }, [
                renderAvatar(user),
                el('span', { class: `state-dot ${tone}` })
            ]),
            el('span', { class: 'friend-main' }, [
                el('strong', {
                    text: safeText(user.displayName, user.id)
                }),
                el('small', {
                    text: friendLocationText(user)
                })
            ])
        ]
    );
}

function startSectionResize(event, section) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = section.height;

    const onMove = (moveEvent) => {
        state.friendSectionHeights[section.key] =
            clampFriendSectionHeight(startHeight + moveEvent.clientY - startY);
        render();
    };
    const onUp = () => {
        saveFriendSectionHeights();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

function renderFriendSection(section) {
    return el('section', {
        class: 'friend-section',
        style: `height:${section.height}px;`
    }, [
        el('h3', { text: `${section.title} ${section.count}` }),
        el(
            'div',
            { class: 'friend-list' },
            section.friends.map((friend) => renderFriend(friend, true))
        ),
        el('div', {
            class: 'section-resizer',
            title: '拖动调整分组高度',
            onMouseDown: (event) => startSectionResize(event, section)
        })
    ]);
}

function menuItem(label, attrs = {}) {
    return el('button', {
        class: attrs.class || 'context-menu-item',
        text: label,
        disabled: attrs.disabled,
        onClick: attrs.onClick
    });
}

function renderFriendContextMenu(snap) {
    const menu = state.contextMenu;
    if (!menu || menu.type !== 'user') {
        return '';
    }
    const user = findSnapshotUser(snap, menu.userId);
    if (!user) {
        return '';
    }
    const isFriend = (snap?.friends || []).some((item) => item.id === user.id);
    const joinable = isJoinableLocation(user.location);
    const isFollowing = snap?.autoFollow?.targetFriendId === user.id;
    const x = Math.min(menu.x, window.innerWidth - 244);
    const y = Math.min(menu.y, window.innerHeight - 360);
    const commonEmojis = photonEmojis.slice(0, 12);
    const submenuDirection = getSubmenuDirection(x, 236, 188, window.innerWidth);

    return el('div', { class: 'context-layer', onPointerDown: closeContextMenuOnOutsidePointer }, [
        el(
            'div',
            {
                class: 'context-menu',
                style: `left:${Math.max(8, x)}px;top:${Math.max(8, y)}px`,
                onPointerDown: (event) => event.stopPropagation(),
                onContextMenu: (event) => event.preventDefault()
            },
            [
                el('div', { class: 'context-menu-title' }, [
                    renderAvatar(user),
                    el('span', {}, [
                        el('strong', { text: safeText(user.displayName, user.id) }),
                        el('small', { text: friendLocationText(user) })
                    ])
                ]),
                menuItem('打开资料', {
                    onClick: () => action('user.open', { userId: user.id })
                }),
                menuItem('请求邀请', {
                    disabled: !isFriend || !user.id || user.state === 'offline',
                    onClick: () => action('friend.requestInvite', { userId: user.id })
                }),
                menuItem('打开加入界面', {
                    disabled: !joinable,
                    onClick: () => action('instance.open', { location: user.location })
                }),
                menuItem('启动并加入', {
                    disabled: !joinable,
                    onClick: () =>
                        action('instance.launch', {
                            location: user.location,
                            desktopMode: false
                        })
                }),
                menuItem('桌面模式启动加入', {
                    disabled: !joinable,
                    onClick: () =>
                        action('instance.launch', {
                            location: user.location,
                            desktopMode: true
                        })
                }),
                menuItem('自我邀请', {
                    disabled: !joinable,
                    onClick: () => action('friend.selfInvite', { location: user.location })
                }),
                menuItem(isFollowing ? '停止自动跟随' : '自动跟随', {
                    disabled: !isFriend || !user.id,
                    onClick: () =>
                        action(isFollowing ? 'autoFollow.stop' : 'autoFollow.start', {
                            userId: user.id
                        })
                }),
                renderBoopSubmenu(user, commonEmojis, submenuDirection)
            ]
        )
    ]);
}

function renderMeContextMenu(snap) {
    const menu = state.contextMenu;
    if (!menu || menu.type !== 'me') {
        return '';
    }
    const currentUser = snap?.currentUser;
    const x = Math.min(menu.x, window.innerWidth - 244);
    const y = Math.min(menu.y, window.innerHeight - 280);
    return el('div', { class: 'context-layer', onPointerDown: closeContextMenuOnOutsidePointer }, [
        el(
            'div',
            {
                class: 'context-menu',
                style: `left:${Math.max(8, x)}px;top:${Math.max(8, y)}px`,
                onPointerDown: (event) => event.stopPropagation(),
                onContextMenu: (event) => event.preventDefault()
            },
            [
                el('div', { class: 'context-menu-title' }, [
                    renderAvatar(currentUser),
                    el('span', {}, [
                        el('strong', {
                            text: safeText(currentUser?.displayName, '未登录')
                        }),
                        el('small', {
                            text: `${statusLabel(snap?.status?.value)} ${
                                snap?.status?.description || ''
                            }`
                        })
                    ])
                ]),
                el('div', { class: 'context-menu-group' }, [
                    el('span', { class: 'context-menu-label', text: '切换状态' }),
                    ...statusOptions.map(([status, label]) =>
                        menuItem(label, {
                            onClick: () =>
                                action('user.setStatus', {
                                    status,
                                    statusDescription:
                                        snap?.status?.description || ''
                                })
                        })
                    )
                ]),
                el('form', {
                    class: 'status-description-form',
                    onSubmit: (event) => {
                        event.preventDefault();
                        action('user.setStatus', {
                            status: snap?.status?.value || 'active',
                            statusDescription: state.statusDescriptionDraft
                        });
                    }
                }, [
                    el('label', { text: '状态描述' }),
                    el('input', {
                        value: state.statusDescriptionDraft,
                        maxlength: 64,
                        placeholder: '输入状态描述',
                        onInput: (event) => {
                            state.statusDescriptionDraft = event.currentTarget.value;
                        }
                    }),
                    el('button', {
                        type: 'submit',
                        text: '保存描述'
                    })
                ])
            ]
        )
    ]);
}

function renderBoopSubmenu(friend, emojis, direction = 'right') {
    return el('div', { class: 'context-menu-group' }, [
        el(
            'div',
            {
                class: `context-menu-item has-submenu ${
                    !friend.id ? 'disabled' : ''
                } submenu-${direction}`
            },
            [
                el('button', {
                    class: 'context-submenu-trigger',
                    text: '戳一戳'
                }),
                el(
                    'div',
                    { class: 'context-submenu' },
                    [
                        menuItem('默认戳一戳', {
                            disabled: !friend.id,
                            onClick: () => action('user.boop', { userId: friend.id })
                        }),
                        ...emojis.map((emoji) =>
                            menuItem(emoji, {
                                disabled: !friend.id,
                                onClick: () =>
                                    action('user.boop', {
                                        userId: friend.id,
                                        emojiId: defaultEmojiId(emoji)
                                    })
                            })
                        )
                    ]
                )
            ]
        )
    ]);
}

function renderHeader(title, subtitle, actions = []) {
    return el('header', { class: 'toolbar' }, [
        el('div', {}, [el('h1', { text: title }), el('p', { text: subtitle })]),
        el('div', { class: 'toolbar-actions' }, actions)
    ]);
}

function renderCurrentInstanceCard(snap, compact = false) {
    const location = snap?.location?.location || '';
    return el('article', { class: `panel instance-panel ${compact ? 'compact-panel' : ''}` }, [
        el('div', { class: 'panel-heading' }, [
            el('h2', { text: '当前实例' }),
            renderBadge(snap?.game?.isRunning ? 'VRChat 运行中' : '未启动')
        ]),
        el('p', {
            class: 'location-text',
            text:
                snap?.location?.name ||
                snap?.location?.location ||
                '当前没有实例信息'
        }),
        el('div', { class: 'meta-grid' }, [
            el('span', {
                text: `VRChat: ${snap?.game?.isRunning ? '运行中' : '未启动'}`
            }),
            el('span', {
                text: `SteamVR: ${snap?.game?.isSteamVrRunning ? '运行中' : '未启动'}`
            }),
            el('span', {
                text: `模式: ${snap?.game?.isNoVr ? '桌面' : 'VR'}`
            })
        ]),
        el('div', { class: 'button-grid' }, [
            actionButton(
                '打开加入界面',
                'instance.open',
                { location },
                !location
            ),
            actionButton(
                'VR 启动加入',
                'instance.launch',
                { location, desktopMode: false },
                !location
            ),
            actionButton(
                '桌面启动加入',
                'instance.launch',
                { location, desktopMode: true },
                !location
            ),
            actionButton(
                '自我邀请',
                'friend.selfInvite',
                { location },
                !location
            )
        ])
    ]);
}

function renderFeedView(snap) {
    const feed = filterFeedRows(snap?.feed || []);
    return [
        renderHeader('好友动态', '实时查看好友位置、加入/离开、视频和通知动态', [
            button('刷新', { class: 'ghost-button', onClick: refreshSnapshot })
        ]),
        renderRemoteSummary(snap),
        renderFeedControls(),
        el('div', { class: 'feed-layout' }, [
            el('article', { class: 'panel table-panel' }, [
                el('div', { class: 'panel-heading' }, [
                    el('h2', { text: '最新动态' }),
                    renderBadge(`${feed.length} 条`)
                ]),
                renderEntryTable(feed)
            ])
        ])
    ];
}

function renderRemoteSummary(snap) {
    return el('div', { class: 'summary-strip' }, [
        renderSummaryItem(
            'VRChat',
            snap?.game?.isRunning ? '运行中' : '未启动',
            snap?.game?.isRunning ? 'ok' : 'warn'
        ),
        renderSummaryItem(
            'SteamVR',
            snap?.game?.isSteamVrRunning ? '运行中' : '未启动',
            snap?.game?.isSteamVrRunning ? 'ok' : ''
        ),
        renderSummaryItem(
            '自动跟随',
            snap?.autoFollow?.isActive
                ? snap.autoFollow.targetFriendName || '启用中'
                : '未启用',
            snap?.autoFollow?.isActive ? 'ok' : ''
        ),
        renderSummaryItem(
            '通知',
            `${(snap?.notifications || []).length} 条`,
            (snap?.notifications || []).length ? 'warn' : ''
        )
    ]);
}

function renderSummaryItem(label, value, tone = '') {
    return el('div', { class: `summary-item ${tone}` }, [
        el('span', { text: label }),
        el('strong', { text: value })
    ]);
}

function renderFeedControls() {
    return el('div', { class: 'remote-controls' }, [
        el('button', { class: 'filter-button', type: 'button' }, [
            el('i', { class: 'ri-filter-3-line' }),
            el('span', { text: '筛选' })
        ]),
        el('div', { class: 'segment-group' }, feedFilters.map(renderFeedFilter)),
        el('label', { class: 'remote-search' }, [
            el('i', { class: 'ri-search-line' }),
            el('input', {
                value: state.feedSearchText,
                placeholder: '搜索',
                onInput: (event) => {
                    state.feedSearchText = event.currentTarget.value;
                    render();
                }
            })
        ])
    ]);
}

function filterFeedRows(rows) {
    const query = state.feedSearchText.trim().toLowerCase();
    return rows.filter((row) => {
        const type = String(row.type || '').toLowerCase();
        const matchesFilter =
            state.feedFilter === 'all' ||
            (state.feedFilter === 'location' &&
                /gps|location|playerjoined|playerleft/.test(type)) ||
            (state.feedFilter === 'online' && type.includes('online')) ||
            (state.feedFilter === 'offline' && type.includes('offline')) ||
            (state.feedFilter === 'status' && type.includes('status')) ||
            (state.feedFilter === 'avatar' && type.includes('avatar')) ||
            (state.feedFilter === 'profile' &&
                /bio|profile|description/.test(type));
        if (!matchesFilter) {
            return false;
        }
        if (!query) {
            return true;
        }
        return [
            row.type,
            row.displayName,
            row.userId,
            row.locationName,
            row.worldName,
            row.location,
            row.message,
            row.videoName
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query);
    });
}

function renderNowPlaying(snap) {
    const np = snap?.gameLog?.nowPlaying || {};
    return el('article', { class: 'panel' }, [
        el('div', { class: 'panel-heading' }, [
            el('h2', { text: '当前视频' }),
            renderBadge(np.playing ? '播放中' : '无')
        ]),
        el('p', { text: np.name || '未检测到正在播放的视频' }),
        el('div', { class: 'progress' }, [
            el('span', {
                style: `width:${Math.max(0, Math.min(100, np.percentage || 0))}%`
            })
        ]),
        el('small', { text: np.remainingText || '' })
    ]);
}

function renderEntryTable(rows) {
    if (!rows.length) {
        return el('div', { class: 'empty-row', text: '暂无数据' });
    }
    return el(
        'div',
        { class: 'data-table' },
        [
            el('div', { class: 'table-row' }, [
                el('strong', { text: '时间' }),
                el('strong', { text: '类型' }),
                el('strong', { text: '玩家' }),
                el('strong', { text: '详细信息' })
            ]),
            ...rows.map((row) =>
                el('div', { class: 'table-row' }, [
                    el('span', { text: formatTime(row.created_at) }),
                    el('span', { text: row.type }),
                    el('strong', { text: row.displayName || row.userId || '-' }),
                    el('span', {
                        text:
                            row.locationName ||
                            row.worldName ||
                            row.location ||
                            row.message ||
                            row.videoName ||
                            '-'
                    })
                ])
            )
        ]
    );
}

function renderFriendsView(snap, selected) {
    const friends = snap?.friends || [];
    const selectedJoinable = isJoinableLocation(selected?.location);
    return [
        renderHeader(
            safeText(selected?.displayName, '好友'),
            friendLocationText(selected) || '选择好友查看可用操作',
            [button('刷新好友', { class: 'ghost-button', onClick: () => action('friend.refresh') })]
        ),
        el('div', { class: 'dashboard-grid' }, [
            el('article', { class: 'panel highlight-panel' }, [
                el('div', { class: 'selected-user' }, [
                    renderAvatar(selected, 'avatar large'),
                    el('div', {}, [
                        el('h2', { text: safeText(selected?.displayName, '未选择') }),
                        el('p', {
                            text: `${statusLabel(selected?.state)} ${
                                selected?.statusDescription || ''
                            }`
                        })
                    ])
                ]),
                el('div', { class: 'button-grid' }, [
                    actionButton(
                        snap?.autoFollow?.targetFriendId === selected?.id
                            ? '停止跟随'
                            : '自动跟随',
                        snap?.autoFollow?.targetFriendId === selected?.id
                            ? 'autoFollow.stop'
                            : 'autoFollow.start',
                        { userId: selected?.id },
                        !selected?.id
                    ),
                    actionButton(
                        '戳一戳',
                        'user.boop',
                        { userId: selected?.id },
                        !selected?.id
                    ),
                    actionButton(
                        '打开好友实例',
                        'instance.open',
                        { location: selected?.location },
                        !selectedJoinable
                    ),
                    actionButton(
                        '请求邀请',
                        'friend.requestInvite',
                        { userId: selected?.id },
                        !selected?.id
                    ),
                    actionButton(
                        '自我邀请',
                        'friend.selfInvite',
                        { location: selected?.location },
                        !selectedJoinable
                    ),
                    actionButton(
                        '打开资料',
                        'user.open',
                        { userId: selected?.id },
                        !selected?.id
                    )
                ])
            ]),
            el('article', { class: 'panel wide' }, [
                el('div', { class: 'panel-heading' }, [
                    el('h2', { text: '好友列表' }),
                    renderBadge(`${friends.length} 人`)
                ]),
                el('div', { class: 'friend-grid' }, friends.map(renderFriend))
            ])
        ])
    ];
}

function renderInstanceView(snap) {
    const users = snap?.location?.users || [];
    return [
        renderHeader('实例', safeText(snap?.location?.location, '未检测到当前位置'), [
            button('刷新', { class: 'ghost-button', onClick: refreshSnapshot })
        ]),
        el('div', { class: 'dashboard-grid' }, [
            renderCurrentInstanceCard(snap),
            el('article', { class: 'panel wide' }, [
                el('div', { class: 'panel-heading' }, [
                    el('h2', { text: '当前实例玩家' }),
                    renderBadge(String(users.length))
                ]),
                el(
                    'div',
                    { class: 'compact-list' },
                    users.map((user) =>
                        el('button', {
                            class: 'compact-row clickable-row',
                            type: 'button',
                            onClick: () => {
                                if (isRemoteUser(user)) {
                                    action('user.open', { userId: user.id });
                                }
                            },
                            onContextMenu: (event) =>
                                openUserContextMenu(event, user, 'instance')
                        }, [
                            renderAvatar(user),
                            el('span', { text: safeText(user.displayName, user.id) })
                        ])
                    )
                )
            ])
        ])
    ];
}

function renderNotificationsView(snap) {
    const notifications = snap?.notifications || [];
    const notificationPermission = currentBrowserNotificationState();
    return [
        renderHeader('通知中心', `当前显示 ${notifications.length} 条通知`, [
            button(
                notificationPermission === 'granted'
                    ? '网页通知已启用'
                    : notificationPermission === 'insecure'
                      ? '网页通知需 HTTPS'
                      : '启用网页通知',
                {
                    class: 'ghost-button',
                    disabled:
                        notificationPermission === 'unsupported' ||
                        notificationPermission === 'insecure',
                    onClick: requestBrowserNotifications
                }
            ),
            actionButton('全部已读', 'notification.markAllSeen', {}),
            actionButton('清理通知中心', 'ui.clearNotificationCenter', {})
        ]),
        el(
            'div',
            { class: 'notification-list' },
            notifications.length
                ? notifications.map(renderNotification)
                : [el('article', { class: 'notification' }, [
                      el('strong', { text: '没有通知' }),
                      el('p', { text: '通知中心当前没有可显示的内容。' })
                  ])]
        )
    ];
}

function renderNotification(noty) {
    const responses = Array.isArray(noty.responses) ? noty.responses : [];
    const hasInviteResponse =
        String(noty.type || '').includes('invite') || responses.length > 0;
    return el('article', { class: 'notification' }, [
        el('strong', { text: noty.senderUsername || noty.type }),
        el('small', { text: `${noty.type} · ${formatTime(noty.created_at)}` }),
        el('p', { text: noty.message || '无正文' }),
        el('div', { class: 'button-grid' }, [
            actionButton(
                '标记已读',
                'notification.see',
                { notificationId: noty.id, confirmed: true },
                !noty.id
            ),
            button('隐藏通知', {
                class: 'ghost-button',
                disabled: !noty.id,
                onClick: () => {
                    if (confirm('确定要隐藏这条通知吗？')) {
                        action('notification.hide', {
                            notificationId: noty.id,
                            confirmed: true
                        });
                    }
                }
            }),
            ...responses.map((response) =>
                button(response.text || response.type || '响应', {
                    class: 'action-button',
                    disabled: !noty.id,
                    onClick: () => {
                        if (response.type === 'link' && response.data) {
                            window.open(response.data, '_blank', 'noopener');
                            return;
                        }
                        if (confirm(`确定要发送「${response.text || response.type}」吗？`)) {
                            action('notification.respondInvite', {
                                notificationId: noty.id,
                                responseType: response.type,
                                responseData: response.data || '',
                                confirmed: true
                            });
                        }
                    }
                })
            ),
            hasInviteResponse && !responses.length
                ? button('响应邀请', {
                      class: 'action-button',
                      disabled: !noty.id,
                      onClick: () => {
                          if (confirm('确定要响应这条邀请通知吗？')) {
                              action('notification.respondInvite', {
                                  notificationId: noty.id,
                                  responseType: 'response',
                                  responseData: '',
                                  confirmed: true
                              });
                          }
                      }
                  })
                : ''
        ])
    ]);
}

function renderLogsView(snap) {
    return [
        renderHeader('游戏日志', '显示当前主程序已加载的最近日志行', [
            button('刷新', { class: 'ghost-button', onClick: refreshSnapshot })
        ]),
        el('article', { class: 'panel wide table-panel' }, [
            renderEntryTable(snap?.gameLog?.rows || [])
        ])
    ];
}

function renderFavoritesView(snap) {
    const favorites = snap?.favorites || {};
    return [
        renderHeader('收藏与星标', '查看好友、世界和模型收藏摘要'),
        el('div', { class: 'card-columns' }, [
            renderMediaList('收藏好友', favorites.friends || [], {
                kind: 'user'
            }),
            renderMediaList('收藏世界', favorites.worlds || [], {
                kind: 'world'
            }),
            renderMediaList('收藏模型', favorites.avatars || [], {
                kind: 'avatar'
            })
        ])
    ];
}

function renderAvatarsView(snap) {
    return [
        renderHeader('我的模型', '显示主程序已加载的模型历史和缓存摘要'),
        renderMediaList('模型历史', snap?.library?.avatarHistory || [], {
            wide: true,
            kind: 'avatar'
        })
    ];
}

function renderMediaList(title, items, options = {}) {
    const wide = options === true || options.wide;
    const kind = typeof options === 'object' ? options.kind : '';
    return el('article', { class: `panel ${wide ? 'wide' : ''}` }, [
        el('div', { class: 'panel-heading' }, [
            el('h2', { text: title }),
            renderBadge(String(items.length))
        ]),
        el(
            'div',
            { class: 'media-list' },
            items.length
                ? items.map((item) =>
                      el('button', {
                          class: 'media-row clickable-row',
                          type: 'button',
                          onClick: () => handleMediaOpen(item, kind),
                          onContextMenu: (event) => {
                              if (kind === 'user') {
                                  openUserContextMenu(event, item, 'favorite');
                              }
                          }
                      }, [
                          renderAvatar(item, 'media-thumb'),
                          el('div', {}, [
                              el('strong', {
                                  text: safeText(item.displayName || item.name, item.id)
                              }),
                              el('small', { text: item.authorName || item.id || '' })
                          ])
                      ])
                  )
                : [el('div', { class: 'empty-row', text: '暂无数据' })]
        )
    ]);
}

function handleMediaOpen(item, kind) {
    if (kind === 'user') {
        action('user.open', { userId: item.id });
    } else if (kind === 'world' && item.id) {
        action('instance.open', { location: item.id });
    }
}

function renderSearchView(snap) {
    const users = snap?.search?.users || [];
    return [
        renderHeader('搜索', '通过主程序执行 VRChat 用户搜索'),
        el('article', { class: 'panel wide' }, [
            el('form', {
                class: 'search-bar',
                onSubmit: (event) => {
                    event.preventDefault();
                    action('search.user', { query: state.searchText });
                }
            }, [
                el('input', {
                    value: state.searchText,
                    placeholder: '输入用户显示名',
                    onInput: (event) => {
                        state.searchText = event.currentTarget.value;
                    }
                }),
                el('button', { type: 'submit', text: '搜索' })
            ]),
            el('div', { class: 'friend-grid' }, users.map(renderUserRow))
        ])
    ];
}

function renderContent(snap, selected) {
    if (!snap?.loggedIn) {
        return [
            el('section', { class: 'empty-state' }, [
                el('h1', { text: '主程序未登录' }),
                el('p', { text: '网页远控依赖 VRCX 主程序已启动并登录 VRChat。' })
            ])
        ];
    }
    if (state.view === 'friends') return renderFriendsView(snap, selected);
    if (state.view === 'instances') return renderInstanceView(snap);
    if (state.view === 'notifications') return renderNotificationsView(snap);
    if (state.view === 'logs') return renderLogsView(snap);
    if (state.view === 'favorites') return renderFavoritesView(snap);
    if (state.view === 'avatars') return renderAvatarsView(snap);
    if (state.view === 'search') return renderSearchView(snap);
    return renderFeedView(snap);
}

function renderRightSidebar(snap) {
    const groups = snap?.friendGroups || {};
    const sections = buildVisibleFriendSections({
        groups,
        sectionHeights: state.friendSectionHeights,
        query: state.friendSearchText
    });
    const onlineCount = (snap?.friends || []).filter(
        (friend) => friend.state !== 'offline'
    ).length;
    const friendCount = (snap?.friends || []).length;
    return el('aside', { class: 'rightbar' }, [
        el('div', { class: 'rightbar-tools' }, [
            el('label', { class: 'rightbar-search' }, [
                el('i', { class: 'ri-search-line' }),
                el('input', {
                    value: state.friendSearchText,
                    placeholder: '搜索好友',
                    onInput: (event) => {
                        state.friendSearchText = event.currentTarget.value;
                        render();
                    }
                }),
                state.friendSearchText
                    ? el('button', {
                          class: 'search-clear',
                          type: 'button',
                          title: '清空搜索',
                          onClick: () => {
                              state.friendSearchText = '';
                              render();
                          }
                      }, [el('i', { class: 'ri-close-line' })])
                    : ''
            ]),
            el('button', { class: 'round-icon', title: '刷新', onClick: refreshSnapshot }, [
                el('i', { class: 'ri-refresh-line' })
            ]),
            el('button', { class: 'round-icon', title: '通知', onClick: () => {
                state.view = 'notifications';
                render();
            } }, [el('i', { class: 'ri-notification-3-line' })])
        ]),
        el('div', { class: 'rightbar-tabs' }, [
            el('button', {
                class: 'active',
                text: `好友 (${onlineCount}/${friendCount})`
            }),
            el('button', { text: '追踪非好友 (0)' })
        ]),
        el('section', { class: 'friend-section me-section' }, [
            el('h3', { text: '我' }),
            el('div', {
                class: 'me-card',
                title: '右键切换状态',
                onContextMenu: openMeContextMenu
            }, [
                renderAvatar(snap?.currentUser, 'avatar large'),
                el('div', {}, [
                    el('strong', {
                        text: snap?.currentUser?.displayName || '未登录'
                    }),
                    el('small', {
                        text: snap?.status?.description || statusLabel(snap?.status?.value)
                    })
                ])
            ])
        ]),
        ...sections.map(renderFriendSection)
    ]);
}

function renderMain() {
    const snap = state.snapshot;
    const friends = snap?.friends || [];
    const selected =
        friends.find((friend) => friend.id === state.selectedFriendId) ||
        friends[0];
    if (selected && !state.selectedFriendId) {
        state.selectedFriendId = selected.id;
    }

    root.replaceChildren(
        el('main', { class: 'app-shell' }, [
            el('aside', { class: 'left-nav' }, [
                el('div', { class: 'brand' }, [
                    el('img', { src: logoUrl, alt: '' }),
                    el('span', { text: 'VRCX-Luo Remote' })
                ]),
                el('nav', {}, navItems.map(renderNavItem)),
                button('退出', { class: 'nav-item danger', onClick: logout })
            ]),
            el('section', { class: 'content' }, [
                state.error
                    ? el('div', { class: 'banner error-text', text: state.error })
                    : '',
                ...renderContent(snap, selected)
            ]),
            renderRightSidebar(snap),
            renderStatusBar(snap),
            renderFriendContextMenu(snap),
            renderMeContextMenu(snap),
            renderToastLayer()
        ])
    );
}

function renderToastLayer() {
    if (!state.toasts.length) {
        return '';
    }
    return el(
        'div',
        { class: 'toast-layer' },
        state.toasts.map((toast) =>
            el('div', {
                class: `remote-toast ${toast.tone}`,
                text: toast.message
            })
        )
    );
}

function renderStatusBar(snap) {
    return el('footer', { class: 'statusbar' }, [
        el('span', { text: `WebSocket: ${connectionLabel()}` }),
        el('span', {
            text: `VRChat: ${snap?.game?.isRunning ? '运行中' : '未启动'}`
        }),
        el('span', {
            text: `SteamVR: ${snap?.game?.isSteamVrRunning ? '运行中' : '未启动'}`
        }),
        el('span', { text: `好友: ${(snap?.friends || []).length}` }),
        el('span', { text: `通知: ${(snap?.notifications || []).length}` }),
        snap?.autoFollow?.isActive
            ? el('span', {
                  text: `自动跟随: ${snap.autoFollow.targetFriendName || '启用中'}`
              })
            : '',
        el('span', { text: formatTime(snap?.generatedAt) })
    ]);
}

function render() {
    if (!state.token) {
        renderLogin();
        return;
    }
    if (!state.snapshot) {
        root.replaceChildren(
            el('main', { class: 'login-shell' }, [
                el('section', { class: 'login-panel' }, [
                    el('h1', { text: '正在连接 VRCX...' }),
                    state.error
                        ? el('p', { class: 'error-text', text: state.error })
                        : ''
                ])
            ])
        );
        return;
    }
    renderMain();
}

async function init() {
    render();
    if (!state.token) {
        return;
    }
    try {
        await refreshSnapshot();
        connectSocket();
    } catch (err) {
        state.token = '';
        state.error = err.message;
        localStorage.removeItem(TOKEN_KEY);
        renderLogin();
    }
}

init();
