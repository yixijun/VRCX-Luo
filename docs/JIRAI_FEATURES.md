# VRCX-Jirai 改动清单（修正版）

> 基于原版 [vrcx-team/vrcx](https://github.com/vrcx-team/vrcx) 的分支。
>
> **只列出 jirai 特有**的改动。以下功能经确认都是 upstream 本来的，不是 jirai 加的，已移除：
> ~~关系网/共同好友、快速搜索(Ctrl+K)、Dashboard、Gallery/ScreenshotMetadata、My Avatars、
>  Avatar Tags、Chatbox黑名单、通知中心、Registry备份、笔记导出、自动改变状态、
>  My Avatars 页面、活动V2（activityV2.js）~~

## 目录

- [ ] [1. 双人关系（Two Person Relationship）](#1-双人关系two-person-relationship)
- [ ] [2. 关系时间轴（Relationship Timeline）](#2-关系时间轴relationship-timeline)
- [ ] [3. 手动关系（Manual Relations）](#3-手动关系manual-relations)
- [ ] [4. 追踪非好友（Tracked Non-Friends）](#4-追踪非好友tracked-non-friends)
- [ ] [5. 信息抓取补全 + 同步指示器（Bio/Status Fetch）](#5-信息抓取补全--同步指示器biostatus-fetch)
- [ ] [6. 个人简介 Diff 视图（Bio Diff）](#6-个人简介-diff-视图bio-diff)
- [ ] [7. 自动跟随好友实例（Auto Follow）](#7-自动跟随好友实例auto-follow)
- [ ] [8. 自动更新重定向到 Jirai 仓库](#8-自动更新重定向到-jirai-仓库)
- [ ] [9. 多账号功能 V4（WIP）](#9-多账号功能-v4wip)
- [ ] [10. 本地构建 脚本](#10-本地构建脚本)
- [ ] [11. 数据库结构文档](#11-数据库结构文档)
- [ ] [12. UI 美化合集](#12-ui-美化合集)
- [ ] [13. 构建配置调整（jirai 部分）](#13-构建配置调整jirai-部分)

---

## 1. 双人关系（Two Person Relationship）

**入口**: Charts → tab "双人关系"（Charts 页面中 "Instance Activity" 旁边的 tab）

**文件**: `src/views/Charts/components/TwoPersonRelationship.vue` (540 行)

### 核心逻辑

选择任意两位好友，分析他们历史上的**共处实例**。通过查询 `feed_gps` / `feed_status` 表，找出两个人在同一实例中同时出现的时间段。

```
查询思路：
1. 取 A 和 B 的 feed_gps 记录
2. JOIN 找出 location 相同的记录，按时间窗口判断是否同时在场
3. 排除 private/private 位置
```

### UI

```
┌── 双人关系 [？] ────────────────────────────────┐
│ ┌─选择好友A─┐  ⇄  ┌─选择好友B─┐                  │
│ └──────────┘      └──────────┘                   │
│ [好友A头像] [好友B头像]                           │
│ ┌── 共享实例列表 ──────────────────────────┐     │
│ │ 世界A   2026-03-23 14:00-16:00  2h 在场  │     │
│ │ 世界B   2026-03-22 10:00-11:00  1h 缺席  │     │
│ └─────────────────────────────────────────┘     │
│ 统计: 共处 12h · 同游 8 个世界                   │
└──────────────────────────────────────────────────┘
```

### 注意事项

- 排除 `private` / `private:private` 位置
- `AND time > 0` 防假阳性"在场"徽章
- 大量好友时 memoize 好友列表

---

## 2. 关系时间轴（Relationship Timeline）

**入口**: Charts → tab "关系时间轴"

**文件**: `src/views/Charts/components/RelationshipTimeline.vue` (589 行) + `relationshipTimelineUtils.js` (203 行)

### 核心逻辑

展示与好友的"关系热度"随时间的变化曲线，基于状态变更频率、同处时长等指标聚合。

```js
function computeTimelineData(friendId, events, windowDays = 7) {
    // 按时间窗口聚合，归一化为 0-1 分数
}
```

### UI

```
┌── 关系时间轴 ───────────────────────────────────┐
│ [TopN: ▾10] [平滑] [高亮]                        │
│ 活跃度 ┤ ●──●                                    │
│  0.8  ┤/    \      ●──●                         │
│  0.4  ┤●      \    /    \                       │
│       └──────────────────────────► 时间          │
│ 图例: ●共处 ▲状态变更 ■位置变更                   │
└──────────────────────────────────────────────────┘
```

### 注意事项

- 自适应 row-density 设置
- TopN 筛选只看关系最近的 N 个好友

---

## 3. 手动关系（Manual Relations）

**入口**: Charts → tab "好友关系网" → 页面顶部 "手动关系" 按钮 → 弹窗

**文件**:

- `src/services/database/manualRelations.js` (176 行)
- `src/views/Charts/components/ManualRelationsDialog.vue` (295 行)
- `src/stores/manualRelations.js` (395 行)

### 核心逻辑

用户手动定义"这两人有关系"。关系以绿色连线显示在关系网（MutualFriends）中。

```sql
{prefix}_manual_relations_MANUEL (user_id_a, user_id_b, relation_type, added_at)
```

- 按 `(id1, id2)` 排序归一化避免重复
- 基于同处频率自动推测可能的关联用户，前端弹出建议框

### UI

```
┌── 手动关系管理 ───────────────────────────────┐
│ user_A ━━ 好友 ━━ user_B          [删除]       │
│ user_C ━━ 好友 ━━ user_D          [删除]       │
│ [+添加关系]                                      │
│ ┌── 推测建议 ──────────────────────────────┐   │
│ │ user_X ↔ user_Y (共处 23 次)  [+添加]    │   │
│ └─────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

---

## 4. 追踪非好友（Tracked Non-Friends）

**入口**: 左侧侧栏 → 底部 "追踪" 面板（与好友/群组/世界同级别）

**文件**:

- `src/services/database/trackedNonFriends.js` (67 行)
- `src/stores/trackedNonFriends.js` (74 行)
- `src/views/Sidebar/components/TrackedNonFriendsSidebar.vue` (227 行)

### 核心逻辑

追踪**不是好友但想关注的人**。添加到侧栏后自动纳入信息抓取循环（bio + status 同步）。

```sql
{prefix}_tracked_nonfriends (user_id, display_name, added_at)
```

- 通过 `UserDialog` / 用户右键菜单添加追踪
- 添加后立即拉取一次 bio + status
- 移除时清理缓存的快照记录

### UI

```
┌── 追踪非好友 ──────────────────────────────────┐
│ [头像] User_X  状态描述...               [×]   │
│ [头像] User_Y  状态描述...               [×]   │
│                [ + 添加用户 ]                   │
└────────────────────────────────────────────────┘
```

---

## 5. 信息抓取补全 + 同步指示器（Bio/Status Fetch）

**入口**:

- 手动触发: Tools → System Tools → "信息抓取补全" 按钮 → 弹窗
- 自动触发: 启动时 + WebSocket 重连后自动执行
- 指示器: 状态栏（StatusBar）最左侧

**文件**:

- `src/coordinators/infoFetchCoordinator.js` (196 行)
- `src/views/Tools/dialogs/ProfileCompletionDialog.vue` (176 行)

### 核心逻辑

对指定用户列表批量调 API 获取 bio 和 status：

```js
async function runBioFetch(targetUsers, onProgress) {
    for (const [i, user] of targetUsers.entries()) {
        const bio = await fetchBio(user.id);
        const status = await fetchStatus(user.id);
        await saveSnapshot(user.id, bio, status);
        onProgress(i + 1, targetUsers.length);
    }
}
```

- **只记录红黄蓝绿 4 种主状态**变更，不记录 offline 和纯签名变化
- 状态栏显示 "信息同步: ████░░ 50%"

### UI

```
WebSocket: ● Connected | 信息同步: ████░░ 50%
```

```
┌── 信息抓取补全 ───────────────────────────────┐
│ 将对 128 位好友及追踪用户执行信息抓取           │
│ 进度: ████████░░░░ 64/128 (50%)                │
│ [开始抓取]                                      │
└────────────────────────────────────────────────┘
```

---

## 6. 个人简介 Diff 视图（Bio Diff）

**入口**: 侧栏/好友列表 → 点击用户 → Info 标签页 → Bio 区域

**文件**: `src/components/dialogs/UserDialog/UserDialogInfoTabJirai.vue` (786 行)

### 核心逻辑

对个人简介展示 Git 风格的 diff。每次打开面板时记录一次 bio 快照，下次打开对比差异。

```js
function recordBioSnapshot(userId, bio) {
    const old = db.getBioSnapshot(userId);
    if (old !== bio) {
        db.saveBioSnapshot(userId, bio);
        db.saveBioHistory(userId, old, bio);
    }
}
```

- 保留上游原始 `UserDialogInfoTab.vue`，jirai 版本用 `UserDialogInfoTabJirai.vue` 命名避免冲突
- 使用 Feed 风格的 word-level diff，CJK 感知

### UI

```
┌── User Info (Jirai) ─────────────────────────┐
│ 位置信息                                      │
│ Instance: wrld_xxx:12345                     │
│ [实例创建者] Alice                            │
│ [玩家1] Bob  在线 2h                          │
│                                              │
│ Bio 变更历史                                  │
│ ┌──────────────────────────────────────┐     │
│ │ -旧 bio text                          │     │
│ │ +新 bio text with changes             │     │
│ └──────────────────────────────────────┘     │
└──────────────────────────────────────────────┘
```

---

## 7. 自动跟随好友实例（Auto Follow）

**入口**: Settings → General → Automation → "Auto Follow"

**文件**:

- `src/stores/autoFollow.js` (84 行)
- `src/composables/useInviteChecks.js` (39 行)

### 核心逻辑

被标记的好友进入实例后自动发送加入请求（0 秒延迟）。

```js
watch(friendStore.friends, (friends) => {
    for (const [id, friend] of friends) {
        if (autoFollowSet.has(id) && isAutoFollowTrigger(friend)) {
            inviteApi.requestInvite(id);
        }
    }
}, { deep: true });
```

- 启动时静默加入默认开发者群组（用于接收邀请）

### UI

```
┌── 自动跟随 ─────────────────────────────────┐
│ [●] 启用自动跟随                             │
│ 已标记: [Alice] [Bob]    [+添加好友]         │
│ [刷新]                                       │
└──────────────────────────────────────────────┘
```

---

## 8. 自动更新重定向到 Jirai 仓库

**入口**: 自动（Settings → Advanced → Updates）

**文件**: `src/stores/vrcxUpdater.js` (修改)

将更新检测 URL 改为指向 `FuLuTang/VRCX-jirai`。CI 配置 `.github/workflows/` 也相应调整。

---

## 9. 多账号功能 V4（WIP）

**入口**: Login.vue → 已保存账号前多选框 + "登录选中账号"（分支 `feat/multi-account`）

**文件**:

- `src/services/accountHub.js` (413 行)
- `src/services/accountSession.js` (441 行)
- `src/services/aggregatedView.js` (221 行)
- `docs/MULTI_ACCOUNT_V4_DETAIL_DESIGN.md` (910 行)

### 架构

```
Login.vue (多选账号)
    ↓
AccountHub (会话管理器)
    ├→ AccountSession A (主号) → 复用全局 Store + WS
    ├→ AccountSession B (次号) → 独立 HttpClient + WS + 缓存
    └→ AccountSession C (同上)
```

三个视图模式：`primary`（单号） / `merged`（聚合 UNION） / `account:usrX`（热替换）

> **开发中，未合并到 master**

---

## 10. 本地构建脚本

**入口**: 项目根目录双击 `build-windows-local.bat`

**文件**: `build-windows-local.bat`

一键构建：npm install → vite build → .NET build → 打包，支持中文检测。

---

## 11. 数据库结构文档

**入口**: `docs/` 目录

ERD（实体关系图）：SVG / Mermaid / DBML / Graphviz 鸦脚符号 / 物理模型文档。

---

## 12. UI 美化合集

| 改动       | 详情                                              |
| ---------- | ------------------------------------------------- |
| 按钮样式   | 移除 LiquidGlass 毛玻璃效果，改为透明蓝胶囊按钮   |
| 社区颜色   | 关系网社区颜色从 8 种扩充到 24 种                 |
| 进度条格式 | `xx / xx+xx` 紧凑格式（好友 / 好友+追踪非好友） |
| 双人关系   | initiator 渐变背景标签、工具栏布局修复            |
| 关系网     | 新顶部图例、非好友节点半透明、手动关系绿色连线    |
| 汉化补全   | 关系网/双人关系/关系时间轴等新增功能的简体中文化  |

---

## 13. 构建配置调整（jirai 部分）

| 改动                                       | 说明                                                          |
| ------------------------------------------ | ------------------------------------------------------------- |
| `tsconfig.app.json`                      | TS 配置拆分                                                   |
| `vitest.config.js` / `vitest.setup.js` | 测试框架（JSDOM + global mock）                               |
| `eslint.config.mjs`                      | ESLint 扁平化配置                                             |
| `.oxlintrc.json` / `.oxfmtrc.json`     | Oxlint 检查配置                                               |
| `components.json`                        | shadcn/vue 组件注册                                           |
| 目录迁移                                   | `src/plugin/` → `src/plugins/`                           |
| i18n 文件                                  | 从 `{lang}/en.json` 扁平化为 `{lang}.json`，新增 hu/pl/pt |

---

## 总结

真正 jirai 特有的功能共 **13 项**，其中核心新功能 7 项：

| #  | 功能           | 状态 | 代码量   |
| -- | -------------- | ---- | -------- |
| 1  | 双人关系       | 完成 | ~540 行  |
| 2  | 关系时间轴     | 完成 | ~792 行  |
| 3  | 手动关系       | 完成 | ~866 行  |
| 4  | 追踪非好友     | 完成 | ~368 行  |
| 5  | 信息抓取补全   | 完成 | ~372 行  |
| 6  | Bio Diff 视图  | 完成 | ~786 行  |
| 7  | 自动跟随       | 完成 | ~123 行  |
| 8  | 自动更新重定向 | 完成 | 少量修改 |
| 9  | 多账号 V4      | WIP  | ~1075 行 |
| 10 | 本地构建脚本   | 完成 | 1 文件   |
| 11 | 数据库文档     | 完成 | ~18 文件 |
| 12 | UI 美化        | 完成 | 全局     |
| 13 | 构建配置       | 完成 | 全局     |
