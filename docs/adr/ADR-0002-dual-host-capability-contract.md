# ADR-0002：CEF/Electron 双宿主共用 Capability 契约

- 状态：Accepted
- 日期：2026-09-05
- 范围：Renderer → preload/IPC/InteropApi → CEF 或 Electron/.NET

## 背景

同一个 Renderer Interface 在 Windows CEF 和 Electron 中由不同实现完成。历史动态 bridge 缺少统一 allowlist、参数 envelope 和来源判断，容易把宿主能力边界变成隐式全局对象。

## 决策

1. `src-electron/dotnetCapabilityManifest.cjs` 是 class/method allowlist 和参数 schema 的共享契约；preload、main handler、`InteropApi` 在宿主调用前复用它。
2. Electron IPC handler 统一使用 `rendererSourcePolicy.cjs`；packaged 页面和开发服务器页面的可信来源显式列出，非信任 document 在进入 handler 前拒绝。
3. Renderer 继续保留动态 facade 以维持兼容 Interface；安全校验不通过 facade 绕过，也不改变 CEF 绑定路径。
4. 新增 capability 必须同时补 manifest、来源/参数测试以及对应 CEF/Electron adapter；不能只在某一宿主加入隐式方法。

## 结果

- 双宿主能力差异集中在 Adapter 和契约 Module，调用方获得稳定 Interface。
- 未知方法、错误参数和非信任来源在宿主边界前失败；既有合法调用的返回、错误和取消语义保持不变。
- 未来拆分 `main.js` 或迁移 capability 时，以 manifest 和测试作为回归基线。
