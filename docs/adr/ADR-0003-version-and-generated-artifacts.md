# ADR-0003：版本来源与生成文件分离治理

- 状态：Accepted
- 日期：2026-09-05
- 范围：`Version`、npm/.NET 依赖、SDK/IDE 生成结果和构建产物

## 决策

1. 根目录 `Version` 是唯一人工维护的版本来源；`package.json`、`package-lock.json` 根条目由同步流程更新，并由 `check:version` 校验。
2. `npm run check:dependency-matrix` 读取 npm manifest/lockfile 和三个 .NET 宿主项目，阻断结构性缺失与同项目耦合包不一致；跨宿主漂移先报告，不自动统一版本。
3. OpenVR C# 绑定、WinForms Designer、原生 OpenVR 二进制、许可清单和 Installer 版本注入文件按 [`GENERATED_FILE_POLICY.md`](../GENERATED_FILE_POLICY.md) 维护；业务重构不逐行修改生成结果。
4. 依赖升级、生成工具升级和生成结果刷新必须拆成独立提交，并分别验证受影响宿主、构建和许可证输出。

## 理由

版本矩阵的价值是提供 `Locality` 和可追踪性，而不是强行消除平台差异。SQLite、NLog、System.Management 和 NodeApi 的既有漂移可能包含平台/兼容约束，未经验证统一会扩大变更面。
