# Warrior T Build Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the player build system into a class-aware, workbook-driven skill/talent registry with a first real `战士T` pool while isolating old demo entries under `demo0_*`.

**Architecture:** Keep the current runtime encounter loop, but move player build content to a richer workbook schema and replace the large skill/talent switches with registries. Use `playerBuildCatalog.ts` as the aggregation layer, workbook loader as the planner-facing boundary, and small registry modules/functions to resolve active skills and passive talent modifiers.

**Tech Stack:** TypeScript, React, Vitest, XLSX, Vite

---

### Task 1: Lock the new workbook schema with failing tests

**Files:**
- Modify: `src/game/data/workbookLoader.test.ts` or `src/game/encounter/encounterFactory.test.ts`
- Modify: `src/game/data/playerBuildCatalog.ts`

- [ ] **Step 1: Write a failing test**
  Assert that player build data can describe `classId`, `skillEffect` rows, and `talentEffect` rows, and that old `demo0_*` ids and new `warrior_t` ids can coexist.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/game/data/workbookLoader.test.ts`
  Expected: FAIL because the parser/catalog do not yet expose the new fields.

- [ ] **Step 3: Write minimal implementation**
  Extend build-related types and in-memory defaults so the new fields exist and basic catalog lookup works.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- src/game/data/workbookLoader.test.ts`
  Expected: PASS

### Task 2: Rename current demo entries to `demo0_*`

**Files:**
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: any preset/build references discovered by `rg "taunt|interrupt|stun|massTaunt|shieldWall|cleave|burst|panic"`

- [ ] **Step 1: Write a failing test**
  Assert that legacy sample builds now resolve through `demo0_*` ids and that direct lookup of the old ids is no longer used by defaults.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
  Expected: FAIL due to unresolved old ids in presets/runtime.

- [ ] **Step 3: Write minimal implementation**
  Rename built-in demo skills/talents/statuses/presets to `demo0_*` and update references.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
  Expected: PASS

### Task 3: Add `warrior_t` class, skill pool, and talent pool sample data

**Files:**
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`

- [ ] **Step 1: Write a failing test**
  Assert that `warrior_t` exists, exposes a non-empty active skill pool and passive talent pool, and that workbook samples include at least three rows per new editable sheet.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/game/data/playerBuildCatalog.test.ts`
  Expected: FAIL because `warrior_t` definitions and new workbook sheets are missing.

- [ ] **Step 3: Write minimal implementation**
  Add class-aware defaults, `warrior_t` sample skills/talents/statuses/effects, and workbook generator rows.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- src/game/data/playerBuildCatalog.test.ts`
  Expected: PASS

### Task 4: Replace active skill switch with a registry

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`
- Create or modify: `src/game/data/playerSkillLogicRegistry.ts`

- [ ] **Step 1: Write a failing test**
  Assert that activating representative skills still works, but execution now goes through registered handlers keyed by `skillLogicId`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
  Expected: FAIL because no registry-based dispatch exists.

- [ ] **Step 3: Write minimal implementation**
  Extract existing skill branches into handler functions and dispatch through a registry map.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- src/game/encounter/encounterFactory.test.ts`
  Expected: PASS

### Task 5: Replace passive talent switches with registries

**Files:**
- Modify: `src/game/data/playerBuildCatalog.ts`
- Create or modify: `src/game/data/playerTalentLogicRegistry.ts`

- [ ] **Step 1: Write a failing test**
  Assert that passive modifiers and skill mutations are composed from registry entries rather than the old `switch`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/game/data/playerBuildCatalog.test.ts`
  Expected: FAIL because modifier/mutation registries are missing.

- [ ] **Step 3: Write minimal implementation**
  Split passive resolution into modifier registry and skill mutation registry, then wire current demo0 and warrior_t examples into it.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- src/game/data/playerBuildCatalog.test.ts`
  Expected: PASS

### Task 6: Expand workbook parsing and planner docs

**Files:**
- Modify: `src/game/data/workbookLoader.ts`
- Modify: `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- Create: `战士T技能天赋设计入口.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `开发更新日志.md`

- [ ] **Step 1: Write a failing test**
  Assert that workbook loader reads the new sheets/fields and that planner docs mention every player-build sheet used by `.xlsx`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test -- src/game/data/workbookLoader.test.ts`
  Expected: FAIL because the new workbook fields are not parsed/documented.

- [ ] **Step 3: Write minimal implementation**
  Parse the new workbook schema, document Chinese field meanings, and add planner-facing instructions for战士T录表。

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- src/game/data/workbookLoader.test.ts`
  Expected: PASS

### Task 7: Regenerate data and verify the project

**Files:**
- Run only

- [ ] **Step 1: Regenerate planner workbooks**
  Run: `npm run generate:designer-data`
  Expected: exit code 0 and refreshed `public/designer-data/*.xlsx`

- [ ] **Step 2: Run tests**
  Run: `npm test`
  Expected: PASS

- [ ] **Step 3: Run build**
  Run: `npm run build`
  Expected: PASS

- [ ] **Step 4: Run lint**
  Run: `npm run lint`
  Expected: PASS
