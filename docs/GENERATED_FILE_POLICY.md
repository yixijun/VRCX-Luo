# 生成文件与第三方二进制治理

> 状态：Accepted  
> 更新时间：2026-09-05  
> 所属计划：N-04.2

本项目同时包含源码、IDE 生成代码、SDK 绑定和构建产物。生成文件不是首批重构目标；本规则先明确来源、修改边界和回滚方式，避免把生成结果误当成业务实现维护。

## 通用规则

1. 生成文件必须能追溯到来源、生成工具或构建步骤；没有来源说明时先补文档，不直接重写文件。
2. 带有 `auto-generated`、`Designer` 或构建输出标记的文件不手工修复业务逻辑；需要变更时修改来源或生成步骤，再整体重新生成。
3. 生成结果的变更必须与来源变更放在同一个独立提交中，并保留生成前后的验证记录。
4. 构建产物和临时目录继续由 `.gitignore` 排除；不为了“保持目录干净”删除用户已有的未提交文件。

## 当前清单

| 路径 | 类型 | 来源/生成方式 | 修改边界 |
|---|---|---|---|
| `Dotnet/Overlay/OpenVR/openvr_api.cs` | SDK C# 绑定 | OpenVR SDK 绑定生成结果；文件头明确标注 `auto-generated` | 只在 OpenVR SDK/绑定版本升级时整体替换；不在业务重构中逐行修改 |
| `Dotnet/Cef/MainForm.Designer.cs` | WinForms Designer 代码 | Visual Studio WinForms Designer | 通过窗体设计器或对应设计源更新，避免手工改初始化顺序 |
| `Dotnet/libs/openvr_api.dll` | Windows 原生 SDK 二进制 | OpenVR 上游二进制；来源记录见 `docs/third-party-libs.md` | 仅随 OpenVR SDK 升级整体替换，并验证 CEF/VR overlay |
| `src-electron/libs/linux/libopenvr_api.so` | Linux 原生 SDK 二进制 | OpenVR 上游二进制；由 Electron 打包配置带入 | 仅随 OpenVR SDK 升级整体替换，并验证 x64/arm64 打包 |
| `Installer/version_define.nsh` | 安装器版本注入文件 | `build-scripts/build-all.ps1`、`Installer/build-installer.bat` 或 CI `set_version` 步骤生成 | 已加入忽略列表；不要把构建时版本写回源码提交 |
| `build/`、`bin/`、`obj/` | 构建输出/还原缓存 | Vite、electron-builder、dotnet build/restore | 保持忽略；不作为架构诊断或重构输入 |
| `build/html/.vite/license.md`、`build/html/licenses/*` | 第三方许可清单 | `npm run prod`、`build-scripts/generate-third-party-licenses.js` | 由构建重新生成；许可证来源和人工覆盖放在 `build-scripts/licenses/` |
| `docs/vrcx_*` | 数据库图与模型文档 | Mocodo/Graphviz 等文档工具输出 | 只在模型源文件或图工具版本有意变更时整体更新 |

## 第三方来源

Dotnet 原生库来源、许可证和后续补充入口集中在 [`third-party-libs.md`](./third-party-libs.md)。NuGet/npm 依赖的版本观察使用 [`DEPENDENCY_VERSION_MATRIX.md`](./DEPENDENCY_VERSION_MATRIX.md) 和对应的 manifest，不在多个文档中复制同一份易变版本号。
