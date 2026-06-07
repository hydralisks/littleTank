# littleTank 关卡与数值 Excel 调参说明

## 2026-04-17 追加说明：统一伤害来源

- 战斗运行时已把“持续/周期性伤害”统一收口到 `damageSources`。
- 当前 demo 已接入：
  - 队伍随机伤害
  - 玩家平A
- 关卡策划短期内仍主要改：
  - `encounter_balance.xlsx -> 关卡开场.partyAutoDamage*`
- 若后续开始做更复杂的队友爆发、环境伤害、额外来源，可优先查看并填写：
  - `encounter_balance.xlsx -> 伤害来源定义`
  - `encounter_balance.xlsx -> 关卡伤害来源绑定`

## 2026-04-20 追加说明：特殊规则最小运行版本

- `encounter_balance.xlsx -> 特殊规则定义.ruleLogicId` 已正式接入运行时。
- 当前已实现 3 个最小样例规则：
  - `opening_pressure_shift`
  - `periodic_reinforcement`
  - `player_control_tax`
- 现阶段仍不做通用脚本系统；策划只需要填写：
  - `特殊规则绑定.ruleIdsCsv`
  - `特殊规则定义.ruleLogicId`
  - `特殊规则定义.grantedStatusIdsCsv`
- 更完整的填表入口见：
  - `关卡设计入口.md`

这份文档给关卡策划、数值策划和后续接手 agent 使用。  
当前运行时的真实入口已经是四本 Excel：

- `public/designer-data/stage_content.xlsx`
- `public/designer-data/encounter_balance.xlsx`
- `public/designer-data/enemy_data.xlsx`
- `public/designer-data/player_build.xlsx`

程序启动时会先读取这四本表，再把表内内容覆盖到代码内置基线。  
表里没写的项目继续使用代码默认值。

## 1. 四本表分别负责什么

### `stage_content.xlsx`

负责地图和关卡展示层内容：

- 区域名称、简称、地图标签、区域描述、区域色
- 关卡标题、副标题
- 关卡展示文案和图例文案

### `encounter_balance.xlsx`

负责关卡遭遇层数据：

- 关卡开场数值
- 每关刷出的敌人实例与 `5x5` 站位
- 开场状态
- 关卡词缀绑定
- 词缀定义
- 特殊规则绑定
- 特殊规则定义
- 关卡使用的构筑规则 `buildRuleId`

### `enemy_data.xlsx`

负责敌人目录本体：

- 敌人定义
- 敌人技能定义
- 敌方 Buff
- 玩家 Debuff
- 队伍 Debuff

### `player_build.xlsx`

负责玩家构筑本体：

- 构筑规则定义
- 主动技能定义
- 主动技能状态定义
- 被动天赋定义
- 被动天赋状态定义
- 默认主动构筑
- 默认被动构筑
- 图标资源映射

## 2. 当前读取链路

运行时链路如下：

1. `src/main.tsx`
2. 动态加载 `src/game/data/workbookLoader.ts`
3. `workbookLoader.ts` 读取四本 `.xlsx`
4. 转换成覆盖结构
5. 分别调用：
   - `applyStageWorkbookOverrides(...)`
   - `applyEncounterWorkbookOverrides(...)`
   - `applyEnemyWorkbookOverrides(...)`
   - `applyPlayerBuildWorkbookOverrides(...)`
6. 再进入 React 渲染

## 3. 现在应该去哪里改什么

### 改地图展示文案

去：

- `stage_content.xlsx`

### 改某一关开场值、敌人布置、词缀、特殊规则

去：

- `encounter_balance.xlsx`

重点字段：

- `关卡开场.buildRuleId`
- `关卡开场.partyAutoDamageIntervalMs`
- `关卡开场.partyAutoDamageTargetCount`
- `关卡开场.partyAutoDamageMin`
- `关卡开场.partyAutoDamageMax`
- `敌人布置.row / col`
- `词缀定义.statusId`
- `特殊规则定义.ruleLogicId`

### 改敌人本体、敌人技能、敌人状态

去：

- `enemy_data.xlsx`

### 改玩家技能、被动、构筑规则、默认构筑

去：

- `player_build.xlsx`

## 4. 当前运行时约定

- 词缀当前已简化为“延时后固定施加状态”
- 特殊规则当前通过 `ruleLogicId` 接入最小运行时注册表，不执行复杂脚本逻辑
- 当前已接入的样例规则行为：
  - `opening_pressure_shift`：战斗开始时队伍压力 `+8`
  - `periodic_reinforcement`：每 `3000ms` 给第一个存活敌人施加 `enrage-song`
  - `player_control_tax`：玩家处于 `stunned` 时，每 `1000ms` 队伍压力 `+6`
- 玩家技能和被动当前已实现数据驱动的数值、说明、图标、状态元数据与构筑规则
- 当前八个主动技能的真实战斗行为仍由程序内置 `skillLogicId` 驱动
- 进入新关卡时会根据 `buildRuleId` 自动继承并规范化上一关构筑

## 5. 策划最常用的命令

重新生成样例工作簿：

```powershell
npm run generate:designer-data
```

验证代码和表结构：

```powershell
npm run build
npm run lint
```

## 6. 相关文档

- `ENEMY_DATA_INTERFACE_SPEC.md`
- `STAGE_DATA_INTERFACE_SPEC.md`
- `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- `关卡设计入口.md`
- `DEVELOPMENT_HANDOFF.md`
