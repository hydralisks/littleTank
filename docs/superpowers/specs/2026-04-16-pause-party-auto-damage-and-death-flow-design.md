# Pause Overlay, Party Auto Damage, And Death Flow Design

**Context**

当前 demo 已支持玩家手动释放技能、敌方施法阻止规则、战斗胜负结算按钮和 5x5 敌方框体。  
本轮要继续把战斗推进到更接近真实可玩状态，新增四类能力：

- 战斗中主动暂停，并在暂停时冻结战斗推进
- 每关独立配置“队伍自动伤害”规则
- 敌人死亡后保留在原位置但退出战斗逻辑
- 敌方血条第一行文案改为“名称 当前 HP/最大 HP >当前目标”，并给死亡敌人显示鬼魂占位

这轮仍然保持现有 `EncounterState -> tickEncounter -> finalizeEncounterState` 的单状态机结构，不引入新的导演层。

## Scope

本轮处理：

- 战斗中 `我说停停` 按钮
- `Esc` 键触发暂停层的优先级规则
- 暂停态下冻结战斗推进
- 关卡级 `partyAutoDamageIntervalMs / partyAutoDamageTargetCount / partyAutoDamageMin / partyAutoDamageMax`
- 队伍自动伤害的运行时结算
- 敌人死亡、死亡后退出逻辑目标池、全灭胜利
- 敌方血条文本更新与死亡鬼魂 UI
- `.xlsx` 样例、读取器、接口文档、更新日志同步

本轮不处理：

- 死亡敌人复活机制
- 以死亡敌人为目标的特殊技能体系
- 伤害飘字、音效、击杀动画
- 更细的暂停菜单导航或确认框

## Approach

采用“最小侵入扩展”：

1. 在 `EncounterState` 和 `EncounterStageContext` 中增加暂停与队伍自动伤害所需字段。
2. 在 `tickEncounter` 中统一处理：
   - 暂停时直接冻结
   - 自动伤害计时
   - 敌人死亡后的 AI 跳过
3. 在 `finalizeEncounterState` 中保留所有敌人槽位，不再删除死亡敌人，只基于“活着的敌人列表”做选中目标和胜利判断。
4. UI 继续复用现有结算按钮风格，为暂停额外弹出第三个按钮 `继续继续`。

## Data Model

### 1. EncounterStageContext 新增字段

- `partyAutoDamageIntervalMs`
  - 中文：队伍自动伤害间隔
  - 类型：number
  - 作用：每隔多久结算一次自动伤害
- `partyAutoDamageTargetCount`
  - 中文：队伍自动伤害目标数
  - 类型：number
  - 作用：每次结算随机命中的活敌人数
- `partyAutoDamageMin`
  - 中文：队伍自动伤害最小值
  - 类型：number
- `partyAutoDamageMax`
  - 中文：队伍自动伤害最大值
  - 类型：number

### 2. EncounterRuntime 新增字段

- `partyAutoDamageRemainingMs`
  - 中文：距离下一次队伍自动伤害剩余时间
  - 类型：number
- `pauseOverlay`
  - 中文：暂停层状态
  - 类型：`null | 'pause'`

### 3. EnemyState 死亡约定

本轮不新增独立 `isDead` 字段，直接使用：

- `hp <= 0` 视为死亡

但运行时行为调整为：

- 死亡敌人实例仍然保留在 `enemies` 数组中
- 死亡敌人不再施法，不再进入下一轮技能循环
- 死亡敌人不会被普通目标选择逻辑命中
- 死亡敌人不会被队伍自动伤害选中

## Runtime Rules

### 1. 暂停

- 点击 `我说停停` 按钮时，若战斗尚未结束，则将 `pauseOverlay='pause'`
- 若 `pauseOverlay='pause'`：
  - `tickEncounter` 直接返回冻结状态
  - 不推进 `timeMs`
  - 不推进技能冷却、GCD、状态时间
  - 不推进敌人施法与恢复时间
  - 不推进队伍自动伤害计时
- 点击 `继续继续` 后恢复为 `pauseOverlay=null`

### 2. Esc 优先级

- 若当前有 `skills / passives / stage` 面板打开，`Esc` 先关闭该面板
- 若没有打开面板，且战斗未结束，`Esc` 打开暂停层
- 若战斗已结束，`Esc` 不改变当前结算层

### 3. 队伍自动伤害

- 每当 `partyAutoDamageRemainingMs <= 0` 时触发一次自动伤害结算
- 从“活着的敌人”中随机选最多 `partyAutoDamageTargetCount` 个目标
- 对每个选中目标各自结算一次随机伤害：
  - 区间 `[partyAutoDamageMin, partyAutoDamageMax]`
- 若活敌数量小于目标数，则只命中这些活敌
- 结算后重置 `partyAutoDamageRemainingMs = partyAutoDamageIntervalMs`

### 4. 敌人死亡

- 敌人被玩家技能或队伍自动伤害打到 `hp <= 0` 后：
  - `hp` 归零
  - 当前施法立即清空
  - `recoveryRemainingMs` 归零
  - `pendingRetryCastSkillId` 清空
- 死亡敌人不能：
  - 成为 Tab 轮换目标
  - 成为玩家普通敌方目标技能目标
  - 成为队伍自动伤害目标
  - 执行施法或恢复后重新开读条

### 5. 胜负判断

保持原失败优先级：

1. 玩家生命为 0 -> 失败
2. 队伍生命为 0 -> 失败
3. 队伍压力达到上限 -> 失败
4. 若尚未失败，且所有敌人均死亡 -> 胜利

这样满足“在到达任何失败条件之前所有怪物均死亡则玩家获胜”。

## UI Rules

### 1. 头部暂停按钮

- 放在左上角关卡名称右侧
- 文案：`我说停停`

### 2. 暂停弹层

- 沿用结算按钮的大图标按钮风格
- 不虚化整个界面
- 按钮为：
  - `算他厉害`
  - `我不信了`
  - `继续继续`

### 3. 敌人血条第一行

改为：

- `敌人名称 当前HP/最大HP >当前目标`

示例：

- `雾刃潜猎者 440/500 >坦克`

不再显示敌人实例额外字母编号，但内部 `enemy.id` 保留。

### 4. 敌人死亡样式

- 保留原 5x5 位置
- 血条整体暗化
- 叠加明显鬼魂图标
- 不显示施法条推进
- 目标文案显示为 `已死亡`

## Testing Strategy

优先补战斗层测试：

1. 暂停时 `tickEncounter` 不推进时间和状态
2. 自动伤害每周期只命中活敌
3. 自动伤害可击杀敌人，死亡后停止施法
4. 所有敌人死亡时战斗胜利

其次补 UI/交互最小测试或行为验证：

1. `我说停停` 可打开暂停层
2. `Esc` 在面板打开时先关面板
3. `Esc` 在无面板时打开暂停层
4. `继续继续` 可恢复战斗

数据同步检查：

1. 关卡表能读入新增自动伤害字段
2. 生成脚本会为样例关卡写入 3 条示例
3. 文档明确字段名、中文含义与行为

## Files Expected To Change

- `src/game/encounter/encounterTypes.ts`
- `src/game/encounter/encounterFactory.ts`
- `src/game/encounter/encounterFactory.test.ts`
- `src/game/data/encounterTemplates.ts`
- `src/game/data/workbookLoader.ts`
- `src/game/data/stageTemplates.ts`
- `src/ui/EncounterScreen.tsx`
- `src/ui/EnemyRaidFrameItem.tsx`
- `src/styles/encounter.css`
- `scripts/generateDesignerWorkbooks.mjs`
- `STAGE_DATA_INTERFACE_SPEC.md`
- `DEVELOPMENT_HANDOFF.md`
- `开发更新日志.md`

## Notes

- 由于现有仓库未使用 git，本轮只落盘 spec、plan、代码和文档，不执行提交步骤。
- 敌人死亡后“保持占位但退出逻辑”是本轮的关键边界，不应再沿用旧的“只保留活敌数组”做法。
