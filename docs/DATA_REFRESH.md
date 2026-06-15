# VRCX-Luo 数据刷新机制说明

本文档描述 VRCX-Luo 中"好友动态 (Feed)"等数据是如何被采集、刷新和持久化的。
数据采集采用了**四层架构**，按实时性从高到低排列。

---

## 1. 总览：四层刷新架构

| 层级 | 数据源 | 时效性 | 涵盖内容 |
|:---|:---|:---|:---|
| **L1 游戏日志** | 本地 `output_log.txt` | ≈ 实时 (秒级扫描) | 精确的进房/退房记录、谁加入/离开了你的实例 |
| **L2 WebSocket** | VRChat Pipeline 推送 | ≈ 实时 (秒级) | 好友上下线、位置变更、Bio/头像/状态变更 |
| **L3 轮询 (5分钟)** | VRChat REST API | 5 分钟 | 自身状态、群组实例列表 |
| **L4 全量同步 (1小时)** | VRChat REST API | 1 小时 | 全体好友列表的完整信息刷新 |

另有 **Luo 特供的数据补全机制**，用于弥补离线期间的数据缺口。

---

## 2. 各层详细说明

### 2.1 L1 — 游戏日志监控 (LogWatcher)

- **触发条件**：VRChat 游戏正在运行时。
- **原理**：实时读取本地游戏日志文件 `output_log.txt`，解析出进房 (`OnPlayerJoined`)、退房 (`OnPlayerLeft`) 等事件。
- **写入的数据库表**：`gamelog_join_leave`、`gamelog_location`。
- **数据用途**：双人关系查询 (TwoPersonRelationship)、关系时间轴等核心功能的数据基础。

### 2.2 L2 — WebSocket 实时推送 (Pipeline)

这是 Feed 页面中大部分"即时通知"的来源。

- **触发条件**：VRCX 登录后自动建立 WebSocket 连接。
- **核心入口文件**：[`src/services/websocket.js`](../src/services/websocket.js) 中的 `handlePipeline()`。
- **推送事件类型及处理方式**：

| WebSocket 事件 | 触发时机 | 处理函数 | 写入的 Feed 类型 |
|:---|:---|:---|:---|
| `friend-online` | 好友上线 | `applyUser()` → `runUpdateFriendFlow()` | Online/Offline |
| `friend-offline` | 好友下线 | `applyUser()` → `runUpdateFriendFlow()` | Online/Offline |
| `friend-active` | 好友变为 Active 状态 | `applyUser()` → `runUpdateFriendFlow()` | Online/Offline |
| `friend-location` | 好友更换世界/实例 | `applyUser()` → `runHandleUserUpdateFlow()` | GPS |
| `friend-update` | 好友资料变更 (Bio/头像/状态等) | `applyUser()` → `runHandleUserUpdateFlow()` | Bio / Avatar / Status |
| `friend-add` | 新增好友 | `handleFriendAdd()` | Friend |
| `friend-delete` | 删除好友 | `handleFriendDelete()` | Unfriend |
| `user-update` | 自己的资料变更 | `applyCurrentUser()` | — |
| `user-location` | 自己更换世界 | `runSetCurrentUserLocationFlow()` | GPS (自身) |

**关键流程链**：
```
WebSocket message
  └→ handlePipeline()                    [websocket.js]
       └→ applyUser(json)               [userCoordinator.js]
            ├→ diffObjectProps(ref, json)  — 比较新旧值
            └→ handleUserUpdate(ref, changedProps)
                 └→ runHandleUserUpdateFlow()  [userEventCoordinator.js]
                      ├→ feedStore.addFeedEntry()    — 推送到 UI
                      ├→ database.addXxxToDatabase() — 持久化到 SQLite
                      └→ notificationStore.queueFeedNoty() — 桌面通知
```

#### 2.2.1 Bio 更新的具体触发条件

在 `runHandleUserUpdateFlow()` ([`src/coordinators/userEventCoordinator.js`](../src/coordinators/userEventCoordinator.js) 第 309 行) 中：
```javascript
if (props.bio && props.bio[0] && props.bio[1]) {
    // 仅当新旧值都非空时才记录
}
```
- **条件**：`props.bio[0]`（新值）和 `props.bio[1]`（旧值）都必须**非空**才会写入 `_feed_bio` 表。
- **含义**：如果用户之前没有缓存过 Bio（即第一次见到这个好友），即使 WebSocket 推送了 Bio 信息，也不会记录——因为旧值为空。

#### 2.2.2 Status/StatusDescription 更新

在同一文件的第 262-308 行处理。会同时记录灯色 (`status`) 和自定义状态描述 (`statusDescription`)。
- 忽略 `offline` 状态的变更。
- 仅当 `status` 或 `statusDescription` 其中之一发生变化时记录。

#### 2.2.3 Avatar 更新

在第 163-259 行处理。当检测到 `currentAvatarImageUrl` 或 `currentAvatarThumbnailImageUrl` 变化时记录，同时会异步查询头像名称和作者信息。

#### 2.2.4 GPS (位置变更)

在第 90-152 行处理。需要满足以下条件才记录：
- 不是 `offline → xxx` 或 `xxx → offline` 的跳变。
- 不是 `traveling` 状态（traveling 状态会暂存 `$previousLocation`，等到到达后再记录）。
- 之前有有效的位置记录。

### 2.3 L3 — 短周期轮询 (5 分钟)

- **控制文件**：[`src/stores/updateLoop.js`](../src/stores/updateLoop.js)。
- **计时器变量**：
  - `state.nextCurrentUserRefresh`：初始值 **300 秒 (5 分钟)**。
  - `state.nextGroupInstanceRefresh`：初始值 **300 秒 (5 分钟)**。
- **触发动作**：
  - 调用 `getCurrentUser()` 刷新自身状态。
  - 刷新群组实例列表

### 2.4 L4 — 全量好友同步 (1 小时)

- **控制文件**：同 `updateLoop.js`。
- **计时器变量**：`state.nextFriendsRefresh`，初始值 **3600 秒 (1 小时)**。
- **触发动作**：调用 `runRefreshFriendsListFlow()`，走到 [`src/coordinators/friendSyncCoordinator.js`](../src/coordinators/friendSyncCoordinator.js)。
- **具体流程**：
  1. 调用 VRChat API 批量拉取好友列表（并发 5、限速 60 req/min）。
  2. 对每个好友执行 `applyUser()`，触发与 L2 相同的 diff + 入库逻辑。
  3. 顺带更新搜索索引和好友排序。
- **这一层能采集到的变更**：Bio、Avatar、Status、DisplayName、在线状态 —— 本质上是对 L2 WebSocket 推送的**兜底补全**。

---

## 3. Luo 特供：数据补全机制 (Silent Info Fetch)

- **核心入口**：[`src/coordinators/infoFetchCoordinator.js`](../src/coordinators/infoFetchCoordinator.js) 中的 `runSilentInfoFetch()`。
- **触发时机**：应用启动或断网重连后自动触发，也可由用户手动触发。
- **原理**：遍历内存中的全部好友，逐个与数据库最后一条记录比对：
  - **Bio**：如果当前 Bio 与数据库中最新记录不一致，则补写一条。
  - **Status**：仅当灯色（`status`）本身发生变化时记录（忽略仅 `statusDescription` 的变化）。
- **与原版的区别**：

| 维度 | 原版 (L2 WebSocket / L4 全量同步) | Luo 补全 (Silent Info Fetch) |
|:---|:---|:---|
| **触发方式** | 被动推送 / 定时轮询 | 主动全量扫描 |
| **Bio 记录条件** | 新旧值都非空才记录 | 只要与数据库最新值不同就记录 |
| **适用场景** | 常规在线使用 | 弥补离线期间丢失的变更、首次使用时的全量存档 |
| **可捕获的盲区** | 无法捕获 VRCX 未运行时的变更 | ✅ 可以 |

---

## 4. 数据持久化：Feed 数据库表结构

所有 Feed 数据写入 SQLite，表名以当前登录用户 ID 为前缀（如 `usr_xxx_feed_gps`）。

| 表名后缀 | 数据类型 | 写入时机 |
|:---|:---|:---|
| `_feed_gps` | 位置变更 | L1 / L2 / L4 |
| `_feed_status` | 灯色/状态描述变更 | L2 / L4 / Luo补全 |
| `_feed_bio` | 个人简介变更 | L2 / L4 / Luo补全 / 打开用户资料页 |
| `_feed_avatar` | 头像变更 | L2 / L4 |
| `_feed_online_offline` | 上线/下线 | L2 |
| `gamelog_join_leave` | 进房/退房 (游戏日志) | L1 |
| `gamelog_location` | 实例信息 | L1 |

UI 层的 Feed 查询通过 `UNION ALL` 将以上多张表聚合展示。
具体实现参见 [`src/services/database/feed.js`](../src/services/database/feed.js) 中的 `lookupFeedDatabase()`。

---

## 5. 额外细节

### 5.1 打开用户资料页时的 Bio 快照

在 [`src/coordinators/userCoordinator.js`](../src/coordinators/userCoordinator.js) 的 `showUserDialog()` 中（第 464-488 行），当用户打开某个人的资料页时：
1. 会发起一次 API 请求拉取最新资料。
2. 拉取完成后，将当前 Bio 与数据库中最后一条记录比对。
3. 如果不同，且该变更**不会被 `runHandleUserUpdateFlow` 同时记录**（防止重复），则额外补写一条。
4. 这意味着：即使是**非好友**，只要你打开过他的资料页，Bio 也会被记录。

### 5.2 WebSocket 断线重连

在 `websocket.js` 第 102-110 行：
```javascript
workerTimers.setTimeout(() => {
    if (watchState.isLoggedIn && watchState.isFriendsLoaded && webSocket === null) {
        initWebsocket();
    }
}, 5000);
```
WebSocket 断开后 **5 秒**自动尝试重连。

### 5.3 轮询计时器的实现方式

`updateLoop.js` 使用 `workerTimers`（基于 Web Worker 的定时器），避免浏览器后台标签页节流导致计时器不准确。主循环每 **1 秒**检查一次各计时器是否到期。

---

## 6. 关键源文件索引

| 文件 | 职责 |
|:---|:---|
| [`src/stores/updateLoop.js`](../src/stores/updateLoop.js) | 主循环"心跳"，管理所有轮询计时器 |
| [`src/services/websocket.js`](../src/services/websocket.js) | WebSocket 连接管理和事件分发 |
| [`src/coordinators/userCoordinator.js`](../src/coordinators/userCoordinator.js) | `applyUser()` — 用户信息应用与 diff 检测 |
| [`src/coordinators/userEventCoordinator.js`](../src/coordinators/userEventCoordinator.js) | `runHandleUserUpdateFlow()` — 处理 diff 结果，写入 Feed |
| [`src/coordinators/friendPresenceCoordinator.js`](../src/coordinators/friendPresenceCoordinator.js) | 好友在线状态变更处理，写入 Online/Offline |
| [`src/coordinators/friendSyncCoordinator.js`](../src/coordinators/friendSyncCoordinator.js) | 全量好友列表刷新编排 |
| [`src/coordinators/infoFetchCoordinator.js`](../src/coordinators/infoFetchCoordinator.js) | **[Luo]** 数据补全扫描 |
| [`src/stores/feed.js`](../src/stores/feed.js) | Feed Store — UI 层的数据管理 |
| [`src/services/database/feed.js`](../src/services/database/feed.js) | Feed 数据库读写，`UNION ALL` 聚合查询 |
