# VRCX-Luo 重构执行计划

> 状态：执行中
>
> 更新时间：2026-09-05
>
> 本计划按 Blocker / Major / Minor 排序；每个切片保持公共 interface、序列化格式和并发语义不变，并单独提交到本地 Git。不会在本计划范围内发布或推送。

## 当前策略

多账户相关工作（B-02、M-05）按用户要求暂缓，不再扩大其实现范围。当前优先处理单账户宿主 capability、数据刷新和测试门禁，避免继续触碰 `dbVars` 热切换、账号 Store 替换和跨账号聚合。

架构目标是把浅（shallow）的编排模块逐步深化（deepening）：在稳定的 interface 上建立 seam，用 adapter 隔离实现，让每次改动保持 locality，并获得可验证的 leverage。

## 任务总览

| 优先级 | 任务 | 当前状态 | 下一步 |
|---|---|---|---|
| Blocker 条件项 | B-01 宿主桥安全封口 | **已完成：B-01.1～B-01.3** | 转入 N-02；保持可信来源与参数 schema 门禁，多账户 B-02/M-05 继续暂缓 |
| Blocker 条件项 | B-02 多账户数据隔离 | **按要求暂缓** | 不改 `dbVars`、`accountHub` 和次号生命周期 |
| Major | M-00 测试与 CI 门禁 | **已完成：M-00.1～M-00.3（分阶段门禁）** | 转入 N-02；全仓 lint/format/完整测试债务继续报告化收敛，多账户功能仍暂停 |
| Major | M-01 宿主 capability adapter | **已完成：M-01.1～M-01.3** | 保持 B-01 来源与参数门禁；进入 N-02 |
| Major | M-02 数据刷新链路契约化 | **已完成：M-02.5** | 进入 M-03 编排层纯化 |
| Major | M-03 编排层纯化 | **已完成：M-03.6** | M-00/B-01 已完成；继续按总览推进 N-02 |
| Major | M-04 数据库 facade 深化 | 暂缓 | 等多账户方案恢复后再引入 `DbContext` |
| Major | M-05 账号会话与聚合视图 | **按要求暂缓** | 依赖 B-02，不进入当前迭代 |
| Major | M-06 Notification Store 拆分 | **已完成：M-06.4（低风险 seam）** | M-00/B-01 已完成；M-01/M-04 解锁后再收窄宿主/数据库 capability |
| Major | M-07 Electron composition root / 双宿主契约 | **已完成：M-07.1～M-07.12** | .NET bootstrap、IPC 注册、双宿主 contract、窗口状态、窗口事件、关闭守卫、托盘菜单、图标工厂、通知 projection、桌面通知 controller、托盘生命周期和点击 Bridge seam 已完成；通知 action IPC 仍可另行细分 |
| Major | M-08 API/Query 缓存所有权 | **已完成：M-08.3** | M-00/B-01 已完成；多账户 B-02/M-05 继续暂缓 |
| Major | M-09 其余上帝模块 | **已完成：M-09.8** | M-00/B-01 已完成；多账户 B-02/M-05 继续暂缓 |
| Major | M-10 GameLog 深化 | **已完成：M-10.1～M-10.4** | M-10 已闭环；后续如需继续深化，另开 database 写入/事务或其它 Major seam；保持 `database` facade、日志 tuple 和 Store 兼容入口 |
| Major | M-11 前端 UI 状态与 DOM seam | **进行中：M-11.4 计划中** | 先提取 UI Store 的托盘通知宿主 Adapter；保持状态计算、force 更新和双宿主调用，再评估是否停止本轮前端重构 |
| Minor | N-01 文档与 ADR | **已完成：N-01.1～N-01.2** | 维护领域上下文与 ADR；新增决策必须先更新文档再改代码 |
| Minor | N-02 版本与构建来源 | **已完成：N-02.1～N-02.3** | 保持版本一致性门禁；N-03/N-04 已完成，多账户 B-02/M-05 继续暂缓 |
| Minor | N-03 Shared/Localization 边界 | **已完成：N-03.1～N-03.3** | 保持依赖方向与语言包契约门禁；N-04 已完成，多账户 B-02/M-05 继续暂缓 |
| Minor | N-04 第三方/生成文件治理 | **已完成：N-04.1～N-04.3** | 保持版本矩阵阻断结构性错误、报告跨宿主漂移；生成代码与构建注入文件继续按治理规则维护 |

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
| `6c7022a6` | M-00.2：为 accountHub 主账号兼容 stub 与二级会话注册表补齐静态契约；不改变多账户运行时行为 |
| `52657880` | M-00.2：为二级账号 request/friend cache 补齐静态契约；不改变多账户运行时行为 |
| `3e6945a6` | M-00.2：为 aggregatedView 合并输入与 prefix 查找补齐局部静态契约；不改变聚合运行时行为 |
| `dc732cc9` | M-00.2：隐藏 Sentry 第三方私有 option 类型，完成 JavaScript 类型检查 |
| M-00.3 CI/docs 提交 | M-00.3：建立 PR/手动触发的分阶段 CI 门禁，加入 `test:refactor` smoke 命令并同步测试基线文档 |
| `feb584b9` | M-01.1：提取 CEF/Electron 剪贴板 capability adapter，保留 `directAccessPaste()` 兼容入口和 CEF 失败回退 |
| `f4050150` | M-01.2a：提取 CEF/Electron 文件选择 capability，保留自定义通知音频的取消值和持久化行为 |
| `62c29b7c` | M-01.2b：提取 CEF/Electron 目录选择 capability，保留旧路径提示、取消值和并发守卫 |
| `55177762` | M-01.3：为 Electron Dotnet bridge 建立共享 class/method allowlist 和 args envelope 校验，保留现有 renderer facade |
| `2e9ae9df` | M-07.1：提取 Electron .NET 宿主同步初始化 module，保留原调用顺序、参数、同步性和异常传播 |
| `a0f13775` | M-07.2：提取 Electron IPC handler 注册 module，保留 15 个 channel、注册顺序和 handler 引用 |
| `ed1b36ec` | M-07.3：建立 CEF/Electron capability method、参数、IPC channel 与取消/错误语义契约测试 |
| `0c74ce3f` | M-07.4：提取 Electron 窗口状态读取/动作 Adapter，保留旧状态解析和启动最小化行为 |
| `99d3070f` | M-07.5：提取 Electron 窗口事件 Bridge，保留缩放、几何、状态和焦点通知行为 |
| `09b7b908` | M-07.6：提取 Electron 窗口关闭守卫 Adapter，保留托盘、提示、偏好持久化和退出语义 |
| `b965804f` | M-07.7：提取 Electron 托盘上下文菜单 Adapter，保留开关、持久化、通知和退出动作 |
| `73b6811e` | M-07.8：提取 Electron 托盘图标工厂，保留平台路径、尺寸和 Tray 实例创建语义 |
| `b678aa49` | M-07.9：提取托盘通知 snapshot 规范化与 tooltip projection，保留限制、文案和 fallback 语义 |
| `02321a27` | M-07.10：提取桌面通知 controller，保留启用判断、替换、关闭清理和显示语义 |
| `99bfd8d3` | M-07.11：提取托盘销毁与通知图标切换生命周期动作，保留重启/退出调用顺序 |
| `267b95aa` | M-07.12：提取托盘点击打开主窗口 Bridge，保留 click listener 和 show 行为 |
| `296aa38a` | M-10.1：提取纯 `parseRawGameLog` Parser module；保留 `LogWatcherService.parseRawGameLog()` 兼容委托、未知类型和原始字段映射 |
| `aff0098b` | M-10.2a：提取 GameLog 数据库 row projection；保留 Location/lookup/search 的返回字段、顺序和 null 行为 |
| `ac89133f` | M-10.2b：新增 GameLog 查询参数/过滤 flag 纯 module；覆盖参数顺序、VIP 转义和空过滤行为 |
| `6fc90bec` | M-10.2b：将查询参数 module 接入 database facade；保留 SQL、`dbVars.userId`、参数顺序和旧查询入口 |
| `157331da` | M-10.3：提取 GameLog sessions 日期、搜索、分组过滤与 projection module；保留分页和 `searchLimit` 行为 |
| `23981f39` | M-10.4：提取 now-playing worker ticker；保留媒体解析、1000ms 调度、完成清理和 Store 兼容入口 |
| `b00564e2` | M-11.1：提取 Appearance DOM class adapter；保留无障碍、官方状态颜色、表格密度 class 契约和 Store 兼容入口 |
| `9844d194` | M-11.2：提取 UI Store body drop guard adapter；保留注册时机、`drop` 事件和 `preventDefault()` 行为 |
| `8556c0ef` | M-11.3：提取 UI Store 对话框面包屑状态 Module；保留重复项截断、label 更新、索引边界和 Store 兼容入口 |
| `df65d955` | B-01.1：新增可信渲染来源策略；Electron 15 个 IPC handler 统一拒绝非 packaged renderer 与未启用的开发服务器来源 |
| `5e84ad42` | B-01.2：为 174 个 .NET allowlist 方法补齐参数数量/基础类型 schema，并在 preload/main/Interop 边界复用校验 |
| `82ff3fe8` | N-02.1：建立可注入的版本元数据解析、UTC 回退和文件读取契约 |
| `5f42e3b6` / `83883a59` | N-02.2：集中版本文件读取并同步 package.json/package-lock.json 版本 |
| `ffcc32a6` / `271dfdca` | N-02.2：按回滚协议撤回跨 tsconfig 的 Vite 接入，并建立安全的类型检查边界 |
| `25d0e823` / `c59a2be3` | N-02.2：让 Electron 版本显示和构建产物命名消费共享版本元数据 |
| `664abe3b` | N-02.3：加入 `check:version` 一致性门禁并接入 Electron 构建前流程 |
| `0623d802` | N-03.1：建立 Shared/Localization 依赖方向检查，登记 14 条既有遗留边并阻断新增反向依赖 |
| `81d1bada` | N-03.2：建立英文基准语言包契约检查，报告 fallback 缺失/额外 key 并阻断结构错误 |
| `6f86f976` | N-03.3：聚合架构检查入口并接入 CI JavaScript 质量门禁 |

## 当前 M-01 细分任务

1. **M-01.1 剪贴板 capability adapter（已完成）**：新增 `src/services/clipboardAdapter.js`，以依赖注入统一 Electron `getClipboardText` 与 CEF `AppApi.GetClipboard`；保留 Electron 异常传播和 CEF 异常记录后返回空字符串的既有行为。`src/stores/search.js` 的 `directAccessPaste()` 公共入口和解析/提示流程不变；新增 CEF/Electron 路由、CEF 失败回退及搜索调用回归测试。提交：`feb584b9`。
2. **M-01.2a 文件选择 capability（已完成）**：新增 `src/services/fileDialogAdapter.js`，以显式 options 封装 CEF `OpenFileSelectorDialog` 与 Electron `openFileDialog`；仅迁移 `useNotificationsSettingsStore.selectCustomNotificationSound()`，保留 CEF 取消 `''`、Electron 取消 `null/undefined` 的原始返回值和既有 `if (!filePath)` 语义。adapter 与通知 Store 回归测试共 2 个文件、6 个用例通过；提交：`f4050150`。
3. **M-01.2b 目录选择 capability（已完成）**：`src/services/fileDialogAdapter.js` 新增目录选择 implementation；Windows CEF 继续接收 `oldPath`，Electron 继续无参打开目录选择器；`folderSelectorDialog()` 的可见状态守卫、返回值和异常传播保持不变。adapter 与设置对话框回归共 2 个文件、24 个用例通过；提交：`62c29b7c`。
4. **M-01.3 动态 bridge allowlist（已完成）**：新增 `src-electron/dotnetCapabilityManifest.cjs`，覆盖 renderer 实际使用的 8 类宿主对象（`AppApiVr` 在 Electron 中映射为 `AppApiVrElectron`）、主进程启动对象及其现有公开方法；`preload`、主进程 IPC handler 和 `InteropApi` 均拒绝未知 class/method，IPC 参数 envelope 必须是数组，renderer Proxy 保留原动态 facade 以避免跨 tsconfig/宿主边界依赖。119 个静态 renderer 调用已与 manifest 审计匹配，正常公开 facade 和 CEF 路径未改动；细粒度参数类型与可信渲染来源由 B-01 完成。主实现提交：`55177762`；边界修正提交：`41ddac90`。

### 当前 B-01 细分任务

1. **B-01.1 可信渲染来源判定（已完成）**：新增 `src-electron/rendererSourcePolicy.cjs`，只信任 `build/html/index.html`、`build/html/vr.html` 两个 packaged document；开发模式仅额外信任 `http://localhost:9000/index.html` 与 `/vr.html`。`ipcHandlers.cjs` 提供可选 guard，`main.js` 为全部 15 个 IPC channel 统一注入 guard；优先读取 `event.senderFrame.url`，旧 Electron 才回退到 `sender.getURL()`。非信任来源在进入 handler 前抛错，CEF 绑定与合法 Electron 调用不变。提交：`df65d955`。
2. **B-01.2 按方法参数 schema（已完成）**：`dotnetCapabilityManifest.cjs` 为 11 个宿主 class、174 个 allowlist method 建立显式 schema，校验参数数量及 string/boolean/number/integer/array/object/bytes 基础类型，保留可选值、Map/dictionary、注册表和 Discord 空字符串等既有合法输入。preload、main handler、`src-electron/InteropApi.js` 继续复用 `assertAllowedDotNetCall()`；未知 class/method 与非法参数均在宿主调用前拒绝。提交：`5e84ad42`。
3. **B-01.3 安全回归与门禁（已完成）**：新增可信来源策略、IPC guard、schema 覆盖与非法参数回归测试；`test:refactor` 通过 56 个文件/293 项测试，`typecheck:js`、`check:schema`、生产构建和 C# 3/3 测试均通过。未修改 renderer facade、公共 API 签名、序列化格式、任务周期或并发逻辑。

M-01 已完成三个低风险宿主 seam；B-01 现已完成动态 bridge 的来源与参数安全封口；M-07 composition root 的首批 seam 也已完成。多账户 B-02/M-05 继续按要求暂缓。

## 当前 N-02 细分任务

1. **N-02.1 版本元数据纯契约（已完成）**：新增 `src-electron/versionMetadata.cjs`，集中描述 `Version` 文本清理、时间戳到 package 版本的转换、七字符 nightly 后缀识别、UTC 日期回退和注入式文件读取；新增 `src/services/__tests__/versionMetadata.test.js` 覆盖稳定版、时间戳版、nightly、空值回退和文件读取。此切片先建立可测试 seam，不改变现有运行时行为。主提交：`82ff3fe8`；计划记录提交：`7d391b05`。
2. **N-02.2 构建与宿主接入（已完成）**：`src-electron/patch-package-version.js` 通过共享 reader 将根 `Version` 转换并同步写入 `package.json`、`package-lock.json` 及其根 package entry；`src/vite.config.js`、`src-electron/main.js` 和 `src-electron/rename-builds.js` 均消费同一 `versionMetadata.cjs`，保留既有 Electron 显示字符串、nightly 判定、序列化字段和产物命名语义。相关提交：`5f42e3b6`、`83883a59`、`271dfdca`、`25d0e823`、`c59a2be3`。
3. **N-02.3 来源一致性门禁（已完成）**：新增 `src-electron/versionConsistency.cjs` 与 `build-scripts/check-version-consistency.js`，以 `Version` 推导的 package 版本检查 `package.json`、`package-lock.json` 和 lockfile 根 package entry；`npm run check:version` 可单独执行，并已接入 `build-electron`/`build-electron-arm64` 的构建前流程。相关提交：`664abe3b`。

N-02 已完成。根 `Version` 是唯一人工维护的版本来源，package/lock 是构建同步产物，Electron/Vite/产物命名脚本共用同一解析契约；当前仓库实际版本为 `2026.08.23`。N-02 范围不扩展到 CI 中按构建环境生成的 `Installer/version_define.nsh`，避免改变 CEF 构建注入流程；该文件仍由现有 Windows CEF job 在构建时写入。初次直接让 Vite 跨 tsconfig 引用 CJS 导致 `typecheck:js` 失败，已按回滚协议由 `ffcc32a6` 立即回滚，并以 `271dfdca` 采用显式类型检查边界后通过验证。

## 当前 N-03 细分任务

1. **N-03.1 Shared/Localization 依赖方向（已完成）**：新增 `build-scripts/dependencyDirection.cjs` 与 `check-dependency-direction.js`，扫描 `src/shared`、`src/localization` 的静态/动态项目内依赖；禁止新增指向 stores、coordinators、api、queries、services、plugins、views、components、Electron 或反向 localization/shared 的边，当前 14 条历史边以显式 allowlist 保留并在命令输出中可见。新增测试覆盖相对路径、`@/` 别名、多行 import、动态 import、遗留例外和测试目录排除。提交：`0623d802`。
2. **N-03.2 翻译 key 契约（已完成）**：新增 `build-scripts/localizationContract.cjs` 与 `check-localization.js`，以 `en.json` 的 2699 个字符串叶节点作为 canonical key set，校验 14 个语言包 JSON、`language`/`translator` 元数据及字符串叶节点；非英文缺失 key 按既有 fallback 语义统计，额外 key 统计为漂移，不自动重写语言包；`--strict` 选项为未来全量 parity 迁移保留入口。新增 3 项契约测试。提交：`81d1bada`。
3. **N-03.3 聚合门禁与 CI 接入（已完成）**：新增 `check-architecture.js` 与 `npm run check:architecture`，统一执行依赖方向和语言包契约检查；接入 `.github/workflows/ci.yaml` 的 `quality_js` 阻断 job，本地与 CI 使用同一入口。提交：`6f86f976`。

N-03 已完成。最终检查扫描 74 个 Shared/Localization 源文件、14 个受限边（均为已登记历史例外），验证 14 个语言包和 2699 个英文 canonical key；当前 fallback 缺失 13285 项、额外 key 200 项均为可见报告，不改变现有 fallback 运行时行为。N-03 只增加静态门禁和测试，没有改变公共 interface、序列化格式、任务周期或并发语义；N-04 随后已完成。

多账户 B-02/M-05 仍按要求暂缓；后续只在明确授权后处理第三方升级或生成文件来源变更。

## 当前 N-04 细分任务

1. **N-04.1 依赖版本矩阵（已完成）**：新增 `build-scripts/dependencyVersionMatrix.cjs` 与 `check-dependency-version-matrix.js`，读取 npm manifest/lockfile 和三个 .NET 宿主项目；阻断根版本漂移、关键包缺失、重复引用及同项目耦合包不一致，跨宿主漂移只报告不自动修改。纳入 NodeApi/Generator 的 x64/arm64 漂移观测；新增 `src/services/__tests__/dependencyVersionMatrix.test.js`，提交：`5401a792`、`9b36ab80`。
2. **N-04.2 生成文件治理文档（已完成）**：新增 [`DEPENDENCY_VERSION_MATRIX.md`](./DEPENDENCY_VERSION_MATRIX.md) 与 [`GENERATED_FILE_POLICY.md`](./GENERATED_FILE_POLICY.md)，统一记录版本检查入口、当前漂移、生成代码/原生二进制/构建产物来源及修改边界；不修改任何生成结果。提交：`34766470`。
3. **N-04.3 CI 门禁（已完成）**：在 JavaScript 质量 job 复用 `npm run check:dependency-matrix`，只阻断结构性错误并保留跨宿主漂移可见；提交：`0b1fc204`。

N-04 已完成：版本矩阵、生成文件规则和 PR 质量门禁均已建立。当前已知跨宿主漂移（NLog、System.Data.SQLite、System.Management、NodeApi/Generator）只做可见报告，不做无验证升级；OpenVR 生成绑定、WinForms Designer 和构建时注入的 Installer 文件均未修改。后续若要升级第三方依赖，必须按本矩阵单依赖、单宿主切片执行并保留完整 Git 回滚点。

## 当前 N-01 细分任务

1. **N-01.1 领域上下文（已完成）**：新增根目录 `CONTEXT.md`，统一 Renderer、CEF host、Electron host、Capability、Friend presence、Group instance、Update loop、VR overlay/HUD 等领域词汇，并记录公共 Interface、周期、来源安全和多账户暂缓不变量。
2. **N-01.2 ADR 索引与决策（已完成）**：新增 `docs/adr/README.md` 及 ADR-0001～0004，记录兼容入口/Adapter 渐进式重构、双宿主 capability 契约、版本/生成文件治理和多账户暂缓；本切片只改文档并单独提交：`745a230a`。

N-01 已完成。后续架构建议必须使用 `Module / Interface / Seam / Adapter / Depth / Leverage / Locality` 词汇，并先检查 ADR 是否已有约束；多账户恢复需要显式重新评估，不从其他任务间接带入。

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

M-02、M-03 编排层纯化、M-06 Notification Store 低风险 seam、M-08 API/Query 缓存所有权、M-00 测试与 CI 门禁和 B-01 宿主桥安全封口已完成；N-02、N-03、N-04 随后完成。多账户 B-02/M-05 继续按要求暂缓。

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

## 当前 M-07 细分任务

1. **M-07.1 Dotnet bootstrap seam（已完成）**：新增 `src-electron/dotnetBootstrap.cjs`，由 `initializeDotnet({ interopApi, version, args })` 集中 Electron 启动阶段的 10 个同步 .NET 调用；`main.js` 仅组装依赖并调用该 module。保留调用次数、顺序、参数、同步性质和异常传播；不改窗口、托盘、IPC、VR overlay 或 renderer interface。fake interop 顺序测试 1/1 通过。提交：`2e9ae9df`。
2. **M-07.2 IPC handler module（已完成）**：新增 `src-electron/ipcHandlers.cjs`，集中 15 个 `ipcMain.handle` channel 的注册；`main.js` 继续组装原有 handler 实现，channel、注册顺序、参数 envelope、返回/异常语义保持不变。注册契约测试 1/1 通过。提交：`a0f13775`。
3. **M-07.3 双宿主 contract test（已完成）**：新增 `src/services/hostCapabilityContract.js` 与测试，固化 clipboard、file/directory dialog、desktop notification、tray notification、VR state 七类 CEF/Electron method name、参数形状、Electron IPC channel 及取消/错误语义；双宿主契约测试 2/2 通过。提交：`ed1b36ec`。
4. **M-07.4 窗口状态 Adapter（已完成）**：新增 `src-electron/windowState.cjs`，通过 `readWindowConfig()` 和 `applyStoredWindowState()` 接收存储/窗口依赖；`main.js` 继续保留 `createWindow()`、`applyWindowState()` 兼容入口，尺寸、缩放、启动最小化、托盘隐藏和持久化状态动作保持不变。新增 4 项回归测试，并明确保留旧代码对 `VRCX_WindowState=0` 的 `parseInt(...) || -1` 兼容结果。提交：`0c74ce3f`。
5. **M-07.5 窗口事件 Bridge（已完成）**：新增 `src-electron/windowEventBridge.cjs`，接收窗口、`webContents`、初始缩放值和存储写入依赖，集中绑定加载后缩放、快捷键/缩放变更、几何变化、窗口状态和焦点事件。保留原有 channel 名称、payload 类型、事件注册顺序、缩放持久化键及 `setVisualZoomLevelLimits(1, 5)` 行为；`main.js` 仅组装依赖并调用 Bridge。新增 3 项回归测试。提交：`99d3070f`。
6. **M-07.6 窗口关闭守卫 Adapter（已完成）**：新增 `src-electron/windowCloseHandler.cjs`，通过显式依赖承接 `close` 事件中的退出状态、关闭到托盘、提示框、偏好持久化、最小化/退出动作和并发提示守卫；`main.js` 继续提供状态 getter/setter 与宿主实现，保留原有 dialog options、存储键、动作顺序、`app.quit()` 和 finally 清理语义。新增 3 项回归测试。提交：`09b7b908`。
7. **M-07.7 托盘上下文菜单 Adapter（已完成）**：新增 `src-electron/trayContextMenu.cjs`，通过显式依赖承接打开窗口、桌面通知/静音/V 睡开关、开发者工具和退出动作；保留菜单顺序、中文文案、checkbox 状态、存储键/字符串值、通知回调、菜单重建和 `app.quit()` 语义。新增 3 项回归测试。提交：`b965804f`。
8. **M-07.8 托盘图标工厂（已完成）**：新增 `src-electron/trayIconFactory.cjs`，通过显式 platform/nativeImage/Tray/path 依赖承接 macOS 16px、Linux 64px 图标缩放及 Windows `.ico` 路径选择，并返回原有 Tray 实例及通知图标引用；`main.js` 继续负责 tooltip、context menu 和 click listener。新增 2 组回归测试。提交：`73b6811e`。
9. **M-07.9 托盘通知 projection（已完成）**：新增 `src-electron/trayNotificationProjection.cjs`，承接 snapshot 的对象/数组校验、数量和 action 限制、字符串化及 tooltip 文本生成；`main.js` 继续负责 snapshot 生命周期、托盘 tooltip 更新和通知 action IPC。保留默认文案、最多 4 条快照/3 条 tooltip、截断长度和空列表 fallback。新增 2 项回归测试。提交：`b678aa49`。
10. **M-07.10 桌面通知 controller（已完成）**：新增 `src-electron/desktopNotificationController.cjs`，通过显式 Notification、启用判断和 active notification getter/setter 承接桌面通知创建、旧通知替换、关闭清理和显示；`main.js` 保留 IPC handler interface、参数顺序和宿主依赖组装。第一次测试替身错误地同步触发 close 事件，按回滚协议撤销后改用异步 close 语义重新验证；最终提交：`02321a27`。
11. **M-07.11 托盘生命周期动作（已完成）**：新增 `src-electron/trayLifecycle.cjs`，通过显式 tray getter/setter 和图标引用承接销毁清理与普通/通知图标切换；`main.js` 保留重启、before-quit、通知 IPC 的调用位置和状态变量。新增 3 项回归测试。提交：`99bfd8d3`。
12. **M-07.12 托盘点击 Bridge（已完成）**：在 `src-electron/trayLifecycle.cjs` 增加 `bindTrayClick()`，承接 `click → mainWindow.show()` listener；`main.js` 保留 Tray 创建顺序和窗口依赖组装。新增 1 项回归测试。提交：`267b95aa`。

M-07 已完成本计划定义的十二项首批 seam：.NET bootstrap、IPC handler 注册、双宿主 capability contract、窗口状态 Adapter、窗口事件 Bridge、窗口关闭守卫 Adapter、托盘上下文菜单 Adapter、托盘图标工厂、托盘通知 projection、桌面通知 controller、托盘生命周期动作和托盘点击 Bridge。`main.js` 仍保留窗口创建、通知 action IPC 和宿主生命周期等行为实现；通知 action IPC 当前未发现生产调用，后续按使用证据再决定是否拆分。多账户 B-02/M-05 继续按要求暂缓。

## 当前 M-08 细分任务

1. **M-08.1 Query cache side-effect adapter（已完成）**：新增 `queryCache` module，集中 `invalidateActive`、`removeExact`、`cancelAll` 和 `clear` interface；API 与登出流程不再直接 import `QueryClient`，保留原有 refetch、精确删除和登出清理语义。提交：`94c69af2`。
2. **M-08.2 Cache scope key factory（已完成）**：在 `queryKeys` 中增加 favorite、friend、group、inventory、gallery scope key，替换 API 层裸数组；实际 key 值和前缀失效范围保持不变。提交：`38db4161`。
3. **M-08.3 Query resource registry（已完成）**：新增 `createQueryResourceRegistry` module，将资源 key、policy 和 queryFn 的 registry 归入 Query layer；API request facade 只注入 transport implementation，保留 `queryRequest.fetch` interface、资源名称和策略。提交：`7f422d0f`。

M-08 已完成：QueryClient 的生产 side effect 已集中到 `src/queries`，API/认证层通过 adapter seam 使用缓存；scope key 和 resource registry 具备独立测试表面。M-00 测试与 CI 门禁、B-01 宿主桥安全封口、N-02、N-03 与 N-04 均已完成，多账户 B-02/M-05 继续按要求暂缓。

## 当前 M-09 细分任务

1. **M-09.1 Group 角色变更决策（已完成）**：新增 `groupRoleChangeDecision` module，将角色新增/移除文案的纯计算与通知副作用分开；保持移除先于新增、各自沿原数组顺序、缺失 role payload 的旧文案结果。`groupCoordinator` 的 `groupRoleChange` 私有调用路径和 `applyGroup` interface 不变。提交：`ecfba613`。
2. **M-09.2 Group 语言 projection（已完成）**：新增 `groupLanguageProjection` module，将 Group 语言 id 到本地化条目的纯映射从 coordinator 中移出；保持源数组顺序、未知语言跳过、空字符串/`false`/`0` 等值保留，以及 `applyGroup` interface 不变。提交：`c28ed3eb`。
3. **M-09.3 Group presence 决策（已完成）**：新增 `groupPresenceDecision` module，将 presence payload 的加入/移除计算从 coordinator 中移出；保持 incoming 顺序、重复加入抑制、current membership 移除顺序，以及 `applyPresenceGroups` interface 不变。提交：`f5082f8b`。
4. **M-09.4 Group 持久化 projection（已完成）**：新增 `groupPersistenceProjection` module，将当前用户 Group 快照的纯序列化从 coordinator 中移出，保持配置 key、JSON 字段、`undefined` roleIds 和顺序不变。提交：`35b05f64`。
5. **M-09.5 Favorite 本地实体 projection（已完成）**：新增 `favoriteLocalProjection` module，合并 world/avatar 本地收藏读取中的重复分组逻辑，保持数据库顺序、fallback ref 和默认 `Favorites` 组行为。提交：`b1089ecc`。
6. **M-09.6 Favorite 本地好友 projection（已完成）**：复用 `favoriteLocalProjection` module 提取好友收藏 id 分组逻辑，保持 `Favorites` 默认组和数据库顺序。提交：`0c03a39e`。
7. **M-09.7 User 语言 projection（已完成）**：新增 `userLanguageProjection` module，提取配置事件中的语言条目映射，保持语言 key 枚举顺序和旧 interface。提交：`9020880a`。
8. **M-09.8 User 自动状态决策（已完成）**：新增 `userAutoStateDecision` module，提取自动状态/描述的纯决策，保持现有守卫、Group 访问类型映射、远程/本地好友组筛选、状态文案和 `updateAutoStateChange` interface 不变。提交：`80fa011f`。

M-09 已完成：Group、Favorite、User 三个 coordinator 的低风险纯决策与 projection seam 已建立；所有切片均独立提交并通过受影响测试，M09 全量回归未增加既有失败。M-00 测试与 CI 门禁、B-01 宿主桥安全封口、N-02、N-03 与 N-04 随后完成，多账户 B-02/M-05 继续按要求暂缓。

## 当前 M-10 细分任务

1. **M-10.1 GameLog Parser seam（已完成）**：新增 `src/services/gameLogParser.js`，把 `LogWatcher` 原始 tuple 到业务日志对象的纯字段映射移出 `src/services/gameLog.js`。`LogWatcherService.parseRawGameLog(dt, type, args)` 保留为兼容委托；`getAll()`、`gameLogCoordinator.addGameLogEvent()`、C# tuple 序列化和未知类型/空字段行为均未改变。现有 19 个映射用例改为直接覆盖纯 Parser，并增加 1 个兼容入口用例。提交：`296aa38a`。
2. **M-10.2a 数据库 row projection（已完成）**：新增 `src/services/database/gameLogRowProjection.js`，将 `getGameLogByLocation()`、`lookupGameLogDatabase()`、`searchGameLogDatabase()` 的重复行到日志对象映射移出 facade；保留 `type` 映射、字段顺序、`null`/`undefined`、portal/video/Event/External 等返回语义。提交：`aff0098b`。
3. **M-10.2b 查询参数与过滤 module（已完成）**：新增 `src/services/database/gameLogQueryParameters.js`，集中 VIP 参数化/转义和 location/table filter flag 解析，并接回 database facade。SQL 文本、`dbVars.userId`、参数顺序、排序、返回字段和旧 `database` 入口保持不变；没有触碰写入或事务。提交：`ac89133f`、`6fc90bec`。
4. **M-10.3 GameLog Store 会话查询（已完成）**：新增 `src/stores/gameLog/sessionsFilters.js`，提取日期范围、全局搜索、成员/事件/segment 过滤、分组投影和空段清理；`loadSessionsSegments()`、分页、`searchLimit`、debounce 和页面组件均保持不变。提交：`157331da`。
5. **M-10.4 GameLog worker/media 边界（已完成）**：保留既有 `mediaParsers.js` module，并新增 `src/stores/gameLog/nowPlayingTicker.js`，以显式 timer/clock/view 依赖承接 now-playing 更新；保留 1000ms 周期、完成时清理、媒体解析和 Store 的 `setNowPlaying` 兼容入口。提交：`23981f39`。

M-10.1～M-10.4 已全部完成并分别通过独立代码提交。M-10 本轮只深化 Parser、数据库只读 projection/参数、sessions 过滤和 now-playing ticker；数据库写入/事务、`DbContext`、多账户 B-02/M-05 仍按要求暂缓，后续工作另开任务，不在本轮扩大范围。

## 当前 M-11 细分任务

1. **M-11.1 Appearance DOM class seam（已完成）**：新增 `src/services/appearanceDomAdapter.js`，承接 `document.documentElement.classList` 上的无障碍状态、官方状态颜色和表格密度 class；`src/stores/settings/appearance.js` 保留原有私有 `apply*` 入口、设置 action 和初始化时机。Adapter 通过注入 document/classList 测试，class 名称、增删顺序、返回值和 public interface 均未改变。改动前后均记录 Appearance/NavMenu 定向基线，并通过 `typecheck:js`、`test:refactor` 和生产构建。提交：`b00564e2`。

2. **M-11.2 UI Store body drop guard（已完成）**：新增 `src/services/dropGuard.js`，承接 `document.body` 的 `drop` 监听注册、`preventDefault()` 和可测试的 cleanup；`src/stores/ui.js` 仅在原初始化位置调用 adapter，保留事件名、注册时机、默认行为阻止和截图管理器行为，不改 UI Store public interface。先以缺失模块得到预期 RED，再通过 adapter/Store 定向回归、`typecheck:js`、`test:refactor` 和生产构建。提交：`9844d194`。

3. **M-11.3 UI Store 对话框面包屑状态（已完成）**：已将 `pushDialogCrumb`、`setDialogCrumbLabel`、`jumpDialogCrumb`、`clearDialogCrumbs` 的数组状态变换移入 `src/stores/ui/dialogCrumbState.js`；`src/stores/ui.js` 保留原方法名、Vue ref 和 `openDialog`/`closeMainDialog`/`handleBreadcrumbClick` 协作方式。测试覆盖无效输入、重复项截断、label 更新、索引边界和清空行为，并以兼容转发接回 Store；页面、Coordinator、路由、窗口能力和 VR overlay 未修改。提交：`8556c0ef`。

4. **M-11.4 UI Store 托盘通知宿主 Adapter（计划中）**：将 `updateTrayIconNotify()` 内的 CEF `AppApi.SetTrayIconNotification()` 与 Linux Electron `window.electron.setTrayIconNotification()` 路由移入显式 capability Adapter；Store 保留通知状态计算、`force` 更新守卫、调用时机和 public interface。通过 fake host 验证双宿主方法名、布尔参数和路由，不改变 `notifiedMenus`、`notificationIconDot` 或 VR overlay。

M-11.1～M-11.3 已完成并分别建立独立回滚点。M-11.4 完成后将评估是否达到本轮停止线；不再为了减少行数继续拆分，且本轮不触碰 `src/vr`、多账户会话、窗口/宿主契约或公共页面接口。

## 当前 M-00 细分任务

1. **M-00.1 JavaScript typecheck 工具链（已完成）**：将 `typescript@^5.9.3` 加入 `devDependencies` 并锁定到 `package-lock.json`，修复 `typecheck:js` 过去因找不到 `tsc` 而无法执行的问题。提交：`7fddf930`。
2. **M-00.2 现有类型债务分批收敛（已完成）**：工具链启用后暴露的 210 条既有诊断已通过低风险契约切片降至 0 条。最后四个静态-only 切片覆盖 accountHub、accountSession、aggregatedView 和 Sentry 返回契约（`6c7022a6`、`52657880`、`3e6945a6`、`dc732cc9`）；没有修改多账户运行时流程、公共 interface、序列化格式或并发逻辑，多账户功能实现仍按要求暂停。
3. **M-00.3 CI 分阶段门禁（已完成）**：`.github/workflows/ci.yaml` 现在在 PR 和手动触发时运行。JavaScript typecheck、schema、重构 smoke、生产构建及 C# 测试为阻断门禁；全量前端测试、Oxlint/Oxfmt 和 C# 格式检查保留为可见的 report-only 检查，直到既有基线债务被单独消化。

M-00.2 已开始：首个低风险切片修正 `gameStateTask` 的 `getLogLines` 注释契约，使其准确表达同步数组/Promise 双路径，并完成原文件格式化；`updateLoop.js(65,28)` 误报已消失，整体诊断数仍为 210。提交：`8961b676`。第二个切片修正 Group API 的 `bool` JSDoc 类型名称，诊断数降至 209，提交：`8c34f3f2`。第三个切片修复 Avatar 上传方法的空参数 JSDoc，诊断数降至 207，提交：`26513e2c`。第四个切片将 Notification API 的损坏 typedef 改为标准 `@typedef/@property` 声明，解析错误消失，当前诊断数为 206，提交：`23be21b4`。第五个切片移除 Notification V2 projection 中不存在的 `endpointDomain` 参数注释，诊断数降至 205，提交：`5ee0da85`。第六个切片对齐 Feed 差异格式化函数的四个参数名与真实签名，诊断数降至 201，提交：`1fa5e8f9`。第七个切片修正通知邀请辅助函数的 `rsvp` 参数注释，诊断数降至 200，提交：`2e412fa8`。第八个切片为 `request()` 建立显式上传扩展 interface，清零 13 个上传选项误报，诊断数降至 189，提交：`950185fb`。第九个切片修正 World API `ref` 返回对象的静态推断并保持属性顺序，诊断数降至 188，提交：`c4fc3a58`。第十个切片修正 Instance API `ref` 返回对象的静态推断并保持属性顺序，诊断数降至 187，提交：`33f9c4c6`。第十一个切片为 request 自定义 Error 字段加入表达式级静态类型，诊断数降至 182，提交：`fb93b448`。第十二个切片为 Query key `groupMember` 解构参数声明可选 id，诊断数降至 180，提交：`b1999fa2`。第十三个切片补齐其余 Group/World/File Query key 的解构参数声明，诊断数降至 171，提交：`cb03eb6c`。第十四个切片同步 C# WebApi 二级账号方法到全局 bridge interface，诊断数降至 165，提交：`7e67caa4`。第十五个切片为 Sentry 原始异常 message 增加安全静态 narrowing，诊断数降至 150，提交：`d7a0e479`。第十六个切片将 WorldDialog commands 的 toast 注释从普通函数收窄为现有 `success/error` 方法契约，未改变运行时调用，诊断数降至 132，提交：`ae24f1b0`。第十七个切片将 WorldDialog info 的 toast 注释收窄为同一 `success/error` 方法契约，未改变运行时调用，诊断数降至 126，提交：`8296bd40`。第十八个切片为 quickSearch worker 的排序临时字段建立内部结果类型，保留返回前删除 `_isPrefix` 的行为，诊断数降至 114，提交：`bef8632b`。第十九个切片修正 ConfigRepository 整数/浮点读取的字符串与数字局部推断，保持缺省值与 NaN 分支行为，诊断数降至 109，提交：`4cb54188`。第二十个切片为 cacheCoordinator 的三个 SDK 版本读取点加入局部结构断言，保持缓存选择和比较行为，诊断数降至 106，提交：`5f968094`。第二十一个切片为 devtool 的 SDK 版本读取点加入同源局部结构断言，保持 bundle 路径选择行为，诊断数降至 105，提交：`143f3e99`。第二十二个切片修正 format 工具的字符串/数字转换和 YouTube 时间数组内部类型，保持原有格式输出，诊断数降至 96，提交：`a9539b57`。第二十三个切片为 localization glob URL 建立字符串资源 map，并显式字符串化 HTTP 错误状态，保持 fallback 请求行为，诊断数降至 93，提交：`bc4ce3d5`。第二十四个切片为表格 debounce 定时器声明跨 Node/浏览器的返回类型，保持取消与触发时序，诊断数降至 92，提交：`509a48df`。第二十五个切片为 FileReader 的 ArrayBuffer 结果加入局部类型断言，保持 base64 编码流程，诊断数降至 91，提交：`322642ab`。第二十六个切片为两个主题 style link 节点加入 `HTMLLinkElement` 局部类型，保持 DOM 插入和 rel/href 行为，诊断数降至 89，提交：`3d01e043`。第二十七个切片删除 `src/api/group.js` 中与前一个实现逐行一致的重复 `followGroupEvent` 定义，保持单一公共方法实现，诊断数降至 88，提交：`4db8eff6`。第二十八个切片将游戏注册表值显式转为字符串再解析，保持日志开关判断，诊断数降至 87，提交：`c50650c5`。第二十九个切片将上传协调器的 Blob.size 显式转为字符串后解析，保持字节数计算，诊断数降至 86，提交：`18a2f3cb`。第三十个切片补齐 manual relations 建议结果的 `displayScore/tooltip/isAdded` 类型，保持提示内容和排序行为，诊断数降至 85，提交：`c2016307`。第三十一个切片将 game-log 离开时长计算显式改为 Dayjs `valueOf()`，保持原有毫秒差，诊断数降至 84，提交：`1fee019c`。第三十二个切片将 Group API 的 `order/sortBy` 注释改为可选，匹配实际调用并通过 Group 查询测试，诊断数保持 84，提交：`5bc9022a`。第三十三个切片为 `useSearchGroup` 的活动参数建立局部契约断言，保留初始/清空时的空对象行为，诊断数降至 79，提交：`c9434ef1`。第三十四个切片为 `useSearchWorld` 的缓存配置和活动参数加入局部契约断言，保留空对象初始化/清空以及原有搜索、分页行为，诊断数降至 73，提交：`c69ae85e`。第三十五个切片为查询缓存日志目标加入 `string | unknown[]` 局部断言，保持日志标签、目标和参数顺序，诊断数降至 71，提交：`ff489866`。第三十六个切片为通知偏好过滤函数的返回结果加入 `string[]` 局部断言，保持无效 ID 过滤及顺序/重复语义，诊断数降至 70，提交：`035716d6`。第三十七个切片为 `loadStoredNavConfig` 的 `filterHiddenKey` 补齐布尔回调契约，修复两个导航 composable 的字面量 `true` 误报，诊断数降至 68，相关导航工具测试维持基线 31/32 通过（另有 1 个既有 charts-folder 失败及 `useNavLayout` 导入阶段的既有 i18n 初始化失败），提交：`dbb9d03f`。第三十八个切片将 `$throw` 的返回契约标记为 `never`，准确表达其必然抛错语义并消除 request Promise 的 `void` 误报，诊断数降至 67，request 测试 47/47 通过，提交：`18946f8c`。第三十九个切片为 activity store 的 top-worlds 查询参数补齐 `time | count` 与兼容的 `isSelf` 契约，保持数据库调用和传参形状，诊断数降至 64；activity store 测试因既有 `i18n.global` 导入初始化失败无法启动，已用同一基线复现，数据库 top-worlds 测试 7/7 通过且生产构建通过，提交：`e47b326c`。第四十个切片删除 friend store 返回对象中逐字重复的 `updateSidebarFavorites` 键，保持导出接口和方法引用，诊断数降至 63，friend sync 任务测试 2/2 通过，提交：`a3a15492`。第四十一个切片将 Previous Instances actions 列工厂的 `onLaunch` 标记为可选，匹配 world/默认场景的既有缺省调用，诊断数降至 61，生产构建通过且该目录无专属测试，提交：`319ed620`。第四十二个切片为 tray notification 投影补齐 `formatMessage/getAvatarUrl` 可选输入契约，保持通知筛选、排序、主题及操作快照行为，诊断数降至 58，tray bridge 测试 15/15 通过，提交：`d6cd5abc`。第四十三个切片将 C# `AppApi.UpdateTrayNotifications` 与 Electron preload 的两个托盘通知方法补齐到全局 bridge interface，保持 JSON snapshot 和回调语义，诊断数降至 55，通知相关测试 30/30 通过，提交：`b84e4f65`。第四十四个切片将旧版 Notification API 的 `sent/type/after` 查询字段标记为可选，匹配刷新循环只传 `n/offset` 的既有行为，诊断数降至 54，通知辅助测试 8/8 通过，提交：`facd3d3a`。第四十五个切片将 `getQuickInviteResponseParams` 返回契约从 `Promise<boolean>` 校正为邀请响应对象，保持邀请调用和序列化字段，诊断数降至 53，邀请/通知测试 23/23 通过，提交：`f6d5dc4d`。第四十六个切片将托盘自定义 DOM 事件在监听器内收窄为 `CustomEvent`，保持事件名和 payload 解构行为，诊断数降至 52，通知相关测试 30/30 通过，提交：`44e0cdca`。下一刀优先处理同类不改变运行时的 JSDoc/声明契约问题。

第四十七个切片将游戏日志全局搜索分页的局部 `hasMore` 从字面量推断收窄为布尔值，保持批次循环与游标提交行为，诊断数降至 51，数据库游戏日志测试 7/7 通过，提交：`5ba6b8c4`。
第四十八个切片在搜索 store 将用户搜索结果投影局部收窄为现有用户响应契约，保持用户缓存更新和结果映射行为，诊断数降至 50，搜索 store 测试 25/25 通过，提交：`a93c40cd`。
第四十九个切片将 WebSocket 离线好友的合成载荷在 `applyUser` 调用边界局部收窄为现有用户响应契约，保持离线状态、位置字段和好友刷新行为，诊断数降至 49，WebSocket 好友位置测试 2/2 通过，提交：`073d3f76`。
第五十个切片将 GroupDialog 批量操作成功提示的数量替换显式转为字符串，保持原有提示内容和批量执行顺序，诊断数降至 48，批量操作测试 15/15 通过，提交：`9a8327b3`。
第五十一个切片为 `uiStore.openDialog` 补齐调用方已经使用的可选 `label` 契约，保持对话框面包屑写入行为，诊断数降至 46，实例操作栏测试 8/8 通过，提交：`1e42fd4e`。
第五十二个切片将高级设置头像自动清理的日期差改为双方显式时间戳，保持七天阈值和清理时序，诊断数降至 44，生产构建通过，提交：`8ca97efb`。
第五十三个切片为本地化 CLI 的 JSON 文件读取和临时对象重建补齐 Node 类型契约，保持 JSON 内容和写回格式，诊断数降至 42，CLI 帮助命令通过，提交：`c12345c8`。
第五十四个切片为外观设置的侧栏路由判断增加非字符串路由守卫，保持现有路由过滤结果，诊断数降至 41，布局测试 2/2 通过，提交：`ec4bfe39`。
第五十五个切片为通用设置关闭行为补齐联合类型，并将冷却分钟解析的隐式转换显式化，保持设置值、阈值和存储格式，诊断数降至 39，关闭行为测试 7/7 通过，提交：`8fa826ae`。
第五十六个切片为图表互友图使用 `unref` 兼容 ref/普通对象，并将互友图元数据的 `lastFetchedAt` 标为可选，保持图表查询与默认时间行为，诊断数降至 36，生产构建通过，提交：`a9969ddd`。
第五十七个切片将收藏分组缓存函数的返回声明从 `void` 校正为分组映射，保持分组计数和收藏遍历行为，诊断数降至 34，收藏分组对话框测试 1/1 通过，提交：`2e0aa80c`。
第五十八个切片为图库邀请上传补齐 `FileReader.result` 与输入元素的局部 DOM 类型，保持二进制编码和控件清空行为，诊断数降至 32，通知中心测试 4/4 通过，提交：`89bdbfab`。
第五十九个切片将通知超时弹窗的初始输入和数值校验显式转换为字符串/数字，保持超时秒数与存储毫秒值，诊断数降至 30，Modal 测试 26/26 通过，提交：`ad36fd0c`。
第六十个切片为 VRCX 窗口状态保存器补齐 Promise resolver 与窗口几何输入契约，保持窗口状态存储键和防抖时序，诊断数降至 26，生产构建通过，提交：`3f327653`。
第六十一个切片为 Favorites 三个 composable 的默认空对象补齐静态兼容声明，并补充 `canCreate` 可选依赖，保持默认值和选择/拖拽行为，诊断数降至 22，三个 composable 测试 7/7 通过，提交：`4ff533e0`。
第六十二个切片补齐通用设置 recent-action 冷却分钟的显式字符串解析，保持数值范围和配置写入行为，诊断数降至 21，关闭行为测试 7/7 通过，提交：`20e59e13`。
第六十三个切片在 VRCX 窗口状态保存器的既有几何输入断言外加 `unknown` 过渡，消除检查器对运行时动态窗口状态的过窄转换误报，保持窗口状态存储键和防抖时序，诊断数降至 20，生产构建通过，提交：`d8319989`。
第六十四个切片移除光子事件详情单元未使用且调用方未提供的 `onShowUser` 参数，保持详情渲染和所有点击回调行为，诊断数降至 19，PlayerList 列测试 5/5 通过，提交：`8f9fade8`。
第六十五个切片将 Vite 资源内联回调以局部 `any` 兼容声明包裹，保留现有按路径返回阈值的运行时策略并消除 Vite 8 overload 误报，诊断数降至 18，生产构建通过，提交：`56c0bdcb`。
第六十六个切片在 Group 语言 projection 调用边界为运行时已解包的语言映射补齐 `Record<string, unknown>` 局部断言，保持语言过滤和显示顺序，诊断数降至 17，Group 语言 projection 测试 3/3 通过，提交：`c3083e4f`。
第六十七个切片在 Group 对话框加载响应边界以局部结构断言兼容 API 返回的缓存 `ref`，保持已有 `ref || applyGroup(json)` 回退和对话框时序，诊断数降至 16，Group API 查询测试 8/8 通过，提交：`d1036d08`。
第六十八个切片为 Group 对话框二次加载结果的可选 `args` 补齐局部结构断言，保持已有缓存分支返回值和加载时序，诊断数降至 15，Group API 查询测试 8/8 通过，提交：`15ecc4bd`。
第六十九个切片为 Group 注册表排序 JSON 的动态返回值补齐字符串局部断言，保持原有 `JSON.parse` 输入和排序写入行为，诊断数降至 14，游戏协调器测试 2/2 通过，提交：`67e12e26`。

当前 M-00 的安全边界是“先让检查可执行，再逐批降低诊断数”。本切片没有修改运行时代码、公共 interface、序列化格式或并发逻辑。

### M-00.2 最后四个静态契约切片

- `6c7022a6`：为 `accountHub` 的主账号兼容 stub 和 session registry 加入结构化 JSDoc，诊断从 14 降至 13。
- `52657880`：为 `accountSession` 的二级账号 request/friend cache 加入结构化 JSDoc，诊断从 13 降至 2。
- `3e6945a6`：为 `aggregatedView` 的好友合并输入和 prefix 查找加入局部结构断言，随后只剩第三方 Sentry option 类型诊断。
- `dc732cc9`：为 `getSentry` 明确 `any` 返回边界，隐藏第三方私有 option 类型；`npm run typecheck:js` 最终通过（0 diagnostics）。

以上切片均为声明/局部静态类型修正，未触碰多账户功能实现；每刀均在受影响测试和生产构建基线上验证后独立提交。

### M-00 完成口径

- 阻断门禁：`npm run typecheck:js`（0 diagnostics）、`npm run check:schema`（5 properties）、`npm run test:refactor`（56 个文件/293 项测试）、`npm run prod`、C# `dotnet test`（3/3）。
- 可见但暂不阻断：完整 `npm test`（255 个文件：231 通过、24 失败；2395 项测试：2307 通过、88 失败；3 个未处理错误；B-01 定向测试通过）、`npm run lint`（45 errors/79 warnings）、`npm run format:check`（209 个文件）、C# format。
- 这些 report-only 检查不会被隐藏，也不会把既有红色基线误报为绿色；后续每个切片仍需保证失败数量和错误类别不增加。

## 每个切片的回滚协议

1. 修改前运行受影响模块测试，记录既有失败数量和错误分类。
2. 只做一个逻辑变更；不改公共 interface 签名、序列化格式或并发逻辑。
3. 修改后重复同一组测试，并检查新增代码的 Oxlint/Oxfmt。
4. 通过后创建独立 Git commit；失败时只回滚当前切片。
5. 完成验证后再进入下一个 seam，并在本计划和架构诊断中同步状态。
