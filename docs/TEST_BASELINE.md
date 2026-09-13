# VRCX-Luo 测试与契约基线

> 记录时间：2026-09-05
>
> 用途：记录 M-00 测试与契约门禁、B-01 宿主桥安全门禁、N-02 版本来源门禁及 N-03 Shared/Localization 门禁的当前基线。后续每个重构切片都必须与本文件中的对应命令对比；失败数量或错误类型增加时，停止当前切片并回滚当前 commit。

## 当前工作树

- 当前分支：`master`
- 基线建立前工作树：干净；当前工作树应在每个独立切片提交后恢复干净
- `updateLoop` scheduler/task 拆分：已完成，不在本轮重复修改
- B-01 宿主桥安全封口：已完成；来源策略和 174 个方法参数 schema 均有定向回归测试
- N-02 版本与构建来源：已完成；根 `Version` 驱动 package/lock 同步，Electron/Vite/产物命名共用版本 reader，构建前 `check:version` 门禁已接入
- N-03 Shared/Localization 边界：已完成；依赖方向 guard、语言包 contract 和 `check:architecture` CI 门禁已接入
- schema 文件：`docs/schemas/screenshotMetadata-schema.json` 由 `npm run check:schema` 校验

## 命令结果

| 检查 | 命令 | 结果 | 基线说明 |
|---|---|---|---|
| 前端完整测试 | `npm test -- --reporter=dot --maxWorkers=2` | **失败（report-only）** | 255 个文件：231 通过、24 失败；2395 项测试：2307 通过、88 失败；3 个未处理错误 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过（阻断）** | 0 条诊断；`typescript` CLI 已锁定在开发依赖 |
| C# 测试发现 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-build --list-tests` | **通过（阻断）** | 发现 3 个测试 |
| C# 自动化测试 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --configuration Release --verbosity normal` | **通过（阻断）** | 3/3；WinForms 用 STA 辅助器运行 |
| JSON Schema 结构检查 | `npm run check:schema` | **通过（阻断）** | 5 个属性；文件可解析且结构有效 |
| Oxlint | `npm run lint:oxlint` | **失败** | 79 个 warning、45 个 error；本轮不顺带修复业务 lint 债务 |
| 格式检查 | `npm run format:check` | **失败** | 209 个文件存在格式差异；本轮只记录，不做全仓格式化 |

## M-01.3 后置验证

2026-09-04，`Dotnet.Tests` 已从自定义 `Main` smoke runner 转为正式 xUnit 测试项目。原有 WinForms 验证逻辑保留，由 STA 辅助器在测试线程中执行。

| 检查 | 命令 | 结果 |
|---|---|---|
| C# 测试发现 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-build --list-tests` | **通过**：发现 3 个测试 |
| C# 自动化测试 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore` | **通过**：3/3 |
| C# 测试项目构建 | `dotnet build Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore` | **通过**：0 警告、0 错误 |
| 前端 updateLoop 定向测试 | `npx vitest run src/stores/updateLoopTasks --reporter=dot` | **通过**：12 个文件、26 项测试 |
| Schema 结构检查 | `npm run check:schema` | **通过**：5 个属性 |

本切片只涉及 `Dotnet.Tests` 测试项目和测试代码；未修改产品运行时、公共接口、序列化格式或并发逻辑。

## B-01 后置验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 可信 renderer source policy、IPC guard、Dotnet 参数 schema | `npx vitest run src/services/__tests__/rendererSourcePolicy.test.js src/services/__tests__/ipcHandlers.test.js src/services/__tests__/dotnetCapabilityManifest.test.js --reporter=dot` | **通过**：3 个文件、13 个测试 |
| 重构 smoke（含 B-01） | `npm run test:refactor -- --reporter=dot` | **通过**：56 个文件、293 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`rendererSourcePolicy.cjs`、`dotnetCapabilityManifest.cjs`、`ipcHandlers.cjs` | **通过** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |
| JSON Schema 结构检查 | `npm run check:schema` | **通过**：5 个属性 |
| Windows C# 测试 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore` | **通过**：3/3 |
| 生产构建 | `npm run prod` | **通过**；保留既有 router 动态 import 与 Node deprecation 警告 |

B-01 的来源 guard 在主进程注册的 15 个 IPC handler 前执行：packaged 模式只允许 `build/html/index.html` 与 `build/html/vr.html`，`--hot-reload` 仅增加 localhost:9000 的对应页面；CEF 绑定路径不变。参数 schema 只拒绝不匹配的方法/参数，既有合法调用、序列化格式、任务周期和并发顺序保持不变。

## 失败分类

### 完整前端测试

当前失败主要分为以下几类，后续修复必须逐类、逐切片处理：

1. 测试 mock 未覆盖新增导出，例如 `i18n.global`、`DropdownMenuPortal`、通知设置 store 和 coordinator 方法。
2. jsdom 能力不足或测试替身不完整，例如 Canvas、导航和剪贴板行为。
3. 既有测试依赖真实更新请求或数据库方法，导致异步错误和未处理 rejection。
4. 个别测试存在超时或断言与当前实现漂移。

### 质量门禁

- `typecheck:js`：已补齐 TypeScript CLI 并清零 JavaScript/TypeScript 诊断，现作为阻断门禁。
- `Dotnet.Tests`：已引入正式测试框架和可发现的测试项目，并接入 Windows CI job；继续保留 WinForms 的 STA 线程约束。
- `test:refactor`：新增覆盖 coordinator、services、queries、notification、updateLoop task 和 B-01 bridge security 的 smoke 集，当前 56 个文件、293 项测试通过。
- Oxlint / Oxfmt：当前全仓基线仍为 45 errors/79 warnings 与 209 个格式差异；CI 保留可见 report-only 结果，不在本任务中一次性重排全仓文件。
- Schema：`npm run check:schema` 已作为阻断检查，防止文件再次出现语法漂移。

## M-00.3 后置验证

`.github/workflows/ci.yaml` 已改为 PR（目标分支 `master`）和手动 `workflow_dispatch` 均可触发。门禁按现有基线分层：

| CI 检查 | 策略 | 当前结果 |
|---|---|---|
| JavaScript typecheck | 阻断 | 0 diagnostics |
| Screenshot metadata schema | 阻断 | 5 properties |
| `npm run test:refactor` | 阻断 | 56 个文件、293 项测试通过 |
| `npm run prod` | 阻断 | 构建通过；保留既有动态 import 与 Node deprecation 警告 |
| C# `dotnet test` | 阻断（Windows） | 3/3 通过 |
| 全量前端测试 | report-only | 24/255 文件失败、88/2395 测试失败、3 个未处理错误 |
| Oxlint / Oxfmt | report-only | 45 errors/79 warnings；209 个文件有格式差异 |
| C# format | report-only | 遗留格式基线，结果在 CI 中可见 |

当前没有增加“改动文件 lint 必须通过”的伪硬门禁：全仓 lint/format 基线仍为红色，直接启用会让现有分支无法区分新增回归。后续每个切片必须维持上述 report-only 结果不恶化，再逐步收紧。

## N-02 后置验证

2026-09-05，版本来源统一切片完成。根 `Version` 保持唯一人工维护来源；package/lock 由同步脚本生成，Electron、Vite 和产物命名脚本通过共享 `versionMetadata.cjs` 读取；`check:version` 校验 package metadata 与 `Version` 的推导结果，并接入 Electron 构建命令。

| 检查 | 命令 | 结果 |
|---|---|---|
| 版本元数据/同步/一致性定向测试 | `npx vitest run src/services/__tests__/versionMetadata.test.js src/services/__tests__/versionPackageSync.test.js src/services/__tests__/versionConsistency.test.js src/services/__tests__/versionConsistencyCli.test.js --reporter=dot` | **通过**：4 个文件、11 项测试 |
| 版本来源一致性 | `npm run check:version` | **通过**：`2026.08.23 -> 2026.08.23` |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：60 个文件、304 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |
| 生产构建 | `npm run prod` | **通过**；保留既有 router 动态 import 与 Node deprecation 警告 |

N-02 的首次 Vite 接入尝试触发了跨 tsconfig 类型诊断，已由 `ffcc32a6` 回滚；安全重做 `271dfdca` 通过类型检查、测试和生产构建，未改变公共接口、序列化格式或并发语义。

## N-03 后置验证

2026-09-05，Shared/Localization 边界门禁完成。`src/shared` 与 `src/localization` 的新增反向项目依赖会被阻断；当前 14 条历史边显式登记为 legacy exceptions。语言包以 `en.json` 为 canonical key set，结构错误阻断，既有 fallback 缺失/额外 key 仅报告，不自动修改翻译资源。

| 检查 | 命令 | 结果 |
|---|---|---|
| Shared/Localization 依赖方向 | `npm run check:dependency-direction` | **通过**：74 个源文件、14 条受限边，14 条均为已登记历史例外 |
| Localization contract | `npm run check:localization` | **通过**：14 个语言包、2699 个 canonical key；13285 个 fallback 缺失、200 个额外 key 可见报告 |
| 聚合架构门禁 | `npm run check:architecture` | **通过**：依赖方向与语言包检查统一入口 |
| N-03 定向测试 | `npx vitest run src/services/__tests__/dependencyDirection.test.js src/services/__tests__/localizationContract.test.js --reporter=dot` | **通过**：2 个文件、7 项测试 |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：62 个文件、311 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |
| 生产构建 | `npm run prod` | **通过**：4408 个模块；保留既有 router 动态 import 与 Node deprecation 警告 |

N-03 的检查默认不自动修复遗留 key 差异；`check-localization.js --strict` 已保留为未来全量 parity 迁移的显式入口。新增门禁没有改变公共 interface、序列化格式、任务周期或并发语义。

## N-04 后置验证

2026-09-05，第三方依赖/生成文件治理完成。版本矩阵读取 npm manifest/lockfile 和三个 .NET 宿主项目；结构性错误阻断，跨宿主版本漂移只报告。生成文件、原生 OpenVR 二进制和构建时 Installer 注入文件均只补来源与修改边界，没有改写产物。

| 检查 | 命令 | 结果 |
|---|---|---|
| 依赖矩阵定向测试 | `npx vitest run src/services/__tests__/dependencyVersionMatrix.test.js --reporter=dot` | **通过**：1 个文件、3 项测试 |
| 依赖版本矩阵 | `npm run check:dependency-matrix` | **通过**：3 个 .NET 项目；5 组跨宿主漂移可见报告 |
| Shared/Localization 聚合门禁 | `npm run check:architecture` | **通过**：74 个文件、14 个历史例外、14 个语言包 |
| 版本来源一致性 | `npm run check:version` | **通过**：`2026.08.23 -> 2026.08.23` |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：63 个文件、314 项测试 |
| 生产构建与许可清单 | `npm run prod` | **通过**：4408 个模块；生成 118 条许可条目；保留既有动态 import 与 Node deprecation 警告 |

N-04 没有修改公共 interface、序列化格式、任务周期、并发逻辑、第三方版本或生成结果；CI 仅新增 `npm run check:dependency-matrix` 阻断结构性错误。

## M-07.4 后置验证

窗口状态 Adapter 切片只迁移持久化配置读取和窗口状态动作；第一次测试假设 `VRCX_WindowState=0` 会触发 `restore()`，发现旧实现的 `parseInt(...) || -1` 会将其视为无动作后，按回滚协议撤回该假设并保留实际兼容行为。

| 检查 | 命令 | 结果 |
|---|---|---|
| 窗口状态定向测试 | `npx vitest run src/services/__tests__/windowState.test.js --reporter=dot` | **通过**：1 个文件、4 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/windowState.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：64 个文件、318 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.5 后置验证

窗口事件 Bridge 切片只迁移 `webContents` 缩放、窗口几何/状态/焦点事件的监听和 renderer 通知；保留既有 channel 名称、payload、事件顺序、缩放持久化键及视觉缩放限制。未修改关闭守卫、托盘、通知、VR overlay 或 renderer interface。

| 检查 | 命令 | 结果 |
|---|---|---|
| 窗口状态/事件定向测试 | `npx vitest run src/services/__tests__/windowState.test.js src/services/__tests__/windowEventBridge.test.js --reporter=dot` | **通过**：2 个文件、7 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/windowEventBridge.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：65 个文件、321 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.6 后置验证

窗口关闭守卫 Adapter 切片只迁移 `BrowserWindow` 的 `close` 监听；保留退出状态、关闭到托盘、提示框选项、重复提示并发守卫、偏好持久化顺序、最小化/退出动作和 finally 清理语义。未修改托盘、通知、VR overlay 或 renderer interface。

| 检查 | 命令 | 结果 |
|---|---|---|
| 关闭决策/窗口状态事件定向测试 | `npx vitest run src/shared/utils/__tests__/closeToTrayDecision.test.js src/services/__tests__/windowState.test.js src/services/__tests__/windowEventBridge.test.js src/services/__tests__/windowCloseHandler.test.js --reporter=dot` | **通过**：4 个文件、11 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/windowCloseHandler.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：66 个文件、324 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.7 后置验证

托盘上下文菜单 Adapter 切片只迁移菜单模板和点击动作；保留菜单顺序、中文文案、checkbox 读取、存储键/字符串值、renderer 通知、菜单重建、开发者工具和退出语义。未修改托盘图标/生命周期、桌面通知实现、VR overlay 或 renderer interface。

| 检查 | 命令 | 结果 |
|---|---|---|
| 托盘菜单/关闭决策定向测试 | `npx vitest run src/services/__tests__/trayContextMenu.test.js src/shared/utils/__tests__/closeToTrayDecision.test.js src/services/__tests__/windowCloseHandler.test.js --reporter=dot` | **通过**：3 个文件、7 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/trayContextMenu.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：67 个文件、327 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.8 后置验证

托盘图标工厂切片只迁移平台图标路径/尺寸选择和 `Tray` 实例创建；保留 macOS/Linux 缩放尺寸、Windows `.ico` 路径、图标引用和后续 tooltip/context menu/click 绑定顺序。未修改托盘生命周期、通知、VR overlay 或 renderer interface。

| 检查 | 命令 | 结果 |
|---|---|---|
| 托盘图标/菜单定向测试 | `npx vitest run src/services/__tests__/trayIconFactory.test.js src/services/__tests__/trayContextMenu.test.js --reporter=dot` | **通过**：2 个文件、7 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/trayIconFactory.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：68 个文件、330 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.9 后置验证

托盘通知 projection 切片只迁移 snapshot 规范化和 tooltip 文本生成；保留无效输入 fallback、最多 4 条 item/3 条 tooltip、action 限制、字符串化、截断长度、默认文案和空列表行为。未修改桌面 Notification、通知 action IPC、托盘生命周期、VR overlay 或 renderer interface。

| 检查 | 命令 | 结果 |
|---|---|---|
| 托盘通知/菜单定向测试 | `npx vitest run src/services/__tests__/trayNotificationProjection.test.js src/services/__tests__/trayContextMenu.test.js src/services/__tests__/trayIconFactory.test.js --reporter=dot` | **通过**：3 个文件、8 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/trayNotificationProjection.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：69 个文件、332 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.10 后置验证

桌面通知 controller 切片只迁移启用判断、旧通知替换、Notification options、close 清理和 show 调用；保留 `notification:showNotification` IPC 参数顺序、`silent` 布尔化、active notification 竞态和 renderer/宿主接口。第一次测试替身错误地让 `close()` 同步触发 close listener，已按回滚协议撤销未提交尝试；修正为异步 close 语义后重新验证通过。

| 检查 | 命令 | 结果 |
|---|---|---|
| 桌面通知/宿主定向测试 | `npx vitest run src/services/__tests__/desktopNotificationController.test.js src/services/__tests__/hostCapabilityContract.test.js src/services/__tests__/trayContextMenu.test.js --reporter=dot` | **通过**：3 个文件、8 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/desktopNotificationController.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：70 个文件、335 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.11 后置验证

托盘生命周期动作切片只迁移 `destroyTray()` 和 `setTrayIconNotification()` 的内部实现；保留空值守卫、destroy 后清空引用、普通/通知图标选择及重启、退出、通知 IPC 的调用位置。

| 检查 | 命令 | 结果 |
|---|---|---|
| 托盘生命周期/菜单定向测试 | `npx vitest run src/services/__tests__/trayLifecycle.test.js src/services/__tests__/trayIconFactory.test.js src/services/__tests__/trayContextMenu.test.js src/services/__tests__/trayNotificationProjection.test.js --reporter=dot` | **通过**：4 个文件、11 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/trayLifecycle.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：71 个文件、338 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-07.12 后置验证

托盘点击 Bridge 切片只迁移 `click → mainWindow.show()` listener；保留 Tray 创建顺序、窗口引用和显示行为。

| 检查 | 命令 | 结果 |
|---|---|---|
| 托盘生命周期/点击定向测试 | `npx vitest run src/services/__tests__/trayLifecycle.test.js src/services/__tests__/trayIconFactory.test.js src/services/__tests__/trayContextMenu.test.js --reporter=dot` | **通过**：3 个文件、10 项测试 |
| Electron/CJS 语法 | `node --check src-electron/main.js`、`node --check src-electron/trayLifecycle.cjs` | **通过** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过**：71 个文件、339 项测试 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过**：0 diagnostics |

## M-10 后置验证

2026-09-05，GameLog 深化的 M-10.1～M-10.4 全部完成。每一刀都先运行受影响测试，再做单一逻辑变更并立即重复验证；兼容 facade、页面调用、序列化格式、SQL/参数顺序、任务周期、debounce、timer 和并发语义均保持不变。

| 切片 | 改动与定向结果 |
|---|---|
| M-10.1 Parser | `src/services/gameLogParser.js` 承接 19 个原始 tuple 映射；`LogWatcherService.parseRawGameLog()` 保留兼容委托。**基线 2 个文件/22 项 → 回归 2 个文件/23 项，全部通过**。提交：`296aa38a` |
| M-10.2a row projection | `src/services/database/gameLogRowProjection.js` 承接 Location/lookup/search 返回行映射。数据库定向回归通过；提交：`aff0098b` |
| M-10.2b query parameters | `src/services/database/gameLogQueryParameters.js` 承接 VIP 参数化/转义和 location/table filter flags，并接回 database facade。**3 个文件、22 项测试通过**；提交：`ac89133f`、`6fc90bec` |
| M-10.3 sessions filters | `src/stores/gameLog/sessionsFilters.js` 承接日期范围、全局/成员/事件搜索、segment 分组投影和空段清理。**4 个文件、27 项测试通过**；提交：`157331da` |
| M-10.4 now-playing ticker | `src/stores/gameLog/nowPlayingTicker.js` 通过显式 clock/timer/view 依赖承接 1000ms 更新、完成清理和视图刷新。**4 个文件、35 项测试通过**；提交：`23981f39` |

| 检查项 | 命令 | 结果 |
|---|---|---|
| M-10 合并定向回归 | `npx vitest run src/services/__tests__/gameLog.test.js src/services/database/__tests__/gameLog.test.js src/services/database/__tests__/gameLogRowProjection.test.js src/services/database/__tests__/gameLogQueryParameters.test.js src/stores/gameLog/__tests__/sessionsFilters.test.js src/stores/__tests__/nowPlayingTicker.test.js src/stores/__tests__/mediaParsers.test.js src/views/GameLog/__tests__/GameLog.test.js src/views/GameLog/__tests__/GameLogSessions.test.js --reporter=dot` | **通过：9 个文件、83 项测试** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过：71 个文件、340 项测试** |
| 生产构建 | `npm run prod` | **通过：4413 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |

回滚记录：M-10.2b 首次整合因新参数 module 的 `args` 静态推断过宽导致 `typecheck:js` 失败，按回滚协议立即撤回未提交改动；随后拆成纯 module 与 facade 接入两个切片（`ac89133f`、`6fc90bec`）并通过全部门禁。以上代码提交均为独立本地回滚点，未发布、未推送。

## M-11.1 后置验证

2026-09-05，Appearance Store 的三个 DOM class implementation 已移入 `src/services/appearanceDomAdapter.js`。Store 仍保留旧的 `applyAccessibleStatusClass()`、`applyOfficialStatusColorsClass()`、`applyTableDensity()` 兼容入口；class 名称、增删顺序、初始化时机和设置 action 未改变。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前 Appearance/NavMenu 定向基线 | `npx vitest run src/stores/__tests__/uiNotifications.test.js src/shared/utils/base/__tests__/ui.test.js src/components/nav-menu/composables/__tests__/useNavTheme.test.js src/components/nav-menu/__tests__/NavMenu.test.js --reporter=dot` | **4 个文件、21 项测试；19 项通过，NavMenu 2 项既有 `DropdownMenuPortal` mock 失败** |
| M-11.1 Adapter RED → GREEN | `npx vitest run src/services/__tests__/appearanceDomAdapter.test.js --reporter=dot` | **先因模块不存在失败，接入实现后 1 个文件、3 项通过** |
| 改动后 Appearance/NavMenu 定向回归 | 同上基线命令并加入 `appearanceDomAdapter.test.js` | **5 个文件、24 项测试；22 项通过，仍为同 2 项既有 NavMenu mock 失败，未新增失败** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过：72 个测试文件、343 项测试** |
| 生产构建 | `npm run prod` | **通过：4414 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |

首次接入尝试因自定义嵌套 JSDoc typedef 误描述 `Document` 而导致类型检查失败，已按回滚协议撤回未提交改动；第二次使用显式嵌套参数契约后通过全部门禁。代码提交：`b00564e2`。未发布、未推送。

## M-11.2 后置验证

2026-09-05，UI Store 的 body `drop` guard 已移入 `src/services/dropGuard.js`。Store 仍在原初始化位置注册 `drop` listener，事件名、`preventDefault()` 行为、截图管理器语义和 UI Store public interface 均未改变；adapter 额外返回 cleanup 供测试和后续宿主生命周期使用。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前 UI Store 定向基线 | `npx vitest run src/stores/__tests__/uiNotifications.test.js --reporter=dot` | **通过：1 个文件、8 项测试** |
| M-11.2 Adapter RED → GREEN | `npx vitest run src/services/__tests__/dropGuard.test.js --reporter=dot` | **先因模块不存在得到预期失败；实现后 1 个文件、1 项通过** |
| M-11.2 Adapter/Store 定向回归 | `npx vitest run src/services/__tests__/dropGuard.test.js src/stores/__tests__/uiNotifications.test.js --reporter=dot` | **通过：2 个文件、9 项测试** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过：73 个测试文件、344 项测试** |
| 生产构建 | `npm run prod` | **通过：4415 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |

代码提交：`9844d194`。未发布、未推送。M-11.2 未修改 `src/vr`、CEF/Electron bridge、窗口接口、多账户会话或任何公共页面调用方。

## M-11.3 后置验证

2026-09-05，UI Store 的对话框面包屑数组状态变换已移入 `src/stores/ui/dialogCrumbState.js`。Store 继续保留 `pushDialogCrumb()`、`setDialogCrumbLabel()`、`jumpDialogCrumb()`、`clearDialogCrumbs()` 原有 public interface；重复项截断、默认 label、label 更新、索引边界和清空语义未改变，页面、Coordinator、路由、窗口能力和 VR overlay 未修改。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前 Store/页面定向基线 | `npx vitest run src/stores/__tests__/uiNotifications.test.js src/components/dialogs/__tests__/MainDialogContainer.test.js --reporter=dot` | **通过：2 个文件、13 项测试** |
| M-11.3 Module RED → GREEN | `npx vitest run src/stores/__tests__/dialogCrumbState.test.js --reporter=dot` | **按行为逐步先得到预期 RED，再实现对应接口；最终 1 个文件、9 项测试通过** |
| M-11.3 Store/页面定向回归 | `npx vitest run src/stores/__tests__/dialogCrumbState.test.js src/stores/__tests__/uiNotifications.test.js src/components/dialogs/__tests__/MainDialogContainer.test.js --reporter=dot` | **通过：3 个文件、23 项测试** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过：73 个测试文件、344 项测试** |
| 生产构建 | `npm run prod` | **通过：4416 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |

代码提交：`8556c0ef`。未发布、未推送。M-11.3 只移动数组状态 implementation，未改变 UI Store 的 Store/页面兼容入口或其他宿主行为。

## M-11.4 后置验证

2026-09-05，UI Store 的托盘通知宿主调用已移入 `src/services/trayIconNotificationAdapter.js`。Store 继续保留通知状态计算、`force`/变化守卫、调用时机和 public interface；Windows CEF 仍调用 `AppApi.SetTrayIconNotification`，Linux Electron 仍调用 `window.electron.setTrayIconNotification`。`notifiedMenus`、`notificationIconDot`、序列化格式、并发和 VR overlay 均未改变。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前宿主/Store 定向基线 | `npx vitest run src/stores/__tests__/uiNotifications.test.js src/services/__tests__/hostCapabilityContract.test.js src/services/__tests__/trayLifecycle.test.js --reporter=dot` | **通过：3 个文件、15 项测试** |
| M-11.4 Adapter RED → GREEN | `npx vitest run src/services/__tests__/trayIconNotificationAdapter.test.js --reporter=dot` | **先因模块不存在得到预期 RED；实现后 1 个文件、2 项 fake-host 路由测试通过** |
| Adapter/Store 定向回归 | `npx vitest run src/services/__tests__/trayIconNotificationAdapter.test.js src/stores/__tests__/uiNotifications.test.js src/services/__tests__/hostCapabilityContract.test.js src/services/__tests__/trayLifecycle.test.js --reporter=dot` | **通过：4 个文件、17 项测试** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 重构 smoke | `npm run test:refactor -- --reporter=dot` | **通过：74 个测试文件、346 项测试** |
| 生产构建 | `npm run prod` | **通过：4417 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |

定向测试仍会输出既有的 VRChat 状态请求失败、GitHub release JSON 空响应和 jsdom Canvas 未实现日志；它们与 M-11.4 无关，未新增失败。代码提交：`e2957f69`。文档提交将在本节更新后单独建立；未发布、未推送。

M-11.1～M-11.4 均建立了独立本地回滚点。本轮前端 UI 重构停止线已达到；Windows CEF 按触发键后 wrist/HUD 不显示问题已由用户在测试版手动确认解决，本记录不将其归因于 M-11.4 的托盘 Adapter 变更。后续不再自动拆分剩余 router/窗口动作或大型组件，转入功能观察。

## 功能变更：离线好友按最近离线时间排序

2026-09-05，侧栏离线分组改为按 `friend.ref.$offline_for` 毫秒时间戳倒序显示，最近离线的好友在最上方。无时间戳的旧数据排在有时间戳数据之后，并保持彼此原顺序；好友状态 transition、Store public interface、序列化格式、多账户合并视图和 VR overlay 均未修改。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前侧栏基线 | `npx vitest run src/views/Sidebar/components/__tests__/FriendsSidebar.test.js --reporter=dot` | **通过：1 个文件、5 项测试** |
| 行为 RED | `npx vitest run src/views/Sidebar/components/__tests__/FriendsSidebar.test.js -t "sorts offline friends by most recent offline time first" --reporter=dot` | **预期失败**：旧顺序为 `usr_old`、`usr_recent`，未满足最近离线在前 |
| 行为 GREEN/侧栏回归 | `npx vitest run src/views/Sidebar/components/__tests__/FriendsSidebar.test.js --reporter=dot` | **通过：1 个文件、6 项测试** |
| Sidebar 组件目录回归 | `npx vitest run src/views/Sidebar/components/__tests__ --reporter=dot` | **通过：7 个文件、34 项测试**；仅输出既有删除失败日志，无测试失败 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 生产构建 | `npm run prod` | **通过：4417 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |

### 启动时已离线好友的排序兜底修正

同日复核发现，应用启动时已经处于离线状态的好友尚未经历本次运行的在线→离线 transition，通常没有 `$offline_for`。侧栏现优先使用该字段；缺失时依次使用 `last_activity`、`last_login`，因此最近活动的离线好友仍排在上面；三个字段都缺失时保持原顺序。好友状态 transition、Store public interface、序列化格式、多账户合并视图和 VR overlay 仍未修改。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 兜底行为 RED | `npx vitest run src/views/Sidebar/components/__tests__/FriendsSidebar.test.js --reporter=dot` | **预期失败**：无 `$offline_for` 时保留旧顺序 `usr_old_startup`、`usr_recent_startup` |
| 兜底行为 GREEN/侧栏回归 | `npx vitest run src/views/Sidebar/components/__tests__/FriendsSidebar.test.js --reporter=dot` | **通过：1 个文件、7 项测试** |
| Sidebar 组件目录回归 | `npx vitest run src/views/Sidebar/components/__tests__ --reporter=dot` | **通过：7 个文件、35 项测试**；仅输出既有删除失败日志，无测试失败 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 生产构建 | `npm run prod` | **通过：4417 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |

共享好友排序旧测试的既有基线仍有 3 项失败（时间实例、None、空排序数组），本次没有修改该模块，也未增加失败。代码提交：`ba12266d`。未发布、未推送。

## 功能修正：桌面手背模拟空白

2026-09-06，桌面测试页因没有 CEF/OpenVR 宿主推送而只显示空手背外壳。修正仅作用于显式 `wrist-pointer-test=1` 分支：通过正式 `$vr.*Update` 入口注入确定性动态/位置/设备快照，并保持正式 VR 模板、尺寸、宿主绑定和指针接口不变。共享画布右侧及下方未被裁剪的空白仍属于正式 VR 纹理图集中的非 Overlay 区域，不代表手背内容丢失。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 快照模块 RED → GREEN | `npx vitest run src/vr/__tests__/wristPointerDesktopTest.test.js --reporter=dot` | **通过：1 个文件、11 项测试** |
| VR 指针定向回归 | `npx vitest run src/vr/__tests__/wristPointerDesktopTest.test.js src/vr/__tests__/wristPointer.test.js src/vr/components/__tests__/WristOriginMarker.test.js --reporter=dot` | **通过：3 个文件、18 项测试** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 目标文件 Lint | `npx eslint src/vr/wristPointerDesktopTest.js src/vr/__tests__/wristPointerDesktopTest.test.js src/vr/vr.js src/vr/Vr.vue` | **通过** |
| 生产构建 | `npm run prod` | **通过：4425 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 浏览器手动验证 | `http://127.0.0.1:9001/vr.html?wrist-pointer-test=1#/` | **通过**：动态 5 条、设备 4 个、在线好友 4 个；鼠标原点可移动 |
| Git 回滚点 | `1f6454ea`、`57288b01` | 未发布、未推送 |

## 功能修正：房间进出筛选记忆

2026-09-06，房间进出悬浮窗的身份筛选（全部/仅好友/陌生人）和方向筛选（全部/进入/离开）改为通过 `useLocalStorage` 保存到 `VRCX_instancePlayerEventsFilters`。关闭悬浮窗导致组件卸载后，重新打开仍恢复上次选择；应用重启后也会保留。读取时只接受既有筛选值，非法或损坏值回退为“全部”；查询参数、事件顺序、组件 public props、并发语义和多账户逻辑均未改变。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前组件基线 | `npx vitest run src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js --reporter=dot` | **通过：1 个文件、3 项测试** |
| 记忆行为 RED → GREEN | 同上定向命令 | **先因重开后筛选回到 `all` 得到预期失败；实现后通过：1 个文件、4 项测试** |
| PlayerList 相关回归 | `npx vitest run src/views/PlayerList/__tests__ src/views/PlayerList/components/__tests__ --reporter=dot` | **通过：5 个文件、25 项测试**；保留既有未注册组件/`ariaPressed` 警告 |
| 目标文件 Lint | `npx eslint src/views/PlayerList/components/InstancePlayerEvents.vue src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js` | **通过** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 生产构建 | `npm run prod` | **通过：4425 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有 CRLF 转换警告 |
| Git 回滚点 | 本次独立提交 | 未发布、未推送 |

## 功能修正：戳一戳自定义图标选中态

2026-09-07，戳一戳弹窗中的 VRC+ 自定义图标补充明确的选中反馈：选中项显示主色边框、背景、外圈和右上角勾选标记，并保留 `aria-pressed` 与键盘 Enter/Space 操作。发送参数、默认表情选择、图标管理入口和弹窗 public interface 均未改变。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前组件基线 | `npx vitest run src/components/dialogs/__tests__/SendBoopDialog.test.js --reporter=dot` | **通过：1 个文件、4 项测试** |
| 选中态行为 RED → GREEN | 同上定向命令 | **先因缺少自定义图标选中标记得到预期失败；实现后通过：1 个文件、5 项测试** |
| Dialog 目录回归 | `npx vitest run src/components/dialogs/__tests__ --reporter=dot` | **31/32 项通过**；唯一失败为既有 `CustomNavDialog` mock 未提供 `useNotificationsSettingsStore`，未涉及本次组件 |
| 目标文件 Lint | `npx eslint src/components/dialogs/SendBoopDialog.vue src/components/dialogs/__tests__/SendBoopDialog.test.js` | **通过** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 生产构建 | `npm run prod` | **通过：4425 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| Git 回滚点 | 本次独立提交 | 未发布、未推送 |

## 功能修正：戳一戳自定义图标选中徽标位置

2026-09-07，修正自定义图标选中徽标的位置：从卡片右下角移到右上角，并通过 `z-10` 保证徽标显示在贴纸内容之上。只调整视觉层级，不改变选中值、发送参数、弹窗接口或键盘操作。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前位置基线 | `npx vitest run src/components/dialogs/__tests__/SendBoopDialog.test.js --reporter=dot` | **通过：1 个文件、5 项测试** |
| 位置断言 RED → GREEN | 同上定向命令 | **先因仍含 `bottom-1.5` 得到预期失败；实现后通过：1 个文件、5 项测试** |
| Dialog 目录回归 | `npx vitest run src/components/dialogs/__tests__ --reporter=dot` | **31/32 项通过**；唯一失败为既有 `CustomNavDialog` mock 未提供 `useNotificationsSettingsStore`，未涉及本次组件 |
| 目标文件 Lint | `npx eslint src/components/dialogs/SendBoopDialog.vue src/components/dialogs/__tests__/SendBoopDialog.test.js` | **通过** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 生产构建 | `npm run prod` | **通过：4425 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| Git 回滚点 | 本次独立提交 | 未发布、未推送 |

## 功能修正：戳一戳自定义贴纸填充选择卡片

2026-09-07，修正戳一戳弹窗中 VRC+ 自定义贴纸预览未铺满选择卡片的问题：移除卡片与预览之间的额外内边距，预览区域改为随卡片宽度自适应的正方形，并让 `Emoji` 组件填满预览区域。选中值、发送参数、徽标位置、弹窗接口和贴纸 URL 判定均未改变。

| 检查项 | 命令 | 结果 |
|---|---|---|
| 改动前组件基线 | `npx vitest run src/components/dialogs/__tests__/SendBoopDialog.test.js --reporter=dot` | **通过：1 个文件、5 项测试** |
| 填充样式断言 RED → GREEN | 同上定向命令 | **先因缺少预览填充结构得到预期失败；实现并修正 ref 测试夹具后通过：1 个文件、5 项测试** |
| Dialog 目录回归 | `npx vitest run src/components/dialogs/__tests__ --reporter=dot` | **31/32 项通过**；唯一失败为既有 `CustomNavDialog` mock 未提供 `useNotificationsSettingsStore`，未涉及本次组件 |
| 目标文件 Lint | `npx eslint src/components/dialogs/SendBoopDialog.vue src/components/dialogs/__tests__/SendBoopDialog.test.js` | **通过** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 生产构建 | `npm run prod` | **通过：4425 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| Git 回滚点 | 本次独立提交 | 未发布、未推送 |

## 功能修正：手背指针左上角范围

2026-09-09，用户补充确认问题不是原点卡在一个点，而是可活动区域被锁在共享纹理左上角的一块范围。手背 Overlay 继续使用 `1024×1536` 共享纹理和 `512×512` 手背裁剪区；CEF/Electron 现在通过同一坐标边界兼容本地像素、Overlay UV、共享纹理 UV 与共享纹理像素，并在首次左上角样本存在歧义时允许后续明确样本完成一次坐标空间恢复。该切片没有修改射线选择、点击边沿、payload 字段、更新周期、页面样式或公共接口。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 改动前 C# 基线 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore --logger "console;verbosity=minimal"` | **通过：22/22** |
| 坐标空间恢复 RED | 同上定向命令 | **预期失败：2 项**；首次左上角歧义样本无法恢复到像素/本地 UV |
| 坐标空间恢复 GREEN | 同上定向命令 | **通过：24/24**；覆盖共享纹理 UV 展开、稳定判定和两种恢复路径 |
| CEF 宿主构建 | `dotnet build Dotnet/VRCX-Cef.csproj --no-restore -c Debug -p:Platform=x64` | **通过：0 警告、0 错误** |
| Electron 宿主构建 | `dotnet build Dotnet/VRCX-Electron.csproj --no-restore -c Debug -p:Platform=x64` | **通过：0 警告、0 错误** |
| 文档/代码格式 | `git diff --check` | **通过**；仅保留既有换行转换提示 |
| 本地测试版 | 启动 `build/Cef/VRCX-Luo.exe --debug` | **已重启**；仅验证本地 CEF 启动，未发布、未推送 |

代码提交：本切片建立独立 Git 回滚点；未发布、未推送。实际头显仍需在 SteamVR/VRChat 中验证手背四角活动范围和点击位置；若硬件仍出现偏移，下一步只增加可关闭的 `vUVs` 采样诊断，不再盲改页面样式。

### 裁剪像素空间补充（2026-09-10）

针对仍然只能在左上角一块区域活动的反馈，补充覆盖“首次样本为单位范围、后续样本为裁剪像素”的恢复路径。该运行时会先按手背裁剪后的约 `256×170.67` 像素解释交点，再展开到完整 `512×512` 手背面板；本地像素流仍保持原有 `512×512` 解释。没有修改射线、点击边沿、payload、更新周期、页面样式或公共接口。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 改动前 C# 基线 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore --verbosity:minimal` | **通过：26/26** |
| 裁剪像素恢复 RED | 同上定向命令 | **预期失败：1 项**；单位范围首样本后的裁剪像素被误判为本地像素 |
| 裁剪像素恢复 GREEN | 同上定向命令 | **通过：27/27**；覆盖裁剪像素端点、切回本地像素及单位范围首样本 |
| CEF 宿主构建 | `dotnet build Dotnet/VRCX-Cef.csproj --no-restore -c Debug -p:Platform=x64 --nologo --verbosity:minimal` | **通过：0 警告、0 错误** |
| Electron 宿主构建 | `dotnet build Dotnet/VRCX-Electron.csproj --no-restore -c Debug -p:Platform=x64 --nologo --verbosity:minimal` | **通过：0 警告、0 错误** |
| 本地测试版 | 重启 `build/Cef/VRCX-Luo.exe --debug` | **已重启并确认主进程与 Overlay 子进程运行**；未发布、未推送 |

实际头显仍需在 SteamVR/VRChat 中验证手背四角和点击位置；桌面 `wrist-pointer-test=1` 不能替代硬件坐标验证。

## 功能增强：托盘悬浮通知入口与实时同步

2026-09-10，Windows CEF 托盘悬浮通知增加“通知中心”入口。点击后通过既有通知事件打开 App 内通知中心，不要求通知条目 ID；悬浮窗显示期间收到新通知、通知被处理或全部忽略时，Native CEF 预览会立即刷新或关闭，避免继续显示过期内容。原有卡片点击、邀请/好友申请操作、全部忽略和悬浮关闭时序保持不变。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 改动前定向基线 | `npx vitest run src/stores/notification/__tests__/trayNotificationBridge.test.js src/services/__tests__/trayNotificationProjection.test.js --reporter=dot`；`dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore --verbosity:minimal` | **通过：JavaScript 17 项、C# 27 项** |
| 入口行为 RED | 同上定向测试 | **预期失败：JavaScript 1 项、C# 1 项**；分别缺少 `open-center` handler 和 Native 入口按钮 |
| GREEN/回归 | 同上定向测试 | **通过：JavaScript 18 项、C# 27 项** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| CEF/Electron 宿主构建 | `dotnet build Dotnet/VRCX-Cef.csproj --no-restore -c Debug -p:Platform=x64 --nologo --verbosity:minimal`；`dotnet build Dotnet/VRCX-Electron.csproj --no-restore -c Debug -p:Platform=x64 --nologo --verbosity:minimal` | **通过：0 警告、0 错误** |
| 本地测试版 | 重启 `build/Cef/VRCX-Luo.exe --debug` | **已重启；仅本地验证，未发布、未推送** |

当前切片代码已通过测试并准备建立独立 Git 回滚点；下一切片将处理“App 通知中心/红点来源与托盘快照不一致”的类型覆盖，不与本切片混改。

## 功能修正：本地通知进入托盘未读队列

2026-09-10，修正实例关闭、群组队列就绪两类由本地事件生成的 App 通知：统一通过 `appendNotificationTableEntry()` 写入通知表，自动补齐不会与已有记录冲突的本地 ID，并加入未读队列。这样它们可以同时触发既有通知红点并进入 Windows CEF 托盘悬浮快照；已有带 ID 的 API 通知、已读通知和通知中心隐藏记录保持原语义。没有修改通知内容、数据库序列化格式、事件时序或公共页面接口。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 改动前托盘/通知基线 | `npx vitest run src/stores/notification/__tests__/trayNotificationBridge.test.js src/services/__tests__/trayNotificationProjection.test.js --reporter=dot` | **通过：2 个文件、18 项测试（含上一切片）** |
| 本地通知行为 RED → GREEN | `npx vitest run src/stores/notification/__tests__/notificationPendingEntry.test.js --reporter=dot` | **先因模块不存在得到预期 RED；实现后通过：3 项** |
| 托盘/通知定向回归 | 同上托盘/通知基线命令 + pending entry | **通过：3 个文件、21 项测试** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 格式检查 | `git diff --check` | **通过**；仅提示既有换行转换 |

本切片在提交前继续运行 CEF/Electron 构建；未发布、未推送。

## 功能增强：托盘通知类型与请求操作覆盖

2026-09-10，托盘通知快照新增统一的类型元数据（分类、类型标签、图标语义、强调色和优先级），覆盖通知中心当前支持的好友、群组、房间、状态、社交、管理及外部通知类型；未知的 `group.*`/`moderation.*` 类型也会保留可读分类，不再统一显示为无类型通知。Native CEF 根据元数据显示类型标签和颜色，Electron 托盘提示保留元数据并在文本前显示类型标签。对 `requestInvite` 增加“邀请”快捷操作，并复用现有 `acceptRequestInvite` 流程；已有服务端 response、邀请、好友申请、戳一戳操作保持兼容。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 行为 RED | `npx vitest run src/stores/notification/__tests__/trayNotificationBridge.test.js --reporter=dot` | **预期失败：15 项**；缺少类型元数据和邀请请求操作 |
| JavaScript 托盘桥接 | 同上 | **通过：1 个文件、31 项测试** |
| Electron 投影 | `npx vitest run src/services/__tests__/trayNotificationProjection.test.js --reporter=dot` | **通过：2 项**；新增字段经过归一化，动作图标保留 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| C# 托盘回归 | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore --verbosity:minimal` | **通过：27/27** |
| CEF/Electron 宿主构建 | 两个 `dotnet build ... -c Debug -p:Platform=x64 --nologo --verbosity:minimal` | **通过：0 警告、0 错误** |
| 格式检查 | `git diff --check` | **通过**；仅提示既有换行转换 |

本切片未改变通知快照已有字段的含义，仅做兼容性追加；未发布、未推送。

## UI 增强：托盘悬浮窗剩余数量提示

2026-09-10，托盘悬浮窗底部增加“还有 N 条”提示，明确前 4 条卡片之外仍有待处理通知，并保留“通知中心”和“全部忽略”两个操作。通知内容、排序、最多展示 4 条的布局上限、自动关闭时序和既有按钮位置均未改变；消息字段继续使用原有 formatter 与原始字段兜底。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| C# 行为 RED | `dotnet test Dotnet.Tests/VRCX.Cef.Tests.csproj --no-restore --verbosity:minimal` | **预期失败：1/27**；缺少剩余数量提示控件 |
| C# 行为 GREEN | 同上 | **通过：27/27** |
| JavaScript 托盘回归 | `npx vitest run src/stores/notification/__tests__/trayNotificationBridge.test.js src/services/__tests__/trayNotificationProjection.test.js --reporter=dot` | **通过：2 个文件、34 项测试** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| CEF/Electron 宿主构建 | 两个 `dotnet build ... -c Debug -p:Platform=x64 --nologo --verbosity:minimal` | **通过：0 警告、0 错误** |
| 生产构建 | `npm run prod` | **通过：4426 个模块**；保留既有 router 动态 import 与 Node deprecation 警告 |
| 格式检查 | `git diff --check` | **通过**；仅提示既有换行转换 |

本切片未发布、未推送。

## Windows CEF 任务栏图标与测试通知验证

2026-09-10，确认“图标没了”指的是主窗口在 Windows 任务栏中的图标，不是右下角系统托盘图标。CEF `MainForm` 现在在首次访问窗体句柄前加载并设置 `VRCX.ico`，再创建 `NativeWindow`；这样任务栏不会先缓存 WinForms 默认图标。系统托盘仍由同一图标字段独立管理，未改变托盘菜单、通知红点或托盘悬浮窗行为。

同日修正通知设置页的“发送测试通知”：测试事件显式走强制展示路径，不再要求当前正在运行 VRChat/SteamVR 才有反馈；仍尊重各通知渠道开关。右键菜单关闭“桌面通知”只关闭 Windows 系统桌面通知，通知中心、VR Overlay 和 XSOverlay/OVRToolkit 渠道继续按各自开关工作，这是有意保持的渠道隔离。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| CEF 任务栏图标 | 重启 `build/Cef/VRCX-Luo.exe --debug` 后读取主窗口 `WM_GETICON` | **通过**：主窗口可见且响应；大/小图标句柄均有效，图标文件存在 |
| 图标视觉探针 | 将 `WM_GETICON` 大图标转换为临时 PNG | **通过**：显示 VRCX 图标；未修改仓库文件 |
| 测试通知单元测试 | `npx vitest run src/stores/notification/__tests__/notificationPlayback.test.js src/stores/__tests__/overlayDispatch.test.js --reporter=dot` | **通过：2 个文件、23 项测试** |
| 通知/托盘定向回归 | `npx vitest run src/services/__tests__/trayContextMenu.test.js src/services/__tests__/trayIconFactory.test.js src/services/__tests__/trayLifecycle.test.js src/services/__tests__/desktopNotificationController.test.js src/stores/__tests__/overlayDispatch.test.js src/stores/notification/__tests__/trayNotificationBridge.test.js src/stores/settings/__tests__/notifications.test.js src/stores/notification/__tests__/notificationPlayback.test.js --reporter=dot` | **通过：8 个文件、71 项测试**；保留既有预期 Network 错误日志 |
| 实际本地 UI 点击 | CEF CDP 点击设置页“发送测试通知” | **通过**：触发 XSOverlay、OVRToolkit、桌面通知和 VR Overlay 调用 |
| 桌面通知开关 | 临时关闭 `VRCX_desktopNotificationsEnabled` 后再次触发测试通知，再恢复原值 | **通过**：`DesktopNotification` 不再调用；其他已启用 Overlay 渠道保持独立 |
| JavaScript 质量检查 | `npx eslint src/stores/notification/index.js src/stores/notification/notificationPlayback.js src/stores/notification/__tests__/notificationPlayback.test.js` | **通过** |
| CEF Release 构建 | `dotnet build Dotnet/VRCX-Cef.csproj -c Release --no-restore` | **通过：0 警告、0 错误** |

代码回滚点：`03be3cfc`（任务栏图标初始化）、`16c8f53b`（测试通知独立于运行模式）；均未发布、未推送。当前仍保留用户已有的 `src/services/websocket.js` 修改及 `_codex_hika_*` 临时目录。

### 右键关闭桌面通知后的状态同步修正

2026-09-10，补齐 CEF 右键菜单“关闭桌面通知”在设置 store 初始化竞态下的同步。此前设置 store 要等异步配置 `Promise.all` 完成后才注册 `vrcx-desktop-notifications-updated` 监听器，菜单事件可能被丢弃；即使事件先到，后续配置赋值也可能把状态覆盖回旧值。现在桌面通知监听器在初始化开始时注册，并保留初始化期间最后一次宿主切换，配置加载完成后优先应用该切换。菜单存储键、事件名、事件 payload 和通知渠道边界不变。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 状态竞态 RED | `npx vitest run src/stores/settings/__tests__/notifications.test.js -t "keeps a desktop notification toggle received during initialization" --reporter=dot` | **预期失败**：事件在异步配置完成前丢失/被旧值覆盖 |
| 状态竞态 GREEN | 同上 | **通过：1 项** |
| 设置/托盘/通知回归 | `npx vitest run src/services/__tests__/trayContextMenu.test.js src/stores/settings/__tests__/notifications.test.js src/stores/__tests__/overlayDispatch.test.js --reporter=dot` | **通过：3 个文件、26 项测试**；保留既有 Network 错误日志 |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| 实际本地 CEF | 重启 Debug 测试版，按同一事件顺序切换关闭并恢复 | **通过**：store、存储值分别为 `false/"false"` 与 `true/"true"` |

代码回滚点：`da997ef0`；未发布、未推送。

### 托盘桌面通知文案与设置状态一致

2026-09-10，修正托盘右键菜单桌面通知项的状态描述。此前启用时显示“关闭桌面通知”，这句话表示下一步动作，容易与 App 设置页的“已开启”状态相反。现在 Electron 与 Windows CEF 两端统一显示当前状态：启用为“桌面通知：已开启”，关闭为“桌面通知：已关闭”；复选框勾选状态、点击后的持久化、宿主事件同步和通知渠道边界均保持不变。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 托盘文案改动前基线 | `npx vitest run src/services/__tests__/trayContextMenu.test.js --reporter=dot` | **通过：3 项** |
| 状态文案回归 RED | 同上定向测试 | **预期失败：2 项**；旧实现仍返回“关闭桌面通知” |
| 状态文案回归 GREEN | 同上定向测试 | **通过：4 项**；同时覆盖启用/关闭两种状态 |
| 托盘/设置/Overlay 回归 | `npx vitest run src/services/__tests__/trayContextMenu.test.js src/stores/settings/__tests__/notifications.test.js src/stores/__tests__/overlayDispatch.test.js --reporter=dot` | **通过：3 个文件、27 项测试**；保留既有预期 Network 错误日志 |
| JavaScript 质量检查 | `npx eslint src/services/__tests__/trayContextMenu.test.js`；`npm run typecheck:js`；`node --check src-electron/trayContextMenu.cjs` | **通过** |
| CEF Release 构建 | `dotnet build Dotnet/VRCX-Cef.csproj -c Release --no-restore --self-contained --nologo --verbosity:minimal` | **通过：0 警告、0 错误** |
| 本地测试版 | 重启 `build/Cef/VRCX-Luo.exe --debug`，检查 CDP 页面可访问 | **通过：本地测试版已启动；未发布、未推送** |

代码回滚点：`e0de7f9b`；未发布、未推送。

## 功能增强：好友日志红点进入托盘

2026-09-10，补齐好友日志对托盘悬浮通知的投影。好友建立、昵称变化、信任等级变化和未被“隐藏解除好友”设置过滤的解除好友事件继续写入好友日志数据库并触发 App 内 `friend-log` 红点，同时额外进入仅供托盘使用的临时未读队列；不会重复写入通知中心，也不会改变好友日志表结构。点击托盘条目进入好友日志页并清理临时队列，忽略单条或全部时同步移除 `friend-log` 红点；切换账户或进入好友日志页也会清理临时条目，避免跨账户或已查看后残留。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 托盘桥接行为 RED → GREEN | `npx vitest run src/stores/notification/__tests__/trayNotificationBridge.test.js --reporter=dot` | **先因未合并额外来源得到预期 RED；实现后通过：1 个文件、33 项测试** |
| 通知目录回归 | `npx vitest run src/stores/notification/__tests__ --reporter=dot` | **通过：6 个文件、51 项测试** |
| 重构回归集 | `npm run test:refactor` | **通过：75 个文件、371 项测试**；保留既有预期错误日志 |
| 目标文件 Lint | `npx eslint src/stores/notification/index.js src/stores/notification/trayNotificationBridge.js src/coordinators/friendRelationshipCoordinator.js src/stores/notification/__tests__/trayNotificationBridge.test.js` | **通过** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |
| CEF/Electron 宿主构建 | 两个 `dotnet build ... -c Debug -p:Platform=x64 --nologo --verbosity:minimal` | **通过：0 警告、0 错误** |
| 格式检查 | `git diff --check` | **通过**；仅提示既有换行转换 |

代码提交：`dd55f4dd`（好友日志托盘投影）、`30d49ad6`（遵守隐藏解除好友设置）、`4d5eb7db` 与 `4ecaa341`（文档修正）。以上提交均未发布、未推送。

## 功能增强：左上角 Quick Search 模糊与拼音搜索

2026-09-10，左上角侧栏 Quick Search 增加非连续模糊匹配和中文拼音匹配。输入字符按顺序即可命中，中间允许跳过字符（例如 `smr` 可命中 `Summer World`）；中文名称支持拼音首字母及全拼（例如 `xcs` 可命中 `曦晨六时`）。原有连续子串、大小写不敏感、特殊字符归一化、搜索分类、结果上限和 Worker 异步协议保持不变。匹配在 Web Worker 内执行，避免阻塞主界面；新增 `pinyin-pro` 依赖用于拼音字典与匹配。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| Quick Search 相关基线 | `npx vitest run src/stores/__tests__/quickSearchWorker.test.js src/shared/utils/__tests__/quickSearchUtils.test.js --reporter=dot` | **通过：2 个文件、32 项既有测试** |
| 模糊/拼音行为 RED | `npx vitest run src/stores/__tests__/quickSearchWorker.test.js --reporter=dot` | **预期失败：1 项**；旧实现只支持连续子串 |
| 模糊/拼音行为 GREEN | 同上定向测试 | **通过：3 项**；覆盖非连续英文名与中文拼音首字母 |
| Quick Search 回归 | 同上基线命令 | **通过：2 个文件、33 项测试** |
| JavaScript 质量检查 | `npx eslint src/stores/quickSearchWorker.js src/stores/__tests__/quickSearchWorker.test.js`；`npm run typecheck:js` | **通过** |
| 生产构建 | `npm run prod` | **通过：4427 个模块**；保留既有 Vite 动态导入提示与 Node deprecation 提示 |
| 本地测试版 | 重启 `build/Cef/VRCX-Luo.exe --debug`，确认 CEF/CDP 页面可访问 | **已启动本地测试版；未发布、未推送** |

代码回滚点：`b65ef849`；未发布、未推送。

## 性能修正：房间进出记录大数量筛选卡顿

2026-09-10，修正房间进出悬浮窗在记录数量较大时切换筛选会短暂卡顿的问题。旧实现会把全部记录（截图场景约 3093 条）及每行的用户身份组件一次性挂载；现在列表改用项目已有的 `@tanstack/vue-virtual` 虚拟列表，只渲染可视区域及少量 overscan 行，筛选结果、计数、排序、点击查询、数据库参数和筛选记忆均保持不变。虚拟容器保留原滚动区域，筛选变化后仅重新测量，不改变查询并发语义。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 房间进出组件基线 | `npx vitest run src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js src/views/PlayerList/components/__tests__/InstancePlayerEventsPopover.test.js --reporter=dot` | **通过：2 个文件、5 项既有测试** |
| 大数据量卡顿回归 RED | 同上定向组件测试（新增 3093 条记录场景） | **预期失败**：旧实现挂载 3093 行，无法满足可视行上限 |
| 虚拟列表回归 GREEN | 同上定向组件测试 | **通过：2 个文件、6 项测试**；大数据量初始与筛选切换均限制为 40 个测试可视行 |
| PlayerList 回归 | `npx vitest run src/views/PlayerList --reporter=dot` | **通过：5 个文件、26 项测试**；保留既有组件解析警告 |
| JavaScript 质量检查 | `npx eslint src/views/PlayerList/components/InstancePlayerEvents.vue src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js`；`npm run typecheck:js` | **通过：0 diagnostics** |
| 生产构建 | `npm run prod` | **通过：4427 个模块**；保留既有 Vite 动态导入提示与 Node deprecation 提示 |
| 本地测试版 | 重启 `build/Cef/VRCX-Luo.exe --debug`，检查 CEF/CDP 页面可访问 | **通过：本地测试版已重启；未发布、未推送** |

代码回滚点：`2bcf5699`；未发布、未推送。

## 启动优化：好友栏先恢复本地缓存

2026-09-11，修正首次打开时右侧好友栏必须等完整同步结束才显示的问题。`getFriendLog` 现在先从 SQLite 读取已持久化的好友快照并投影到侧栏，随后继续原有计数读取和 API 全量刷新；刷新期间 `FriendItem` 显示缓存的昵称/ID，但暂时隐藏删除操作。最终好友数据、`isFriendsLoaded` 门控、WebSocket 启动时序、接口和序列化格式均保持不变。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 修改前基线 | `npm test -- src/views/Sidebar/components/__tests__/FriendsSidebar.test.js src/views/Sidebar/components/__tests__/FriendItem.test.js src/stores/updateLoopTasks/__tests__/friendSyncTask.test.js --maxWorkers=2` | **通过：3 个文件、13 项测试** |
| 缓存优先回归 | 同上定向命令 | **通过：3 个文件、14 项测试**；新增缓存好友加载态覆盖 |
| JavaScript 质量检查 | `npm exec --yes eslint -- src/stores/friend.js src/views/Sidebar/components/FriendItem.vue src/views/Sidebar/components/__tests__/FriendItem.test.js`；`git diff --check` | **通过**；仅保留既有换行转换提示 |
| 生产构建 | `npm run prod` | **通过：4430 个模块**；保留既有 Vite 动态导入和 Node deprecation 提示 |
| 全量测试 | `npm test -- --maxWorkers=2` | **报告项**：复现既有组件 mock/i18n/canvas 环境失败并在长时间无收尾后停止，未见与本切片相关的新失败 |
| 本地测试版 | 重启 `build/Cef/VRCX-Luo.exe`，检查窗口响应 | **通过：PID 58976，窗口标题 `VRCX-Luo 2026.08.23`，Responding=True** |

代码回滚点：`7bdb9131`；文档随后单独提交，均未发布、未推送。

## 功能修正：房间进出只显示当前实例会话

2026-09-13，修正房间进出悬浮窗把同一实例 ID 的历史会话全部混在一起的问题。房间页现在将当前用户本次进入实例的时间传入悬浮窗；事件显示层只保留 `created_at` 不早于该时间的进入/离开记录，因此重新进入同一实例时不会再显示上一次会话。时间优先取实时位置会话时间，旅行中取目的地时间，必要时回退到当前用户位置时间和实例加入历史缓存。数据库查询接口、好友/陌生人筛选、进入/离开筛选、排序、虚拟列表和筛选记忆均未改变。

| 检查项 | 命令/方式 | 结果 |
|---|---|---|
| 当前会话边界回归 RED | `npx vitest run src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js --reporter=dot` | **预期失败**：旧实现仍渲染会话开始前的记录（3 条而非 2 条） |
| 房间进出组件 GREEN | `npx vitest run src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js src/views/PlayerList/components/__tests__/InstancePlayerEventsPopover.test.js --reporter=dot --maxWorkers=2` | **通过：2 个文件、7 项测试** |
| PlayerList 传参回归 | `npx vitest run src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js src/views/PlayerList/components/__tests__/InstancePlayerEventsPopover.test.js src/views/PlayerList/__tests__/PlayerList.test.js --reporter=dot --maxWorkers=2` | **通过：3 个文件、20 项测试**；保留既有组件解析和 mock 警告 |
| 目标文件 Lint | `npx eslint src/views/PlayerList/PlayerList.vue src/views/PlayerList/components/InstancePlayerEvents.vue src/views/PlayerList/components/InstancePlayerEventsPopover.vue src/views/PlayerList/__tests__/PlayerList.test.js src/views/PlayerList/components/__tests__/InstancePlayerEvents.test.js src/views/PlayerList/components/__tests__/InstancePlayerEventsPopover.test.js` | **通过** |
| JavaScript 类型检查 | `npm run typecheck:js` | **通过：0 diagnostics** |

代码提交：`34fd5fe2`；未发布、未推送。

## 后续门禁规则

每个重构切片必须满足：

1. 修改前运行受影响模块测试，并记录失败数量和错误分类。
2. 只做一个逻辑变更，保持公共 interface、序列化格式和并发语义不变。
3. 修改后重复同一组测试；既有失败不得增加，新增失败必须归因并修复。
4. 通过后创建一个独立 Git commit；失败时只回滚当前切片。
5. 只有当完整测试和对应质量检查均有可解释结果，才进入下一个 seam；report-only 检查必须保留在 CI 结果中，不能隐藏既有失败。
