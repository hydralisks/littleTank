# Command Queue And Event-Driven Encounter Design

## Goal

把当前战斗运行时从“UI 直接改状态 + tick 内部分散结算”收束为一套统一的命令入口与事件驱动结算层，优先解决两类问题：

1. 规则正确性  
   让仇恨、施法/打断/控制、状态持续/结束、死亡清理这些规则有稳定的执行顺序，便于补测试与验证。
2. 多输入竞争  
   让“技能1 -> 切目标 -> 无 GCD 技能2”这类在很短时间内连续发生的有效输入，按严格顺序、基于最新状态处理，不再受到 UI 闭包旧状态影响。

本轮不扩新职业、不扩 build 内容，只重构战斗核心的输入与结算基础设施。

## Context

当前战斗页中，玩家输入会直接调用运行时状态变更函数，例如：

- [`activateSkill`](/C:/codexCode/littleTank/src/game/encounter/encounterFactory.ts:1698)
- [`selectEnemy`](/C:/codexCode/littleTank/src/game/encounter/encounterFactory.ts:1638)
- [`cycleEnemyTarget`](/C:/codexCode/littleTank/src/game/encounter/encounterFactory.ts:1656)

同时，UI 层在 [`EncounterScreen.tsx`](/C:/codexCode/littleTank/src/ui/EncounterScreen.tsx:184) 中会先基于闭包里的 `encounter` 做一次技能可用性预判，再通过 `setEncounter((current) => ...)` 提交真正变更。

这样会导致两个结构性问题：

1. 判定入口不统一  
   UI 和运行时都在判断“这个技能现在能不能放”，容易出现旧状态预判与最新状态不一致。
2. 输入顺序虽部分依赖 React 函数式更新得以维持，但没有被显式建模  
   玩家连续输入时，系统并没有一个统一的“命令串行处理”层，只是碰巧依赖当前实现顺序运行。

如果继续在这个结构上叠加更复杂的敌人机制、词缀、特殊规则与状态逻辑，`encounterFactory.ts` 会进一步膨胀，测试也会越来越难写。

## User-Approved Direction

采用“方案 2 的完整形态”：

- 在事件驱动层之上补齐输入命令层
- UI 不再直接决定某个操作是否合法，而是统一提交命令
- 运行时按顺序消费命令，再派发事件，由各系统订阅处理
- 这轮优先覆盖：
  - 仇恨与目标
  - 施法与打断/控制
  - 状态与死亡清理

## Scope

### In Scope

- 新增命令模型与命令队列
- 新增事件模型与事件队列
- 把玩家输入改为“提交命令”而不是“直接改状态”
- 把技能释放、切目标、暂停层开关统一接入命令入口
- 为仇恨、施法/打断/控制、状态与死亡清理建立事件驱动结算链
- 把 UI 层的旧状态技能预判收敛到运行时统一拒绝反馈
- 为多输入顺序、打断/控制、状态结束、死亡清理补测试

### Out Of Scope

- 不新增职业、技能、天赋与 build 设计内容
- 不实现完整战斗日志面板
- 不实现回放系统
- 不引入完整 ECS 框架
- 不在本轮实现通用 Boss 脚本编辑器
- 不重构地图选关、构筑面板与 Excel 表结构

## Recommended Approach

推荐方案是“命令队列 + 事件队列 + 固定结算阶段”的混合模型，而不是纯事件总线。

原因：

- 纯事件驱动只能整理“发生了什么”，不能单独解决“玩家刚刚连续输入了什么、顺序是什么”。
- 命令队列显式保存输入顺序，能稳定解决旧状态预判和同一小段时间内的多操作竞争问题。
- 事件队列再负责传播技能命中、状态结束、施法被打断、目标死亡等后续连锁结果，既保留扩展性，又避免一步到位重写成过重架构。

## Architecture

运行时新增三层结构：

1. Command  
   表示玩家或系统“打算做什么”。
2. Event  
   表示规则系统“实际发生了什么”。
3. System  
   负责消费命令或事件，并更新状态或派发新事件。

### 1. Command Layer

首批命令类型：

- `ActivateSkill`
- `SelectEnemy`
- `CycleEnemyTarget`
- `OpenPauseOverlay`
- `ClosePauseOverlay`

命令的特点：

- 命令本身不直接改状态
- 命令先进入 `runtime.commandQueue`
- 再由统一的命令处理入口基于最新状态验证
- 验证失败不静默返回，而是产生 `CommandRejected`

### 2. Event Layer

首批事件类型：

- `SkillActivated`
- `CommandRejected`
- `ThreatApplied`
- `DamageApplied`
- `StatusApplied`
- `StatusExpired`
- `CastInterrupted`
- `CastControlled`
- `CastCompleted`
- `EnemyDied`
- `CurrentTargetCleared`
- `EncounterEnded`

事件的职责：

- 描述规则层真实发生的事情
- 为后续系统提供统一订阅点
- 让测试不必只盯最终状态，也能检查关键中间行为是否真的发生

### 3. System Layer

首批系统建议拆成：

- `commandSystem`
- `skillResolutionSystem`
- `statusSystem`
- `castSystem`
- `threatSystem`
- `deathAndOutcomeSystem`

每个系统只处理自己负责的规则：

- `commandSystem`  
  校验命令是否合法，合法则更新最小必要状态并派发对应事件，非法则派发 `CommandRejected`
- `skillResolutionSystem`  
  消费技能相关命令或事件，处理资源、冷却、GCD、技能效果、技能目标
- `statusSystem`  
  推进状态持续时间，处理状态结束、状态添加、状态清理
- `castSystem`  
  推进敌人施法、打断、控制、被反制、重读原技能
- `threatSystem`  
  统一处理伤害/技能/被动威胁带来的仇恨变化和目标展示
- `deathAndOutcomeSystem`  
  处理死亡、当前目标清空、战斗胜负结束

## Encounter Tick Order

本轮规定统一的结算顺序，不允许再在多个入口里隐式交错处理：

1. `flushCommands(state, 0)`  
   先把当前待处理命令清空，不推进时间
2. `advanceTime(state, deltaMs)`  
   再推进时间相关内容
3. `drainEventQueue(state)`  
   在每个阶段中持续派发与消费事件，直到不再产生新事件
4. `finalizeEncounterState(state)`  
   最后统一做死亡清理、胜负判定、UI 投影字段更新

### Why Command Flush Happens Before Time Advance

因为玩家输入是“立即发生”的，不应该无条件等到下一个 `100ms tick` 才被看见。

因此：

- UI 提交命令后，应立即执行一次 `flushCommands(..., 0)`，只消费命令，不推进时间
- 周期性 `tickEncounter(state, 100)` 再继续负责时间推进

这样可以保证：

- 玩家切目标后，下一次紧接着放技能，使用的是新目标
- 不占 GCD 技能不会因为旧状态闭包被错误拒绝

## Runtime Data Model

本轮不推翻整个 `EncounterState`，只在现有结构上做最小增量。

### New Runtime Fields

在 `state.runtime` 中新增：

- `commandQueue: EncounterCommand[]`
- `eventQueue: EncounterEvent[]`
- `lastRejectedCommandMessage: string | null`
- `lastProcessedEvents: EncounterEvent[]`

字段职责：

- `commandQueue`  
  保证输入顺序稳定
- `eventQueue`  
  负责规则传播
- `lastRejectedCommandMessage`  
  给 UI 展示统一的失败原因
- `lastProcessedEvents`  
  用于测试、调试和后续调试面板

### Existing State Kept In Place

以下现有状态继续保留，不在本轮改成完全事件溯源：

- `player`
- `party`
- `enemies`
- `skills`
- `runtime.damageSources`
- 词缀触发器
- 暂停层状态

这意味着本轮重心是“统一状态变更入口”，不是“全面重写持久化模型”。

## Input Model

### UI Contract Changes

UI 不再直接调用：

- `activateSkill(state, skillId)`
- `selectEnemy(state, enemyId)`
- `cycleEnemyTarget(state, direction)`

而是统一调用类似：

- `dispatchEncounterCommand(state, { type: 'ActivateSkill', skillId })`
- `dispatchEncounterCommand(state, { type: 'SelectEnemy', enemyId })`
- `dispatchEncounterCommand(state, { type: 'CycleEnemyTarget', direction })`

### Rejection Handling

UI 不再自己预判技能是否合法。  
失败原因统一由运行时产出：

- `CommandRejected` 事件
- `runtime.lastRejectedCommandMessage`

这样可以避免：

- UI 用旧的 `encounter` 错误地挡掉合法输入
- UI 和运行时给出不同拒绝理由

## Rule Coverage In This Phase

### 1. Threat And Target

本轮接入命令/事件体系的威胁来源：

- 玩家平A
- 玩家技能伤害
- 队伍随机伤害
- 嘲讽类技能
- 被动威胁推进

覆盖目标逻辑：

- `normal`
- `irregular`
- `bloodlust`

要求：

- 所有仇恨变化通过统一入口进入 `threatSystem`
- 目标展示与真实威胁变化顺序保持一致

### 2. Cast And Cast Stop Rules

覆盖规则：

- `interruptOrControl`
- `controlOnly`
- `unstoppable`
- `counteredDurationMs`
- 控制后保留待重读技能
- 技能循环推进

要求：

- 打断成功后进入 `countered`
- 控制成功后不推进技能循环，而是在控制结束后重试原技能
- `unstoppable` 不接受打断和控制

### 3. Status And Death Cleanup

覆盖规则：

- 状态添加
- 状态持续时间推进
- 状态结束事件
- 死亡时状态清理
- 当前目标死亡后的目标清理
- 玩家平A在无目标时停手但保持 ready

要求：

- 状态结束必须显式产生 `StatusExpired`
- 死亡触发的清理与普通状态结束区分开

## Example: Multi-Input Sequence

目标序列：

1. `ActivateSkill(技能1)`
2. `SelectEnemy(敌人B)`
3. `ActivateSkill(技能2)`

要求结果：

- 命令严格按提交顺序处理
- 技能1先消耗资源、设置冷却/GCD、产生效果
- 切目标命令在技能1之后执行
- 技能2在“切完目标后的最新状态”上做验证和结算
- 如果技能2失败，必须产出统一拒绝原因，而不是 UI 静默无响应

## Testing Strategy

本轮必须补以下测试：

### 1. Sequential Input Tests

- `技能1 -> 切目标 -> 技能2`
- 验证技能2使用的是新目标
- 验证资源、冷却、GCD读取的是技能1之后的最新状态

### 2. Old UI State Regression Tests

- 先切目标再立刻放技能
- 不应再出现“请先选择一个敌方目标”的误拒绝

### 3. Cast Stop Tests

- 打断成功后进入 `countered`
- `countered` 结束后进入技能循环下一技能
- 控制成功后状态结束时重读原技能
- `controlOnly` 不能被 interrupt 停止
- `unstoppable` 不可被 interrupt 或 control 停止

### 4. Status Lifecycle Tests

- `stunned` 结束后正确恢复行动
- `taunted` / `mass-taunt` 结束后目标选择恢复正常
- 死亡时移除不该保留的临时状态

### 5. Death And Target Cleanup Tests

- 当前目标死亡时清空 `currentTargetId`
- 玩家平A停手但保持 ready
- 重新选中目标后平A恢复

## Incremental Rollout

推荐按以下顺序实施：

1. 增加 `Command` / `Event` 类型与 runtime 队列
2. 增加统一入口：
   - `enqueueEncounterCommand`
   - `dispatchEncounterCommand`
   - `flushEncounterCommands`
   - `drainEncounterEvents`
3. 先把：
   - `SelectEnemy`
   - `CycleEnemyTarget`
   - `ActivateSkill`
   接入命令层
4. 去掉 UI 旧状态技能预判，统一改读运行时拒绝反馈
5. 把施法/状态/仇恨推进逐步改成事件驱动
6. 补测试，再考虑最小调试视图

## Risks And Mitigations

### Risk 1: `encounterFactory.ts` 继续膨胀

缓解：

- 这轮引入 system 边界时同步抽出小模块
- 不把所有命令和所有事件都继续塞回单文件

### Risk 2: 事件过多导致调试困难

缓解：

- 首批事件只覆盖必要核心链路
- `lastProcessedEvents` 只保留当前 flush/tick 内的最近事件，用于调试和测试，不做长期历史

### Risk 3: 一次重构面太大

缓解：

- 保留现有数据结构
- 先统一入口，再拆内部结算
- 每一步都由回归测试保护

## Success Criteria

达到以下条件，视为本轮完成：

1. UI 层不再直接决定技能可用性
2. 玩家连续输入按命令顺序稳定执行
3. 施法/打断/控制、状态结束、死亡清理有统一事件链
4. 仇恨、施法、状态三块都有覆盖关键场景的自动化测试
5. 不引入新的 build 设计依赖，不阻塞策划继续填表

## Next Phase Reminder

本轮结束后，下一阶段应提醒用户进入“关卡与遭遇系统”方向，继续推进：

- 关卡规则
- 词缀/特殊规则逻辑
- 遭遇编排
- 关卡教程化节奏

