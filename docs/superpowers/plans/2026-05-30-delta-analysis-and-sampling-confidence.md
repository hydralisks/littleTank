# Delta Analysis And Sampling Confidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `analyze:delta` workflow that compares targeted build/passive variants and reports pass-rate deltas with sampling confidence.

**Architecture:** Put pure confidence logic in `samplingConfidence.ts`, delta variant/scenario orchestration in `deltaAnalysis.ts`, markdown rendering in `deltaReport.ts`, and CLI/workbook loading in `scripts/analyzeDelta.mjs`. Reuse existing build normalization, stage loading, and `runStageBalanceAnalysis`; do not change AI strategy or designer data.

**Tech Stack:** TypeScript, Vitest, Node ESM scripts, existing balance simulator and workbook loader.

---

## File Map

- Create `src/game/balance/samplingConfidence.ts`: pure confidence and verdict helpers.
- Create `src/game/balance/samplingConfidence.test.ts`: threshold tests for confidence and verdict.
- Create `src/game/balance/deltaAnalysis.ts`: variant generation, baseline resolution, running delta scenarios, comparisons.
- Create `src/game/balance/deltaAnalysis.test.ts`: tests with lightweight fixtures and existing stage data.
- Create `src/game/balance/deltaReport.ts`: markdown rendering for delta reports.
- Create `src/game/balance/deltaReport.test.ts`: report rendering tests.
- Create `scripts/analyzeDelta.mjs`: CLI entry point and workbook loading.
- Modify `package.json`: add `analyze:delta` script.
- Do not modify `public/` or run designer workbook generation.

## Task 1: Sampling Confidence Pure Module

**Files:**
- Create: `src/game/balance/samplingConfidence.ts`
- Create: `src/game/balance/samplingConfidence.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/game/balance/samplingConfidence.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  classifyDeltaConfidence,
  classifyDeltaVerdict,
  createDeltaComparisonAssessment,
} from './samplingConfidence'

describe('sampling confidence', () => {
  it('marks small samples as low confidence even with visible deltas', () => {
    expect(classifyDeltaConfidence({
      attempts: 12,
      baselinePassRate: 0.5,
      comparedPassRate: 0.75,
      seedCount: 1,
    })).toBe('low')
  })

  it('marks standard samples with meaningful deltas as medium confidence', () => {
    expect(classifyDeltaConfidence({
      attempts: 30,
      baselinePassRate: 0.5,
      comparedPassRate: 0.7,
      seedCount: 1,
    })).toBe('medium')
  })

  it('marks full samples with meaningful deltas as high confidence', () => {
    expect(classifyDeltaConfidence({
      attempts: 100,
      baselinePassRate: 0.4,
      comparedPassRate: 0.65,
      seedCount: 1,
    })).toBe('high')
  })

  it('keeps both-near-zero comparisons low confidence unless the gap is large', () => {
    expect(classifyDeltaConfidence({
      attempts: 100,
      baselinePassRate: 0,
      comparedPassRate: 0.08,
      seedCount: 1,
    })).toBe('low')
  })

  it('classifies verdicts from delta and confidence', () => {
    expect(classifyDeltaVerdict({ passRateDelta: 0.3, confidence: 'medium' })).toBe('strong_gain')
    expect(classifyDeltaVerdict({ passRateDelta: 0.12, confidence: 'low' })).toBe('inconclusive')
    expect(classifyDeltaVerdict({ passRateDelta: 0.12, confidence: 'medium' })).toBe('minor_gain')
    expect(classifyDeltaVerdict({ passRateDelta: 0.03, confidence: 'high' })).toBe('neutral')
    expect(classifyDeltaVerdict({ passRateDelta: -0.2, confidence: 'medium' })).toBe('regression')
  })

  it('returns reasons alongside confidence and verdict', () => {
    const assessment = createDeltaComparisonAssessment({
      attempts: 30,
      seedCount: 1,
      baselinePassRate: 0.25,
      comparedPassRate: 0.55,
    })

    expect(assessment.confidence).toBe('medium')
    expect(assessment.verdict).toBe('strong_gain')
    expect(assessment.passRateDelta).toBeCloseTo(0.3)
    expect(assessment.relativeDelta).toBeCloseTo(1.2)
    expect(assessment.reasons.join('\n')).toContain('delta')
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/game/balance/samplingConfidence.test.ts
```

Expected: FAIL because `samplingConfidence.ts` does not exist.

- [ ] **Step 3: Implement confidence module**

Create `src/game/balance/samplingConfidence.ts`:

```ts
export type DeltaConfidence = 'low' | 'medium' | 'high'
export type DeltaVerdict = 'strong_gain' | 'minor_gain' | 'neutral' | 'regression' | 'inconclusive'

export interface DeltaConfidenceInput {
  attempts: number
  seedCount: number
  baselinePassRate: number
  comparedPassRate: number
}

export interface DeltaVerdictInput {
  passRateDelta: number
  confidence: DeltaConfidence
}

export interface DeltaComparisonAssessment {
  passRateDelta: number
  relativeDelta: number
  confidence: DeltaConfidence
  verdict: DeltaVerdict
  reasons: string[]
}

function absoluteDelta(input: Pick<DeltaConfidenceInput, 'baselinePassRate' | 'comparedPassRate'>) {
  return Math.abs(input.comparedPassRate - input.baselinePassRate)
}

export function classifyDeltaConfidence(input: DeltaConfidenceInput): DeltaConfidence {
  const attempts = Math.max(0, Math.floor(input.attempts))
  const delta = absoluteDelta(input)
  const bothNearZero = input.baselinePassRate < 0.1 && input.comparedPassRate < 0.1

  if (bothNearZero && delta < 0.25) {
    return 'low'
  }

  if (attempts < 30 || delta < 0.1) {
    return 'low'
  }

  if (input.baselinePassRate === 0 && input.comparedPassRate > 0 && attempts < 100) {
    return 'medium'
  }

  if (attempts >= 100 && delta >= 0.15) {
    return 'high'
  }

  if (attempts >= 30 && delta >= 0.15) {
    return 'medium'
  }

  return 'low'
}

export function classifyDeltaVerdict(input: DeltaVerdictInput): DeltaVerdict {
  if (input.passRateDelta <= -0.1) {
    return 'regression'
  }
  if (input.confidence === 'low' && Math.abs(input.passRateDelta) < 0.15) {
    return 'inconclusive'
  }
  if (input.passRateDelta >= 0.25 && input.confidence !== 'low') {
    return 'strong_gain'
  }
  if (input.passRateDelta >= 0.1) {
    return 'minor_gain'
  }
  if (Math.abs(input.passRateDelta) < 0.1) {
    return 'neutral'
  }
  return 'inconclusive'
}

export function createDeltaComparisonAssessment(input: DeltaConfidenceInput): DeltaComparisonAssessment {
  const passRateDelta = input.comparedPassRate - input.baselinePassRate
  const relativeDelta = input.baselinePassRate > 0
    ? passRateDelta / input.baselinePassRate
    : input.comparedPassRate > 0
      ? Number.POSITIVE_INFINITY
      : 0
  const confidence = classifyDeltaConfidence(input)
  const verdict = classifyDeltaVerdict({ passRateDelta, confidence })
  const reasons = [
    `delta ${Math.round(passRateDelta * 100)} percentage points`,
    `attempts ${Math.max(0, Math.floor(input.attempts))}`,
    `seed count ${Math.max(1, Math.floor(input.seedCount || 1))}`,
    `confidence ${confidence}`,
  ]

  return {
    passRateDelta,
    relativeDelta,
    confidence,
    verdict,
    reasons,
  }
}
```

- [ ] **Step 4: Verify sampling tests pass**

Run:

```bash
npm test -- src/game/balance/samplingConfidence.test.ts
```

Expected: PASS.

## Task 2: Delta Analysis Core

**Files:**
- Create: `src/game/balance/deltaAnalysis.ts`
- Create: `src/game/balance/deltaAnalysis.test.ts`

- [ ] **Step 1: Write failing delta core tests**

Create `src/game/balance/deltaAnalysis.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides } from '../data/encounterTemplates'
import { applyEnemyWorkbookOverrides } from '../data/enemyCatalog'
import { applyPlayerBuildWorkbookOverrides } from '../data/playerBuildCatalog'
import { applyStageWorkbookOverrides, getStageById } from '../data/stageTemplates'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../data/workbookLoader'
import {
  createPassiveDeltaVariants,
  runStageDeltaAnalysis,
} from './deltaAnalysis'

beforeAll(() => {
  applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
  applyEnemyWorkbookOverrides(parseEnemyWorkbook(XLSX.readFile('public/designer-data/enemy_data.xlsx')))
  applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
})

describe('delta analysis', () => {
  it('creates passive variants while preserving active loadout', () => {
    const stage = getStageById('WestFall-2')
    const variants = createPassiveDeltaVariants(stage, {
      baseBuildId: 'default',
      talentIds: ['warrior_t_raise_banner', 'warrior_t_barbaric_training', 'warrior_t_focused_vigor'],
      includePairs: true,
    })

    const baseline = variants.find((variant) => variant.kind === 'baseline')
    expect(baseline).toBeTruthy()
    expect(variants.some((variant) => variant.id.includes('warrior_t_raise_banner'))).toBe(true)
    expect(variants.some((variant) => variant.id.includes('warrior_t_barbaric_training'))).toBe(true)
    expect(variants.some((variant) => variant.id.includes('warrior_t_focused_vigor'))).toBe(true)
    expect(variants.some((variant) => variant.id.includes('warrior_t_raise_banner+warrior_t_barbaric_training'))).toBe(true)
    expect(new Set(variants.map((variant) => JSON.stringify(variant.build.loadout))).size).toBe(1)
  })

  it('runs a small passive delta analysis with confidence and comparisons', () => {
    const stage = getStageById('WestFall-2')
    const result = runStageDeltaAnalysis({
      stage,
      type: 'passive',
      baseBuildId: 'default',
      talentIds: ['warrior_t_raise_banner', 'warrior_t_barbaric_training'],
      includePairs: true,
      attemptsPerScenario: 1,
      seedCount: 1,
      profile: {
        id: 'delta-test-profile',
        tier: 'average',
        reactionDelayMs: 250,
        mistakeRate: 0,
        decisionIntervalMs: 150,
        preserveKeyStopSkills: true,
        evaluateEnemySkillImpact: true,
        preferControlForChanneling: true,
      },
      maxDurationMs: 20_000,
    })

    expect(result.stageId).toBe('WestFall-2')
    expect(result.scenarios.length).toBeGreaterThan(1)
    expect(result.comparisons.length).toBe(result.scenarios.length - 1)
    expect(result.comparisons.every((comparison) => comparison.confidence)).toBe(true)
    expect(result.comparisons.every((comparison) => comparison.verdict)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/game/balance/deltaAnalysis.test.ts
```

Expected: FAIL because `deltaAnalysis.ts` does not exist.

- [ ] **Step 3: Implement delta core**

Create `src/game/balance/deltaAnalysis.ts` with this structure:

```ts
import type { StageInfo } from '../data/stageTemplates'
import {
  canUseTalentInRule,
  getDefaultPersistedBuildForRule,
  getPassiveTalentDefinition,
  normalizePersistedBuildForRule,
} from '../data/playerBuildCatalog'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import { getPassiveTalentUnlockTierForStage, getUnlockedActiveSkillIdsForStage } from '../data/stageTemplates'
import type { PassiveTalentId, PersistedBuildState, SkillLoadout } from '../encounter/encounterTypes'
import {
  type BalanceOperationProfile,
  type BalanceBuildVariant,
  generateStageBalanceBuilds,
  runStageBalanceAnalysis,
} from './balanceSimulator'
import {
  createDeltaComparisonAssessment,
  type DeltaConfidence,
  type DeltaVerdict,
} from './samplingConfidence'

export type DeltaAnalysisType = 'passive' | 'build'

export interface DeltaVariant {
  id: string
  label: string
  kind: 'baseline' | 'add_passive' | 'passive_combo' | 'custom_build'
  build: PersistedBuildState
}

export interface DeltaScenarioResult {
  stageId: string
  baselineVariantId: string
  variantId: string
  variantLabel: string
  variantKind: DeltaVariant['kind']
  attempts: number
  victories: number
  passRate: number
  seedCount: number
  passiveTalentIds: PassiveTalentId[]
  loadout: SkillLoadout
}

export interface DeltaComparison {
  stageId: string
  baselineVariantId: string
  comparedVariantId: string
  comparedVariantLabel: string
  baselinePassRate: number
  comparedPassRate: number
  passRateDelta: number
  relativeDelta: number
  confidence: DeltaConfidence
  verdict: DeltaVerdict
  reasons: string[]
}

export interface StageDeltaAnalysis {
  stageId: string
  title: string
  analysisType: DeltaAnalysisType
  baselineVariantId: string
  scenarios: DeltaScenarioResult[]
  comparisons: DeltaComparison[]
}

export interface CreatePassiveDeltaVariantsOptions {
  baseBuildId?: string
  talentIds?: PassiveTalentId[]
  includePairs?: boolean
}

export interface RunStageDeltaAnalysisOptions extends CreatePassiveDeltaVariantsOptions {
  stage: StageInfo
  type: DeltaAnalysisType
  profile: BalanceOperationProfile
  attemptsPerScenario: number
  seedCount: number
  maxDurationMs: number
}

const FALLBACK_TALENTS: PassiveTalentId[] = [
  'warrior_t_raise_banner',
  'warrior_t_barbaric_training',
  'warrior_t_focused_vigor',
  'warrior_t_bloodsurge',
  'warrior_t_snap_interrupt',
  'warrior_t_defenders_aegis',
  'warrior_t_reinforced_plates',
  'warrior_t_defensive_stance',
]

function buildSignature(build: PersistedBuildState) {
  const loadoutPart = Object.entries(build.loadout)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([hotkey, skillId]) => `${hotkey}=${skillId ?? ''}`)
    .join(';')
  const passivePart = build.passiveTalentIds.slice().sort((left, right) => left.localeCompare(right)).join(',')
  return `${loadoutPart}|${passivePart}`
}

function resolveBaseBuild(stage: StageInfo, baseBuildId?: string): PersistedBuildState {
  const buildRuleId = getStageBuildRuleId(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
  if (!baseBuildId || baseBuildId === 'default' || baseBuildId === 'best') {
    return normalizePersistedBuildForRule(
      getDefaultPersistedBuildForRule(buildRuleId),
      buildRuleId,
      passiveTier,
      unlockedSkillIds,
      stage.unlockedActiveSkillIds,
    ).build
  }

  const generated = generateStageBalanceBuilds(stage, { maxActiveBuilds: 24, maxPassiveVariants: 8 })
  return generated.find((variant) => variant.id === baseBuildId)?.build ?? normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule(buildRuleId),
    buildRuleId,
    passiveTier,
    unlockedSkillIds,
    stage.unlockedActiveSkillIds,
  ).build
}

function normalizeBuild(stage: StageInfo, build: PersistedBuildState) {
  const buildRuleId = getStageBuildRuleId(stage)
  return normalizePersistedBuildForRule(
    build,
    buildRuleId,
    getPassiveTalentUnlockTierForStage(stage),
    getUnlockedActiveSkillIdsForStage(stage),
    stage.unlockedActiveSkillIds,
  ).build
}

function legalTalentIds(stage: StageInfo, requested?: PassiveTalentId[]) {
  const buildRuleId = getStageBuildRuleId(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const source = requested && requested.length > 0 ? requested : FALLBACK_TALENTS
  return source.filter((talentId) => canUseTalentInRule(buildRuleId, talentId, passiveTier))
}

function talentLabel(talentIds: readonly PassiveTalentId[]) {
  if (talentIds.length === 0) {
    return 'no passives'
  }
  return talentIds
    .map((talentId) => getPassiveTalentDefinition(talentId)?.name ?? talentId)
    .join(' + ')
}

export function createPassiveDeltaVariants(stage: StageInfo, options: CreatePassiveDeltaVariantsOptions = {}): DeltaVariant[] {
  const baseBuild = resolveBaseBuild(stage, options.baseBuildId)
  const activeOnlyBase = normalizeBuild(stage, {
    loadout: baseBuild.loadout,
    passiveTalentIds: [],
  })
  const talentIds = legalTalentIds(stage, options.talentIds)
  const variants: DeltaVariant[] = [
    {
      id: 'baseline_no_passives',
      label: 'No passives',
      kind: 'baseline',
      build: activeOnlyBase,
    },
  ]

  for (const talentId of talentIds) {
    const build = normalizeBuild(stage, {
      loadout: activeOnlyBase.loadout,
      passiveTalentIds: [talentId],
    })
    if (build.passiveTalentIds.includes(talentId)) {
      variants.push({
        id: `passive_${talentId}`,
        label: talentLabel([talentId]),
        kind: 'add_passive',
        build,
      })
    }
  }

  if (options.includePairs ?? true) {
    for (let left = 0; left < talentIds.length; left += 1) {
      for (let right = left + 1; right < talentIds.length; right += 1) {
        const pair = [talentIds[left], talentIds[right]]
        const build = normalizeBuild(stage, {
          loadout: activeOnlyBase.loadout,
          passiveTalentIds: pair,
        })
        if (pair.every((talentId) => build.passiveTalentIds.includes(talentId))) {
          variants.push({
            id: `passive_${pair.join('+')}`,
            label: talentLabel(pair),
            kind: 'passive_combo',
            build,
          })
        }
      }
    }
  }

  const seen = new Set<string>()
  return variants.filter((variant) => {
    const signature = buildSignature(variant.build)
    if (seen.has(signature)) {
      return false
    }
    seen.add(signature)
    return true
  })
}

function toBuildVariants(variants: readonly DeltaVariant[]): BalanceBuildVariant[] {
  return variants.map((variant) => ({
    id: variant.id,
    build: variant.build,
  }))
}

export function runStageDeltaAnalysis(options: RunStageDeltaAnalysisOptions): StageDeltaAnalysis {
  const variants = createPassiveDeltaVariants(options.stage, options)
  const analysis = runStageBalanceAnalysis({
    stage: options.stage,
    builds: toBuildVariants(variants),
    profiles: [options.profile],
    attemptsPerScenario: options.attemptsPerScenario,
    maxDurationMs: options.maxDurationMs,
  })
  const variantById = new Map(variants.map((variant) => [variant.id, variant] as const))
  const baseline = variants.find((variant) => variant.kind === 'baseline') ?? variants[0]
  const baselineScenario = analysis.scenarios.find((scenario) => scenario.buildId === baseline.id)
  if (!baselineScenario) {
    throw new Error(`Missing baseline scenario for ${baseline.id}`)
  }

  const scenarios = analysis.scenarios.map((scenario) => {
    const variant = variantById.get(scenario.buildId)
    if (!variant) {
      throw new Error(`Missing delta variant for ${scenario.buildId}`)
    }
    return {
      stageId: scenario.stageId,
      baselineVariantId: baseline.id,
      variantId: variant.id,
      variantLabel: variant.label,
      variantKind: variant.kind,
      attempts: scenario.attempts,
      victories: scenario.victories,
      passRate: scenario.passRate,
      seedCount: Math.max(1, Math.floor(options.seedCount)),
      passiveTalentIds: [...variant.build.passiveTalentIds],
      loadout: { ...variant.build.loadout },
    }
  })

  const comparisons = scenarios
    .filter((scenario) => scenario.variantId !== baseline.id)
    .map((scenario) => {
      const assessment = createDeltaComparisonAssessment({
        attempts: scenario.attempts,
        seedCount: scenario.seedCount,
        baselinePassRate: baselineScenario.passRate,
        comparedPassRate: scenario.passRate,
      })
      return {
        stageId: scenario.stageId,
        baselineVariantId: baseline.id,
        comparedVariantId: scenario.variantId,
        comparedVariantLabel: scenario.variantLabel,
        baselinePassRate: baselineScenario.passRate,
        comparedPassRate: scenario.passRate,
        passRateDelta: assessment.passRateDelta,
        relativeDelta: assessment.relativeDelta,
        confidence: assessment.confidence,
        verdict: assessment.verdict,
        reasons: assessment.reasons,
      }
    })

  return {
    stageId: options.stage.id,
    title: options.stage.title,
    analysisType: options.type,
    baselineVariantId: baseline.id,
    scenarios,
    comparisons,
  }
}
```

- [ ] **Step 4: Run delta core tests**

Run:

```bash
npm test -- src/game/balance/deltaAnalysis.test.ts
```

Expected: PASS.

## Task 3: Delta Report Renderer

**Files:**
- Create: `src/game/balance/deltaReport.ts`
- Create: `src/game/balance/deltaReport.test.ts`

- [ ] **Step 1: Write failing report tests**

Create `src/game/balance/deltaReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { renderDeltaReportMarkdown } from './deltaReport'
import type { StageDeltaAnalysis } from './deltaAnalysis'

describe('delta report renderer', () => {
  it('renders confidence, verdict, and follow-up guidance', () => {
    const report = renderDeltaReportMarkdown({
      generatedAt: '2026-05-30T00:00:00.000Z',
      stages: [
        {
          stageId: 'WestFall-2',
          title: 'Sentinel Hill',
          analysisType: 'passive',
          baselineVariantId: 'baseline_no_passives',
          scenarios: [
            {
              stageId: 'WestFall-2',
              baselineVariantId: 'baseline_no_passives',
              variantId: 'baseline_no_passives',
              variantLabel: 'No passives',
              variantKind: 'baseline',
              attempts: 12,
              victories: 6,
              passRate: 0.5,
              seedCount: 1,
              passiveTalentIds: [],
              loadout: { '1': 'warrior_t_interrupt', '2': null, '3': null, '4': null, Q: null, E: null, R: null, F: null },
            },
          ],
          comparisons: [
            {
              stageId: 'WestFall-2',
              baselineVariantId: 'baseline_no_passives',
              comparedVariantId: 'passive_warrior_t_barbaric_training',
              comparedVariantLabel: '野蛮训练',
              baselinePassRate: 0.5,
              comparedPassRate: 0.75,
              passRateDelta: 0.25,
              relativeDelta: 0.5,
              confidence: 'low',
              verdict: 'minor_gain',
              reasons: ['delta 25 percentage points'],
            },
          ],
        } satisfies StageDeltaAnalysis,
      ],
    })

    expect(report).toContain('# Delta Analysis')
    expect(report).toContain('WestFall-2')
    expect(report).toContain('野蛮训练')
    expect(report).toContain('low')
    expect(report).toContain('minor_gain')
    expect(report).toContain('Needs rerun')
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/game/balance/deltaReport.test.ts
```

Expected: FAIL because `deltaReport.ts` does not exist.

- [ ] **Step 3: Implement renderer**

Create `src/game/balance/deltaReport.ts`:

```ts
import type { StageDeltaAnalysis } from './deltaAnalysis'

export interface DeltaReport {
  generatedAt: string
  stages: StageDeltaAnalysis[]
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 'n/a'
  }
  return `${Math.round(value * 100)}%`
}

function renderLoadout(loadout: StageDeltaAnalysis['scenarios'][number]['loadout']) {
  return Object.entries(loadout)
    .flatMap(([hotkey, skillId]) => skillId ? [`${hotkey}=${skillId}`] : [])
    .join(', ') || 'none'
}

function renderPassives(passiveTalentIds: readonly string[]) {
  return passiveTalentIds.length > 0 ? passiveTalentIds.join(', ') : 'none'
}

export function renderDeltaReportMarkdown(report: DeltaReport) {
  const lines = [
    '# Delta Analysis',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    'This report is read-only. It compares targeted build variants with the existing simulator and does not modify designer workbooks.',
    '',
    '## Summary',
    '',
    '| Stage | Baseline | Strong gains | Low-confidence items |',
    '| --- | --- | --- | --- |',
    ...report.stages.map((stage) => {
      const strong = stage.comparisons
        .filter((comparison) => comparison.verdict === 'strong_gain')
        .map((comparison) => comparison.comparedVariantLabel)
      const low = stage.comparisons
        .filter((comparison) => comparison.confidence === 'low')
        .map((comparison) => comparison.comparedVariantLabel)
      return `| \`${stage.stageId}\` | \`${stage.baselineVariantId}\` | ${strong.join(', ') || 'none'} | ${low.join(', ') || 'none'} |`
    }),
    '',
  ]

  for (const stage of report.stages) {
    lines.push(
      `## ${stage.stageId} - ${stage.title}`,
      '',
      `Analysis type: \`${stage.analysisType}\``,
      '',
      '| Variant | Pass rate | Delta | Relative delta | Confidence | Verdict | Reasons |',
      '| --- | ---: | ---: | ---: | --- | --- | --- |',
      ...stage.comparisons.map((comparison) => `| ${comparison.comparedVariantLabel} | ${formatPercent(comparison.comparedPassRate)} | ${formatPercent(comparison.passRateDelta)} | ${formatPercent(comparison.relativeDelta)} | \`${comparison.confidence}\` | \`${comparison.verdict}\` | ${comparison.reasons.join('<br>')} |`),
      '',
      '### Variants',
      '',
      '| Variant | Kind | Attempts | Victories | Pass rate | Passives | Loadout |',
      '| --- | --- | ---: | ---: | ---: | --- | --- |',
      ...stage.scenarios.map((scenario) => `| \`${scenario.variantId}\` | \`${scenario.variantKind}\` | ${scenario.attempts} | ${scenario.victories} | ${formatPercent(scenario.passRate)} | ${renderPassives(scenario.passiveTalentIds)} | ${renderLoadout(scenario.loadout)} |`),
      '',
    )

    const needsRerun = stage.comparisons.filter((comparison) => comparison.confidence === 'low')
    if (needsRerun.length > 0) {
      lines.push(
        '### Needs rerun',
        '',
        ...needsRerun.map((comparison) => `- ${comparison.comparedVariantLabel}: rerun with \`--sample=standard\` or \`--sample=full\` before treating this as a tuning recommendation.`),
        '',
      )
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}
```

- [ ] **Step 4: Run report tests**

Run:

```bash
npm test -- src/game/balance/deltaReport.test.ts
```

Expected: PASS.

## Task 4: CLI Script And Package Script

**Files:**
- Create: `scripts/analyzeDelta.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add package script**

Modify `package.json` scripts:

```json
"analyze:delta": "node --experimental-strip-types --loader ./scripts/ts-extension-loader.mjs scripts/analyzeDelta.mjs"
```

- [ ] **Step 2: Create CLI script**

Create `scripts/analyzeDelta.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides } from '../src/game/data/encounterTemplates.ts'
import { applyEnemyWorkbookOverrides } from '../src/game/data/enemyCatalog.ts'
import { applyStageWorkbookOverrides, getStageById } from '../src/game/data/stageTemplates.ts'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../src/game/data/workbookLoader.ts'
import { applyPlayerBuildWorkbookOverrides } from '../src/game/data/playerBuildCatalog.ts'
import { runStageDeltaAnalysis } from '../src/game/balance/deltaAnalysis.ts'
import { renderDeltaReportMarkdown } from '../src/game/balance/deltaReport.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')
const outputDir = path.join(projectRoot, 'reports', 'balance')

const SAMPLE_CONFIG = {
  quick: { attempts: 12, seeds: 1 },
  standard: { attempts: 30, seeds: 1 },
  full: { attempts: 100, seeds: 1 },
}

const LEARNING_PROFILE = {
  id: 'delta-learning-220ms-low-error',
  tier: 'average',
  reactionDelayMs: 220,
  reactionDelayJitterMs: 70,
  reactionDelayFastChance: 0.12,
  reactionDelayFastMs: 120,
  mistakeRate: 0.015,
  forgetSkillRate: 0.004,
  wrongTargetRate: 0.006,
  prioritySlipRate: 0.005,
  decisionIntervalMs: 140,
  endCastStopWindowMs: 850,
  preserveKeyStopSkills: true,
  evaluateEnemySkillImpact: true,
  preferControlForChanneling: true,
  targetPriorityMode: 'kill_high_impact',
  irregularThreatPolicy: 'allow_leak_when_tank_pressure_high',
  minimumTargetStickMs: 1200,
  preemptiveDefenseHorizonMs: 3500,
}

function parseCliOptions(args) {
  const options = {
    stages: [],
    type: 'passive',
    baseBuild: 'best',
    talents: [],
    sample: 'quick',
    attempts: null,
    seeds: null,
  }

  for (const arg of args) {
    if (arg.startsWith('--stages=')) {
      options.stages = arg.slice('--stages='.length).split(',').map((stageId) => stageId.trim()).filter(Boolean)
    } else if (arg.startsWith('--type=')) {
      const type = arg.slice('--type='.length).trim()
      if (type === 'passive' || type === 'build') {
        options.type = type
      }
    } else if (arg.startsWith('--baseBuild=')) {
      options.baseBuild = arg.slice('--baseBuild='.length).trim()
    } else if (arg.startsWith('--talents=')) {
      options.talents = arg.slice('--talents='.length).split(',').map((talentId) => talentId.trim()).filter(Boolean)
    } else if (arg.startsWith('--sample=')) {
      const sample = arg.slice('--sample='.length).trim()
      if (sample in SAMPLE_CONFIG) {
        options.sample = sample
      }
    } else if (arg.startsWith('--attempts=')) {
      options.attempts = Number(arg.slice('--attempts='.length))
    } else if (arg.startsWith('--seeds=')) {
      options.seeds = Number(arg.slice('--seeds='.length))
    }
  }

  return options
}

function readWorkbook(fileName) {
  return XLSX.readFile(path.join(designerDataDir, fileName))
}

function loadDesignerDataIntoCatalogs() {
  applyStageWorkbookOverrides(parseStageWorkbook(readWorkbook('stage_content.xlsx')))
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(readWorkbook('encounter_balance.xlsx')))
  applyEnemyWorkbookOverrides(parseEnemyWorkbook(readWorkbook('enemy_data.xlsx')))
  applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(readWorkbook('player_build.xlsx')))
}

const options = parseCliOptions(process.argv.slice(2))
if (options.stages.length === 0) {
  throw new Error('Usage: npm run analyze:delta -- --stages=WestFall-2,WestFall-3 [--type=passive]')
}

loadDesignerDataIntoCatalogs()

const sample = SAMPLE_CONFIG[options.sample]
const attempts = Number.isFinite(options.attempts) && options.attempts > 0 ? Math.floor(options.attempts) : sample.attempts
const seeds = Number.isFinite(options.seeds) && options.seeds > 0 ? Math.floor(options.seeds) : sample.seeds
const stages = options.stages.map((stageId) => {
  const stage = getStageById(stageId)
  if (!stage) {
    throw new Error(`Missing stage: ${stageId}`)
  }
  console.log(`[delta] ${stageId}: start`)
  const analysis = runStageDeltaAnalysis({
    stage,
    type: options.type,
    baseBuildId: options.baseBuild,
    talentIds: options.talents,
    includePairs: true,
    profile: LEARNING_PROFILE,
    attemptsPerScenario: attempts,
    seedCount: seeds,
    maxDurationMs: 120_000,
  })
  console.log(`[delta] ${stageId}: done comparisons=${analysis.comparisons.length}`)
  return analysis
})

const report = {
  generatedAt: new Date().toISOString(),
  stages,
}

fs.mkdirSync(outputDir, { recursive: true })
const jsonPath = path.join(outputDir, 'delta-analysis.json')
const markdownPath = path.join(outputDir, 'delta-analysis.md')
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8')
fs.writeFileSync(markdownPath, renderDeltaReportMarkdown(report), 'utf8')
console.log(`[delta] wrote ${markdownPath}`)
console.log(`[delta] wrote ${jsonPath}`)
```

- [ ] **Step 3: Run focused CLI command**

Run:

```bash
npm run analyze:delta -- --stages=WestFall-2,WestFall-3 --type=passive --sample=quick
```

Expected:

- Exit code 0.
- `reports/balance/delta-analysis.md` exists.
- `reports/balance/delta-analysis.json` exists.
- Console logs show both stages completed.

## Task 5: Verification And Documentation Update

**Files:**
- Modify: `docs/balance/difficulty-scoring-system.md`

- [ ] **Step 1: Add short docs section**

Append a new section to `docs/balance/difficulty-scoring-system.md`:

```md
## Delta Analysis

`npm run analyze:delta` is a read-only companion to `npm run analyze:balance`.

- `analyze:balance` answers stage-level difficulty.
- `analyze:delta` compares targeted build variants and reports pass-rate deltas, confidence, and verdicts.
- Quick delta samples are screening signals. Results marked `low` confidence should be rerun with `--sample=standard` or `--sample=full` before becoming tuning recommendations.

Example:

```bash
npm run analyze:delta -- --stages=WestFall-2,WestFall-3 --type=passive --sample=quick
```

Outputs:

- `reports/balance/delta-analysis.md`
- `reports/balance/delta-analysis.json`
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/game/balance/samplingConfidence.test.ts src/game/balance/deltaAnalysis.test.ts src/game/balance/deltaReport.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Verify no public designer data changed**

Run:

```powershell
Get-ChildItem -LiteralPath public\designer-data -Force | Select-Object Name,Length,LastWriteTime
```

Expected: read-only verification only. Do not run workbook generators.

## Self-Review

- Spec coverage: CLI, confidence rules, passive variants, report output, no-public-write constraint, and tests are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `DeltaConfidence`, `DeltaVerdict`, `DeltaVariant`, `StageDeltaAnalysis`, and renderer inputs are consistently named.
- Known limitation: `--area` and true multi-seed injection are in the design spec but not v1 implementation tasks. The CLI accepts only `--stages` in this plan so the first implementation stays small and testable.
