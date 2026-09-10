import {
    getNotificationCategory,
    getNotificationTs,
} from "../../shared/utils/notificationCategory";

const DEFAULT_LIMIT = 4;
const MAX_TEXT_LENGTH = 180;

const TRAY_CATEGORY_LABELS = Object.freeze({
    friend: "好友",
    group: "群组",
    other: "其他",
});

const TRAY_NOTIFICATION_META = Object.freeze({
    requestInvite: { label: "邀请请求", icon: "send", accent: "primary", priority: 80 },
    invite: { label: "邀请", icon: "send", accent: "primary", priority: 90 },
    inviteResponse: { label: "邀请回复", icon: "send", accent: "primary", priority: 55 },
    requestInviteResponse: { label: "邀请请求回复", icon: "send", accent: "primary", priority: 55 },
    friendRequest: { label: "好友申请", icon: "user-plus", accent: "primary", priority: 100 },
    ignoredFriendRequest: { label: "已忽略好友申请", icon: "user-plus", accent: "muted", priority: 20 },
    boop: { label: "戳一戳", icon: "message-circle", accent: "primary", priority: 70 },
    message: { label: "消息", icon: "mail", accent: "primary", priority: 65 },
    groupChange: { label: "群组变更", icon: "users", accent: "group", priority: 60 },
    "group.announcement": { label: "群组公告", icon: "megaphone", accent: "group", priority: 65 },
    "group.informative": { label: "群组信息", icon: "info", accent: "group", priority: 50 },
    "group.invite": { label: "群组邀请", icon: "users", accent: "group", priority: 85 },
    "group.joinRequest": { label: "入群申请", icon: "user-plus", accent: "group", priority: 95 },
    "group.transfer": { label: "群组转移", icon: "users", accent: "group", priority: 75 },
    "group.queueReady": { label: "群组队列", icon: "clock", accent: "group", priority: 60 },
    "instance.closed": { label: "房间关闭", icon: "door-open", accent: "warning", priority: 55 },
    Friend: { label: "成为好友", icon: "user-plus", accent: "primary", priority: 80 },
    Unfriend: { label: "解除好友", icon: "user-minus", accent: "muted", priority: 30 },
    TrustLevel: { label: "信任等级", icon: "shield", accent: "primary", priority: 40 },
    DisplayName: { label: "昵称变化", icon: "pencil", accent: "primary", priority: 40 },
    OnPlayerJoined: { label: "玩家上线", icon: "log-in", accent: "success", priority: 35 },
    OnPlayerLeft: { label: "玩家离开", icon: "log-out", accent: "muted", priority: 25 },
    OnPlayerJoining: { label: "玩家加入中", icon: "log-in", accent: "primary", priority: 30 },
    GPS: { label: "位置变化", icon: "map-pin", accent: "primary", priority: 30 },
    Online: { label: "上线", icon: "circle", accent: "success", priority: 35 },
    Offline: { label: "离线", icon: "circle", accent: "muted", priority: 25 },
    Status: { label: "状态变化", icon: "activity", accent: "primary", priority: 30 },
    PortalSpawn: { label: "传送门", icon: "door-open", accent: "primary", priority: 45 },
    AvatarChange: { label: "头像变化", icon: "image", accent: "primary", priority: 35 },
    ChatBoxMessage: { label: "ChatBox 消息", icon: "message-circle", accent: "primary", priority: 65 },
    Event: { label: "事件", icon: "calendar", accent: "primary", priority: 45 },
    External: { label: "外部通知", icon: "external-link", accent: "primary", priority: 45 },
    VideoPlay: { label: "视频播放", icon: "play", accent: "primary", priority: 35 },
    BlockedOnPlayerJoined: { label: "屏蔽玩家上线", icon: "shield-off", accent: "muted", priority: 20 },
    BlockedOnPlayerLeft: { label: "屏蔽玩家离开", icon: "shield-off", accent: "muted", priority: 20 },
    MutedOnPlayerJoined: { label: "静音玩家上线", icon: "volume-x", accent: "muted", priority: 20 },
    MutedOnPlayerLeft: { label: "静音玩家离开", icon: "volume-x", accent: "muted", priority: 20 },
    Blocked: { label: "已屏蔽", icon: "shield-off", accent: "muted", priority: 20 },
    Unblocked: { label: "已解除屏蔽", icon: "shield", accent: "primary", priority: 25 },
    Muted: { label: "已静音", icon: "volume-x", accent: "muted", priority: 20 },
    Unmuted: { label: "已解除静音", icon: "volume-2", accent: "primary", priority: 25 },
});

const TRAY_NOTIFICATION_FALLBACK = Object.freeze({
    label: "通知",
    icon: "bell",
    accent: "muted",
    priority: 10,
});

/**
 * Returns stable presentation metadata for every notification type known by
 * the App notification center. Unknown group/moderation types still receive
 * a useful category instead of disappearing into an unlabelled card.
 *
 * @param {string} type
 * @returns {{type: string, category: string, categoryLabel: string, label: string, icon: string, accent: string, priority: number}}
 */
function getTrayNotificationMeta(type) {
    const normalizedType = String(type || "");
    const category = getNotificationCategory(normalizedType);
    const exact = TRAY_NOTIFICATION_META[normalizedType];
    const fallback = exact ||
        (normalizedType.startsWith("group.")
            ? { label: "群组通知", icon: "users", accent: "group", priority: 45 }
            : normalizedType.startsWith("moderation.")
                ? { label: "管理通知", icon: "shield", accent: "warning", priority: 45 }
                : TRAY_NOTIFICATION_FALLBACK);
    return {
        type: normalizedType,
        category,
        categoryLabel: TRAY_CATEGORY_LABELS[category] || TRAY_CATEGORY_LABELS.other,
        ...fallback,
    };
}

const TRAY_THEME_FALLBACK = Object.freeze({
    background: "#242426",
    surface: "#313135",
    hover: "#3d3d43",
    foreground: "#f4f4f5",
    mutedForeground: "#a1a1aa",
    primary: "#e4e4e7",
    primaryForeground: "#27272a",
    destructive: "#f87171",
});

function getTrayNotificationTheme() {
    if (
        typeof document === "undefined" ||
        typeof window === "undefined" ||
        !document.body
    ) {
        return { ...TRAY_THEME_FALLBACK };
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { ...TRAY_THEME_FALLBACK };

    const probe = document.createElement("span");
    probe.style.cssText =
        "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);

    const resolveColor = (variableName, fallback) => {
        try {
            probe.style.color = `var(${variableName})`;
            const cssColor = window.getComputedStyle(probe).color;
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = cssColor;
            context.fillRect(0, 0, 1, 1);
            const [red, green, blue, alpha] = context.getImageData(
                0,
                0,
                1,
                1,
            ).data;
            if (alpha === 0) return fallback;
            return `#${[red, green, blue]
                .map((value) => value.toString(16).padStart(2, "0"))
                .join("")}`;
        } catch {
            return fallback;
        }
    };

    const theme = {
        background: resolveColor("--popover", TRAY_THEME_FALLBACK.background),
        surface: resolveColor("--surface-panel", TRAY_THEME_FALLBACK.surface),
        hover: resolveColor("--surface-hover", TRAY_THEME_FALLBACK.hover),
        foreground: resolveColor(
            "--foreground",
            TRAY_THEME_FALLBACK.foreground,
        ),
        mutedForeground: resolveColor(
            "--muted-foreground",
            TRAY_THEME_FALLBACK.mutedForeground,
        ),
        primary: resolveColor("--primary", TRAY_THEME_FALLBACK.primary),
        primaryForeground: resolveColor(
            "--primary-foreground",
            TRAY_THEME_FALLBACK.primaryForeground,
        ),
        destructive: resolveColor(
            "--destructive",
            TRAY_THEME_FALLBACK.destructive,
        ),
    };
    probe.remove();
    return theme;
}

function getServerResponseActions(notification) {
    return Array.isArray(notification?.responses)
        ? notification.responses
              .map((response, index) => ({ response, index }))
              .filter(
                  ({ response }) =>
                      response &&
                      typeof response.type === "string" &&
                      response.type.length > 0,
              )
              .slice(0, 2)
              .map(({ response, index }) => ({
                  id: `response:${index}`,
                  label: truncate(response.text || response.type || "操作"),
                  icon: response.icon || response.type,
              }))
        : [];
}

function getTrayNotificationActions(notification) {
    if (notification?.type === "invite") {
        return [
            { id: "invite-accept", label: "接受" },
            { id: "invite-decline", label: "拒绝" },
            { id: "ignore", label: "忽略" },
        ];
    }
    if (notification?.type === "boop") {
        return [
            { id: "boop-reply", label: "回戳" },
            { id: "ignore", label: "忽略" },
        ];
    }
    if (notification?.type === "friendRequest") {
        return [
            { id: "friend-accept", label: "接受" },
            { id: "friend-decline", label: "拒绝" },
            { id: "ignore", label: "忽略" },
        ];
    }
    if (notification?.type === "requestInvite") {
        const responseActions = getServerResponseActions(notification);
        return responseActions.length > 0
            ? [...responseActions, { id: "ignore", label: "忽略" }]
            : [
                  { id: "request-invite-accept", label: "邀请" },
                  { id: "ignore", label: "忽略" },
              ];
    }
    const responseActions = getServerResponseActions(notification);
    if (responseActions.length > 0) {
        return [...responseActions, { id: "ignore", label: "忽略" }];
    }
    return [{ id: "ignore", label: "忽略" }];
}

function truncate(value) {
    const text = String(value || "").trim();
    return text.length > MAX_TEXT_LENGTH
        ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}...`
        : text;
}

function isExpired(notification, now) {
    if (notification?.$isExpired === true) return true;
    if (!notification?.expiresAt) return false;
    const expiresAt = Date.parse(notification.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt <= now;
}

/**
 * @param {{notifications?: any[], additionalNotifications?: any[], unseenIds?: any[], additionalUnseenIds?: any[], hiddenIds?: any[], now?: number, limit?: number, formatMessage?: Function, getAvatarUrl?: Function, theme?: Record<string, string>}} [options]
 */
function buildTrayNotificationSnapshot({
    notifications = [],
    additionalNotifications = [],
    unseenIds = [],
    additionalUnseenIds = [],
    hiddenIds = [],
    now = Date.now(),
    limit = DEFAULT_LIMIT,
    formatMessage,
    getAvatarUrl,
    theme = TRAY_THEME_FALLBACK,
} = {}) {
    const allNotifications = [...notifications, ...additionalNotifications];
    const unseen = new Set([...unseenIds, ...additionalUnseenIds]);
    const hidden = new Set(hiddenIds);
    const pending = allNotifications
        .filter(
            (notification) =>
                notification?.id &&
                unseen.has(notification.id) &&
                notification.seen !== true &&
                !hidden.has(notification.id) &&
                !isExpired(notification, now),
        )
        .sort(
            (left, right) => getNotificationTs(right) - getNotificationTs(left),
        );

    const items = pending.slice(0, Math.max(0, limit)).map((notification) => {
        const message = formatMessage?.(notification) || {};
        const meta = getTrayNotificationMeta(notification.type);
        return {
            id: notification.id,
            type: notification.type || "",
            category: meta.category,
            categoryLabel: meta.categoryLabel,
            typeLabel: meta.label,
            icon: meta.icon,
            accent: meta.accent,
            priority: meta.priority,
            title: truncate(
                message.title || notification.senderUsername || "VRCX-Luo",
            ),
            body: truncate(message.body || notification.message || ""),
            createdAt: notification.createdAt || notification.created_at || "",
            avatarUrl: getAvatarUrl?.(notification) || "",
            actions: getTrayNotificationActions(notification),
        };
    });

    return {
        total: pending.length,
        items,
        theme: { ...TRAY_THEME_FALLBACK, ...theme },
    };
}

function createTrayNotificationActionHandler({
    findNotification,
    isExpired,
    openNotification,
    openNotificationCenter,
    respondToNotification,
    acceptInvite,
    declineInvite,
    acceptRequestInvite,
    acceptFriendRequest,
    declineFriendRequest,
    replyBoop,
    ignoreNotifications,
    getPreviewIds = () => [],
}) {
    return async (action, notificationId) => {
        if (action === "ignore-all") {
            const ids = getPreviewIds().filter(Boolean);
            if (ids.length === 0) return false;
            await ignoreNotifications(ids);
            return true;
        }

        if (action === "open-center") {
            if (!openNotificationCenter) return false;
            await openNotificationCenter();
            return true;
        }

        if (!notificationId) return false;
        const notification = findNotification(notificationId);
        if (!notification) return false;

        if (action === "open") {
            if (!openNotification) return false;
            await openNotification(notification);
            return true;
        }

        if (action === "request-invite-accept") {
            if (
                notification.type !== "requestInvite" ||
                !acceptRequestInvite ||
                isExpired(notification)
            ) {
                return false;
            }
            await acceptRequestInvite(notification);
            return true;
        }

        if (action.startsWith("response:")) {
            const responseIndex = Number.parseInt(action.slice("response:".length), 10);
            const response = notification.responses?.[responseIndex];
            if (
                !Number.isInteger(responseIndex) ||
                responseIndex < 0 ||
                !response ||
                !respondToNotification ||
                isExpired(notification)
            ) {
                return false;
            }
            await respondToNotification(notification, response);
            return true;
        }

        const handlers = {
            "invite-accept": acceptInvite,
            "invite-decline": declineInvite,
            "friend-accept": acceptFriendRequest,
            "friend-decline": declineFriendRequest,
            "boop-reply": replyBoop,
            ignore: (notification) => ignoreNotifications([notification.id]),
        };
        const handler = handlers[action];
        if (!handler || isExpired(notification)) return false;
        if (action.startsWith("invite-") && notification.type !== "invite") {
            return false;
        }
        if (
            action.startsWith("friend-") &&
            notification.type !== "friendRequest"
        ) {
            return false;
        }
        if (action === "boop-reply" && notification.type !== "boop") {
            return false;
        }

        await handler(notification);
        return true;
    };
}

export {
    buildTrayNotificationSnapshot,
    createTrayNotificationActionHandler,
    getTrayNotificationTheme,
    getTrayNotificationActions,
    getTrayNotificationMeta,
};
