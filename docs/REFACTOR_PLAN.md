# VRCX-Luo 重构执行计划

> 状态：执行中
>
> 更新时间：2026-09-04
>
> 本计划按 Blocker / Major / Minor 排序；每个切片保持公共 interface、序列化格式和并发语义不变，并单独提交到本地 Git。不会在本计划范围内发布或推送。

## 当前策略

多账户相关工作（B-02、M-05）按用户要求暂缓，不再扩大其实现范围。当前优先处理单账户数据刷新和测试门禁，避免继续触碰 `dbVars` 热切换、账号 Store 替换和跨账号聚合。

架构目标是把浅（shallow）的编排模块逐步深化（deepening）：在稳定的 interface 上建立 seam，用 adapter 隔离实现，让每次改动保持 locality，并获得可验证的 leverage。

## 任务总览

| 优先级 | 任务 | 当前状态 | 下一步 |
|---|---|---|---|
| Blocker 条件项 | B-01 宿主桥安全封口 | 条件性 Major；暂缓 | 先完成 Electron/CEF 方法清单和可信内容判定 |
| Blocker 条件项 | B-02 多账户数据隔离 | **按要求暂缓** | 不改 `dbVars`、`accountHub` 和次号生命周期 |
| Major | M-00 测试与 CI 门禁 | 基础切片完成 | 补齐 JS typecheck 工具链；评估现有 lint/format 债务后再收紧 CI |
| Major | M-01 宿主 capability adapter | 未开始 | 依赖 B-01 方法清单；保留旧 facade |
| Major | M-02 数据刷新链路契约化 | **已完成：M-02.5** | 进入 M-03 编排层纯化 |
| Major | M-03 编排层纯化 | **已完成：M-03.5** | 进入 M-06/M-09；继续沿同一 seam 拆分剩余上帝模块 |
| Major | M-04 数据库 facade 深化 | 暂缓 | 等多账户方案恢复后再引入 `DbContext` |
| Major | M-05 账号会话与聚合视图 | **按要求暂缓** | 依赖 B-02，不进入当前迭代 |
| Major | M-06 Notification Store 拆分 | 待 M-01/M-04 | 先补 characterization tests |
| Major | M-07 Electron composition root / 双宿主契约 | 待 M-01 | 先建立启动流程 seam |
| Major | M-08 API/Query 缓存所有权 | 待 M-02 | 先盘点实体和 cache key |
| Major | M-09 其余上帝模块 | **进行中：M-09.7** | 完成 User 自动状态决策并执行 M09 全量回归 |
| Minor | N-01 文档与 ADR | 部分完成 | 稳定决策后再新增 `CONTEXT.md`/ADR |
| Minor | N-02 版本与构建来源 | 未开始 | 统一 `Version`、package 和宿主注入来源 |
| Minor | N-03 Shared/Localization 边界 | 未开始 | 增加依赖方向和翻译 key 检查 |
| Minor | N-04 第三方/生成文件治理 | 未开始 | 建立版本矩阵，生成代码不作为首批目标 |

## 已完成切片

| Commit | 内容 |
|---|---|
| `556b8352` | 固化前端、C#、Schema、lint、typecheck 基线 |
| `8a4d70e7` / `b9a78e50` | Schema 结构检查脚本及 CI 接入 |
| `3f9d2461` / `1fbaf8f8` | C# 测试正式发现及 Windows CI job |
| `db63f591` | 多账号聚合元数据 interface 对齐（后续多账户工作暂停） |
| `a2c3a953` 及其前置任务提交 | updateLoop 调度器和任务 module 拆分 |
| `40292dfa` | 完成 friend presence Online/Offline 事件→副作用契约测试 |
| `909685bc` | 提取纯 friend presence Feed 决策 module，并保留原副作用顺序 |
| `bfbfbddf` | 为 friend presence delayed flow 注入 Store/Feed/通知/数据库 capability，保留兼容入口 |
| `9e987ab8` | 为 `friend-update` 建立显式依赖入口，保留旧 `runHandleUserUpdateFlow` interface，并补齐 Bio 事件测试 |
| `ead6a2f5` | 为 online/offline/active presence flow 建立显式依赖入口，保留 `runUpdateFriendFlow` 兼容 interface，并补齐 pending-offline 测试 |
| `bb50eb52` | 提取 friend-location payload normalization module，保留 WebSocket fallback 与 `applyUser` 调用顺序，并补齐双路径测试 |
| `70f2703f` | 为 pending-offline tick 提取显式依赖核心，保留默认 adapter 兼容入口，并用 fake clock 固化到期、提前和状态竞态行为 |
| `283251e2` | 提取 WebSocket 5 秒重连调度 module，保留登录、好友加载和 socket 空位三重运行时守卫，并补齐 fake-clock 测试 |
| `9dcd07f7` | M-03.1：提取 DOM input adapter，保留图片上传兼容入口并允许注入 input resolver |
| `ca373374` | M-03.2：统一 coordinator Toast adapter，移除 12 个 coordinator 的直接 `vue-sonner` 依赖 |
| `36f91180` | M-03.3：提取 Router adapter，保留登出后跳转行为和动态加载语义 |
| `02b494b9` | M-03.4：提取关系建议 Noty/DOM 通知 adapter，保留提示文案、样式和点击副作用顺序 |
| `c04e3e3d` | M-03.5：提取登出欢迎 Noty adapter，移除 auth coordinator 的直接 Noty 依赖 |
| `ecfba613` | M-09.1：提取 Group 角色变更纯决策 module，保留移除优先、源顺序和旧文案行为 |
| `c28ed3eb` | M-09.2：提取 Group 语言 projection module，保留源顺序、未知语言跳过和空值行为 |
| `f5082f8b` | M-09.3：提取 Group presence 决策 module，保留加入/移除顺序和重复抑制行为 |
| `35b05f64` | M-09.4：提取 Group 持久化 projection module，保留配置快照字段和顺序 |
| `b1089ecc` | M-09.5：提取 Favorite 本地实体 projection module，保留分组顺序和 fallback ref 行为 |
| `0c03a39e` | M-09.6：提取 Favorite 本地好友 id projection，保留默认组和数据库顺序 |
| `9020880a` | M-09.7：提取 User 配置语言 projection，保留 key 枚举顺序和旧 interface |

## 当前 M-02 细分任务

1. **M-02.1 事件→副作用矩阵（已完成）**：为 `friendPresenceCoordinator` 覆盖 Online/Offline 的状态、Feed、通知、共享 Feed、数据库写入和排序更新；验证结果已固化在 `40292dfa`。
2. **M-02.2 纯 diff/记录决策函数（已完成）**：提取 `createFriendPresenceFeed` 输入→Feed 决策 module，不改变调用顺序和写入时机；验证结果已固化在 `909685bc`。
3. **M-02.3 注入接口（已完成）**：把 Friend Store、Feed、Shared Feed、通知和数据库 capability 作为显式依赖；旧入口继续组装默认 adapter；验证结果已固化在 `bfbfbddf`。
4. **M-02.4 事件迁移（已完成）**：`friend-update`、online/offline/active presence 和 `friend-location` 均已有可测试的显式 seam；下一步处理取消、重连和竞态。
5. **M-02.5 取消、重连、竞态（已完成）**：pending-offline 与 WebSocket 重连均已提取显式 seam；轮询取消由现有 scheduler 的 fake-clock stop 测试守护。

已完成切片：

- **M-02.4.1 `friend-update` seam**：`runHandleUserUpdateFlow` 仍是兼容入口，新增的依赖核心可注入 Store、Feed、通知、共享 Feed 和数据库 adapter；Bio 变更的副作用顺序由测试固化。提交为 `9e987ab8`。
- **M-02.4.2 online/offline/active presence seam**：`runUpdateFriendFlow` 仍是兼容入口，新增的依赖核心可注入好友状态、用户缓存、重取用户、搜索索引、登录状态和延迟 transition capability；pending-offline 行为由测试固化。提交为 `ead6a2f5`。
- **M-02.4.3 `friend-location`**：新增纯 payload normalization module，完整用户和 fallback 两条路径均保持字段、解析顺序与 `applyUser` 调用行为；提交为 `bb50eb52`。
- **M-02.5.1 pending-offline tick**：`runPendingOfflineTickFlow` 仍是兼容入口，新增 `runPendingOfflineTickFlowWithDependencies` 核心，可注入好友状态和 delayed transition capability；fake clock 固化到期、提前返回和状态已匹配取消路径。提交为 `70f2703f`。
- **M-02.5.2 WebSocket reconnect**：新增纯 `scheduleWebSocketReconnect` module，固定 5 秒延迟并在回调时读取登录、好友加载和 socket 空位守卫；`websocket.js` 仅负责组装默认 adapter，兼容原有断线行为。提交为 `283251e2`。
- **M-02.5.3 polling cancellation**：沿用 `updateLoopScheduler` 的 start/stop interface，现有 fake-clock 测试验证 stop 会清理 pending timer，未改生产逻辑。

M-02 已完成，M-03 编排层纯化已完成。下一主线：**M-06 Notification Store 拆分**或 **M-09 其余上帝模块**；多账户 B-02/M-05 继续按要求暂缓。

## 当前 M-03 细分任务

1. **M-03.1 DOM input adapter（已完成）**：`imageUploadCoordinator` 通过 `resolveInputElement` 接缝解析文件 input；默认实现保持 `document.querySelector` 行为，测试可注入 fake document。提交：`9dcd07f7`。
2. **M-03.2 Toast adapter（已完成）**：新增 `toastAdapter` module，统一 `dismiss/error/info/loading/success/warning` interface；12 个 coordinator 改为依赖 adapter，Toast implementation 仍由服务层绑定 `vue-sonner`。提交：`ca373374`。
3. **M-03.3 Router adapter（已完成）**：`authCoordinator` 通过 `redirectToLogin` adapter 触发登录路由，保留动态加载、已在登录页不重复跳转和吞掉导航失败的行为。提交：`36f91180`。
4. **M-03.4 关系建议通知 adapter（已完成）**：`userCoordinator` 只负责关系建议 use-case 和语义回调；Noty、HTML、DOM 样式与按钮监听收敛到 `relationSuggestionNotification` module。提交：`02b494b9`。
5. **M-03.5 登出欢迎通知 adapter（已完成）**：`authCoordinator` 只传入显示名和翻译 interface；Noty、HTML 转义和展示 implementation 收敛到 `logoutNotification` module。提交：`c04e3e3d`。

M-03 完成后，`src/coordinators` 不再直接 import `vue-sonner`/`noty`，也不再直接访问 `document`、`querySelector` 或 router implementation；跨层 UI 副作用均经过浅入口背后的 adapter seam。剩余的 store/API/database 深化仍属于 M-06、M-08、M-09，不在本批次扩大范围。

## 当前 M-09 细分任务

1. **M-09.1 Group 角色变更决策（已完成）**：新增 `groupRoleChangeDecision` module，将角色新增/移除文案的纯计算与通知副作用分开；保持移除先于新增、各自沿原数组顺序、缺失 role payload 的旧文案结果。`groupCoordinator` 的 `groupRoleChange` 私有调用路径和 `applyGroup` interface 不变。提交：`ecfba613`。
2. **M-09.2 Group 语言 projection（已完成）**：新增 `groupLanguageProjection` module，将 Group 语言 id 到本地化条目的纯映射从 coordinator 中移出；保持源数组顺序、未知语言跳过、空字符串/`false`/`0` 等值保留，以及 `applyGroup` interface 不变。提交：`c28ed3eb`。
3. **M-09.3 Group presence 决策（已完成）**：新增 `groupPresenceDecision` module，将 presence payload 的加入/移除计算从 coordinator 中移出；保持 incoming 顺序、重复加入抑制、current membership 移除顺序，以及 `applyPresenceGroups` interface 不变。提交：`f5082f8b`。
4. **M-09.4 Group 持久化 projection（已完成）**：新增 `groupPersistenceProjection` module，将当前用户 Group 快照的纯序列化从 coordinator 中移出，保持配置 key、JSON 字段、`undefined` roleIds 和顺序不变。提交：`35b05f64`。
5. **M-09.5 Favorite 本地实体 projection（已完成）**：新增 `favoriteLocalProjection` module，合并 world/avatar 本地收藏读取中的重复分组逻辑，保持数据库顺序、fallback ref 和默认 `Favorites` 组行为。提交：`b1089ecc`。
6. **M-09.6 Favorite 本地好友 projection（已完成）**：复用 `favoriteLocalProjection` module 提取好友收藏 id 分组逻辑，保持 `Favorites` 默认组和数据库顺序。提交：`0c03a39e`。
7. **M-09.7 User 语言 projection（已完成）**：新增 `userLanguageProjection` module，提取配置事件中的语言条目映射，保持语言 key 枚举顺序和旧 interface。提交：`9020880a`。
8. **M-09.8 User 自动状态决策（进行中）**：提取自动状态/描述的纯决策 module，保持现有守卫、组筛选和状态文案行为；完成后执行 M09 全量回归并收口。

## 每个切片的回滚协议

1. 修改前运行受影响模块测试，记录既有失败数量和错误分类。
2. 只做一个逻辑变更；不改公共 interface 签名、序列化格式或并发逻辑。
3. 修改后重复同一组测试，并检查新增代码的 Oxlint/Oxfmt。
4. 通过后创建独立 Git commit；失败时只回滚当前切片。
5. 完成验证后再进入下一个 seam，并在本计划和架构诊断中同步状态。
