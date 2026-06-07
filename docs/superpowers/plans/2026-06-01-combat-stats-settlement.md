# Combat Stats Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a concise five-page combat settlement UI backed by an append-only combat log and aggregation layer.

**Architecture:** Keep `EncounterEvent` as the state-mutation queue and add a parallel `combatLog` on `EncounterRuntime` for analytics. Record the first version at existing settlement points for player-side damage/healing/absorb, enemy tank damage, pressure, and cast handling, then aggregate into UI-ready rows consumed by a result panel.

**Tech Stack:** TypeScript, React 19, Vitest, existing Vite app and CSS.

---

### Task 1: Combat Log Types And Recording Helper

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Create: `src/game/encounter/combatLog.ts`
- Test: `src/game/encounter/combatLog.test.ts`

- [ ] Add a failing test proving `recordCombatLogEvent` appends immutably.
- [ ] Add `CombatLogEvent` types and `runtime.combatLog`.
- [ ] Implement `recordCombatLogEvent` and `recordCombatLogEvents`.
- [ ] Run `npm test -- src/game/encounter/combatLog.test.ts`.

### Task 2: Combat Stats Aggregation

**Files:**
- Create: `src/game/encounter/combatStats.ts`
- Test: `src/game/encounter/combatStats.test.ts`

- [ ] Add failing aggregation tests for tank damage, pressure, cast handling, damage dealt, healing, absorb, and empty logs.
- [ ] Implement `buildEncounterStats`.
- [ ] Run `npm test -- src/game/encounter/combatStats.test.ts`.

### Task 3: Record Existing Combat Events

**Files:**
- Modify: `src/game/encounter/encounterEventSystems.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] Add failing integration assertions for enemy tank damage, pressure, player skill damage, auto damage, healing/absorb, and interrupt handling.
- [ ] Record player skill damage from `enemy/damage-applied`.
- [ ] Record interrupt/control events from `enemy/cast-interrupted` and `enemy/cast-controlled`.
- [ ] Record enemy cast starts and resolutions in `tickEncounter` / `resolveCompletedCast`.
- [ ] Record player auto attack and party auto attack damage in damage source resolution.
- [ ] Record enemy tank damage and pressure where enemy casts resolve.
- [ ] Record player skill healing and absorb creation in skill runtime handlers.
- [ ] Run targeted encounter tests.

### Task 4: Result Stats UI

**Files:**
- Create: `src/ui/EncounterResultStatsPanel.tsx`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/styles/encounter.css`
- Test: `src/ui/EncounterScreen.test.ts`

- [ ] Add failing UI tests for five tabs, table headers, empty states, and existing result actions.
- [ ] Implement the result stats panel with concise Chinese labels.
- [ ] Replace the simple result button overlay with the stats panel.
- [ ] Add responsive CSS for the fixed result panel and compact tables.
- [ ] Run `npm test -- src/ui/EncounterScreen.test.ts`.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Report implemented files, test results, and any known V1 limitations.

## Self-Review

- Spec coverage: all five pages, event layer, aggregation, UI, and tests are represented.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: plan uses `CombatLogEvent`, `combatLog`, `buildEncounterStats`, and `EncounterResultStatsPanel` consistently with the design document.
