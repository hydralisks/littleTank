# Guardian Druid Bear T Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the complete `druid_bear_t`职业数据与运行时支持，并将其写入 `player_build.xlsx`，同时保持战士T行为不回归。

**Architecture:** Keep designer data authoritative for names, costs, cooldowns, effects, statuses, talents, icons, and defaults. Register bear runtime metadata separately, reuse generic threat/control/healing/status infrastructure where semantics match, and add narrowly-scoped bear handlers for rage generation, physical mitigation, HoTs, max-HP windows, dispel, party support, and talent triggers. Do not modify stage or challenge workbooks in this plan.

**Tech Stack:** React/TypeScript, Vitest, XLSX workbook editing through the existing loader/serializer utilities, SVG icon assets.

---

### Task 1: Lock workbook and runtime contracts with failing tests

**Files:**
- Create: `src/game/playerClasses/bearTDesign.test.ts`
- Modify: `src/game/data/playerBuildCatalog.test.ts`
- Modify: `src/game/playerClasses/playerClassRuntimeRegistry.test.ts`

- [ ] **Step 1: Add tests for 16 active skills, 20 talents, tier 5/5/5/5, enabled bear class, and standard default build.**
- [ ] **Step 2: Add tests asserting bear rage has `passiveGainPerSecond=0`, `damageTakenGainDivisor=0`, and `minimumDamageTakenGain=0`.**
- [ ] **Step 3: Add tests asserting no bear skill/talent ID can reference a `warrior_t_` content ID.**
- [ ] **Step 4: Run `npm test -- src/game/playerClasses/bearTDesign.test.ts src/game/data/playerBuildCatalog.test.ts src/game/playerClasses/playerClassRuntimeRegistry.test.ts` and confirm failure because bear rows/runtime are absent.**

### Task 2: Register bear class runtime and resource semantics

**Files:**
- Modify: `src/game/playerClasses/playerClassRuntimeRegistry.ts`
- Modify: `src/game/encounter/encounterTypes.ts` only if a typed bear runtime field is required
- Test: `src/game/playerClasses/playerClassRuntimeRegistry.test.ts`

- [ ] **Step 1: Register `druid_bear_t` with paw icon, stable selection order, `druid_bear_t_default`, rage cap 100, zero passive/time and damage-taken gain, and empty runtime initialization.**
- [ ] **Step 2: Add the minimal runtime counters needed for once-per-HoT/once-per-shield talent triggers and 30-rage team-heal thresholds without adding a second resource.**
- [ ] **Step 3: Run the focused runtime tests and confirm they pass.**

### Task 3: Add failing runtime tests for bear skill behavior

**Files:**
- Create: `src/game/playerClasses/bearTSkillRuntime.test.ts`
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Modify: `src/game/encounter/encounterFactory.ts` only for generic physical-mitigation/HoT hooks required by the tests

- [ ] **Step 1: Test low吼/咆哮 target scopes and shared `taunted` status.**
- [ ] **Step 2: Test裂伤/痛击 successful activation rage gains and横扫 cross targeting with only GCD gating.**
- [ ] **Step 3: Test铁鬃 stacking to three layers, refresh behavior, and physical-only mitigation.**
- [ ] **Step 4: Test狂暴回复 four HoT ticks using current max HP, with control not cancelling ticks and healing suppression applied per tick.**
- [ ] **Step 5: Test月火术 DoT,树皮术 end-of-duration dispel,生存本能/明月普照/乌索克的化身 proportional max-HP sync, and沉睡者之怒 party mitigation when the talent is selected.**
- [ ] **Step 6: Test愈合 self-only targeting,队伍治疗 talent, and春风吹又生 team healing at each 30 rage threshold.**
- [ ] **Step 7: Run the focused skill test and confirm the new assertions fail.**

### Task 4: Implement bear skill/talent runtime minimally

**Files:**
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Modify: `src/game/data/playerTalentLogicRegistry.ts`
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/playerClasses/bearTSkillRuntime.test.ts`

- [ ] **Step 1: Add reusable helpers for physical-only mitigation, proportional max-HP sync, HoT application, dispellable player debuff removal, and thresholded rage events.**
- [ ] **Step 2: Register bear handlers for the 16 skill logic IDs and bear talent logic IDs; shared behavior must call existing generic handlers rather than duplicate warrior branches.**
- [ ] **Step 3: Ensure bear skill activation never receives warrior time/damage-taken rage and never silently falls back to warrior runtime.**
- [ ] **Step 4: Run focused skill/runtime tests and then the existing encounter factory/player resource tests.**

### Task 5: Add workbook rows and icon assets

**Files:**
- Modify: `public/designer-data/player_build.xlsx`
- Create: `public/skill-icons/druid_bear_t_*.svg` for 16 skills
- Create: `public/status-icons/druid_bear_t_*.svg` for bear-only statuses and talent-granted statuses
- Modify: `src/ui/iconMaps.ts` only if the current asset-key mapping requires explicit entries

- [ ] **Step 1: Append/replace the bear职业定义 row and add enabled rows matching the existing warrior headers exactly.**
- [ ] **Step 2: Add 16 active skill rows, all active effects, bear-only statuses, 20 passive talent rows in tiers 0/1/2/3 with 5 each, all passive effects, standard/8-slot default active rows, and default passive rows.**
- [ ] **Step 3: Add icon mapping rows for every new skill, talent, class, and status asset; use unique `druid_bear_t_*` IDs for bear-owned content and retain shared `taunted`/`countered` mappings.**
- [ ] **Step 4: Read the workbook back through `parsePlayerBuildWorkbook` and assert counts, IDs, references, and enabled flags.**

### Task 6: Validate data boundaries and build defaults

**Files:**
- Modify: `src/game/data/designerDataValidator.test.ts` only if a new bear-specific invariant needs coverage
- Test: `src/game/playerClasses/bearTDesign.test.ts`

- [ ] **Step 1: Run `npm run validate:designer-data` and fix every error without touching stage/challenge workbooks.**
- [ ] **Step 2: Verify `getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t')` returns only bear skills/talents and the expected five active slots.**
- [ ] **Step 3: Run `npm test -- src/game/data/playerBuildCatalog.test.ts src/game/data/designerDataValidator.test.ts src/game/playerClasses/bearTDesign.test.ts`.**

### Task 7: Full verification and handoff

**Files:**
- Modify: `开发更新日志.md`

- [ ] **Step 1: Run `npm test`, `npm run validate:designer-data`, `npm run lint`, `npm run build`, and `npm run test:desktop-data`.**
- [ ] **Step 2: Run `git diff --check` and confirm only `player_build.xlsx`, bear code/assets/tests, and the design/implementation docs changed; stage/challenge workbooks remain unchanged.**
- [ ] **Step 3: Record the completed bear design/data/runtime boundary and explicit next step (challenge1~3 snapshot and balance) in `开发更新日志.md`.**
- [ ] **Step 4: Commit the implementation branch and stop for user review; do not merge or push automatically.**
