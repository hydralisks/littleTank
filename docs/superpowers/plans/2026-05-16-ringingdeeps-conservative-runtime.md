# RingingDeeps Conservative Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `RingingDeeps-1` through `RingingDeeps-6` run as a real playable combat chapter using the current planner workbooks, without adding tutorial UI or chapter completion screens.

**Architecture:** Keep the existing workbook-driven combat pipeline. Treat `enemy_data.xlsx` and `encounter_balance.xlsx` as authoritative data, and add only the missing runtime handlers for effect IDs already present in those workbooks. Lock the whole chapter with tests that load the real workbooks and create all six encounters.

**Tech Stack:** Vite, React, TypeScript, Vitest, xlsx.

---

### Task 1: RingingDeeps Workbook Runtime Smoke Coverage

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing/coverage test**

Add a test near the existing RingingDeeps workbook test that loads current workbooks and creates `RingingDeeps-1` through `RingingDeeps-6`. Assert each encounter has enemies, workbook rules, and expected first-chapter unlock/build behavior.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 3: Keep implementation minimal**

If this passes, do not change production code for this task. If it fails, fix only the missing runtime creation issue.

### Task 2: Planner Enemy Status Logic

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/enemyStatusEffectRegistry.ts`

- [ ] **Step 1: Write failing tests for workbook effect IDs**

Add tests for:
- `slowDown_status`: player skill cooldowns stop recovering while active.
- `slowDown_p_status`: party ambient damage pauses while active.
- `waxed_status`: player takes 1 damage per second.
- `waxed_p_status`: party takes 1 damage per second and pressure decay wait is reset by the damage.
- `hoe_status`: removes `waxed` from player if present, otherwise deals 30 player damage.
- `hoe_p_status`: removes `waxed_p` from party if present, otherwise deals 30 party damage.
- `got!_status`: while the enemy channels it at player or party, the matching auto attack source pauses, and the status is removed when the channel ends.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: the new status behavior tests fail because the handlers are missing.

- [ ] **Step 3: Implement minimal status handlers**

Implement only the listed behaviors. Do not add new workbook fields, UI, or tutorial logic.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: all encounter factory tests pass.

### Task 3: Final Verification

**Files:**
- No production edits unless verification exposes a root-cause bug.

- [ ] **Step 1: Run read-only data validation**

Run: `npm run validate:designer-data`

Expected: validation passes.

- [ ] **Step 2: Run relevant tests**

Run: `npm test -- src/game/data/designerDataValidator.test.ts src/game/encounter/encounterFactory.test.ts src/ui/StageSelectScreen.test.ts`

Expected: all listed tests pass.

- [ ] **Step 3: Run full tests and build**

Run: `npm test`

Run: `npm run build`

Expected: both pass.

- [ ] **Step 4: Report conservative scope**

Report exactly what is now playable and call out that tutorial UI and chapter settlement remain intentionally deferred.
