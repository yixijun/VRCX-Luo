<div align="center">

# <img src="./images/VRCX.png" width="64" height="64"> VRCX - 地雷Edition

[![GitHub Workflow Status](https://github.com/FuLuTang/VRCX-jirai/actions/workflows/github_actions.yml/badge.svg)](https://github.com/FuLuTang/VRCX-jirai/actions/workflows/github_actions.yml)

</div>

这是 [VRCX](https://github.com/vrcx-team/VRCX) 的魔改分支，旨在优化体验，修复漏洞，补全功能。

## 此版本不再维护
> 上游 VRCX 主要开发者已不再维护，且部分开发者对此项目表示反对，会影响社区环境。个人原因对正在计划开发的新功能感到力不从心，因此决定不再继续维护此项目。

| 目标平台 | 下载链接 / 安装说明 |
| :--- | :--- |
| **Windows** | [最新发布版本 (Releases)](https://github.com/FuLuTang/VRCX-jirai/releases/latest) |
| 💡 **避坑指路** | **若启动后看不到新功能**，请在侧边栏 `右键 - 自定义导航栏 - 恢复默认` |
| **MacOS / Linux** | 需要手动构建，请参考下文 [从源码构建](#从源码构建) |

<div align="center">

> 抵制不良关系，拒绝盲目地雷。<br>注意自我保护，谨防受骗上当。<br>适度视奸益脑，沉迷VRC伤身。<br>合理安排关系，享受健康生活。

</div>

> 叠甲：`功能仅供娱乐，勿用非法用途!`<br>本分支仅添加了更多的“数据展示”的功能。
所有的功能都是基于 VRCX 的原版数据库和原版接口API，没有实现任何有关“不该获取到的信息”。
所有抓取到的信息都是**公开**的，**不存在任何盗取隐私**的行为。
<br>如果你认为有任何不妥之处（如某类信息不该被获取），请向 `VRCX` 官方反馈，而不是向我。
而`VRCX`官方不同意此分支的意图与初衷。
<br>`VRCX-jirai`的使用者会自动加入`VRCX-jirai`的Home Group，理由为：**被视奸者亦有知情权**。这给了普通玩家（即使他们不使用此分支）通过Group成员列表发现自己可能正在被视奸的权利，从而自由选择隐私策略（如开🟡黄灯）。

> 开 🟡黄灯🔴红灯 即可直接使本软件核心功能失效

# 核心功能

<div align="left">

- :couple: **共同实例查询 (TwoPersonRelationship)**
    - 从你的好友列表中任选两人，一键查询他们**共同在一个房间待过的所有记录**。
    - **极限细节**：不仅记录共存时间，还能看到当时“房主是谁”、“最高达到过多少人数”。
    - **双向奔赴识别**：独家时延算法！自动计算两人进入房间的先后逻辑。如果两人在 3 分钟内（防抖时间）先后进入同一个房间，会标记为“**双向奔赴**”（即：约好了一起进房）；否则会清晰展示谁是先到的。
    - **你当时在场吗**：支持一键切换“自己是否在场”，帮你回忆那些你也在场的修罗场（或不在场时他们背着你干了什么）。


- :spider_web: **好友关系网增强 (Mutual Friend Graph)**
    - **手动好友关系管理**：有些地雷人为了保护隐私关了“发现共同好友”，导致他们在关系网里看起来没连线。你可以手动给两人“强制连线”，纯本地显示，满足强迫症并理清复杂的圈子关系。
    - **追踪非好友显示**：可以将你手动追踪的非好友（或开了“发现共同好友”的陌生人）也加入到关系网中，完整还原你的社交宇宙。


- :detective: **个人简介Diff视图 (Bio Diff View)**
    - 去掉了原版干巴巴的简介历史，新增了一个类似 `Git Diff` 的界面。
    - 朋友改了简介，**红字**代表删掉的话，**绿字**代表加进来的话。偷偷升级了配置，或暗戳戳加了谁的名字，一眼定真！
    - **24小时智能合并**：一天之内哪怕改了 10 次简介，也会自动合并成一条精简的差异记录。不再满屏垃圾信息。

- :hourglass_flowing_sand: **交流密度时间轴 (Relationship Timeline)**
    - 以时间流的形式，直观地列出你的时间分配都花在谁身上了。
    - 或者，发现你“最熟悉的陌生人”。

- :bar_chart: **个人简介——灯色分布图 (Status Distribution)**
    - 在个人及好友信息面板中新增分布图表，直观展示用户**在线期间**各种灯色（绿/蓝/黄/红）的时间占比。
    - **纯净时长算法**：彻底重构了统计逻辑，**自动排除所有离线（Offline）时间**。通过将灯色记录与上下线历史进行交集计算，仅统计在特定灯色下**实际在线**的持续时长，从而提供最真实的社交状态画像。
    - **自我状态记录**：现在点击自己主页也能查看分布图。软件已解锁对自己上下线与状态变更的自动追踪，算法会自动识别“离线行为”（如在网页端修改灯色）并进行逻辑修正，确保比例不被离线时间稀释。

- :detective: **非好友追踪功能**
    - 在主页“好友”列 旁边新增“追踪非好友”列。
    - 被追踪的非好友，将也可在“好友动态”中留下log。log信息仅包括：
        - 修改个人简介
        - 状态（灯色）变更
    - 可通过直接输入玩家UID，或点进任意玩家的个人主页，在“···”中点击“追踪”按钮来追踪非好友。

- ~~:footprints: **自动跟随 (Auto Follow)**~~*（暂未实现，且不再计划）*
    - 在好友的个人信息卡片上，新增了一个“一键跟随”按钮。
    - 点击后，软件会自动检测该好友当前所在的实例类型：
        - 如果是**公共实例**，软件会直接尝试启动游戏并加入该实例。
        - 如果是**好友+实例**或**私密实例**，软件会先尝试直接打开实例链接；如果失败（例如游戏未运行或实例已关闭），则会自动退出当前游戏，并以**“带参数启动”**的方式重新运行游戏，从而加入该实例。
    - 完美解决“想AFK，但是又想~~视奸~~跟着好友”的繁琐步骤。
    `PC状态下为重新启动游戏加入实例，VR状态下为直接打开实例链接`

</div>

# 原版体验优化

- :mag: **搜索功能增强 (Quick Search)**
    - 在右侧的快捷搜索下拉列表中，额外展示了 "最近遇到的人" 和 "最近加入的世界"。
    - 当你模糊搜索某个词时，即便他不是你的好友，只要你们最近在同一个房待过，他就会出现在列表中。
    - **即时检索**：输入任意一个字符即刻开始搜索，无需等待。
    - **个人简介(Bio)检索**：不仅搜名字、备注、Note，还能搜到个人简介(Bio)（包括历史记录）。


- :pencil2: **数据抓取与持久化补全 (Persistence Enhanced)**
    - **个人简介存档**：批量拉取并保存所有好友当前的个人简介，适合新设备/重新登录使用时一键存档，配合 Bio Diff 功能使用。
    - **自我数据闭环**：现在也会记录自己的位置移动、头像更换、灯色切换及上下线历史。让你在“个人主页”也能像查看好友一样，查阅自己完整的 VRC 社交生涯数据。
    - **启动自动补全**：启动或断网重连后，会自动触发一次全量抓取，确保持久化数据的连贯性。

- :stopwatch: **状态持续时间 计时器优化**
    - 原版 VRCX 在重启后，会把好友"在这个房间停留了多久"的计时器归零。现在只要好友还在原先的实例中，即使重启软件也会从本地日志恢复真实的加入时间戳，让停留时长显示更加准确。

- :arrows_counterclockwise: **与原版 VRCX 同步**
    - 持续跟进上游 `vrcx-team/VRCX` 更新，比如原版最新的 Electron 40 内核、原版新增的好友热力图等，用着魔改版也能享受最新功能。

# 开发者文档
- [数据库架构预览 (DATABASE_SCHEMA.md)](./docs/DATABASE_SCHEMA.md)
- [数据刷新机制说明 (DATA_REFRESH.md)](./docs/DATA_REFRESH.md)

# 从源码构建

请参考上游仓库的 [Building from source](https://github.com/vrcx-team/VRCX/wiki/Building-from-source) 说明进行构建。

---

> VRCX-jirai Edition is not endorsed by VRChat and does not reflect the views or opinions of VRChat or anyone officially involved in producing or managing VRChat properties. VRChat and all associated properties are trademarks or registered trademarks of VRChat Inc. VRChat © VRChat Inc.

## Star History

[![Star History Chart](https://api.star-history.com/image?repos=FuLuTang/VRCX-jirai&type=date&legend=top-left)](https://www.star-history.com/?repos=FuLuTang%2FVRCX-jirai&type=date&legend=top-left)
