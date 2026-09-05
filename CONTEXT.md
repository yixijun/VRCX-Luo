# VRCX-Luo Domain Context

> 状态：Accepted  
> 更新时间：2026-09-05  
> 用途：为架构维护、重构和代码评审提供稳定的领域词汇与不变量。

## 产品边界

VRCX-Luo 是一个面向 VRChat 的桌面辅助应用：渲染层使用 Vue 3，桌面宿主同时存在 Windows CEF 和 Electron 两条运行路径。应用负责好友、群组、房间、通知、收藏、活动记录和 VR overlay/HUD 的查询、同步与展示；它不是 VRChat 官方客户端，也不拥有 VRChat 服务端数据的最终权威。

## 运行时角色

| 术语 | 含义 | 主要代码位置 |
|---|---|---|
| Renderer | Vue 页面、组件、Pinia Store、Query 和 Coordinator 组成的渲染端 | `src/` |
| CEF host | Windows CEF/.NET 宿主，负责桌面窗口、系统能力和 VR overlay 相关能力 | `Dotnet/Cef/`、`Dotnet/Overlay/` |
| Electron host | Electron 主进程与 .NET bridge，负责 IPC、窗口、托盘和 Linux/macOS 宿主能力 | `src-electron/`、`Dotnet/VRCX-Electron*.csproj` |
| Capability | Renderer 可以请求的宿主能力，例如剪贴板、文件选择、窗口和 .NET 方法 | `src/services/`、`src/ipc-electron/`、`src-electron/` |
| Account session | 当前登录用户及其请求、好友缓存、数据库上下文的运行时会话 | `src/stores/accountSession.js`、`src/stores/accountHub.js` |

## 领域词汇

| 术语 | 定义与不变量 |
|---|---|
| Friend presence | 好友在线、离线、活跃、位置和房间变化组成的事件流；事件顺序影响 Store、Feed、通知和数据库副作用 |
| Group instance | 群组拥有或关联的房间实例；成员、访问类型、角色和实例状态必须沿原事件顺序投影 |
| Update loop | 登录后运行的周期调度器；它只负责启动、停止和触发任务，任务周期与停止清理是可观察契约 |
| VR overlay / HUD | VRChat 内可见的桌面叠加界面与手腕界面；显示开关、触发键和 CEF bridge 行为必须与正式版兼容 |
| Feed | 由好友/群组/活动事件投影出的时间线记录；Feed 决策与 Store、通知、数据库写入是不同的副作用 |
| Projection | 将 API/数据库/事件输入转换为 Store、配置、通知或展示模型的纯映射；不主动发起宿主 I/O |
| Coordinator | 负责事件编排与副作用顺序的 Module；DOM、Toast、Router、Noty 等实现应通过 Adapter 进入 |
| Store | Pinia 状态容器；拥有状态和对外 action，不应成为所有 API、数据库和宿主调用的汇聚点 |
| Generated artifact | 由 SDK、IDE 或构建步骤生成的代码、二进制或清单；必须从来源整体更新，不在业务重构中逐行维护 |

## 架构语言

本项目沿用以下定义：

- `Module`：拥有 `Interface` 和 `Implementation` 的函数、类、包或功能切片。
- `Interface`：调用方必须知道的类型、顺序、不变量、错误模式和配置，不只是函数签名。
- `Seam`：可以替换行为而无需原地改写调用方的 Interface 位置。
- `Adapter`：在 Seam 上满足 Interface 的具体实现，例如 CEF/Electron capability adapter。
- `Depth`：小 Interface 背后承载较多行为的杠杆；高 `Depth` 带来更好的 `Leverage` 和 `Locality`。

## 当前必须保持的不变量

1. 公开入口和兼容 facade 保持原签名、返回值、序列化字段与错误/取消语义。
2. Update loop、WebSocket 重连、pending-offline 等任务保持原周期、停止清理和并发顺序。
3. CEF 与 Electron 的 capability 通过同一安全契约校验；Renderer 来源、方法 allowlist 和参数 envelope 不可绕过。
4. 根 `Version` 是唯一人工版本来源；package/lock 同步由门禁确认，跨宿主依赖漂移先报告再评估。
5. 多账户运行时改动在 B-02/M-05 重新授权前暂停；不得为了类型或文档“顺手”替换 `dbVars`、会话生命周期或聚合行为。
6. 每个逻辑切片独立验证并提交到本地 Git；测试失败只回滚当前切片，不覆盖用户已有工作。

## 维护导航

- 架构诊断与依赖图：[`docs/ARCHITECTURE_DIAGNOSIS.md`](docs/ARCHITECTURE_DIAGNOSIS.md)
- 重构计划与回滚协议：[`docs/REFACTOR_PLAN.md`](docs/REFACTOR_PLAN.md)
- 已接受架构决策：[`docs/adr/README.md`](docs/adr/README.md)
- 版本矩阵：[`docs/DEPENDENCY_VERSION_MATRIX.md`](docs/DEPENDENCY_VERSION_MATRIX.md)
- 生成文件规则：[`docs/GENERATED_FILE_POLICY.md`](docs/GENERATED_FILE_POLICY.md)
