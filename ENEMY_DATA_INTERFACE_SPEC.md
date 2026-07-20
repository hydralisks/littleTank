# 敌人数据接口说明

本文档记录当前已落地的敌人数据接口、工作表名称、字段英文名与中文含义。
运行时以 `public/designer-data/enemy_data.xlsx` 为策划直接入口。

## 1. 工作簿与工作表

文件：`public/designer-data/enemy_data.xlsx`

工作表：

- `敌人定义`
- `敌人技能`
- `敌方Buff`
- `玩家Debuff`
- `队伍Debuff`
- `图标资源映射`

## 2. 敌人定义

工作表：`敌人定义`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `enemyId` | 敌人 ID | string | 是 | 程序内唯一标识，关卡编队用它引用 |
| `name` | 敌人名称 | string | 是 | 血条中显示的基础名字 |
| `baseMaxHp` | 基础最大生命值 | number | 是 | 关卡生成时会再乘区域与关卡倍率 |
| `skillIdsCsv` | 拥有技能 ID 列表 | csv string | 是 | 逗号分隔，引用 `敌人技能.skillId` |
| `skillNamesCsv` | 拥有技能名称列表 | csv string | 否 | 仅供策划阅读核对，程序以 ID 为准 |
| `skillCycleCsv` | 技能循环列表 | csv string | 是 | 按顺序填写技能 ID，循环到末尾后立刻从头重新开始 |
| `threatLogic` | 仇恨逻辑 | string | 是 | 决定敌人的目标选择表现；当前支持 `normal / irregular / bloodlust`；若该敌人是未来占位且 `skillIdsCsv / skillCycleCsv` 都为空，可暂不填 |
| `counteredDurationMs` | 被反制持续时间 | number | 是 | 成功被打断后进入 `countered` 的时长，单位毫秒 |
| `isSkull` | 是否首领标记 | boolean | 否 | 控制是否显示首领级框体表现 |

`skillCycleCsv` 例子：

- `bone-jab,reckless-rush,bone-jab`
- `flame-lance,ember-bolt,dark-mend,staff-smash,ember-rush`
- `crusher-slam,ruin-volley,crusher-slam`

合法 `threatLogic`：

- `normal`：标准仇恨。目标按玩家仇恨 `tankThreat` 和队伍仇恨 `allyThreat` 比较决定：`allyThreat > tankThreat` 时目标为队伍，否则目标为玩家。
- `irregular`：乱仇恨。目标判断与 `normal` 一样按 `tankThreat / allyThreat` 比较；它不会自然增长队伍仇恨、不会衰减玩家仇恨，但每完成一整轮 `skillCycleCsv` 后会清空 `tankThreat / allyThreat`。
- `bloodlust`：嗜血目标。无视 `tankThreat / allyThreat` 的仇恨比较，选择玩家和队伍中当前生命值百分比较低的一方；适合首领、斩杀压血线怪、教学用特殊目标逻辑。

当前运行时参数：

| `threatLogic` | 是否自然增长/衰减仇恨 | 目标选择 | 整轮技能循环后是否清仇恨 | 施法目标是否锁定 |
| --- | --- | --- | --- | --- |
| `normal` | 否 | `allyThreat > tankThreat` 打队伍，否则打玩家 | 否 | 是 |
| `irregular` | 否 | 同 `normal` | 是 | 是 |
| `bloodlust` | 否 | 打玩家/队伍中生命百分比较低的一方 | 否 | 是 |

补充规则：

- 基础仇恨来源只来自明确规则：玩家自动攻击、队伍自动/被动伤害、玩家技能伤害公式、玩家技能固定仇恨、开场 `openingTankThreat / openingAllyThreat`，以及后续明确写入的特殊技能或状态。
- 敌人每次开始释放技能时会立刻根据当时的仇恨规则选择目标；读条开始后，该技能目标锁定，中途 OT 不会改变本次技能目标。
- 敌人不在读条中时，UI 目标显示会实时根据当前仇恨规则更新。
- 非 `bloodlust` 的 UI 仇恨状态：`tankThreat < allyThreat` 为丢失；`allyThreat <= tankThreat < allyThreat + 本关 partyAutoDamageMax` 为警告；`tankThreat >= allyThreat + 本关 partyAutoDamageMax` 为稳定。
- `bloodlust` 的 UI 仇恨状态直接看当前目标：目标为玩家时稳定，目标为队伍时丢失。
- `taunted` / `mass-taunt` 状态会强制目标表现为玩家，但不会改变 `threatLogic` 类型本身。

## 3. 敌人技能

工作表：`敌人技能`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `skillId` | 技能 ID | string | 是 | 程序内唯一标识 |
| `skillName` | 技能名称 | string | 是 | 施法条显示名称 |
| `targetRuleId` | 技能目标规则 | string | 是 | 见下方合法值 |
| `castTimeMs` | 施法时间 | number | 是 | 单位毫秒，按表值生效，不再有程序内最低 700ms 下限 |
| `channelingMs` | 引导持续时间 | number | 否 | 默认 0；成功完成 `castTimeMs` 后进入引导倒计时 |
| `recoveryMs` | 施法后停顿时间 | number | 是 | 只在该技能成功释放完成后开始计算，类似技能后摇 |
| `damageType` | 伤害类型 | string | 否 | 当前支持 `physical / magic`，留空时程序默认按物理伤害处理 |
| `playerDamage` | 对玩家伤害 | number | 否 | 仅在命中玩家时生效 |
| `partyDamageOnHit` | 命中玩家时队伍伤害 | number | 否 | 可为 0 |
| `partyDamageOnMiss` | 未命中玩家时队伍伤害 | number | 否 | 常用于 OT 或固定打队伍 |
| `pressureOnHit` | 命中玩家时队伍压力变化 | number | 否 | 可为 0 |
| `pressureOnMiss` | 未命中玩家时队伍压力变化 | number | 否 | 常用于 OT 或固定打队伍 |
| `appliedTargetStatusIdsCsv` | 对目标施加状态 ID 列表 | csv string | 否 | 技能成功完成 `castTimeMs` 后，对本次锁定目标施加；引用下方三张状态表 |
| `appliedSelfStatusIdsCsv` | 对自身施加状态 ID 列表 | csv string | 否 | 技能成功完成 `castTimeMs` 后，对施法敌人自身施加；引导施法的自身状态主要填这里 |
| `castBreakRule` | 施法阻止规则 | string | 是 | 决定该施法可被何种方式阻止 |
| `dangerLevel` | 危险等级 | string | 否 | `low / medium / high`；留空按 `low` 处理 |

合法 `targetRuleId`：

- `threatTarget`：打当前仇恨目标
- `tankAndParty`：伤害/压力仍按当前锁定目标走原有分支；但 `appliedTargetStatusIdsCsv` 中的玩家 Debuff 和队伍 Debuff 会同时生效
- `party`：固定打队伍
- `otherEnemy`：对其他敌人施放
- `self`：对自身施放
- `mostInjured`：对敌人中当前损失生命值最多的存活目标施放，可能选中自己；损失生命值按 `maxHp - hp` 计算，常用于治疗类敌方技能。

合法 `damageType`：

- `physical`：物理伤害，会被 `shield_block` / 盾牌格挡这类物理减伤状态影响
- `magic`：魔法伤害，当前不会被盾牌格挡影响

说明：

- 当 `targetRuleId = party` 时，程序读取 `partyDamageOnMiss / pressureOnMiss` 作为主值
- 当 `targetRuleId = threatTarget` 且仇恨在玩家身上时，读取 `OnHit` 分支
- 当 `targetRuleId = threatTarget` 且仇恨丢失时，读取 `OnMiss` 分支
- `appliedTargetStatusIdsCsv` 会按状态 ID 所在状态表决定落点：命中玩家时只施加 `玩家Debuff`，命中队伍或 `targetRuleId = party` 时只施加 `队伍Debuff`；`敌方Buff` 仍按 `otherEnemy / self` 这类敌方目标规则施加。
- `targetRuleId = tankAndParty` 是状态落点例外：不论本次锁定目标是谁，`appliedTargetStatusIdsCsv` 中的 `玩家Debuff` 会给玩家，`队伍Debuff` 会给队伍。

合法 `castBreakRule`：

- `interruptOrControl`：可被打断类或控制类技能阻止
- `controlOnly`：只能被控制类技能阻止
- `unstoppable`：当前施法不可被阻止

施法节奏结算：

- 敌人技能完整完成读条后，才会进入该技能的 `recoveryMs`；`castTimeMs=1500,recoveryMs=1000` 表示一次成功出手周期为 2.5 秒。
- 技能读条未完成前被控制类效果阻止时，不会开始该技能的 `recoveryMs`；控制结束后会重新从完整 `castTimeMs` 开始尝试同一个技能。
- 技能读条未完成前被打断类效果阻止时，不会开始该技能的 `recoveryMs`；敌人改为等待 `敌人定义.counteredDurationMs`，随后推进到技能循环中的下一个技能。
- 如果 `counteredDurationMs` 缺省或为 `-1`，则使用触发打断的玩家技能效果 `durationMs`；若仍缺省则为 `0`。
- `channelingMs > 0` 时，技能在完成 `castTimeMs` 并立即结算伤害/状态后进入引导阶段；引导阶段 UI 读条按剩余时间从右向左倒计时，目标继承该技能开始施法时锁定的目标。
- 引导自然结束后，会触发施法敌人身上各状态自己的 `onChannelStop` 逻辑，随后进入该技能的 `recoveryMs` 并推进技能循环。
- 引导期间被控制或打断等方式中止时，同样触发施法敌人身上各状态自己的 `onChannelStop` 逻辑；控制类中止在不能施法状态结束后进入技能循环下一个技能，打断类中止等待 `counteredDurationMs` 后进入下一个技能。
- 用状态表达引导效果时，将状态 ID 填入 `appliedSelfStatusIdsCsv`。只有该状态的 `effectLogicId` 注册了“引导停止时结束”的处理器时，才会在引导自然结束、控制中止或打断中止时被移除；不会因为状态由引导技能施加，或 `effectLogicId` 名字包含 `channel`，就被底层统一清除。

`dangerLevel` 规则：

- `high`：无论本次施法目标是玩家、队伍还是其他目标，都会让敌人血条框播放高危提示动画，并产生战斗警告文案。
- `medium`：只有本次施法目标为 `party` 时，敌人血条框播放高危提示动画；不会产生战斗警告文案。
- `low`：不触发高危提示动画，也不产生战斗警告文案。
- `dangerLevel` 只影响 UI 提示和战斗警告，不改变伤害、仇恨、施法时间、目标选择或打断规则。

## 4. 状态定义

三张状态表字段一致：

- `敌方Buff`
- `玩家Debuff`
- `队伍Debuff`

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `statusId` | 状态 ID | string | 是 | 程序内唯一标识 |
| `statusName` | 状态名称 | string | 是 | 图标悬浮说明与文案用名 |
| `iconId` | 图标资源 ID | string | 是 | 引用 `图标资源映射.iconId`；运行时状态图标优先使用该字段 |
| `durationMs` | 持续时间 | number | 是 | 单位毫秒；`-1` 表示永久持续到战斗结束，除非被明确移除 |
| `isDispellable` | 是否可驱散 | boolean | 是 | 先作为配置记录 |
| `description` | 状态效果说明 | string | 是 | 面向策划与后续 UI 说明 |
| `effectLogicId` | 状态效果逻辑接口 ID | string | 是 | 程序用受控 ID 去连接逻辑 |

### 可叠加状态语义

当前通用叠加规则是“整组刷新”，不是每层独立计时：

- 首次施加可叠加状态时，创建 1 层。
- 再次施加同一个 `statusId` 时，层数 +1，不超过运行时定义的 `maxStacks`。
- 再次施加会用新状态覆盖整组状态的 `remainingMs / totalMs`，因此整组层数刷新到完整持续时间。
- 持续时间结束时，整组状态一起移除，不逐层掉层。

当前 `soulSensitive_status` 与 `soulSensitive_p_status` 运行时最大层数为 5。以当前第三章表为例，`灵魂敏感` 叠加后会刷新到完整 7000ms；从最近一次施加后经过 7000ms，所有层数一起消失。

### `effectLogicId` 当前约定

Excel 不直接写代码，只写受控 ID。
当前已实现或保留的接口形态：

- `none`：纯展示或逻辑待实现
- `enemy_heal_small`：敌方小额自疗示例
- `channel_self_until_end`：敌方自身状态在来源引导技能自然结束、被控制中止或被打断中止时移除；用于描述中写明“在 xxxx 引导停止时结束”的状态
- `wind_strike!_status`：敌方自身引导状态；引导期间每 0.5 秒对本次锁定目标造成 5 点伤害，并在来源引导技能停止时移除

后续如果扩展新的真实效果，继续新增新的 `effectLogicId` 即可，不要把脚本或公式直接写进 Excel。

当前通用状态补充：

- `countered`：敌人施法被成功打断后进入的短暂僵直状态

## 5. 图标资源映射

工作表：`图标资源映射`

这张表用于把敌人状态、关卡图例、词缀/规则展示所引用的 `iconId` 映射到实际资源文件名。当前状态图标资源位于 `public/status-icons/`，运行时会先把 `assetKey` 中非 `A-Za-z0-9_-` 的字符替换为 `-`，再组装为 `/status-icons/{sanitizedAssetKey}.svg`，旧的内置图标表只作为兜底。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `iconId` | 图标 ID | string | 是 | 供状态表、关卡图例、词缀/规则引用 |
| `iconName` | 图标名称 | string | 是 | 供策划阅读 |
| `assetKey` | 资源键 | string | 是 | 对应 `public/status-icons/{sanitizedAssetKey}.svg` 的文件名主体；例如 `got!` 会查找 `got-.svg` |
| `iconType` | 图标类型 | string | 是 | 当前敌方数据中统一填写 `status` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 6. 关卡如何引用敌人目录

关卡不再写 `enemyKind`。
现在通过：

- `encounter_balance.xlsx -> 关卡编队 -> enemyIdsCsv`

引用 `enemy_data.xlsx -> 敌人定义 -> enemyId`。

## 7. 相关代码位置

- Excel 读取：`src/game/data/workbookLoader.ts`
- 敌人目录：`src/game/data/enemyCatalog.ts`
- 关卡遭遇：`src/game/data/encounterTemplates.ts`
- 战斗解析：`src/game/encounter/encounterFactory.ts`
