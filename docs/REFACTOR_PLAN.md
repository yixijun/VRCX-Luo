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
| Major | M-02 数据刷新链路契约化 | **进行中：M-02.5.1 已完成** | 提取 WebSocket 重连 seam（M-02.5.2） |
| Major | M-03 编排层纯化 | 待 M-02 | 先处理 DOM/Toast/Router 反向依赖 |
| Major | M-04 数据库 facade 深化 | 暂缓 | 等多账户方案恢复后再引入 `DbContext` |
| Major | M-05 账号会话与聚合视图 | **按要求暂缓** | 依赖 B-02，不进入当前迭代 |
| Major | M-06 Notification Store 拆分 | 待 M-01/M-04 | 先补 characterization tests |
| Major | M-07 Electron composition root / 双宿主契约 | 待 M-01 | 先建立启动流程 seam |
| Major | M-08 API/Query 缓存所有权 | 待 M-02 | 先盘点实体和 cache key |
| Major | M-09 其余上帝模块 | 待对应 seam | 每次只提取一个职责 |
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

## 当前 M-02 细分任务

1. **M-02.1 事件→副作用矩阵（已完成）**：为 `friendPresenceCoordinator` 覆盖 Online/Offline 的状态、Feed、通知、共享 Feed、数据库写入和排序更新；验证结果已固化在 `40292dfa`。
2. **M-02.2 纯 diff/记录决策函数（已完成）**：提取 `createFriendPresenceFeed` 输入→Feed 决策 module，不改变调用顺序和写入时机；验证结果已固化在 `909685bc`。
3. **M-02.3 注入接口（已完成）**：把 Friend Store、Feed、Shared Feed、通知和数据库 capability 作为显式依赖；旧入口继续组装默认 adapter；验证结果已固化在 `bfbfbddf`。
4. **M-02.4 事件迁移（已完成）**：`friend-update`、online/offline/active presence 和 `friend-location` 均已有可测试的显式 seam；下一步处理取消、重连和竞态。
5. **M-02.5 取消、重连、竞态**：覆盖 pending-offline、WebSocket 重连和轮询取消；当前已完成 pending-offline seam，下一步提取重连 seam。

已完成切片：

- **M-02.4.1 `friend-update` seam**：`runHandleUserUpdateFlow` 仍是兼容入口，新增的依赖核心可注入 Store、Feed、通知、共享 Feed 和数据库 adapter；Bio 变更的副作用顺序由测试固化。提交为 `9e987ab8`。
- **M-02.4.2 online/offline/active presence seam**：`runUpdateFriendFlow` 仍是兼容入口，新增的依赖核心可注入好友状态、用户缓存、重取用户、搜索索引、登录状态和延迟 transition capability；pending-offline 行为由测试固化。提交为 `ead6a2f5`。
- **M-02.4.3 `friend-location`**：新增纯 payload normalization module，完整用户和 fallback 两条路径均保持字段、解析顺序与 `applyUser` 调用行为；提交为 `bb50eb52`。
- **M-02.5.1 pending-offline tick**：`runPendingOfflineTickFlow` 仍是兼容入口，新增 `runPendingOfflineTickFlowWithDependencies` 核心，可注入好友状态和 delayed transition capability；fake clock 固化到期、提前返回和状态已匹配取消路径。提交为 `70f2703f`。

下一切片：**M-02.5.2 WebSocket 重连 seam**。开始前仍需先运行同一组受影响测试，完成后立即验证并单独提交；轮询取消由现有 `updateLoopScheduler` fake-clock stop 测试持续守护。

## 每个切片的回滚协议

1. 修改前运行受影响模块测试，记录既有失败数量和错误分类。
2. 只做一个逻辑变更；不改公共 interface 签名、序列化格式或并发逻辑。
3. 修改后重复同一组测试，并检查新增代码的 Oxlint/Oxfmt。
4. 通过后创建独立 Git commit；失败时只回滚当前切片。
5. 完成验证后再进入下一个 seam，并在本计划和架构诊断中同步状态。
