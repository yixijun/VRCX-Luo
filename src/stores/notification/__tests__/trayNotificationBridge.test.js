import { describe, expect, test } from "vitest";

import {
    buildTrayNotificationSnapshot,
    createTrayNotificationActionHandler,
    getTrayNotificationActions,
    getTrayNotificationMeta,
} from "../trayNotificationBridge";

const now = Date.parse("2026-08-13T12:00:00Z");

function notification(overrides = {}) {
    return {
        id: "not_1",
        type: "invite",
        senderUsername: "Alice",
        message: "Come join",
        createdAt: "2026-08-13T11:59:00Z",
        seen: false,
        ...overrides,
    };
}

describe("tray notification snapshot", () => {
    test("shows only pending notifications and orders them newest first", () => {
        const snapshot = buildTrayNotificationSnapshot({
            notifications: [
                notification({ id: "old", createdAt: "2026-08-13T11:00:00Z" }),
                notification({ id: "seen", seen: true }),
                notification({
                    id: "expired",
                    expiresAt: "2026-08-13T10:00:00Z",
                }),
                notification({ id: "hidden" }),
                notification({ id: "new", createdAt: "2026-08-13T11:30:00Z" }),
            ],
            unseenIds: ["old", "expired", "hidden", "new"],
            hiddenIds: ["hidden"],
            now,
            formatMessage: (item) => ({
                title: item.senderUsername,
                body: item.message,
            }),
        });

        expect(snapshot.items.map((item) => item.id)).toEqual(["new", "old"]);
        expect(snapshot.total).toBe(2);
    });

    test("limits the preview while preserving the total pending count", () => {
        const notifications = Array.from({ length: 6 }, (_, index) =>
            notification({
                id: `not_${index}`,
                createdAt: new Date(now - index * 1000).toISOString(),
            }),
        );

        const snapshot = buildTrayNotificationSnapshot({
            notifications,
            unseenIds: notifications.map((item) => item.id),
            now,
            limit: 4,
            formatMessage: () => ({ title: "Title", body: "Body" }),
        });

        expect(snapshot.items).toHaveLength(4);
        expect(snapshot.total).toBe(6);
    });

    test("includes the active application theme in the native preview snapshot", () => {
        const snapshot = buildTrayNotificationSnapshot({
            notifications: [notification()],
            unseenIds: ["not_1"],
            now,
            theme: {
                primary: "#12ab34",
                background: "#101114",
            },
        });

        expect(snapshot.theme.primary).toBe("#12ab34");
        expect(snapshot.theme.background).toBe("#101114");
        expect(snapshot.theme.foreground).toBe("#f4f4f5");
    });

    test("includes the sender avatar selected by the friend-list image policy", () => {
        const snapshot = buildTrayNotificationSnapshot({
            notifications: [notification({ senderUserId: "usr_alice" })],
            unseenIds: ["not_1"],
            now,
            getAvatarUrl: (item) =>
                item.senderUserId === "usr_alice"
                    ? "https://files.vrchat.cloud/avatar.png"
                    : "",
        });

        expect(snapshot.items[0].avatarUrl).toBe(
            "https://files.vrchat.cloud/avatar.png",
        );
    });

    test("includes type metadata so every app notification has a tray identity", () => {
        const snapshot = buildTrayNotificationSnapshot({
            notifications: [notification()],
            unseenIds: ["not_1"],
            now,
            formatMessage: () => ({ title: "Alice", body: "Come join" }),
        });

        expect(snapshot.items[0]).toMatchObject({
            category: "friend",
            categoryLabel: "好友",
            icon: "send",
            accent: "primary",
        });
    });

    test.each([
        ["OnPlayerJoined", "玩家上线"],
        ["OnPlayerLeft", "玩家离开"],
        ["Online", "上线"],
        ["Offline", "离线"],
        ["Status", "状态变化"],
        ["group.announcement", "群组公告"],
        ["group.joinRequest", "入群申请"],
        ["instance.closed", "房间关闭"],
        ["AvatarChange", "头像变化"],
        ["ChatBoxMessage", "ChatBox 消息"],
        ["External", "外部通知"],
        ["MutedOnPlayerLeft", "静音玩家离开"],
    ])("provides a label for %s", (type, label) => {
        expect(getTrayNotificationMeta(type).label).toBe(label);
    });

    test("offers accept, decline and ignore for invitations", () => {
        expect(getTrayNotificationActions(notification())).toEqual([
            { id: "invite-accept", label: "接受" },
            { id: "invite-decline", label: "拒绝" },
            { id: "ignore", label: "忽略" },
        ]);
    });

    test("offers accept, decline and ignore for friend requests", () => {
        expect(
            getTrayNotificationActions(notification({ type: "friendRequest" })),
        ).toEqual([
            { id: "friend-accept", label: "接受" },
            { id: "friend-decline", label: "拒绝" },
            { id: "ignore", label: "忽略" },
        ]);
    });

    test("offers quick reply and ignore for boops", () => {
        expect(
            getTrayNotificationActions(notification({ type: "boop" })),
        ).toEqual([
            { id: "boop-reply", label: "回戳" },
            { id: "ignore", label: "忽略" },
        ]);
    });

    test("offers an accept action for invite requests", () => {
        expect(
            getTrayNotificationActions(notification({ type: "requestInvite" })),
        ).toEqual([
            { id: "request-invite-accept", label: "邀请" },
            { id: "ignore", label: "忽略" },
        ]);
    });

    test("uses server-provided actions for actionable special notifications", () => {
        expect(
            getTrayNotificationActions(
                notification({
                    type: "group.invite",
                    responses: [
                        { type: "accept", text: "加入群组", icon: "check" },
                        { type: "reject", text: "拒绝", icon: "cancel" },
                        { type: "link", text: "查看群组", icon: "link" },
                    ],
                }),
            ),
        ).toEqual([
            {
                id: "response:0",
                label: "加入群组",
                icon: "check",
            },
            {
                id: "response:1",
                label: "拒绝",
                icon: "cancel",
            },
            { id: "ignore", label: "忽略" },
        ]);
    });
});

describe("tray notification actions", () => {
    test("executes only known actions for current notifications", async () => {
        const calls = [];
        const current = notification({ id: "current" });
        const handle = createTrayNotificationActionHandler({
            findNotification: (id) => (id === current.id ? current : null),
            isExpired: () => false,
            acceptInvite: async (item) => calls.push(["accept", item.id]),
            declineInvite: async (item) => calls.push(["decline", item.id]),
            replyBoop: async (item) => calls.push(["boop", item.id]),
            ignoreNotifications: async (ids) => calls.push(["ignore", ids]),
        });

        await expect(handle("invite-accept", "current")).resolves.toBe(true);
        await expect(handle("unknown-action", "current")).resolves.toBe(false);
        await expect(handle("invite-decline", "missing")).resolves.toBe(false);
        expect(calls).toEqual([["accept", "current"]]);
    });

    test("routes the boop reply action to the reply flow", async () => {
        const current = notification({
            id: "boop_1",
            type: "boop",
            senderUserId: "usr_sender",
        });
        const replyBoop = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: (id) => (id === current.id ? current : null),
            isExpired: () => false,
            acceptInvite: vi.fn(),
            declineInvite: vi.fn(),
            replyBoop,
            ignoreNotifications: vi.fn(),
        });

        await expect(handle("boop-reply", current.id)).resolves.toBe(true);

        expect(replyBoop).toHaveBeenCalledWith(current);
    });

    test("routes invite-request acceptance to the existing store action", async () => {
        const current = notification({
            id: "request_1",
            type: "requestInvite",
        });
        const acceptRequestInvite = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: (id) => (id === current.id ? current : null),
            isExpired: () => false,
            acceptRequestInvite,
            ignoreNotifications: vi.fn(),
        });

        await expect(
            handle("request-invite-accept", current.id),
        ).resolves.toBe(true);
        expect(acceptRequestInvite).toHaveBeenCalledWith(current);
    });

    test("routes friend request actions only for friend requests", async () => {
        const current = notification({
            id: "friend_1",
            type: "friendRequest",
        });
        const acceptFriendRequest = vi.fn();
        const declineFriendRequest = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: (id) => (id === current.id ? current : null),
            isExpired: () => false,
            acceptInvite: vi.fn(),
            declineInvite: vi.fn(),
            acceptFriendRequest,
            declineFriendRequest,
            replyBoop: vi.fn(),
            ignoreNotifications: vi.fn(),
        });

        await expect(handle("friend-accept", current.id)).resolves.toBe(true);
        await expect(handle("friend-decline", current.id)).resolves.toBe(true);

        expect(acceptFriendRequest).toHaveBeenCalledWith(current);
        expect(declineFriendRequest).toHaveBeenCalledWith(current);
    });

    test("opens a notification card through the matching page handler", async () => {
        const current = notification({ id: "open_1" });
        const openNotification = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: (id) => (id === current.id ? current : null),
            isExpired: () => false,
            openNotification,
            ignoreNotifications: vi.fn(),
        });

        await expect(handle("open", current.id)).resolves.toBe(true);
        expect(openNotification).toHaveBeenCalledWith(current);
    });

    test("opens the notification center without requiring a notification id", async () => {
        const openNotificationCenter = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: () => null,
            isExpired: () => false,
            openNotificationCenter,
            ignoreNotifications: vi.fn(),
        });

        await expect(handle("open-center", "")).resolves.toBe(true);
        expect(openNotificationCenter).toHaveBeenCalledOnce();
    });

    test("routes a server-provided response by its stable array index", async () => {
        const current = notification({
            id: "special_1",
            type: "group.invite",
            responses: [
                { type: "accept", text: "加入群组", icon: "check" },
            ],
        });
        const respondToNotification = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: (id) => (id === current.id ? current : null),
            isExpired: () => false,
            respondToNotification,
            ignoreNotifications: vi.fn(),
        });

        await expect(handle("response:0", current.id)).resolves.toBe(true);
        expect(respondToNotification).toHaveBeenCalledWith(
            current,
            current.responses[0],
        );
        await expect(handle("response:5", current.id)).resolves.toBe(false);
    });

    test("does not execute actions for expired notifications", async () => {
        const acceptInvite = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: () => notification(),
            isExpired: () => true,
            acceptInvite,
            declineInvite: vi.fn(),
            replyBoop: vi.fn(),
            ignoreNotifications: vi.fn(),
        });

        await expect(handle("invite-accept", "not_1")).resolves.toBe(false);
        expect(acceptInvite).not.toHaveBeenCalled();
    });

    test("ignores only the notification IDs in the current tray preview", async () => {
        const ignoreNotifications = vi.fn();
        const handle = createTrayNotificationActionHandler({
            findNotification: () => notification(),
            isExpired: () => false,
            acceptInvite: vi.fn(),
            declineInvite: vi.fn(),
            replyBoop: vi.fn(),
            ignoreNotifications,
            getPreviewIds: () => ["one", "two", "three"],
        });

        await expect(handle("ignore-all")).resolves.toBe(true);
        expect(ignoreNotifications).toHaveBeenCalledWith([
            "one",
            "two",
            "three",
        ]);
    });
});
