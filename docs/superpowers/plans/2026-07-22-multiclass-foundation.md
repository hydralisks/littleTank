# Multiclass Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-0 multiclass runtime, progression, save, stage-entry UI, and class-aware balance pipeline while preserving all current `warrior_t` behavior and keeping unfinished classes out of playable builds.

**Architecture:** A strict player-class runtime registry owns technical class metadata, while `player_build.xlsx` remains the source of truth for class names and gameplay content. Pure trial/progression services calculate challenge opening, temporary trial access, permanent campaign eligibility, and per-class victories; `App` stores class-scoped builds and passes an explicit `classId` through UI, encounter runtime, and balance analysis. Build rules become class-neutral templates, and every content lookup rejects missing or cross-class data instead of falling back to `warrior_t`.

**Tech Stack:** TypeScript 6, React 19, Vitest 4, JSDOM, XLSX, Vite, Tauri, CSS, optional one-shot Playwright visual verification.

---

## Scope And Safety

- This plan implements phase 0 only. It does not add playable `druid_bear_t` or `dk_blood_t` skills, talents, resources, handlers, or default builds.
- Register only `warrior_t` initially. Trial policies may name future class IDs, but availability must intersect policy eligibility, stage `allowedClassIdsCsv`, enabled designer data, and the runtime registry.
- Do not run `npm run generate:designer-data`, `node scripts/generateDesignerWorkbooks.mjs`, or any public asset generator.
- The one planned binary edit is limited to clearing `classId` cells in `public/designer-data/player_build.xlsx -> 构筑规则定义`; verify the exact six rule rows before and after writing.
- Preserve the untracked `.superpowers/` directory and any unrelated user changes.

## File Map

**New runtime and progression units**

- `src/game/playerClasses/playerClassRuntimeRegistry.ts`: exact runtime registration, primary resource metadata, UI order/icon key, AI strategy ID, and per-encounter class runtime initialization.
- `src/game/playerClasses/playerClassRuntimeRegistry.test.ts`: registry exact-hit and missing-registration behavior.
- `src/game/progression/classTrialPolicy.ts`: ordered three-challenge groups and milestone policy.
- `src/game/progression/classProgression.ts`: idempotent victory recording and permanent eligibility derivation.
- `src/game/progression/stageClassAvailability.ts`: single source of truth for stage/class availability.
- `src/game/progression/*.test.ts`: policy, 2/3 versus 3/3, wrong-class, cumulative availability, chapter-one lock, and content-cap tests.
- `src/ui/StageClassEntryControl.tsx`: fixed CTA plus 4-column by 3-row class selector.
- `src/ui/StageClassEntryControl.test.tsx`: 12-slot layout, vertical ordering, selection, label, and victory check tests.

**Existing units with changed contracts**

- `src/game/encounter/encounterTypes.ts`, `encounterFactory.ts`, `playerResourceSystem.ts`: explicit class identity in encounter state and strict resource lookup.
- `src/game/data/playerBuildCatalog.ts`, `workbookLoader.ts`, `designerDataValidator.ts`: class-neutral build rules and class-strict skill/talent/default-build selection.
- `src/app/saveGame.ts`, `App.tsx`: v1-to-v2 migration, class-scoped builds, victories, permanent eligibility, and encounter class identity.
- `src/ui/StageSelectScreen.tsx`, `EncounterScreen.tsx`, `src/styles/encounter.css`: class selector integration and class-filtered build editing.
- `src/game/balance/balanceBuildGenerator.ts`, `balanceSimulator.ts`, `learningBalanceEvaluator.ts`, `balanceReport.ts`, related report/delta modules, and analyzer scripts: required `classId` dimension.
- `public/designer-data/player_build.xlsx`: clear build-rule class bindings only.
- `scripts/generateDesignerWorkbooks.mjs`: keep generator source aligned without running it.
- `scripts/validateDesignerData.mjs`: validate mainline and challenge workbooks together.
- `docs/player-tank-class-expansion-handoff.md`, `开发更新日志.md`: phase-0 implementation record and next-entry contract.

### Task 1: Add The Strict Player-Class Runtime Registry

**Files:**
- Create: `src/game/playerClasses/playerClassRuntimeRegistry.ts`
- Create: `src/game/playerClasses/playerClassRuntimeRegistry.test.ts`
- Modify: `src/game/encounter/encounterTypes.ts`

- [ ] **Step 1: Write the failing registry tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  WARRIOR_T_CLASS_ID,
  getPlayerClassRuntimeDefinition,
  getPlayerClassRuntimeDefinitions,
} from './playerClassRuntimeRegistry'

describe('playerClassRuntimeRegistry', () => {
  it('returns the registered warrior runtime with stable technical metadata', () => {
    expect(getPlayerClassRuntimeDefinition(WARRIOR_T_CLASS_ID)).toMatchObject({
      classId: 'warrior_t',
      selectionOrder: 0,
      buttonIconKey: 'sword',
      aiStrategyId: 'warrior_t_default',
      primaryResource: {
        id: 'rage',
        label: '怒气',
        maxResource: 100,
      },
    })
    expect(getPlayerClassRuntimeDefinitions().map((entry) => entry.classId)).toEqual(['warrior_t'])
  })

  it('throws instead of silently using warrior metadata for an unknown class', () => {
    expect(() => getPlayerClassRuntimeDefinition('missing_tank')).toThrowError(
      'Player class runtime is not registered: missing_tank',
    )
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `npm test -- src/game/playerClasses/playerClassRuntimeRegistry.test.ts`

Expected: FAIL because `playerClassRuntimeRegistry.ts` does not exist.

- [ ] **Step 3: Add the shared class ID and registry implementation**

Add to `encounterTypes.ts` near the other player-class types:

```ts
export type PlayerClassId = string
export type PlayerClassRuntimeState = Record<string, number>
```

Create `playerClassRuntimeRegistry.ts` with this complete public contract:

```ts
import type { PlayerClassId, PlayerClassRuntimeState } from '../encounter/encounterTypes'

export const WARRIOR_T_CLASS_ID: PlayerClassId = 'warrior_t'

export interface PlayerPrimaryResourceDefinition {
  id: string
  label: string
  maxResource: number
  passiveGainPerSecond: number
  damageTakenGainDivisor: number
  minimumDamageTakenGain: number
}

export interface PlayerClassRuntimeDefinition {
  classId: PlayerClassId
  selectionOrder: number
  buttonIconKey: 'sword' | 'paw-print' | 'droplets' | 'shield'
  aiStrategyId: string
  primaryResource: PlayerPrimaryResourceDefinition
  initializeRuntime: () => PlayerClassRuntimeState
}

const PLAYER_CLASS_RUNTIME_DEFINITIONS: Record<PlayerClassId, PlayerClassRuntimeDefinition> = {
  warrior_t: {
    classId: WARRIOR_T_CLASS_ID,
    selectionOrder: 0,
    buttonIconKey: 'sword',
    aiStrategyId: 'warrior_t_default',
    primaryResource: {
      id: 'rage',
      label: '怒气',
      maxResource: 100,
      passiveGainPerSecond: 3,
      damageTakenGainDivisor: 5,
      minimumDamageTakenGain: 4,
    },
    initializeRuntime: () => ({}),
  },
}

export function hasPlayerClassRuntimeDefinition(classId: PlayerClassId) {
  return Boolean(PLAYER_CLASS_RUNTIME_DEFINITIONS[classId])
}

export function getPlayerClassRuntimeDefinition(classId: PlayerClassId) {
  const definition = PLAYER_CLASS_RUNTIME_DEFINITIONS[classId]
  if (!definition) {
    throw new Error(`Player class runtime is not registered: ${classId}`)
  }
  return definition
}

export function getPlayerClassRuntimeDefinitions() {
  return Object.values(PLAYER_CLASS_RUNTIME_DEFINITIONS)
    .sort((left, right) => left.selectionOrder - right.selectionOrder || left.classId.localeCompare(right.classId))
}
```

- [ ] **Step 4: Run the registry tests**

Run: `npm test -- src/game/playerClasses/playerClassRuntimeRegistry.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit the registry**

```powershell
git add src/game/playerClasses/playerClassRuntimeRegistry.ts src/game/playerClasses/playerClassRuntimeRegistry.test.ts src/game/encounter/encounterTypes.ts
git commit -m "feat: add strict player class runtime registry"
```

### Task 2: Make Build APIs Explicitly Class-Scoped

**Files:**
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/data/playerBuildCatalog.test.ts`
- Modify call sites in: `src/app/App.tsx`, `src/app/saveGame.test.ts`, `src/ui/StageSelectScreen.tsx`, `src/ui/StageSelectScreen.test.ts`, `src/ui/EncounterScreen.tsx`, `src/ui/EncounterScreen.test.ts`
- Modify call sites in: `src/game/encounter/combatLog.test.ts`, `src/game/encounter/combatTelemetry.integration.test.ts`, `src/game/encounter/encounterFactory.test.ts`
- Modify call sites in: `src/game/balance/balanceBuildGenerator.ts`, `balanceBuildGenerator.test.ts`, `balanceSimulator.test.ts`, `deltaAnalysis.ts`, `manualPlaytestBuilds.ts`
- Modify call sites in: `scripts/analyzeBalance.mjs`

- [ ] **Step 1: Add failing cross-class and no-fallback tests**

Use the existing `emptyPlayerBuildOverrides()` helper and reset hook in `playerBuildCatalog.test.ts`:

```ts
it('selects defaults and legal content by explicit class without cross-class fallback', () => {
  applyPlayerBuildWorkbookOverrides({
    ...emptyPlayerBuildOverrides(),
    classDefinitions: [{
      classId: 'druid_bear_t',
      className: '熊T',
      roleTag: 'tank',
      classDescription: 'test class',
      recommendedBuildRuleIds: ['standard_5slot'],
      enabled: true,
    }],
    activeSkillDefinitions: [{
      skillId: 'druid_bear_t_growl',
      classId: 'druid_bear_t',
      skillName: '低吼',
      shortName: '低吼',
      description: 'test skill',
      iconId: 'taunt',
      pointCost: 4,
      resourceCost: 0,
      cooldownMs: 8000,
      gcdMs: 800,
      targetingType: 'currentEnemy',
      skillLogicId: 'taunt_single',
      castStopMode: 'none',
      canAffectSkull: true,
      enabled: true,
    }],
    defaultActiveBuilds: [{
      presetId: 'druid_bear_t',
      classId: 'druid_bear_t',
      hotkey: '1',
      skillId: 'druid_bear_t_growl',
      priority: 1,
    }],
  })

  expect(getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t').loadout['1'])
    .toBe('druid_bear_t_growl')
  expect(canUseSkillInRule(
    'standard_5slot',
    'druid_bear_t',
    'warrior_t_taunt',
    ['warrior_t_taunt', 'druid_bear_t_growl'],
  )).toBe(false)
  expect(() => getDefaultPersistedBuildForRule('standard_5slot', 'dk_blood_t')).toThrowError(
    'Missing default active build for class dk_blood_t and rule standard_5slot',
  )
})

it('removes skills and talents owned by another class during normalization', () => {
  const normalized = normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t'),
    'standard_5slot',
    'druid_bear_t',
    1,
    ['warrior_t_taunt'],
  )

  expect(Object.values(normalized.build.loadout).filter(Boolean)).toEqual([])
  expect(normalized.build.passiveTalentIds).toEqual([])
  expect(normalized.warnings.some((warning) => warning.code === 'removed_skill')).toBe(true)
})
```

- [ ] **Step 2: Run the catalog test and verify signature/type failures**

Run: `npm test -- src/game/data/playerBuildCatalog.test.ts`

Expected: FAIL because the build APIs do not accept an explicit `classId` and still use `rule.classId`.

- [ ] **Step 3: Replace rule-owned filtering with class-owned filtering**

Use these exact signatures and ownership checks in `playerBuildCatalog.ts`:

```ts
function getRequiredBuildRule(buildRuleId: string) {
  const rule = buildRulesById[buildRuleId]
  if (!rule?.enabled) throw new Error(`Unknown build rule: ${buildRuleId}`)
  return rule
}

function isSkillAllowedByRule(
  buildRuleId: string,
  classId: PlayerClassId,
  skillId: SkillId,
  unlockedActiveSkillIds?: readonly SkillId[],
) {
  const rule = getRequiredBuildRule(buildRuleId)
  const skill = activeSkillsById[skillId]
  return Boolean(
    rule &&
    skill?.enabled &&
    skill.classId === classId &&
    (!unlockedActiveSkillIds || unlockedActiveSkillIds.includes(skillId)),
  )
}

function isTalentAllowedByRule(
  buildRuleId: string,
  classId: PlayerClassId,
  talentId: PassiveTalentId,
  maxUnlockedTier = Infinity,
) {
  const rule = getRequiredBuildRule(buildRuleId)
  const talent = passiveTalentsById[talentId]
  return Boolean(rule && talent?.enabled && talent.classId === classId && talent.tier <= maxUnlockedTier)
}

export function canUseSkillInRule(
  buildRuleId: string,
  classId: PlayerClassId,
  skillId: SkillId,
  unlockedActiveSkillIds?: readonly SkillId[],
) {
  return isSkillAllowedByRule(buildRuleId, classId, skillId, unlockedActiveSkillIds)
}

export function canUseTalentInRule(
  buildRuleId: string,
  classId: PlayerClassId,
  talentId: PassiveTalentId,
  maxUnlockedTier = Infinity,
) {
  return isTalentAllowedByRule(buildRuleId, classId, talentId, maxUnlockedTier)
}
```

Default rows with an exact `buildRuleId + classId` pair take precedence; class-only rows are the same-class fallback for rules that intentionally share one preset. Never inspect `rule.classId` and never use another class:

```ts
function getDefaultActiveEntries(buildRuleId: string, classId: PlayerClassId) {
  const exact = defaultActiveBuilds.filter(
    (entry) => entry.buildRuleId === buildRuleId && entry.classId === classId,
  )
  const classDefault = defaultActiveBuilds.filter(
    (entry) => !entry.buildRuleId && entry.classId === classId,
  )
  return (exact.length > 0 ? exact : classDefault).sort((left, right) => left.priority - right.priority)
}

export function getDefaultPersistedBuildForRule(
  buildRuleId: string,
  classId: PlayerClassId,
): PersistedBuildState {
  getRequiredBuildRule(buildRuleId)

  const activeEntries = getDefaultActiveEntries(buildRuleId, classId)
  if (activeEntries.length === 0) {
    throw new Error(`Missing default active build for class ${classId} and rule ${buildRuleId}`)
  }

  const loadout = createEmptyLoadout()
  for (const entry of activeEntries) {
    loadout[entry.hotkey] = entry.skillId
  }

  const exactPassives = defaultPassiveBuilds.filter(
    (entry) => entry.selected && entry.buildRuleId === buildRuleId && entry.classId === classId,
  )
  const classPassives = defaultPassiveBuilds.filter(
    (entry) => entry.selected && !entry.buildRuleId && entry.classId === classId,
  )
  const passiveTalentIds = (exactPassives.length > 0 ? exactPassives : classPassives)
    .sort((left, right) => left.priority - right.priority)
    .map((entry) => entry.talentId)

  return { loadout, passiveTalentIds }
}
```

Change normalization to this parameter order and pass `classId` through every internal default/legality call. Replace all remaining internal `getRuleOrFallback` calls with `getRequiredBuildRule`, so an unknown rule cannot silently become `standard_5slot`:

```ts
export function normalizePersistedBuildForRule(
  previousBuild: PersistedBuildState | null | undefined,
  buildRuleId: string,
  classId: PlayerClassId,
  maxUnlockedPassiveTalentTier = Infinity,
  unlockedActiveSkillIds?: readonly SkillId[],
  newlyUnlockedActiveSkillIds: readonly SkillId[] = [],
): BuildNormalizationResult
```

Add an encounter-entry guard:

```ts
export function assertBuildMatchesClass(classId: PlayerClassId, build: PersistedBuildState) {
  for (const skillId of Object.values(build.loadout)) {
    if (skillId && activeSkillsById[skillId]?.classId !== classId) {
      throw new Error(`Build for ${classId} contains skill owned by another class: ${skillId}`)
    }
  }
  for (const talentId of build.passiveTalentIds) {
    if (passiveTalentsById[talentId]?.classId !== classId) {
      throw new Error(`Build for ${classId} contains talent owned by another class: ${talentId}`)
    }
  }
}
```

- [ ] **Step 4: Update current call sites with an explicit warrior migration value**

Import `WARRIOR_T_CLASS_ID` and apply these exact transformations so the tree compiles before dynamic class state is introduced:

```ts
getDefaultPersistedBuildForRule(buildRuleId, WARRIOR_T_CLASS_ID)
canUseSkillInRule(buildRuleId, WARRIOR_T_CLASS_ID, skillId, unlockedSkillIds)
canUseTalentInRule(buildRuleId, WARRIOR_T_CLASS_ID, talentId, passiveTier)
normalizePersistedBuildForRule(build, buildRuleId, WARRIOR_T_CLASS_ID, passiveTier, unlockedSkillIds)
```

Keep the constants temporarily warrior-scoped:

```ts
export const defaultSkillLoadout = getDefaultPersistedBuildForRule('standard_5slot', WARRIOR_T_CLASS_ID).loadout
export const defaultSelectedPassiveTalentIds = getDefaultPersistedBuildForRule(
  'standard_5slot',
  WARRIOR_T_CLASS_ID,
).passiveTalentIds
```

- [ ] **Step 5: Prove that no implicit call sites remain**

Run:

```powershell
rg -n "getDefaultPersistedBuildForRule\([^,\n]+\)" src scripts
rg -n "canUseSkillInRule\(buildRuleId, skillId|canUseTalentInRule\(buildRuleId, talentId" src scripts
npm test -- src/game/data/playerBuildCatalog.test.ts src/game/balance/balanceBuildGenerator.test.ts src/ui/StageSelectScreen.test.ts
npm run build
```

Expected: both `rg` commands print no stale calls; tests and build PASS.

- [ ] **Step 6: Commit class-scoped build contracts**

```powershell
git add src scripts/analyzeBalance.mjs
git commit -m "refactor: scope player builds by class"
```

### Task 3: Convert Build Rules To Shared Templates

**Files:**
- Modify: `src/game/data/playerBuildCatalog.ts`
- Modify: `src/game/data/playerBuildCatalog.test.ts`
- Modify: `src/game/data/designerDataValidator.ts`
- Modify: `src/game/data/designerDataValidator.test.ts`
- Modify: `src/game/data/designerDataValidator.health.test.ts`
- Modify: `scripts/generateDesignerWorkbooks.mjs`
- Modify binary: `public/designer-data/player_build.xlsx`

- [ ] **Step 1: Add a failing validator test for a blank build-rule class field**

In the existing valid workbook fixture, set the shared rule row to:

```ts
{
  buildRuleId: 'standard_5slot',
  classId: '',
  ruleName: 'Standard',
  description: 'shared template',
  totalBuildPoints: 24,
  maxActiveSlots: 5,
  enabledHotkeysCsv: '1,2,3,4,Q',
  inheritancePolicy: 'keep_active_first',
}
```

Assert:

```ts
expect(validateDesignerDataWorkbooks(workbooks).errors).not.toEqual(
  expect.arrayContaining([
    expect.objectContaining({ sheet: '构筑规则定义', field: 'classId' }),
  ]),
)
```

In `playerBuildCatalog.test.ts`, apply an override whose `standard_5slot.classId` is `undefined`, then assert:

```ts
expect(getBuildRuleDefinition('standard_5slot')?.classId).toBeUndefined()
```

- [ ] **Step 2: Run the validator test and verify it fails with `missing_required`**

Run: `npm test -- src/game/data/designerDataValidator.test.ts src/game/data/designerDataValidator.health.test.ts src/game/data/playerBuildCatalog.test.ts`

Expected: FAIL because `构筑规则定义.classId` is currently passed through `requireText` and the built-in/override catalog still preserves `warrior_t`.

- [ ] **Step 3: Make the cell optional while preserving the header**

Replace only the build-rule row validation with:

```ts
rows.buildRules.forEach((row, index) => {
  validateReference(
    errors,
    WORKBOOK_NAMES.playerBuild,
    '构筑规则定义',
    index,
    'classId',
    optionalText(row, 'classId'),
    classIds,
  )
  validateCsvEnum(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'enabledHotkeysCsv', ENUMS.skillHotkey)
  validateEnum(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'inheritancePolicy', ENUMS.inheritancePolicy, { required: true })
  validateNumber(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'totalBuildPoints', { required: true, min: 0 })
  validateNumber(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'maxActiveSlots', { required: true, min: 0, max: 8, integer: true })
})
```

Keep `classId` in `requiredHeaders`: the column is a compatibility field even though shared rows leave it blank.

Remove `classId: 'warrior_t'` from every built-in build rule in `DEFAULT_BUILD_RULES`. A blank workbook cell must also clear a legacy built-in binding instead of preserving it. Change the build-rule override merge to:

```ts
const base = nextRules[override.buildRuleId] ?? {
  buildRuleId: override.buildRuleId,
  ruleName: override.buildRuleId,
  description: '',
  totalBuildPoints: 0,
  maxActiveSlots: 0,
  enabledHotkeys: [],
  inheritancePolicy: 'keep_active_first' as const,
  enabled: true,
}

nextRules[override.buildRuleId] = {
  ...base,
  classId: override.classId,
  ...(override.ruleName ? { ruleName: override.ruleName } : {}),
  ...(override.description ? { description: override.description } : {}),
  ...(typeof override.totalBuildPoints === 'number' ? { totalBuildPoints: override.totalBuildPoints } : {}),
  ...(typeof override.maxActiveSlots === 'number' ? { maxActiveSlots: override.maxActiveSlots } : {}),
  ...(override.enabledHotkeys ? { enabledHotkeys: [...override.enabledHotkeys] } : {}),
  ...(override.inheritancePolicy ? { inheritancePolicy: override.inheritancePolicy } : {}),
  ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
}
```

Update the old catalog assertion from `expect(standardRule?.classId).toBe('warrior_t')` to `toBeUndefined()`.

- [ ] **Step 4: Update generator source without running it**

For the six build rule literals in `scripts/generateDesignerWorkbooks.mjs`, change `classId: 'warrior_t'` to `classId: ''`. Do not change class IDs on skills, talents, or default build rows.

- [ ] **Step 5: Perform the approved targeted workbook edit**

First inspect the exact rows:

```powershell
@'
import XLSX from 'xlsx'
const file = 'public/designer-data/player_build.xlsx'
const workbook = XLSX.readFile(file)
const sheet = workbook.Sheets[workbook.SheetNames[1]]
console.log(XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(({ buildRuleId, classId }) => ({ buildRuleId, classId })))
'@ | node --input-type=module -
```

Expected: six rows, all currently `classId: 'warrior_t'`.

Then clear only those six cells while preserving sheet dimensions:

```powershell
@'
import XLSX from 'xlsx'
const file = 'public/designer-data/player_build.xlsx'
const workbook = XLSX.readFile(file)
const sheetName = workbook.SheetNames[1]
const sheet = workbook.Sheets[sheetName]
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
const allowedRuleIds = new Set(['tutorial_2slot', 'standard_5slot', '8slot_0', '8slot_1', '8slot_2', '8slot_3'])
if (rows.length !== 6 || rows.some((row) => !allowedRuleIds.has(row.buildRuleId))) {
  throw new Error('Unexpected build rule rows; refusing to rewrite player_build.xlsx')
}
const nextSheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ ...row, classId: '' })))
if (sheet['!cols']) nextSheet['!cols'] = sheet['!cols']
if (sheet['!rows']) nextSheet['!rows'] = sheet['!rows']
workbook.Sheets[sheetName] = nextSheet
XLSX.writeFile(workbook, file)
'@ | node --input-type=module -
```

Do not run either public generator after this edit.

- [ ] **Step 6: Verify the targeted data change**

Run:

```powershell
npm run validate:designer-data
npm test -- src/game/data/designerDataValidator.test.ts src/game/data/designerDataValidator.health.test.ts src/game/data/workbookLoader.test.ts src/game/data/playerBuildCatalog.test.ts
git diff --stat -- public/designer-data/player_build.xlsx scripts/generateDesignerWorkbooks.mjs
```

Expected: validator passes with 0 warnings; focused tests PASS; the binary workbook and generator source are the only designer-data-related changes.

- [ ] **Step 7: Commit shared build templates**

```powershell
git add public/designer-data/player_build.xlsx scripts/generateDesignerWorkbooks.mjs src/game/data/playerBuildCatalog.ts src/game/data/playerBuildCatalog.test.ts src/game/data/designerDataValidator.ts src/game/data/designerDataValidator.test.ts src/game/data/designerDataValidator.health.test.ts
git commit -m "refactor: make build rules class neutral"
```

### Task 4: Thread Class Identity Through Encounter Runtime

**Files:**
- Modify: `src/game/encounter/encounterTypes.ts`
- Modify: `src/game/encounter/playerResourceSystem.ts`
- Modify: `src/game/encounter/encounterFactory.ts`
- Modify: `src/game/encounter/encounterFactory.test.ts`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/ui/EncounterScreen.test.ts`
- Modify all `createInitialEncounterState` callers found by `rg`

- [ ] **Step 1: Add failing strict-runtime tests**

Add to `encounterFactory.test.ts`:

```ts
it('stores the explicit class and initializes its registered resource/runtime state', () => {
  const stage = getStageById('RingingDeeps-1')
  const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage), 'warrior_t')
  const encounter = createInitialEncounterState(stage, 'warrior_t', build)

  expect(encounter.player.classId).toBe('warrior_t')
  expect(encounter.player.maxResource).toBe(100)
  expect(encounter.runtime.classRuntime).toEqual({})
})

it('rejects unknown class runtimes before creating combat state', () => {
  const stage = getStageById('RingingDeeps-1')
  const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage), 'warrior_t')

  expect(() => createInitialEncounterState(stage, 'missing_tank', build)).toThrowError(
    'Player class runtime is not registered: missing_tank',
  )
})
```

- [ ] **Step 2: Run the focused tests and verify signature failures**

Run: `npm test -- src/game/encounter/encounterFactory.test.ts`

Expected: FAIL because encounter creation still accepts two parameters and `PlayerState` has no `classId`.

- [ ] **Step 3: Make resource lookup strict**

Replace `playerResourceSystem.ts` with registry-backed functions and remove all default parameters:

```ts
import type { PassiveTalentModifiers, PlayerClassId, PlayerState } from './encounterTypes'
import { getPlayerClassRuntimeDefinition } from '../playerClasses/playerClassRuntimeRegistry'

export function getPlayerResourceDefinition(classId: PlayerClassId) {
  return getPlayerClassRuntimeDefinition(classId).primaryResource
}

export function getPassiveResourceGain(
  deltaMs: number,
  modifiers: Pick<PassiveTalentModifiers, 'playerResourceRegenMultiplier'>,
  classId: PlayerClassId,
) {
  const definition = getPlayerResourceDefinition(classId)
  return definition.passiveGainPerSecond * modifiers.playerResourceRegenMultiplier * (deltaMs / 1000)
}

export function getDamageTakenResourceGain(playerDamage: number, classId: PlayerClassId) {
  if (playerDamage <= 0) return 0
  const definition = getPlayerResourceDefinition(classId)
  return Math.min(definition.minimumDamageTakenGain, Math.round(playerDamage / definition.damageTakenGainDivisor))
}

export function changePlayerResource(player: PlayerState, delta: number): PlayerState {
  return {
    ...player,
    resource: Math.max(0, Math.min(player.maxResource, player.resource + delta)),
  }
}
```

- [ ] **Step 4: Add encounter state fields and strict factory entry**

Update the types:

```ts
export interface PlayerState {
  classId: PlayerClassId
  hp: number
  maxHp: number
  resource: number
  maxResource: number
  gcdRemainingMs: number
  currentTargetId: string | null
  mitigation: StatusEffect | null
  buffs: StatusEffect[]
  debuffs: StatusEffect[]
}

export interface EncounterRuntime {
  classRuntime: PlayerClassRuntimeState
  periodicPlayerStunRemainingMs: number
  pendingAffixTriggers: PendingAffixTrigger[]
  stageRuleRuntime: EncounterStageRuleRuntime
  partyStatusRuntime: PartyStatusRuntime
  partyAutoDamageRemainingMs: number
  partyPressureNoGainMs: number
  partyPressureLastValue: number
  damageTakenResourceWindowRemainingMs: number
  damageTakenResourceGainedInWindow: number
  damageSources: DamageSourceRuntime[]
  commandQueue: EncounterCommand[]
  eventQueue: EncounterEvent[]
  combatLog: CombatLogEvent[]
  lastRejectedCommandMessage: string | null
  lastProcessedEvents: EncounterEvent[]
  pauseOverlay: null | 'pause'
}
```

Use this factory entry before the current enemy setup:

```ts
export function createInitialEncounterState(
  stage: StageInfo,
  classId: PlayerClassId,
  buildState: PersistedBuildState,
): EncounterState {
  const classRuntimeDefinition = getPlayerClassRuntimeDefinition(classId)
  assertBuildMatchesClass(classId, buildState)
  const template = createEncounterTemplate(stage)
}
```

Replace the existing `player` object in `baseState` with:

```ts
player: {
  classId,
  hp: template.playerHp,
  maxHp: template.playerMaxHp,
  resource: Math.min(template.playerResource, classRuntimeDefinition.primaryResource.maxResource),
  maxResource: classRuntimeDefinition.primaryResource.maxResource,
  gcdRemainingMs: template.playerGcdRemainingMs,
  currentTargetId,
  mitigation: {
    id: 'shieldWall',
    label: '盾墙',
    shortLabel: '盾',
    remainingMs: 2_100,
    totalMs: 2_100,
    tone: 'buff',
    kind: 'neutral',
  },
  buffs: template.playerBuffs.map(cloneStatus),
  debuffs: template.playerDebuffs.length > 0
    ? template.playerDebuffs.map(cloneStatus)
    : [{ ...STABLE_STATUS }],
},
```

Add this first property to the current `runtime` object:

```ts
classRuntime: classRuntimeDefinition.initializeRuntime(),
```

Keep the existing final application signature, which remains compatible with the current factory:

```ts
return applyStageSpecialRules(
  applyBuildConfiguration(baseState, buildState.loadout, buildState.passiveTalentIds),
  0,
  {
    onlyRuleLogicIds: INITIAL_ENCOUNTER_STAGE_RULE_LOGIC_IDS,
    runTickHandlers: false,
  },
)
```

Pass `state.player.classId` to both resource gain functions inside `encounterFactory.ts`.

- [ ] **Step 5: Update `EncounterScreen` and every factory caller**

Add `classId: PlayerClassId` to `EncounterScreenProps`, initialize with:

```ts
const [encounter, setEncounter] = useState<EncounterState>(() =>
  createInitialEncounterState(stage, classId, buildState),
)
```

Pass `classId` to every skill/talent legality query in the screen. Update all existing tests and helpers with `WARRIOR_T_CLASS_ID` as the explicit second factory argument.

- [ ] **Step 6: Verify no implicit encounter creation remains**

Run:

```powershell
rg -n "createInitialEncounterState\([^,]+,[^,\)]+\)" src scripts
npm test -- src/game/encounter/encounterFactory.test.ts src/game/encounter/combatLog.test.ts src/game/encounter/combatTelemetry.integration.test.ts src/ui/EncounterScreen.test.ts
npm run build
```

Expected: no two-argument factory calls; tests and build PASS.

- [ ] **Step 7: Commit explicit encounter class identity**

```powershell
git add src/game/encounter src/ui/EncounterScreen.tsx src/ui/EncounterScreen.test.ts src/game/balance src/app scripts
git commit -m "refactor: thread class identity through encounters"
```

### Task 5: Add Trial Policy, Victory Progression, And Stage Availability

**Files:**
- Create: `src/game/progression/classTrialPolicy.ts`
- Create: `src/game/progression/classTrialPolicy.test.ts`
- Create: `src/game/progression/classProgression.ts`
- Create: `src/game/progression/classProgression.test.ts`
- Create: `src/game/progression/stageClassAvailability.ts`
- Create: `src/game/progression/stageClassAvailability.test.ts`

- [ ] **Step 1: Write failing tests for fixed three-stage groups and milestones**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyStageWorkbookOverrides } from '../data/stageTemplates'
import { parseStageWorkbook } from '../data/workbookLoader'
import {
  getChallengeGroupForStage,
  getClassTrialPolicy,
  isChallengeStageOpen,
} from './classTrialPolicy'

describe('classTrialPolicy', () => {
  beforeAll(() => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
  })

  afterAll(() => {
    applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
  })

  it('maps bear and blood DK to fixed three-challenge groups', () => {
    expect(getClassTrialPolicy('druid_bear_t')).toMatchObject({
      challengeIds: ['Challenge-1', 'Challenge-2', 'Challenge-3'],
      requiredCampaignStageId: 'RingingDeeps-6',
    })
    expect(getClassTrialPolicy('dk_blood_t')).toMatchObject({
      challengeIds: ['Challenge-4', 'Challenge-5', 'Challenge-6'],
      requiredCampaignStageId: 'WestFall-6',
    })
    expect(getChallengeGroupForStage('Challenge-7')).toMatchObject({
      challengeIds: ['Challenge-7', 'Challenge-8', 'Challenge-9'],
      requiredCampaignStageId: "Zul'Aman-6",
      trialClassId: undefined,
    })
  })

  it('opens each group only after its campaign milestone is cleared', () => {
    expect(isChallengeStageOpen('Challenge-1', 4)).toBe(false)
    expect(isChallengeStageOpen('Challenge-1', 5)).toBe(true)
    expect(isChallengeStageOpen('Challenge-4', 10)).toBe(false)
    expect(isChallengeStageOpen('Challenge-4', 11)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the policy test and verify missing-module failure**

Run: `npm test -- src/game/progression/classTrialPolicy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement challenge-group and class-trial policy**

Create `classTrialPolicy.ts`:

```ts
import { campaignStageOrder, type StageId } from '../data/stageTemplates'
import type { PlayerClassId } from '../encounter/encounterTypes'

export interface ChallengeGroupPolicy {
  challengeIds: readonly [StageId, StageId, StageId]
  requiredCampaignStageId: StageId
  trialClassId?: PlayerClassId
}

export interface ClassTrialPolicy extends ChallengeGroupPolicy {
  trialClassId: PlayerClassId
}

export const CHALLENGE_GROUP_POLICIES: readonly ChallengeGroupPolicy[] = [
  {
    challengeIds: ['Challenge-1', 'Challenge-2', 'Challenge-3'],
    requiredCampaignStageId: 'RingingDeeps-6',
    trialClassId: 'druid_bear_t',
  },
  {
    challengeIds: ['Challenge-4', 'Challenge-5', 'Challenge-6'],
    requiredCampaignStageId: 'WestFall-6',
    trialClassId: 'dk_blood_t',
  },
  {
    challengeIds: ['Challenge-7', 'Challenge-8', 'Challenge-9'],
    requiredCampaignStageId: "Zul'Aman-6",
  },
] as const

function validateChallengeGroups() {
  const seen = new Set<StageId>()
  for (const group of CHALLENGE_GROUP_POLICIES) {
    if (new Set(group.challengeIds).size !== 3) {
      throw new Error(`Challenge group must contain three distinct stages: ${group.challengeIds.join(',')}`)
    }
    for (const stageId of group.challengeIds) {
      if (seen.has(stageId)) throw new Error(`Challenge stage appears in multiple groups: ${stageId}`)
      seen.add(stageId)
    }
  }
}

validateChallengeGroups()

export function getChallengeGroupForStage(stageId: StageId) {
  return CHALLENGE_GROUP_POLICIES.find((group) => group.challengeIds.includes(stageId))
}

export function getClassTrialPolicy(classId: PlayerClassId): ClassTrialPolicy | undefined {
  return CHALLENGE_GROUP_POLICIES.find(
    (group): group is ClassTrialPolicy => group.trialClassId === classId,
  )
}

export function isChallengeStageOpen(stageId: StageId, highestClearedCampaignStageIndex: number) {
  const group = getChallengeGroupForStage(stageId)
  if (!group) return false
  const milestoneIndex = campaignStageOrder.indexOf(group.requiredCampaignStageId)
  if (milestoneIndex < 0) {
    throw new Error(`Challenge milestone is not in campaign order: ${group.requiredCampaignStageId}`)
  }
  return highestClearedCampaignStageIndex >= milestoneIndex
}
```

- [ ] **Step 4: Write failing progression tests for 2/3, 3/3, wrong class, and idempotency**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyClassProgression, recordStageVictory } from './classProgression'

describe('classProgression', () => {
  it('permanently unlocks a class only after that class wins all three trial stages', () => {
    let progress = createEmptyClassProgression()
    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-1', classId: 'druid_bear_t' })
    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-2', classId: 'druid_bear_t' })
    expect(progress.campaignUnlockedClassIds).toEqual(['warrior_t'])

    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-3', classId: 'warrior_t' })
    expect(progress.campaignUnlockedClassIds).toEqual(['warrior_t'])

    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-3', classId: 'druid_bear_t' })
    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-3', classId: 'druid_bear_t' })
    expect(progress.campaignUnlockedClassIds).toEqual(['warrior_t', 'druid_bear_t'])
    expect(progress.challengeVictoriesByClass.druid_bear_t).toEqual([
      'Challenge-1',
      'Challenge-2',
      'Challenge-3',
    ])
  })
})
```

- [ ] **Step 5: Implement idempotent per-class progress**

Create `classProgression.ts`:

```ts
import type { StageId } from '../data/stageTemplates'
import type { PlayerClassId } from '../encounter/encounterTypes'
import { WARRIOR_T_CLASS_ID } from '../playerClasses/playerClassRuntimeRegistry'
import { CHALLENGE_GROUP_POLICIES, getClassTrialPolicy } from './classTrialPolicy'

export type StageVictoriesByClass = Record<PlayerClassId, StageId[]>

export interface ClassProgressionState {
  challengeVictoriesByClass: StageVictoriesByClass
  campaignVictoriesByClass: StageVictoriesByClass
  campaignUnlockedClassIds: PlayerClassId[]
}

export interface StageVictory {
  mode: 'campaign' | 'challenge'
  stageId: StageId
  classId: PlayerClassId
}

function appendUnique<T>(values: readonly T[], value: T) {
  return values.includes(value) ? [...values] : [...values, value]
}

export function createEmptyClassProgression(): ClassProgressionState {
  return {
    challengeVictoriesByClass: {},
    campaignVictoriesByClass: {},
    campaignUnlockedClassIds: [WARRIOR_T_CLASS_ID],
  }
}

export function deriveCampaignUnlockedClassIds(
  challengeVictoriesByClass: StageVictoriesByClass,
  savedClassIds: readonly PlayerClassId[] = [],
) {
  const unlocked = new Set<PlayerClassId>([WARRIOR_T_CLASS_ID, ...savedClassIds])
  for (const group of CHALLENGE_GROUP_POLICIES) {
    if (!group.trialClassId) continue
    const victories = new Set(challengeVictoriesByClass[group.trialClassId] ?? [])
    if (group.challengeIds.every((stageId) => victories.has(stageId))) {
      unlocked.add(group.trialClassId)
    }
  }
  return [...unlocked]
}

export function recordStageVictory(
  current: ClassProgressionState,
  victory: StageVictory,
): ClassProgressionState {
  const target = victory.mode === 'challenge'
    ? current.challengeVictoriesByClass
    : current.campaignVictoriesByClass
  const nextTarget = {
    ...target,
    [victory.classId]: appendUnique(target[victory.classId] ?? [], victory.stageId),
  }
  const challengeVictoriesByClass = victory.mode === 'challenge'
    ? nextTarget
    : current.challengeVictoriesByClass

  return {
    challengeVictoriesByClass,
    campaignVictoriesByClass: victory.mode === 'campaign' ? nextTarget : current.campaignVictoriesByClass,
    campaignUnlockedClassIds: deriveCampaignUnlockedClassIds(
      challengeVictoriesByClass,
      current.campaignUnlockedClassIds,
    ),
  }
}

export function hasClassVictory(
  victoriesByClass: StageVictoriesByClass,
  classId: PlayerClassId,
  stageId: StageId,
) {
  return victoriesByClass[classId]?.includes(stageId) ?? false
}

export function getClassTrialProgress(
  victoriesByClass: StageVictoriesByClass,
  classId: PlayerClassId,
) {
  const policy = getClassTrialPolicy(classId)
  if (!policy) return { completed: 0, required: 0 }
  const victories = new Set(victoriesByClass[classId] ?? [])
  return {
    completed: policy.challengeIds.filter((stageId) => victories.has(stageId)).length,
    required: policy.challengeIds.length,
  }
}
```

- [ ] **Step 6: Write and implement stage availability tests**

Load `stage_content.xlsx` in this test file with the same `beforeAll`/`afterAll` setup used by `classTrialPolicy.test.ts`, then use this complete case:

```ts
it('enforces chapter one, cumulative trials, runtime/data readiness, and content caps', () => {
  const futureClassIds = ['warrior_t', 'druid_bear_t', 'dk_blood_t']
  const baseStage = getStageById('RingingDeeps-1')
  const challenge1WithBearContent = {
    ...baseStage,
    id: 'Challenge-1',
    allowedClassIds: ['warrior_t', 'druid_bear_t'],
  }
  const challenge4WithAllContent = {
    ...baseStage,
    id: 'Challenge-4',
    allowedClassIds: futureClassIds,
  }
  const challenge4WithWarriorOnlyContent = {
    ...challenge4WithAllContent,
    allowedClassIds: ['warrior_t'],
  }
  const afterRingingDeeps = {
    ...createEmptyClassProgression(),
    highestClearedCampaignStageIndex: 5,
    registeredClassIds: futureClassIds,
    enabledClassIds: futureClassIds,
  }
  const bearPermanentlyUnlocked = {
    ...afterRingingDeeps,
    highestClearedCampaignStageIndex: 11,
    campaignUnlockedClassIds: ['warrior_t', 'druid_bear_t'],
  }

  expect(getAvailableClassIdsForStage(getStageById('RingingDeeps-1'), afterRingingDeeps)).toEqual(['warrior_t'])
  expect(getAvailableClassIdsForStage(challenge1WithBearContent, afterRingingDeeps)).toEqual([
    'warrior_t', 'druid_bear_t',
  ])
  expect(getAvailableClassIdsForStage(challenge4WithAllContent, bearPermanentlyUnlocked)).toEqual([
    'warrior_t', 'druid_bear_t', 'dk_blood_t',
  ])
  expect(getAvailableClassIdsForStage(challenge4WithWarriorOnlyContent, bearPermanentlyUnlocked)).toEqual([
    'warrior_t',
  ])
})
```

Create `stageClassAvailability.ts` with one service entry:

```ts
import { campaignStageOrder, type StageId, type StageInfo } from '../data/stageTemplates'
import { getPlayerClassCatalog } from '../data/playerBuildCatalog'
import type { PlayerClassId } from '../encounter/encounterTypes'
import {
  WARRIOR_T_CLASS_ID,
  getPlayerClassRuntimeDefinitions,
} from '../playerClasses/playerClassRuntimeRegistry'
import type { ClassProgressionState } from './classProgression'
import { getChallengeGroupForStage, isChallengeStageOpen } from './classTrialPolicy'

export interface StageClassAvailabilityInput extends ClassProgressionState {
  highestClearedCampaignStageIndex: number
  registeredClassIds?: readonly PlayerClassId[]
  enabledClassIds?: readonly PlayerClassId[]
}

const FIRST_CHAPTER_END_INDEX = campaignStageOrder.indexOf('RingingDeeps-6')

export function getAvailableClassIdsForStage(
  stage: StageInfo,
  input: StageClassAvailabilityInput,
) {
  const registered = new Set(
    input.registeredClassIds ?? getPlayerClassRuntimeDefinitions().map((entry) => entry.classId),
  )
  const enabled = new Set(
    input.enabledClassIds ?? getPlayerClassCatalog().map((entry) => entry.classId),
  )
  const contentCap = stage.allowedClassIds?.length
    ? new Set(stage.allowedClassIds)
    : null
  const eligible = new Set<PlayerClassId>([WARRIOR_T_CLASS_ID])
  const campaignIndex = campaignStageOrder.indexOf(stage.id)

  if (campaignIndex >= 0) {
    if (campaignIndex > FIRST_CHAPTER_END_INDEX) {
      for (const classId of input.campaignUnlockedClassIds) eligible.add(classId)
    }
  } else if (stage.id.startsWith('Challenge-') && isChallengeStageOpen(stage.id, input.highestClearedCampaignStageIndex)) {
    for (const classId of input.campaignUnlockedClassIds) eligible.add(classId)
    const group = getChallengeGroupForStage(stage.id)
    if (group?.trialClassId) eligible.add(group.trialClassId)
  } else {
    return []
  }

  const eligibleOrder = new Map([...eligible].map((classId, index) => [classId, index]))
  const runtimeOrder = new Map(
    getPlayerClassRuntimeDefinitions().map((entry) => [entry.classId, entry.selectionOrder]),
  )
  return [...eligible]
    .filter((classId) => registered.has(classId) && enabled.has(classId) && (!contentCap || contentCap.has(classId)))
    .sort((left, right) => {
      return (runtimeOrder.get(left) ?? 1000 + (eligibleOrder.get(left) ?? 0))
        - (runtimeOrder.get(right) ?? 1000 + (eligibleOrder.get(right) ?? 0))
        || left.localeCompare(right)
    })
}

export function resolveStageClassId(
  preferredClassId: PlayerClassId,
  availableClassIds: readonly PlayerClassId[],
) {
  if (availableClassIds.includes(preferredClassId)) return preferredClassId
  if (availableClassIds.includes(WARRIOR_T_CLASS_ID)) return WARRIOR_T_CLASS_ID
  return availableClassIds[0] ?? null
}
```

In tests, pass both `registeredClassIds` and `enabledClassIds` explicitly to model future complete classes without adding unfinished runtimes or enabling reserved designer rows in production.

- [ ] **Step 7: Run all progression tests**

Run:

```powershell
npm test -- src/game/progression/classTrialPolicy.test.ts src/game/progression/classProgression.test.ts src/game/progression/stageClassAvailability.test.ts
```

Expected: PASS with coverage for milestones, reserved 7-9 group, 2/3, 3/3, wrong class, duplicate victory, chapter one, cumulative access, and content cap.

- [ ] **Step 8: Commit progression services**

```powershell
git add src/game/progression
git commit -m "feat: add class trial and stage availability policies"
```

### Task 6: Upgrade Saves To Class-Scoped Schema V2

**Files:**
- Modify: `src/app/saveGame.ts`
- Modify: `src/app/saveGame.test.ts`

- [ ] **Step 1: Replace round-trip tests with v2 shape and add v1 migration tests**

Use this v2 assertion shape:

```ts
expect(loadSaveGame(storage, 'package-a')).toMatchObject({
  selectedClassId: 'warrior_t',
  buildsByClassId: { warrior_t: build },
  challengeVictoriesByClass: { druid_bear_t: ['Challenge-1'] },
  campaignVictoriesByClass: { warrior_t: ['RingingDeeps-1'] },
  campaignUnlockedClassIds: ['warrior_t'],
})
```

Write a legacy payload to `getSaveStorageKey('legacy', '1')` and assert:

```ts
expect(loadSaveGame(storage, 'legacy')).toMatchObject({
  selectedClassId: 'warrior_t',
  buildsByClassId: { warrior_t: legacyBuild },
  challengeVictoriesByClass: {},
  campaignVictoriesByClass: {},
  campaignUnlockedClassIds: ['warrior_t'],
})
```

Add a test where saved bear victories already contain Challenge-1/2/3 but `campaignUnlockedClassIds` omits bear; load must union and return `['warrior_t', 'druid_bear_t']`. Load the same result twice and assert equality.

- [ ] **Step 2: Run save tests and verify v2 fields are missing**

Run: `npm test -- src/app/saveGame.test.ts`

Expected: FAIL because schema 1 still stores a single `build`.

- [ ] **Step 3: Define v2 save and class-scoped tutorial state**

```ts
export interface TutorialSaveState {
  seenStageSelectStageIds: StageId[]
  seenEncounterStageIds: StageId[]
  seenMonsterCodexTutorial: boolean
  autoEquippedStageIdsByClass: Record<PlayerClassId, StageId[]>
  manualBuildConfiguredStageIdsByClass: Record<PlayerClassId, StageId[]>
}

export interface SaveGameState extends ClassProgressionState {
  highestClearedStageIndex: number
  stageId: StageId
  selectedClassId: PlayerClassId
  buildsByClassId: Record<PlayerClassId, PersistedBuildState>
  seenEnemyDefinitionIds: string[]
  tutorial: TutorialSaveState
}

const SAVE_SCHEMA_VERSION = '2'
const LEGACY_SAVE_SCHEMA_VERSION = '1'

export function getSaveStorageKey(namespace = getGlobalSaveNamespace(), version = SAVE_SCHEMA_VERSION) {
  return `littleTank.save.${version}.${namespace}`
}
```

Update the empty tutorial factory and retain a private legacy shape for migration:

```ts
interface LegacyTutorialSaveState {
  seenStageSelectStageIds: StageId[]
  seenEncounterStageIds: StageId[]
  seenMonsterCodexTutorial: boolean
  autoEquippedStageIds: StageId[]
  manualBuildConfiguredStageIds: StageId[]
}

export function createEmptyTutorialSaveState(): TutorialSaveState {
  return {
    seenStageSelectStageIds: [],
    seenEncounterStageIds: [],
    seenMonsterCodexTutorial: false,
    autoEquippedStageIdsByClass: {},
    manualBuildConfiguredStageIdsByClass: {},
  }
}

function normalizeLegacyTutorialSaveState(value: unknown): LegacyTutorialSaveState {
  const tutorial = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
  return {
    seenStageSelectStageIds: normalizeStageIdList(tutorial.seenStageSelectStageIds),
    seenEncounterStageIds: normalizeStageIdList(tutorial.seenEncounterStageIds),
    seenMonsterCodexTutorial: tutorial.seenMonsterCodexTutorial === true,
    autoEquippedStageIds: normalizeStageIdList(tutorial.autoEquippedStageIds),
    manualBuildConfiguredStageIds: normalizeStageIdList(tutorial.manualBuildConfiguredStageIds),
  }
}
```

- [ ] **Step 4: Implement normalization and v1 migration**

The loader must read v2 first, then v1, and normalize through one function:

```ts
function migrateLegacySave(parsed: Record<string, unknown>): SaveGameState | null {
  if (
    typeof parsed.highestClearedStageIndex !== 'number' ||
    typeof parsed.stageId !== 'string' ||
    !parsed.build ||
    typeof parsed.build !== 'object'
  ) return null

  const legacyTutorial = normalizeLegacyTutorialSaveState(parsed.tutorial)
  return {
    highestClearedStageIndex: parsed.highestClearedStageIndex,
    stageId: parsed.stageId,
    selectedClassId: WARRIOR_T_CLASS_ID,
    buildsByClassId: { warrior_t: parsed.build as PersistedBuildState },
    challengeVictoriesByClass: {},
    campaignVictoriesByClass: {},
    campaignUnlockedClassIds: [WARRIOR_T_CLASS_ID],
    seenEnemyDefinitionIds: normalizeStringList(parsed.seenEnemyDefinitionIds),
    tutorial: {
      seenStageSelectStageIds: legacyTutorial.seenStageSelectStageIds,
      seenEncounterStageIds: legacyTutorial.seenEncounterStageIds,
      seenMonsterCodexTutorial: legacyTutorial.seenMonsterCodexTutorial,
      autoEquippedStageIdsByClass: { warrior_t: legacyTutorial.autoEquippedStageIds },
      manualBuildConfiguredStageIdsByClass: { warrior_t: legacyTutorial.manualBuildConfiguredStageIds },
    },
  }
}

export function loadSaveGame(storage: Storage = globalThis.localStorage, namespace = getGlobalSaveNamespace()) {
  if (!storage) return null
  const currentRaw = storage.getItem(getSaveStorageKey(namespace))
  const legacyRaw = storage.getItem(getSaveStorageKey(namespace, LEGACY_SAVE_SCHEMA_VERSION))
  const raw = currentRaw ?? legacyRaw
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized = currentRaw ? normalizeV2Save(parsed) : migrateLegacySave(parsed)
    if (!normalized) return null
    return {
      ...normalized,
      campaignUnlockedClassIds: deriveCampaignUnlockedClassIds(
        normalized.challengeVictoriesByClass,
        normalized.campaignUnlockedClassIds,
      ),
    }
  } catch {
    return null
  }
}
```

Implement the v2 helpers explicitly:

```ts
function isPersistedBuildState(value: unknown): value is PersistedBuildState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PersistedBuildState>
  return Boolean(
    candidate.loadout &&
    typeof candidate.loadout === 'object' &&
    Array.isArray(candidate.passiveTalentIds),
  )
}

function normalizeBuildsByClass(value: unknown): Record<PlayerClassId, PersistedBuildState> {
  if (!value || typeof value !== 'object') return {}
  const builds: Record<PlayerClassId, PersistedBuildState> = {}
  for (const [classId, build] of Object.entries(value)) {
    if (classId.trim().length > 0 && isPersistedBuildState(build)) {
      builds[classId] = {
        loadout: { ...build.loadout },
        passiveTalentIds: normalizeStringList(build.passiveTalentIds),
      }
    }
  }
  return builds
}

function normalizeStageVictoriesByClass(value: unknown): StageVictoriesByClass {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([classId]) => classId.trim().length > 0)
      .map(([classId, stageIds]) => [classId, normalizeStageIdList(stageIds)]),
  )
}

function normalizeStageIdsByClass(value: unknown): Record<PlayerClassId, StageId[]> {
  return normalizeStageVictoriesByClass(value)
}

function normalizeV2TutorialSaveState(value: unknown): TutorialSaveState {
  if (!value || typeof value !== 'object') return createEmptyTutorialSaveState()
  const tutorial = value as Record<string, unknown>
  return {
    seenStageSelectStageIds: normalizeStageIdList(tutorial.seenStageSelectStageIds),
    seenEncounterStageIds: normalizeStageIdList(tutorial.seenEncounterStageIds),
    seenMonsterCodexTutorial: tutorial.seenMonsterCodexTutorial === true,
    autoEquippedStageIdsByClass: normalizeStageIdsByClass(tutorial.autoEquippedStageIdsByClass),
    manualBuildConfiguredStageIdsByClass: normalizeStageIdsByClass(tutorial.manualBuildConfiguredStageIdsByClass),
  }
}

function normalizeV2Save(parsed: Record<string, unknown>): SaveGameState | null {
  if (
    typeof parsed.highestClearedStageIndex !== 'number' ||
    typeof parsed.stageId !== 'string'
  ) return null

  const buildsByClassId = normalizeBuildsByClass(parsed.buildsByClassId)
  if (Object.keys(buildsByClassId).length === 0) return null
  const challengeVictoriesByClass = normalizeStageVictoriesByClass(parsed.challengeVictoriesByClass)
  const campaignUnlockedClassIds = deriveCampaignUnlockedClassIds(
    challengeVictoriesByClass,
    normalizeStringList(parsed.campaignUnlockedClassIds),
  )

  return {
    highestClearedStageIndex: parsed.highestClearedStageIndex,
    stageId: parsed.stageId,
    selectedClassId: typeof parsed.selectedClassId === 'string' && parsed.selectedClassId.trim()
      ? parsed.selectedClassId
      : WARRIOR_T_CLASS_ID,
    buildsByClassId,
    challengeVictoriesByClass,
    campaignVictoriesByClass: normalizeStageVictoriesByClass(parsed.campaignVictoriesByClass),
    campaignUnlockedClassIds,
    seenEnemyDefinitionIds: normalizeStringList(parsed.seenEnemyDefinitionIds),
    tutorial: normalizeV2TutorialSaveState(parsed.tutorial),
  }
}
```

`normalizeStageIdList` must deduplicate as well as filter strings; use the same `Set` pattern already used by `normalizeStringList`. Do not remove the v1 key while loading; migration is read-only until the next normal save writes v2.

Update `shouldAutoEquipNewSkillsForStage` to accept `classId` and query the two per-class tutorial maps.

- [ ] **Step 5: Run save tests**

Run: `npm test -- src/app/saveGame.test.ts`

Expected: PASS for v2 round trip, v1 migration, repeated load, unioned eligibility, namespace isolation, and per-class auto-equip state.

- [ ] **Step 6: Commit save schema v2**

```powershell
git add src/app/saveGame.ts src/app/saveGame.test.ts
git commit -m "feat: migrate saves to class scoped schema v2"
```

### Task 7: Build The Fixed 12-Slot Class Entry Control

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/ui/StageClassEntryControl.tsx`
- Create: `src/ui/StageClassEntryControl.test.tsx`
- Modify: `src/styles/encounter.css`

- [ ] **Step 1: Install the icon component dependency**

Run: `npm install lucide-react`

Expected: `package.json` and `package-lock.json` add `lucide-react`; no public assets are generated.

- [ ] **Step 2: Write the failing DOM interaction test**

```tsx
import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { StageClassEntryControl } from './StageClassEntryControl'

it('reserves 12 vertical-first slots and selects or enters with the chosen class', async () => {
  const dom = new JSDOM('<div id="root"></div>')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  const onSelectClass = vi.fn()
  const onEnter = vi.fn()
  const root = createRoot(dom.window.document.getElementById('root')!)

  await act(async () => root.render(createElement(StageClassEntryControl, {
    classes: [
      { classId: 'warrior_t', className: '战士T', buttonIconKey: 'sword', cleared: true },
      { classId: 'druid_bear_t', className: '熊T', buttonIconKey: 'paw-print', cleared: false },
      { classId: 'dk_blood_t', className: '死亡骑士T', buttonIconKey: 'droplets', cleared: false },
      { classId: 'fourth_t', className: '第四职业', buttonIconKey: 'shield', cleared: false },
    ],
    selectedClassId: 'warrior_t',
    disabled: false,
    onSelectClass,
    onEnter,
  })))

  const slots = [...dom.window.document.querySelectorAll('.stage-class-entry__slot')]
  expect(slots).toHaveLength(12)
  expect(slots.slice(0, 4).map((slot) => slot.getAttribute('data-class-id'))).toEqual([
    'warrior_t', 'druid_bear_t', 'dk_blood_t', 'fourth_t',
  ])
  expect(dom.window.document.querySelector('[data-class-id="warrior_t"] .stage-class-entry__check')).not.toBeNull()
  expect(dom.window.document.querySelector('.stage-class-entry__enter')?.textContent).toBe('战士T 进入这一关')

  await act(async () => {
    dom.window.document.querySelector<HTMLElement>('[data-class-id="druid_bear_t"]')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  expect(onSelectClass).toHaveBeenCalledWith('druid_bear_t')

  await act(async () => {
    dom.window.document.querySelector<HTMLElement>('.stage-class-entry__enter')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })
  expect(onEnter).toHaveBeenCalledOnce()
  root.unmount()
  dom.window.close()
})
```

- [ ] **Step 3: Run the component test and verify missing-module failure**

Run: `npm test -- src/ui/StageClassEntryControl.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement the component**

```tsx
import { Check, Droplets, PawPrint, Shield, Sword, type LucideIcon } from 'lucide-react'
import type { PlayerClassId } from '../game/encounter/encounterTypes'
import type { PlayerClassRuntimeDefinition } from '../game/playerClasses/playerClassRuntimeRegistry'

export interface StageClassEntryOption {
  classId: PlayerClassId
  className: string
  buttonIconKey: PlayerClassRuntimeDefinition['buttonIconKey']
  cleared: boolean
}

interface StageClassEntryControlProps {
  classes: readonly StageClassEntryOption[]
  selectedClassId: PlayerClassId
  disabled: boolean
  onSelectClass: (classId: PlayerClassId) => void
  onEnter: () => void
}

const ICONS: Record<PlayerClassRuntimeDefinition['buttonIconKey'], LucideIcon> = {
  sword: Sword,
  'paw-print': PawPrint,
  droplets: Droplets,
  shield: Shield,
}

const SLOT_COUNT = 12

export function StageClassEntryControl({
  classes,
  selectedClassId,
  disabled,
  onSelectClass,
  onEnter,
}: StageClassEntryControlProps) {
  const selected = classes.find((entry) => entry.classId === selectedClassId) ?? classes[0]

  return (
    <div className="stage-class-entry">
      <button
        type="button"
        className="stage-class-entry__enter stage-map__enter-action"
        disabled={disabled || !selected}
        onClick={onEnter}
      >
        {disabled ? '尚未解锁' : `${selected?.className ?? ''} 进入这一关`}
      </button>
      <div className="stage-class-entry__grid" aria-label="选择本关职业">
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const option = classes[index]
          if (!option) {
            return <span key={`empty-${index}`} className="stage-class-entry__slot is-empty" aria-hidden="true" />
          }
          const Icon = ICONS[option.buttonIconKey]
          return (
            <button
              key={option.classId}
              type="button"
              className={[
                'stage-class-entry__slot',
                option.classId === selectedClassId ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              data-class-id={option.classId}
              title={option.className}
              aria-label={`选择${option.className}`}
              aria-pressed={option.classId === selectedClassId}
              onClick={() => onSelectClass(option.classId)}
            >
              <Icon aria-hidden="true" />
              {option.cleared ? <Check className="stage-class-entry__check" aria-label="已使用该职业通关" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add fixed layout and state CSS**

```css
.stage-class-entry {
  position: absolute;
  left: 50%;
  bottom: 5.6%;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 18px;
  transform: translateX(-120px);
}

.stage-class-entry .stage-map__enter-action {
  position: static;
  width: 240px;
  min-width: 240px;
  height: 82px;
  min-height: 82px;
  padding: 0 18px;
  transform: none;
}

.stage-class-entry__grid {
  display: grid;
  grid-template-rows: repeat(3, 50px);
  grid-template-columns: repeat(4, 50px);
  grid-auto-flow: column;
  gap: 7px;
  width: 221px;
  height: 164px;
}

.stage-class-entry__slot {
  position: relative;
  width: 50px;
  height: 50px;
}

button.stage-class-entry__slot {
  display: grid;
  place-items: center;
  border: 2px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  background: #1f5f76;
  color: #f7f1df;
  cursor: pointer;
}

button.stage-class-entry__slot > svg:first-child {
  width: 34px;
  height: 34px;
}

button.stage-class-entry__slot.is-selected {
  border-color: #ffd54f;
  box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.26);
}

.stage-class-entry__check {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 22px;
  height: 22px;
  padding: 2px;
  border-radius: 50%;
  background: #137a43;
  color: #f4fff7;
  stroke-width: 4;
}

.stage-class-entry__slot.is-empty {
  visibility: hidden;
}

@media (max-width: 680px) {
  .stage-map,
  .challenge-board {
    min-height: 780px;
    padding-bottom: 280px;
  }

  .stage-class-entry {
    left: 50%;
    bottom: 12px;
    flex-direction: column-reverse;
    gap: 8px;
    transform: translateX(-50%);
  }
}
```

Remove absolute positioning from the old hover transform rules when `.stage-map__enter-action` is nested in `.stage-class-entry`; add explicit nested hover/disabled selectors so the wrapper never shifts.

- [ ] **Step 6: Run component and stylesheet regression tests**

Run:

```powershell
npm test -- src/ui/StageClassEntryControl.test.tsx src/ui/StageSelectScreen.test.ts
npm run build
```

Expected: PASS; component renders 12 slots and build accepts Lucide imports.

- [ ] **Step 7: Commit the reusable class entry control**

```powershell
git add package.json package-lock.json src/ui/StageClassEntryControl.tsx src/ui/StageClassEntryControl.test.tsx src/styles/encounter.css
git commit -m "feat: add fixed stage class entry control"
```

### Task 8: Integrate Class Selection, Victories, And Builds In Stage Select And App

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/ui/StageSelectScreen.tsx`
- Modify: `src/ui/StageSelectScreen.test.ts`
- Modify: `src/ui/EncounterScreen.tsx`
- Modify: `src/app/saveGame.test.ts`

- [ ] **Step 1: Add failing stage-select integration tests**

Extend the existing JSDOM setup with these behaviors:

```ts
expect(container.querySelectorAll('.stage-class-entry__slot')).toHaveLength(12)
expect(container.querySelectorAll('button.stage-class-entry__slot')).toHaveLength(1)
expect(container.querySelector('.stage-class-entry__enter')?.textContent).toBe('战士T 进入这一关')
```

For the two-class integration case, use `vi.spyOn(playerClassRuntimeRegistry, 'getPlayerClassRuntimeDefinitions')` to return warrior and bear runtime metadata, enable a minimal bear class/default build through `applyPlayerBuildWorkbookOverrides`, and override Challenge-1 with `allowedClassIds: ['warrior_t', 'druid_bear_t']`. Restore the spy and player-build catalog in `afterEach`. Assert the buttons appear in vertical-first DOM order, clicking bear calls `onSelectClass('druid_bear_t')`, and entering calls:

```ts
expect(onStartStage).toHaveBeenCalledWith('Challenge-1', 'challenge', 'druid_bear_t')
```

Add campaign assertions: RingingDeeps stages show only warrior; a post-chapter stage shows warrior plus permanently unlocked registered classes; a green check appears only for the selected `(mode, stageId, classId)` victory record.

- [ ] **Step 2: Run stage-select tests and verify old prop contract failure**

Run: `npm test -- src/ui/StageSelectScreen.test.ts`

Expected: FAIL because the screen still receives one build and a two-argument `onStartStage`.

- [ ] **Step 3: Replace the stage-select prop contract**

Use this contract:

```ts
interface StageSelectScreenProps extends ClassProgressionState {
  defaultMode?: StageSelectMode
  defaultSelectedStageId: StageId
  highestClearedStageIndex: number
  maxUnlockedStageIndex: number
  partyStageId: StageId
  selectedClassId: PlayerClassId
  buildsByClassId: Record<PlayerClassId, PersistedBuildState>
  seenEnemyDefinitionIds?: readonly string[]
  monsterCodexTutorialSeen?: boolean
  stageSelectTutorialSeenStageIds?: readonly StageId[]
  tutorialReplayVersion?: number
  onSelectClass: (classId: PlayerClassId) => void
  onStartStage: (stageId: StageId, mode: StageSelectMode, classId: PlayerClassId) => void
  onResetTutorials?: () => void
  onMonsterCodexTutorialComplete?: () => void
  onStageSelectTutorialComplete?: (stageId: StageId) => void
  onBuildChange?: (classId: PlayerClassId, build: PersistedBuildState, stageId: StageId) => void
}
```

For the effective selected stage, calculate once:

```ts
const availableClassIds = getAvailableClassIdsForStage(selectedStage, {
  highestClearedCampaignStageIndex: highestClearedStageIndex,
  challengeVictoriesByClass,
  campaignVictoriesByClass,
  campaignUnlockedClassIds,
})
const effectiveClassId = resolveStageClassId(selectedClassId, availableClassIds)
const selectedBuild = effectiveClassId ? buildsByClassId[effectiveClassId] : undefined
const persistedBuild = effectiveClassId && selectedBuild
  ? selectedBuild
  : effectiveClassId
    ? getDefaultPersistedBuildForRule(selectedBuildRuleId, effectiveClassId)
    : null
```

If `effectiveClassId` is null, disable entry and do not call a default-build lookup. Pass `effectiveClassId` to normalization and all skill/talent legality functions. Call `onBuildChange(effectiveClassId, build, stageId)`.

Build `StageClassEntryOption[]` from the runtime registry plus `getPlayerClassDefinition(classId)`. Use designer class names, runtime icon keys, and `hasClassVictory` against challenge or campaign victory maps. Replace both old campaign and challenge enter buttons with `StageClassEntryControl`; its enter callback must call `onStartStage(effectiveSelectedStageId, stageSelectMode, effectiveClassId)` and never use stale campaign/challenge-local IDs.

Disable challenge cards for which `isChallengeStageOpen` is false. Selecting a locked card must not change `selectedChallengeId`.

- [ ] **Step 4: Convert `App` to class-scoped state**

Initialize state from v2 save:

```ts
const [selectedClassId, setSelectedClassId] = useState<PlayerClassId>(
  loadedSave?.selectedClassId ?? WARRIOR_T_CLASS_ID,
)
const [encounterClassId, setEncounterClassId] = useState<PlayerClassId>(WARRIOR_T_CLASS_ID)
const [buildsByClassId, setBuildsByClassId] = useState<Record<PlayerClassId, PersistedBuildState>>(() =>
  loadedSave?.buildsByClassId ?? {
    warrior_t: getDefaultPersistedBuildForRule(
      getStageBuildRuleId(getStageById(initialStageId)),
      WARRIOR_T_CLASS_ID,
    ),
  },
)
const [classProgression, setClassProgression] = useState<ClassProgressionState>(() => ({
  challengeVictoriesByClass: loadedSave?.challengeVictoriesByClass ?? {},
  campaignVictoriesByClass: loadedSave?.campaignVictoriesByClass ?? {},
  campaignUnlockedClassIds: loadedSave?.campaignUnlockedClassIds ?? [WARRIOR_T_CLASS_ID],
}))
```

Use this stage entry signature:

```ts
function startStage(nextStageId: StageId, mode: StageSelectMode, classId: PlayerClassId) {
  const nextStage = getStageById(nextStageId)
  const availableClassIds = getAvailableClassIdsForStage(nextStage, {
    highestClearedCampaignStageIndex: highestClearedStageIndex,
    ...classProgression,
  })
  if (!availableClassIds.includes(classId)) return

  const buildRuleId = getStageBuildRuleId(nextStage)
  const sourceBuild = buildsByClassId[classId]
    ?? getDefaultPersistedBuildForRule(buildRuleId, classId)
  const normalized = normalizePersistedBuildForRule(
    sourceBuild,
    buildRuleId,
    classId,
    getPassiveTalentUnlockTierForStage(nextStage),
    getUnlockedActiveSkillIdsForStage(nextStage),
    shouldAutoEquipNewSkillsForStage(tutorialState, classId, nextStageId, nextStage.unlockedActiveSkillIds)
      ? nextStage.unlockedActiveSkillIds
      : [],
  )

  setBuildsByClassId((current) => ({ ...current, [classId]: normalized.build }))
  if (shouldAutoEquipNewSkillsForStage(tutorialState, classId, nextStageId, nextStage.unlockedActiveSkillIds)) {
    setTutorialState((current) => ({
      ...current,
      autoEquippedStageIdsByClass: {
        ...current.autoEquippedStageIdsByClass,
        [classId]: appendUniqueStageId(current.autoEquippedStageIdsByClass[classId] ?? [], nextStageId),
      },
    }))
  }
  setEncounterClassId(classId)
  setStageSelectMode(mode)
  setStageId(nextStageId)
  setEncounterInstance((value) => value + 1)
  setScreen('encounter')
}
```

Only `onSelectClass` updates the preferred `selectedClassId`. Temporary fallback from bear to warrior in chapter one must not call it.

On victory, call:

```ts
function settleStageVictory() {
  setClassProgression((current) => recordStageVictory(current, {
    mode: stageSelectMode,
    stageId,
    classId: encounterClassId,
  }))
  if (stageSelectMode === 'campaign') {
    const clearedIndex = campaignStageOrder.indexOf(stageId)
    if (clearedIndex >= 0) {
      setHighestClearedStageIndex((current) => Math.max(current, clearedIndex))
    }
  }
}
```

Call `settleStageVictory()` from both the victory return path and the advance-stage path. Campaign progression index changes only for campaign victories. Challenge victories never advance `highestClearedStageIndex`.

- [ ] **Step 5: Wire encounter and retry/advance behavior**

Pass `classId={encounterClassId}` and `buildState={buildsByClassId[encounterClassId]}` to `EncounterScreen`. Build changes update only that class key and append the edited stage to `tutorial.manualBuildConfiguredStageIdsByClass[encounterClassId]`. Retry uses the same encounter class. Advance resolves the preferred encounter class against the next stage, temporarily falls back to warrior if required, and does not mutate `selectedClassId`.

Every `saveSaveGame` call and the persistence effect must write the complete v2 state. Remove all references to `loadedSave.build`, `persistedBuild`, and the v1 `build` field.

- [ ] **Step 6: Run app/UI/save regressions**

Run:

```powershell
rg -n "persistedBuild|loadedSave\?\.build\b|build:" src/app/App.tsx
npm test -- src/app/saveGame.test.ts src/ui/StageClassEntryControl.test.tsx src/ui/StageSelectScreen.test.ts src/ui/EncounterScreen.test.ts
npm run build
```

Expected: `rg` prints no single-global-build state; all tests and build PASS.

- [ ] **Step 7: Commit stage entry and App integration**

```powershell
git add src/app/App.tsx src/ui/StageSelectScreen.tsx src/ui/StageSelectScreen.test.ts src/ui/EncounterScreen.tsx src/app/saveGame.test.ts
git commit -m "feat: integrate class scoped stage entry progression"
```

### Task 9: Make Build Generation, Simulation, And Learning Analysis Class-Aware

**Files:**
- Modify: `src/game/balance/balanceBuildGenerator.ts`
- Modify: `src/game/balance/balanceBuildGenerator.test.ts`
- Modify: `src/game/balance/balanceSimulator.ts`
- Modify: `src/game/balance/balanceSimulator.test.ts`
- Modify: `src/game/balance/learningBalanceEvaluator.ts`
- Modify: `src/game/balance/learningBalanceEvaluator.test.ts`
- Modify: `src/game/balance/deltaAnalysis.ts`
- Modify: `src/game/balance/deltaAnalysis.test.ts`
- Modify: `src/game/balance/manualPlaytestBuilds.ts`
- Create: `src/game/balance/tankClassBalanceComparison.ts`
- Create: `src/game/balance/tankClassBalanceComparison.test.ts`

- [ ] **Step 1: Add failing generator/simulator class identity tests**

```ts
it('generates only builds owned by the requested class', () => {
  const stage = getStageById('Challenge-1')
  const variants = generateStageBalanceBuilds(stage, 'warrior_t', {
    maxActiveBuilds: 4,
    maxPassiveVariants: 2,
  })

  expect(variants.length).toBeGreaterThan(0)
  expect(variants.every((variant) => variant.classId === 'warrior_t')).toBe(true)
  for (const variant of variants) {
    expect(Object.values(variant.build.loadout).filter(Boolean).every(
      (skillId) => getActiveSkillDefinition(skillId!)?.classId === 'warrior_t',
    )).toBe(true)
    expect(variant.build.passiveTalentIds.every(
      (talentId) => getPassiveTalentDefinition(talentId)?.classId === 'warrior_t',
    )).toBe(true)
  }
})

it('keeps class and build rule on scenario and stage analysis results', () => {
  const stage = getStageById('RingingDeeps-1')
  const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage), 'warrior_t')
  const scenario = runBalanceScenario({
    stage,
    classId: 'warrior_t',
    build,
    buildId: 'default',
    profile: noMistakeProfile,
    attempts: 1,
    maxDurationMs: 1000,
  })

  expect(scenario).toMatchObject({
    stageId: stage.id,
    classId: 'warrior_t',
    buildRuleId: getStageBuildRuleId(stage),
  })
})
```

- [ ] **Step 2: Run focused tests and verify missing parameters**

Run: `npm test -- src/game/balance/balanceBuildGenerator.test.ts src/game/balance/balanceSimulator.test.ts`

Expected: FAIL because generation and simulation currently infer warrior behavior.

- [ ] **Step 3: Change build generation contracts**

Use required class identity throughout:

```ts
export interface BalanceBuildVariant {
  id: string
  classId: PlayerClassId
  build: PersistedBuildState
}

export function generateStageBalanceBuilds(
  stage: StageInfo,
  classId: PlayerClassId,
  options: BalanceBuildGenerationOptions = {},
) {
  const buildRuleId = getStageBuildRuleId(stage)
  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const normalizedDefault = normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule(buildRuleId, classId),
    buildRuleId,
    classId,
    passiveTier,
    unlockedSkillIds,
    stage.unlockedActiveSkillIds,
  ).build
  const results: BalanceBuildVariant[] = [{ id: 'default', classId, build: normalizedDefault }]
}
```

After this initialization, keep the current bounded active/passive loops and make these exact substitutions inside them:

```ts
getOrderedLegalActiveSkillIds(buildRuleId, classId, unlockedSkillIds)
getOrderedLegalPassiveTalentIds(buildRuleId, classId, passiveTier)
normalizePersistedBuildForRule(candidate, buildRuleId, classId, passiveTier, unlockedSkillIds)
results.push({ id: candidateId, classId, build: normalized.build })
```

Return `results` at the current function exit. Apply the same second argument to `generateStrategyTipBuildCandidates(stage, classId, options)`. Update legal-skill and legal-talent helpers to require `classId`; every generated result literal includes `classId`.

- [ ] **Step 4: Change simulation and learning contracts**

Add required fields:

```ts
export interface RunBalanceScenarioOptions {
  stage: StageInfo
  classId: PlayerClassId
  build: PersistedBuildState
  buildId: string
  profile: BalanceOperationProfile
  attempts: number
  maxDurationMs: number
  tickMs?: number
  initialStateMutator?: (state: EncounterState) => EncounterState
  collectTrace?: boolean
  collectDiagnostics?: boolean
}

export interface StageBalanceAnalysis {
  stageId: string
  classId: PlayerClassId
  buildRuleId: string
  scenarios: TraceableBalanceScenarioResult[]
  rating: DifficultyRating
  scoringMode: BalanceScoringMode
  bestBuildsByProfile: BestBuildProfileSummary[]
  analyzedBuilds?: BalanceBuildVariant[]
  buildSearchMode?: 'single_phase' | 'two_phase'
  phaseOneBuildCount?: number
  finalBuildCount?: number
}

export interface RunStageBalanceAnalysisOptions {
  stage: StageInfo
  classId: PlayerClassId
  builds: BalanceBuildVariant[]
  profiles: BalanceOperationProfile[]
  attemptsPerScenario: number
  maxDurationMs: number
  tickMs?: number
  initialStateMutator?: (state: EncounterState) => EncounterState
  collectTrace?: boolean
  collectDiagnostics?: boolean
}
```

At the start of analysis, reject mixed build arrays:

```ts
const invalidBuild = options.builds.find((variant) => variant.classId !== options.classId)
if (invalidBuild) {
  throw new Error(`Balance build ${invalidBuild.id} belongs to ${invalidBuild.classId}, expected ${options.classId}`)
}
```

Seed and initialize each attempt with class identity:

```ts
const random = createSeededRandom(
  `${options.stage.id}:${options.classId}:${options.buildId}:${options.profile.id}:${attemptIndex}`,
)
let state = createInitialEncounterState(options.stage, options.classId, options.build)
```

Return `classId` and `buildRuleId` on scenario and analysis results. Add `classId` to `RunLearningStageBalanceAnalysisOptions` and `LearningStageBalanceAnalysis`; pass it through exploration, fixed analysis, initial enemy count, and generated candidates.

- [ ] **Step 5: Dispatch AI by the runtime strategy ID**

Keep the existing behavior as the warrior handler, but make missing strategy IDs fail explicitly:

```ts
type PlayerClassAiHandler = typeof runAutomatedDecision

const PLAYER_CLASS_AI_HANDLERS: Record<string, PlayerClassAiHandler> = {
  warrior_t_default: runAutomatedDecision,
}

function runPlayerClassAutomatedDecision(
  state: EncounterState,
  profile: BalanceOperationProfile,
  random: () => number,
  memory: BalanceAutomationMemory,
  traceEvents?: BalanceTraceEvent[],
) {
  const strategyId = getPlayerClassRuntimeDefinition(state.player.classId).aiStrategyId
  const handler = PLAYER_CLASS_AI_HANDLERS[strategyId]
  if (!handler) throw new Error(`Player class AI strategy is not registered: ${strategyId}`)
  return handler(state, profile, random, memory, traceEvents)
}
```

Use `runPlayerClassAutomatedDecision` in the scenario loop. Phase 1 adds a bear handler and registry entry together; an unfinished class can never silently use warrior decisions.

- [ ] **Step 6: Thread class identity through delta and manual build helpers**

Change public entries to:

```ts
buildManualPlaytestCandidateForStage(entries, stage, classId)
createDefaultDeltaBuild(stage, classId)
createTalentDeltaBuild(stage, classId, talentId)
```

Manual workbook rows without a class field are interpreted as `warrior_t` for backward compatibility and are excluded for other class IDs. Delta candidates must call class-scoped defaults, legality, and normalization.

- [ ] **Step 7: Add failing cross-class balance-threshold tests**

```ts
import { describe, expect, it } from 'vitest'
import { compareTankClassTrialResults } from './tankClassBalanceComparison'

describe('tankClassBalanceComparison', () => {
  it('flags tool gaps and strength overflow using the approved pass-rate thresholds', () => {
    const comparison = compareTankClassTrialResults({
      classId: 'druid_bear_t',
      stages: [
        { stageId: 'Challenge-1', warriorBestPassRate: 0.20, classBestPassRate: 0.04, warriorDifficulty: 'hard', classDifficulty: 'expert' },
        { stageId: 'Challenge-2', warriorBestPassRate: 0.69, classBestPassRate: 0.85, warriorDifficulty: 'hard', classDifficulty: 'easy' },
        { stageId: 'Challenge-3', warriorBestPassRate: 0.50, classBestPassRate: 0.65, warriorDifficulty: 'balanced', classDifficulty: 'balanced' },
      ],
    })

    expect(comparison.stageResults[0].flags).toContain('tool_gap')
    expect(comparison.stageResults[1].flags).toContain('strength_overflow')
    expect(comparison.stageResults[1].flags).toContain('difficulty_gap_over_one_tier')
    expect(comparison.averagePassRateDifference).toBeCloseTo(0.05)
  })
})
```

- [ ] **Step 8: Implement the approved comparison thresholds**

Create `tankClassBalanceComparison.ts`:

```ts
import type { DifficultyLabel } from './difficultyScoring'
import type { PlayerClassId } from '../encounter/encounterTypes'

const DIFFICULTY_ORDER: DifficultyLabel[] = [
  'trivial', 'easy', 'balanced', 'hard', 'expert', 'near_impossible', 'impossible', 'invalid_data',
]

export interface TankClassTrialStageResult {
  stageId: string
  warriorBestPassRate: number
  classBestPassRate: number
  warriorDifficulty: DifficultyLabel
  classDifficulty: DifficultyLabel
}

export function compareTankClassTrialResults(input: {
  classId: PlayerClassId
  stages: readonly TankClassTrialStageResult[]
}) {
  if (input.stages.length !== 3) {
    throw new Error(`Tank class trial comparison requires exactly three stages: ${input.classId}`)
  }
  const stageResults = input.stages.map((stage) => {
    const flags: string[] = []
    if (stage.classBestPassRate < 0.05 && stage.warriorBestPassRate >= 0.15) flags.push('tool_gap')
    if (stage.classBestPassRate >= 0.85 && stage.warriorBestPassRate <= 0.69) flags.push('strength_overflow')
    const difficultyGap = Math.abs(
      DIFFICULTY_ORDER.indexOf(stage.classDifficulty) - DIFFICULTY_ORDER.indexOf(stage.warriorDifficulty),
    )
    if (difficultyGap > 1) flags.push('difficulty_gap_over_one_tier')
    return { ...stage, passRateDifference: stage.classBestPassRate - stage.warriorBestPassRate, flags }
  })
  const averagePassRateDifference = stageResults.reduce(
    (total, stage) => total + stage.passRateDifference,
    0,
  ) / stageResults.length

  return {
    classId: input.classId,
    stageResults,
    averagePassRateDifference,
    averagePassRateDifferenceWithinTarget: Math.abs(averagePassRateDifference) <= 0.15,
    outperformsWarriorOnAllStages: stageResults.every((stage) => stage.passRateDifference > 0),
  }
}
```

- [ ] **Step 9: Run class-aware balance tests and build**

Run:

```powershell
npm test -- src/game/balance/balanceBuildGenerator.test.ts src/game/balance/balanceSimulator.test.ts src/game/balance/learningBalanceEvaluator.test.ts src/game/balance/deltaAnalysis.test.ts src/game/balance/tankClassBalanceComparison.test.ts
npm run build
```

Expected: PASS; the TypeScript build finds no balance API call missing `classId`.

- [ ] **Step 10: Commit the class-aware balance core**

```powershell
git add src/game/balance
git commit -m "feat: add class aware balance analysis"
```

### Task 10: Add Class Dimension To Reports And Analyzer Scripts

**Files:**
- Modify: `src/game/balance/balanceReport.ts`
- Modify: `src/game/balance/balanceReport.test.ts`
- Modify: `src/game/balance/dataEstimateReport.ts`
- Modify: `src/game/balance/dataEstimateReport.test.ts`
- Modify: `src/game/balance/deltaReport.ts`
- Modify: `src/game/balance/deltaReport.test.ts`
- Modify: `src/game/balance/diagnosticReport.ts`
- Modify: `src/game/balance/diagnosticReport.test.ts`
- Modify: `src/game/balance/strategyTipsSensitivity.ts`
- Modify: `src/game/balance/strategyTipsSensitivity.test.ts`
- Modify: `scripts/analyzeBalance.mjs`
- Modify: `scripts/analyzeDelta.mjs`
- Modify: `scripts/analyzeStrategyTips.mjs`

- [ ] **Step 1: Add failing report identity tests**

Update report fixtures with:

```ts
classId: 'warrior_t',
buildRuleId: 'standard_5slot',
classComparisons: [],
```

Assert rendered Markdown contains:

```ts
expect(markdown).toContain('`Challenge-1 / warrior_t / standard_5slot`')
```

For delta and strategy sensitivity rows, assert their stage keys include class ID and do not merge otherwise equal stage/build IDs from different classes.

- [ ] **Step 2: Run report tests and verify missing fields**

Run:

```powershell
npm test -- src/game/balance/balanceReport.test.ts src/game/balance/dataEstimateReport.test.ts src/game/balance/deltaReport.test.ts src/game/balance/diagnosticReport.test.ts src/game/balance/strategyTipsSensitivity.test.ts
```

Expected: FAIL because current report identity is stage-only.

- [ ] **Step 3: Add required report fields and composite identity**

Use this base stage report shape:

```ts
export interface BalanceStageReport {
  stageId: string
  classId: PlayerClassId
  buildRuleId: string
  title: string
  manualLabel: ManualDifficultyLabel
  automatedLabel: DifficultyLabel
  scoringMode: BalanceScoringMode
  buildSearchMode?: 'single_phase' | 'two_phase'
  phaseOneBuildCount?: number
  finalBuildCount?: number
  testedBuildCount: number
  bestBuildsByProfile: BestBuildProfileSummary[]
  ratingReasons: string[]
  scenarios: BalanceScenarioResult[]
  recommendation: string
}

export interface BalanceReport {
  generatedAt: string
  stages: BalanceStageReport[]
  classComparisons: ReturnType<typeof compareTankClassTrialResults>[]
}

export function getBalanceReportStageKey(stage: Pick<BalanceStageReport, 'stageId' | 'classId' | 'buildRuleId'>) {
  return `${stage.stageId} / ${stage.classId} / ${stage.buildRuleId}`
}
```

Render each heading as:

```ts
`## \`${getBalanceReportStageKey(stage)}\` - ${stage.title}`
```

Apply the same `(stageId, classId, buildRuleId)` key to data-estimate, diagnostic, delta, and sensitivity outputs.

Render `classComparisons` as a separate Markdown section with one row per trial class: class ID, three stage IDs, average pass-rate difference, whether the 15-point target passed, whether it outperforms warrior on all three stages, and all stage flags. If no additional class is registered, render `暂无可比较的新坦克职业。`.

- [ ] **Step 4: Make analyzer cache and execution class-scoped**

Change the main analyzer entry to:

```js
function getStageEntryKey(stageId, classId, buildRuleId, manualLabel, stageEntry) {
  return `${stageId}:${classId}:${buildRuleId}:${manualLabel}:${stageEntry ? 'challenge' : 'story'}`
}

function analyzeStageEntry(stageId, classId, manualLabel, stageEntry, sampleConfig) {
  const stage = getStageById(stageId)
  const buildRuleId = getStageBuildRuleId(stage)
  const cacheKey = getStageEntryKey(stageId, classId, buildRuleId, manualLabel, stageEntry)
}
```

Within that function, use these class-scoped calls while retaining each existing sampling option unchanged:

```js
const manualPlaytestBuildCandidate = !stageEntry
  ? buildManualPlaytestCandidateForStage(manualPlaytestEntries, stage, classId)
  : null
const analysis = runTwoPhaseStageBalanceAnalysis({
  stage,
  classId,
  profiles: BALANCE_PROFILES,
  extraBuildCandidates: manualPlaytestBuildCandidate ? [manualPlaytestBuildCandidate] : [],
  phaseOneAttemptsPerScenario: sampleConfig.fixedPhaseOneAttempts,
  phaseOneMaxActiveBuilds: sampleConfig.fixedPhaseOneMaxActiveBuilds,
  phaseOneMaxPassiveVariants: sampleConfig.fixedPhaseOneMaxPassiveVariants,
  finalBuildCount: sampleConfig.fixedFinalBuildCount,
  attemptsPerScenario: sampleConfig.fixedAttempts,
  maxDurationMs: 120_000,
  collectTrace: cliOptions.trace,
  collectDiagnostics: true,
})
const strategyTipBuildCandidates = generateStrategyTipBuildCandidates(stage, classId, {
  maxCandidates: cliOptions.quick ? 6 : 4,
})
const learningAnalysis = runLearningStageBalanceAnalysis({
  stage,
  classId,
  profiles: LEARNING_BALANCE_PROFILES,
  buildCandidates: learningBuildCandidates,
  castStrategies: LEARNING_CAST_STRATEGIES,
  tacticalStrategies: LEARNING_TACTICAL_STRATEGIES,
  phaseOneAttemptsPerScenario: sampleConfig.learningPhaseOneAttempts,
  finalBuildCount: sampleConfig.learningFinalBuildCount,
  finalStrategyCount: sampleConfig.learningFinalStrategyCount,
  attemptsPerScenario: sampleConfig.learningAttempts,
  maxDurationMs: 120_000,
  collectTrace: cliOptions.trace,
  collectDiagnostics: true,
})
const result = {
  stageId,
  classId,
  buildRuleId,
  title: stage.title,
  strategyTips: stage.strategyTips ?? '',
  manualLabel,
  staticScore,
  fixedAnalysis: analysis,
  learningAnalysis,
  designRecommendation,
  automatedLabel: analysis.rating.label,
  scoringMode: analysis.scoringMode,
  buildSearchMode: analysis.buildSearchMode,
  phaseOneBuildCount: analysis.phaseOneBuildCount ?? 0,
  finalBuildCount: analysis.finalBuildCount ?? analysis.bestBuildsByProfile.length,
  testedBuildCount: analysis.finalBuildCount ?? analysis.bestBuildsByProfile.length,
  bestBuildsByProfile: analysis.bestBuildsByProfile,
  ratingReasons: analysis.rating.reasons,
  scenarios: analysis.scenarios,
  recommendation: recommendationFor(manualLabel, analysis.rating.label),
}
```

Build the class list from registered runtimes intersected with content support:

```js
function getAnalysisClassIds(stage) {
  const contentCap = stage.allowedClassIds?.length ? new Set(stage.allowedClassIds) : null
  return getPlayerClassRuntimeDefinitions()
    .map((entry) => entry.classId)
    .filter((classId) => !contentCap || contentCap.has(classId))
}

const stages = stageEntries.flatMap(([stageId, manualLabel, stageEntry]) => {
  const stage = getStageById(stageId)
  return getAnalysisClassIds(stage).map((classId) =>
    analyzeStageEntry(stageId, classId, manualLabel, stageEntry, sampleConfig),
  )
})
```

Build comparisons only when warrior and the trial class both have all three results:

```js
function buildTankClassComparisons(stages) {
  return CHALLENGE_GROUP_POLICIES.flatMap((group) => {
    if (!group.trialClassId) return []
    const rows = group.challengeIds.map((stageId) => ({
      warrior: stages.find((stage) => stage.stageId === stageId && stage.classId === 'warrior_t'),
      target: stages.find((stage) => stage.stageId === stageId && stage.classId === group.trialClassId),
    }))
    if (rows.some((row) => !row.warrior || !row.target)) return []
    return [compareTankClassTrialResults({
      classId: group.trialClassId,
      stages: rows.map(({ warrior, target }) => ({
        stageId: warrior.stageId,
        warriorBestPassRate: warrior.fixedAnalysis.rating.overallBestPassRate,
        classBestPassRate: target.fixedAnalysis.rating.overallBestPassRate,
        warriorDifficulty: warrior.fixedAnalysis.rating.label,
        classDifficulty: target.fixedAnalysis.rating.label,
      })),
    })]
  })
}
```

Return `classComparisons: buildTankClassComparisons(stages)` from `buildReport()`.

Until bear runtime/content is registered, analyzer output remains warrior-only. Once phase 1 adds both, the same command produces separate class rows automatically.

- [ ] **Step 5: Update delta and strategy analyzer arguments**

Support `--class=<classId>` with default `warrior_t`. Reject an unregistered class before reading builds:

```js
const requestedClassId = readStringOption(process.argv.slice(2), '--class') ?? 'warrior_t'
getPlayerClassRuntimeDefinition(requestedClassId)
```

Pass `requestedClassId` to build generation, normalization, simulation, learning, and report creation. Include it in output filenames, for example `delta-Challenge-1-druid_bear_t.md`, to prevent overwrite.

- [ ] **Step 6: Run report templates and quick analysis**

Run:

```powershell
npm test -- src/game/balance/balanceReport.test.ts src/game/balance/dataEstimateReport.test.ts src/game/balance/deltaReport.test.ts src/game/balance/diagnosticReport.test.ts src/game/balance/strategyTipsSensitivity.test.ts src/game/balance/analyzeBalanceTemplate.test.ts src/game/balance/analyzeChallengeBalanceTemplate.test.ts
npm run analyze:balance -- --challenge --quick --stages=Challenge-1
```

Expected: tests PASS; quick report identifies `Challenge-1 / warrior_t / standard_5slot`; no designer workbook is written.

- [ ] **Step 7: Commit report and analyzer identity**

```powershell
git add src/game/balance scripts/analyzeBalance.mjs scripts/analyzeDelta.mjs scripts/analyzeStrategyTips.mjs
git commit -m "feat: report balance results by player class"
```

### Task 11: Validate Challenge Snapshots And Multiclass Data Boundaries

**Files:**
- Modify: `src/game/data/designerDataValidator.ts`
- Modify: `src/game/data/designerDataValidator.test.ts`
- Modify: `src/game/data/designerDataValidator.health.test.ts`
- Modify: `scripts/validateDesignerData.mjs`

- [ ] **Step 1: Add failing six-workbook validator fixtures**

Extend `DesignerDataWorkbookMap` test fixtures with `challengeStageContent` and `challengeEncounterBalance`. Add a mismatch where `Challenge-1` has `standard_5slot` in the challenge stage workbook and `8slot_0` in its opening. Assert:

```ts
expect(result.errors).toEqual(expect.arrayContaining([
  expect.objectContaining({
    workbook: 'challenge_encounter_balance.xlsx',
    sheet: '关卡开场',
    field: 'buildRuleId',
    code: 'invalid_combination',
    value: '8slot_0',
  }),
]))
```

Add tests for a challenge group with two stages, duplicate challenge IDs, an unknown `allowedClassIdsCsv` class, an unlocked skill whose definition belongs to no allowed class, an active skill with an unregistered `skillLogicId`, and a passive talent with an unregistered `talentLogicId`.

- [ ] **Step 2: Run validator tests and verify map/type failures**

Run: `npm test -- src/game/data/designerDataValidator.test.ts src/game/data/designerDataValidator.health.test.ts`

Expected: FAIL because only four mainline workbooks are loaded.

- [ ] **Step 3: Extend the workbook map and sheet specs**

```ts
export interface DesignerDataWorkbookMap {
  stageContent: XLSX.WorkBook
  encounterBalance: XLSX.WorkBook
  enemyData: XLSX.WorkBook
  playerBuild: XLSX.WorkBook
  challengeStageContent: XLSX.WorkBook
  challengeEncounterBalance: XLSX.WorkBook
}

const WORKBOOK_NAMES: Record<keyof DesignerDataWorkbookMap, string> = {
  stageContent: 'stage_content.xlsx',
  encounterBalance: 'encounter_balance.xlsx',
  enemyData: 'enemy_data.xlsx',
  playerBuild: 'player_build.xlsx',
  challengeStageContent: 'challenge_stage_content.xlsx',
  challengeEncounterBalance: 'challenge_encounter_balance.xlsx',
}
```

Add challenge sheet specs with these exact required headers:

```ts
['区域', ['areaId', 'title', 'shortTitle', 'mapLabel', 'description', 'accent']]
['关卡', ['stageId', 'areaId', 'order', 'title', 'unlockedActiveSkillIdsCsv', 'passiveTalentUnlockTier', 'challengeId', 'allowedClassIdsCsv', 'buildRuleId']]
['图例', ['areaId', 'id', 'iconId', 'label', 'source', 'target', 'description']]
['关卡开场', ['stageId', 'playerHp', 'playerMaxHp', 'playerResource', 'playerGcdRemainingMs', 'partyHp', 'partyMaxHp', 'partyPressure', 'partyMaxPressure', 'buildRuleId']]
['敌人布置', ['stageId', 'spawnId', 'enemyId', 'row', 'col']]
['开场状态', ['stageId', 'targetType', 'statusId', 'sourceType']]
['关卡词缀绑定', ['stageId', 'affixIdsCsv']]
['词缀定义', ['affixId', 'affixName', 'iconId', 'description', 'delayMs', 'targetType', 'targetSelector', 'statusId']]
['特殊规则绑定', ['stageId', 'ruleIdsCsv']]
['特殊规则定义', ['ruleId', 'ruleName', 'iconId', 'description', 'ruleLogicId']]
['图标资源映射', ['iconId', 'iconName', 'assetKey', 'iconType']]
```

Read `伤害来源定义` and `关卡伤害来源绑定` when rows exist, but do not require headers while the approved challenge workbook intentionally keeps both sheets empty.

- [ ] **Step 4: Add challenge consistency validation**

After base references are collected, validate each enabled challenge stage:

```ts
function addChallengeConsistencyIssues(
  errors: DesignerDataValidationIssue[],
  challengeStages: SheetRow[],
  challengeOpenings: SheetRow[],
  classIds: Set<string>,
  activeSkillClassById: Map<string, string>,
) {
  for (const [index, stage] of challengeStages.entries()) {
    if (normalizeText(stage.enabled).toLowerCase() === 'false') continue
    const stageId = requireText(errors, WORKBOOK_NAMES.challengeStageContent, '关卡', stage, index, 'stageId')
    if (!stageId) continue
    const openings = challengeOpenings.filter((row) => optionalText(row, 'stageId') === stageId)
    if (openings.length !== 1) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.challengeEncounterBalance, '关卡开场', index, 'stageId', `${stageId} requires exactly one opening`)
      continue
    }
    const stageRuleId = optionalText(stage, 'buildRuleId')
    const openingRuleId = optionalText(openings[0], 'buildRuleId')
    if (stageRuleId !== openingRuleId) {
      errors.push({
        workbook: WORKBOOK_NAMES.challengeEncounterBalance,
        sheet: '关卡开场',
        row: index + 2,
        field: 'buildRuleId',
        code: 'invalid_combination',
        message: `${stageId} buildRuleId must match challenge stage content`,
        value: openingRuleId,
      })
    }

    const allowedClassIds = parseCsv(stage.allowedClassIdsCsv)
    for (const classId of allowedClassIds) {
      if (!classIds.has(classId)) {
        errors.push({
          workbook: WORKBOOK_NAMES.challengeStageContent,
          sheet: '关卡',
          row: index + 2,
          field: 'allowedClassIdsCsv',
          code: 'unknown_reference',
          message: `Unknown allowed player class: ${classId}`,
          value: classId,
        })
      }
    }

    for (const skillId of parseCsv(stage.unlockedActiveSkillIdsCsv)) {
      const ownerClassId = activeSkillClassById.get(skillId)
      if (!ownerClassId || !allowedClassIds.includes(ownerClassId)) {
        errors.push({
          workbook: WORKBOOK_NAMES.challengeStageContent,
          sheet: '关卡',
          row: index + 2,
          field: 'unlockedActiveSkillIdsCsv',
          code: 'invalid_combination',
          message: `${skillId} is not owned by an allowed class for ${stageId}`,
          value: skillId,
        })
      }
    }
  }
}
```

Import `hasPlayerSkillRuntime` from `../encounter/playerSkillRuntimeRegistry` and `hasPassiveTalentLogic` from `./playerTalentLogicRegistry`. Call the helper with an `activeSkillClassById` map built from `主动技能定义`. Add these ownership and handler checks after the existing row validations:

```ts
function addClassOwnershipIssues(
  errors: DesignerDataValidationIssue[],
  rows: ReturnType<typeof collectSheetRows>,
) {
  const activeSkillClassById = new Map(
    rows.activeSkills.map((row) => [optionalText(row, 'skillId'), optionalText(row, 'classId')]),
  )
  const passiveTalentClassById = new Map(
    rows.passiveTalents.map((row) => [optionalText(row, 'talentId'), optionalText(row, 'classId')]),
  )

  rows.activeSkills.forEach((row, index) => {
    const skillId = optionalText(row, 'skillId')
    const classId = optionalText(row, 'classId')
    if (skillId && classId && !skillId.startsWith(`${classId}_`)) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', index, 'skillId', skillId)
    }
    const skillLogicId = optionalText(row, 'skillLogicId')
    if (skillLogicId && !hasPlayerSkillRuntime(skillLogicId)) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', index, 'skillLogicId', skillLogicId)
    }
  })
  rows.passiveTalents.forEach((row, index) => {
    const talentId = optionalText(row, 'talentId')
    const classId = optionalText(row, 'classId')
    if (talentId && classId && !talentId.startsWith(`${classId}_`)) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', index, 'talentId', talentId)
    }
    const talentLogicId = optionalText(row, 'talentLogicId')
    if (talentLogicId && !hasPassiveTalentLogic(talentLogicId)) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', index, 'talentLogicId', talentLogicId)
    }
  })
  rows.defaultActiveBuilds.forEach((row, index) => {
    const classId = optionalText(row, 'classId')
    const skillId = optionalText(row, 'skillId')
    if (classId && skillId && activeSkillClassById.get(skillId) !== classId) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '默认主动构筑', index, 'skillId', skillId)
    }
  })
  rows.defaultPassiveBuilds.forEach((row, index) => {
    const classId = optionalText(row, 'classId')
    const talentId = optionalText(row, 'talentId')
    if (classId && talentId && passiveTalentClassById.get(talentId) !== classId) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '默认被动构筑', index, 'talentId', talentId)
    }
  })
}
```

For status references, derive the owner from the referencing skill or talent. A shared status such as `taunted`, `countered`, or `stunned` is legal for every class. If a referenced status begins with a known class prefix such as `druid_bear_t_` or `dk_blood_t_`, reject it when that prefix does not match the referencing content owner.

Validate policy coverage with this rule: every `CHALLENGE_GROUP_POLICIES` entry resolves to exactly its three workbook stages. Build the enabled class set from `职业定义.enabled`; for each enabled `trialClassId`, require that class in `allowedClassIdsCsv` for its own group and every later group. Disabled reserved classes do not force workbook support. This makes current warrior-only challenge rows valid, while phase 1 must add bear to Challenge-1 through Challenge-9 when bear becomes enabled.

- [ ] **Step 5: Load all six workbooks in the CLI**

```js
const result = validateDesignerDataWorkbooks({
  stageContent: readWorkbook('stage_content.xlsx'),
  encounterBalance: readWorkbook('encounter_balance.xlsx'),
  enemyData: readWorkbook('enemy_data.xlsx'),
  playerBuild: readWorkbook('player_build.xlsx'),
  challengeStageContent: readWorkbook('challenge_stage_content.xlsx'),
  challengeEncounterBalance: readWorkbook('challenge_encounter_balance.xlsx'),
})
```

Update test fixture factories once so every validator test receives six workbooks.

- [ ] **Step 6: Run validator and snapshot-focused tests**

Run:

```powershell
npm test -- src/game/data/designerDataValidator.test.ts src/game/data/designerDataValidator.health.test.ts src/game/data/workbookLoader.test.ts src/game/data/playerBuildCatalog.test.ts scripts/generateChallengeWorkbook.test.ts
npm run validate:designer-data
```

Expected: all tests PASS; live validation reports 0 errors and 0 warnings; all nine challenge rows match their opening `buildRuleId` and their approved RD-6/WF-6/ZA-6 snapshots.

- [ ] **Step 7: Commit expanded data validation**

```powershell
git add src/game/data/designerDataValidator.ts src/game/data/designerDataValidator.test.ts src/game/data/designerDataValidator.health.test.ts scripts/validateDesignerData.mjs
git commit -m "feat: validate multiclass challenge data boundaries"
```

### Task 12: Full Verification, Visual Inspection, And Handoff

**Files:**
- Modify: `docs/player-tank-class-expansion-handoff.md`
- Modify: `开发更新日志.md`
- Verify only: `public/designer-data/*.xlsx`, `src-tauri/`, `release/`

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
npm test
npm run validate:designer-data
npm run lint
npm run build
npm run test:desktop-data
```

Expected: every command exits 0. Validation reports 0 warnings. No command in this step writes `public/designer-data`.

- [ ] **Step 2: Run quick challenge balance smoke tests**

```powershell
npm run analyze:balance -- --challenge --quick --stages=Challenge-1,Challenge-4,Challenge-7
```

Expected: each result is keyed by `(stageId, warrior_t, buildRuleId)`; analysis remains read-only; there are no missing registry/default-build errors.

- [ ] **Step 3: Perform desktop and mobile visual verification**

Start Vite on an unused local port:

```powershell
npm run dev -- --host 127.0.0.1 --port 5174
```

In a separate PowerShell session, capture both viewports without committing the images:

```powershell
npx --yes playwright@1.54.1 screenshot --viewport-size="1440,900" http://127.0.0.1:5174 reports/multiclass-stage-entry-desktop.png
npx --yes playwright@1.54.1 screenshot --device="iPhone 13" http://127.0.0.1:5174 reports/multiclass-stage-entry-mobile.png
```

Inspect both screenshots and confirm: CTA is exactly 240x82 CSS pixels at 100% zoom; the reserved grid occupies 4 columns by 3 rows; occupied items flow top-to-bottom before the next column; icons are 50x50 slots with approximately 34px glyphs; CTA text does not wrap or overlap; the gold selected border and green victory check remain distinct; the control does not cover stage nodes or the brief panel. Stop the Vite process after inspection.

- [ ] **Step 4: Update implementation handoff**

Append a dated phase-0 section to `docs/player-tank-class-expansion-handoff.md` recording:

```markdown
## 2026-07-22 阶段0：多职业基础设施

- 运行时职业注册采用精确命中；当前只注册 `warrior_t`，未知职业禁止进入战斗。
- 构筑规则为职业无关模板；默认构筑、技能、天赋和规范化均显式接收 `classId`，禁止跨职业回退。
- 存档升级为 v2，保留 v1 读取迁移；构筑、挑战胜利、主线胜利和自动装备记录均按职业隔离。
- 挑战1~3、4~6、7~9分别跟随 RD-6、WF-6、ZA-6 开放；熊T与DKT仍需在各自内容阶段注册后才会显示。
- 关卡入口使用固定 240x82 CTA 与4列3行职业槽；职业按钮纵向优先，金色表示选择，绿色勾表示该职业已通关本关。
- 固定AI、学习型AI、delta和报告使用 `(stageId, classId, buildRuleId)` 维度；当前回归结果仍仅包含战士T。
- 下一步先独立完成熊T职业规格，再写入 `player_build.xlsx`、运行时处理器、AI策略和挑战1~3允许职业/技能快照。
```

- [ ] **Step 5: Update the development changelog**

Add one dated entry to `开发更新日志.md` containing the same behavioral changes, migration note, validation commands, and explicit statement that no bear/DK playable data was shipped in phase 0.

- [ ] **Step 6: Review the final diff and public-data boundary**

Run:

```powershell
git status --short
git diff --check
git diff --name-only
git diff --stat -- public
```

Expected: no whitespace errors; the only `public/` change is `public/designer-data/player_build.xlsx`; `.superpowers/` remains untracked and uncommitted; reports/screenshots are not staged.

- [ ] **Step 7: Commit documentation and final verification record**

```powershell
git add docs/player-tank-class-expansion-handoff.md 开发更新日志.md
git commit -m "docs: hand off multiclass foundation"
```

- [ ] **Step 8: Inspect the complete branch history**

Run:

```powershell
git status --short
git log --oneline -12
```

Expected: worktree is clean except the pre-existing untracked `.superpowers/`; commits appear in task order; no implementation commit contains generated public files other than the approved `player_build.xlsx` cell edit.
