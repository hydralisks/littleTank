# Player Resource System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first class-owned player resource system for warrior rage and remove `resourceDelta` as a generic designer field.

**Architecture:** Add a focused encounter resource module that owns warrior rage gain and resource clamping helpers. Wire tick, incoming damage, and skill runtime helpers through it. Keep `resourceCost` as the only workbook field for generic skill resource data.

**Tech Stack:** TypeScript, Vitest, existing encounter command/event runtime.

---

### Task 1: Resource Module And Tick Rules

**Files:**
- Create: `src/game/encounter/playerResourceSystem.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] Add a failing test that sets `stage.tuning.playerResourceRegenMultiplier = 9`, ticks one second, and expects only warrior base rage plus passive talent modifiers.
- [ ] Create `playerResourceSystem.ts` with `getPlayerResourceDefinition`, `getPassiveResourceGain`, and `getDamageTakenResourceGain`.
- [ ] Replace the tick formula in `encounterFactory.ts` with the resource module.
- [ ] Run `npm test -- src/game/encounter/encounterFactory.test.ts`.

### Task 2: Resource Events And Skill Helper

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/encounter/encounterEventSystems.ts`
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] Add a failing test that overrides a skill to `skillLogicId = 'rage_gain_debug'`, activates it, and expects player rage to increase through runtime logic.
- [ ] Add `player/resource-changed` to `EncounterEvent`.
- [ ] Make `drainEncounterEvents` apply the event by clamping player resource.
- [ ] Add `changePlayerResource` to `RuntimeSkillHelpers`.
- [ ] Add a minimal `rage_gain_debug` runtime handler for tests and future examples.
- [ ] Run `npm test -- src/game/encounter/encounterFactory.test.ts`.

### Task 3: Remove `resourceDelta` Field

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/data/workbookLoader.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Modify docs that mention `resourceDelta`
- Test: `src/game/data/playerBuildCatalog.test.ts`

- [ ] Add or adjust tests so workbook overrides no longer rely on `resourceDelta`.
- [ ] Remove `resourceDelta` from active skill effect types and override merge logic.
- [ ] Remove `resourceDelta` from workbook loader output.
- [ ] Remove `resourceDelta` from generated workbook sample rows.
- [ ] Update designer docs to state resource gains belong in `skillLogicId`, talent logic, or status logic.
- [ ] Run `npm test`.

### Task 4: Verification

**Files:**
- No new files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run lint`.
- [ ] Update `开发更新日志.md` and `DEVELOPMENT_HANDOFF.md`.
