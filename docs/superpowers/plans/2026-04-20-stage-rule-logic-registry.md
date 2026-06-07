# Stage Rule Logic Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal `ruleLogicId` runtime registry for stage special rules, wire 3 sample rules into encounter execution, and document the planner-facing `.xlsx` entry points.

**Architecture:** Add a focused `stageRuleLogicRegistry` module that resolves `ruleLogicId` handlers from stage special-rule definitions and runs them at encounter start, on tick, and at encounter end. Keep the runtime surface minimal by storing lightweight per-rule timers in `EncounterRuntime`, reuse existing status helpers for rule effects, and update workbook/docs without broadening the special-rule schema yet.

**Tech Stack:** TypeScript, React/Vite, Vitest, existing encounter runtime and workbook loader

---

### Task 1: Add rule runtime types and registry entrypoint

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Create: `src/game/encounter/stageRuleLogicRegistry.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests in `src/game/encounter/encounterFactory.test.ts` that expect stage special rules to populate runtime state and execute on encounter start:

```ts
it('stores stage special rule runtime state on encounter creation', () => {
  const encounter = createHarborEncounter()

  expect(encounter.stage.specialRules.map((rule) => rule.ruleLogicId)).toContain('opening_pressure_shift')
  expect(encounter.runtime.stageRuleRuntime).toEqual(
    expect.objectContaining({
      opening_pressure_shift: expect.objectContaining({
        initialized: false,
      }),
    }),
  )
})

it('applies opening_pressure_shift exactly once at combat start', () => {
  const encounter = createHarborEncounter()
  const pressureBefore = encounter.party.pressure

  const nextState = tickEncounter(encounter, 100)

  expect(nextState.party.pressure).toBeGreaterThan(pressureBefore)
  expect(nextState.runtime.stageRuleRuntime.opening_pressure_shift?.initialized).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because `stageRuleRuntime` and the special-rule execution path do not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/game/encounter/encounterTypes.ts`, add:

```ts
export interface EncounterStageRuleRuntimeEntry {
  initialized: boolean
  timerMs?: number
  hasEnded?: boolean
}

export type EncounterStageRuleRuntime = Record<string, EncounterStageRuleRuntimeEntry>
```

and extend `EncounterRuntime`:

```ts
stageRuleRuntime: EncounterStageRuleRuntime
```

Create `src/game/encounter/stageRuleLogicRegistry.ts` with:

```ts
import type { EncounterSpecialRuleDefinition, EncounterState } from './encounterTypes'

export interface StageRuleLogicHelpers {
  clamp: (value: number, min: number, max: number) => number
}

export interface StageRuleLogicHandler {
  onEncounterStart?: (state: EncounterState, rule: EncounterSpecialRuleDefinition, helpers: StageRuleLogicHelpers) => EncounterState
  onTick?: (
    state: EncounterState,
    rule: EncounterSpecialRuleDefinition,
    deltaMs: number,
    helpers: StageRuleLogicHelpers,
  ) => EncounterState
  onEncounterEnd?: (state: EncounterState, rule: EncounterSpecialRuleDefinition, helpers: StageRuleLogicHelpers) => EncounterState
}
```

Add registry entries for:

- `opening_pressure_shift`
- `periodic_reinforcement`
- `player_control_tax`

with the first one implemented minimally and the others stubbed to no-op but typed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: the new “runtime state exists” test passes, while the next rule-behavior tests can still fail until later tasks.

### Task 2: Wire special rules into encounter creation and tick flow

**Files:**
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/encounterTypes.ts`
- Test: `src/game/encounter/encounterFactory.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for periodic and conditional rule behavior:

```ts
it('periodic_reinforcement grants a guarded status after its timer elapses', () => {
  const encounter = createInitialEncounterState(getStageById('midland-2'), getDefaultPersistedBuildForRule('standard_5slot'))

  const nextState = tickEncounter(encounter, 3000)

  expect(nextState.enemies.some((enemy) => enemy.statuses.some((status) => status.id === 'guarded'))).toBe(true)
})

it('player_control_tax only applies while the player is controlled', () => {
  const encounter = createInitialEncounterState(getStageById('highland-4'), getDefaultPersistedBuildForRule('full_8slot'))
  const idleState = tickEncounter(encounter, 1000)
  const stunnedState = tickEncounter(
    {
      ...encounter,
      player: {
        ...encounter.player,
        debuffs: [
          {
            id: 'stunned',
            label: '眩晕',
            shortLabel: '晕',
            remainingMs: 2000,
            totalMs: 2000,
            tone: 'danger',
            kind: 'playerDebuff',
          },
        ],
      },
    },
    1000,
  )

  expect(idleState.party.pressure).toBe(encounter.party.pressure)
  expect(stunnedState.party.pressure).toBeGreaterThan(encounter.party.pressure)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because the registry is not yet wired into `tickEncounter`.

- [ ] **Step 3: Write minimal implementation**

In `src/game/encounter/encounterFactory.ts`:

- initialize `stageRuleRuntime` when creating the encounter state
- add a helper that runs:
  - `onEncounterStart` once per rule
  - `onTick` every tick
  - `onEncounterEnd` once when result becomes non-null

Use a helper signature like:

```ts
function applyStageSpecialRules(state: EncounterState, deltaMs: number): EncounterState
```

and call it in `tickEncounter(...)` before damage-source resolution.

Implement the sample rules minimally:

- `opening_pressure_shift`: `party.pressure += 8`
- `periodic_reinforcement`: every `3000ms`, apply `guarded` to the first living enemy
- `player_control_tax`: while player has `stunned`, every `1000ms` add `6` pressure

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS for the new rule-runtime tests.

### Task 3: Sync workbook data and planner-facing docs

**Files:**
- Modify: `src/game/data/encounterTemplates.ts`
- Modify: `src/game/data/workbookLoader.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Modify: `STAGE_DATA_INTERFACE_SPEC.md`
- Modify: `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md`
- Create: `关卡设计入口.md`
- Modify: `开发更新日志.md`
- Modify: `DEVELOPMENT_HANDOFF.md`

- [ ] **Step 1: Write the failing test**

Add a workbook-loading regression test in `src/game/encounter/encounterFactory.test.ts` or the closest existing data test:

```ts
it('keeps stage special rules and buildRuleId when encounter templates are created', () => {
  const stage = getStageById('harbor-1')
  const encounter = createInitialEncounterState(stage, getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)))

  expect(encounter.stage.buildRuleId).toBeTruthy()
  expect(encounter.stage.specialRules.map((rule) => rule.ruleLogicId)).toContain('opening_pressure_shift')
})
```

- [ ] **Step 2: Run test to verify it fails if workbook/template wiring is incomplete**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL if any rule-definition wiring is missing.

- [ ] **Step 3: Write minimal implementation**

Keep the workbook schema unchanged, but ensure the sample workbook rows generated by `scripts/generateDesignerWorkbooks.mjs` clearly include:

- `关卡开场.buildRuleId`
- `关卡开场.partyAutoDamageIntervalMs`
- `关卡开场.partyAutoDamageTargetCount`
- `关卡开场.partyAutoDamageMin`
- `关卡开场.partyAutoDamageMax`
- `特殊规则绑定.ruleIdsCsv`
- `特殊规则定义.ruleLogicId`

Write `关卡设计入口.md` with sections for:

- 总入口文件
- `关卡开场`
- `敌人布置`
- `开场状态`
- `关卡词缀绑定`
- `词缀定义`
- `特殊规则绑定`
- `特殊规则定义`

Each section must list:

- sheet 名称
- 英文字段名
- 中文含义
- 是否已运行时接入

Update `STAGE_DATA_INTERFACE_SPEC.md` and `STAGE_AND_ENCOUNTER_TUNING_GUIDE.md` to mention:

- `ruleLogicId` 最小注册表
- 本轮只实现 3 个样例规则
- 策划继续通过 `.xlsx` 填关卡参数，后续再扩规则参数化

Append concise entries to:

- `开发更新日志.md`
- `DEVELOPMENT_HANDOFF.md`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: PASS with the new workbook/encounter wiring expectation.

### Task 4: Full verification

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

- 最小 `ruleLogicId` 注册表：Task 1
- 接入 `onEncounterStart / onTick / onEncounterEnd`：Task 1, Task 2
- 三个样例规则：Task 2
- `.xlsx` 接口保持稳定并同步样例：Task 3
- 新增 `关卡设计入口.md`：Task 3
- 更新日志与 handoff：Task 3
- 完整验证：Task 4

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain in task steps.

### Type consistency

- Runtime container name stays `stageRuleRuntime`
- Registry file name stays `stageRuleLogicRegistry.ts`
- Workbook contract keeps `ruleLogicId`, not a new parameter field set
