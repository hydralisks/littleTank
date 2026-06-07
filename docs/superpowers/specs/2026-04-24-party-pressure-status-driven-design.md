# Party Pressure Status-Driven Design

## Goal

把“队伍压力”从目前分散在敌人技能结算、被动修正值、个别技能分支中的逻辑，收敛成一套更清晰的规则：

- 关卡通过 `关卡开场.partyPressure` 定义开场队伍压力
- 敌人技能继续通过 `pressureOnHit / pressureOnMiss` 影响压力
- 玩家技能、玩家天赋、关卡词缀、特殊规则如果想持续影响压力，优先通过“给队伍施加状态”来实现
- 这些队伍状态通过统一的状态效果注册表执行逻辑，并支持：
  - 固定间隔触发
  - 事件触发

本轮重点不是重做整个状态系统，而是先把“队伍压力”这条内容链路做实，并为后续更多队伍状态效果预留稳定入口。

## Context

当前项目里和队伍压力相关的入口已经存在，但逻辑分散：

- `encounter_balance.xlsx -> 关卡开场.partyHp / partyPressure`
  - 已接入运行时，决定开场队伍生命值与开场队伍压力
- 敌人技能表已有：
  - `pressureOnHit`
  - `pressureOnMiss`
- 当前天赋系统里仍有：
  - `partyPressureDriftPerSecond`
  - `partyHpDriftPerSecond`
- 当前个别玩家技能已直接修改：
  - `party.pressure`
- `party.statuses` 已存在，UI 也已显示队伍状态，但状态本身还没有统一的“按间隔 / 按事件生效”运行时逻辑

因此本轮不是缺字段，而是缺一条统一的“队伍状态驱动压力变化”的运行时执行通道。

## User-Confirmed Scope

用户已明确确认：

- 当前 `关卡开场.partyHp / partyPressure` 字段保持不变
- 不需要新增专门的压力字段
- 大多数敌方技能的 `pressureOnHit` 应默认为 `0`
- `pressureOnHit` 仍保留，供少数特殊技能扩展使用
- “每秒自动降低队伍压力”的天赋应改成：
  - 开战时在 `队伍状态` 中添加一个状态
  - 该状态按秒触发效果
- 其他玩家技能、玩家天赋、敌方技能、词缀、特殊规则若要影响队伍压力，也优先通过“技能触发事件”或“状态触发事件”生效
- 队伍状态逻辑需要同时支持：
  - 固定间隔触发
  - 事件触发

## Approaches Considered

### A. 队伍状态效果注册表

- 只给 `party.statuses` 增加统一效果注册表
- 先把压力链路收敛到状态逻辑层
- 玩家 / 敌人其它状态以后再继续迁移

优点：

- 改动范围可控
- 最符合“状态驱动压力变化”的设计目标
- 能快速验证 interval + event 两类触发

缺点：

- 需要新增一层状态运行时
- 需要把现有部分天赋逻辑迁移出去

### B. 保留修正值体系，只新增若干事件分支

- 继续保留 `partyPressureDriftPerSecond`
- 同时增加少量事件驱动分支

优点：

- 实现很快

缺点：

- 逻辑会继续分散
- 与用户确认的“状态化”方向冲突

### C. 一次性统一所有状态

- 把玩家 / 队伍 / 敌人全部状态都接到同一套脚本系统

优点：

- 长期最统一

缺点：

- 这一步过重
- 范围明显超出当前需求

## Recommended Approach

采用 **方案 A：队伍状态效果注册表**。

理由：

- 当前最需要落地的是“队伍压力应由明确事件和队伍状态驱动”
- `party.statuses` 已经存在，UI 也能显示，天然适合作为承载层
- 只先改队伍状态，能避免一次把整套战斗状态系统推翻
- 等这条链稳定后，再决定是否把玩家 / 敌人其它状态也迁过来

## Scope

### In Scope

- 保持现有开场压力字段与敌方技能压力字段不变
- 为 `party.statuses` 新增统一的状态效果注册表
- 支持两类队伍状态触发：
  - 固定间隔触发
  - 事件触发
- 将“持续改队伍压力”的被动天赋迁移成“开战施加队伍状态”
- 为玩家技能 / 天赋 / 词缀 / 特殊规则留出通过队伍状态影响压力的正式入口
- 为第一轮样例效果补测试、文档与更新日志

### Out Of Scope

- 一次性迁移玩家 / 敌人全部状态逻辑
- 重做现有玩家技能表结构
- 新增通用脚本解释器
- 给所有状态类型都做统一 runtime
- 大规模重构 UI

## Design

### 1. 数据层保持稳定

本轮不改以下数据结构：

- `encounter_balance.xlsx -> 关卡开场.partyHp`
- `encounter_balance.xlsx -> 关卡开场.partyPressure`
- 敌人技能：
  - `pressureOnHit`
  - `pressureOnMiss`

规则约定调整为：

- 常规敌方伤害技能应默认：
  - `pressureOnHit = 0`
- 常规“未打到玩家 / 打到队伍 / OT”场景主要通过：
  - `pressureOnMiss`
- 特殊技能可继续使用：
  - `pressureOnHit > 0`

这能满足当前设计，而不需要重构敌人表。

### 2. 队伍状态效果注册表

新增独立模块，例如：

- `src/game/encounter/partyStatusEffectRegistry.ts`

职责：

- 维护 `effectLogicId -> handler` 映射
- 只处理 `party.statuses`
- 提供固定间隔与事件两类触发入口

本轮不把 Excel 脚本化。策划仍只在状态定义里写：

- `effectLogicId`

程序通过注册表找到对应逻辑。

### 3. 状态运行时

当前 `StatusEffect` 主要只有展示与倒计时字段，还缺少状态自己的轻量运行时。

本轮建议给队伍状态新增一份独立 runtime 容器，而不是直接污染策划表字段。

建议形态：

- `EncounterRuntime.partyStatusRuntime`
- 键为：
  - `status.id`
- 值为：
  - `initialized`
  - `intervalElapsedMs`
  - 其它后续需要的轻量临时值

目的：

- 让状态显示数据与状态运行时临时数据分离
- 避免把“计时器累计值”写回状态定义本身

### 4. 两类触发

#### 4.1 固定间隔触发

适用于：

- 每 1 秒降低压力
- 每 2 秒恢复队伍生命
- 每 5 秒触发一次轻微惩罚

运行方式：

- 每个 tick 推进 `intervalElapsedMs`
- 满足触发阈值时执行 handler
- 之后回退或重置 interval 计时

#### 4.2 事件触发

适用于：

- 玩家释放某技能后降低队伍压力
- 敌人某类技能完成后提高队伍压力
- 某状态结束时追加一次压力变化

本轮只接最小事件面：

- `player_skill_resolved`
- `enemy_cast_completed`
- `status_applied`
- `status_expired`

如果后续要扩更多事件，再继续加。

事件来源约定：

- 本轮不新增第二套“压力专用事件”
- 事件触发型队伍状态直接消费本 tick 已完成结算并写入 `lastProcessedEvents` 的真实运行时事件

理由：

- 与当前命令队列 + 事件队列架构最一致
- 改动最小
- 能避免同一行为同时维护两套事件语义

### 5. 统一压力改动入口

建议增加统一 helper，例如：

- `applyPartyPressureDelta(state, delta, reason?)`

职责：

- 统一做 clamp
- 统一维护：
  - `0 <= pressure <= maxPressure`
- 为后续事件日志、调试信息、伤害来源说明留口

本轮所有新的状态逻辑都走这条 helper。

### 6. 旧天赋逻辑迁移原则

当前天赋修正值里有：

- `partyPressureDriftPerSecond`
- `partyHpDriftPerSecond`
- `periodicPlayerStunIntervalMs`
- `periodicPlayerStunDurationMs`

本轮只迁移“与队伍压力直接相关”的部分：

- `partyPressureDriftPerSecond`
  - 改为“开战施加一个队伍状态”
- 若该天赋还附带玩家定时眩晕
  - 同样改为对应状态或保留最小兼容逻辑，但目标是后续也迁到状态事件链路

本轮可暂时保留：

- `partyMaxPressureBonus`
- `partyMaxHpMultiplier`
- `partyHpDriftPerSecond`

原因：

- 它们不一定都应当立即状态化
- 先集中把“压力变化来源”收敛

### 7. 第一轮样例

第一轮建议至少落 4 个样例：

#### 7.1 `steady_relief`

- 类型：队伍状态
- 触发：每 `1000ms`
- 效果：降低队伍压力

用途：

- 替代“压力每秒自动下降”的天赋修正值

#### 7.2 `control_backlash`

- 类型：队伍状态
- 触发：每 `1000ms`
- 条件：玩家处于控制状态时生效
- 效果：提高队伍压力

用途：

- 替代目前类似“玩家被控时压力上升”的分散规则

#### 7.3 `skill_relief_on_use`

- 类型：队伍状态
- 触发：事件
- 条件：玩家释放指定技能后
- 效果：降低队伍压力

用途：

- 验证“事件触发型状态”可用

#### 7.4 `battlefield_panic`

- 类型：队伍状态
- 触发：事件
- 条件：敌人某类技能完成后
- 效果：提高队伍压力

用途：

- 验证敌方行为可以通过事件驱动队伍状态

## Runtime Flow

建议本轮的战斗 tick 顺序保持尽量小改：

1. 正常处理命令队列与事件队列
2. 推进玩家 / 队伍 / 敌人原有状态倒计时
3. 处理队伍状态 runtime 初始化
4. 执行队伍状态的 interval 触发
5. 将本 tick 已产生的关键事件喂给队伍状态的 event 触发
6. 统一 finalize

这样不会要求整套战斗事件系统大改，只是在现有命令队列 + 事件队列模型之上挂一层队伍状态消费逻辑。  
事件输入来源统一为当前 tick 的 `lastProcessedEvents`。

## Testing

本轮测试应覆盖：

1. `关卡开场.partyPressure` 仍正确决定开场压力
2. 常规敌人技能在 `pressureOnHit = 0` 时，打到玩家不额外提高压力
3. 敌人技能在 `pressureOnMiss > 0` 时，未打到玩家仍正确提高压力
4. 队伍状态 interval 每 `1000ms` 触发一次压力变化
5. 队伍状态 event 能在指定事件发生时触发
6. 天赋施加的队伍状态会显示在 `队伍状态` 面板中
7. 压力上下限 clamp 正常
8. 状态结束后不再继续触发

## Documentation Impact

本轮需要同步更新：

- `STAGE_DATA_INTERFACE_SPEC.md`
- `关卡设计入口.md`
- `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- `DEVELOPMENT_HANDOFF.md`
- `开发更新日志.md`

说明重点：

- 关卡开场压力字段不变
- 敌人技能压力字段不变
- 影响队伍压力的天赋 / 技能 / 状态开始逐步走“队伍状态 + effectLogicId”模式

## Risks

### 1. 状态与 runtime 同步问题

若状态被移除但 runtime 没清掉，可能出现幽灵触发。

应对：

- 每次 tick 后清理不存在于 `party.statuses` 中的 runtime entry

### 2. 事件重复消费

若状态逻辑反复消费同一事件，可能导致一帧内重复加减压力。

应对：

- 只消费本 tick 新产生的事件
- 保持事件列表是只读输入

### 3. 范围扩张

若本轮顺手把玩家 / 敌人全部状态都迁移，会把任务做大。

应对：

- 本轮只对 `party.statuses` 做正式逻辑接线

## Rollout Plan

推荐实现顺序：

1. 增加队伍状态效果注册表与 runtime 容器
2. 接入 interval 触发
3. 接入最小 event 触发
4. 增加统一压力变更 helper
5. 迁移 1~2 个现有天赋样例
6. 补测试
7. 更新文档与策划说明

## Acceptance Criteria

以下条件全部满足，才算本轮完成：

1. 开场队伍压力仍由 `关卡开场.partyPressure` 读取
2. 常规敌人技能可以通过 `pressureOnMiss` 驱动压力，而大多数技能 `pressureOnHit = 0`
3. 至少一个队伍状态能按固定间隔修改压力
4. 至少一个队伍状态能按事件触发修改压力
5. 至少一个天赋改为“开战施加队伍状态”的方式影响压力
6. 队伍状态 UI 能正确显示对应状态
7. 测试覆盖 interval / event / clamp / 状态结束等关键行为
