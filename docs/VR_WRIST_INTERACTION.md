# VR 手背交互说明

> 状态：Implemented（2026-09-06）

本文记录 VR 手背 Overlay 的输入契约，作为 CEF、Electron 和 Vue 端后续扩展功能的共同基线。

## 交互模型

- 手背 Overlay 仍由现有 `overlayHand` 设置决定：`1` 为左手，`2` 为右手，`0` 保持自动选择。
- 指针使用另一只手柄的射线：左手手背对应右手柄，右手手背对应左手柄。
- 射线优先采用 OpenVR 渲染模型的 `trigger` 组件：起点和局部 `-Z` 方向与实际扳机的位置、朝向一致，再通过 `ComputeOverlayIntersection` 求出手背 Overlay 上的 UV 坐标。
- 若运行时或控制器模型不提供 `trigger` 组件，则回退到 SteamVR 的 `tip` 组件；两者都不可用时再回退到控制器整体的局部 `-Z` 射线，保证旧设备仍可使用。
- 腕部 Overlay 的鼠标缩放固定为 `512×512`，`ComputeOverlayIntersection` 返回的像素坐标先按该范围归一化，再将 OpenVR 的左下角原点转换为 DOM 的左上角坐标；Vue 端最终将其限制到 `0..1`，以百分比移动实心原点标记。
- 扳机只在“未按下 → 按下”的边沿产生一次点击，松开后才允许下一次点击，避免长按重复触发。

## 页面切换

手背顶部提供三个紧凑图标页签：

| 页面 | 标识 | 内容 |
|---|---|---|
| 动态 | `wrist-page-feed` | 好友动态/当前 Feed |
| 设备 | `wrist-page-devices` | VR 设备与追踪器状态 |
| 状态 | `wrist-page-status` | 播放、连接和运行状态 |

页签和普通鼠标共用同一个 DOM 事件路径。可点击元素必须显式声明 `data-vr-action`，指针点击桥只会派发到该白名单元素，避免误触页面其他节点。

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
                         │
                    page tab actions
```

CEF 直接执行渲染器脚本；Electron 使用独立的最新状态队列，避免被原有 500ms .NET 命令队列拖慢。原有 VR 状态轮询和公共 `SetVR` 接口未改变。

## 扩展约定

1. 新增手背页面时，在 `WristPageTabs.vue` 注册唯一 `id`、图标和无障碍标签，并在 `Vr.vue` 增加对应 `v-show` 面板。
2. 页面内需要扳机操作的控件声明 `data-vr-action`；不应在 pointer bridge 中增加页面/业务判断。
3. 保持指针 payload 的字段：`x`、`y`、`visible`、`pressed`、`hand`。坐标范围和点击边沿由桥接层统一处理。
4. 修改 C# bridge capability 时同步更新 `src-electron/dotnetCapabilityManifest.cjs` 与对应测试。

## 当前验证与限制

- Vue 定向测试、JavaScript 类型检查、CEF/Electron C# 构建均已通过；指针数学契约有独立 xUnit 测试。
- `trigger` 组件来自当前控制器的渲染模型，因此起点和方向会随手柄型号自动匹配；仍需要在实际 SteamVR 设备上确认不同控制器型号的射线方向、Overlay 尺寸和扳机阈值，这属于硬件验证，不在单元测试可覆盖范围内。
- 若手背不显示，先确认 VR Overlay 已启用且 `overlayHand` 与期望承载手一致；指针只有在 Overlay 可见并检测到有效姿态时才显示。
