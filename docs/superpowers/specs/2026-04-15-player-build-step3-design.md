# 第三步设计稿：玩家构筑、玩家来源状态与跨关卡继承

## 1. 目标

本步骤重构玩家侧数据接口，使策划可通过 `.xlsx` 文件配置以下内容：

- 主动技能定义
- 被动天赋定义
- 玩家主动技能导致的状态
- 玩家被动天赋导致的状态
- 每关使用的构筑规则
- 默认构筑预设

本步骤同时明确战斗界面的展示边界：

- `技能配置` 与 `被动天赋` 面板只展示玩家可选择内容，以及这些内容可能带来的玩家来源状态。
- `本场状态` 面板只展示本关实际出现、且不由玩家构筑直接产生的状态图例，即敌人来源状态与关卡来源状态。

本步骤不把状态逻辑脚本写入 Excel。Excel 只写受控接口 ID，例如 `skillLogicId`、`talentLogicId`、`effectLogicId`。

## 2. 总体方案

玩家侧数据新增一个独立策划入口文件：

- `public/designer-data/player_build.xlsx`

关卡侧继续使用：

- `public/designer-data/encounter_balance.xlsx`

敌人侧继续使用：

- `public/designer-data/enemy_data.xlsx`

三者职责固定如下：

- `player_build.xlsx`：维护玩家构筑与玩家来源状态。
- `enemy_data.xlsx`：维护敌人定义、敌人技能、敌人来源状态。
- `encounter_balance.xlsx`：维护关卡开场、敌人布置、关卡词缀、特殊规则，以及关卡来源状态的挂接关系。

## 3. 数据边界

### 3.1 状态来源拆分

状态按策划来源拆成三组，避免不同系统混写同一张表：

1. 玩家来源状态
   - 来源：主动技能、被动天赋
   - 维护位置：`player_build.xlsx`
   - 展示位置：`技能配置`、`被动天赋`

2. 敌人来源状态
   - 来源：敌人技能命中后施加给敌人、玩家、队伍的状态
   - 维护位置：`enemy_data.xlsx`
   - 展示位置：`本场状态`

3. 关卡来源状态
   - 来源：关卡词缀、特殊规则引用或触发的状态
   - 维护位置：`encounter_balance.xlsx`
   - 展示位置：`本场状态`

程序运行时仍然统一解析为状态定义注册表，但策划入口必须保持分离。

### 3.2 关卡与构筑规则的绑定

`encounter_balance.xlsx -> 关卡开场` 新增字段：

- `buildRuleId`

每一关只绑定一条构筑规则。构筑规则的具体内容不写在关卡表里，而是由 `player_build.xlsx -> 构筑规则定义` 提供。

## 4. 工作簿与工作表

文件：`player_build.xlsx`

工作表：

- `构筑规则定义`
- `主动技能定义`
- `主动技能状态定义`
- `被动天赋定义`
- `被动天赋状态定义`
- `默认主动构筑`
- `默认被动构筑`
- `图标资源映射`

## 5. 表结构

### 5.1 构筑规则定义

用途：定义某一关允许玩家如何构筑。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `buildRuleId` | 构筑规则 ID | string | 是 | 主键 |
| `ruleName` | 规则名称 | string | 是 | 如 `教程 1：双技能入门` |
| `description` | 规则说明 | string | 是 | 用于 UI 展示 |
| `totalBuildPoints` | 总技能点 | number | 是 | 主动技能与被动天赋共用 |
| `maxActiveSlots` | 最多主动槽位数 | number | 是 | 取值 `1~8` |
| `enabledHotkeysCsv` | 开放按键列表 | csv string | 是 | 例如 `1,2,3,4,Q` |
| `inheritancePolicy` | 构筑继承策略 | string | 是 | 见 7.1 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

2026-05-05 更新：`allowedActiveSkillIdsCsv`、`allowedTalentIdsCsv`、`forcedSkillIdsCsv`、`forcedTalentIdsCsv`、`lockedSkillIdsCsv`、`lockedTalentIdsCsv` 已从正式接口删除。主动技能解锁改由 `stage_content.xlsx -> 关卡.unlockedActiveSkillIdsCsv` 按当前关卡前缀累计；被动天赋解锁改由 `被动天赋定义.tier` 与当前关卡 boss 前规则决定。

### 5.2 主动技能定义

用途：定义主动技能本体。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `skillId` | 主动技能 ID | string | 是 | 主键 |
| `skillName` | 技能名称 | string | 是 | |
| `shortName` | 技能短名称 | string | 是 | 用于技能栏展示 |
| `description` | 技能说明 | string | 是 | |
| `iconId` | 图标 ID | string | 是 | 引用 `图标资源映射` |
| `pointCost` | 技能点消耗 | number | 是 | 默认可统一写 `4`，也允许单独覆盖 |
| `resourceCost` | 资源消耗 | number | 是 | |
| `cooldownMs` | 冷却时间 | number | 是 | 单位毫秒 |
| `initialRemainingCooldownMs` | 开场剩余冷却 | number | 否 | 留空表示 `0` |
| `gcdMs` | 公共冷却 | number | 是 | |
| `targetingType` | 目标类型 | string | 是 | 见 6.1 |
| `skillLogicId` | 技能逻辑接口 ID | string | 是 | 程序侧受控逻辑入口 |
| `grantedStatusIdsCsv` | 可能施加的状态 ID 列表 | csv string | 否 | 引用 `主动技能状态定义.statusId` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

### 5.3 主动技能状态定义

用途：定义玩家主动技能导致的状态。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `statusId` | 状态 ID | string | 是 | 主键 |
| `statusName` | 状态名称 | string | 是 | |
| `statusCategory` | 状态类别 | string | 是 | 见 6.2 |
| `iconId` | 图标 ID | string | 是 | |
| `durationMs` | 持续时间 | number | 是 | 单位毫秒 |
| `maxStacks` | 最大层数 | number | 否 | 留空默认 `1` |
| `dispellable` | 是否可驱散 | boolean | 否 | |
| `description` | 效果描述 | string | 是 | |
| `effectLogicId` | 状态逻辑接口 ID | string | 是 | 程序侧受控逻辑入口 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

### 5.4 被动天赋定义

用途：定义被动天赋本体。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `talentId` | 被动天赋 ID | string | 是 | 主键 |
| `talentName` | 被动名称 | string | 是 | |
| `category` | 天赋分类 | string | 是 | `player / skill / team` |
| `cost` | 技能点消耗 | number | 是 | 推荐 `1~3` 为主 |
| `description` | 天赋说明 | string | 是 | |
| `iconId` | 图标 ID | string | 是 | |
| `talentLogicId` | 天赋逻辑接口 ID | string | 是 | 程序侧受控逻辑入口 |
| `grantedStatusIdsCsv` | 可能产生的状态 ID 列表 | csv string | 否 | 引用 `被动天赋状态定义.statusId` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

### 5.5 被动天赋状态定义

用途：定义玩家被动天赋导致的常驻或触发型状态。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `statusId` | 状态 ID | string | 是 | 主键 |
| `statusName` | 状态名称 | string | 是 | |
| `statusCategory` | 状态类别 | string | 是 | 见 6.2 |
| `iconId` | 图标 ID | string | 是 | |
| `durationMs` | 持续时间 | number | 是 | `0` 可表示常驻或由逻辑控制 |
| `maxStacks` | 最大层数 | number | 否 | 留空默认 `1` |
| `dispellable` | 是否可驱散 | boolean | 否 | |
| `description` | 效果描述 | string | 是 | |
| `effectLogicId` | 状态逻辑接口 ID | string | 是 | 程序侧受控逻辑入口 |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

### 5.6 默认主动构筑

用途：定义新档或继承失败时的兜底主动技能配置。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `presetId` | 预设 ID | string | 是 | 如 `default` |
| `buildRuleId` | 适用构筑规则 ID | string | 否 | 留空表示通用 |
| `hotkey` | 按键 | string | 是 | `1 / 2 / 3 / 4 / Q / E / R / F` |
| `skillId` | 技能 ID | string | 否 | 留空表示空槽 |
| `priority` | 保留优先级 | number | 否 | 数字越小越优先 |

### 5.7 默认被动构筑

用途：定义新档或继承失败时的兜底被动配置。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `presetId` | 预设 ID | string | 是 | |
| `buildRuleId` | 适用构筑规则 ID | string | 否 | 留空表示通用 |
| `talentId` | 被动天赋 ID | string | 是 | |
| `selected` | 是否默认选中 | boolean | 是 | |
| `priority` | 保留优先级 | number | 否 | 数字越小越优先 |

### 5.8 图标资源映射

用途：将策划填写的 `iconId` 映射到程序资源键。

| 字段名 | 中文含义 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `iconId` | 图标 ID | string | 是 | 主键 |
| `iconName` | 图标名称 | string | 是 | |
| `assetKey` | 资源键名 | string | 是 | 前端图标资源查找入口 |
| `iconType` | 图标类型 | string | 是 | `skill / talent / status` |
| `enabled` | 是否启用 | boolean | 否 | 默认 `true` |

## 6. 受控枚举与接口 ID 约定

### 6.1 `targetingType` 当前约定

- `none`
- `currentEnemy`
- `crossEnemy`
- `allEnemy`
- `self`
- `party`

### 6.2 `statusCategory` 当前约定

- `playerBuff`
- `enemyDebuff`
- `partyBuff`
- `partyDebuff`

### 6.3 `inheritancePolicy` 当前约定

- `keep_active_first`
- `keep_balanced`
- `reset_to_default`

### 6.4 逻辑接口 ID 约定

Excel 只写接口 ID，不写脚本。

推荐首批 `skillLogicId`：

- `taunt_single`
- `interrupt_cast`
- `stun_single`
- `mass_taunt`
- `shield_wall`
- `cleave_adjacent`
- `burst_single`
- `panic_recovery`

推荐首批 `talentLogicId`：

- `player_max_hp_up`
- `resource_regen_up`
- `grant_permanent_buff`
- `stun_hits_cross`
- `interrupt_ignore_gcd`
- `burst_half_cd_lower_effect`
- `party_pressure_drift_down_with_periodic_stun`
- `party_hp_half_taunt_cd_down`
- `bonus_build_points_with_pressure_drift_up`

推荐首批 `effectLogicId`：

- `player_damage_reduction`
- `enemy_stunned`
- `enemy_taunted`
- `party_pressure_relief_over_time`
- `party_hp_regen_over_time`
- `player_resource_regen_up`
- `enemy_damage_down`

## 7. 跨关卡继承旧构筑

### 7.1 默认策略

推荐默认策略为 `keep_active_first`。目标是让玩家进入新关卡时尽量保留上一关的主动技能思路，只在必要时压缩或清空不兼容部分。

### 7.2 进入新关卡时的处理流程

1. 读取玩家上一关结束时保存的构筑。
   - 主动技能槽位分配
   - 已选被动天赋

2. 读取新关卡的 `buildRuleId` 对应规则。
   - 总技能点
   - 最大主动槽位数
   - 开放按键
   - 允许或禁用的主动技能
   - 允许或禁用的被动天赋
   - 强制携带的主动技能与被动天赋
   - 继承策略

3. 先移除明确非法内容。
   - 新关禁用的主动技能
   - 新关禁用的被动天赋
   - 落在未开放热键上的主动技能
   - 超出 `maxActiveSlots` 的主动槽位内容

4. 再插入强制内容。
   - 强制主动技能优先放入空槽
   - 没有空槽时，顶掉优先级最低的非强制主动技能
   - 强制被动天赋若未选中则强制加入

5. 检查点数是否合法。
   - 若超出总点数，先移除被动天赋
   - 若仍超出，再移除主动技能
   - 被移除内容对应点数自动返还

6. 若构筑被清理后为空或严重残缺，则回退到默认构筑。
   - 主动技能使用 `默认主动构筑`
   - 被动天赋使用 `默认被动构筑`

### 7.3 优先级规则

默认优先级按以下顺序：

主动技能：

1. 强制技能
2. 上一关已装备且当前仍合法的技能
3. 当前规则的默认主动构筑技能
4. 其他空槽

被动天赋：

1. 强制天赋
2. 与已保留主动技能有关联、且仍合法的被动
3. 其他上一关已选被动
4. 当前规则的默认被动构筑

### 7.4 冲突提示

进入新关卡后，如发生继承冲突，战前准备界面顶部显示构筑调整提示，至少包含以下信息：

- 因新规则被移除的主动技能
- 因新规则被移除的被动天赋
- 因热键未开放被清空的槽位
- 因总点数不足而自动取消的被动天赋
- 因强制规则而自动加入的技能或被动

该提示只负责解释系统自动调整了什么，不允许直接在提示里修改构筑。

## 8. UI 展示规则

### 8.1 技能配置面板

展示内容：

- 当前规则下可用的主动键位
- 主动技能库
- 技能点消耗
- 主动技能带来的玩家来源状态图标与说明

不展示：

- 敌人来源状态
- 关卡来源状态

### 8.2 被动天赋面板

展示内容：

- 可选被动天赋
- 技能点消耗
- 被动天赋带来的玩家来源状态图标与说明

不展示：

- 敌人来源状态
- 关卡来源状态

### 8.3 本场状态面板

展示内容：

- 本关词缀说明
- 本关特殊规则说明
- 本关敌人可施加的状态图例
- 本关词缀可施加的状态图例
- 本关特殊规则关联的状态图例

不展示：

- 玩家主动技能导致的状态
- 玩家被动天赋导致的状态

## 9. 实现范围

本步骤的实现范围包括：

- 新增 `player_build.xlsx` 及样例数据
- 读取并解析玩家构筑工作簿
- 用工作簿替换当前硬编码的主动技能、被动天赋与默认构筑
- 在关卡开场中新增 `buildRuleId` 并接入运行时
- 加入跨关卡继承与规范化逻辑
- 在 `技能配置`、`被动天赋`、`本场状态` 中按来源展示对应状态
- 更新策划文档与项目交接文档

本步骤暂不实现的内容：

- 新的复杂技能逻辑
- 新的复杂天赋逻辑
- `effectLogicId` 对应的全部高级状态脚本

这些逻辑接口仅在本步骤留好绑定入口。
