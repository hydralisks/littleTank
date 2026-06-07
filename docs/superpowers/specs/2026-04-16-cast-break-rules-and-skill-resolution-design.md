# Cast Break Rules And Skill Resolution Design

**Context**

当前 demo 已经完成“玩家手动按技能”，但技能效果与敌方施法阻止规则仍然偏简化：
- 敌方施法目前只有一个 `interruptible` 布尔值，不足以表达“只能被控制阻止”“完全不可阻止”
- 被打断与被控制后的敌人后续行为还未区分
- 玩家技能还没有数据化区分“打断类 / 控制类 / 无阻止能力”
- 玩家技能还没有数据化区分“是否可影响首领敌人（skull）”
- 敌方施法条颜色还不能表达可阻止规则差异

本轮目标是把这些规则落成可配置数据接口，并让现有样例技能在战斗中“完整生效”。

## Scope

本轮只处理以下内容：
- 敌人技能可阻止规则数据化
- 敌人被打断 / 被控制后的运行时行为
- 玩家技能“阻止类型”和“是否影响首领”数据化
- 敌方施法条颜色与规则对应
- `.xlsx` 样例、加载器、接口文档同步
- 针对上述行为补自动化测试

本轮不处理：
- 新增更多玩家技能种类
- `effectLogicId` 或 `ruleLogicId` 的注册表扩展
- 更复杂的首领韧性、阶段免控或递减控制抗性

## Data Model

### 1. 敌人定义表新增字段

工作表：`敌人定义`

- `counteredDurationMs`
  - 中文：被反制持续时间
  - 类型：number
  - 作用：敌人当前施法被“打断类效果”成功阻止后，进入通用状态 `countered` 的持续时长
  - 行为：`countered` 结束后，敌人从技能循环中的下一个技能开始施放

### 2. 敌人技能表新增字段

工作表：`敌人技能`

- `castBreakRule`
  - 中文：施法阻止规则
  - 类型：enum string
  - 可选值：
    - `interruptOrControl`：可被打断类或控制类阻止
    - `controlOnly`：只能被控制类阻止，不能被打断类阻止
    - `unstoppable`：既不能被打断，也不能被控制阻止当前施法

说明：
- 旧字段 `interruptible` 退役，不再作为运行时判断依据
- UI 颜色映射：
  - `interruptOrControl` -> 浅黄色
  - `controlOnly` -> 浅蓝色
  - `unstoppable` -> 浅灰色

### 3. 玩家技能表新增字段

工作表：`主动技能定义`

- `castStopMode`
  - 中文：施法阻止类型
  - 类型：enum string
  - 可选值：
    - `none`
    - `interrupt`
    - `control`
- `canAffectSkull`
  - 中文：是否可影响首领
  - 类型：boolean
  - 规则：
    - 大多数技能默认 `true`
    - 少数控制技能配置为 `false`
    - 当 `false` 且目标是 `isSkull=true` 时，该技能对该目标不产生控制/阻止效果

## Runtime Rules

### 1. 打断成功

前提：
- 玩家技能 `castStopMode=interrupt`
- 目标存在当前施法
- 目标当前施法 `castBreakRule=interruptOrControl`

结果：
- 当前施法取消
- 不产生原技能效果
- 敌人附加通用状态 `countered`
- `countered` 持续时间取自敌人定义表 `counteredDurationMs`
- 技能循环视为“这个技能已处理完毕”，因此 `countered` 结束后施放技能循环中的下一个技能

### 2. 控制成功

前提：
- 玩家技能 `castStopMode=control`
- 目标存在当前施法
- 目标当前施法 `castBreakRule=interruptOrControl` 或 `controlOnly`
- 如果目标为首领，则该玩家技能还必须满足 `canAffectSkull=true`

结果：
- 当前施法取消
- 不产生原技能效果
- 敌人先进入该控制技能本身赋予的状态，例如 `stunned`
- 记录这次被阻止的原施法为“待重试技能”
- 当控制状态结束后：
  - 该敌人立刻重新尝试施放刚才被控制阻止的那个技能
  - 技能循环位置不前进
- 该技能如果之后正常读完或再次被打断/控制，再按对应规则继续推进

### 3. 不可阻止施法

- `castBreakRule=unstoppable`
- 当前施法既不会被 `interrupt` 阻止，也不会被 `control` 阻止
- 但控制技能本身若命中目标，仍可按后续设计决定是否只上状态不打断施法
- 本轮收紧：为了规则清晰，`unstoppable` 对“阻止当前施法”完全免疫；控制状态是否额外挂上，本轮也不附加

## State Changes

### 1. CastState 扩展

当前 `CastState` 需要能直接驱动 UI，因此新增：
- `breakRule`

### 2. EnemyState 扩展

为了支持“被控制后重读原技能”，新增：
- `pendingRetryCastSkillId: string | null`

该字段只在“控制成功中止施法”时写入。

### 3. 通用敌方状态

新增敌方 Buff/状态定义：
- `countered`
  - 中文：被反制
  - 用于显示打断成功后的通用硬直状态

## Interaction Rules For Current Sample Skills

### `interrupt`
- `castStopMode=interrupt`
- `canAffectSkull=true`
- 对 `interruptOrControl` 生效
- 对 `controlOnly / unstoppable` 不生效

### `stun`
- `castStopMode=control`
- `canAffectSkull=false`
- 对普通敌人：
  - 可阻止 `interruptOrControl / controlOnly`
- 对首领敌人：
  - 不阻止，不附加眩晕

### `massTaunt`
- `castStopMode=none`

### `taunt / shieldWall / cleave / burst / panic`
- `castStopMode=none`

## UI Rules

### 敌方施法条颜色

`EnemyRaidFrameItem` 根据 `enemy.cast.breakRule` 追加样式类：
- `is-break-interrupt-or-control`
- `is-break-control-only`
- `is-break-unstoppable`

CSS 颜色：
- `interruptOrControl`：浅黄色
- `controlOnly`：浅蓝色
- `unstoppable`：浅灰色

### 文本与状态展示

- 被打断后显示 `countered`
- 被控制后显示对应控制状态，例如 `stunned`
- 首领免受某控制技能影响时，不新增特殊文案，仍沿用现有技能失败/无效的轻量表现

## Testing Strategy

优先补战斗层单测，覆盖四类关键行为：

1. `interrupt` 成功打断 `interruptOrControl`
2. `interrupt` 无法打断 `controlOnly`
3. `stun` 可阻止 `controlOnly`，控制结束后重读原技能
4. `stun` 在 `canAffectSkull=false` 时对首领无效

其次补数据加载与样例表校验：
- workbook loader 能读入 `counteredDurationMs`
- workbook loader 能读入 `castBreakRule`
- workbook loader 能读入 `castStopMode / canAffectSkull`

## Files Expected To Change

- `src/game/encounter/encounterTypes.ts`
- `src/game/data/enemyCatalog.ts`
- `src/game/data/playerBuildCatalog.ts`
- `src/game/data/workbookLoader.ts`
- `src/game/data/encounterTemplates.ts`
- `src/game/encounter/encounterFactory.ts`
- `src/game/encounter/encounterFactory.test.ts`
- `src/ui/EnemyRaidFrameItem.tsx`
- `src/styles/encounter.css`
- `scripts/generateDesignerWorkbooks.mjs`
- `public/designer-data/enemy_data.xlsx`
- `public/designer-data/player_build.xlsx`
- `ENEMY_DATA_INTERFACE_SPEC.md`
- `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- `DEVELOPMENT_HANDOFF.md`
- `README.md`

## Notes

- 仓库当前不是 git repository，因此本轮只落盘文档与实现，不执行提交步骤。
- 本设计优先保证规则清晰和后续可扩展，不额外引入“韧性”“控制递减”等系统。
