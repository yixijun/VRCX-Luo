import './remote.css';
import logoUrl from '../../images/VRCX.png';

const TOKEN_KEY = 'vrcxRemoteToken';

const state = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    snapshot: null,
    socket: null,
    selectedFriendId: '',
    status: 'disconnected',
    view: 'friends',
    error: '',
    busyAction: ''
};

document.documentElement.classList.add('dark');

const root = document.getElementById('root');

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') {
            node.className = value;
        } else if (key === 'text') {
            node.textContent = value ?? '';
        } else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value !== false && value !== null && value !== undefined) {
            node.setAttribute(key, String(value));
        }
    }
    node.append(...children.filter((child) => child !== ''));
    return node;
}

function safeText(value, fallback = '暂无') {
    return value ? String(value) : fallback;
}

function statusLabel(value) {
    return (
        {
            active: '在线',
            online: '在线',
            offline: '离线',
            'join me': '欢迎加入',
            'ask me': '需要询问',
            busy: '忙碌'
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
        ''
    );
}

function renderAvatar(user, className = 'avatar') {
    const url = avatarUrl(user);
    if (!url) {
        return el('span', {
            class: `${className} avatar-fallback`,
            text: firstGlyph(user?.displayName || user?.id)
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
                    text: firstGlyph(user?.displayName || user?.id)
                })
            );
        }
    });
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
        // Local logout still clears the browser session.
    }
    state.token = '';
    state.snapshot = null;
    state.selectedFriendId = '';
    state.socket?.close();
    localStorage.removeItem(TOKEN_KEY);
    render();
}

async function refreshSnapshot() {
    state.snapshot = await api('/api/snapshot');
    state.error = '';
    render();
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
            state.snapshot = message.data;
            render();
        }
    };
}

async function action(type, payload = {}) {
    state.busyAction = type;
    state.error = '';
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
        await refreshSnapshot();
    } catch (err) {
        state.error = err.message;
        render();
    } finally {
        state.busyAction = '';
        render();
    }
}

function actionButton(text, type, payload, disabled = false) {
    return el('button', {
        class: 'action-button',
        text: state.busyAction === type ? '处理中...' : text,
        disabled: disabled || Boolean(state.busyAction),
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
                        el('h1', { text: 'VRCX-Luo 远控' }),
                        el('p', { text: '通过浏览器安全访问正在运行的 VRCX' })
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

function renderFriend(friend) {
    const selected = state.selectedFriendId === friend.id;
    return el(
        'button',
        {
            class: `friend-row ${selected ? 'selected' : ''}`,
            onClick: () => {
                state.selectedFriendId = friend.id;
                state.view = 'friends';
                render();
            }
        },
        [
            renderAvatar(friend),
            el('span', { class: 'friend-main' }, [
                el('strong', { text: safeText(friend.displayName, friend.id) }),
                el('small', {
                    text:
                        friend.location ||
                        friend.statusDescription ||
                        statusLabel(friend.state)
                })
            ]),
            el('span', { class: `state-dot ${friend.state || 'offline'}` })
        ]
    );
}

function renderNavItem(view, label) {
    return el('button', {
        class: `nav-item ${state.view === view ? 'active' : ''}`,
        text: label,
        onClick: () => {
            state.view = view;
            render();
        }
    });
}

function renderStatusBadge(snap) {
    return el('span', {
        class: `badge ${snap?.loggedIn ? 'ok' : 'warn'}`,
        text: snap?.loggedIn ? '主程序已登录' : '主程序未登录'
    });
}

function renderFriendsView(snap, selected) {
    return [
        el('header', { class: 'toolbar' }, [
            el('div', {}, [
                el('h1', { text: safeText(selected?.displayName, '好友') }),
                el('p', {
                    text:
                        selected?.location ||
                        selected?.statusDescription ||
                        '没有可显示的位置'
                })
            ]),
            el('button', { class: 'ghost-button', text: '刷新', onClick: refreshSnapshot })
        ]),
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
                        '打开好友实例',
                        'instance.open',
                        { location: selected?.location },
                        !selected?.location
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
                        !selected?.location
                    )
                ])
            ]),
            renderCurrentInstanceCard(snap)
        ])
    ];
}

function renderCurrentInstanceCard(snap) {
    return el('article', { class: 'panel' }, [
        el('div', { class: 'panel-heading' }, [
            el('h2', { text: '当前实例' }),
            el('span', {
                class: 'badge',
                text: snap?.game?.isRunning ? 'VRChat 运行中' : 'VRChat 未运行'
            })
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
                text: `VRChat：${snap?.game?.isRunning ? '运行中' : '未运行'}`
            }),
            el('span', {
                text: `SteamVR：${snap?.game?.isSteamVrRunning ? '运行中' : '未运行'}`
            })
        ]),
        el('div', { class: 'button-grid' }, [
            actionButton(
                '打开当前实例',
                'instance.open',
                { location: snap?.location?.location },
                !snap?.location?.location
            ),
            actionButton(
                '启动并加入',
                'instance.launch',
                { location: snap?.location?.location, desktopMode: false },
                !snap?.location?.location
            )
        ])
    ]);
}

function renderInstanceView(snap) {
    const users = snap?.location?.users || [];
    return [
        el('header', { class: 'toolbar' }, [
            el('div', {}, [
                el('h1', { text: '实例' }),
                el('p', { text: safeText(snap?.location?.location, '未检测到当前位置') })
            ]),
            el('button', { class: 'ghost-button', text: '刷新', onClick: refreshSnapshot })
        ]),
        el('div', { class: 'dashboard-grid' }, [
            renderCurrentInstanceCard(snap),
            el('article', { class: 'panel' }, [
                el('div', { class: 'panel-heading' }, [
                    el('h2', { text: '当前实例玩家' }),
                    el('span', { class: 'badge', text: String(users.length) })
                ]),
                el(
                    'div',
                    { class: 'compact-list' },
                    users.slice(0, 24).map((user) =>
                        el('div', { class: 'compact-row' }, [
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
    return [
        el('header', { class: 'toolbar' }, [
            el('div', {}, [
                el('h1', { text: '通知中心' }),
                el('p', { text: `当前显示 ${notifications.length} 条通知` })
            ]),
            actionButton('清理通知中心', 'ui.clearNotificationCenter', {})
        ]),
        el('div', { class: 'notification-list' }, [
            ...(notifications.length
                ? notifications.map((noty) =>
                      el('article', { class: 'notification' }, [
                          el('strong', {
                              text: noty.senderUsername || noty.type
                          }),
                          el('small', {
                              text: `${noty.type} · ${noty.created_at || ''}`
                          }),
                          el('p', { text: noty.message || '无正文' }),
                          noty.type?.includes('invite')
                              ? el('button', {
                                    class: 'action-button',
                                    text: '响应邀请',
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
                  )
                : [
                      el('article', { class: 'notification' }, [
                          el('strong', { text: '没有通知' }),
                          el('p', { text: '通知中心当前没有可显示的内容。' })
                      ])
                  ])
        ])
    ];
}

function renderStatusView(snap) {
    const statuses = [
        ['active', '在线'],
        ['join me', '欢迎加入'],
        ['ask me', '需要询问'],
        ['busy', '忙碌']
    ];
    return [
        el('header', { class: 'toolbar' }, [
            el('div', {}, [
                el('h1', { text: '社交状态' }),
                el('p', {
                    text: `${statusLabel(snap?.status?.value)} ${
                        snap?.status?.description || ''
                    }`
                })
            ]),
            renderStatusBadge(snap)
        ]),
        el('article', { class: 'panel wide' }, [
            el('h2', { text: '切换状态' }),
            el('div', { class: 'status-buttons' }, [
                ...statuses.map(([status, label]) =>
                    actionButton(label, 'user.setStatus', {
                        status,
                        statusDescription: snap?.status?.description || ''
                    })
                )
            ])
        ])
    ];
}

function renderContent(snap, selected) {
    if (!snap?.loggedIn) {
        return [
            el('section', { class: 'empty-state' }, [
                el('h1', { text: '主程序未登录' }),
                el('p', {
                    text: '网页远控依赖 VRCX 主程序已启动并登录 VRChat。'
                })
            ])
        ];
    }
    if (state.view === 'instances') {
        return renderInstanceView(snap);
    }
    if (state.view === 'notifications') {
        return renderNotificationsView(snap);
    }
    if (state.view === 'status') {
        return renderStatusView(snap);
    }
    return renderFriendsView(snap, selected);
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
            el('aside', { class: 'nav' }, [
                el('div', { class: 'brand' }, [
                    el('img', { src: logoUrl, alt: '' }),
                    el('span', { text: 'VRCX-Luo' })
                ]),
                renderNavItem('friends', '好友'),
                renderNavItem('instances', '实例'),
                renderNavItem('notifications', '通知'),
                renderNavItem('status', '状态'),
                el('button', {
                    class: 'nav-item danger',
                    text: '退出网页',
                    onClick: logout
                })
            ]),
            el('section', { class: 'sidebar' }, [
                el('div', { class: 'me-card' }, [
                    renderAvatar(snap?.currentUser, 'avatar large'),
                    el('div', {}, [
                        el('strong', {
                            text: snap?.currentUser?.displayName || '未登录'
                        }),
                        el('small', {
                            text: `${statusLabel(snap?.status?.value)} ${
                                snap?.status?.description || ''
                            }`
                        })
                    ]),
                    el('div', { class: 'remote-state' }, [
                        el('span', { text: `WebSocket：${connectionLabel()}` }),
                        renderStatusBadge(snap)
                    ])
                ]),
                el('div', { class: 'friend-list' }, friends.map(renderFriend))
            ]),
            el('section', { class: 'content' }, [
                state.error
                    ? el('div', { class: 'banner error-text', text: state.error })
                    : '',
                ...renderContent(snap, selected)
            ])
        ])
    );
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
