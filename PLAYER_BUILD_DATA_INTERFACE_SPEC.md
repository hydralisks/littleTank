# 玩家构筑数据接口说明

## 2026-05-08 追加说明：demo0 主动样例技能已移除

- `demo0_*` 主动技能样例不再属于当前运行时基线、策划接口样例或图标映射。
- 当前正式玩家主动技能内容应继续使用 `warrior_t_*` 命名，并由 `player_build.xlsx` 与关卡前缀解锁链路驱动。
- `demo0_sample` 仅作为历史兼容数据层残留；不要为它新增主动技能，也不要把 `demo0_*` 主动技能写回策划表或生成脚本。
- 本次清理没有运行 `public/` 下的策划表生成命令。

## 2026-05-08 追加说明：战士 T 被动逻辑与队伍压力自然下降

- 当前 `player_build.xlsx` 中 16 个战士 T 被动 `talentLogicId` 已接入运行时：`reinforced_plates`、`defensive_stance`、`raise_banner`、`snap_interrupt`、`defenders_aegis`、`barbaric_training`、`bloodsurge`、`focused_vigor`、`honed_reflexes`、`frothing_berserker`、`punish`、`enduring_defenses`、`immortal_stance`、`booming_voice`、`rumbling_earth`、`crackling_thunder`。
- `被动天赋定义.talentLogicId` 是运行时分派入口；`被动天赋效果.talentLogicId` 只作为效果行归类/备注字段。
- 这些被动会读取 `被动天赋效果.valueA / valueB / statusId / skillId`，并在需要状态时读取 `玩家被动状态定义.durationMs / maxStacks / effectLogicId`。
- `玩家被动状态定义.durationMs=-1` 表示永久持续到战斗结束，除非被明确指向该状态的效果移除。
- 队伍压力新增基础自然下降规则：10000ms 内没有压力增加后，每 1000ms 降低 5 点，直到归 0 或下一次压力增加。
- `barbaric_training` 会禁用队伍压力自然下降，因此策划描述中的“队伍压力不再会被动下降”已包含基础自然下降和负向队伍状态压力漂移。

## 2026-05-14 追加说明：比例上限被动与 tier 0 解锁

- `reinforced_plates` 现在把 `被动天赋效果.valueA` 解释为玩家生命上限比例加成，`0.5` 表示玩家生命上限提高 50%。
- `raise_banner` 现在把 `被动天赋效果.valueA` 解释为队伍压力上限比例加成，`0.5` 表示队伍压力上限提高 50%。
- 这类比例上限被动在关卡开场结算时，以 `encounter_balance.xlsx -> 关卡开场` 中的基础上限为基底计算最终上限，并把当前值按同一比例等比缩放。例如 `playerHp=900, playerMaxHp=1000, valueA=0.5` 时，开场后为 `hp=1350, maxHp=1500`。
- `tier=0` 被动天赋不再初始开放；当前规则为完成 `RingingDeeps-3` 之后开放，即进入全局关卡顺序第 4 关时最大可用被动 tier 为 `0`。

## 2026-04-17 追加说明：仇恨公式字段

- `主动技能效果` 现新增两个正式字段：
  - `threatMultiplier`
  - `threatSource`
- 当前玩家伤害类技能统一按下面公式结算仇恨：
  - `threat = damage × threatMultiplier + threatDelta`
- 其中：
  - `threatDelta` 现在应理解为 `flatThreat`
  - `threatSource` 当前支持 `player / party`
- 推荐填表约定：
  - 纯伤害技能：填写 `valueA/valueB + threatMultiplier + threatDelta`
  - 纯仇恨技能：填写 `threatDelta`，并把 `threatMultiplier` 填 `0`
  - 当前战士T样例中，`warrior_t_burst` 与 `warrior_t_cleave` 已按该规则接入运行时

## 2026-04-24 追加说明：队伍压力优先走队伍状态

- 影响队伍压力的持续效果，当前不再推荐继续依赖：
  - `partyPressureDriftPerSecond`
- 优先实现方式改为：
  - 给队伍施加一个 `partyBuff / partyDebuff` 状态
  - 由该状态的 `effectLogicId` 在运行时修改 `party.pressure`
- 当前已接入专门的队伍状态运行时：
  - `EncounterRuntime.partyStatusRuntime`
  - `src/game/encounter/partyStatusEffectRegistry.ts`
- 队伍状态当前支持两类触发：
  - 固定间隔触发
  - 事件触发
- 事件触发型队伍状态直接消费：
  - `runtime.lastProcessedEvents`
  - 不新增第二套“压力专用事件”

本文档记录当前 littleTank 已落地的玩家构筑数据接口。  
策划直接维护的入口文件为 `public/designer-data/player_build.xlsx`。

## 1. 当前架构总览

玩家构筑数据已经从旧的单层技能/天赋表，重构为五层结构：

1. 职业层：定义当前有哪些正式职业可选
2. 构筑规则层：定义每关允许多少主动技能、多少总点数和哪些热键开放
3. 主动技能层：把主动技能拆为“定义 + 效果 + 状态”
4. 被动天赋层：把被动天赋拆为“定义 + 效果 + 状态”
5. 预设与图标层：定义默认构筑和 UI 图标映射

当前正式职业：

- `warrior_t`

当前保留的旧演示兼容职业：

- `demo0_sample`

说明：

- `demo0_*` 主动技能样例已移除；不要在正式内容或生成脚本中继续扩写
- `demo0_sample` / `demo0_*` 被动原型残留只作历史兼容参考，不再作为正式默认构筑使用
- `standard_5slot` 以及当前教程规则默认都服务 `warrior_t`
- 若文档与代码不一致，以 [workbookLoader.ts](/C:/codexCode/littleTank/src/game/data/workbookLoader.ts) 与 [generateDesignerWorkbooks.mjs](/C:/codexCode/littleTank/scripts/generateDesignerWorkbooks.mjs) 为准

## 2. 工作簿与工作表

文件：`public/designer-data/player_build.xlsx`

当前真实工作表：

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

## 3. 职业定义

工作表：`职业定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `classId` | 职业 ID | string | 是 | 主键，例：`warrior_t` |
| `className` | 职业名 | string | 是 | UI 显示中文名 |
| `roleTag` | 职能标签 | string | 是 | 当前建议值：`tank` |
| `classDescription` | 职业描述 | string | 是 | 用于构筑/选关提示 |
| `recommendedBuildRuleIdsCsv` | 推荐构筑规则列表 | csv string | 否 | 逗号分隔，例：`tutorial_2slot,standard_5slot` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 4. 构筑规则定义

工作表：`构筑规则定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `buildRuleId` | 构筑规则 ID | string | 是 | 主键 |
| `classId` | 适用职业 ID | string | 否 | 留空时回退到默认逻辑，当前建议明确填写 |
| `ruleName` | 规则名 | string | 是 | UI 显示名 |
| `description` | 规则描述 | string | 是 | 展示这一关的构筑限制 |
| `totalBuildPoints` | 总构筑点数 | number | 是 | 主动技能与被动天赋共用 |
| `maxActiveSlots` | 最大主动槽位数 | number | 是 | 决定最多可选几个主动技能 |
| `enabledHotkeysCsv` | 可用热键列表 | csv string | 是 | 例：`1,2,3,4,Q` |
| `inheritancePolicy` | 构筑继承策略 | string | 是 | 当前支持 `keep_active_first / keep_balanced / reset_to_default` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

说明：

- `构筑规则定义` 不再承载主动技能/被动天赋的允许、强制或锁定列表。
- 已废弃并从 `player_build.xlsx -> 构筑规则定义` 删除的旧字段为：`allowedActiveSkillIdsCsv`、`allowedTalentIdsCsv`、`forcedSkillIdsCsv`、`forcedTalentIdsCsv`、`lockedSkillIdsCsv`、`lockedTalentIdsCsv`。
- 主动技能可用性来自当前关卡前缀累计的 `stage_content.xlsx -> 关卡.unlockedActiveSkillIdsCsv`。
- 被动天赋可用性来自 `被动天赋定义.tier` 与当前关卡的 boss 前解锁规则。

### 构筑继承逻辑

当玩家切换到新关卡时，程序会按 `关卡开场.buildRuleId` 自动规范化构筑：

1. 先尝试保留上一关的主动技能和被动天赋
2. 移除本关未开放热键上的主动技能
3. 移除不属于本关主动技能前缀解锁集合的技能，以及超过本关被动 `tier` 上限的天赋
4. 移除不符合职业归属或已禁用定义的技能、天赋
5. 若总点数超限，优先移除被动天赋，再移除主动技能
6. 若仍无法满足规则，则回退到该规则的默认构筑
7. 自动调整结果会在选关界面提示玩家

## 5. 主动技能定义

工作表：`主动技能定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `skillId` | 技能 ID | string | 是 | 主键，建议前缀 `warrior_t_` |
| `classId` | 所属职业 ID | string | 否 | 建议明确填写 |
| `skillName` | 技能全名 | string | 是 | 中文名 |
| `shortName` | 技能短名 | string | 是 | 技能栏显示用 |
| `description` | 技能描述 | string | 是 | 人读说明 |
| `iconId` | 图标 ID | string | 是 | 关联 `图标资源映射.iconId` |
| `pointCost` | 占用点数 | number | 是 | 主动技能通常为 4 |
| `resourceCost` | 资源消耗 | number | 是 | 例如怒气消耗 |
| `cooldownMs` | 冷却时间 | number | 是 | 单位毫秒 |
| `initialRemainingCooldownMs` | 开场剩余冷却 | number | 否 | 默认 `0` |
| `gcdMs` | 公共冷却 | number | 是 | 单位毫秒 |
| `targetingType` | 目标类型 | string | 是 | 当前支持 `currentEnemy / crossEnemy / matrix3x3Enemy / topLeft2x2Enemy / allEnemy / party / self` |
| `skillLogicId` | 技能主逻辑接口 ID | string | 是 | 释放技能时，程序通过它找到主处理器 |
| `castStopMode` | 施法阻止模式 | string | 是 | `none / interrupt / control` |
| `canAffectSkull` | 是否可影响首领 | boolean | 是 | 控制技常用 |
| `skillTagsCsv` | 技能标签列表 | csv string | 否 | 例：`threat,survival` |
| `uiOrder` | UI 排序 | number | 否 | 越小越靠前 |
| `unlockHint` | 解锁提示 | string | 否 | 教学关或限制规则用 |
| `grantedStatusIdsCsv` | 可能施加的状态列表 | csv string | 否 | 关联 `玩家主动状态定义.statusId` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

### `castStopMode` 约定

- `none`：不参与阻止敌方施法
- `interrupt`：只能阻止 `castBreakRule=interruptOrControl` 的敌方施法
- `control`：可阻止 `castBreakRule=interruptOrControl` 与 `castBreakRule=controlOnly` 的敌方施法

### `canAffectSkull` 约定

- `true`：可影响首领敌人
- `false`：对 `isSkull=true` 的敌人不生效

### `targetingType` 约定

- `currentEnemy`：当前目标
- `crossEnemy`：当前目标以及血条格上下左右
- `matrix3x3Enemy`：当前目标为中心的 3x3 血条格矩阵
- `topLeft2x2Enemy`：当前目标为左上角的 2x2 血条格矩阵
- `allEnemy`：所有存活敌方目标
- `party`：己方队伍
- `self`：玩家自身

主动技能关卡前缀解锁规则：

- 运行时会在构筑规则之外，再按 `stage_content.xlsx -> 关卡.unlockedActiveSkillIdsCsv` 做当前关卡前缀累计解锁。
- `unlockedActiveSkillIdsCsv` 表示“这一关新增解锁的主动技能 ID”，填写逗号分隔的 `主动技能定义.skillId`。
- 进入某关时，程序会累计 `stageOrder` 中从第一关到当前关的所有 `unlockedActiveSkillIdsCsv`，作为本关可用主动技能集合。
- 例如进入 `2-4` 时，可以使用第一大关 `1-1` 到 `1-6` 解锁的所有技能，以及 `2-1 / 2-2 / 2-3 / 2-4` 解锁的技能。
- 该限制只看当前关卡前缀，不看玩家最高进度。因此即使已经完成 `2-6`，重玩 `1-6` 时仍只能使用 `1-1` 到 `1-6` 前缀累计解锁的主动技能。

## 6. 主动技能效果

工作表：`主动技能效果`

一行代表一个效果片段，一个技能可以拆成多行效果。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `skillEffectId` | 技能效果 ID | string | 是 | 主键 |
| `skillId` | 所属技能 ID | string | 否 | 对应 `主动技能定义.skillId` |
| `effectIndex` | 生效顺序 | number | 否 | 从小到大排序 |
| `skillLogicId` | 效果备注逻辑 ID | string | 否 | 可选备注字段；不决定技能释放时调用哪个处理器 |
| `targetSelector` | 此段效果目标 | string | 否 | 当前支持 `current / adjacent / cross / matrix3x3 / topLeft2x2 / allEnemy / party / self` |
| `valueA` | 参数 A | number | 否 | 主数值 |
| `valueB` | 参数 B | number | 否 | 次数值 |
| `durationMs` | 持续时间 | number | 否 | 状态或持续效果用 |
| `statusId` | 关联状态 ID | string | 否 | 对应 `玩家主动状态定义.statusId` |
| `threatDelta` | 固定仇恨 | number | 否 | 当前应理解为 `flatThreat` |
| `threatMultiplier` | 仇恨倍率 | number | 否 | 伤害技能按 `damage × threatMultiplier + threatDelta` 结算 |
| `threatSource` | 仇恨归属方 | string | 否 | 当前支持 `player / party` |
| `notes` | 策划备注 | string | 否 | 给后续 agent 的实现提示 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

### `targetSelector` 约定

- `current`：当前目标
- `adjacent`：当前目标与同一行左右相邻目标
- `cross`：当前目标以及血条格上下左右
- `matrix3x3`：当前目标为中心的 3x3 血条格矩阵
- `topLeft2x2`：当前目标为左上角的 2x2 血条格矩阵
- `allEnemy`：所有存活敌方目标
- `party`：己方队伍
- `self`：玩家自身

说明：

- `主动技能定义.skillLogicId` 是唯一的运行时主入口。玩家释放技能时，程序先根据 `skillId` 找到 `主动技能定义`，再用这里的 `skillLogicId` 找到“这个技能释放时调用哪个主处理器”。
- 主处理器进入后，会根据同一个 `skillId` 去读取 `主动技能效果` 表中的一到多行效果参数，并按自身逻辑解释这些参数。
- `主动技能效果.skillLogicId` 不再承担选择处理器的职责，只作为可选备注字段。策划通常可以留空；如果填写，也只表示“这一行效果原本预期归属的逻辑类型”，不改变运行时入口。
- 一个技能有多行效果时，多行效果仍由 `主动技能定义.skillLogicId` 指向的同一个主处理器统一结算。不要用不同效果行的 `skillLogicId` 来拆分执行入口。
- 主动技能效果表不再提供通用 `resourceDelta` 字段。
- 少数技能如果需要产生怒气或其他玩家资源，应在 `主动技能定义.skillLogicId` 对应的程序逻辑中实现。
- 天赋、状态如果需要影响资源恢复速度或技能消耗，也应通过对应逻辑接口修改资源系统变量，而不是在关卡或技能效果表里直接写通用资源变化字段。

- `targetingType` 主要用于技能定义层、UI 交互层和“这个技能需不需要敌方当前目标”的判断
- `targetSelector` 主要用于效果层，允许某条效果覆写技能定义层的目标范围
- 当某个运行时逻辑读取不到效果层选择器时，应回退到 `targetingType` 对应的默认范围

### 当前已接入运行时的主动技能效果字段约定

以下约定已经被程序真实读取：

- `taunt_single`
  - `targetSelector`
  - `threatDelta`
  - `statusId`
  - `durationMs`
- `mass_taunt`
  - `targetSelector`
  - `threatDelta`
  - `statusId`
  - `durationMs`
- `stun_single`
  - `targetSelector`
  - `durationMs`
  - `statusId`
  - `threatDelta`
- `shield_wall`
  - `durationMs`
  - `statusId`
- `shield_block`
  - `durationMs` 作为盾牌格挡持续时间，需求目标为 7000ms
  - `statusId` 当前为 `shieldBlock`
  - `valueB` 作为物理减伤比例，例如 `0.5` 表示 50% 物理减伤
  - 当前只影响敌人技能 `damageType=physical` 的玩家承伤，不影响 `damageType=magic`
- `cleave_adjacent`
  - `targetSelector`
  - `valueA` 作为主目标伤害
  - `valueB` 作为次目标伤害
  - `threatDelta`
- `burst_single`
  - `targetSelector`
  - `valueA` 作为伤害
  - `valueB` 作为非主目标伤害回退值
  - `threatDelta`

尚未完全表驱动的技能逻辑，后续应继续按这个方向扩展。

## 7. 玩家主动状态定义

工作表：`玩家主动状态定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `statusId` | 状态 ID | string | 是 | 主键 |
| `statusName` | 状态名 | string | 是 | 中文名 |
| `statusCategory` | 状态分类 | string | 是 | 当前支持 `playerBuff / enemyDebuff / partyBuff / partyDebuff` |
| `iconId` | 图标 ID | string | 是 | 对应 `图标资源映射.iconId` |
| `durationMs` | 持续时间 | number | 是 | `-1` 表示永久持续到战斗结束，除非被明确移除；`0` 表示不自然倒计时的展示/占位状态 |
| `maxStacks` | 最大层数 | number | 否 | 默认 `1` |
| `dispellable` | 是否可驱散 | boolean | 否 | 默认 `false` |
| `description` | 状态描述 | string | 是 | 中文说明 |
| `effectLogicId` | 状态逻辑接口 ID | string | 是 | 当前先写接口 ID，代码后续接注册表 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 8. 被动天赋定义

工作表：`被动天赋定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `talentId` | 天赋 ID | string | 是 | 主键，建议前缀 `warrior_t_` |
| `classId` | 所属职业 ID | string | 否 | 建议明确填写 |
| `talentName` | 天赋名 | string | 是 | 中文名 |
| `category` | 天赋分类 | string | 是 | `player / skill / party` |
| `cost` | 点数消耗 | number | 是 | 建议 1~3，少数可更高 |
| `description` | 天赋描述 | string | 是 | 人读说明 |
| `iconId` | 图标 ID | string | 是 | 关联 `图标资源映射.iconId` |
| `talentLogicId` | 天赋逻辑接口 ID | string | 是 | 程序通过它找逻辑注册表 |
| `tier` | 天赋层级 | number | 是 | 被动天赋解锁顺序依据。缺失或无法解析为数字时，该天赋定义行不会进入运行时 |
| `talentTagsCsv` | 天赋标签列表 | csv string | 否 | 例：`survival,anti-cast` |
| `uiOrder` | UI 排序 | number | 否 | 越小越靠前 |
| `exclusiveGroup` | 互斥组 | string | 否 | 同组内可限制只能选一个 |
| `grantedStatusIdsCsv` | 可能给予的状态列表 | csv string | 否 | 关联 `玩家被动状态定义.statusId` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

解锁规则：

- 初始不开放被动天赋，最大可用 tier 为 `-1`。
- 完成 `RingingDeeps-3` 后开放 `tier=0`；运行时表现为全局关卡顺序第 4 关开始可使用 `tier=0`。
- 进入第一大区 boss 战前（当前每区第 6 关）开放所有 `tier=1` 天赋。
- 进入第二大区 boss 战前开放所有 `tier=2` 天赋。
- 后续大区依次类推；运行时按当前关卡在 `stage_content.xlsx -> 关卡` 排序后的全局顺序、所属区域和区域内 `order` 推导当前可用最大 `tier`。
- 该限制只看当前关卡，不看玩家最高进度；即使已经完成后续关卡，重玩前三关时仍不能使用 `tier=0` 被动。

## 9. 被动天赋效果

工作表：`被动天赋效果`

一行代表一个效果片段，一个天赋可以拆成多行效果。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `talentEffectId` | 天赋效果 ID | string | 是 | 主键 |
| `talentId` | 所属天赋 ID | string | 否 | 对应 `被动天赋定义.talentId` |
| `effectIndex` | 生效顺序 | number | 否 | 从小到大排序 |
| `talentLogicId` | 天赋逻辑接口 ID | string | 否 | 一般与天赋定义一致 |
| `targetScope` | 影响范围 | string | 否 | 例：`player / party / skill` |
| `valueA` | 参数 A | number | 否 | 主数值 |
| `valueB` | 参数 B | number | 否 | 次数值 |
| `statusId` | 关联状态 ID | string | 否 | 对应 `玩家被动状态定义.statusId` |
| `skillId` | 关联技能 ID | string | 否 | 技能改造类天赋常用 |
| `notes` | 策划备注 | string | 否 | 给后续 agent 的实现提示 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

### 9.1 被动天赋逻辑入口约定

- `被动天赋定义.talentLogicId` 是被动天赋生效时的主入口。构筑确定后，程序会用它找到对应被动处理器。
- `被动天赋效果.talentLogicId` 与主动技能效果表中的 `skillLogicId` 一样，只作为效果行备注/归类字段；不决定运行时分派入口。
- 被动处理器会按 `talentId` 读取 `被动天赋效果` 中启用的效果行，并使用 `valueA / valueB / statusId / skillId / targetScope` 作为参数。
- 被动天赋通常在战斗开始前通过构筑计算生效内容；不要依赖战斗中动态切换 `被动天赋效果.talentLogicId` 来改变处理器。

## 10. 玩家被动状态定义

工作表：`玩家被动状态定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `statusId` | 状态 ID | string | 是 | 主键 |
| `statusName` | 状态名 | string | 是 | 中文名 |
| `statusCategory` | 状态分类 | string | 是 | 当前支持 `playerBuff / enemyDebuff / partyBuff / partyDebuff` |
| `iconId` | 图标 ID | string | 是 | 对应 `图标资源映射.iconId` |
| `durationMs` | 持续时间 | number | 是 | `-1` 表示永久持续到战斗结束，除非被明确移除；`0` 表示不自然倒计时的展示/占位状态 |
| `maxStacks` | 最大层数 | number | 否 | 默认 `1` |
| `dispellable` | 是否可驱散 | boolean | 否 | 默认 `false` |
| `description` | 状态描述 | string | 是 | 中文说明 |
| `effectLogicId` | 状态逻辑接口 ID | string | 是 | 当前先写接口 ID，后续再接程序逻辑 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 11. 默认主动构筑

工作表：`默认主动构筑`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `presetId` | 预设 ID | string | 是 | 主键的一部分 |
| `buildRuleId` | 适用构筑规则 ID | string | 否 | 留空表示通用 |
| `classId` | 所属职业 ID | string | 否 | 当前建议明确填写 |
| `hotkey` | 热键 | string | 是 | `1 / 2 / 3 / 4 / Q / E / R / F` |
| `skillId` | 技能 ID | string | 否 | 留空表示空槽 |
| `priority` | 保留优先级 | number | 否 | 越小越优先保留 |

## 12. 默认被动构筑

工作表：`默认被动构筑`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `presetId` | 预设 ID | string | 是 | 主键的一部分 |
| `buildRuleId` | 适用构筑规则 ID | string | 否 | 留空表示通用 |
| `classId` | 所属职业 ID | string | 否 | 当前建议明确填写 |
| `talentId` | 天赋 ID | string | 是 | 对应 `被动天赋定义.talentId` |
| `selected` | 是否默认选中 | boolean | 是 | `true / false` |
| `priority` | 保留优先级 | number | 否 | 越小越优先保留 |

## 13. 图标资源映射

工作表：`图标资源映射`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `iconId` | 图标 ID | string | 是 | 主键 |
| `iconName` | 图标名 | string | 是 | 中文名 |
| `assetKey` | 资源键名 | string | 是 | 前端查图用 |
| `iconType` | 图标类型 | string | 是 | `skill / talent / status / class` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 14. 程序侧对应关系

### 读取入口

- [workbookLoader.ts](/C:/codexCode/littleTank/src/game/data/workbookLoader.ts)

### 构筑目录与默认样例

- [playerBuildCatalog.ts](/C:/codexCode/littleTank/src/game/data/playerBuildCatalog.ts)

### 逻辑注册表

- 主动技能模板改造：[playerSkillLogicRegistry.ts](/C:/codexCode/littleTank/src/game/data/playerSkillLogicRegistry.ts)
- 被动天赋修饰聚合：[playerTalentLogicRegistry.ts](/C:/codexCode/littleTank/src/game/data/playerTalentLogicRegistry.ts)
- 技能运行时结算：[playerSkillRuntimeRegistry.ts](/C:/codexCode/littleTank/src/game/encounter/playerSkillRuntimeRegistry.ts)

### 当前对外查询接口

- `getPlayerClassDefinition(classId)`
- `getBuildRuleDefinition(buildRuleId)`
- `getActiveSkillDefinition(skillId)`
- `getPassiveTalentDefinition(talentId)`
- `getSkillEffectsForSkill(skillId)`
- `getTalentEffectsForTalent(talentId)`
- `getDefaultPersistedBuildForRule(buildRuleId)`

## 15. 策划录表建议

如果策划要继续扩战士T，建议按以下顺序填表：

1. `职业定义`
2. `构筑规则定义`
3. `主动技能定义`
4. `主动技能效果`
5. `玩家主动状态定义`
6. `被动天赋定义`
7. `被动天赋效果`
8. `玩家被动状态定义`
9. `默认主动构筑`
10. `默认被动构筑`
11. `图标资源映射`

给后续 agent 的备注：

- 定义表负责“是什么”
- 效果表负责“拆成哪些程序可实现的效果片段”
- 状态表负责“UI 图标、持续时间、文案和逻辑接口 ID”
- 若一个效果暂时还没实现，不要伪造完整逻辑。主动技能先确保 `主动技能定义.skillLogicId` 指向预期主处理器，再在效果行填写参数和备注；天赋与状态分别填写 `talentLogicId / effectLogicId` 与备注

## 2026-04-30 追加：`taunt` / `stun` 可由 `targetingType` 驱动范围

为了让“嘲讽、昏迷等同质效果”复用同一套代码处理器，运行时现在支持以下主处理器：

- `taunt`：读取 `主动技能定义.targetingType` 解析敌方目标集合，然后对集合内每个存活敌人施加 `主动技能效果` 第一行定义的 `statusId / durationMs / threatDelta`。
- `stun`：读取 `主动技能定义.targetingType` 解析敌方目标集合，然后对集合内每个可被该技能影响的存活敌人施加 `statusId / durationMs / threatDelta`，并按 `castStopMode=control` 处理可控制施法条。

策划填写建议：

- 单体版本可继续使用旧入口 `taunt_single / stun_single`。
- 范围版本优先使用新入口 `taunt / stun`，并在 `主动技能定义.targetingType` 填写 `currentEnemy / crossEnemy / matrix3x3Enemy / topLeft2x2Enemy / allEnemy`。
- 对 `taunt / stun` 这类新共享处理器，范围以 `主动技能定义.targetingType` 为准；`主动技能效果.targetSelector` 可保留为备注或兼容字段，不作为该处理器的主要范围来源。
- 不需要为 `taunt_single / taunt_cross / taunt_all` 分别写多个处理器。除非效果逻辑本身不同，否则只换 `targetingType` 即可。

## 2026-04-30 追加：新增主动状态与 `revenge` 处理器

- `玩家主动状态定义` 现在支持由 xlsx 新增状态 ID。新增状态不再要求先写进代码内置状态表。
- `revenge` 已接入运行时：读取 `主动技能定义.targetingType` 或效果行 `targetSelector` 解析敌方范围，读取 `主动技能效果.valueA` 作为伤害，并按 `damage * threatMultiplier + threatDelta` 产生仇恨。
- 当前 `warrior_t_revenge` 表格含义已经可运行：`topLeft2x2Enemy / topLeft2x2` 范围内每个存活目标受到伤害。

## 2026-05-01 追加：`ignore_pain` 处理器

- `ignore_pain` 已接入运行时：读取第一行 `主动技能效果.statusId / durationMs`，向 `player.buffs` 添加玩家增益。
- 当前 `warrior_t_ignore_pain` 表格含义已经可运行：施放后添加 `ignorePain`，持续时间由 `durationMs` 决定。
- `valueA` 表示护盾剩余可吸收总量，运行时写入状态的 `absorbRemaining`。
- `valueB` 表示每次玩家承受伤害时由护盾吸收的比例，运行时写入状态的 `absorbRatio`。例如 `0.5` 表示本次伤害 50% 由护盾吸收、50% 穿透到玩家生命值。
- 护盾每次吸收后会扣除等量 `absorbRemaining`；当剩余吸收量归零时，该 buff 会移除。
- 玩家限时增益现在会随 `tickEncounter` 倒计时并过期。
