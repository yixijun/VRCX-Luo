# VRCX-Luo 重构执行计划

> 状态：执行中
>
> 更新时间：2026-09-05
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
| Major | M-00 测试与 CI 门禁 | **M-00.1 工具链已补齐；门禁仍为红** | 先分批收敛现有 typecheck 诊断，再评估 lint/format 债务和 CI 硬门禁 |
| Major | M-01 宿主 capability adapter | 未开始 | 依赖 B-01 方法清单；保留旧 facade |
| Major | M-02 数据刷新链路契约化 | **已完成：M-02.5** | 进入 M-03 编排层纯化 |
| Major | M-03 编排层纯化 | **已完成：M-03.6** | 进入 M-00；M-06 低风险 seam 已完成 |
| Major | M-04 数据库 facade 深化 | 暂缓 | 等多账户方案恢复后再引入 `DbContext` |
| Major | M-05 账号会话与聚合视图 | **按要求暂缓** | 依赖 B-02，不进入当前迭代 |
| Major | M-06 Notification Store 拆分 | **已完成：M-06.4（低风险 seam）** | 进入 M-00；M-01/M-04 解锁后再收窄宿主/数据库 capability |
| Major | M-07 Electron composition root / 双宿主契约 | 待 M-01 | 先建立启动流程 seam |
| Major | M-08 API/Query 缓存所有权 | **已完成：M-08.3** | 进入 M-00；多账户 B-02/M-05 继续暂缓 |
| Major | M-09 其余上帝模块 | **已完成：M-09.8** | 进入 M-00；多账户 B-02/M-05 继续暂缓 |
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
| `3d0bf3c3` | M-03.6：修复 Toast adapter 的可调用入口，保持 `gameCoordinator` 的 `toast(message)` 兼容，并补回归测试 |
| `ecfba613` | M-09.1：提取 Group 角色变更纯决策 module，保留移除优先、源顺序和旧文案行为 |
| `c28ed3eb` | M-09.2：提取 Group 语言 projection module，保留源顺序、未知语言跳过和空值行为 |
| `f5082f8b` | M-09.3：提取 Group presence 决策 module，保留加入/移除顺序和重复抑制行为 |
| `35b05f64` | M-09.4：提取 Group 持久化 projection module，保留配置快照字段和顺序 |
| `b1089ecc` | M-09.5：提取 Favorite 本地实体 projection module，保留分组顺序和 fallback ref 行为 |
| `0c03a39e` | M-09.6：提取 Favorite 本地好友 id projection，保留默认组和数据库顺序 |
| `9020880a` | M-09.7：提取 User 配置语言 projection，保留 key 枚举顺序和旧 interface |
| `80fa011f` | M-09.8：提取 User 自动状态纯决策 module，保留守卫、组筛选和状态描述行为 |
| `94c69af2` | M-08.1：集中 QueryClient 的 invalidate/remove/cancel/clear side effect adapter |
| `38db4161` | M-08.2：集中 favorite/friend/group/inventory/gallery cache scope key factory |
| `7f422d0f` | M-08.3：将 query resource registry 移入 Query module，并注入 API transport implementation |
| `5d863c70` | M-06.1：提取通知分类、未读和最近时间窗口 projection module |
| `7983eccd` | M-06.2：提取 legacy/V2 通知实体 projection module |
| `f8629638` | M-06.3：提取通知中心偏好 persistence interface |
| `e8115bf2` | M-06.4：提取通知已读去重、串行处理和重试 queue module |
| `7fddf930` | M-00.1：补齐 `typescript` 开发依赖，使 `typecheck:js` 可以实际执行 |

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

M-02、M-03 编排层纯化、M-06 Notification Store 低风险 seam 和 M-08 API/Query 缓存所有权已完成。下一主线：**M-00 测试与 CI 门禁**；多账户 B-02/M-05 继续按要求暂缓。

## 当前 M-03 细分任务

1. **M-03.1 DOM input adapter（已完成）**：`imageUploadCoordinator` 通过 `resolveInputElement` 接缝解析文件 input；默认实现保持 `document.querySelector` 行为，测试可注入 fake document。提交：`9dcd07f7`。
2. **M-03.2 Toast adapter（已完成）**：新增 `toastAdapter` module，统一 `dismiss/error/info/loading/success/warning` interface；12 个 coordinator 改为依赖 adapter，Toast implementation 仍由服务层绑定 `vue-sonner`。提交：`ca373374`。
3. **M-03.3 Router adapter（已完成）**：`authCoordinator` 通过 `redirectToLogin` adapter 触发登录路由，保留动态加载、已在登录页不重复跳转和吞掉导航失败的行为。提交：`36f91180`。
4. **M-03.4 关系建议通知 adapter（已完成）**：`userCoordinator` 只负责关系建议 use-case 和语义回调；Noty、HTML、DOM 样式与按钮监听收敛到 `relationSuggestionNotification` module。提交：`02b494b9`。
5. **M-03.5 登出欢迎通知 adapter（已完成）**：`authCoordinator` 只传入显示名和翻译 interface；Noty、HTML 转义和展示 implementation 收敛到 `logoutNotification` module。提交：`c04e3e3d`。
6. **M-03.6 Toast 可调用入口兼容（已完成）**：`toastAdapter` 同时保留可调用函数入口与 `dismiss/error/info/loading/success/warning` method interface，修复 `gameCoordinator` 的 `toast(message)` 运行时错误；新增回归测试。提交：`3d0bf3c3`。

M-03 完成后，`src/coordinators` 不再直接 import `vue-sonner`/`noty`，也不再直接访问 `document`、`querySelector` 或 router implementation；跨层 UI 副作用均经过浅入口背后的 adapter seam。M-03.6 进一步补齐了 adapter 的 callable interface，避免旧调用方在压缩包中触发运行时错误。M-06 已为通知 store 建立领域 projection、persistence 和 seen queue seam；更深的宿主/database capability 仍等待 M-01/M-04。

## 当前 M-06 细分任务

1. **M-06.1 通知视图 projection（已完成）**：新增 `notificationViewProjection` module，提取 friend/group/other 分类、未读过滤和最近 24 小时过滤；保留 source order、hidden/unseen 条件和 store 的响应式 interface。提交：`5d863c70`。
2. **M-06.2 通知实体 projection（已完成）**：新增 `notificationEntityProjection` module，注入 sanitize/default/parser/Boop implementation，保留 legacy/V2 原地更新、重复 ID 选择和表格时间字段。提交：`7983eccd`。
3. **M-06.3 通知偏好 persistence（已完成）**：新增 `notificationPreferences` module，隔离 filters/hidden IDs 配置读写；加载过滤与保存去重/1000 条截断语义保持不变。提交：`f8629638`。
4. **M-06.4 通知已读 queue（已完成）**：新增 `notificationSeenQueue` module，隔离 ID 去重、串行 processor、429 retry policy 及 legacy/V2 回调；保留 `queueMarkAsSeen` 兼容 interface。提交：`e8115bf2`。

M-06 低风险 seam 已完成：`src/stores/notification/index.js` 继续作为兼容 facade 和 command orchestration，现有 `trayNotificationBridge` adapter 保持不变；后续若要继续压缩约 1990 行 store，需要先完成 M-01/M-04 的宿主与 database capability 契约。

## 当前 M-08 细分任务

1. **M-08.1 Query cache side-effect adapter（已完成）**：新增 `queryCache` module，集中 `invalidateActive`、`removeExact`、`cancelAll` 和 `clear` interface；API 与登出流程不再直接 import `QueryClient`，保留原有 refetch、精确删除和登出清理语义。提交：`94c69af2`。
2. **M-08.2 Cache scope key factory（已完成）**：在 `queryKeys` 中增加 favorite、friend、group、inventory、gallery scope key，替换 API 层裸数组；实际 key 值和前缀失效范围保持不变。提交：`38db4161`。
3. **M-08.3 Query resource registry（已完成）**：新增 `createQueryResourceRegistry` module，将资源 key、policy 和 queryFn 的 registry 归入 Query layer；API request facade 只注入 transport implementation，保留 `queryRequest.fetch` interface、资源名称和策略。提交：`7f422d0f`。

M-08 已完成：QueryClient 的生产 side effect 已集中到 `src/queries`，API/认证层通过 adapter seam 使用缓存；scope key 和 resource registry 具备独立测试表面。后续主线为 **M-00 测试与 CI 门禁**；多账户 B-02/M-05 继续按要求暂缓。

## 当前 M-09 细分任务

1. **M-09.1 Group 角色变更决策（已完成）**：新增 `groupRoleChangeDecision` module，将角色新增/移除文案的纯计算与通知副作用分开；保持移除先于新增、各自沿原数组顺序、缺失 role payload 的旧文案结果。`groupCoordinator` 的 `groupRoleChange` 私有调用路径和 `applyGroup` interface 不变。提交：`ecfba613`。
2. **M-09.2 Group 语言 projection（已完成）**：新增 `groupLanguageProjection` module，将 Group 语言 id 到本地化条目的纯映射从 coordinator 中移出；保持源数组顺序、未知语言跳过、空字符串/`false`/`0` 等值保留，以及 `applyGroup` interface 不变。提交：`c28ed3eb`。
3. **M-09.3 Group presence 决策（已完成）**：新增 `groupPresenceDecision` module，将 presence payload 的加入/移除计算从 coordinator 中移出；保持 incoming 顺序、重复加入抑制、current membership 移除顺序，以及 `applyPresenceGroups` interface 不变。提交：`f5082f8b`。
4. **M-09.4 Group 持久化 projection（已完成）**：新增 `groupPersistenceProjection` module，将当前用户 Group 快照的纯序列化从 coordinator 中移出，保持配置 key、JSON 字段、`undefined` roleIds 和顺序不变。提交：`35b05f64`。
5. **M-09.5 Favorite 本地实体 projection（已完成）**：新增 `favoriteLocalProjection` module，合并 world/avatar 本地收藏读取中的重复分组逻辑，保持数据库顺序、fallback ref 和默认 `Favorites` 组行为。提交：`b1089ecc`。
6. **M-09.6 Favorite 本地好友 projection（已完成）**：复用 `favoriteLocalProjection` module 提取好友收藏 id 分组逻辑，保持 `Favorites` 默认组和数据库顺序。提交：`0c03a39e`。
7. **M-09.7 User 语言 projection（已完成）**：新增 `userLanguageProjection` module，提取配置事件中的语言条目映射，保持语言 key 枚举顺序和旧 interface。提交：`9020880a`。
8. **M-09.8 User 自动状态决策（已完成）**：新增 `userAutoStateDecision` module，提取自动状态/描述的纯决策，保持现有守卫、Group 访问类型映射、远程/本地好友组筛选、状态文案和 `updateAutoStateChange` interface 不变。提交：`80fa011f`。

M-09 已完成：Group、Favorite、User 三个 coordinator 的低风险纯决策与 projection seam 已建立；所有切片均独立提交并通过受影响测试，M09 全量回归未增加既有失败。下一主线为 **M-00 测试与 CI 门禁**；多账户 B-02/M-05 继续按要求暂缓。

## 当前 M-00 细分任务

1. **M-00.1 JavaScript typecheck 工具链（已完成）**：将 `typescript@^5.9.3` 加入 `devDependencies` 并锁定到 `package-lock.json`，修复 `typecheck:js` 过去因找不到 `tsc` 而无法执行的问题。提交：`7fddf930`。
2. **M-00.2 现有类型债务分批收敛（待开始）**：工具链启用后，当前检查暴露 210 条既有诊断，主要集中在 API response 类型、宿主 bridge 类型、store 推断和旧 JSDoc；按模块 seam 分批处理，每批保持定向测试和生产构建通过。
3. **M-00.3 CI 硬门禁（待 M-00.2）**：在 typecheck 诊断降到可控范围前，不把该命令直接改成阻断式 CI；先保留可见报告，再逐步收紧 lint/format/test 的失败策略。

M-00.2 已开始：首个低风险切片修正 `gameStateTask` 的 `getLogLines` 注释契约，使其准确表达同步数组/Promise 双路径，并完成原文件格式化；`updateLoop.js(65,28)` 误报已消失，整体诊断数仍为 210。提交：`8961b676`。第二个切片修正 Group API 的 `bool` JSDoc 类型名称，诊断数降至 209，提交：`8c34f3f2`。第三个切片修复 Avatar 上传方法的空参数 JSDoc，诊断数降至 207，提交：`26513e2c`。第四个切片将 Notification API 的损坏 typedef 改为标准 `@typedef/@property` 声明，解析错误消失，当前诊断数为 206，提交：`23be21b4`。第五个切片移除 Notification V2 projection 中不存在的 `endpointDomain` 参数注释，诊断数降至 205，提交：`5ee0da85`。第六个切片对齐 Feed 差异格式化函数的四个参数名与真实签名，诊断数降至 201，提交：`1fa5e8f9`。第七个切片修正通知邀请辅助函数的 `rsvp` 参数注释，诊断数降至 200，提交：`2e412fa8`。第八个切片为 `request()` 建立显式上传扩展 interface，清零 13 个上传选项误报，诊断数降至 189，提交：`950185fb`。第九个切片修正 World API `ref` 返回对象的静态推断并保持属性顺序，诊断数降至 188，提交：`c4fc3a58`。第十个切片修正 Instance API `ref` 返回对象的静态推断并保持属性顺序，诊断数降至 187，提交：`33f9c4c6`。第十一个切片为 request 自定义 Error 字段加入表达式级静态类型，诊断数降至 182，提交：`fb93b448`。第十二个切片为 Query key `groupMember` 解构参数声明可选 id，诊断数降至 180，提交：`b1999fa2`。第十三个切片补齐其余 Group/World/File Query key 的解构参数声明，诊断数降至 171，提交：`cb03eb6c`。第十四个切片同步 C# WebApi 二级账号方法到全局 bridge interface，诊断数降至 165，提交：`7e67caa4`。第十五个切片为 Sentry 原始异常 message 增加安全静态 narrowing，诊断数降至 150，提交：`d7a0e479`。下一刀优先处理同类不改变运行时的 JSDoc/声明契约问题。

当前 M-00 的安全边界是“先让检查可执行，再逐批降低诊断数”。本切片没有修改运行时代码、公共 interface、序列化格式或并发逻辑。

## 每个切片的回滚协议

1. 修改前运行受影响模块测试，记录既有失败数量和错误分类。
2. 只做一个逻辑变更；不改公共 interface 签名、序列化格式或并发逻辑。
3. 修改后重复同一组测试，并检查新增代码的 Oxlint/Oxfmt。
4. 通过后创建独立 Git commit；失败时只回滚当前切片。
5. 完成验证后再进入下一个 seam，并在本计划和架构诊断中同步状态。
