# VRCX-Luo 文档中心

这里是项目文档的统一入口。除根目录 `README.md`（用于 GitHub/发布页展示的入口）外，项目的详细说明、设计记录、数据模型和开发诊断均集中在本目录。

## 项目与架构

- [架构诊断报告](./ARCHITECTURE_DIAGNOSIS.md)：当前模块职责、跨层耦合、上帝模块、依赖图和低风险重构顺序。
- [重构执行计划](./REFACTOR_PLAN.md)：按 Blocker / Major / Minor 划分的任务、当前状态和逐切片回滚协议。
- [Luo 改动清单](./JIRAI_FEATURES.md)：相对于上游的功能和改动记录。
- [多账号 V4 详细设计草案](./MULTI_ACCOUNT_V4_DETAIL_DESIGN.md)：账号会话、数据库前缀、WebSocket 和聚合视图设计。

## 数据与运行机制

- [数据刷新机制](./DATA_REFRESH.md)：日志、WebSocket、轮询和好友同步的数据刷新链路。
- [数据库架构预览](./DATABASE_SCHEMA.md)：核心表和关系说明。
- [数据库模型文件](./vrcx_erd.dbml)、[ER 图 Mermaid](./vrcx_erd.mmd)、[MCD/DDL 文件](./vrcx_mcd_ddl.sql)。
- MCD/SR 图形文件：`vrcx_mcd.*`、`vrcx_sr.*` 及对应的 `.svg`、`.json`、`.md`、`.gv` 文件。

## 开发、测试与故障记录

- [Windows CEF 本地测试与安全重启](./CEF_LOCAL_TESTING.md)
- [测试与契约基线](./TEST_BASELINE.md)
- [Bio Diff 英文标点问题记录](./BIO_DIFF_ENGLISH_PUNCTUATION_BUG.md)
- [截图元数据 JSON Schema](./schemas/screenshotMetadata-schema.json)
- [第三方 Dotnet 库来源](./third-party-libs.md)
- [第三方依赖版本矩阵](./DEPENDENCY_VERSION_MATRIX.md)
- [生成文件与第三方二进制治理](./GENERATED_FILE_POLICY.md)
- 多语言 README：[`README-translations/`](./README-translations/)

## 文档约定

1. 新增项目文档统一放在 `docs/` 或其明确的子目录中。
2. 文档内引用源码时使用仓库相对路径，引用其他文档时使用相对链接。
3. 架构决策应在文档标题中标注状态（Draft/Accepted/Deprecated）和更新时间。
4. 易变的文件行数、构建产物和依赖清单尽量由脚本生成，不作为手工维护的架构事实。
5. `build/`、依赖目录和第三方生成文件不纳入项目文档中心。
