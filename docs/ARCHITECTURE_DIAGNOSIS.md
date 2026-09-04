# VRCX-Luo 架构诊断报告

> 分析范围：当前工作树中的 Vue 3、Pinia、Electron、CEF/C#、数据库模块、测试和项目文档。本文记录诊断结论和实施状态；updateLoop 第一刀、M-03 编排层适配器及 callable interface 修复、M-06 Notification Store 低风险 seam、M-08 API/Query 缓存 seam 及 M-09 Group/Favorite/User 纯 module 切片已落地，其余内容仍是只读建议。

> 实施状态（2026-09-04）：`updateLoop` 调度器、独立任务 module、M-03 的 UI adapter 与 callable Toast interface、M-06 的通知 projection/persistence/seen queue module、M-08 的 Query cache/resource registry seam，以及 M-09.1～M-09.8 的 Group/Favorite/User 纯决策与 projection module 已落地；coordinator/store 公共 interface 保持不变，其他架构风险尚未改动。

## 结论摘要

项目当前是一个“多套编排中心并存”的混合架构：Pinia store、coordinator、database facade 和宿主 bridge 都在承担部分业务编排。功能覆盖广，但模块边界较浅，主要风险集中在跨层调用、双宿主桥接、账号上下文、上帝模块和质量门禁。

- `src/components` 约 537 个文件、5.3 万行；`src/views` 约 225 个文件、5.1 万行。
- `src/stores` 64 个文件、约 2.8 万行；`src/coordinators` 31 个文件、约 0.8 万行。
- 约 17 个 store 依赖 coordinator，约 20 个 coordinator 反向依赖 store。
- 约 54 个生产文件直接依赖数据库模块，约 52 个生产文件直接访问 `AppApi`、`VRCXStorage`、`LogWatcher` 等宿主全局对象。
- 当前没有确认必须停版的无条件 Blocker；动态 .NET bridge 如果未来允许不可信渲染内容调用，风险应升级为 Blocker。

严重程度含义：

- **Blocker**：会阻断安全发布、造成高概率数据损坏，或存在明确的高危运行时路径。
- **Major**：高耦合、高回归概率或明显影响维护效率/正确性。
- **Minor**：文档、规范、局部可维护性问题，不立即阻断功能。

## 1. 按目录诊断

| 目录/模块 | 主要职责 | 当前潜在问题 |
|---|---|---|
| `src/views` | 页面级功能、路由页面、业务流程组合 | 页面直接读写 store、数据库和宿主 API；查询、事件监听、窗口控制混在页面；存在多个 900～1300 行页面 |
| `src/components` | 对话框、列表、卡片、表格等可复用 UI | 复用组件大量依赖全局 store、router、toast、DOM；不少组件实际承担完整业务流程 |
| `src/stores` | Pinia 状态、派生数据、部分业务命令 | 同时访问 API、数据库、Electron、DOM 和 coordinator；通知 store 已通过 M-06 建立 projection/persistence/queue module，但兼容 facade 仍较大，其他上帝 store 与循环依赖仍在 |
| `src/services` | 数据库、账号会话、配置、SQLite、聚合视图 | database facade 过宽；`dbVars` 是可变全局上下文；数据模块反向依赖 UI |
| `src/coordinators` | WebSocket/API/数据库事件编排 | store/API/database 耦合仍在；M-03 已把 UI implementation 收敛到 services adapter seam，M-09 已把 Group/Favorite/User 的角色、presence、持久化、收藏、本地化和自动状态决策深化为纯 module，后续继续拆 use-case |
| `src/api` | REST/API endpoint 请求封装 | `window.request` 全局暴露；M-08 后缓存副作用经 `queryCache` adapter，Query resource 仍由 facade 组装，宿主全局和 API/Query 边界仍需后续收窄 |
| `src/queries` | Query key、实体缓存、查询策略、resource registry | M-08 已集中 QueryClient side effect、scope key 和 resource registry；Pinia 与 Query 的实体数据所有权仍需继续明确 |
| `src/shared` | 常量、工具函数、基础 UI 操作 | 目录过于宽泛；部分工具直接调用 `AppApi` 或修改 UI，容易形成反向依赖 |
| `src/composables` | 可复用的 Composition 行为 | 总体边界较合理，但生命周期和 worker 相关测试警告较多 |
| `src/plugins` | i18n、router、组件、Sentry、interop 初始化 | 初始化顺序复杂；router 存在静态和动态混合导入，构建有 chunk 警告 |
| `src/ipc-electron` | Renderer 到 Electron 的 IPC 代理 | 动态 Proxy 缺少方法、参数类型和 allowlist |
| `src-electron` | 主进程、窗口、托盘、IPC、C# 启动 | `main.js` 约 1062 行，窗口、托盘、通知、IPC、Dotnet 全部集中 |
| `Dotnet` | CEF/Electron C# 宿主、SQLite、日志、VR overlay | CEF/Electron 两套项目目标框架和依赖版本存在漂移；部分 C# 类过大 |
| `Dotnet.Tests` | C# WinForms 测试项目 | 已接入 xUnit、正式测试发现和 Windows CI job；测试通过 STA 辅助器执行 |
| `src/vr` | VR overlay 和 VR 页面 | `Vr.vue` 超过 2000 行，VR UI、状态和平台行为混杂 |
| `src/workers` | 后台任务和定时 worker | 异步边界较隐蔽，独立测试接缝不足 |
| `src/localization` | 多语言 JSON 和翻译辅助 | translation key 漂移风险，缺少自动一致性检查 |
| `Installer`、`build-scripts` | 安装包、构建、发布脚本 | Windows shell 假设较多，版本和产物来源不够集中 |
| `.github/workflows` | CI、构建和发布 | 主 CI 偏手工触发，部分检查允许失败，质量门禁不完整 |

## 2. 文档盘点

| 文档 | 覆盖内容 | 诊断 |
|---|---|---|
| `README.md` | 产品、功能、安装、构建和安全提醒 | 适合入门，但缺少稳定的模块边界和运行时数据流契约 |
| `docs/JIRAI_FEATURES.md` | Luo 相对上游的功能清单 | 行数和状态信息已过时；多账号状态与当前代码不完全一致 |
| `docs/DATA_REFRESH.md` | 日志、WebSocket、5 分钟轮询、1 小时同步 | 主体模型清楚，但未充分描述多账号聚合、失败重试和切换行为 |
| `docs/DATABASE_SCHEMA.md` | 核心数据库表和关系 | 只有少量核心表，遗漏 activity、通知、tracked nonfriends、manual relations、缓存等实际模块 |
| `docs/MULTI_ACCOUNT_V4_DETAIL_DESIGN.md` | 多账号、DB prefix、WebSocket、热切换、聚合视图 | 仍是 Draft；设计与当前实现存在契约漂移 |
| `docs/CEF_LOCAL_TESTING.md` | Windows CEF 本地测试和安全重启 | 运维内容较实用，但没有完整覆盖 Electron/CEF 差异 |
| `docs/BIO_DIFF_ENGLISH_PUNCTUATION_BUG.md` | Bio Diff 缺陷记录 | 缺少可重复的回归测试矩阵 |
| `docs/schemas/screenshotMetadata-schema.json` | 截图元数据 JSON Schema | 已恢复为可解析 JSON，并由 `npm run check:schema` 和 CI 校验；后续可补充字段语义校验 |
| `docs/third-party-libs.md` | Dotnet 第三方库来源 | 缺少版本、升级约束和安全审计信息 |
| `CONTEXT.md`、`docs/adr/` | 领域词汇和架构决策 | 当前不存在，架构知识主要依赖代码和过时文档 |

## 3. 跨层耦合和问题清单

| 文件路径 | 问题类型 | 严重程度 | 建议 |
|---|---|---:|---|
| `src/stores` ↔ `src/coordinators` | 双向依赖、编排循环 | Major | 先选 friend/favorite 一条链路，引入 use-case 或事件 port；store 消费结果，coordinator 负责编排 |
| `src/coordinators/userCoordinator.js` | 原先拼接关系建议 HTML、`querySelector`、注册 DOM 事件；自动状态和配置 projection 也混在 coordinator | Major → 已完成 M-03.4/M-09.7/M-09.8 | 关系建议已通过 `relationSuggestionNotification` adapter；语言 projection 和自动状态决策已通过纯 module；后续仍可继续拆 user use-case 与 notification domain |
| `src/coordinators/imageUploadCoordinator.js` | 原先直接查找 input，同时调用 Toast、AppApi、Web API | Major → 已完成 M-03.1 | input 查询已通过 `domInputAdapter` seam；后续再收窄上传 capability 和错误返回 |
| `src/services/toastAdapter.js` ↔ `src/coordinators/gameCoordinator.js` | adapter 原先只有 method object，旧协调器仍调用 `toast(message)`，生产包触发 `TypeError: Us is not a function` | Major → 已完成 M-03.6 | adapter 现在同时暴露 callable function 与 method interface；回归测试覆盖默认调用形状，提交 `3d0bf3c3` |
| `src/coordinators/authCoordinator.js` | 原先直接创建登出 Noty 并执行 router 跳转 | Major → 已完成 M-03.3/M-03.5 | Router 和登出欢迎通知均经 adapter；保留旧 `runLogoutFlow` interface |
| `src/coordinators/groupCoordinator.js` | 原先在 Group 更新流程内计算角色/presence/持久化/语言 projection 并发送通知 | Major → 已完成 M-09.1～M-09.4 | 角色、语言、presence 和持久化均已提取为纯 module；保留 `applyGroup`、`applyPresenceGroups` 和通知顺序 |
| `src/coordinators/favoriteCoordinator.js` | 本地 world/avatar/friend 收藏分组、缓存、API、数据库和 Toast 混合 | Major → 已完成 M-09.5/M-09.6 | 本地实体和好友 id projection 已集中到 `favoriteLocalProjection`；后续再拆事件/持久化 use-case |
| `src/stores/ui.js` | store 同时管理状态、router、DOM drop 事件、开发者工具和窗口行为 | Major | 拆成 UI state 与 window actions；平台操作通过 adapter |
| `src/stores/settings/appearance.js` | store 直接修改 `document.documentElement`，并访问 API/数据库 | Major | 提取主题 adapter/composable；store 只保存偏好和派生状态 |
| `src/stores/notification/index.js` | 通知状态、数据库、API、托盘、Electron、router、dialog、Toast 混合 | Major → 已完成 M-06.1～M-06.4 低风险 seam | 已提取通知领域 projection、偏好 persistence、seen queue；保留旧 action 兼容入口和 tray adapter。后续更深拆分等待 M-01/M-04 capability 契约 |
| `src/services/sqlite.js` | 数据模块反向依赖 modal、i18n、外链打开 | Major | SQLite 层只抛结构化错误；由上层负责提示、翻译和导航 |
| `src/services/accountSession.js` | 会话、登录/2FA、好友缓存、WebSocket、定时器、原始 SQL、modal 混合 | Major | 分离 session transport、认证用例、缓存持久化和调度器 |
| `src/services/database/index.js` | facade 过宽，`window.database` 全局暴露，`dbVars` 可变 | Major | 按领域拆 database module；引入显式 `DbContext`；保留兼容 facade |
| `src/services/database/gameLog.js` | 约 2200 行，写入、查询、媒体解析、聚合、统计全混在一起 | Major | 先拆只读查询，再拆写入和 parser，避免一次性重写 SQL |
| `src/services/aggregatedView.js` | 使用 `accountHub.allSessions` / `primaryPrefix`，但对应 getter 不存在 | Major | 定义明确的账号元数据 interface，并为标签、颜色和 primary 判断增加契约测试 |
| `src/api/index.js`、`src/queries` | API、Query cache、Pinia 可能重复持有实体数据 | Major → 已完成 M-08.1～M-08.3 | Query side effect、scope key 和 resource registry 已统一到 Query layer；继续明确 Pinia/Query 的实体唯一来源，并收窄全局 request facade |
| `src/stores/updateLoop.js` | 兼容入口和依赖组装仍集中；任务实现已移到独立模块 | Major | 已完成第一刀；后续可把宿主 capability 注入进一步收窄，继续保留兼容 facade |
| `src-electron/preload.js`、`src-electron/main.js`、`src/ipc-electron/interopApi.js` | 动态 class/method IPC，缺少 allowlist 和参数 schema | Major | 改为 capability adapter；主进程校验 class、method 和参数 |
| `src-electron/main.js` | 主进程约 1062 行，窗口、托盘、通知、IPC、Dotnet 启动集中 | Major | 以 main.js 作为 composition root，拆分 window、tray、notification、Dotnet、IPC module |
| `Dotnet/VRCX-Cef.csproj`、`Dotnet/VRCX-Electron.csproj` | CEF/Electron 目标框架和依赖版本漂移 | Major | 建立共享宿主 contract、版本矩阵和双宿主 contract test |
| `src` 多处生产文件 | 大量文件直接绕过边界访问 database 或宿主全局对象 | Major | 用 lint boundary 限制跨层 import，逐步迁移到 use-case/adapter |
| `.github/workflows/ci.yaml`、`package.json` | CI 偏手工触发，检查允许失败；`typecheck:js` 已可执行但仍有既有诊断 | Major | 先收敛类型债务，再逐步把 test、lint、typecheck、schema 校验设为硬门禁 |
| `src/**/*.test.*` | 当前前端测试有大量失败和脆弱 mock | Major | 先修公共组件、图标、数据库 contract mock，再增加新测试 |
| `Dotnet.Tests/VRCX.Cef.Tests.csproj` | C# 测试发现曾被 `OutputType=Exe` 绕过 | Major | 已改为正式测试项目，`dotnet test` 当前发现并通过 3 个测试，且由 Windows CI job 执行 |
| `docs/schemas/screenshotMetadata-schema.json` | Schema 结构校验此前缺失 | Major | 已增加 `check:schema` 脚本并接入 CI，后续补字段语义/样例校验 |
| `docs/DATABASE_SCHEMA.md`、`docs/JIRAI_FEATURES.md` | 文档与代码状态、表结构、行数不一致 | Minor | 描述稳定契约；易变的统计信息改为脚本生成 |
| `package.json`、`Version` | 版本号来源不一致 | Minor | 明确唯一版本源，构建时统一注入 |

## 4. 上帝组件和上帝 store

`300 行`只是信号；以下文件同时包含状态、IO、UI 副作用或跨域编排，属于高置信度上帝模块。

| 类型 | 文件（当前约行数） | 责任叠加 | 首个拆分边界 |
|---|---|---|---|
| Store | `src/stores/notification/index.js`（约 1990） | 通知状态、API、数据库、托盘、路由、dialog、Toast；projection、偏好 persistence、seen queue 已提取 | notification command facade / database capability |
| Store | `src/stores/photon.js`（1831） | Photon 事件、实例状态、网络同步、数据库 | Photon transport / instance projection |
| Store | `src/stores/instance.js`（1411） | 实例模型、加入/离开、API、平台动作 | instance state / join-leave use-case |
| Store | `src/stores/friend.js`（1385） | 好友、在线状态、排序、数据库、账号聚合 | friend entity / presence / aggregation |
| Store | `src/stores/gameLog/index.js`（1236） | 日志、worker、媒体、数据库、统计 | ingestion / query / parser |
| Store | `src/stores/settings/appearance.js`（1235） | 设置、主题 DOM、文化设置、API、数据库 | preference state / theme adapter |
| Store | `src/stores/settings/advanced.js`（1130） | 系统设置、文件操作、HTTP、清理、Toast | settings state / system actions |
| Store | `src/stores/auth.js`（1039） | 登录、token、账号切换、自动登录、宿主调用 | auth state / auth use-case / account context |
| Store | `src/stores/vrcx.js`（871） | 应用启动、迁移、配置、更新、数据库修复 | app lifecycle / migration |
| Coordinator | `src/coordinators/userCoordinator.js`（1297） | 用户事件、好友关系、DOM 通知、store 修改、API；语言和自动状态决策已提取 | user event / relationship use-case / notification（纯 projection/decision module 已落地） |
| Coordinator | `src/coordinators/favoriteCoordinator.js`（1185） | 收藏事件、API、数据库、store、Toast；本地收藏 projection 已提取 | favorite event / persistence（local projection module 已落地） |
| Coordinator | `src/coordinators/groupCoordinator.js`（981） | Group API、事件、缓存、store、UI 提示；角色、语言、presence、持久化已提取 | group sync / group commands（纯决策与 projection module 已落地） |
| Component | `src/vr/Vr.vue`（2175） | VR 页面、状态、输入、窗口、平台交互 | VR shell / panels / commands |
| Component | `src/views/Charts/components/MutualFriends.vue`（1351） | 查询、图表转换、筛选、展示 | data query / chart model / view |
| Component | `src/views/Tools/Gallery.vue`（1312） | 图片加载、缓存、筛选、窗口和操作 | gallery data / selection / presentation |
| Component | `src/components/dialogs/GroupDialog/GroupDialog.vue`（1269） | Group 查询、编辑、成员、日历、操作 | group data / dialog shell |
| Component | `src/views/Favorites/FavoritesAvatar.vue`（1208） | 收藏数据、拖拽、排序、操作、展示 | favorite query / reorder command |
| Component | `src/components/StatusBar.vue`（1113） | 状态展示、账号、更新、托盘、平台操作 | status projection / actions |
| Host | `src-electron/main.js`（1062） | Electron 生命周期、窗口、托盘、IPC、Dotnet | window manager / tray / IPC / host lifecycle |

生成的 `Dotnet/Overlay/OpenVR/openvr_api.cs` 虽超过 8000 行，但属于生成/第三方接口文件，不应作为第一批重构目标。

## 5. 模块依赖关系

```mermaid
flowchart LR
    UI["views / components / composables"]
    Router["router + plugins"]
    Stores["Pinia stores"]
    Coords["coordinators"]
    Api["src/api + src/queries"]
    Services["account / config / session modules"]
    Db["database facade + sqlite"]
    Shared["src/shared"]
    Workers["workers + updateLoop"]
    Bridge["AppApi / WebApi / SQLite / VRCXStorage bridge"]

    ElectronPreload["Electron preload + IPC"]
    ElectronMain["src-electron/main"]
    DotnetElectron["Dotnet Electron host"]

    CefBindings["CefSharp bindings"]
    DotnetCef["Dotnet CEF host"]

    UI --> Router
    UI --> Stores
    UI --> Coords
    UI -. direct host calls .-> Bridge

    Shared --> UI
    Shared --> Stores
    Shared --> Services

    Stores <--> Coords
    Stores --> Api
    Stores --> Db
    Stores --> Services

    Coords --> Api
    Coords --> Db
    Coords --> Services
    Coords --> UiAdapters["UI side-effect adapters"]
    UiAdapters -. DOM / Toast / Noty / Router implementation .-> UI

    Services --> Db
    Services --> Bridge
    Workers --> Stores
    Workers --> Coords

    Api --> Bridge
    Db --> Bridge

    Bridge -->|Electron| ElectronPreload
    ElectronPreload --> ElectronMain
    ElectronMain --> DotnetElectron

    Bridge -->|Windows CEF| CefBindings
    CefBindings --> DotnetCef

    classDef risk fill:#fee2e2,stroke:#dc2626;
    classDef bridge fill:#e0e7ff,stroke:#4f46e5;
    class Stores,Coords,Db risk;
    class Bridge,ElectronPreload,CefBindings bridge;
```

红色模块和双向边表示当前主要风险：store/coordinator 双向依赖、database facade 过宽、宿主 bridge 暴露面过大。

## 6. 最安全的 3 个重构切入点

### 前置安全网

在动业务代码前，先让 `typecheck`、前端测试、C# 测试发现和 schema 校验可以被 CI 可靠执行。这些改动不改变运行时行为，却能显著降低后续回归风险。

### 1）拆分 `updateLoop` 调度器（已完成）

目标：`src/stores/updateLoop.js`。

- 保留现有 `updateLoop()`、启动和停止方法。
- 将当前任务拆成当前用户、好友同步、Group 实例、游戏状态、更新检查、Discord 状态等 task module。
- timer 只负责调度，不直接访问 `AppApi`、数据库和多个 store。
- 用 fake clock 测试每个任务的触发周期。
- 实际落地文件为 `src/stores/updateLoopTasks/` 下的任务模块和 `updateLoopScheduler.js`；`updateLoop.js` 只负责依赖组装、注册、启动/停止和兼容 setter。
- 除六个目标任务外，非好友同步、IPC 超时、缓存清理、自动状态和数据库优化也已独立，避免遗留业务分支继续堆回 store。

这是最安全的第一刀：不改数据库结构、路由或 UI 接口，局部性高。每个提取步骤均单独提交并验证。

### 2）为 CEF/Electron 建立宿主 capability adapter

目标：`src/plugins/interopApi.js`、`src/ipc-electron/interopApi.js`、`src-electron/preload.js`、`src-electron/main.js`。

- 定义窄的 host interface，例如窗口、文件、存储、VR、数据库能力。
- CEF 和 Electron 各自提供 implementation。
- 暂时保留旧的 `window.AppApi` 兼容 facade，逐个迁移调用方。
- 主进程对 class、method、参数做 allowlist 和 schema 校验。
- 先迁移窗口/存储能力，再迁移数据库和系统操作。

这是高 leverage 的架构接缝（seam）：新旧实现可以短期并存，不需要一次性改写业务代码。

### 3）兼容式拆分数据库 facade

目标：`src/services/database/index.js`、`src/services/database/gameLog.js`、`src/services/accountHub.js`。

- 按 feed、activity、gameLog、favorites、notifications 等领域拆出 database module。
- 用显式账号上下文替代可变全局 `dbVars`。
- 保留现有 `database.xxx()` facade，将旧方法转发到新模块。
- 第一阶段优先拆 gameLog 的只读查询，避免先动写入和事务。
- 为 prefix、事务和账号切换增加 contract test。

这里的关键是保持旧接口和新 implementation 可以并存，避免大面积改动调用方。

## 7. 已执行的验证

| 检查项 | 结果 |
|---|---|
| `npm run prod` | 成功；存在 router 动态导入警告和 Node deprecation 警告 |
| `npm test` | 当前 248 个测试文件中 24 个失败、88 个断言失败并有 3 个既有未处理异常；M-06 新增测试通过，既有失败数量未增加 |
| updateLoop/task 定向测试 | 13 个测试文件、28 个测试通过 |
| M-03 adapter 定向测试 | DOM input、Toast、Router、关系建议通知、登出欢迎通知及 coordinator 回归测试通过 |
| M-09.1 Group 决策定向测试 | 4 个测试文件、20 个测试通过 |
| M-09.2 Group 语言 projection 定向测试 | 5 个测试文件、23 个测试通过 |
| M-09.3 Group presence 决策定向测试 | 6 个测试文件、26 个测试通过 |
| M-09.4 Group 持久化 projection 定向测试 | 7 个测试文件、29 个测试通过 |
| M-09.5/M-09.6 Favorite projection 定向测试 | 2 个测试文件、6 个测试通过 |
| M-09.7 User 语言 projection 定向测试 | 3 个测试文件、33 个测试通过 |
| M-09.8 User 自动状态决策定向测试 | 5 个测试文件、40 个测试通过 |
| M-08 Query cache/resource registry 定向测试 | 12 个测试文件、63 个测试通过 |
| M-08 新增 Query module `oxlint` | 0 warning、0 error；既有 API lint debt 未扩大 |
| M-06 Notification Store 定向测试 | 5 个测试文件、30 个测试通过 |
| `npm run lint` | 失败：约 45 个错误、79 个警告 |
| `npm run typecheck:js` | 工具链已补齐并可执行；当前仍有 54 条既有 TypeScript/JavaScript 诊断，已先消除 `updateLoop.js(65,28)`、Group API `bool`、Avatar 空参数、Notification typedef、V2 projection 误标参数、Feed 差异函数旧参数名、邀请 `rsvp` 误标参数、13 个上传选项误报、World/Instance API `ref` 推断误报、request 自定义 Error 字段误报、全部 Query key 解构参数误报、WebApi 二级账号 bridge 方法误报、Sentry 原始异常 message 误报、WorldDialog 两个 composable 的 toast 属性误报、quickSearch worker 临时字段误报、ConfigRepository 数值解析误报、cacheCoordinator SDK 版本属性误报、devtool SDK 版本属性误报、format 工具转换误报、localization URL/Error 参数误报、表格 debounce 定时器误报、FileReader ArrayBuffer 参数误报、主题 link 元素误报、Group API 重复方法误报、游戏注册表值解析误报、上传协调器 Blob.size 参数误报、manual relations 建议结果字段误报、game-log Dayjs 算术误报、Group API `order/sortBy` 必填误报、`useSearchGroup` 活动参数推断误报、`useSearchWorld` 缓存配置/活动参数推断误报、查询缓存日志目标误报、通知偏好过滤返回类型误报、导航配置过滤回调字面量误报、`$throw` 必然抛错返回类型误报、activity top-worlds 参数契约误报、friend store 重复导出键误报、Previous Instances actions `onLaunch` 必填误报、tray notification 投影可选输入误报、托盘通知 bridge 方法误报及旧版 Notification 查询字段必填误报，尚未作为阻断式 CI 门禁 |
| `dotnet test` | 已发现并通过 3 个测试；WinForms 用 STA 辅助器运行 |
| C# 测试项目构建 | 通过：0 警告、0 错误 |
| `screenshotMetadata-schema.json` | JSON 解析和 5 属性结构检查通过 |

### 术语说明

本文的“模块（module）”指可独立维护的代码边界；“接口（interface）”是调用方依赖的稳定契约；“adapter”用于隔离不同宿主实现；“接缝（seam）”允许新旧实现并存；“高 leverage”表示一次改动能降低多个调用方的复杂度；“局部性”表示修改影响范围可控。
