# 战士T技能天赋设计入口

## 2026-04-17 追加说明：仇恨字段怎么填

- 如果技能会造成伤害并希望同时建立仇恨，请在 `主动技能效果` 中填写：
  - `valueA / valueB`
  - `threatMultiplier`
  - `threatDelta`
  - `threatSource`
- 当前程序对伤害类技能使用：
  - `threat = damage × threatMultiplier + threatDelta`
- 推荐：
  - 常规坦克伤害技能先按 `threatMultiplier = 5`
  - 纯嘲讽/纯控制技能先按 `threatMultiplier = 0`
  - `threatSource` 默认填 `player`

这份文档给策划直接使用，说明战士T相关内容应该去哪些 `.xlsx` 表里填写，以及每张表当前应填写哪些字段。

## 1. 总入口

策划主要编辑文件：

- `public/designer-data/player_build.xlsx`

本轮与战士T直接相关的工作表建议使用：

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

## 2. 先填哪些表

推荐顺序：

1. 先在 `职业定义` 建 `warrior_t`
2. 再填 `主动技能定义`
3. 再填 `主动技能效果`
4. 再填 `被动天赋定义`
5. 再填 `被动天赋效果`
6. 最后补 `状态定义 / 默认构筑 / 图标映射`

## 3. 每张表字段

### 3.1 `职业定义`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `classId` | 职业ID | 是 | 例：`warrior_t` |
| `className` | 职业名 | 是 | 例：`战士T` |
| `roleTag` | 职能标签 | 是 | 例：`tank` |
| `classDescription` | 职业说明 | 是 | UI描述 |
| `recommendedBuildRuleIdsCsv` | 推荐构筑规则列表 | 否 | 逗号分隔 |
| `enabled` | 是否启用 | 否 | 默认 `true` |

### 3.2 `主动技能定义`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `skillId` | 技能ID | 是 | 建议前缀：`warrior_t_` |
| `classId` | 所属职业ID | 是 | 例：`warrior_t` |
| `skillName` | 技能名称 | 是 | 中文全名 |
| `shortName` | 技能短名 | 是 | 技能栏显示 |
| `description` | 技能说明 | 是 | 说明效果和定位 |
| `iconId` | 图标ID | 是 | 需要在 `图标资源映射` 存在 |
| `pointCost` | 占用技能点 | 是 | 主动默认 4 |
| `resourceCost` | 资源消耗 | 是 | 怒气等 |
| `cooldownMs` | 冷却时间 | 是 | 毫秒 |
| `initialRemainingCooldownMs` | 开场剩余冷却 | 否 | 默认 0 |
| `gcdMs` | 公共冷却 | 是 | 毫秒 |
| `targetingType` | 目标类型 | 是 | 当前支持 `currentEnemy / crossEnemy / matrix3x3Enemy / topLeft2x2Enemy / allEnemy / party / self` |
| `skillLogicId` | 技能主逻辑接口ID | 是 | 释放技能时，程序通过它找主处理器 |
| `castStopMode` | 阻断类型 | 是 | `none / interrupt / control` |
| `canAffectSkull` | 是否可作用首领 | 是 | `true / false` |
| `skillTagsCsv` | 技能标签列表 | 否 | 例：`threat,survival` |
| `uiOrder` | UI排序 | 否 | 数值越小越靠前 |
| `unlockHint` | 解锁说明 | 否 | 教程/限制用 |
| `grantedStatusIdsCsv` | 可能施加的状态ID | 否 | 逗号分隔 |
| `enabled` | 是否启用 | 否 | 默认 `true` |

### 3.3 `主动技能效果`

主动技能关卡前缀解锁规则：

- 运行时会在构筑规则之外，再按 `stage_content.xlsx -> 关卡.unlockedActiveSkillIdsCsv` 做当前关卡前缀累计解锁。
- `unlockedActiveSkillIdsCsv` 表示“这一关新增解锁的主动技能 ID”，填写逗号分隔的 `主动技能定义.skillId`。
- 进入某关时，程序会累计 `stageOrder` 中从第一关到当前关的所有 `unlockedActiveSkillIdsCsv`，作为本关可用主动技能集合。
- 例如进入 `2-4` 时，可以使用第一大关 `1-1` 到 `1-6` 解锁的所有技能，以及 `2-1 / 2-2 / 2-3 / 2-4` 解锁的技能。
- 该限制只看当前关卡前缀，不看玩家最高进度。因此即使已经完成 `2-6`，重玩 `1-6` 时仍只能使用 `1-1` 到 `1-6` 前缀累计解锁的主动技能。

一行代表一个效果片段，一个技能可以有多行。

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `skillEffectId` | 技能效果ID | 是 | 唯一键 |
| `skillId` | 所属技能ID | 是 | 对应 `主动技能定义.skillId` |
| `effectIndex` | 生效顺序 | 是 | 从 1 开始 |
| `skillLogicId` | 效果备注逻辑ID | 否 | 可选备注字段；不决定技能释放时调用哪个处理器 |
| `targetSelector` | 该段效果目标 | 是 | 当前支持 `current / adjacent / cross / matrix3x3 / topLeft2x2 / allEnemy / party / self` |
| `valueA` | 主参数A | 否 | 伤害/治疗/倍率等 |
| `valueB` | 主参数B | 否 | 次参数 |
| `durationMs` | 持续时间 | 否 | 状态或持续效果用 |
| `statusId` | 关联状态ID | 否 | 对应状态表 |
| `threatDelta` | 固定仇恨 | 否 | 当前应理解为 `flatThreat` |
| `threatMultiplier` | 仇恨倍率 | 否 | 有伤害技能建议填写 |
| `threatSource` | 仇恨归属方 | 否 | 当前默认填 `player` |
| `notes` | 策划备注 | 否 | 给后续 agent 看 |
| `enabled` | 是否启用 | 否 | 默认 `true` |

`targetingType` 推荐写法：

说明：

- `主动技能定义.skillLogicId` 是技能释放时的唯一主入口。
- 程序释放技能时，会先用 `主动技能定义.skillLogicId` 找到主处理器，再由这个主处理器根据 `skillId` 读取 `主动技能效果` 表中的一到多行参数。
- `主动技能效果.skillLogicId` 只是可选备注字段，策划通常可以留空。不要通过多行效果填写不同 `skillLogicId` 来拆分一个技能的运行时入口。
- 主动技能效果表不再填写通用 `resourceDelta`。战士T技能如果需要产生怒气，应由该技能的主处理器逻辑实现；天赋和状态影响怒气恢复或消耗时，也通过各自逻辑接口实现。

- `currentEnemy`：当前目标
- `crossEnemy`：当前目标以及上下左右
- `matrix3x3Enemy`：当前目标为中心的 3x3 区域
- `topLeft2x2Enemy`：当前目标为左上角的 2x2 区域
- `allEnemy`：所有敌人
- `party`：己方队伍
- `self`：自身

`targetSelector` 推荐写法：

- `current`
- `adjacent`
- `cross`
- `matrix3x3`
- `topLeft2x2`
- `allEnemy`
- `party`
- `self`

说明：

- `主动技能定义.targetingType` 负责说明技能交互上选什么目标
- `主动技能效果.targetSelector` 负责说明这一段效果实际打到哪些单位
- 若某个技能有多段效果，仍由技能定义层的同一个主处理器统一读取并结算这些效果行

当前程序已经真实读取的常见字段约定：

- `taunt_single` / `mass_taunt`
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
  - 参考当前策划填写：主动技能定义 `description=耗怒物理减伤`，主动技能效果 `notes=物理减伤50%`
  - `durationMs`：盾牌格挡持续时间。当前设计目标为 `7000`。
  - `valueB`：物理减伤比例，`0.5` 表示 50% 物理减伤。
  - `statusId`：当前应填写 `shieldBlock`。
  - 运行时只减免敌人技能表中 `damageType=physical` 的玩家承伤，不减免 `damageType=magic`。
- `cleave_adjacent`
  - `valueA`：主目标伤害
  - `valueB`：次目标伤害
  - `threatDelta`
- `burst_single`
  - `valueA`：伤害
  - `threatDelta`

策划填表时若要让技能真的改数值，优先改这些字段；如果逻辑还没接入，先在 `notes` 里写清预期。

### 3.4 `玩家主动状态定义`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `statusId` | 状态ID | 是 | 唯一键 |
| `classId` | 所属职业ID | 否 | 通用状态可留空 |
| `statusName` | 状态名称 | 是 | 中文 |
| `statusCategory` | 状态分类 | 是 | `playerBuff / enemyDebuff / partyBuff / partyDebuff` |
| `iconId` | 图标ID | 是 | 对应图标表 |
| `durationMs` | 持续时间 | 是 | 常驻填 `0` |
| `maxStacks` | 最大层数 | 否 | 默认 1 |
| `dispellable` | 是否可驱散 | 否 | 默认 false |
| `description` | 状态说明 | 是 | 中文说明 |
| `effectLogicId` | 状态逻辑接口ID | 是 | 先只写接口id |
| `enabled` | 是否启用 | 否 | 默认 `true` |

### 3.5 `被动天赋定义`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `talentId` | 天赋ID | 是 | 建议前缀：`warrior_t_` |
| `classId` | 所属职业ID | 是 | 例：`warrior_t` |
| `talentName` | 天赋名 | 是 | 中文 |
| `category` | 天赋分类 | 是 | `player / skill / party` |
| `cost` | 消耗技能点 | 是 | 建议 1~3 |
| `description` | 天赋说明 | 是 | 中文说明 |
| `iconId` | 图标ID | 是 | 对应图标表 |
| `talentLogicId` | 天赋逻辑接口ID | 是 | 程序靠它挂注册表 |
| `tier` | 层级 | 是 | 被动天赋解锁顺序依据；缺失或无法解析为数字时，该天赋定义行不会进入运行时 |
| `talentTagsCsv` | 天赋标签 | 否 | 例：`survival,anti-cast` |
| `uiOrder` | UI排序 | 否 | 数值越小越靠前 |
| `exclusiveGroup` | 互斥组 | 否 | 同组可限制只能选一个 |
| `grantedStatusIdsCsv` | 可能给予的状态ID | 否 | 逗号分隔 |
| `enabled` | 是否启用 | 否 | 默认 `true` |

`tier` 解锁规则：

- 初始不开放 `tier=0`；最大可用 tier 为 `-1`。
- 完成 `RingingDeeps-3` 后开放 `tier=0`，也就是当前全局第 4 关开始可使用 `tier=0`。
- 进入每个大区 boss 前的第 6 关时，依次开放更高 tier：当前规则下 `RingingDeeps-6` 前可到 `tier=1`，下一大区 boss 前可到 `tier=2`，后续类推。
- 未解锁 tier 的天赋不会出现在可用构筑中，已保存构筑进入关卡时也会被规范化移除。
- 该限制只看当前关卡，不看玩家最高进度。

### 2026-05-14 追加提醒：比例上限被动

- `warrior_t_reinforced_plates` 现在按比例提高玩家生命上限，`valueA=0.5` 表示 +50%。
- `warrior_t_raise_banner` 现在按比例提高队伍压力上限，`valueA=0.5` 表示 +50%。
- 这类效果在关卡开场结算时会同步等比缩放当前值，不会只改上限不改当前值。

### 3.6 `被动天赋效果`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `talentEffectId` | 天赋效果ID | 是 | 唯一键 |
| `talentId` | 所属天赋ID | 是 | 对应 `被动天赋定义.talentId` |
| `effectIndex` | 生效顺序 | 是 | 从 1 开始 |
| `talentLogicId` | 天赋逻辑接口ID | 是 | 一般与天赋定义一致；作为效果行备注/归类，不决定运行时入口 |
| `targetScope` | 影响范围 | 是 | 例：`player,party,skill` |
| `valueA` | 主参数A | 否 | 加成值/倍率等 |
| `valueB` | 主参数B | 否 | 次参数 |
| `statusId` | 关联状态ID | 否 | 若天赋给常驻状态则写这里 |
| `skillId` | 关联技能ID | 否 | 技能改造类天赋常用 |
| `notes` | 策划备注 | 否 | 写明预期逻辑 |
| `enabled` | 是否启用 | 否 | 默认 `true` |

被动天赋入口约定：

- `被动天赋定义.talentLogicId` 是被动天赋生效时的主入口。
- `被动天赋效果.talentLogicId` 与主动技能效果表中的 `skillLogicId` 一样，只作为效果行备注/归类字段。
- 被动处理器会按 `talentId` 读取本表中启用的效果行，并使用 `valueA / valueB / statusId / skillId / targetScope` 作为参数。
- 被动天赋通常在战斗开始前通过构筑计算生效内容，不依赖战斗中动态切换效果行入口。

### 3.7 `玩家被动状态定义`

字段与 `玩家主动状态定义` 基本一致，主要用来放被动天赋带来的常驻或触发状态。

### 3.8 `默认主动构筑`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `presetId` | 预设ID | 是 | 如 `warrior_t_default` |
| `buildRuleId` | 构筑规则ID | 否 | 留空表示通用 |
| `classId` | 所属职业ID | 是 | 例：`warrior_t` |
| `hotkey` | 热键 | 是 | `1/2/3/4/Q/E/R/F` |
| `skillId` | 技能ID | 否 | 留空表示空槽 |
| `priority` | 保留优先级 | 否 | 越小越优先保留 |

### 3.9 `默认被动构筑`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `presetId` | 预设ID | 是 | 如 `warrior_t_default` |
| `buildRuleId` | 构筑规则ID | 否 | 留空表示通用 |
| `classId` | 所属职业ID | 是 | 例：`warrior_t` |
| `talentId` | 天赋ID | 是 | 对应天赋表 |
| `selected` | 是否默认选中 | 是 | `true/false` |
| `priority` | 保留优先级 | 否 | 越小越优先保留 |

### 3.10 `图标资源映射`

| 字段名 | 中文含义 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `iconId` | 图标ID | 是 | 唯一键 |
| `iconName` | 图标名称 | 是 | 中文 |
| `assetKey` | 资源键名 | 是 | 前端查图用 |
| `iconType` | 图标类型 | 是 | `skill / talent / status / class` |
| `enabled` | 是否启用 | 否 | 默认 `true` |

## 4. 战士T录表约定

建议命名规则：

- 职业：`warrior_t`
- 主动技能：`warrior_t_*`
- 被动天赋：`warrior_t_*`
- 玩家状态：`warrior_t_*`
- 构筑预设：`warrior_t_*`

示例：

- `warrior_t_guarding_shout`
- `warrior_t_shield_wall_plus`
- `warrior_t_bastion_oath`

## 5. 给后续 agent 的效果描述格式建议

为了让后续 agent 更容易接逻辑，策划在 `description` 或 `notes` 中尽量写成下面格式：

`目标 + 触发条件 + 直接效果 + 持续时间 + 失败/例外规则`

示例：

- `对当前目标造成 40 点伤害，并提高 30 点仇恨。`
- `对当前目标施加 2 秒昏迷；若目标为首领则无效。`
- `使盾墙持续时间增加 1500ms，并让冷却缩短 20%。`

## 6. 当前阶段说明

当前 demo 已移除旧的 `demo0_*` 主动样例技能；它们不属于正式战士T职业池，也不应继续写回策划表或生成脚本。数据层若仍能看到 `demo0_sample` / `demo0_*` 被动原型残留，只作为历史兼容参考。

后续策划录入正式内容时，应优先使用：

- `warrior_t` 职业
- `warrior_t_*` 技能/天赋/状态命名

不要继续在正式内容里扩写 `demo0_*`。

## 2026-04-30 追加：范围嘲讽与范围控制的填写方式

`taunt` / `stun` 现在是可复用的范围处理器，适合“同一个嘲讽或昏迷效果，只是作用范围不同”的主动技能。

- `主动技能定义.skillLogicId` 填 `taunt` 时，程序会读取 `主动技能定义.targetingType`，并对解析出的每个存活敌人施加效果行中的 `statusId / durationMs / threatDelta`。
- `主动技能定义.skillLogicId` 填 `stun` 时，程序会读取 `主动技能定义.targetingType`，并对解析出的每个可被影响的存活敌人施加昏迷，同时处理可被控制阻止的施法条。
- 范围版本请优先通过 `targetingType` 填 `currentEnemy / crossEnemy / matrix3x3Enemy / topLeft2x2Enemy / allEnemy`，不要为每种范围新增不同的 `skillLogicId`。
- `taunt_single / stun_single` 仍保留给旧数据和单体兼容入口使用。
