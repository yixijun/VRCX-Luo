# ADR-0001：通过兼容入口和 Adapter 渐进式深化 Module

- 状态：Accepted
- 日期：2026-09-05
- 范围：Renderer 的 Store、Coordinator、Query 和 capability integration

## 背景

遗留代码中一个 Module 往往同时拥有状态、API/数据库 I/O、宿主调用和 UI 副作用。直接改掉旧入口会让页面和跨宿主路径同时失去可回滚点；只增加转发层又不会带来真正的 `Depth`。

## 决策

1. 保留现有公开入口和兼容 facade；新实现通过显式依赖、纯 Projection 或 Adapter 接入。
2. 先建立可测试的 `Seam`，再逐步把行为移到更深的 Module；调用方只依赖小 Interface。
3. Coordinator 负责事件编排和副作用顺序，DOM/Toast/Router/Noty/宿主能力由 Adapter 提供；Store 负责状态，不成为 API 和数据库的唯一汇聚点。
4. 每个切片只做一个逻辑变更，先验证受影响 Interface，再创建独立本地提交。

## 结果

- 旧组件无需同步迁移，降低回滚和运行时行为漂移风险。
- 纯 Projection/决策 Module 可以通过公开 Interface 测试；多个 Adapter 证明 Seam 是真实可替换点。
- 迁移完成前会保留少量 facade；它们必须只负责组装默认 Adapter，不能重新吸收业务实现。

## 不在本 ADR 内

本决策不授权修改任务周期、序列化格式、并发模型或多账户会话隔离；这些变化需要单独的 ADR/计划切片。
