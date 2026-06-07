# littleTank

## 2026-04-17 本轮新增

- 战斗运行时新增统一 `damageSources` 模型，已接入：
  - 队伍随机伤害
  - 玩家平A
- 玩家平A规则现为：
  - 默认每 1000ms 对当前选中目标造成 3 点伤害
  - 默认仇恨公式为 `damage × 5 + 0`
  - 当前目标死亡后停手，不会自动转火
  - 重新选择目标后从就绪态立即恢复
- 玩家伤害类技能现支持在 `主动技能效果` 表中填写：
  - `threatMultiplier`
  - `threatSource`
- `encounter_balance.xlsx` 已新增预留工作表：
  - `伤害来源定义`
  - `关卡伤害来源绑定`

`littleTank` 是一个基于 `Vite + React + TypeScript` 的单人坦克职责原型。  
当前重点是把战斗界面、地图选关、技能构筑和数据驱动链路做成可演示、可迭代、可由策划直接改表的版本。

## 2026-04-17 构筑数据接口重构重点

- 正式可玩职业已收敛为 `warrior_t`，中文名为 `战士T`
- 旧 `demo0_*` 主动样例技能已移除；正式主动技能以 `warrior_t_*` 和策划表为准
- `demo0_*` 被动原型残留仅作历史兼容参考，不再作为正式内容扩写入口
- `player_build.xlsx` 已升级为职业层 + 构筑规则层 + 技能/天赋效果层的结构
- 主动技能与被动天赋都已具备“定义表 + 效果表 + 状态表”的策划入口
- 代码侧已改为注册表式扩展：
  - 主动技能模板改造：`src/game/data/playerSkillLogicRegistry.ts`
  - 被动天赋常驻修饰：`src/game/data/playerTalentLogicRegistry.ts`
  - 战斗中技能实际结算：`src/game/encounter/playerSkillRuntimeRegistry.ts`
- 当前策划如果要继续填战士T内容，优先阅读：
  - `战士T技能天赋设计入口.md`
  - `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`

## 当前状态

- 三个区域、十八关的地图选关
- 战斗界面、5x5 敌方框体、玩家状态、队伍状态、技能栏
- `技能配置` / `被动天赋` / `本场状态` 三个面板
- 战斗开始后锁定构筑，战斗结束后解锁
- 关卡与战斗数据通过 `.xlsx` 工作簿覆盖读取
- 敌人数据已拆成：
  - `敌人定义`
  - `敌人技能`
  - `敌方Buff`
  - `玩家Debuff`
  - `队伍Debuff`
- 敌人定义中的技能循环已改为 `skillCycleCsv`
- 敌人威胁逻辑已改为 `threatLogic`
- 关卡遭遇层已拆成：
  - `关卡开场`
  - `敌人布置`
  - `开场状态`
  - `关卡词缀绑定`
  - `词缀定义`
  - `特殊规则绑定`
  - `特殊规则定义`
- 玩家构筑层已拆成独立工作簿：
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
- `关卡开场.buildRuleId` 已正式接入
- 进入新关卡时会默认继承上一关构筑，并按新规则自动规范化与提示冲突
- 默认教程规则与标准规则当前都指向 `warrior_t`
- `demo0_sample` 仍保留在数据层作为历史兼容残留，但不再作为正式默认职业使用

## 启动

```powershell
npm install
npm run dev
```

Agent note: do not run `npm run generate:designer-data` or other commands that overwrite `public/` files unless the user explicitly asks for that generation. `public/designer-data/*.xlsx` is planner-owned working content and may include hand-edited changes.

默认开发地址通常是：

```text
http://127.0.0.1:5173
```

预览构建版可用：

```powershell
npm run build
npm run preview
```

## 常用命令

```powershell
npm run dev
npm run build
npm run lint
```

## 策划可直接修改的文件

- `public/designer-data/stage_content.xlsx`
- `public/designer-data/encounter_balance.xlsx`
- `public/designer-data/enemy_data.xlsx`
- `public/designer-data/player_build.xlsx`

程序启动时会先读取这四本工作簿，再渲染界面。

## 文档入口

- `开发更新日志.md`
- `关卡设计入口.md`
- `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`
- `ENEMY_DATA_INTERFACE_SPEC.md`
- `STAGE_DATA_INTERFACE_SPEC.md`
- `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- `DEVELOPMENT_HANDOFF.md`

## 关键代码位置

- 应用入口：`src/main.tsx`
- Excel 读取：`src/game/data/workbookLoader.ts`
- 关卡基础数据：`src/game/data/stageTemplates.ts`
- 遭遇基础数据：`src/game/data/encounterTemplates.ts`
- 敌人数据目录：`src/game/data/enemyCatalog.ts`
- 玩家构筑目录：`src/game/data/playerBuildCatalog.ts`
- 战斗逻辑：`src/game/encounter/encounterFactory.ts`
- 战斗主界面：`src/ui/EncounterScreen.tsx`
- 地图界面：`src/ui/StageSelectScreen.tsx`

## 接手建议

建议新 agent 按以下顺序阅读：

1. `DEVELOPMENT_HANDOFF.md`
2. `README.md`
3. `关卡设计入口.md`
4. `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`
5. `ENEMY_DATA_INTERFACE_SPEC.md`
6. `STAGE_DATA_INTERFACE_SPEC.md`
7. `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
8. `src/game/data/workbookLoader.ts`
9. `src/game/encounter/encounterFactory.ts`

## 2026-04-16 Manual Skill Control Update

- 战斗中的主动技能已改为玩家手动释放，不再自动演示施法。
- 键盘热键和技能栏点击统一走 `getSkillActivationBlockReason` 校验。
- 技能释放失败原因会暂时显示在队伍状态区的警示文案中。
- 当前样例技能默认可在开场直接使用，便于演示手动操作和冷却表现。
- 新增命令：`npm run test`
- 新增测试文件：[src/game/encounter/encounterFactory.test.ts](/C:/codexCode/littleTank/src/game/encounter/encounterFactory.test.ts)

## 2026-04-16 Cast Break Rules Update

- 敌人定义新增 `counteredDurationMs`
- 敌人技能新增 `castBreakRule`
- 玩家技能新增 `castStopMode` 与 `canAffectSkull`
- 敌方施法条颜色规则：
  - `interruptOrControl`：浅黄色
  - `controlOnly`：浅蓝色
  - `unstoppable`：浅灰色
- 打断成功后敌人会进入 `countered`，结束后施放技能循环中的下一个技能
- 控制成功后敌人会在控制结束时重读刚才被阻止的那个技能
