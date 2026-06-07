# Pause Party Auto Damage And Death Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-combat pause/resume, stage-configurable party auto damage, persistent dead-enemy slots, victory on enemy wipe, and updated enemy frame text.

**Architecture:** Keep the current `EncounterState -> tickEncounter -> finalizeEncounterState` structure and extend it with pause/runtime timers plus alive-enemy filtering. TDD stays focused on combat-state transitions first, then UI wiring and workbook/doc sync.

**Tech Stack:** TypeScript, React, Vite, Vitest, XLSX workbook loader

---

### Task 1: Expand combat and stage data contracts

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/data/encounterTemplates.ts`
- Modify: `src/game/data/workbookLoader.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`

- [ ] Add pause and party-auto-damage fields to runtime and stage context types.
- [ ] Teach encounter workbook parsing to read `partyAutoDamageIntervalMs`, `partyAutoDamageTargetCount`, `partyAutoDamageMin`, and `partyAutoDamageMax`.
- [ ] Add fallback sample values and workbook sample rows for the new stage fields.

### Task 2: Lock combat behavior with failing tests

**Files:**
- Modify: `src/game/encounter/encounterFactory.test.ts`

- [ ] Add a failing test for pause freezing combat time and enemy casts.
- [ ] Add a failing test for party auto damage only hitting living enemies.
- [ ] Add a failing test for party auto damage killing an enemy and stopping its cast.
- [ ] Add a failing test for victory when all enemies are dead.
- [ ] Run `npm test -- src/game/encounter/encounterFactory.test.ts` and confirm the new tests fail for the expected reasons.

### Task 3: Implement pause, auto damage, death retention, and victory flow

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`

- [ ] Add helpers for alive-enemy filtering, enemy death cleanup, and party auto damage resolution.
- [ ] Implement pause open/close state transitions and freeze behavior inside `tickEncounter`.
- [ ] Implement periodic party auto damage using the new stage fields.
- [ ] Keep dead enemies in the array but remove them from cast/target logic.
- [ ] Make finalize logic use living enemies for target normalization and victory checks without deleting dead slots.
- [ ] Run `npm test -- src/game/encounter/encounterFactory.test.ts` and confirm the new tests pass.

### Task 4: Wire pause UI and enemy frame presentation

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/EnemyRaidFrameItem.tsx`
- Modify: `src/styles/encounter.css`

- [ ] Add the `我说停停` button next to the stage title.
- [ ] Make `Esc` close open panels first, then open the pause overlay.
- [ ] Add a pause overlay with `算他厉害 / 我不信了 / 继续继续`.
- [ ] Update enemy title line to `名称 HP/最大HP >目标`.
- [ ] Add dead-enemy darkened styling plus a clear ghost icon and `已死亡` label.

### Task 5: Refresh docs and shared logs

**Files:**
- Modify: `STAGE_DATA_INTERFACE_SPEC.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `开发更新日志.md`

- [ ] Document the new stage workbook fields and Chinese meanings.
- [ ] Document pause behavior, auto damage behavior, and dead-enemy retention rules.
- [ ] Append this round into the shared update log using the existing template.

### Task 6: Full verification

**Files:**
- No code changes expected

- [ ] Run `npm run generate:designer-data`
- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Run `npm run lint`

## Self-Review

- Spec coverage:
  - pause overlay -> Task 1, Task 3, Task 4, Task 5
  - stage-configurable party auto damage -> Task 1, Task 2, Task 3, Task 5
  - dead enemy retention and victory -> Task 2, Task 3, Task 4
  - enemy title line update -> Task 4
  - xlsx/doc/update-log sync -> Task 1, Task 5, Task 6
- Placeholder scan: no `TODO/TBD/implement later`
- Type consistency:
  - stage fields fixed as `partyAutoDamageIntervalMs / partyAutoDamageTargetCount / partyAutoDamageMin / partyAutoDamageMax`
  - pause state fixed as `pauseOverlay`
  - dead-enemy behavior expressed via `hp <= 0`, not a second boolean

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-pause-party-auto-damage-and-death-flow.md`.

User has already requested immediate inline execution, so this session proceeds directly with TDD-based implementation instead of pausing for execution choice.
