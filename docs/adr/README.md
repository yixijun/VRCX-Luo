# Architecture Decision Records

这里记录已经接受、延期或明确不在当前范围内的架构决策。新重构先阅读本目录和根目录 [`CONTEXT.md`](../../CONTEXT.md)；如果实现与决策冲突，应先新增/更新 ADR，再修改代码。

| ADR | 状态 | 主题 |
|---|---|---|
| [ADR-0001](./ADR-0001-compatibility-seams.md) | Accepted | 兼容入口、Seam 与 Adapter 的渐进式重构 |
| [ADR-0002](./ADR-0002-dual-host-capability-contract.md) | Accepted | CEF/Electron 双宿主 capability 契约与来源安全 |
| [ADR-0003](./ADR-0003-version-and-generated-artifacts.md) | Accepted | 版本来源、依赖矩阵与生成文件治理 |
| [ADR-0004](./ADR-0004-multi-account-deferred.md) | Deferred | 多账户会话与聚合实现暂缓 |
