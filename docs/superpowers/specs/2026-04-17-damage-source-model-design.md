# Damage Source Model Design

## Goal

为 littleTank 引入统一的 `damageSource` 模型，用同一套运行时结构结算：

- 玩家平A
- 队伍固定随机伤害
- 玩家技能伤害的仇恨公式
- 未来的队友爆发、转火、停手
- 未来与仇恨系统相关的特殊状态修正

本轮实现需要满足：

- 当前 demo 保留两条默认来源：
  - `player_auto_attack`
  - `party_ambient_random`
- 玩家平A默认每秒攻击一次，对当前有效目标造成 `3` 点伤害
- 当前目标死亡时玩家停手，自动攻击保持 ready，不进入下一轮间隔，直到重新选中目标
- 队伍随机伤害继续兼容旧关卡字段
- 玩家平A/技能仇恨公式统一为：
  - `threat = damage × threatMultiplier + flatThreat`
- 队伍随机伤害默认仇恨公式固定为：
  - `threat = damage × 1 + 0`

## Context

当前项目里有三条相互独立但语义接近的链路：

1. 队伍随机伤害通过 `partyAutoDamage*` 字段在 `encounterFactory.ts` 中直接处理
2. 玩家技能伤害与仇恨在 `playerSkillRuntimeRegistry.ts` 中分别按技能硬编码
3. 玩家平A尚未存在，但需求已确定会进入同一套仇恨系统

如果继续分别扩展这三条链路，后续加入“队友爆发”“仇恨相关状态”时会快速失控。因此本轮要先抽出统一模型。

## Recommended Approach

采用 **C1：统一 damageSource 模型**。

### Why this approach

- 它能兼容当前 demo 的简化实现
- 它允许未来新增来源而不改主状态机结构
- 它能把“伤害”和“仇恨”统一到一套公式与数据结构上
- 它不会强制现在就把所有内容完整表驱动

## Scope

### In scope

- 定义 `damageSource` 运行时模型
- 为 `EncounterRuntime` 增加 `damageSources`
- 让玩家平A通过 `damageSource` 结算
- 让队伍随机伤害通过 `damageSource` 结算
- 为玩家技能效果表新增仇恨倍率相关字段
- 让当前已接入效果表的玩家伤害技能使用统一仇恨公式
- 为未来策划工作簿新增“伤害来源定义 / 关卡伤害来源绑定”接口
- 保持旧的 `partyAutoDamage*` 字段兼容
- 补测试、样例、文档、更新日志

### Out of scope

- 本轮不实现真正的队友爆发玩法
- 本轮不实现状态对 `damageSource` 的完整动态修饰器系统
- 本轮不把所有玩家技能都改成纯表驱动
- 本轮不移除旧 `partyAutoDamage*` 字段

## Data Model

### Runtime damage source

新增运行时实例 `DamageSourceRuntime`，字段如下：

- `sourceId`
- `sourceKind`
- `ownerSide`
- `sourceTags`
- `intervalMs`
- `remainingMs`
- `startReady`
- `enabled`
- `invalidTargetPolicy`
- `targetRule`
- `targetSelector`
- `targetCount`
- `damageMode`
- `baseDamage`
- `minDamage`
- `maxDamage`
- `threatMode`
- `threatMultiplier`
- `flatThreat`
- `threatSource`
- `lockedTargetId`

### Current source kinds

当前至少支持：

- `player_auto_attack`
- `party_ambient_random`

未来预留：

- `party_burst`
- `scripted`
- `status_triggered`

### Target rules

当前至少支持：

- `lockedCurrentTarget`
- `randomLivingEnemy`

### Invalid target policy

当前至少支持：

- `pauseReady`
- `retargetLivingEnemy`

本轮实际使用：

- 玩家平A：`pauseReady`
- 队伍随机伤害：`randomLivingEnemy`

## Threat Model

### Unified formula

统一公式：

- `threat = damage × threatMultiplier + flatThreat`

其中：

- `damage` 为本次实际结算伤害
- `threatMultiplier` 为倍率
- `flatThreat` 为固定额外仇恨

### Threat ownership

- `threatSource = player`：仇恨计入敌人的 `tankThreat`
- `threatSource = party`：仇恨计入敌人的 `allyThreat`

### Current defaults

- 玩家平A：`damage=3`, `threatMultiplier=5`, `flatThreat=0`
- 队伍随机伤害：`threatMultiplier=1`, `flatThreat=0`
- 纯嘲讽类技能可通过：
  - `damage=0`
  - `threatMultiplier=0`
  - `flatThreat>0`

## Player Skill Workbook Changes

修改工作簿：`player_build.xlsx`

工作表：`主动技能效果`

新增字段：

- `threatMultiplier`
  - 中文：仇恨倍率
  - 示例：`5`
- `threatSource`
  - 中文：仇恨归属
  - 当前支持：`player / party`

现有字段重新明确语义：

- `threatDelta`
  - 中文：固定额外仇恨
  - 程序语义：`flatThreat`

### Current runtime usage

当前要让下列技能开始使用统一仇恨公式：

- `burst_single`
- `cleave_adjacent`
- `taunt_single`
- `mass_taunt`
- `interrupt_cast`
- `stun_single`

其中：

- 有伤害的技能：同时读 `valueA/valueB + threatMultiplier + threatDelta`
- 无伤害但有仇恨的技能：读 `threatDelta`，并允许 `threatMultiplier=0`

## Stage Workbook Changes

在关卡/遭遇策划接口中新增两张表：

- `伤害来源定义`
- `关卡伤害来源绑定`

### 伤害来源定义

用于定义全局 damage source 原型，如：

- `player_auto_attack_default`
- `party_ambient_random_default`
- `party_burst_sample`

### 关卡伤害来源绑定

用于按关卡启用并覆盖数值，如：

- 绑定 `party_ambient_random_default` 到某关
- 覆盖 `intervalMs`
- 覆盖 `minDamage / maxDamage`
- 覆盖 `threatMultiplier / flatThreat`

### Backward compatibility

旧字段：

- `partyAutoDamageIntervalMs`
- `partyAutoDamageTargetCount`
- `partyAutoDamageMin`
- `partyAutoDamageMax`

继续保留。

本轮运行时会把它们映射成 `party_ambient_random` 的默认实例。  
未来如关卡绑定表提供了更明确的同类来源配置，则以绑定表优先。

## Runtime Flow

### Tick order

`tickEncounter` 中建议顺序：

1. 更新玩家/队伍/敌人状态
2. 解析并推进 `damageSources`
3. 结算伤害与仇恨
4. 结算死亡与目标失效
5. 继续敌人施法与其他状态机

### Player auto attack rules

- 若 `lockedTargetId` 存在且目标存活：
  - 推进间隔
  - 计时到 `0` 时造成一次伤害
- 若目标无效：
  - 不推进计时
  - `remainingMs=0`
  - 保持 ready
- 玩家重新选中新目标后：
  - 更新 `lockedTargetId`
  - 平A从 ready 状态重新工作

### Current target normalization

当前目标死亡后，不再自动切换到下一个活目标。  
应改为：

- 若当前目标仍活着，保留
- 若当前目标死亡，设为 `null`

## Testing Strategy

必须覆盖：

- 玩家平A每秒攻击一次并产生 `3 × 5 = 15` 仇恨
- 当前目标死亡后平A停手，且保持 ready
- 重新选中目标后平A恢复
- 队伍随机伤害通过 `damageSource` 结算并增加 `allyThreat`
- 玩家技能读取 `threatMultiplier + threatDelta`
- 旧 `partyAutoDamage*` 字段仍然有效
- 设计表解析新字段与新工作表

## Risks

### Risk 1: currentTarget 自动切换影响既有 UI 预期

解决：

- 用测试锁定“目标死亡后 currentTargetId = null”

### Risk 2: 伤害与仇恨公式切换导致旧技能表现变化过大

解决：

- 为当前默认效果行明确填写 `threatMultiplier / threatDelta`
- 通过样例和文档告知策划

### Risk 3: 提前做完整脚本化导致过度设计

解决：

- 本轮只落统一运行时模型与基础表结构，不实现复杂队友爆发玩法

## Result

完成后，项目会具备：

- 统一的持续/周期伤害来源模型
- 玩家平A接入仇恨系统
- 队伍随机伤害纳入统一结算
- 玩家技能仇恨公式表驱动
- 未来扩展“队友爆发 / 仇恨状态 / 特殊队伍伤害”所需的工作簿入口与运行时接口
