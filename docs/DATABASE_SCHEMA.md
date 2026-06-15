# VRCX-Luo 数据库架构 (Database Schema)

本文档描述了 VRCX-Luo 分支相对于原版 VRCX 的数据库扩展及核心关系。

## 1. 概念模型 (MCD - Conceptual Data Model)

以下模型展示了核心实体及其关联，特别包含了 Luo 版特有的历史追踪表。

```mocodo
:
FRIEND: id [TEXT], display_name [TEXT], trust_level [TEXT]
关联, 11 FRIEND, 11 MUTUAL_GRAPH_META
MUTUAL_GRAPH_META: last_fetched_at [TEXT], opted_out [INTEGER]
:

:
追踪, 11 FRIEND, 11 MUTUAL_GRAPH_FRIENDS_OLD
MUTUAL_GRAPH_FRIENDS_OLD: last_updated [TEXT]
:
:

:
(L_OLD), 1? FRIEND, 1? FRIEND: friend_id, mutual_id, date
:
GAMELOG_JOIN_LEAVE: id [INTEGER], created_at [TEXT], type [TEXT], location [TEXT], time [INTEGER]
记录, 0N FRIEND, 11 GAMELOG_JOIN_LEAVE: user_id
:

:
:
:
发生于, 1N GAMELOG_JOIN_LEAVE, 11 GAMELOG_LOCATION: location
GAMELOG_LOCATION: id [INTEGER], created_at [TEXT], location [TEXT], world_id [TEXT], world_name [TEXT]
```

## 2. 关系架构 (SR - Relational Schema)

### 核心元数据与状态
- **FRIEND** (<u>id</u>, display_name, status, trust_level, friend_number)
- **MUTUAL_GRAPH_META** (<u>#friend_id</u>, last_fetched_at, opted_out)
    - *[New from Upstream]* 记录上游同步元数据，用于处理隐私选项和同步频率优化。

### Luo 特色：历史追踪 (Time Machine)
- **MUTUAL_GRAPH_FRIENDS_OLD** (<u>#friend_id</u>, last_updated)
    - *[Luo Exclusive]* 记录 Luo 版最后一次“深度扫描”该好友共同好友的时间。
- **MUTUAL_GRAPH_LINKS_OLD** (<u>#friend_id</u>, <u>#mutual_id</u>, date)
    - *[Luo Exclusive]* 存储被扫描到的历史关系链接。`date` 字段允许我们在图表中回溯关系建立的时间点。

### 日志与足迹
- **GAMELOG_LOCATION** (<u>id</u>, created_at, <u>location</u>, world_id, world_name, time, group_name)
- **GAMELOG_JOIN_LEAVE** (<u>id</u>, created_at, type, display_name, #location, #user_id, time)
    - 此表通过 `user_id` 与 `FRIEND` 关联（如果玩家在你的好友列表中）。
    - **双人关系查询 (TwoPersonRelationship)** 功能通过为此表建立自连接 (Self-Join) 来计算两个玩家在相同 `location` 下的重叠时间段。

---
*注：表名前缀通常根据当前登录用户 ID 动态生成（例如 `usr_xxxx_friends`）。*
