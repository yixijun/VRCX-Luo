import { getNotificationTs } from "../../shared/utils/notificationCategory";

const DEFAULT_LIMIT = 4;
const MAX_TEXT_LENGTH = 180;

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
    const responseActions = Array.isArray(notification?.responses)
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

function buildTrayNotificationSnapshot({
    notifications = [],
    unseenIds = [],
    hiddenIds = [],
    now = Date.now(),
    limit = DEFAULT_LIMIT,
    formatMessage,
    getAvatarUrl,
    theme = TRAY_THEME_FALLBACK,
} = {}) {
    const unseen = new Set(unseenIds);
    const hidden = new Set(hiddenIds);
    const pending = notifications
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
        return {
            id: notification.id,
            type: notification.type || "",
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
    respondToNotification,
    acceptInvite,
    declineInvite,
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

        if (!notificationId) return false;
        const notification = findNotification(notificationId);
        if (!notification) return false;

        if (action === "open") {
            if (!openNotification) return false;
            await openNotification(notification);
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
};
