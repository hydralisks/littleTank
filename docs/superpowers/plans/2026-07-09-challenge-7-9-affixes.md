# Challenge 7-9 Affixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Challenge-7 through Challenge-9 with one new readable affix per stage, using troll enemies plus a small number of earlier enemies, tuned toward hard difficulty.

**Architecture:** Challenge stage data remains isolated in `challenge_stage_content.xlsx` and `challenge_encounter_balance.xlsx`. New affix mechanics are implemented as challenge-prefixed enemy status logic, with additive status/icon rows in `enemy_data.xlsx` because the runtime status factory reads status definitions there.

**Tech Stack:** TypeScript, Vitest, SheetJS `.xlsx` workbook updates, existing encounter runtime and balance analyzer.

---

### Task 1: Runtime Tests For New Affixes

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Add tests for three new challenge affix hooks**

Add one test near the existing `challenge affix statuses provide readable pressure hooks` test. It should create active status objects directly and verify:

```ts
expect(ruptured.player.debuffs.find((status) => status.id === 'challenge_spear_breach')?.stacks).toBe(1)
expect(misted.enemies[0]?.hp).toBeGreaterThan(50)
expect(braced.enemies[0]?.statuses.some((status) => status.id === 'challenge_shield_formation_braced')).toBe(true)
```

- [ ] **Step 2: Verify the test fails before implementation**

Run: `npm run test -- src/game/encounter/encounterFactory.test.ts --runInBand`

Expected: FAIL because the new effect logic ids do not exist yet.

### Task 2: Runtime Logic And Icons

**Files:**
- Modify: `src/game/encounter/enemyStatusEffectRegistry.ts`
- Modify: `src/ui/iconMaps.ts`

- [ ] **Step 1: Implement `challenge_spear_breach_status`**

On enemy cast-resolved damage events from a back-row enemy, apply a stackable physical vulnerability player debuff to the tank.

- [ ] **Step 2: Implement `challenge_troll_regen_mist_status`**

On tick, heal troll enemies by `valueA` every `tickIntervalMs`.

- [ ] **Step 3: Implement `challenge_shield_formation_status`**

On first player skill damage event against an elite enemy, apply a short enemy damage reduction status and then remove the trigger status.

- [ ] **Step 4: Add icon mappings**

Map:

```ts
challenge_spear_breach: '/status-icons/sundered.svg'
challenge_troll_regen_mist: '/status-icons/guarded.svg'
challenge_shield_formation: '/status-icons/shield-wall.svg'
challenge_shield_formation_braced: '/status-icons/shield-wall.svg'
```

- [ ] **Step 5: Run the targeted test**

Run: `npm run test -- src/game/encounter/encounterFactory.test.ts --runInBand`

Expected: PASS for the new affix test and no regression in the file.

### Task 3: Challenge Workbook Data

**Files:**
- Modify binary: `public/designer-data/challenge_stage_content.xlsx`
- Modify binary: `public/designer-data/challenge_encounter_balance.xlsx`
- Modify binary: `public/designer-data/enemy_data.xlsx`

- [ ] **Step 1: Add Challenge-7 through Challenge-9 stage rows**

Rows:
- `Challenge-7`, title `猎头断线`, affix `穿矛破口`, difficulty `hard`, build rule `standard_5slot`.
- `Challenge-8`, title `森林药线`, affix `药雾回甘`, difficulty `hard`, build rule `8slot_0`.
- `Challenge-9`, title `持盾督军`, affix `盾阵换防`, difficulty `hard`, build rule `8slot_0`.

- [ ] **Step 2: Add encounter rows**

Use full-health enemy templates. Add mixed troll and chapter 1/2 enemies, stage openings, placements, empty opening-state placeholders, affix bindings, and special-rule bindings.

- [ ] **Step 3: Add status definitions and icon resource rows**

Add challenge-prefixed enemy buff/player debuff rows needed by the three affix definitions.

### Task 4: Validation And Balance

**Files:**
- Read generated reports under `reports/balance/challenge/`
- Read generated reports under `reports/data_estimate/challenge/`

- [ ] **Step 1: Validate designer data**

Run: `npm run validate:designer-data`

Expected: exit 0. Existing unrelated warnings are acceptable if they match known unfinished story data.

- [ ] **Step 2: Run challenge balance for 7~9**

Run a challenge balance command scoped to Challenge-7 through Challenge-9 if supported; otherwise run the nearest quick challenge analyzer and inspect generated challenge report.

- [ ] **Step 3: Tune only challenge data**

If a stage is clearly below hard, increase opening pressure or add one support enemy. If a stage is expert/unwinnable, reduce opening pressure, initial skill-cycle pressure, or one non-elite support enemy.
