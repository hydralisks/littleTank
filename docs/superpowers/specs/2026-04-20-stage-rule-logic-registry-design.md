# Stage Rule Logic Registry Design

## Goal

在现有命令队列 + 事件驱动战斗核心之上，为关卡特殊规则建立一套最小可运行的 `ruleLogicId` 注册表机制，使关卡可以通过 `.xlsx` 配置：

- 绑定特殊规则
- 让少量样例规则真实生效
- 为后续策划填写更完整的关卡词缀、构筑规则、队伍参数预留稳定接口

本轮不引入单独的 boss 框架，也不尝试一次实现所有特殊规则。

## Context

当前项目里，关卡相关数据已经拆成了较清晰的多表结构，包含：

- `关卡开场`
- `敌人布置`
- `开场状态`
- `关卡词缀绑定`
- `词缀定义`
- `特殊规则绑定`
- `特殊规则定义`

其中：

- `buildRuleId` 已接入关卡开场
- 关卡词缀已有简化执行模型，当前主要是“延时后施加状态”
- 特殊规则目前主要还是元数据和 UI 展示，`ruleLogicId` 还没有正式接到运行时注册表

因此本轮重点不是重做关卡数据结构，而是把“特殊规则的程序入口”接出来，同时把策划需要填写的关卡内容文档化，方便后续继续填表。

## User-Confirmed Scope

用户已明确确认：

- 本轮先做最小版，不做完整规则系统
- 特殊规则只需注册表骨架 + 2~3 个样例规则
- 同时要把策划将来要填的关卡设计内容整理成 `.xlsx` 接口说明
- 需要新增一个面向策划的中文文档：`关卡设计入口.md`
- 暂时不继续深入 `skull / boss` 讨论，也不做单独 boss 机制

## Recommended Approach

采用“独立规则注册表 + 最小生命周期钩子 + 受控状态修改”的方案。

### Why this approach

相比“只保留数据不接运行时”，这个方案能尽快验证：

- `ruleLogicId` 是否真的能从 Excel 走到运行时
- 生命周期钩子是否稳定
- 规则逻辑是否能和现有命令队列 / 事件队列结构共存

相比“一次做完整规则系统”，这个方案更适合当前策划字段尚未填完的阶段，不会提前写死太多错误抽象。

## Scope

### In Scope

- 新增 `stageRuleLogicRegistry`
- 将 `ruleLogicId` 从关卡数据接到运行时
- 为规则处理器提供最小生命周期：
  - `onEncounterStart`
  - `onTick`
  - `onEncounterEnd`
- 实现 2~3 个样例特殊规则
- 补充关卡策划可填写的 `.xlsx` 接口说明
- 新增 `关卡设计入口.md`
- 补测试、更新日志、交接文档

### Out Of Scope

- 完整特殊规则系统
- 通用脚本解释器
- 单独 boss 框架
- 重做现有词缀系统
- 把所有现有关卡特殊规则都补成可运行

## Architecture

### 1. Rule Logic Registry

新增独立文件：

- `src/game/encounter/stageRuleLogicRegistry.ts`

职责：

- 维护 `ruleLogicId -> rule handler` 的注册映射
- 对外暴露统一入口，供战斗运行时调用
- 保持规则逻辑与 UI 解耦

本轮不使用字符串脚本，不在 Excel 中直接写逻辑表达式。Excel 只写 `ruleLogicId`，程序通过注册表找到对应处理器。

### 2. Minimal Rule Lifecycle

本轮每个规则处理器只支持以下钩子：

- `onEncounterStart(state)`
- `onTick(state, deltaMs)`
- `onEncounterEnd(state)`

这三个钩子足够覆盖当前最小样例：

- 开场立即生效
- 战斗中周期性生效
- 战斗结束收尾

本轮不引入更细的事件订阅接口，避免过早膨胀。

### 3. Rule Handler Boundaries

规则处理器本轮只允许做以下事情：

- 修改少量受控字段
  - `party.hp`
  - `party.pressure`
  - 运行时计时器
  - 状态列表
- 追加状态或事件
- 借助现有战斗函数完成安全更新

规则处理器本轮不允许：

- 在 UI 层写规则分支
- 直接跳过战斗核心去改 React 组件状态
- 引入新的大型运行时框架

## Runtime Integration

### Current Tick Placement

当前战斗主循环已经具备：

- 命令 flush
- 事件 drain
- 时间推进
- 状态 / 施法 / 仇恨 / 死亡处理

本轮的规则执行应当插入在统一的运行时层，而不是散落在 UI 或 workbook loader 中。

推荐顺序：

1. 命令队列处理
2. 事件队列处理
3. 关卡特殊规则处理
4. 常规时间推进与战斗逻辑
5. 新事件再次 drain

这样可以保证规则逻辑和现有事件驱动核心处于同一层级。

### Runtime State

如当前运行时字段不足以支撑周期规则，可在 `EncounterRuntime` 中新增少量规则用计时字段，但应满足：

- 字段数量最小化
- 命名聚焦“关卡规则运行时”
- 不把每条规则都单独硬编码成顶层字段

推荐方向：

- 允许加入一个轻量的 rule runtime 容器，例如按 `ruleId` 存放简单计时数据

但本轮不做通用脚本态数据模型。

## Sample Rules For This Iteration

本轮只做 2~3 个可运行样例规则，用于验证整条链路。

### 1. `opening_pressure_shift`

用途：

- 战斗开始时立即对队伍压力做一次固定调整

生命周期：

- `onEncounterStart`

验证目标：

- `ruleLogicId` 能从关卡表走到运行时
- 开场效果能反映到队伍状态 UI

### 2. `periodic_reinforcement`

用途：

- 战斗中每隔固定时间，对某类目标施加状态，或给敌方补一个增益

生命周期：

- `onTick`

验证目标：

- 规则处理器能管理简单计时器
- 状态能稳定进入现有状态系统与 UI

### 3. `player_control_tax`

用途：

- 当玩家处于特定控制状态时，周期性对队伍压力或队伍血量施加惩罚

生命周期：

- `onTick`

验证目标：

- 规则逻辑能够读取当前战斗状态
- 能根据状态条件产生附加后果

## Workbook Contract

本轮继续以：

- `public/designer-data/encounter_balance.xlsx`

作为关卡与遭遇策划的主要入口。

### Tables Kept As Primary Entry

- `关卡开场`
- `敌人布置`
- `开场状态`
- `关卡词缀绑定`
- `词缀定义`
- `特殊规则绑定`
- `特殊规则定义`

### Key Contract Clarifications

#### `关卡开场`

需要继续作为以下内容的配置入口：

- 玩家开场参数
- 队伍开场参数
- `buildRuleId`
- 队伍自动伤害参数：
  - `partyAutoDamageIntervalMs`
  - `partyAutoDamageTargetCount`
  - `partyAutoDamageMin`
  - `partyAutoDamageMax`

#### `关卡词缀绑定` / `词缀定义`

本轮不重做结构，只强调：

- 词缀仍按当前简化模型运行
- 主要表达“延时后对目标施加某状态”
- 后续策划可继续填写，等下一轮再扩展逻辑能力

#### `特殊规则绑定`

继续作为：

- `stageId -> ruleIdsCsv`

的映射入口。

#### `特殊规则定义`

本轮收紧为以下核心字段：

- `ruleId`
- `ruleName`
- `iconId`
- `description`
- `ruleLogicId`
- `grantedStatusIdsCsv`
- `enabled`

本轮不额外扩出大量规则参数字段，避免在策划未填表前过早绑定错误抽象。

## Planner Documentation Deliverable

本轮新增面向策划的中文说明文档：

- `关卡设计入口.md`

职责：

- 告诉策划“关卡设计内容该去哪些表填”
- 明确中英文字段名对照
- 说明各表当前真正被程序读取的字段
- 标出哪些字段是“已运行时接入”，哪些是“预留接口”

文档风格参考现有：

- `战士T技能天赋设计入口.md`

重点覆盖：

- 关卡开场参数
- 队伍参数
- `buildRuleId`
- 词缀定义与绑定
- 特殊规则定义与绑定
- 敌人布置与开场状态的入口说明

## Files Expected To Change

### Runtime

- `src/game/encounter/stageRuleLogicRegistry.ts`
- `src/game/encounter/encounterFactory.ts`
- `src/game/encounter/encounterTypes.ts`

### Data

- `src/game/data/encounterTemplates.ts`
- `src/game/data/workbookLoader.ts`
- `scripts/generateDesignerWorkbooks.mjs`

### Tests

- `src/game/encounter/encounterFactory.test.ts`

### Documentation

- `STAGE_DATA_INTERFACE_SPEC.md`
- `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`
- `关卡设计入口.md`
- `开发更新日志.md`
- `DEVELOPMENT_HANDOFF.md`

## Testing Strategy

本轮测试重点应覆盖：

1. `ruleLogicId` 能从 workbook 数据正确读入
2. `opening_pressure_shift` 在战斗开始时生效
3. `periodic_reinforcement` 能在 tick 中按预期触发
4. `player_control_tax` 只在满足条件时生效
5. 无特殊规则的关卡不受回归影响

同时保留完整回归验证：

- `npm test`
- `npm run build`
- `npm run lint`

## Risks

### Risk 1: 规则运行时字段膨胀

解决：

- 只引入最小 rule runtime 容器
- 不把每条规则都做成单独顶层字段

### Risk 2: 规则逻辑绕开现有战斗核心

解决：

- 强制所有规则逻辑都经由注册表和战斗运行时调用
- 不允许 UI 层直接分支处理关卡规则

### Risk 3: 过早设计复杂参数化表结构

解决：

- `特殊规则定义` 先保持精简
- 参数需求留到策划真正填表之后再扩

## Implementation Handoff

本 spec 对应的下一步实现应包括：

- 先写 implementation plan
- 再做最小注册表与 2~3 个样例规则
- 最后补齐策划入口文档与更新日志

本轮结束后，下一阶段再根据策划实际填写的 `.xlsx` 内容继续扩展：

- 更完整的特殊规则参数化
- 更复杂的关卡词缀逻辑
- 更细的遭遇编排
