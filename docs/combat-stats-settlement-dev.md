# 战斗统计结算开发文档

最后更新：2026-06-03

## 功能目标

战斗统计结算 V1 的目标是让玩家在战斗结束后用较少信息看懂本场数值来源，同时给后续词缀、状态、天赋、技能触发效果提供统一的事件记录入口。

当前不做完整时间线和最后几秒回放。UI 优先保持简洁，只展示五个分页：

- 坦克承伤
- 压力来源
- 打断情况
- 造成伤害
- 治疗/吸收

当前约束：玩家界面只展示客观统计数据，不展示“评价”“建议”“失败原因判断”等结论性内容。战斗摘要增强和失败原因分析先作为内部结构化数据实现，后续用于自动测评报告、学习型 AI 策略调整等内部系统。

## 核心文件

- `src/game/encounter/combatLog.ts`
  - 提供 `recordCombatLogEvent`、`recordCombatLogEvents` 和事件 ID helper。
- `src/game/encounter/combatStats.ts`
  - 提供 `buildEncounterStats(state)`，把 `state.runtime.combatLog` 聚合成 UI 数据。
- `src/game/encounter/combatDiagnostics.ts`
  - 提供 `buildCombatDiagnostics(stats)`，把聚合统计转成内部诊断指标和信号。该模块不接入玩家结算 UI。
- `src/game/encounter/encounterTypes.ts`
  - 定义 `CombatLogEvent`、`CombatLogActor`、`CombatLogAbility`，并在 `EncounterRuntime` 上新增 `combatLog`。
- `src/game/encounter/encounterEventSystems.ts`
  - 把玩家技能造成的 `enemy/damage-applied`、打断、控制等既有事件同步记录到 `combatLog`。
- `src/game/encounter/encounterFactory.ts`
  - 记录敌方读条开始/完成、敌方读条造成的坦克伤害和队伍压力、玩家/队伍自动攻击、队伍自动治疗、状态压力、状态持续伤害、敌方状态治疗、敌方通道状态伤害、关卡规则压力/伤害。
- `src/game/encounter/playerSkillRuntimeRegistry.ts`
  - 记录玩家技能治疗和吸收产生。
- `src/ui/EncounterResultStatsPanel.tsx`
  - 战斗结束后的五分页统计面板。
- `src/ui/EncounterScreen.tsx`
  - 在战斗结束时调用 `buildEncounterStats` 并显示结算面板。

## 事件层设计

`EncounterEvent` 仍然是状态变更队列，负责驱动实际战斗状态变化。`combatLog` 是并行的分析日志，只记录“发生了什么”，不直接改变战斗状态。

新增事件类型：

- `damage`
- `pressure`
- `cast-started`
- `cast-resolved`
- `cast-interrupted`
- `cast-controlled`
- `healing`
- `absorb-created`
- `absorb-consumed`

每条事件都带有：

- `occurredAtMs`
- `source`
- `target`
- `ability`
- 具体事件需要的 `amount`、`enemyId`、`enemySkillId`、`dangerLevel`、`breakRule` 等字段

新增技能、天赋、状态、词缀时，推荐先完成实际战斗效果，再在同一结算点追加 `combatLog` 事件。UI 不应该直接识别某个具体技能或词缀。

## 当前聚合口径

### 坦克承伤

读取 `damage` 事件，要求 `target.kind === 'tank'`。

当前来源包括敌方读条完成后的玩家承伤、玩家持续状态伤害、敌方通道状态造成的坦克伤害、关卡规则对坦克造成的伤害。词缀如果通过状态造成伤害，会通过状态继承的 `combatLogSource` 归因到词缀。

敌方来源按“敌人模板中文名 + 技能”合并，不按单个敌人实例拆行。例如同场战斗中多个“鱼人斥候”造成的“鱼人攻击”会合并为一行，便于玩家判断这个敌人模板和技能本身的威胁。

### 压力来源

读取 `pressure` 事件，要求 `target.kind === 'party'`。

当前来源包括敌方读条完成后的队伍压力、队伍状态压力、关卡规则压力。词缀施加的状态会携带 `combatLogSource.kind = affix`，因此状态后续产生压力时会归因到词缀。

敌方来源同样按“敌人模板中文名 + 技能”合并，避免同种敌人多只上场时拆出大量重复行。

### 打断情况

读取 `cast-started`、`cast-resolved`、`cast-interrupted`、`cast-controlled`。

先用 `castId` 把单次读条的开始和结果配对，再按“敌人模板中文名 + 技能”合并展示。UI 不再单列每一次施法，核心口径是：

- 打断成功/总计施法开始次数，例如 `2/8`
- 控制成功次数
- 完成施放次数
- 不可处理次数
- 参与处理的玩家技能名称

### 造成伤害

读取玩家侧 `damage` 事件，当前分类包括：

- 玩家技能伤害
- 玩家自动攻击伤害
- 队伍自动攻击伤害
- 天赋伤害

### 治疗/吸收

读取 `healing` 和 `absorb-created` 事件。

玩家 UI 当前统计有效治疗量和“产生的吸收盾数值”。`healing.amount` 表示实际生效治疗量；治疗事件可以额外携带 `rawAmount` 和 `overhealAmount`，用于内部分析原始治疗量与过量治疗。玩家 UI 暂时不展示过量治疗评价。

治疗与吸收在同一页内合并计算总量和占比。治疗行与吸收行仍保留各自类型，但占比分母是整页“治疗 + 产生吸收”的合计，而不是分别按治疗总量、吸收总量计算。

敌方状态在应用时产生的治疗也会记录为 `healing`，来源和目标使用具体敌人实例，项目使用状态名称。当前这类治疗仍按产生值统计，不区分有效治疗和过量治疗。

治疗/吸收分类当前包括玩家技能、队伍自动治疗、天赋效果和敌人治疗。敌人治疗进入同一页是为了让玩家和后续测评看见敌方支援带来的续航量。

`absorb-created` 表示产生的吸收盾数值。`absorb-consumed` 表示护盾实际抵消的伤害，当前已在内部 `EncounterStats.absorbConsumed` 中单独聚合，但不展示在玩家 UI 的治疗/吸收页，避免把第一版结算面板变复杂。

## 内部诊断层

`buildCombatDiagnostics(stats)` 基于 `EncounterStats` 生成内部结构化摘要，当前包括：

- 顶部坦克承伤来源、顶部压力来源、顶部伤害来源、顶部治疗/吸收来源。
- 总承伤、总压力、造成伤害、有效治疗、原始治疗、过量治疗、产生吸收、实际消耗吸收、高危完成读条、敌方治疗。
- 诊断信号 ID：承伤集中、压力集中、高危读条完成、敌方治疗存在、过量治疗偏高、吸收低消耗。

诊断信号只包含 `id`、`severity`、`metric` 和 `evidence` 等机器可读字段，不包含面向玩家的建议文案。后续自动测评报告或学习型 AI 可以用这些字段生成内部分析，但玩家结算 UI 不应直接引用该模块。

## 已知限制

- 敌方状态 on-apply 治疗、敌方通道状态对坦克/队伍造成的 tick 伤害已经转成战斗统计事件；后续新增状态逻辑时仍需要在结算点验证是否产生 `combatLog`。
- 吸收实际消耗已经有内部事件和聚合，但玩家 UI 暂时只展示产生吸收。
- 玩家技能治疗已经记录有效治疗、原始治疗和过量治疗；部分非玩家技能治疗来源仍只记录有效治疗。
- 自动攻击和部分运行时来源名称仍使用通用名称，后续可以补更细的展示名。

## 后续优化建议

优先级从高到低：

1. 扩展 `absorb-consumed` 到更多状态持续伤害、词缀伤害、关卡规则伤害路径。
2. 为非玩家技能治疗来源补充原始治疗和过量治疗。
3. 为后续新增状态、词缀、关卡规则补一套 telemetry 覆盖测试模板，防止新逻辑漏记。
4. 把 `combatDiagnostics` 接入自动测评报告，用同一套口径解释 AI 样本失败原因。
5. 后续如需面向玩家增强摘要，仍应只展示客观统计，不输出系统评价或建议。

## 验证命令

- `npm test -- src/game/encounter/combatLog.test.ts src/game/encounter/combatStats.test.ts src/game/encounter/combatTelemetry.integration.test.ts src/game/encounter/combatDiagnostics.test.ts src/ui/EncounterResultStatsPanel.test.tsx src/ui/EncounterScreen.test.ts`
- `npm test`
- `npm run build`
- `npm run desktop:build`
