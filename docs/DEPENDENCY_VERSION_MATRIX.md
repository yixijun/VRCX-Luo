# 第三方依赖版本矩阵

> 状态：Accepted  
> 更新时间：2026-09-05  
> 所属计划：N-04.1

## 目的

N-04 先建立可重复的版本观察面，不在没有平台验证的情况下升级或统一历史依赖。矩阵同时覆盖前端 npm、Windows CEF .NET 和 Electron .NET 三个宿主构建面。

## 检查入口

在仓库根目录执行：

```text
npm run check:dependency-matrix
```

检查器读取 `package.json`、`package-lock.json` 和 `Dotnet/*.csproj`，只读生成矩阵并返回结果。

### 阻断项

- `package.json` 名称或版本缺失，或 lockfile 根 package 版本不一致；
- 关键 npm 包未声明或未锁定：`electron`、`electron-builder`、`node-api-dotnet`、`pinia`、`typescript`、`vite`、`vitest`、`vue`、`vue-i18n`；
- .NET 项目缺少目标框架、出现重复 `PackageReference`；
- 同一项目内的耦合包版本不一致：CefSharp OffScreen/WinForms，以及 NodeApi/Generator。

### 报告项

不同宿主项目之间的版本漂移只报告，不自动改写项目文件。这样可以在升级前显式确认 x64、arm64、Windows CEF 的兼容性，并保持现有构建与运行行为。

## 当前宿主矩阵

| 项目 | 目标框架 | 备注 |
|---|---|---|
| `Dotnet/VRCX-Cef.csproj` | `net10.0-windows10.0.19041.0` | Windows CEF 宿主 |
| `Dotnet/VRCX-Electron.csproj` | `net9.0` | Electron x64 |
| `Dotnet/VRCX-Electron-arm64.csproj` | `net9.0` | Electron arm64 |

当前根版本来源仍由 `Version`、`package.json` 和 lockfile 一致性门禁共同确认；依赖版本以各自 manifest 和 lock/restore 结果为准，不在本文手工复制易变的完整清单。

## 2026-09-05 已知漂移

以下结果来自 `npm run check:dependency-matrix`，属于待评估项，不是本次重构的升级目标：

| 依赖 | 当前版本 | 影响面与约束 |
|---|---|---|
| `NLog` | CEF/x64 `6.1.2`；arm64 `6.0.7` | 需分别验证三种宿主日志初始化和输出 |
| `System.Data.SQLite` | CEF `2.0.3`；arm64 `2.0.2`；x64 `1.0.119` | x64 项目保留 `DO NOT UPGRADE` 注释，升级前必须单独做数据库兼容验证 |
| `System.Management` | CEF/x64 `10.0.7`；arm64 `10.0.1` | 仅在对应平台重新验证硬件/系统信息读取 |
| `Microsoft.JavaScript.NodeApi` | x64 `0.9.19`；arm64 `0.9.18` | 与 Generator 必须在同一项目内配对，升级前验证 .NET bridge 和 Electron 打包 |
| `Microsoft.JavaScript.NodeApi.Generator` | x64 `0.9.19`；arm64 `0.9.18` | 同上 |

`CefSharp.OffScreen.NETCore` 与 `CefSharp.WinForms.NETCore` 当前在 CEF 项目内保持 `146.0.100` 配对。任何依赖升级都必须单独提交、先跑受影响测试，再验证生产构建和对应宿主；不允许把“消除漂移”当作无验证的机械统一。

## 更新流程

1. 先运行 `npm run check:dependency-matrix`，把新增漂移或阻断项记录在独立任务中。
2. 只修改一个依赖或一个宿主项目，保留原有平台约束和注释。
3. 运行受影响的 JavaScript/.NET 测试、类型检查及构建；失败时只回滚当前切片。
4. 通过后更新本文件的已知漂移说明，并创建独立本地 Git 提交；不自动发布或推送。
