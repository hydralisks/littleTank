# Best-Build Balance Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate RingingDeeps difficulty using the strongest legal build per operation profile, and make the winning build visible in generated balance reports.

**Architecture:** Add a focused build candidate generator under `src/game/balance`, then extend the existing simulator analysis to summarize best scenarios without changing the pass-rate-only classifier contract. Reports keep all raw scenario rows for diagnostics, but their headline scoring mode becomes `best_build_per_profile`.

**Tech Stack:** TypeScript, Vitest, existing React/Vite project tooling, existing workbook parsing/catalog APIs, existing `npm run analyze:balance` script.

---

## File Structure

- Create `src/game/balance/balanceBuildGenerator.ts`
  - Generates legal build variants for a stage from current catalog data.
  - Owns build signatures, deterministic IDs, active/passive candidate generation, and caps.

- Create `src/game/balance/balanceBuildGenerator.test.ts`
  - Unit tests for default inclusion, legality, passive tier rules, dedupe, and caps.

- Modify `src/game/balance/balanceSimulator.ts`
  - Adds best-build summary types.
  - Adds optional trace support.
  - Keeps `BalanceScenarioResult` pass-rate-only.

- Modify `src/game/balance/balanceSimulator.test.ts`
  - Tests best build selection and trace isolation.

- Modify `src/game/balance/balanceReport.ts`
  - Extends report schema with scoring mode, tested build count, and best build summaries.
  - Renders best-build summary before raw scenario table.

- Modify `src/game/balance/balanceReport.test.ts`
  - Tests report rendering for best-build fields and no HP/pressure scoring implication.

- Modify `scripts/analyzeBalance.mjs`
  - Replaces local `createBuildVariants` with `generateStageBalanceBuilds`.
  - Writes enriched latest reports.

- Modify docs:
  - `docs/balance/difficulty-scoring-system.md`
  - `docs/balance/ringingdeeps-balance-report.md`
  - `开发更新日志.md`

---

### Task 1: Build Candidate Generator

**Files:**
- Create: `src/game/balance/balanceBuildGenerator.ts`
- Test: `src/game/balance/balanceBuildGenerator.test.ts`

- [ ] **Step 1: Write the failing generator test**

Create `src/game/balance/balanceBuildGenerator.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  canUseSkillInRule,
  canUseTalentInRule,
  getActivePointCost,
  getBuildRuleDefinition,
  getRemainingBuildPoints,
  getDefaultPersistedBuildForRule,
} from '../data/playerBuildCatalog'
import {
  getPassiveTalentUnlockTierForStage,
  getStageById,
  getUnlockedActiveSkillIdsForStage,
} from '../data/stageTemplates'
import {
  generateStageBalanceBuilds,
  getBuildSignature,
} from './balanceBuildGenerator'

describe('balance build generator', () => {
  it('includes the normalized default build first', () => {
    const stage = getStageById('harbor-4')
    const buildRuleId = getStageBuildRuleId(stage)
    const builds = generateStageBalanceBuilds(stage, {
      maxActiveBuilds: 8,
      maxPassiveVariants: 4,
    })

    expect(builds[0].id).toBe('default')
    expect(builds[0].build).toEqual(getDefaultPersistedBuildForRule(buildRuleId))
  })

  it('generates only legal active skills, enabled hotkeys, passive tiers, and point totals', () => {
    const stage = getStageById('harbor-6')
    const buildRuleId = getStageBuildRuleId(stage)
    const rule = getBuildRuleDefinition(buildRuleId)
    const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
    const passiveTier = getPassiveTalentUnlockTierForStage(stage)
    const builds = generateStageBalanceBuilds(stage, {
      maxActiveBuilds: 20,
      maxPassiveVariants: 8,
    })

    expect(rule).toBeDefined()
    expect(builds.length).toBeGreaterThan(1)

    for (const variant of builds) {
      const activeSkills = Object.entries(variant.build.loadout)
        .filter(([, skillId]) => Boolean(skillId))
      expect(activeSkills.length).toBeLessThanOrEqual(rule!.maxActiveSlots)
      expect(getActivePointCost(variant.build.loadout)).toBeLessThanOrEqual(rule!.totalBuildPoints)
      expect(getRemainingBuildPoints(buildRuleId, variant.build.loadout, variant.build.passiveTalentIds)).toBeGreaterThanOrEqual(0)

      for (const [hotkey, skillId] of activeSkills) {
        expect(rule!.enabledHotkeys).toContain(hotkey)
        expect(canUseSkillInRule(buildRuleId, skillId!, unlockedSkillIds)).toBe(true)
      }

      for (const talentId of variant.build.passiveTalentIds) {
        expect(canUseTalentInRule(buildRuleId, talentId, passiveTier)).toBe(true)
      }
    }
  })

  it('deduplicates builds by stable normalized signature', () => {
    const stage = getStageById('harbor-6')
    const builds = generateStageBalanceBuilds(stage, {
      maxActiveBuilds: 30,
      maxPassiveVariants: 8,
    })
    const signatures = builds.map((variant) => getBuildSignature(variant.build))

    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('respects active and passive generation caps while preserving default', () => {
    const stage = getStageById('harbor-6')
    const builds = generateStageBalanceBuilds(stage, {
      maxActiveBuilds: 3,
      maxPassiveVariants: 2,
    })

    expect(builds[0].id).toBe('default')
    expect(builds.length).toBeLessThanOrEqual(1 + 3 * 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/game/balance/balanceBuildGenerator.test.ts
```

Expected: FAIL because `./balanceBuildGenerator` does not exist.

- [ ] **Step 3: Implement `balanceBuildGenerator.ts`**

Create `src/game/balance/balanceBuildGenerator.ts`:

```ts
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  canUseSkillInRule,
  canUseTalentInRule,
  getActiveSkillCatalog,
  getBuildRuleDefinition,
  getDefaultPersistedBuildForRule,
  getPassiveTalentCatalog,
  getRemainingBuildPoints,
  normalizePersistedBuildForRule,
} from '../data/playerBuildCatalog'
import {
  getPassiveTalentUnlockTierForStage,
  getUnlockedActiveSkillIdsForStage,
  type StageInfo,
} from '../data/stageTemplates'
import type {
  PassiveTalentId,
  PersistedBuildState,
  SkillHotkey,
  SkillId,
  SkillLoadout,
} from '../encounter/encounterTypes'
import type { BalanceBuildVariant } from './balanceSimulator'

export interface BalanceBuildGenerationOptions {
  maxActiveBuilds?: number
  maxPassiveVariants?: number
}

const DEFAULT_MAX_ACTIVE_BUILDS = 24
const DEFAULT_MAX_PASSIVE_VARIANTS = 8
const EMPTY_LOADOUT: SkillLoadout = {
  '1': null,
  '2': null,
  '3': null,
  '4': null,
  Q: null,
  E: null,
  R: null,
  F: null,
}

function normalizeIdPart(value: string) {
  return value
    .replace(/^warrior_t_/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

export function getBuildSignature(build: PersistedBuildState) {
  const loadout = Object.entries(build.loadout)
    .filter(([, skillId]) => Boolean(skillId))
    .map(([hotkey, skillId]) => `${hotkey}:${skillId}`)
    .join('|')
  const passives = [...build.passiveTalentIds].sort().join('|')

  return `${loadout}::${passives}`
}

function createVariantId(build: PersistedBuildState) {
  const skillParts = Object.values(build.loadout)
    .filter((skillId): skillId is SkillId => Boolean(skillId))
    .map(normalizeIdPart)
  const passiveParts = build.passiveTalentIds.map(normalizeIdPart)
  const activeId = skillParts.length > 0 ? skillParts.join('-') : 'empty'
  const passiveId = passiveParts.length > 0 ? `__p-${passiveParts.join('-')}` : ''

  return `active-${activeId}${passiveId}`
}

function combinations<T>(items: readonly T[], count: number): T[][] {
  if (count <= 0) {
    return [[]]
  }
  if (items.length < count) {
    return []
  }

  const result: T[][] = []
  const visit = (startIndex: number, picked: T[]) => {
    if (picked.length === count) {
      result.push([...picked])
      return
    }

    for (let index = startIndex; index < items.length; index += 1) {
      picked.push(items[index])
      visit(index + 1, picked)
      picked.pop()
    }
  }

  visit(0, [])
  return result
}

function createLoadoutForSkills(hotkeys: readonly SkillHotkey[], skillIds: readonly SkillId[]) {
  const loadout = { ...EMPTY_LOADOUT }

  skillIds.forEach((skillId, index) => {
    const hotkey = hotkeys[index]
    if (hotkey) {
      loadout[hotkey] = skillId
    }
  })

  return loadout
}

function getLegalActiveSkillIds(stage: StageInfo, buildRuleId: string) {
  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
  const unlockedSet = new Set(unlockedSkillIds)

  return getActiveSkillCatalog()
    .filter((skill) => unlockedSet.has(skill.id))
    .filter((skill) => canUseSkillInRule(buildRuleId, skill.id, unlockedSkillIds))
    .sort((left, right) => (left.uiOrder ?? 999) - (right.uiOrder ?? 999) || left.id.localeCompare(right.id))
    .map((skill) => skill.id)
}

function getLegalPassiveTalentIds(stage: StageInfo, buildRuleId: string) {
  const maxTier = getPassiveTalentUnlockTierForStage(stage)
  if (maxTier < 0) {
    return []
  }

  return getPassiveTalentCatalog()
    .filter((talent) => canUseTalentInRule(buildRuleId, talent.id, maxTier))
    .sort((left, right) => (left.uiOrder ?? 999) - (right.uiOrder ?? 999) || left.id.localeCompare(right.id))
    .map((talent) => talent.id)
}

function getPassiveVariants(
  buildRuleId: string,
  loadout: SkillLoadout,
  talentIds: PassiveTalentId[],
  maxPassiveVariants: number,
) {
  const variants: PassiveTalentId[][] = [[]]

  for (let count = 1; count <= talentIds.length; count += 1) {
    for (const picked of combinations(talentIds, count)) {
      if (getRemainingBuildPoints(buildRuleId, loadout, picked) >= 0) {
        variants.push(picked)
      }
      if (variants.length >= maxPassiveVariants) {
        return variants
      }
    }
  }

  return variants
}

function getActiveLoadouts(
  stage: StageInfo,
  buildRuleId: string,
  maxActiveBuilds: number,
) {
  const rule = getBuildRuleDefinition(buildRuleId)
  if (!rule) {
    return []
  }

  const skillIds = getLegalActiveSkillIds(stage, buildRuleId)
  const maxSlots = Math.min(rule.maxActiveSlots, rule.enabledHotkeys.length, skillIds.length)
  const loadouts: SkillLoadout[] = []

  for (let count = Math.max(1, maxSlots); count >= 1; count -= 1) {
    for (const picked of combinations(skillIds, count)) {
      const loadout = createLoadoutForSkills(rule.enabledHotkeys, picked)
      if (getRemainingBuildPoints(buildRuleId, loadout, []) >= 0) {
        loadouts.push(loadout)
      }
      if (loadouts.length >= maxActiveBuilds) {
        return loadouts
      }
    }
  }

  return loadouts
}

function pushUniqueVariant(
  variants: BalanceBuildVariant[],
  seen: Set<string>,
  id: string,
  build: PersistedBuildState,
) {
  const signature = getBuildSignature(build)
  if (seen.has(signature)) {
    return
  }

  seen.add(signature)
  variants.push({ id, build })
}

export function generateStageBalanceBuilds(
  stage: StageInfo,
  options: BalanceBuildGenerationOptions = {},
): BalanceBuildVariant[] {
  const maxActiveBuilds = options.maxActiveBuilds ?? DEFAULT_MAX_ACTIVE_BUILDS
  const maxPassiveVariants = options.maxPassiveVariants ?? DEFAULT_MAX_PASSIVE_VARIANTS
  const buildRuleId = getStageBuildRuleId(stage)
  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
  const maxPassiveTier = getPassiveTalentUnlockTierForStage(stage)
  const normalizedDefault = normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule(buildRuleId),
    buildRuleId,
    maxPassiveTier,
    unlockedSkillIds,
    stage.unlockedActiveSkillIds,
  ).build
  const variants: BalanceBuildVariant[] = []
  const seen = new Set<string>()

  pushUniqueVariant(variants, seen, 'default', normalizedDefault)

  const passiveTalentIds = getLegalPassiveTalentIds(stage, buildRuleId)
  for (const loadout of getActiveLoadouts(stage, buildRuleId, maxActiveBuilds)) {
    for (const passiveTalentVariant of getPassiveVariants(buildRuleId, loadout, passiveTalentIds, maxPassiveVariants)) {
      const build = { loadout, passiveTalentIds: passiveTalentVariant }
      pushUniqueVariant(variants, seen, createVariantId(build), build)
    }
  }

  return variants
}
```

- [ ] **Step 4: Run generator tests**

Run:

```powershell
npm test -- src/game/balance/balanceBuildGenerator.test.ts
```

Expected: PASS.

---

### Task 2: Best-Build Summary In Simulator

**Files:**
- Modify: `src/game/balance/balanceSimulator.ts`
- Test: `src/game/balance/balanceSimulator.test.ts`

- [ ] **Step 1: Write failing best-build summary tests**

Append to `src/game/balance/balanceSimulator.test.ts`:

```ts
  it('summarizes the best build for each operation profile', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const alternateBuild: PersistedBuildState = {
      ...build,
      loadout: {
        ...build.loadout,
        '1': null,
      },
    }

    const analysis = runStageBalanceAnalysis({
      stage,
      builds: [
        { id: 'default', build },
        { id: 'alternate', build: alternateBuild },
      ],
      profiles: [noMistakeProfile],
      attemptsPerScenario: 2,
      maxDurationMs: 1000,
      initialStateMutator: (state) =>
        state.skills.some((skill) => skill.id === 'warrior_t_taunt')
          ? instantVictoryState(state)
          : state,
    })

    expect(analysis.scoringMode).toBe('best_build_per_profile')
    expect(analysis.bestBuildsByProfile).toHaveLength(1)
    expect(analysis.bestBuildsByProfile[0]).toMatchObject({
      profileId: 'no-mistake',
      profileTier: 'average',
      buildId: 'default',
      passRate: 1,
      victories: 2,
      attempts: 2,
    })
    expect(analysis.bestBuildsByProfile[0].loadout).toEqual(build.loadout)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/game/balance/balanceSimulator.test.ts
```

Expected: FAIL because `StageBalanceAnalysis` does not expose `scoringMode` or `bestBuildsByProfile`.

- [ ] **Step 3: Extend simulator types and summary derivation**

Modify imports and interfaces in `src/game/balance/balanceSimulator.ts`:

```ts
import type {
  EncounterState,
  EnemyState,
  PersistedBuildState,
  SkillId,
  SkillLoadout,
  SkillState,
} from '../encounter/encounterTypes'
```

Add interfaces:

```ts
export type BalanceScoringMode = 'best_build_per_profile'

export interface BestBuildProfileSummary {
  profileId: string
  profileTier: BalanceProfileTier
  buildId: string
  attempts: number
  victories: number
  passRate: number
  loadout: SkillLoadout
  passiveTalentIds: string[]
}

export interface StageBalanceAnalysis {
  stageId: string
  scoringMode: BalanceScoringMode
  scenarios: BalanceScenarioResult[]
  bestBuildsByProfile: BestBuildProfileSummary[]
  rating: DifficultyRating
}
```

Add helper:

```ts
function getBestBuildsByProfile(
  scenarios: BalanceScenarioResult[],
  builds: BalanceBuildVariant[],
): BestBuildProfileSummary[] {
  const buildsById = new Map(builds.map((variant) => [variant.id, variant.build]))
  const bestByProfile = new Map<string, BalanceScenarioResult>()

  for (const scenario of scenarios) {
    const current = bestByProfile.get(scenario.profileId)
    if (
      !current ||
      scenario.passRate > current.passRate ||
      (scenario.passRate === current.passRate && scenario.buildId.localeCompare(current.buildId) < 0)
    ) {
      bestByProfile.set(scenario.profileId, scenario)
    }
  }

  return [...bestByProfile.values()]
    .sort((left, right) => left.profileId.localeCompare(right.profileId))
    .map((scenario) => {
      const build = buildsById.get(scenario.buildId)
      if (!build) {
        throw new Error(`Missing build variant for best scenario: ${scenario.buildId}`)
      }

      return {
        profileId: scenario.profileId,
        profileTier: scenario.profileTier,
        buildId: scenario.buildId,
        attempts: scenario.attempts,
        victories: scenario.victories,
        passRate: scenario.passRate,
        loadout: { ...build.loadout },
        passiveTalentIds: [...build.passiveTalentIds],
      }
    })
}
```

Modify `runStageBalanceAnalysis` return:

```ts
  return {
    stageId: options.stage.id,
    scoringMode: 'best_build_per_profile',
    scenarios,
    bestBuildsByProfile: getBestBuildsByProfile(scenarios, options.builds),
    rating: classifyDifficultyFromPassRates(scenarios),
  }
```

- [ ] **Step 4: Run simulator tests**

Run:

```powershell
npm test -- src/game/balance/balanceSimulator.test.ts
```

Expected: PASS.

---

### Task 3: Report Best-Build Fields

**Files:**
- Modify: `src/game/balance/balanceReport.ts`
- Modify: `src/game/balance/balanceReport.test.ts`

- [ ] **Step 1: Write failing report rendering test**

Append to `src/game/balance/balanceReport.test.ts`:

```ts
  it('renders best-build scoring mode and profile winners', () => {
    const report: BalanceReport = {
      generatedAt: '2026-05-23T00:00:00.000Z',
      stages: [
        {
          stageId: 'RingingDeeps-5',
          title: 'RD5',
          manualLabel: 'balanced',
          automatedLabel: 'balanced',
          scoringMode: 'best_build_per_profile',
          testedBuildCount: 3,
          bestBuildsByProfile: [
            {
              profileId: 'average-500ms-15pct',
              profileTier: 'average',
              buildId: 'active-taunt-interrupt-stun',
              attempts: 12,
              victories: 7,
              passRate: 7 / 12,
              loadout: {
                '1': 'warrior_t_taunt',
                '2': 'warrior_t_interrupt',
                '3': 'warrior_t_stun',
                '4': null,
                Q: null,
                E: null,
                R: null,
                F: null,
              },
              passiveTalentIds: [],
            },
          ],
          ratingReasons: ['average best pass rate: 58%'],
          scenarios: [],
          recommendation: 'Automated pass-rate label is aligned with the current manual baseline.',
        },
      ],
    }

    const markdown = renderBalanceReportMarkdown(report)

    expect(markdown).toContain('Scoring mode: `best_build_per_profile`')
    expect(markdown).toContain('Tested builds: 3')
    expect(markdown).toContain('active-taunt-interrupt-stun')
    expect(markdown).toContain('1=warrior_t_taunt')
    expect(markdown).not.toMatch(/weak build|average build/i)
  })
```

- [ ] **Step 2: Run report test to verify it fails**

Run:

```powershell
npm test -- src/game/balance/balanceReport.test.ts
```

Expected: FAIL because `BalanceStageReport` lacks the new fields and renderer does not print them.

- [ ] **Step 3: Extend report schema and renderer**

Modify `src/game/balance/balanceReport.ts`:

```ts
import type { SkillLoadout } from '../encounter/encounterTypes'
import type { BalanceScenarioResult, DifficultyLabel, BalanceProfileTier } from './difficultyScoring'
import type { BalanceScoringMode } from './balanceSimulator'
```

Add:

```ts
export interface BalanceReportBestBuild {
  profileId: string
  profileTier: BalanceProfileTier
  buildId: string
  attempts: number
  victories: number
  passRate: number
  loadout: SkillLoadout
  passiveTalentIds: string[]
}
```

Extend `BalanceStageReport`:

```ts
  scoringMode: BalanceScoringMode
  testedBuildCount: number
  bestBuildsByProfile: BalanceReportBestBuild[]
```

Add helpers:

```ts
function renderLoadout(loadout: SkillLoadout) {
  return Object.entries(loadout)
    .filter(([, skillId]) => Boolean(skillId))
    .map(([hotkey, skillId]) => `${hotkey}=${skillId}`)
    .join(', ') || 'empty'
}

function renderPassives(passiveTalentIds: readonly string[]) {
  return passiveTalentIds.length > 0 ? passiveTalentIds.join(', ') : 'none'
}

function renderBestBuildRow(entry: BalanceReportBestBuild) {
  return `| \`${entry.profileId}\` | \`${entry.profileTier}\` | \`${entry.buildId}\` | ${entry.victories}/${entry.attempts} | ${formatPercent(entry.passRate)} | ${renderLoadout(entry.loadout)} | ${renderPassives(entry.passiveTalentIds)} |`
}
```

In `renderBalanceReportMarkdown`, after automated label, push:

```ts
      `Scoring mode: \`${stage.scoringMode}\``,
      '',
      `Tested builds: ${stage.testedBuildCount}`,
      '',
      'Best builds:',
      '',
      '| Profile | Tier | Build | Clears | Pass rate | Loadout | Passives |',
      '| --- | --- | --- | ---: | ---: | --- | --- |',
      ...stage.bestBuildsByProfile.map(renderBestBuildRow),
      '',
```

- [ ] **Step 4: Update existing report test fixture**

In the existing fixture in `balanceReport.test.ts`, add:

```ts
          scoringMode: 'best_build_per_profile',
          testedBuildCount: 1,
          bestBuildsByProfile: [],
```

- [ ] **Step 5: Run report tests**

Run:

```powershell
npm test -- src/game/balance/balanceReport.test.ts
```

Expected: PASS.

---

### Task 4: Use Generated Builds In `analyze:balance`

**Files:**
- Modify: `scripts/analyzeBalance.mjs`
- Test through command: `npm run analyze:balance`

- [ ] **Step 1: Replace script build creation**

Modify imports in `scripts/analyzeBalance.mjs`.

Remove:

```js
  getStageBuildRuleId,
```

Remove from player build imports:

```js
  getDefaultPersistedBuildForRule,
  normalizePersistedBuildForRule,
```

Remove from stage imports:

```js
  getPassiveTalentUnlockTierForStage,
  getUnlockedActiveSkillIdsForStage,
```

Add:

```js
import { generateStageBalanceBuilds } from '../src/game/balance/balanceBuildGenerator.ts'
```

Delete the local `createBuildVariants(stage)` function.

- [ ] **Step 2: Pass generated builds into analysis**

In `buildReport`, before `runStageBalanceAnalysis`, add:

```js
    const builds = generateStageBalanceBuilds(stage, {
      maxActiveBuilds: 24,
      maxPassiveVariants: 8,
    })
```

Change the analysis call:

```js
      builds,
```

Change the returned stage report:

```js
      scoringMode: analysis.scoringMode,
      testedBuildCount: builds.length,
      bestBuildsByProfile: analysis.bestBuildsByProfile,
```

- [ ] **Step 3: Run generated report command**

Run:

```powershell
npm run analyze:balance
```

Expected: command exits 0, writes `reports/balance/latest.md`, and reports `Tested builds:` for each stage.

- [ ] **Step 4: Inspect generated markdown**

Run:

```powershell
Select-String -Path reports/balance/latest.md -Pattern "Scoring mode|Tested builds|Best builds|RingingDeeps-5"
```

Expected: output contains the scoring mode, tested build counts, best-build table headings, and RingingDeeps-5 section.

---

### Task 5: Optional Trace Support For Calibration

**Files:**
- Modify: `src/game/balance/balanceSimulator.ts`
- Test: `src/game/balance/balanceSimulator.test.ts`

- [ ] **Step 1: Write failing trace test**

Append to `src/game/balance/balanceSimulator.test.ts`:

```ts
  it('can collect a representative attempt trace without adding trace fields to scenario results', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'default',
      profile: noMistakeProfile,
      attempts: 1,
      maxDurationMs: 500,
      collectTrace: true,
    })

    expect(result.trace).toBeDefined()
    expect(result.trace?.events.length).toBeGreaterThan(0)
    expect(result).not.toHaveProperty('playerHpRatio')
    expect(result).not.toHaveProperty('partyPressureRatio')
  })
```

- [ ] **Step 2: Run simulator test to verify it fails**

Run:

```powershell
npm test -- src/game/balance/balanceSimulator.test.ts
```

Expected: FAIL because `collectTrace` and `trace` are not typed/implemented.

- [ ] **Step 3: Add trace types**

In `src/game/balance/balanceSimulator.ts`, add:

```ts
export interface BalanceTraceEvent {
  timeMs: number
  type: 'target-selected' | 'skill-activated' | 'decision-skipped' | 'result'
  message: string
}

export interface BalanceAttemptTrace {
  attemptIndex: number
  events: BalanceTraceEvent[]
}

export interface TraceableBalanceScenarioResult extends BalanceScenarioResult {
  trace?: BalanceAttemptTrace
}
```

Change return type:

```ts
export function runBalanceScenario(options: RunBalanceScenarioOptions): TraceableBalanceScenarioResult {
```

Add to `RunBalanceScenarioOptions`:

```ts
  collectTrace?: boolean
```

- [ ] **Step 4: Record minimal trace events**

Inside `runBalanceScenario`, before attempts loop:

```ts
  let trace: BalanceAttemptTrace | undefined
```

Inside each attempt:

```ts
    const traceEvents: BalanceTraceEvent[] = []
```

Before assigning the decision result:

```ts
        const beforeTargetId = state.player.currentTargetId
        const beforeCooldowns = new Map(state.skills.map((skill) => [skill.id, skill.remainingCooldownMs]))
        state = runAutomatedDecision(state, options.profile, random)
        if (options.collectTrace) {
          if (state.player.currentTargetId && state.player.currentTargetId !== beforeTargetId) {
            traceEvents.push({
              timeMs: state.timeMs,
              type: 'target-selected',
              message: `selected ${state.player.currentTargetId}`,
            })
          }
          const activatedSkill = state.skills.find((skill) =>
            skill.remainingCooldownMs > (beforeCooldowns.get(skill.id) ?? 0),
          )
          if (activatedSkill) {
            traceEvents.push({
              timeMs: state.timeMs,
              type: 'skill-activated',
              message: `activated ${activatedSkill.id}`,
            })
          }
        }
```

After the while loop:

```ts
    if (options.collectTrace && !trace) {
      traceEvents.push({
        timeMs: state.timeMs,
        type: 'result',
        message: state.result ? `${state.result.outcome}: ${state.result.reason}` : 'timeout',
      })
      trace = {
        attemptIndex,
        events: traceEvents.length > 0 ? traceEvents : [{
          timeMs: state.timeMs,
          type: 'result',
          message: state.result ? `${state.result.outcome}: ${state.result.reason}` : 'timeout',
        }],
      }
    }
```

Return:

```ts
  return {
    stageId: options.stage.id,
    profileId: options.profile.id,
    profileTier: options.profile.tier,
    buildId: options.buildId,
    attempts,
    victories,
    passRate: attempts > 0 ? victories / attempts : 0,
    ...(trace ? { trace } : {}),
  }
```

- [ ] **Step 5: Run simulator tests**

Run:

```powershell
npm test -- src/game/balance/balanceSimulator.test.ts
```

Expected: PASS.

---

### Task 6: Documentation And Final Verification

**Files:**
- Modify: `docs/balance/difficulty-scoring-system.md`
- Modify: `docs/balance/ringingdeeps-balance-report.md`
- Modify: `开发更新日志.md`
- Generated: `reports/balance/latest.md`
- Generated: `reports/balance/latest.json`

- [ ] **Step 1: Update balance scoring document**

In `docs/balance/difficulty-scoring-system.md`, add under "Scoring Inputs":

```md
Best-build scoring rule:

- RingingDeeps scoring assumes the player can eventually find the strongest legal build available for that tutorial stage.
- The report may test many legal builds, but the headline difficulty label uses best pass rates per operation profile/tier.
- Weak legal builds remain diagnostic data and do not reduce the stage label.
```

Update the "Current RingingDeeps Evaluation" intro to say:

```md
Generated from the current report sample: 12 attempts per profile/build candidate. Headline labels use the best legal build found for each operation profile.
```

- [ ] **Step 2: Update RingingDeeps report notes**

In `docs/balance/ringingdeeps-balance-report.md`, add to Method:

```md
- Generate legal build candidates for each stage and use the best-performing legal build per operation profile as the scoring basis.
- Keep weaker build rows in the report only as diagnostics.
```

- [ ] **Step 3: Update changelog**

At the top of `开发更新日志.md`, add:

```md
## 2026-05-23 Best-Build 自动难度评分

- RingingDeeps 自动难度评分改为 best-build 模式：每个操作档位按当前关卡可用的最强合法 build 通过率评估。
- 新增合法构筑候选生成器，报告展示测试 build 数量和每个操作档位的最佳 build。
- 保留弱 build 的原始通过率行作为诊断信息，但不让弱 build 拉低关卡评级。
- 行动 trace 仅用于解释自动模拟失败原因，不参与难度评级。
```

- [ ] **Step 4: Regenerate balance report**

Run:

```powershell
npm run analyze:balance
```

Expected: exit 0 and updated `reports/balance/latest.md` / `reports/balance/latest.json`.

- [ ] **Step 5: Run targeted tests**

Run:

```powershell
npm test -- src/game/balance/balanceBuildGenerator.test.ts src/game/balance/balanceSimulator.test.ts src/game/balance/balanceReport.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 6: Run full tests**

Run:

```powershell
npm test
```

Expected: all Vitest test files pass.

- [ ] **Step 7: Run production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite production build exit 0.

- [ ] **Step 8: Commit if repository metadata exists**

This workspace currently may not have `.git`. If `.git` exists, run:

```powershell
git status --short
git add src/game/balance scripts/analyzeBalance.mjs docs/balance reports/balance 开发更新日志.md
git commit -m "feat: score balance by best legal build"
```

Expected: commit succeeds. If `.git` is absent, skip commit and report that the workspace is not a Git repository.

---

## Self-Review

- Spec coverage: generator, best-build summary, report fields, trace, read-only report generation, docs, and verification are each covered by tasks.
- Placeholder scan: no task contains TBD/TODO/fill-later language.
- Type consistency: `BalanceBuildVariant`, `BalanceProfileTier`, `SkillLoadout`, and report best-build fields are consistently named across tasks.
- Scope check: plan avoids workbook mutation, UI screens, and large optimizer work; it stays focused on RingingDeeps best-build scoring.
