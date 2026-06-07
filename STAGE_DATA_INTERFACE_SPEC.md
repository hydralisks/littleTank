# 关卡数据接口说明

## 2026-05-08 追加说明：地图区域归属显式表驱动

- `stage_content.xlsx -> 区域` 是当前 demo 第一页地图的区域表现入口；当前仅支持 `harbor / midland / highland` 三个区域。
- `stage_content.xlsx -> 关卡` 新增必填列 `areaId` 与 `order`。
- `areaId` 引用 `区域.areaId`，决定该 `stageId` 在地图上属于哪个区域。
- `order` 为该区域内第几关，当前必须是 `1~6` 的整数；每个区域必须恰好覆盖 `1~6` 六个位置，且同一区域内不能重复。
- 选关地图节点位置现在按 `areaId + order` 决定，不再从 `stageId` 前缀推断区域位置。
- 本次只对 `public/designer-data/stage_content.xlsx` 做定向字段补齐，未运行任何 `public/` 生成命令。

## 2026-04-17 追加说明：伤害来源模型

- `EncounterRuntime` 已新增统一的 `damageSources` 运行时模型。
- 当前已接入该模型的来源：
  - 队伍随机伤害 `party_ambient_random`
  - 玩家平A `player_auto_attack`
- 现阶段仍保留并优先兼容 `关卡开场` 中的旧字段：
  - `partyAutoDamageIntervalMs`
  - `partyAutoDamageTargetCount`
  - `partyAutoDamageMin`
  - `partyAutoDamageMax`
- `encounter_balance.xlsx` 已新增两张预留工作表，供后续正式切换使用：
  - `伤害来源定义`
  - `关卡伤害来源绑定`
- 当前程序会生成这两张表作为策划入口，但运行时仍以旧 `partyAutoDamage*` 字段兼容为主。

## 2026-04-20 追加说明：特殊规则最小运行时注册表

- `特殊规则定义.ruleLogicId` 已正式接入运行时注册表：
  - `src/game/encounter/stageRuleLogicRegistry.ts`
- 当前不是“仅展示元数据”，而是已经有 3 个最小可运行样例：
  - `opening_pressure_shift`
  - `periodic_reinforcement`
  - `player_control_tax`
- 本轮仍保持 Excel 结构不扩张：
  - Excel 只填写 `ruleLogicId`
  - 程序通过 `ruleLogicId` 查找内置逻辑
  - 更复杂的参数化留待后续再做

## 2026-04-24 追加说明：队伍压力默认不再随时间漂移

- `关卡开场.partyPressure` 仍然表示本关开场时的初始队伍压力。
- 当前默认规则下，队伍压力不会因为时间流逝自动增加。
- 关卡侧若需要持续涨压或减压，优先使用：
  - `开场状态`
  - `关卡词缀绑定 / 词缀定义`
  - `特殊规则绑定 / 特殊规则定义`
  - 上述内容关联到的状态 `effectLogicId`
- 敌方技能表中的 `pressureOnHit / pressureOnMiss` 仍然保留，用于命中玩家或打到队伍时直接改动队伍压力。

## 2026-05-05 追加说明：主动技能按关卡前缀累计解锁

- `stage_content.xlsx -> 关卡` 新增 `unlockedActiveSkillIdsCsv`。
- 该字段表示“这一关新增解锁的主动技能 ID”，填写逗号分隔的 `player_build.xlsx -> 主动技能定义.skillId`。
- 进入某关时，程序会按 `stageOrder` 从第一关累计到当前关，合并沿途所有 `unlockedActiveSkillIdsCsv`，作为本关可用主动技能集合。
- 解锁只看当前关卡前缀，不看玩家最高进度。例如已完成 `2-6` 后重玩 `1-6`，仍只能使用 `1-1` 到 `1-6` 前缀累计解锁的主动技能。

本文档记录第二步关卡遭遇层已经落地的数据接口、工作表名称、字段英文名与中文含义。  
运行时以 `public/designer-data/encounter_balance.xlsx` 为遭遇数值入口，关卡展示与主动技能解锁入口见 `public/designer-data/stage_content.xlsx`。

## 通用持续时间约定

- 所有状态或持续效果类字段中，`durationMs = -1` 或 `durationMsOverride = -1` 表示永久持续到战斗结束。
- 永久状态不会自然倒计时消失，但仍可被后续明确指向该状态的移除/覆盖效果处理。
- `0` 保留给展示占位或立即态，不作为“永久状态”的推荐填法。

## 1. 工作簿与工作表

文件：`public/designer-data/stage_content.xlsx`

工作表：

- `区域`
- `关卡`
- `图例`

文件：`public/designer-data/encounter_balance.xlsx`

工作表：

- `关卡开场`
- `敌人布置`
- `开场状态`
- `关卡词缀绑定`
- `词缀定义`
- `伤害来源定义`
- `关卡伤害来源绑定`
- `特殊规则绑定`
- `特殊规则定义`

## 2. stage_content.xlsx -> 关卡

工作表：`关卡`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `stageId` | 关卡 ID | string | 是 | 例如 `harbor-1`，需要和 `encounter_balance.xlsx` 中的 `stageId` 对应 |
| `areaId` | 所属区域 ID | string | 是 | 引用 `区域.areaId`；当前 demo 为 `harbor / midland / highland` |
| `order` | 区域内关卡序号 | integer | 是 | `1~6`；每个区域固定六关且不能重复 |
| `title` | 关卡标题 | string | 是 | 选关页展示 |
| `subtitle` | 关卡副标题 | string | 否 | 选关页展示 |
| `affix1Title` / `affix2Title` | 展示用词缀标题 | string | 否 | 仅展示 |
| `affix1Description` / `affix2Description` | 展示用词缀说明 | string | 否 | 仅展示 |
| `affix1IconId` / `affix2IconId` | 展示用词缀图标 | string | 否 | 引用图标 ID |
| `rule1Title` / `rule2Title` | 展示用规则标题 | string | 否 | 仅展示 |
| `rule1Description` / `rule2Description` | 展示用规则说明 | string | 否 | 仅展示 |
| `rule1IconId` / `rule2IconId` | 展示用规则图标 | string | 否 | 引用图标 ID |
| `unlockedActiveSkillIdsCsv` | 本关新增解锁主动技能 | csv string | 否 | 逗号分隔，引用 `player_build.xlsx -> 主动技能定义.skillId`；运行时按关卡前缀累计 |

说明：旧 `environment1Title / environment1Description / environment1IconId / environment2Title / environment2Description / environment2IconId` 六列已移除；关卡特殊效果统一通过 `encounter_balance.xlsx -> 特殊规则绑定 / 特殊规则定义` 接入。

## 3. 关卡开场

工作表：`关卡开场`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `stageId` | 关卡 ID | string | 是 | 例如 `harbor-1` |
| `playerHp` | 玩家开场生命值 | number | 是 | |
| `playerMaxHp` | 玩家生命上限 | number | 是 | 战斗开始时作为玩家最大生命值基底；被动天赋在此基础上修正 |
| `playerResource` | 玩家开场资源 | number | 是 | |
| `playerGcdRemainingMs` | 玩家开场 GCD | number | 是 | 毫秒 |
| `partyHp` | 队伍开场生命值 | number | 是 | |
| `partyMaxHp` | 队伍生命上限 | number | 是 | 战斗开始时作为队伍最大生命值基底；被动天赋在此基础上修正 |
| `partyPressure` | 队伍开场压力 | number | 是 | |
| `partyMaxPressure` | 队伍压力上限 | number | 是 | 战斗开始时作为队伍压力最大值基底；被动天赋在此基础上修正 |
| `buildRuleId` | 构筑规则 ID | string | 是 | 引用 `player_build.xlsx -> 构筑规则定义.buildRuleId` |
| `partyAutoDamageIntervalMs` | 队伍自动伤害间隔 | number | 否 | 单位毫秒，默认可填 `1000` |
| `partyAutoDamageTargetCount` | 队伍自动伤害目标数 | number | 否 | 每次自动伤害随机命中的活敌数量 |
| `partyAutoDamageMin` | 队伍自动伤害最小值 | number | 否 | 每次命中伤害下限 |
| `partyAutoDamageMax` | 队伍自动伤害最大值 | number | 否 | 每次命中伤害上限 |

### `关卡开场` 新增字段说明

- `partyAutoDamageIntervalMs`
  - 例：`1000`
  - 表示每 1 秒触发一次队伍自动伤害
- `partyAutoDamageTargetCount`
  - 例：`1`
  - 表示每次从活着的敌人里随机选 1 个目标
- `partyAutoDamageMin / partyAutoDamageMax`
  - 例：`10 / 20`
  - 表示本次伤害在 `10~20` 之间随机

第一关 `harbor-1` 当前样例：

- `partyAutoDamageIntervalMs = 1000`
- `partyAutoDamageTargetCount = 1`
- `partyAutoDamageMin = 10`
- `partyAutoDamageMax = 20`

## 4. 敌人布置

工作表：`敌人布置`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `stageId` | 关卡 ID | string | 是 | |
| `spawnId` | 敌人实例 ID | string | 是 | 关卡内唯一 |
| `enemyId` | 敌人目录 ID | string | 是 | 引用 `enemy_data.xlsx -> 敌人定义.enemyId` |
| `row` | 所在行 | number | 是 | `1~5` |
| `col` | 所在列 | number | 是 | `1~5` |
| `nameOverride` | 名称覆盖 | string | 否 | 留空则沿用敌人定义 |
| `hpOverride` | 开场生命值覆盖 | number | 否 | |
| `maxHpOverride` | 最大生命值覆盖 | number | 否 | |
| `openingCastSkillNum` | 开场技能循环序号 | number | 否 | 1 基序号；`1` 表示从 `enemy_data.xlsx -> 敌人定义.skillCycleCsv` 的第一个技能开始 |
| `openingRecoveryRemainingMs` | 开场发呆时间 | number | 否 | 毫秒；时间结束后才开始按 `openingCastSkillNum` 从头完整读条 |
| `openingTankThreat` | 开场玩家仇恨 | number | 否 | 留空按 0 |
| `openingAllyThreat` | 开场队伍仇恨 | number | 否 | 留空按 0 |

说明：

- `spawnId` 是敌人实例真实 ID，运行时逻辑仍保留它。
- 当前敌方血条 UI 不再额外显示实例字母编号，但程序内部仍用 `spawnId` 区分每只怪。
- `target / threatState / openingCastSkillId / openingCastRemainingMs` 已从接口移除。开场目标和血条状态由 `openingTankThreat / openingAllyThreat`、`threatLogic` 和本关 `partyAutoDamageMax` 计算。
- `skillCycleCsv / threatLogic / isSkullOverride` 已从本表移除。技能循环、仇恨逻辑和首领标记统一读取 `enemy_data.xlsx -> 敌人定义`。

### 敌人死亡后的当前规则

- 敌人死亡后仍保留在原 5x5 位置，不从编队表移除。
- 死亡敌人不会继续施法，也不会成为普通目标技能和队伍自动伤害的目标。
- 在未触发任何失败条件前，若所有敌人都已死亡，则战斗立刻胜利。

## 5. 开场状态

工作表：`开场状态`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `stageId` | 关卡 ID | string | 是 | |
| `targetType` | 目标类型 | string | 是 | `player / party / enemy` |
| `targetId` | 目标 ID | string | 否 | 当 `targetType = enemy` 时填写 `spawnId` |
| `statusId` | 状态 ID | string | 是 | 引用敌人状态表 |
| `durationMsOverride` | 持续时间覆盖 | number | 否 | `-1` 表示永久持续到战斗结束 |
| `stacks` | 层数 | number | 否 | 当前仅保留记录，默认 `1` |
| `sourceType` | 来源类型 | string | 是 | `manual / affix / specialRule` |
| `sourceId` | 来源 ID | string | 否 | 对应词缀或特殊规则 ID |

## 6. 关卡词缀绑定

工作表：`关卡词缀绑定`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `stageId` | 关卡 ID | string | 是 | |
| `affixIdsCsv` | 词缀列表 | csv string | 否 | 引用 `词缀定义.affixId` |

## 7. 词缀定义

工作表：`词缀定义`

当前词缀模型已经简化为：  
“战斗开始后若干毫秒，对某类固定目标施加某个状态”。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `affixId` | 词缀 ID | string | 是 | 主键 |
| `affixName` | 词缀名称 | string | 是 | |
| `iconId` | 图标 ID | string | 是 | |
| `description` | 效果说明 | string | 是 | |
| `delayMs` | 生效延迟 | number | 是 | 毫秒 |
| `targetType` | 目标类型 | string | 是 | `enemy / player / party` |
| `targetSelector` | 目标选择器 | string | 是 | 如 `frontRow / skullOnly / party` |
| `statusId` | 状态 ID | string | 是 | |
| `durationMsOverride` | 持续时间覆盖 | number | 否 | `-1` 表示永久持续到战斗结束 |
| `stacks` | 层数 | number | 否 | 默认 `1` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 8. 特殊规则绑定

工作表：`特殊规则绑定`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `stageId` | 关卡 ID | string | 是 | |
| `ruleIdsCsv` | 特殊规则列表 | csv string | 否 | 引用 `特殊规则定义.ruleId` |

## 9. 特殊规则定义

工作表：`特殊规则定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `ruleId` | 特殊规则 ID | string | 是 | 主键 |
| `ruleName` | 特殊规则名称 | string | 是 | |
| `iconId` | 图标 ID | string | 是 | |
| `description` | 效果说明 | string | 是 | |
| `ruleLogicId` | 规则逻辑接口 ID | string | 是 | 程序受控逻辑入口 |
| `grantedStatusIdsCsv` | 关联状态列表 | csv string | 否 | 用于本场图例与后续逻辑 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 10. 当前程序侧约定

- Excel 只写 `ruleLogicId`，不写脚本
- 词缀当前已经实现为“延时后施加状态”
- 特殊规则当前已接入最小运行时注册表，但仍不扩展复杂脚本系统
- 当前已实现的样例规则：
  - `opening_pressure_shift`：战斗开始时队伍压力 `+8`
  - `periodic_reinforcement`：每 `3000ms` 给第一个存活敌人施加 `enrage-song`
  - `player_control_tax`：玩家处于 `stunned` 时，每 `1000ms` 队伍压力 `+6`
- 关卡切换时会读取 `buildRuleId` 并约束玩家构筑
- 如需策划视角的填表说明，优先查看：
  - `关卡设计入口.md`

## 2026-05-10 追加说明：图例 iconId

- `stage_content.xlsx -> 图例` 新增必填字段 `iconId`。
- `id` 继续作为图例/状态标识；`iconId` 专门作为显示图标资源 ID，可与 `id` 不同。
- `iconId` 引用 `enemy_data.xlsx -> 图标资源映射.iconId`；运行时按该映射找到 `assetKey`，再加载 `public/status-icons/{assetKey}.svg`。
- 本轮仅定向补字段，没有运行 `npm run generate:designer-data` 或 public 生成脚本。
