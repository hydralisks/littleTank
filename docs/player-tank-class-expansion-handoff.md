# 新坦克职业扩展接手入口

更新时间：2026-07-20

本文给下一位 agent 使用，目标是基于现有 `warrior_t` 战士T框架继续扩展新坦克职业，优先候选为熊T和死亡骑士T。本文只记录设计路线和接手边界，不修改 `public/designer-data/` 下的策划表。

## 当前结论

建议开发顺序：

1. 先做熊T。
2. 再做死亡骑士T。

理由：

- 当前项目已有怒气资源、主动减伤、吸收、自疗、控制、打断、范围伤害、队伍保护、战斗统计和自动评测基础。熊T可以复用大部分战士T的现有运行时能力，只需要补职业数据、少量技能逻辑和若干被动逻辑。
- 死亡骑士T的核心差异是反应式自疗、近期承伤窗口、骨盾层数和更复杂资源节奏。它更适合作为第二个新职业，用来推动资源系统和职业 AI 策略升级。

## 调研摘要

参考方向来自魔兽世界坦克专精的常见职责划分：

- 防护战士：盾牌、重甲、怒气、主动预判减伤。核心体验是提前开盾牌格挡、无视苦痛、盾墙，并用打断/控制处理危险读条。
- 守护德鲁伊：熊形态、高生命、高护甲、怒气驱动。核心体验是稳定承伤、铁鬃覆盖、狂暴回复自疗，操作压力低于战士但功能性更少。
- 鲜血死亡骑士：符文/符文能量、骨盾、死亡打击。核心体验是受伤后用资源把血线拉回来，容错来自自救，难点来自资源断档和技能时机。

参考资料：

- Blizzard 职业页：`https://worldofwarcraft.blizzard.com/en-us/game/classes/warrior`
- Blizzard 职业页：`https://worldofwarcraft.blizzard.com/en-us/game/classes/druid`
- Blizzard 职业页：`https://worldofwarcraft.blizzard.com/en-us/game/classes/death-knight`
- Icy Veins 防护战士指南：`https://www.icy-veins.com/wow/protection-warrior-pve-tank-guide`
- Icy Veins 守护德鲁伊指南：`https://www.icy-veins.com/wow/guardian-druid-pve-tank-guide`
- Icy Veins 鲜血死亡骑士指南：`https://www.icy-veins.com/wow/blood-death-knight-pve-tank-guide`

## 与现有战士T的差异目标

不要把新职业做成换皮战士T。三个职业建议形成以下三角：

| 职业 | 核心防御 | 资源节奏 | 强项 | 弱项 |
| --- | --- | --- | --- | --- |
| 战士T | 预判格挡和吸收 | 怒气自然回复、受击、攻击获取 | 物理尖刺、反射、控制、打断 | 魔法/不可格挡压力、窗口判断错误 |
| 熊T | 高血量、高护甲、持续覆盖和自疗 | 怒气，偏稳定获取 | 稳定承伤、多目标仇恨、低操作门槛 | 精确反射/强打断少，爆发处理弱 |
| 死亡骑士T | 受伤后反打治疗、骨盾层数 | 符文/符文能量，建议分阶段引入 | 魔法工具、自救、残局能力 | 资源断档时波动大，AI 和玩家学习成本高 |

## 推荐一期：熊T

职业 ID 建议：`guardian_druid_t`。如果后续 UI 需要短一些，也可以用 `druid_t`，但必须在文档、表格、代码里统一。

资源：

- 一期复用 `rage` 资源定义，不新增第二套资源系统。
- 在 `src/game/encounter/playerResourceSystem.ts` 中增加该 `classId` 的资源参数。
- 熊T怒气建议更稳定、受击收益略低于战士，避免它既厚又能频繁爆发自疗。

主动技能草案：

| 技能 | 定位 | 建议逻辑 |
| --- | --- | --- |
| 裂伤 | 单体伤害/产怒 | 当前目标伤害，产生仇恨和怒气 |
| 痛击 | 多目标仇恨 | 范围伤害或周期流血，适合作为熊T多目标基础 |
| 铁鬃 | 核心主动减伤 | 消耗怒气，短时间提高物理减伤/护甲，可叠层或刷新 |
| 狂暴回复 | 核心自疗 | 消耗怒气，按最大生命或近期承伤治疗自己 |
| 树皮术 | 短冷却通用减伤 | 全伤害减免，操作要求低 |
| 生存本能 | 长冷却大减伤 | 大额全伤害减免，用于高危期 |
| 低吼 | 单体嘲讽 | 复用 `taunt` 或 `taunt_single` 模式 |
| 迎头痛击 | 打断 | 复用 `interrupt` 类逻辑 |
| 群体缠绕/乌索尔旋风 | 功能控制 | 控制或短时间降低敌人目标切换能力 |
| 化身 | 爆发窗口 | 提高怒气获取、伤害或铁鬃/痛击效率 |

被动天赋方向：

- 厚皮：提高最大生命或基础减伤。
- 强化铁鬃：提高铁鬃持续时间、减伤或允许额外层数。
- 狂野恢复：狂暴回复额外治疗或降低资源消耗。
- 血性狂乱：痛击/流血命中多个目标时获得怒气。
- 适者生存：降低生存本能冷却或提供第二层小减伤。
- 乌索克守护：团队压力高时获得额外减伤或自动回复。

熊T一期验收重点：

- 在 RD/WF/ZA 已有关卡中，熊T不应该全面优于战士T。
- 多目标普通伤害场景应更舒服。
- 需要精确反射或连续打断的场景应弱于战士T。
- 自动评分需要能分别输出战士T和熊T的 build/通过率，而不是只取全职业最优掩盖职业差异。

## 推荐二期：死亡骑士T

职业 ID 建议：`blood_death_knight_t`。如果需要更短，可用 `dk_t`，但不建议，因为策划表可读性会变差。

一期资源实现建议：

- 不要一开始完整复刻 WoW 的 6 符文系统。
- 先实现：
  - 主资源：符文能量，`runic_power`。
  - 副资源：符文层数或冷却槽，最多 3 枚，每若干秒恢复 1 枚。
  - 近期承伤池：记录过去 5 秒玩家实际受到的伤害。
- 如果副资源系统代价过高，第一版可以把符文技能做成普通冷却，把死亡打击消耗符文能量，并先实现近期承伤池。

主动技能草案：

| 技能 | 定位 | 建议逻辑 |
| --- | --- | --- |
| 心脏打击 | 基础输出/资源 | 消耗符文或冷却，造成伤害并生成符文能量 |
| 骨髓分裂 | 骨盾维护 | 获得骨盾层数，层数提供护甲/减伤 |
| 死亡打击 | 核心自救 | 消耗符文能量，按近期承伤治疗，并可产生少量吸收 |
| 吸血鬼之血 | 血量/治疗窗口 | 提高最大生命和受到治疗效果 |
| 反魔法护罩 | 魔法工具 | 吸收或免疫部分魔法伤害，吸收成功时生成符文能量 |
| 死亡之握 | 仇恨工具 | 强制目标转向玩家，或短期提高玩家仇恨 |
| 枯萎凋零 | 区域仇恨 | 区域持续伤害/仇恨 |
| 符文刃舞 | 爆发防御 | 短时间提高招架/减伤/资源效率 |

被动天赋方向：

- 白骨壁垒：骨盾层数提高减伤。
- 赤色饥渴：死亡打击有效治疗降低大技能冷却。
- 饮血者：周期伤害转化少量治疗。
- 符文分流：低血线自动触发小减伤或消耗资源减伤。
- 反魔法专精：反魔法护罩提高吸收或返还资源。
- 腐烂壁垒：枯萎凋零内敌人对玩家造成伤害降低。

死亡骑士T验收重点：

- 近期承伤池必须只统计玩家实际承受的生命伤害，不应把被吸收、免疫、反射掉的伤害也算进死亡打击治疗基数。
- 高通过率不等于低难度。自动报告应把 DK 的学习路径、技巧要求和操作负载作为独立维度展示。
- 需要新增 AI 职业策略：死亡打击应在受伤后、血线危险或近期承伤池较高时释放，而不是 CD 好了就用。

## 代码接手入口

优先阅读：

1. [PLAYER_BUILD_DATA_INTERFACE_SPEC.md](/C:/codexCode/littleTank/PLAYER_BUILD_DATA_INTERFACE_SPEC.md)
2. [战士T技能天赋设计入口.md](/C:/codexCode/littleTank/战士T技能天赋设计入口.md)
3. [playerBuildCatalog.ts](/C:/codexCode/littleTank/src/game/data/playerBuildCatalog.ts)
4. [workbookLoader.ts](/C:/codexCode/littleTank/src/game/data/workbookLoader.ts)
5. [playerResourceSystem.ts](/C:/codexCode/littleTank/src/game/encounter/playerResourceSystem.ts)
6. [playerSkillRuntimeRegistry.ts](/C:/codexCode/littleTank/src/game/encounter/playerSkillRuntimeRegistry.ts)
7. [encounterFactory.ts](/C:/codexCode/littleTank/src/game/encounter/encounterFactory.ts)
8. [balanceBuildGenerator.ts](/C:/codexCode/littleTank/src/game/balance/balanceBuildGenerator.ts)
9. [learningBalanceEvaluator.ts](/C:/codexCode/littleTank/src/game/balance/learningBalanceEvaluator.ts)

涉及 UI 时再读：

- [SkillConfigPanel.tsx](/C:/codexCode/littleTank/src/ui/SkillConfigPanel.tsx)
- [PassiveTalentPanel.tsx](/C:/codexCode/littleTank/src/ui/PassiveTalentPanel.tsx)
- [StageSelectScreen.tsx](/C:/codexCode/littleTank/src/ui/StageSelectScreen.tsx)
- [iconMaps.ts](/C:/codexCode/littleTank/src/ui/iconMaps.ts)

## 数据接手入口

策划主入口：

- `public/designer-data/player_build.xlsx`

新增职业通常需要维护这些工作表：

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

注意：

- 不要在没有用户明确要求时运行 `npm run generate:designer-data`。
- 如果只是新增代码对表格字段的支持，先写测试和文档；实际 `public/designer-data/*.xlsx` 是否写入由用户或策划明确授权。
- 图标资源需要和 `图标资源映射` 对齐，缺图时优先补 `public/skill-icons/*.svg` 或 `public/status-icons/*.svg`，不要为了绕过校验改策划表。

## 实现路线建议

### Step 1：职业选择和构筑边界

先确认 UI 是否允许在挑战模式/主线中选择非战士T职业。当前挑战模式已经有“可选职业”的概念，但新职业是否进入主线，需要单独确认。

需要检查：

- `StageSelectScreen` 是否按关卡/模式列出职业。
- 保存数据是否按 `classId` 保存构筑。
- 默认构筑是否能按 `buildRuleId + classId` 正确回退。

### Step 2：资源系统扩展

熊T：

- 在 `PLAYER_RESOURCE_DEFINITIONS` 增加 `guardian_druid_t`。
- 保持 `resourceCost` 字段复用。

死亡骑士T：

- 至少增加 `blood_death_knight_t` 的主资源定义。
- 如果要实现副资源，不要塞进单个 `player.resource` 数值里；应新增明确 runtime 字段，例如 `classRuntime`，并写迁移/初始化测试。

### Step 3：主动技能逻辑

优先复用现有处理器：

- 嘲讽：`taunt` / `taunt_single`
- 打断：现有 interrupt 处理器
- 控制：`stun` 类处理器
- 普通伤害：可参考 `revenge` / `shield_slam` / `thunderstruck`
- 自身减伤：可参考 `shield_wall` / `shield_block`
- 吸收：可参考 `ignore_pain`

新增处理器时要满足：

- 读取 `主动技能效果` 的 `valueA/valueB/durationMs/statusId/targetSelector/threatDelta/threatMultiplier`。
- 写入战斗统计：伤害、治疗、吸收、队伍承伤、坦克承伤不能丢。
- 和 AI 策略可读的标签对齐，例如 `survival`、`interrupt`、`threat`、`heal`、`aoe`。

### Step 4：被动天赋逻辑

新增天赋优先做成以下类型：

- 改数值型：最大生命、伤害减免、资源回复、技能冷却。
- 改技能型：增强某个主动技能。
- 触发型：低血、成功打断、受到伤害、造成治疗后触发。
- 队伍型：降低压力、提高队伍治疗、降低队伍承伤。

不要把职业专属被动硬塞进战士T现有逻辑分支。新 `talentLogicId` 应在注册表里明确命名。

### Step 5：自动评测和报告

新增职业后必须更新：

- build 生成器：确保 `classId` 不混用战士技能和熊T/DK技能。
- 学习型 AI：为熊T/DK加入对应技能使用偏好。
- 数值估算：按职业输出资源获取、承伤、治疗、吸收、伤害。
- 手动测试记录：`manual_playtest_builds.xlsx` 后续应能按职业记录推荐 build。

## AI 策略初稿

熊T策略：

- 保持铁鬃覆盖，尤其在物理高压窗口。
- 血量低或近期承伤高时使用狂暴回复。
- 多目标时优先痛击保持群体仇恨。
- 大压力窗口使用树皮术/生存本能。
- 打断优先级低于战士，但关键读条仍要处理。

死亡骑士T策略：

- 骨盾低层数时补骨髓分裂。
- 近期承伤池高或血线危险时使用死亡打击。
- 魔法高危技能前使用反魔法护罩。
- 资源不足时保留死亡打击资源，不要把符文能量全部打成输出。
- 低血线时优先自救，不优先追伤害。

## 不建议第一版做的事

- 不建议同时开发熊T和死亡骑士T完整技能池。
- 不建议第一版就引入完整 WoW 级别符文系统。
- 不建议把主线关卡直接改成多职业强制平衡。先用挑战模式和自动评测验证职业差异。
- 不建议改动 `stage_content.xlsx`、`encounter_balance.xlsx`、`enemy_data.xlsx` 来迁就新职业；职业应先在 `player_build.xlsx` 和 runtime 中闭合。

## 第一位接手 agent 的推荐任务

建议下一位 agent 先只做熊T技术骨架：

1. 增加 `guardian_druid_t` 资源定义。
2. 增加一个最小熊T主动技能逻辑样例：`低吼` 或 `铁鬃`。
3. 增加一个最小熊T被动天赋样例：最大生命或基础减伤。
4. 让构筑 UI 能按 `classId` 展示该职业的技能/天赋。
5. 让自动 build 生成器能针对该职业生成候选 build。
6. 写单元测试，不写入 `public/designer-data/*.xlsx`，除非用户明确要求把策划表也落地。

完成上述骨架后，再进入熊T完整技能表和数值平衡。
