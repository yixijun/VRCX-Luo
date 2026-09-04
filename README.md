<div align="center">

# <img src="./images/VRCX.png" width="64" height="64"> VRCX-Luo

[![GitHub Workflow Status](https://github.com/yixijun/VRCX-Luo/actions/workflows/github_actions.yml/badge.svg)](https://github.com/yixijun/VRCX-Luo/actions/workflows/github_actions.yml)

</div>

VRCX-Luo 是基于 [FuLuTang/VRCX-jirai](https://github.com/FuLuTang/VRCX-jirai) 的增强分支；其终极上游是 [vrcx-team/VRCX](https://github.com/vrcx-team/VRCX)。本分支重点放在三件事上：

- 让 VRChat 社交记录更容易查、看、分析。
- 补全原版 VRCX 在启动、通知、托盘、工具页和本地测试上的体验缺口。
- 尽量复用 VRCX 原有数据库、接口和 UI 结构，新增功能以本地展示、白名单操作和可关闭设置为主。

> 本项目不是 VRChat 官方项目，也不代表 VRChat 或 VRCX 官方观点。

> 使用提醒：功能仅供个人记录整理和娱乐分析，请勿用于骚扰、攻击、泄露隐私或其他违反 VRChat 规则的用途。适度使用工具，注意自我保护，也尊重他人的隐私选择。

## 下载与安装

| 平台 | 说明 |
| :--- | :--- |
| Windows | [下载最新 Releases](https://github.com/yixijun/VRCX-Luo/releases/latest) 中的安装包 |
| Linux | [下载最新 Releases](https://github.com/yixijun/VRCX-Luo/releases/latest) 中的 AppImage，直接执行即可 |
| macOS | 未测试；需要自行从源码构建，参考 [从源码构建](#从源码构建) |

如果更新后侧边栏没有出现新入口，可以在侧边栏右键，进入 `自定义导航栏`，执行 `恢复默认`。

## 与原版/上游的关系

本仓库的改动是在 `VRCX-jirai` 的基础上继续整理和补全。可以简单理解为：

- `vrcx-team/VRCX`：原版 VRCX，提供登录、好友、通知、日志、数据库和大多数基础页面。
- `FuLuTang/VRCX-jirai`：直接上游，加入了更多社交分析、关系图、数据补全和本地展示能力。
- `VRCX-Luo`：在 jirai 的基础上继续补启动体验、通知体验、托盘行为、内存清理、本地构建、界面一致性和部分功能修复。

README 中只重点写 Luo 当前版本可见、可用、需要用户知道的功能；更细的代码级改动可以看 [VRCX-Luo 改动清单](./docs/JIRAI_FEATURES.md)。

## 功能总览

### 社交分析

- **双人关系查询**：选择任意两名用户，查询历史上共同在同一实例的记录，辅助判断共处时间、实例、人数变化等信息。
  - 可辅助查看共同房间、时间段、实例信息、人数变化等细节。
  - 适合回看历史实例记录，数据来自本地日志和 VRCX 已保存的历史记录。
- **关系时间轴**：把实例共处、状态变化、位置变化等记录聚合成时间线，观察一段时间内与不同好友的互动密度。
  - 可以用时间流的方式看出最近互动最频繁的人。
  - 支持按展示数量和过滤条件缩放，方便从全局趋势切到重点用户。
- **好友关系网增强**：在关系图中展示共同好友、手动关系和追踪用户，支持更完整地梳理社交圈结构。
  - 支持手动补充本地关系线，解决部分用户隐藏共同好友后图里没有连线的问题。
  - 追踪非好友也可以被纳入关系网展示，但只影响本地显示。
- **个人简介 Diff**：用类似代码 diff 的方式展示 Bio 变化，新增内容和删除内容分开显示，减少纯历史列表的阅读成本。
  - 适合观察简介内容的具体变化，而不是只看一条条完整历史。
  - 对中文、英文混合文本做了更适合阅读的差异展示。
- **灯色/状态分布**：在用户资料里展示在线期间不同状态的占比，尽量排除离线时间对统计的干扰。
  - 统计重点是用户在线时的绿/蓝/黄/红状态比例。
  - 自己的状态变化也会被记录，方便回看个人使用习惯。

### 追踪与自动化

- **追踪非好友**：可将非好友加入本地追踪列表，持续记录公开资料、状态和简介变化，入口在侧栏追踪页。
  - 支持输入用户 ID 添加，也可以从用户资料页添加。
  - 追踪记录主要用于本地 Feed、Bio Diff、关系图和搜索补全。
- **自动跟随**：选择目标好友后，自动监听目标所在实例变化，并按当前桌面/VR 状态尝试加入。
  - 桌面模式下会按需要重启/启动 VRChat 并带实例参数加入。
  - VR 模式下优先复用当前运行状态，SteamVR 已运行且游戏未启动时会按 VR 模式启动。
  - 内置冷却，避免同一个目标实例反复触发加入。
- **VR/桌面启动逻辑**：支持桌面模式启动、VR 模式启动、SteamVR 状态检测；SteamVR 未运行时会询问是否先启动 SteamVR。
- **快速启动按钮**：右下角圆形按钮可快速启动 VRChat 桌面模式、VR 模式或 SteamVR，并会与返回顶部按钮错位显示，避免遮挡。

### 通知与托盘

- **通知中心增强**：支持通知中心布局、未读红点、清理显示、邀请类通知响应等常用操作。
  - 未读红点可以在界面设置中开关。
  - 清理通知中心显示不会等同于删除所有历史记录。
- **桌面通知总开关**：可关闭桌面通知，关闭后自定义提示音也不会继续播放。
- **自定义提示音**：可为桌面通知选择本地提示音，区分其他应用通知。
  - 启用自定义提示音时会避免系统通知声和自定义声音同时响。
- **托盘静音模式**：托盘右键菜单可切换静音模式，适合暂时不想被通知打扰的场景。
- **V 睡模式**：可在托盘菜单中开启，保留手腕叠加界面，同时关闭头显叠加通知。

### 工具与系统体验

- **内存清理工具**：工具页提供内存占用概览、普通清理、深度清理和管理员权限请求；深度清理提示为“专为16G内存设计，效果未知”。
  - 普通清理以当前进程相关内存整理为主。
  - 深度清理会请求管理员权限，适合内存紧张时手动尝试，不保证所有机器都有明显效果。
- **关闭按钮行为设置**：设置页可选择点击右上角关闭按钮时 `每次询问`、`最小化到系统托盘` 或 `直接退出`。
- **关闭确认弹窗**：选择询问模式时，关闭按钮会弹出应用内确认框，支持取消、直接退出、最小化到托盘和不再提示。
- **离线不活跃好友分类**：可按自定义时间将长期离线好友归类，并支持自动隐藏空分类。
- **玩家列表布局修正**：优化实例信息区和玩家列表区域的滚动布局，减少缩放较大时内容被挤掉的问题。

### 数据补全

- **启动补全扫描**：应用启动或 WebSocket 重连后，会尝试补全好友 Bio 和状态记录。
  - 这用于弥补 VRCX 未运行期间可能错过的 Bio/状态变化。
- **打开资料即记录**：打开用户资料时会拉取最新资料，并在变化时写入本地历史。
- **自我数据记录**：会记录自己的位置、状态、头像等变化，方便在个人主页查看自己的历史。
- **状态计时恢复**：重启 VRCX 后，如果好友仍在原实例，会尽量从本地记录恢复真实停留时长。

### 原版体验补充

- **快速搜索增强**：在原版快速搜索基础上，可更方便地检索好友、最近遇到的人、最近加入的世界、收藏世界、群组和部分历史资料。
- **持久化补全**：尽量把 Bio、状态、头像、位置等变化写入本地数据库，减少“只在内存里看过，重启就没了”的情况。
- **界面一致性修正**：侧栏、玩家列表、设置页、弹窗按钮和浮动按钮尽量跟当前 VRCX 风格保持一致。
- **上游同步**：保留原版 VRCX 的基础能力，并持续吸收 jirai/原版上游中适合合并的修复和功能。

## 功能入口

| 功能 | 入口 |
| :--- | :--- |
| 双人关系 | `Charts` 页面中的双人关系标签 |
| 关系时间轴 | `Charts` 页面中的关系时间轴标签 |
| 关系网 | `Charts` 页面中的好友关系网 |
| 追踪非好友 | 侧栏的追踪非好友页，或用户资料右键/更多菜单 |
| 自动跟随 | 好友资料、自动跟随弹窗和状态栏自动跟随状态 |
| 快速启动 | 好友/群组侧栏右下角圆形按钮 |
| 通知设置 | `设置 -> 通知` |
| VR 通知与 V 睡模式 | `设置 -> VR` 和托盘右键菜单 |
| 关闭按钮行为 | `设置 -> 界面 -> 窗口行为` |
| 内存清理 | `工具 -> 系统工具 -> 内存清理` |
| 本地构建 | 根目录 `build-windows-local.bat` |

## 数据与逻辑结构

VRCX-Luo 的新增功能尽量不绕开原版 VRCX 的数据体系。核心逻辑可以按下面理解：

```text
VRChat API / Pipeline WebSocket / VRChat output_log.txt
        |
        v
Coordinator / Store 处理用户、好友、位置、通知事件
        |
        v
SQLite 本地数据库
        |
        v
Charts / UserDialog / Sidebar / Tools 等界面读取并展示
```

### 数据来源

| 层级 | 来源 | 主要用途 |
| :--- | :--- | :--- |
| 游戏日志 | 本地 VRChat `output_log.txt` | 当前实例玩家加入/离开、实例切换、玩家列表辅助数据 |
| WebSocket | VRChat Pipeline | 好友上下线、位置变化、资料变更、通知事件 |
| REST API | VRChat API | 用户资料、好友列表、世界/实例详情、状态补全 |
| 本地配置 | VRCXStorage / configRepository | 用户偏好、窗口行为、通知开关、工具设置 |
| SQLite | VRCX 原有数据库结构加少量 Luo 表 | Feed、Bio 历史、状态、关系、追踪列表、分析查询 |

### 前端结构

| 目录 | 职责 |
| :--- | :--- |
| `src/views` | 页面级功能，例如 Charts、PlayerList、Settings、Tools、Notifications |
| `src/components` | 可复用组件，例如快速启动按钮、用户弹窗、关闭行为弹窗 |
| `src/stores` | Pinia 状态管理，例如好友、通知、自动跟随、设置、VR 状态 |
| `src/services` | API、数据库、配置、账号和底层服务封装 |
| `src/coordinators` | 将 WebSocket/API/数据库事件编排成业务流程 |
| `src/shared` | 常量、工具函数、跨平台通用逻辑和测试 |

### 桌面端结构

| 目录 | 职责 |
| :--- | :--- |
| `Dotnet` | Windows CEF 版本后端、AppApi、游戏/SteamVR 检测、托盘、内存清理 |
| `src-electron` | Electron 版本主进程、托盘菜单、窗口行为和原生桥接 |
| `Installer` | Windows 安装包脚本 |
| `.github/workflows` | GitHub Actions 构建与发布 |

## 安全与边界

- VRCX-Luo 只基于 VRCX 原版可获得的数据、VRChat API 返回的数据和本地游戏日志做整理展示。
- 不提供 VRChat 账号凭据导出、数据库清空、绕过隐私状态等高风险能力。
- 追踪、关系图、Bio Diff 等功能主要面向本地记录和本地分析，请遵守 VRChat 规则并尊重他人隐私。
- 开启黄灯/红灯、隐藏位置等 VRChat 原生隐私设置，会影响本项目可展示的数据。
- 部分高级设置包含自动加入默认群组等选项，用于功能认证或邀请辅助；不需要时可以在设置中关闭。
- 如果你认为某类数据不应被 VRCX 或相关分支读取，应该优先向 VRCX/VRChat 对应上游反馈规则和接口边界问题。

## 开发者文档

- [文档中心](./docs/README.md)
- [架构诊断报告](./docs/ARCHITECTURE_DIAGNOSIS.md)
- [VRCX-Luo 改动清单](./docs/JIRAI_FEATURES.md)
- [数据刷新机制说明](./docs/DATA_REFRESH.md)
- [数据库架构预览](./docs/DATABASE_SCHEMA.md)
- [Windows CEF 本地测试与安全重启](./docs/CEF_LOCAL_TESTING.md)
- [多账号 V4 详细设计草案](./docs/MULTI_ACCOUNT_V4_DETAIL_DESIGN.md)

## 从源码构建

### 环境要求

- Node.js `>= 24.10.0`
- npm `>= 11.5.0`
- Windows CEF 构建需要 .NET SDK 和 Visual Studio 相关桌面开发组件

### 前端构建

```powershell
npm install
$env:PLATFORM='windows'
npm run prod
```

### Windows 本地测试构建

```powershell
.\build-windows-local.bat
```

本地测试版的安全启动、重启和常见问题见 [CEF_LOCAL_TESTING.md](./docs/CEF_LOCAL_TESTING.md)。
如果启动时显示 `You must install or update .NET to run this application.`，请按文档中的
“出现“.NET 需要安装或更新”窗口”部分使用 `--self-contained` 重新构建；这是运行时打包
方式问题，不是 VRCX 页面功能异常。

## 免责声明

VRCX-Luo Edition is not endorsed by VRChat and does not reflect the views or opinions of VRChat or anyone officially involved in producing or managing VRChat properties. VRChat and all associated properties are trademarks or registered trademarks of VRChat Inc. VRChat © VRChat Inc.

## Star History

[![Star History Chart](https://api.star-history.com/image?repos=yixijun/VRCX-Luo&type=date&legend=top-left)](https://www.star-history.com/?repos=yixijun%2FVRCX-Luo&type=date&legend=top-left)
