# Cast Break Rules And Skill Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add data-driven enemy cast break rules, full interrupt/control resolution, skull immunity flags on player skills, and matching cast-bar UI colors.

**Architecture:** Extend workbook-backed data definitions first so enemy skills, enemy definitions, and player skills can describe the new runtime rules. Then drive combat behavior from those fields inside `encounterFactory`, and finally surface the rule differences in the enemy cast bar UI. Tests stay focused on combat-state transitions instead of UI rendering details.

**Tech Stack:** TypeScript, React, Vite, Vitest, XLSX workbook loader

---

### Task 1: Expand combat data contracts

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/data/enemyCatalog.ts`
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/data/workbookLoader.ts`

- [ ] Add `EnemyCastBreakRule`, `PlayerCastStopMode`, `counteredDurationMs`, `castBreakRule`, `castStopMode`, `canAffectSkull`, and `pendingRetryCastSkillId` to the runtime/data types.
- [ ] Remove runtime dependence on legacy enemy-skill field `interruptible`.
- [ ] Teach workbook parsing to read the new fields from `enemy_data.xlsx` and `player_build.xlsx`.

### Task 2: Lock the new combat behavior with failing tests

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`

- [ ] Add a failing test for `interrupt` successfully cancelling an `interruptOrControl` cast and applying `countered`.
- [ ] Add a failing test for `interrupt` not stopping a `controlOnly` cast.
- [ ] Add a failing test for `stun` stopping a `controlOnly` cast and causing the same skill to retry after control expires.
- [ ] Add a failing test for `stun` not affecting a skull enemy when `canAffectSkull=false`.
- [ ] Run `npm test -- src/game/encounter/encounterFactory.test.ts` and confirm the new tests fail for the expected reasons.

### Task 3: Implement interrupt and control resolution

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`

- [ ] Add small helpers that answer:
  - whether a player skill can stop the current cast
  - whether a skull target is immune to the selected player skill
  - whether an enemy should retry a pending cast after control ends
- [ ] Implement interrupt success flow:
  - cancel cast
  - add `countered`
  - advance skill cycle
  - wait `counteredDurationMs`
  - then cast next skill
- [ ] Implement control success flow:
  - cancel cast
  - apply control status
  - keep cycle position
  - record `pendingRetryCastSkillId`
  - after control ends, re-open the same cast immediately
- [ ] Keep `unstoppable` fully immune to cast stopping in this round.
- [ ] Run `npm test -- src/game/encounter/encounterFactory.test.ts` and confirm the new tests pass.

### Task 4: Surface break rules in enemy cast bar UI

**Files:**
- Modify: `src/ui/EnemyRaidFrameItem.tsx`
- Modify: `src/styles/encounter.css`

- [ ] Add cast-bar classes based on `enemy.cast.breakRule`.
- [ ] Map `interruptOrControl` to light yellow, `controlOnly` to light blue, `unstoppable` to light gray.
- [ ] Keep the existing idle style unchanged.

### Task 5: Sync sample workbooks and fallback data

**Files:**
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Modify: `src/game/data/enemyCatalog.ts`
- Modify: `src/game/data/playerBuildCatalog.ts`

- [ ] Add fallback sample values for:
  - enemy `counteredDurationMs`
  - enemy-skill `castBreakRule`
  - player-skill `castStopMode`
  - player-skill `canAffectSkull`
- [ ] Update generated workbook sample rows so planners can immediately edit the new fields.
- [ ] Include at least 3 representative sample rows in each affected workbook section.

### Task 6: Refresh docs and handoff notes

**Files:**
- Modify: `ENEMY_DATA_INTERFACE_SPEC.md`
- Modify: `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- Modify: `README.md`
- Modify: `DEVELOPMENT_HANDOFF.md`

- [ ] Document the new workbook fields and their Chinese meanings.
- [ ] Document the runtime difference between interrupt success and control success.
- [ ] Document the new cast-bar color mapping.

### Task 7: Full verification

**Files:**
- No code changes expected

- [ ] Run `npm run generate:designer-data`
- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Run `npm run lint`
- [ ] Reconfirm preview still opens at `http://127.0.0.1:4173`

## Self-Review

- Spec coverage:
  - `castBreakRule` -> Task 1, Task 4, Task 5, Task 6
  - `counteredDurationMs` -> Task 1, Task 3, Task 5, Task 6
  - `castStopMode / canAffectSkull` -> Task 1, Task 3, Task 5, Task 6
  - interrupt/control diverging runtime behavior -> Task 2, Task 3
  - UI color rules -> Task 4
  - xlsx/doc sync -> Task 5, Task 6
- Placeholder scan: no `TODO/TBD/implement later`
- Type consistency:
  - Enemy cast rule name fixed as `castBreakRule`
  - Player stop mode name fixed as `castStopMode`
  - Enemy retry field fixed as `pendingRetryCastSkillId`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-cast-break-rules-and-skill-resolution.md`.

User has already requested immediate inline execution, so this session proceeds directly with TDD-based implementation instead of pausing for execution choice.
