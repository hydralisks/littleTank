# Party Pressure Status-Driven Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a party-status runtime registry that drives team pressure changes through interval and event triggers, while keeping existing stage and enemy pressure fields stable.

**Architecture:** Extend `EncounterRuntime` with a lightweight `partyStatusRuntime` container keyed by active party status id, then process those statuses during `tickEncounter(...)` using a new `partyStatusEffectRegistry.ts`. Migrate pressure drift talents into “combat start grants party status” behavior, reuse `lastProcessedEvents` as the event input surface, and keep enemy pressure fields plus stage opening pressure data unchanged.

**Tech Stack:** TypeScript, Vitest, existing encounter command queue + event queue runtime, workbook-driven data catalogs

---

### File Structure

**Create:**

- `src/game/encounter/partyStatusEffectRegistry.ts`
  - Holds `effectLogicId -> handler` mappings for party status effects
  - Defines interval/event handler contracts
- `docs/superpowers/specs/2026-04-24-party-pressure-status-driven-design.md`
  - Already written spec, referenced during implementation

**Modify:**

- `src/game/encounter/encounterTypes.ts`
  - Add `partyStatusRuntime` types to `EncounterRuntime`
- `src/game/encounter/encounterFactory.ts`
  - Initialize/maintain party status runtime
  - Add unified `applyPartyPressureDelta(...)`
  - Run interval/event-based party status logic during tick
  - Migrate passive pressure drift behavior away from direct drift accumulation
- `src/game/data/playerTalentLogicRegistry.ts`
  - Stop using `partyPressureDriftPerSecond` for the migrated pressure talents
  - Instead provide the metadata needed for combat-start status application
- `src/game/data/playerBuildCatalog.ts`
  - If needed, expose the status definitions used by migrated talents
- `src/game/encounter/encounterFactory.test.ts`
  - Add TDD coverage for interval status effects, event-driven status effects, and migrated passive talents
- `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
  - Document that pressure-changing talents/skills should prefer party statuses + `effectLogicId`
- `DEVELOPMENT_HANDOFF.md`
  - Note the new party status runtime path
- `开发更新日志.md`
  - Add an entry for the new pressure-state system

**Verify only:**

- `STAGE_DATA_INTERFACE_SPEC.md`
- `关卡设计入口.md`

These should only need confirmation that stage opening fields stay unchanged, not substantive redesign.

### Task 1: Add party status runtime container and helper plumbing

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test near the existing encounter initialization/runtime tests:

```ts
it('initializes empty party status runtime on encounter creation', () => {
  const encounter = createHarborEncounter()

  expect(encounter.runtime.partyStatusRuntime).toEqual({})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because `partyStatusRuntime` does not exist on `EncounterRuntime`.

- [ ] **Step 3: Write minimal implementation**

In `src/game/encounter/encounterTypes.ts`, add:

```ts
export interface PartyStatusRuntimeEntry {
  initialized: boolean
  intervalElapsedMs: number
}

export type PartyStatusRuntime = Record<string, PartyStatusRuntimeEntry>
```

and extend `EncounterRuntime`:

```ts
partyStatusRuntime: PartyStatusRuntime
```

In `src/game/encounter/encounterFactory.ts`, initialize the runtime in `createInitialEncounterState(...)`:

```ts
runtime: {
  periodicPlayerStunRemainingMs: 0,
  pendingAffixTriggers: createPendingAffixTriggers(stage.affixes),
  stageRuleRuntime: createStageRuleRuntime(stage),
  partyStatusRuntime: {},
  partyAutoDamageRemainingMs: template.partyAutoDamageIntervalMs,
  damageSources: createInitialDamageSources(stage, template.partyAutoDamageIntervalMs),
  commandQueue: [],
  eventQueue: [],
  lastRejectedCommandMessage: null,
  lastProcessedEvents: [],
  pauseOverlay: null,
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new initialization test.

### Task 2: Add unified party pressure helper and interval party-status registry

**Files:**
- Create: `src/game/encounter/partyStatusEffectRegistry.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing test**

Add a focused interval-behavior test:

```ts
it('applies party status interval effects once per second', () => {
  const encounter = createHarborEncounter()
  const configured = {
    ...encounter,
    party: {
      ...encounter.party,
      pressure: 40,
      statuses: [
        {
          id: 'steady-relief',
          label: '稳压',
          shortLabel: '压',
          remainingMs: 3000,
          totalMs: 3000,
          tone: 'support' as const,
          kind: 'partyBuff' as const,
          effectLogicId: 'steady_relief',
        },
      ],
    },
  }

  const nextState = tickEncounter(configured, 1000)

  expect(nextState.party.pressure).toBe(38)
})
```

If `StatusEffect` does not include `effectLogicId`, build the status from the existing player-build status definition helper used by current code rather than hand-constructing it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because there is no party status effect registry and interval effects are not executed.

- [ ] **Step 3: Write minimal implementation**

Create `src/game/encounter/partyStatusEffectRegistry.ts`:

```ts
import type { EncounterEvent, EncounterState, PartyStatusRuntimeEntry, StatusEffect } from './encounterTypes'

export interface PartyStatusEffectHelpers {
  applyPartyPressureDelta: (state: EncounterState, delta: number) => EncounterState
}

export interface PartyStatusEffectHandler {
  intervalMs?: number
  onInterval?: (
    state: EncounterState,
    status: StatusEffect,
    runtime: PartyStatusRuntimeEntry,
    helpers: PartyStatusEffectHelpers,
  ) => EncounterState
  onEvent?: (
    state: EncounterState,
    status: StatusEffect,
    runtime: PartyStatusRuntimeEntry,
    event: EncounterEvent,
    helpers: PartyStatusEffectHelpers,
  ) => EncounterState
}

const PARTY_STATUS_EFFECT_REGISTRY: Record<string, PartyStatusEffectHandler> = {
  steady_relief: {
    intervalMs: 1000,
    onInterval: (state, _status, _runtime, helpers) => helpers.applyPartyPressureDelta(state, -2),
  },
}

export function getPartyStatusEffectHandler(effectLogicId: string) {
  return PARTY_STATUS_EFFECT_REGISTRY[effectLogicId] ?? null
}
```

In `src/game/encounter/encounterFactory.ts`, add:

```ts
function applyPartyPressureDelta(state: EncounterState, delta: number): EncounterState {
  return {
    ...state,
    party: {
      ...state.party,
      pressure: clamp(state.party.pressure + delta, 0, state.party.maxPressure),
    },
  }
}
```

and a helper:

```ts
function applyPartyStatusIntervalEffects(state: EncounterState, deltaMs: number): EncounterState
```

This helper should:

- iterate active party statuses except neutral placeholders
- read `status.effectLogicId`
- initialize runtime entries as `{ initialized: true, intervalElapsedMs: 0 }`
- accumulate `intervalElapsedMs += deltaMs`
- fire `onInterval` when the entry reaches `intervalMs`
- subtract `intervalMs` from the accumulator after each trigger
- clean up runtime entries for statuses that no longer exist

Call `applyPartyStatusIntervalEffects(...)` in `tickEncounter(...)` after `nextParty.statuses = tickStatuses(...)` and before stage special rules are applied.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new interval-effect test.

### Task 3: Feed `lastProcessedEvents` into party status event handlers

**Files:**
- Modify: `src/game/encounter/partyStatusEffectRegistry.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing test**

Add an event-driven test:

```ts
it('applies party status event effects from lastProcessedEvents', () => {
  const encounter = createHarborEncounterWithStandardBuild()
  const configured = {
    ...encounter,
    party: {
      ...encounter.party,
      pressure: 30,
      statuses: [
        createPlayerBuildStatusEffect('steady-relief-trigger', 5000),
      ],
    },
    runtime: {
      ...encounter.runtime,
      lastProcessedEvents: [
        {
          type: 'player/skill-activated',
          occurredAtMs: encounter.timeMs,
          skillId: 'warrior_t_panic_recovery',
        },
      ],
    },
  }

  const nextState = tickEncounter(configured, 100)

  expect(nextState.party.pressure).toBe(20)
})
```

Before writing the test, add or reuse a status definition whose `effectLogicId` is `skill_relief_on_use`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because party statuses do not consume `lastProcessedEvents`.

- [ ] **Step 3: Write minimal implementation**

Extend `src/game/encounter/partyStatusEffectRegistry.ts` with:

```ts
  skill_relief_on_use: {
    onEvent: (state, _status, _runtime, event, helpers) =>
      event.type === 'player/skill-activated' && event.skillId === 'warrior_t_panic_recovery'
        ? helpers.applyPartyPressureDelta(state, -10)
        : state,
  },
```

In `src/game/encounter/encounterFactory.ts`, add:

```ts
function applyPartyStatusEventEffects(state: EncounterState): EncounterState
```

This helper should:

- iterate active party statuses
- load their `effectLogicId` handlers
- pass each event from `state.runtime.lastProcessedEvents`
- apply `handler.onEvent(...)` in order
- preserve runtime entries

Call it in `tickEncounter(...)` after `applyPartyStatusIntervalEffects(...)` and before final enemy/cast progression begins, so it consumes the already-computed `lastProcessedEvents` from the command/event flush phase.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new event-driven party status test.

### Task 4: Migrate pressure drift passive talent into “combat start grants party status”

**Files:**
- Modify: `src/game/data/playerTalentLogicRegistry.ts`
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test for the existing pressure-valve style talent:

```ts
it('grants a party status instead of using direct pressure drift for pressure-valve talent', () => {
  const encounter = createInitialEncounterState(
    getStageById('harbor-1'),
    {
      ...getDefaultPersistedBuildForRule('standard_5slot'),
      passiveTalentIds: ['warrior_t_pressure_valve'],
    },
  )

  expect(encounter.party.statuses.some((status) => status.effectLogicId === 'steady_relief')).toBe(true)
  expect(getPassiveModifiers(['warrior_t_pressure_valve']).partyPressureDriftPerSecond).toBe(0)
})
```

If the exact talent id differs, use the real current pressure-valve style talent id from the catalog.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because the talent still modifies `partyPressureDriftPerSecond` directly and does not add a party status.

- [ ] **Step 3: Write minimal implementation**

In `src/game/data/playerTalentLogicRegistry.ts`, change the pressure-drift-down talent:

```ts
  party_pressure_drift_down_with_periodic_stun: (_talent, modifiers) => ({
    ...modifiers,
    periodicPlayerStunIntervalMs: 12_000,
    periodicPlayerStunDurationMs: 2_000,
  }),
```

Do not modify `partyPressureDriftPerSecond` here anymore.

In the player-build status definitions (wherever the pressure-valve party status should live), add a reusable status whose `effectLogicId` is `steady_relief`.

In `src/game/encounter/encounterFactory.ts`, during `createInitialEncounterState(...)` or the existing build-application path, append the granted party status for selected passive talents that declare such a party status.

Use the existing status-definition helpers already used for player buffs, rather than introducing a new workbook schema in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new passive-talent migration test.

### Task 5: Stop direct ambient pressure drift from affecting pressure by default

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing test**

Add a regression test to ensure default time passage does not change party pressure unless a skill, status, or rule causes it:

```ts
it('does not change party pressure from time passage alone when no status or rule applies', () => {
  const encounter = stripStageSpecialRules(createHarborEncounter())
  const configured = {
    ...encounter,
    stage: {
      ...encounter.stage,
      tuning: {
        ...encounter.stage.tuning,
        ambientPressurePerSecond: 0,
      },
    },
    party: {
      ...encounter.party,
      statuses: [{ ...STABLE_STATUS }],
    },
  }

  const nextState = tickEncounter(configured, 1000)

  expect(nextState.party.pressure).toBe(configured.party.pressure)
})
```

If `ambientPressurePerSecond` is already zero in the target stage, choose a stage/config where the current test would otherwise drift.

- [ ] **Step 2: Run test to verify it fails if direct drift still dominates**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: either FAIL or prove the current default drift is already neutral. If already neutral, keep the test as a guard and proceed.

- [ ] **Step 3: Write minimal implementation**

In `src/game/encounter/encounterFactory.ts`, keep:

- explicit enemy skill pressure changes
- explicit rule pressure changes
- explicit party status pressure changes

but reduce or remove reliance on:

```ts
modifiers.partyPressureDriftPerSecond
```

so that steady pressure movement is driven by statuses rather than passive modifier drift.

Do **not** remove `ambientPressurePerSecond` from stage tuning in this task; simply stop talents from relying on drift for pressure changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new regression test.

### Task 6: Document the new pressure-state path

**Files:**
- Modify: `PLAYER_BUILD_DATA_INTERFACE_SPEC.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Modify: `开发更新日志.md`
- Verify: `STAGE_DATA_INTERFACE_SPEC.md`
- Verify: `关卡设计入口.md`

- [ ] **Step 1: Write the documentation updates**

Update `PLAYER_BUILD_DATA_INTERFACE_SPEC.md` to explicitly say:

- pressure-changing passive talents should prefer:
  - grant a party status
  - use `effectLogicId`
- direct permanent drift is no longer the preferred path

Update `DEVELOPMENT_HANDOFF.md` to add:

- `partyStatusEffectRegistry.ts`
- `EncounterRuntime.partyStatusRuntime`
- `lastProcessedEvents` as the event source for party status effects

Prepend a new entry to `开发更新日志.md` describing:

- interval-based pressure states
- event-based pressure states
- migrated pressure-valve talent behavior

- [ ] **Step 2: Run targeted verification**

Run: `rg -n "partyStatusRuntime|steady_relief|lastProcessedEvents|effectLogicId" PLAYER_BUILD_DATA_INTERFACE_SPEC.md DEVELOPMENT_HANDOFF.md 开发更新日志.md`

Expected: matching lines in all three updated docs.

### Task 7: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused test suite**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS

## Self-Review

### Spec coverage

- 开场压力字段不变：Task 5 regression + docs verification
- 敌方技能压力字段不变：Task 5 regression and no schema edits
- `party.statuses` 接入 interval + event：Task 2, Task 3
- 使用 `lastProcessedEvents` 作为事件输入：Task 3, Task 6
- 压力漂移天赋迁成开战状态：Task 4
- 文档、交接、更新日志：Task 6
- 完整验证：Task 7

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain in task steps.

### Type consistency

- Runtime container name is consistently `partyStatusRuntime`
- Registry file name is consistently `partyStatusEffectRegistry.ts`
- Event source is consistently `lastProcessedEvents`
- Unified helper name is consistently `applyPartyPressureDelta(...)`
