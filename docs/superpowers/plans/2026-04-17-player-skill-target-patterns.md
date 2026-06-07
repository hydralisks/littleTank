# Player Skill Target Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改动 `player_build.xlsx` 表结构的前提下，为玩家技能增加更丰富的目标范围枚举，并接入运行时结算。

**Architecture:** 继续复用现有 `targetingType` 与 `targetSelector` 两个字符串字段，不新增列。代码侧增加统一的敌方目标范围解析函数，基于敌人实例已有的 `row / col` 计算十字、3x3、左上 2x2 等范围，再由技能运行时注册表复用。

**Tech Stack:** TypeScript, Vitest, Vite, React

---

### Task 1: 用测试锁定目标范围规则

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: 写失败测试**

为以下行为补充测试：
- `crossEnemy` 需要目标并命中当前目标与上下左右
- `matrix3x3Enemy` 需要目标并命中中心九宫格内所有有效敌人
- `topLeft2x2Enemy` 需要目标并命中左上角 2x2 内所有有效敌人
- `allEnemy` 命中所有存活敌人
- `party` 与 `self` 不要求敌方目标

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
Expected: FAIL，失败原因应为新目标枚举尚未实现或旧断言不满足。

- [ ] **Step 3: 实现最小运行时代码**

在 `encounterFactory.ts` 中补充统一目标范围解析函数，并把它通过 `RuntimeSkillHelpers` 传给 `playerSkillRuntimeRegistry.ts`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
Expected: PASS

### Task 2: 把目标范围解析接到玩家技能运行时

**Files:**
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/encounterTypes.ts`

- [ ] **Step 1: 为运行时 helper 增加通用入口**

新增统一 helper，例如：
- `getEnemyTargetIdsBySelector`

- [ ] **Step 2: 让现有需要范围目标的技能改走通用解析**

至少统一 `stun`、`cleave`，使其不再只硬编码十字逻辑。

- [ ] **Step 3: 保持现有单体、自身、队伍技能兼容**

确保 `currentEnemy`、`allEnemy`、`party`、`self` 都继续工作。

- [ ] **Step 4: 运行相关测试**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
Expected: PASS

### Task 3: 同步样例数据与文档

**Files:**
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Modify: `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- Modify: `战士T技能天赋设计入口.md`

- [ ] **Step 1: 更新内置样例的目标枚举**

把合适的样例技能或效果行改为使用新枚举，至少覆盖一个十字或更大范围案例。

- [ ] **Step 2: 更新设计表样例生成**

在生成脚本里写入新枚举样例，避免策划继续照旧值填写。

- [ ] **Step 3: 更新接口文档**

把 `targetingType` / `targetSelector` 的允许值和语义写清楚。

- [ ] **Step 4: 全量验证**

Run:
- `npm run generate:designer-data`
- `npm test`
- `npm run build`
- `npm run lint`

Expected: 全部通过
