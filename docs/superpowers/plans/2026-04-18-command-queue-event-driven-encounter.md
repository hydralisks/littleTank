# Command Queue And Event-Driven Encounter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a command-queue plus event-driven encounter core that preserves player input order, removes stale UI-side skill validation, and gives threat/cast/status/death rules a unified execution path.

**Architecture:** Keep the existing `EncounterState` shape, but extend `runtime` with command and event queues plus rejection feedback. Split new logic into focused encounter modules: command/event types, command queue utilities, command handlers, and event systems. Wire UI to dispatch commands only, then drain commands immediately without advancing time; let `tickEncounter` handle time progression and event-driven rule propagation.

**Tech Stack:** React 19, TypeScript, Vitest, existing encounter runtime in `src/game/encounter`

---

## File Structure

### New Files

- `src/game/encounter/encounterCommands.ts`
  - Encounter command types
  - Queue helpers
  - Public dispatch entrypoints
- `src/game/encounter/encounterEvents.ts`
  - Encounter event types
  - Event queue helpers
- `src/game/encounter/encounterCommandSystem.ts`
  - Command validation and command-to-event conversion
- `src/game/encounter/encounterEventSystems.ts`
  - Event application for threat, cast stop, status lifecycle, death cleanup, and result finalization

### Modified Files

- `src/game/encounter/encounterTypes.ts`
  - Add `EncounterCommand`, `EncounterEvent`, and new runtime fields
- `src/game/encounter/encounterFactory.ts`
  - Replace direct UI mutation helpers with command dispatch helpers
  - Reorder tick flow to flush commands before time advance
  - Route threat/status/cast/death logic through event systems
- `src/game/encounter/playerSkillRuntimeRegistry.ts`
  - Return or enqueue event-oriented skill outcomes instead of mutating every downstream concern inline
- `src/ui/EncounterScreen.tsx`
  - Stop using stale UI-side `getSkillActivationBlockReason(encounter, skillId)` as the gate
  - Dispatch commands and display runtime rejection messages
- `src/game/encounter/encounterFactory.test.ts`
  - Add sequential-input, stale-validation regression, and event-lifecycle tests
- `开发更新日志.md`
  - Record the runtime architecture update after verification
- `DEVELOPMENT_HANDOFF.md`
  - Note the new command/event execution model for future agents

---

### Task 1: Add encounter command/event types and queue runtime fields

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Create: `src/game/encounter/encounterCommands.ts`
- Create: `src/game/encounter/encounterEvents.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing tests**

Append tests that lock the new runtime shape and queue helper behavior:

```ts
it('adds command and event queues to encounter runtime', () => {
  const encounter = createInitialEncounterState(stageTemplates[0], defaultBuild)

  expect(encounter.runtime.commandQueue).toEqual([])
  expect(encounter.runtime.eventQueue).toEqual([])
  expect(encounter.runtime.lastRejectedCommandMessage).toBeNull()
  expect(encounter.runtime.lastProcessedEvents).toEqual([])
})

it('enqueues commands in submit order', () => {
  let encounter = createInitialEncounterState(stageTemplates[0], defaultBuild)

  encounter = enqueueEncounterCommand(encounter, { type: 'ActivateSkill', skillId: 'warrior_t_taunt' })
  encounter = enqueueEncounterCommand(encounter, { type: 'SelectEnemy', enemyId: encounter.enemies[1].id })
  encounter = enqueueEncounterCommand(encounter, { type: 'ActivateSkill', skillId: 'warrior_t_interrupt' })

  expect(encounter.runtime.commandQueue).toEqual([
    { type: 'ActivateSkill', skillId: 'warrior_t_taunt' },
    { type: 'SelectEnemy', enemyId: encounter.enemies[1].id },
    { type: 'ActivateSkill', skillId: 'warrior_t_interrupt' },
  ])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because `commandQueue`, `eventQueue`, `lastRejectedCommandMessage`, `lastProcessedEvents`, and `enqueueEncounterCommand` do not exist yet.

- [ ] **Step 3: Write the minimal type and helper implementation**

Add queue fields to `EncounterRuntime` in `encounterTypes.ts`:

```ts
export type EncounterCommand =
  | { type: 'ActivateSkill'; skillId: SkillId }
  | { type: 'SelectEnemy'; enemyId: string }
  | { type: 'CycleEnemyTarget'; direction: 1 | -1 }
  | { type: 'OpenPauseOverlay' }
  | { type: 'ClosePauseOverlay' }

export type EncounterEvent =
  | { type: 'SkillActivated'; skillId: SkillId; targetId: string | null }
  | { type: 'CommandRejected'; reason: string }
  | { type: 'ThreatApplied'; enemyId: string; tankThreatDelta: number; allyThreatDelta: number }
  | { type: 'DamageApplied'; enemyId: string; amount: number; sourceId: string }
  | { type: 'StatusApplied'; targetType: 'enemy' | 'player' | 'party'; targetId: string | null; status: StatusEffect }
  | { type: 'StatusExpired'; targetType: 'enemy' | 'player' | 'party'; targetId: string | null; statusId: string }
  | { type: 'CastInterrupted'; enemyId: string; skillId: SkillId }
  | { type: 'CastControlled'; enemyId: string; skillId: SkillId }
  | { type: 'CastCompleted'; enemyId: string; skillId: string }
  | { type: 'EnemyDied'; enemyId: string }
  | { type: 'CurrentTargetCleared'; enemyId: string }
  | { type: 'EncounterEnded'; outcome: EncounterOutcome; reason: string }

export interface EncounterRuntime {
  periodicPlayerStunRemainingMs: number
  pendingAffixTriggers: PendingAffixTrigger[]
  partyAutoDamageRemainingMs: number
  damageSources: DamageSourceRuntime[]
  pauseOverlay: null | 'pause'
  commandQueue: EncounterCommand[]
  eventQueue: EncounterEvent[]
  lastRejectedCommandMessage: string | null
  lastProcessedEvents: EncounterEvent[]
}
```

Create `encounterCommands.ts` with:

```ts
import type { EncounterCommand, EncounterState } from './encounterTypes'

export function enqueueEncounterCommand(state: EncounterState, command: EncounterCommand): EncounterState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      commandQueue: [...state.runtime.commandQueue, command],
    },
  }
}
```

Create `encounterEvents.ts` with:

```ts
import type { EncounterEvent, EncounterState } from './encounterTypes'

export function enqueueEncounterEvent(state: EncounterState, event: EncounterEvent): EncounterState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      eventQueue: [...state.runtime.eventQueue, event],
    },
  }
}
```

Initialize the four new runtime fields in `createInitialEncounterState`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new queue-shape tests.

- [ ] **Step 5: Record task completion context**

Because the current workspace is not a git repository, do not add a commit step here. Keep the task checklist updated and proceed to the next failing test cycle.

### Task 2: Move UI input onto command dispatch and remove stale UI-side gating

**Files:**
- Modify: `src/game/encounter/encounterCommands.ts`
- Create: `src/game/encounter/encounterCommandSystem.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/ui/EncounterScreen.tsx`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing tests**

Add regression coverage for input order and stale validation:

```ts
it('dispatches sequential commands against latest state', () => {
  const first = createInitialEncounterState(stageTemplates[0], defaultBuild)
  const secondTarget = first.enemies.find((enemy) => enemy.id !== first.player.currentTargetId && enemy.hp > 0)!

  let next = dispatchEncounterCommand(first, { type: 'ActivateSkill', skillId: 'warrior_t_taunt' })
  next = dispatchEncounterCommand(next, { type: 'SelectEnemy', enemyId: secondTarget.id })
  next = dispatchEncounterCommand(next, { type: 'ActivateSkill', skillId: 'warrior_t_interrupt' })

  expect(next.player.currentTargetId).toBe(secondTarget.id)
  expect(next.skills.find((skill) => skill.id === 'warrior_t_interrupt')?.remainingCooldownMs).toBeGreaterThan(0)
})

it('does not reject a skill after a same-frame target selection', () => {
  const encounter = createInitialEncounterState(stageTemplates[0], defaultBuild)
  const secondTarget = encounter.enemies.find((enemy) => enemy.id !== encounter.player.currentTargetId && enemy.hp > 0)!

  const withoutTarget = {
    ...encounter,
    player: { ...encounter.player, currentTargetId: null },
  }

  let next = dispatchEncounterCommand(withoutTarget, { type: 'SelectEnemy', enemyId: secondTarget.id })
  next = dispatchEncounterCommand(next, { type: 'ActivateSkill', skillId: 'warrior_t_taunt' })

  expect(next.runtime.lastRejectedCommandMessage).toBeNull()
  expect(next.player.currentTargetId).toBe(secondTarget.id)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because `dispatchEncounterCommand` and the command system do not exist yet.

- [ ] **Step 3: Implement the command dispatch path**

Create `encounterCommandSystem.ts` with a narrow command processor:

```ts
import { enqueueEncounterEvent } from './encounterEvents'
import type { EncounterCommand, EncounterEvent, EncounterState } from './encounterTypes'

export interface CommandSystemHelpers {
  activateSkill: (state: EncounterState, skillId: string) => EncounterState
  selectEnemy: (state: EncounterState, enemyId: string) => EncounterState
  cycleEnemyTarget: (state: EncounterState, direction: 1 | -1) => EncounterState
  openPauseOverlay: (state: EncounterState) => EncounterState
  closePauseOverlay: (state: EncounterState) => EncounterState
  getSkillActivationBlockReason: (state: EncounterState, skillId: string) => string | null
}

export function applyEncounterCommand(
  state: EncounterState,
  command: EncounterCommand,
  helpers: CommandSystemHelpers,
): EncounterState {
  switch (command.type) {
    case 'ActivateSkill': {
      const reason = helpers.getSkillActivationBlockReason(state, command.skillId)
      if (reason) {
        return enqueueEncounterEvent(
          {
            ...state,
            runtime: {
              ...state.runtime,
              lastRejectedCommandMessage: reason,
            },
          },
          { type: 'CommandRejected', reason },
        )
      }

      return helpers.activateSkill(
        {
          ...state,
          runtime: {
            ...state.runtime,
            lastRejectedCommandMessage: null,
          },
        },
        command.skillId,
      )
    }
    case 'SelectEnemy':
      return helpers.selectEnemy(state, command.enemyId)
    case 'CycleEnemyTarget':
      return helpers.cycleEnemyTarget(state, command.direction)
    case 'OpenPauseOverlay':
      return helpers.openPauseOverlay(state)
    case 'ClosePauseOverlay':
      return helpers.closePauseOverlay(state)
  }
}
```

Extend `encounterCommands.ts`:

```ts
import { applyEncounterCommand, type CommandSystemHelpers } from './encounterCommandSystem'
import type { EncounterCommand, EncounterState } from './encounterTypes'

export function flushEncounterCommands(
  state: EncounterState,
  helpers: CommandSystemHelpers,
): EncounterState {
  let next = state
  const commands = next.runtime.commandQueue

  next = {
    ...next,
    runtime: {
      ...next.runtime,
      commandQueue: [],
      lastProcessedEvents: [],
    },
  }

  for (const command of commands) {
    next = applyEncounterCommand(next, command, helpers)
  }

  return next
}

export function dispatchEncounterCommand(
  state: EncounterState,
  command: EncounterCommand,
  helpers: CommandSystemHelpers,
): EncounterState {
  return flushEncounterCommands(enqueueEncounterCommand(state, command), helpers)
}
```

In `EncounterScreen.tsx`, replace the stale gate:

```ts
const dispatchCommand = useCallback((command: EncounterCommand) => {
  setEncounter((current) => dispatchEncounterCommand(current, command, encounterCommandHelpers))
}, [])
```

Use it for skill activation and target selection:

```ts
const tryActivateSkill = useCallback((skillId: SkillId) => {
  dispatchCommand({ type: 'ActivateSkill', skillId })
}, [dispatchCommand])
```

Also make warning text prefer `encounter.runtime.lastRejectedCommandMessage`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new sequential-input and stale-validation tests.

- [ ] **Step 5: Manually review the UI call sites**

Check:

- `tryActivateSkill`
- `Tab` target cycle
- enemy click selection
- pause/open/close buttons

All should now dispatch commands rather than call direct state mutation helpers from the UI layer.

### Task 3: Drain events during tick and route cast/status/threat/death through event systems

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/playerSkillRuntimeRegistry.ts`
- Modify: `src/game/encounter/encounterEventSystems.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing tests**

Add event-lifecycle coverage:

```ts
it('interrupt emits countered flow and advances to next skill after recovery', () => {
  const configured = buildEncounterWithInterruptibleCast()

  const interrupted = dispatchEncounterCommand(configured, { type: 'ActivateSkill', skillId: 'warrior_t_interrupt' })

  expect(interrupted.runtime.lastProcessedEvents.some((event) => event.type === 'CastInterrupted')).toBe(true)
  expect(interrupted.enemies[0].statuses.some((status) => status.id === 'countered')).toBe(true)

  const recovered = tickEncounter(interrupted, 2500)
  expect(recovered.enemies[0].skillCycleIndex).toBe(1)
})

it('control-only casts retry the same skill after control expires', () => {
  const configured = buildEncounterWithControlOnlyCast()

  const controlled = dispatchEncounterCommand(configured, { type: 'ActivateSkill', skillId: 'warrior_t_stun' })
  expect(controlled.runtime.lastProcessedEvents.some((event) => event.type === 'CastControlled')).toBe(true)

  const retried = tickEncounter(controlled, 2500)
  expect(retried.enemies[0].cast?.id).toBe(configured.enemies[0].cast?.id)
})

it('clears current target and preserves auto attack ready when target dies', () => {
  const configured = buildEncounterWithLowHpCurrentTarget()

  const next = dispatchEncounterCommand(configured, { type: 'ActivateSkill', skillId: 'warrior_t_burst' })

  expect(next.runtime.lastProcessedEvents.some((event) => event.type === 'EnemyDied')).toBe(true)
  expect(next.runtime.lastProcessedEvents.some((event) => event.type === 'CurrentTargetCleared')).toBe(true)
  expect(next.player.currentTargetId).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because no event draining or `lastProcessedEvents` pipeline exists yet.

- [ ] **Step 3: Implement event draining and hook it into tick flow**

Create `encounterEventSystems.ts` with a single public drain function first:

```ts
import type { EncounterEvent, EncounterState } from './encounterTypes'

export interface EncounterEventHelpers {
  finalizeEncounterState: (state: EncounterState) => EncounterState
}

export function drainEncounterEvents(
  state: EncounterState,
  helpers: EncounterEventHelpers,
): EncounterState {
  let next = state
  const processed: EncounterEvent[] = []

  while (next.runtime.eventQueue.length > 0) {
    const [event, ...rest] = next.runtime.eventQueue
    next = {
      ...next,
      runtime: {
        ...next.runtime,
        eventQueue: rest,
      },
    }
    processed.push(event)
    next = applyEncounterEvent(next, event)
  }

  return {
    ...helpers.finalizeEncounterState(next),
    runtime: {
      ...helpers.finalizeEncounterState(next).runtime,
      lastProcessedEvents: processed,
    },
  }
}
```

Then implement `applyEncounterEvent` cases incrementally for:

- `CommandRejected`
- `ThreatApplied`
- `DamageApplied`
- `StatusApplied`
- `StatusExpired`
- `CastInterrupted`
- `CastControlled`
- `EnemyDied`
- `CurrentTargetCleared`
- `EncounterEnded`

In `encounterFactory.ts`, reorder `tickEncounter`:

```ts
export function tickEncounter(state: EncounterState, deltaMs = TICK_INTERVAL_MS): EncounterState {
  if (state.result || state.runtime.pauseOverlay) {
    return flushAndDrainWithoutTimeAdvance(state)
  }

  const commandFlushed = flushEncounterCommands(state, encounterCommandHelpers)
  const commandResolved = drainEncounterEvents(commandFlushed, encounterEventHelpers)
  const advanced = advanceEncounterTime(commandResolved, deltaMs)
  return drainEncounterEvents(advanced, encounterEventHelpers)
}
```

In `playerSkillRuntimeRegistry.ts`, stop applying every side-effect inline. Instead, return a state that enqueues the appropriate events, for example:

```ts
return enqueueEncounterEvent(
  enqueueEncounterEvent(nextState, {
    type: 'DamageApplied',
    enemyId: enemy.id,
    amount: primaryDamage,
    sourceId: skillId,
  }),
  {
    type: 'ThreatApplied',
    enemyId: enemy.id,
    tankThreatDelta: threatGain,
    allyThreatDelta: 0,
  },
)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new cast/status/death event tests plus the prior command-order tests.

- [ ] **Step 5: Sanity-check the event list**

Confirm `lastProcessedEvents` contains only the latest flush/tick batch, not cumulative history, to keep tests and future debug UI deterministic.

### Task 4: Final integration, docs update, and full verification

**Files:**
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `开发更新日志.md`
- Modify: `DEVELOPMENT_HANDOFF.md`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing documentation/test expectation**

Add one final test for pause interaction:

```ts
it('still flushes commands while paused without advancing time', () => {
  const paused = openPauseOverlay(createInitialEncounterState(stageTemplates[0], defaultBuild))
  const target = paused.enemies.find((enemy) => enemy.hp > 0)!

  const next = dispatchEncounterCommand(paused, { type: 'SelectEnemy', enemyId: target.id })

  expect(next.player.currentTargetId).toBe(target.id)
  expect(next.timeMs).toBe(paused.timeMs)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL until the paused-path command flush behavior is implemented correctly.

- [ ] **Step 3: Implement the paused flush behavior and update docs**

Ensure the paused path in `tickEncounter` still does:

```ts
const commandFlushed = flushEncounterCommands(state, encounterCommandHelpers)
return drainEncounterEvents(commandFlushed, encounterEventHelpers)
```

without incrementing `timeMs`.

Then append a new entry to `开发更新日志.md` summarizing:

- command queue
- event queue
- stale UI validation removal
- sequential input ordering
- new runtime tests

And add a short handoff note in `DEVELOPMENT_HANDOFF.md` that future agents should extend command/event systems rather than adding direct UI-to-runtime mutation paths.

- [ ] **Step 4: Run the full verification suite**

Run:

- `npm test -- src/game/encounter/encounterFactory.test.ts`
- `npm test`
- `npm run build`
- `npm run lint`

Expected:

- encounter tests pass
- full Vitest suite passes
- build succeeds
- lint succeeds

- [ ] **Step 5: Launch preview and smoke-test the encounter UI**

Run:

- `npm run preview -- --host 127.0.0.1 --port 4173`

Manual checks:

- cast `技能1 -> 切目标 -> 无 GCD 技能2` no longer exhibits stale target rejection
- `Tab` cycling still works
- enemy click selection still works
- pause overlay still opens and closes
- rejection messages still show in the right panel warning area

---

## Self-Review

### Spec Coverage

- Command queue and unified dispatch: covered by Task 1 and Task 2
- Event queue and system split: covered by Task 1 and Task 3
- Threat / cast / status / death rule chain: covered by Task 3
- Remove stale UI-side validation: covered by Task 2
- Pause path and immediate command flush: covered by Task 4
- Docs and handoff sync: covered by Task 4

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain
- Every task includes explicit files, commands, and expected failures/passes

### Type Consistency

- Runtime queue fields consistently named:
  - `commandQueue`
  - `eventQueue`
  - `lastRejectedCommandMessage`
  - `lastProcessedEvents`
- Public helper names consistently named:
  - `enqueueEncounterCommand`
  - `dispatchEncounterCommand`
  - `flushEncounterCommands`
  - `enqueueEncounterEvent`
  - `drainEncounterEvents`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-command-queue-event-driven-encounter.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

