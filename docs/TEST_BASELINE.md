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

共享好友排序旧测试的既有基线仍有 3 项失败（时间实例、None、空排序数组），本次没有修改该模块，也未增加失败。代码提交：`ba12266d`。未发布、未推送。

## 后续门禁规则

每个重构切片必须满足：

1. 修改前运行受影响模块测试，并记录失败数量和错误分类。
2. 只做一个逻辑变更，保持公共 interface、序列化格式和并发语义不变。
3. 修改后重复同一组测试；既有失败不得增加，新增失败必须归因并修复。
4. 通过后创建一个独立 Git commit；失败时只回滚当前切片。
5. 只有当完整测试和对应质量检查均有可解释结果，才进入下一个 seam；report-only 检查必须保留在 CI 结果中，不能隐藏既有失败。
