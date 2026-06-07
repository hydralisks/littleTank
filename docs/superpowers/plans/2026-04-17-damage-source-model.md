# Damage Source Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为战斗系统引入统一 `damageSource` 模型，接入玩家平A、队伍随机伤害与玩家技能仇恨公式扩展。

**Architecture:** 在 `EncounterRuntime` 中新增 `damageSources` 数组，统一推进周期性伤害来源。玩家平A与队伍随机伤害先进入该模型；玩家技能暂不变成运行时 source，但统一改为读取效果表中的 `threatMultiplier + threatDelta` 公式。关卡侧新增“伤害来源定义 / 关卡伤害来源绑定”工作表，并保留旧 `partyAutoDamage*` 字段兼容。

**Tech Stack:** TypeScript, Vitest, Vite, React, xlsx

---

### Task 1: 为 damageSource 运行时写失败测试

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖：
- 玩家平A每秒命中当前目标一次
- 玩家平A默认造成 3 点伤害并增加 15 点 `tankThreat`
- 当前目标死亡后平A停手且保持 ready
- 重新选中新目标后平A恢复
- 队伍随机伤害增加 `allyThreat`

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
Expected: FAIL，失败原因应为 `damageSources` 尚未实现或平A行为不存在。

- [ ] **Step 3: 写最小实现**

在 `encounterFactory.ts` 中：
- 新增 `DamageSourceRuntime`
- 为 `createInitialEncounterState` 注入默认来源
- 为 `tickEncounter` 增加 damageSource 推进

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
Expected: PASS

### Task 2: 为玩家技能仇恨倍率字段写失败测试

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`
- Modify: `src/game/data/playerBuildCatalog.test.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`
- Test: `src/game/data/playerBuildCatalog.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖：
- `burst_single` 读取 `threatMultiplier + threatDelta`
- `cleave_adjacent` 读取 `threatMultiplier + threatDelta`
- `playerBuildCatalog` 和 workbook parser 能看到新字段

- [ ] **Step 2: 运行测试确认失败**

Run:
- `npm test -- src/game/encounter/encounterFactory.test.ts`
- `npm test -- src/game/data/playerBuildCatalog.test.ts`

Expected: FAIL，失败原因应为新字段未实现或未解析。

- [ ] **Step 3: 写最小实现**

修改：
- `encounterTypes.ts`
- `playerBuildCatalog.ts`
- `workbookLoader.ts`
- `playerSkillRuntimeRegistry.ts`

- [ ] **Step 4: 运行测试确认通过**

Run:
- `npm test -- src/game/encounter/encounterFactory.test.ts`
- `npm test -- src/game/data/playerBuildCatalog.test.ts`

Expected: PASS

### Task 3: 新增策划工作簿接口并保持旧字段兼容

**Files:**
- Modify: `src/game/data/encounterTemplates.ts`
- Modify: `src/game/data/workbookLoader.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: 为新工作表写失败测试**

至少验证：
- 若旧 `partyAutoDamage*` 存在，仍会产生 `party_ambient_random`
- 新工作表若存在绑定，可被读取并进入 stage context

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
Expected: FAIL

- [ ] **Step 3: 写最小实现**

新增：
- `伤害来源定义`
- `关卡伤害来源绑定`

保留：
- `partyAutoDamage*`

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
Expected: PASS

### Task 4: 同步文档与全量验证

**Files:**
- Modify: `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- Modify: `STAGE_DATA_INTERFACE_SPEC.md`
- Modify: `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`
- Modify: `战士T技能天赋设计入口.md`
- Modify: `README.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `开发更新日志.md`

- [ ] **Step 1: 同步玩家技能表字段文档**

写清：
- `threatMultiplier`
- `threatSource`
- `threatDelta = flatThreat`

- [ ] **Step 2: 同步关卡 damageSource 工作表文档**

写清：
- `伤害来源定义`
- `关卡伤害来源绑定`
- 旧字段兼容规则

- [ ] **Step 3: 全量验证**

Run:
- `npm run generate:designer-data`
- `npm test`
- `npm run build`
- `npm run lint`

Expected: 全部通过
