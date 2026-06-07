# 战士T职业骨架与技能天赋注册表设计

## 1. 目标

本轮把玩家构筑系统从“单一 demo 技能池 + 大型 switch”推进为“职业骨架 + 技能/天赋定义 + 逻辑注册表”的结构。

首个真实职业为 `warrior_t`（战士T），同时保留现有样例技能/天赋，并统一改名为 `demo0_*`，作为展示与回归样例存在，不再承担正式职业定义职责。

本轮要求同时满足：

- 策划通过 `.xlsx` 直接维护战士T的主动技能池、被动天赋池、状态定义与构筑规则。
- 代码侧把主动技能逻辑与被动天赋逻辑从硬编码 `switch` 提取为注册表，便于未来职业扩展。
- 未来新增 `德鲁伊熊T / 修补匠T / 土元素T` 时，不需要继续扩大现有大分支。
- 玩家切关时仍沿用“尽量继承上关构筑”的规则，并能在新构筑规则冲突时给出自动调整与提示。

## 2. 总体方案

### 2.1 职业层

在 `player_build.xlsx` 中新增职业层定义：

- `职业定义`
- `构筑规则定义`
- `主动技能定义`
- `主动技能效果`
- `玩家主动状态定义`
- `被动天赋定义`
- `被动天赋效果`
- `玩家被动状态定义`
- `默认主动构筑`
- `默认被动构筑`
- `图标资源映射`

其中：

- `职业定义` 描述职业本体，如 `classId / className / roleTag / theme / enabled`
- 技能、天赋、状态均显式挂到 `classId`
- 关卡开场继续通过 `buildRuleId` 指向构筑规则；构筑规则再约束某个职业可带什么

### 2.2 demo0 隔离

现有演示技能与天赋改名为：

- `demo0_taunt`
- `demo0_interrupt`
- `demo0_stun`
- `demo0_massTaunt`
- `demo0_shieldWall`
- `demo0_cleave`
- `demo0_burst`
- `demo0_panic`

以及对应的 `demo0_*` 天赋与状态。

这些内容继续保留在数据表和运行时中，用作：

- 老演示回归样例
- 逻辑注册表的兼容样例
- 策划未来录入新职业时的参考模板

### 2.3 战士T首批内容

首批正式职业 `warrior_t` 先提供一套可录表、可展示、可执行的技能池与天赋池原型，不追求一次做完全部复杂效果。

技能池分三层：

1. 技能定义层：冷却、资源、图标、目标类型、说明、标签
2. 效果参数层：`skillLogicId + effectParamJson/effectParamCsv`
3. 运行时处理层：由 `skillLogicRegistry` 根据 `skillLogicId` 读取参数并执行

天赋池同理：

1. 天赋定义层：分类、点数、说明、图标、标签
2. 效果参数层：`talentLogicId + modifierParamJson/modifierParamCsv`
3. 运行时处理层：由 `talentLogicRegistry` 与 `skillMutationRegistry` 产出修正

## 3. 表结构方向

### 3.1 职业定义

核心字段：

- `classId`
- `className`
- `roleTag`
- `classDescription`
- `recommendedBuildRuleIdsCsv`
- `enabled`

### 3.2 主动技能定义

除现有字段外新增：

- `classId`
- `skillTagsCsv`
- `uiOrder`
- `unlockHint`

保留：

- `skillLogicId`
- `castStopMode`
- `canAffectSkull`

### 3.3 主动技能效果

单独拆出技能效果参数表，避免把未来越来越多的数值字段堆进技能定义表。

核心字段：

- `skillEffectId`
- `skillId`
- `effectIndex`
- `targetSelector`
- `valueA`
- `valueB`
- `durationMs`
- `statusId`
- `threatDelta`
- `notes`
- `enabled`

约定：

- 一个技能可拥有多条效果记录
- 运行时主处理器由 `主动技能定义.skillLogicId` 决定
- `valueA/valueB/durationMs/statusId` 作为通用参数槽
- 复杂效果先不在 Excel 里写脚本，只写数据和接口 id

2026-04-28 更新：玩家资源变化不再使用通用 `resourceDelta` 字段。少数技能产生怒气时，改由 `skillLogicId` 对应的运行时代码实现。
2026-04-29 更新：`主动技能效果.skillLogicId` 不再作为分派处理器的字段，只保留为可选备注。一个技能的多行效果统一由 `主动技能定义.skillLogicId` 指向的主处理器读取和结算。

### 3.4 被动天赋定义

除现有字段外新增：

- `classId`
- `tier`
- `talentTagsCsv`
- `uiOrder`
- `exclusiveGroup`

### 3.5 被动天赋效果

单独拆出天赋效果参数表。

核心字段：

- `talentEffectId`
- `talentId`
- `effectIndex`
- `talentLogicId`
- `targetScope`
- `valueA`
- `valueB`
- `statusId`
- `skillId`
- `notes`
- `enabled`

## 4. 逻辑注册表

### 4.1 主动技能

新增注册表层：

- `src/game/player/skillLogicRegistry.ts`

职责：

- 根据 `skillLogicId` 执行技能
- 读取技能效果表并组合结算
- 保持与战斗状态机的边界清晰

首批注册：

- 单体嘲讽
- 打断
- 控制
- 群嘲
- 自保减伤
- 横扫伤害
- 爆发打击
- 压力恢复

以及战士T首批新增逻辑占位：

- 护盾打击
- 盾牌猛击
- 立场固守
- 铁壁反击
- 战吼聚敌

### 4.2 被动天赋

拆成两类注册：

- `talentModifierRegistry`：影响玩家/队伍基础数值
- `skillMutationRegistry`：影响某个技能的 CD、范围、GCD、目标规则、效果倍率等

这样可避免把所有天赋都塞进 `getPassiveModifiers()` 的单个大分支。

## 5. 战士T内容组织

首批战士T只做“能让策划录入、能让程序正确读取、现有样例逻辑可跑通”的原型池。

建议首批主动技能包含：

- 仇恨建立类
- 打断/控制类
- 自保减伤类
- 小范围清怪类
- 爆发单体类
- 团队应急类

建议首批被动天赋包含：

- 玩家数值类
- 技能改造类
- 团队决策类

点数规则仍为：

- 主动技能每个默认 4 点
- 被动天赋多数为 1~3 点

## 6. 构筑继承

切换关卡时：

1. 优先保留上一关已装备且仍合法的主动技能
2. 若新规则点数不足，优先移除被动天赋
3. 若新规则仍冲突，再移除优先级更低的主动技能
4. 若某技能/天赋被规则禁用，则直接留空并返还点数
5. 生成冲突警告并在 UI 中提示玩家

## 7. 交付范围

本轮落地内容：

- `player_build.xlsx` 新结构与样例
- 战士T职业骨架
- `demo0_*` 样例隔离
- 主动技能逻辑注册表
- 被动天赋逻辑注册表
- 相关运行时接线、文档与更新日志

本轮不展开实现的内容：

- 所有新战士T技能的完整战斗效果
- 复杂 `effectLogicId` / `ruleLogicId` 的脚本系统
- 多职业切换 UI
