# VR 手背交互说明

> 状态：Implemented（2026-09-06）

本文记录 VR 手背 Overlay 的输入契约，作为 CEF、Electron 和 Vue 端后续扩展功能的共同基线。

## 交互模型

- 手背 Overlay 仍由现有 `overlayHand` 设置决定：`1` 为左手，`2` 为右手，`0` 保持自动选择。
- 指针使用另一只手柄的射线：左手手背对应右手柄，右手手背对应左手柄。
- 射线优先采用 OpenVR 渲染模型的 `trigger` 组件：起点和局部 `-Z` 方向与实际扳机的位置、朝向一致，再通过 `ComputeOverlayIntersection` 求出手背 Overlay 上的 UV 坐标。
- 若运行时或控制器模型不提供 `trigger` 组件，则回退到 SteamVR 的 `tip` 组件；组件射线未命中手背 Overlay 时，再回退到控制器整体的局部 `-Z` 射线，保证不同控制器模型仍可使用。
- 腕部 Overlay 的鼠标缩放固定为 `512×512`，`ComputeOverlayIntersection` 返回的像素坐标先按该范围归一化，再将 OpenVR 的左下角原点转换为 DOM 的左上角坐标；Vue 端最终将其限制到 `0..1`，以百分比移动实心原点标记。
- 扳机只在“未按下 → 按下”的边沿产生一次点击，松开后才允许下一次点击，避免长按重复触发。

## 页面布局

当前沿用正式版手背布局：好友动态、VR 设备状态和底部运行状态按原有顺序同时显示，不额外加入页面切换条。实心原点和点击桥接作为独立的交互层叠加在页面之上，默认不可见，因此不会改变正式版的视觉结构。

如果后续重新引入页面切换，页签和普通鼠标应共用同一个 DOM 事件路径；可点击元素必须显式声明 `data-vr-action`，指针点击桥只派发到白名单元素，避免误触页面其他节点。

## 桌面调试模拟（无需 VR）

为便于在没有头显或 SteamVR 的情况下验证手背指针，`vr.html` 支持显式调试参数：

```text
vr.html?wrist-pointer-test=1
```

在该页面中，鼠标移动会映射为手背上的扳机指针，离开手背区域会隐藏指针，按下鼠标会显示按压状态，点击会触发带 `data-vr-action` 控件的扳机操作。命中白名单控件时会阻止浏览器原生点击再执行一次，避免页面切换重复触发；普通内容仍保留原生行为。

挂载时会通过正式版同名的 `$vr.configUpdate`、`$vr.wristFeedUpdate`、`$vr.lastLocationUpdate` 和 `$vr.updateOnlineFriendCount` 入口注入一组确定性的演示快照，同时提供头显、左右手柄和基站状态。这样桌面画面使用的仍是正式 VR 模板、尺寸和数据入口，不会再因为没有 CEF/OpenVR 推送而显示空壳；快照仅用于布局和交互验证，不代表实时账户数据。

调试模式注入的是只读的 `AppApiVr` 安全替身，不访问 CEF、Electron、OpenVR 或真实配置数据库。未携带该参数时不会安装任何鼠标监听，也不会绕过原有宿主绑定，因此正式版布局和交互保持不变。

可用本地静态预览验证：先执行 `npm run prod`，再运行 `npx vite preview src --host 127.0.0.1 --port 9001`，打开 `http://127.0.0.1:9001/vr.html?wrist-pointer-test=1`。该预览只验证 Vue 页面、原点移动和页面按钮，不代表 SteamVR 姿态、Overlay 尺寸或 C# 射线已经通过硬件验证。

## 双宿主数据流

```text
OpenVR poses + trigger
        │ 16 ms
        ▼
CEF: ExecuteScriptAsync        Electron: latest-state queue
        │                                │ 16 ms
        └──────────────► Vr.vue ◄────────┘
                         │
              normalize → marker / click dispatch
```

CEF 直接执行渲染器脚本；Electron 使用独立的最新状态队列，避免被原有 500ms .NET 命令队列拖慢。原有 VR 状态轮询和公共 `SetVR` 接口未改变。

## 扩展约定

1. 若新增手背页面切换，在 `WristPageTabs.vue` 注册唯一 `id`、图标和无障碍标签，并在 `Vr.vue` 增加对应面板；默认布局不应被改变。
2. 页面内需要扳机操作的控件声明 `data-vr-action`；不应在 pointer bridge 中增加页面/业务判断。
3. 保持指针 payload 的字段：`x`、`y`、`visible`、`pressed`、`hand`。坐标范围和点击边沿由桥接层统一处理。
4. 修改 C# bridge capability 时同步更新 `src-electron/dotnetCapabilityManifest.cjs` 与对应测试。

## 当前验证与限制

- Vue 定向测试、JavaScript 类型检查、CEF/Electron C# 构建均已通过；指针数学契约有独立 xUnit 测试。
- `trigger` 组件来自当前控制器的渲染模型，因此起点和方向会随手柄型号自动匹配；仍需要在实际 SteamVR 设备上确认不同控制器型号的射线方向、Overlay 尺寸和扳机阈值，这属于硬件验证，不在单元测试可覆盖范围内。
- 若手背不显示，先确认 VR Overlay 已启用且 `overlayHand` 与期望承载手一致；指针只有在 Overlay 可见并检测到有效姿态时才显示。
