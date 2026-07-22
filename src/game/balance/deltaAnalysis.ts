import type { StageInfo } from '../data/stageTemplates'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  canUseTalentInRule,
  getDefaultPersistedBuildForRule,
  getPassiveTalentDefinition,
  normalizePersistedBuildForRule,
} from '../data/playerBuildCatalog'
import { getPassiveTalentUnlockTierForStage, getUnlockedActiveSkillIdsForStage } from '../data/stageTemplates'
import type { PassiveTalentId, PersistedBuildState, SkillLoadout } from '../encounter/encounterTypes'
import { generateStageBalanceBuilds } from './balanceBuildGenerator'
import {
  type BalanceBuildVariant,
  type BalanceOperationProfile,
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
  baseBuild?: PersistedBuildState
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

function getNormalizedDefaultBuild(stage: StageInfo) {
  const buildRuleId = getStageBuildRuleId(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)

  return normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule(buildRuleId, 'warrior_t'),
    buildRuleId, 'warrior_t',
    passiveTier,
    unlockedSkillIds,
    stage.unlockedActiveSkillIds,
  ).build
}

function resolveBaseBuild(stage: StageInfo, baseBuildId?: string): PersistedBuildState {
  if (!baseBuildId || baseBuildId === 'default' || baseBuildId === 'best') {
    return getNormalizedDefaultBuild(stage)
  }

  const generated = generateStageBalanceBuilds(stage, { maxActiveBuilds: 24, maxPassiveVariants: 8 })
  return generated.find((variant) => variant.id === baseBuildId)?.build ?? getNormalizedDefaultBuild(stage)
}

function resolveRequestedBaseBuild(stage: StageInfo, options: CreatePassiveDeltaVariantsOptions): PersistedBuildState {
  return options.baseBuild ? normalizeBuild(stage, options.baseBuild) : resolveBaseBuild(stage, options.baseBuildId)
}

function normalizeBuild(stage: StageInfo, build: PersistedBuildState) {
  const buildRuleId = getStageBuildRuleId(stage)
  return normalizePersistedBuildForRule(
    build,
    buildRuleId, 'warrior_t',
    getPassiveTalentUnlockTierForStage(stage),
    getUnlockedActiveSkillIdsForStage(stage),
    stage.unlockedActiveSkillIds,
  ).build
}

function legalTalentIds(stage: StageInfo, requested?: PassiveTalentId[]) {
  const buildRuleId = getStageBuildRuleId(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const source = requested && requested.length > 0 ? requested : FALLBACK_TALENTS
  return source.filter((talentId) => canUseTalentInRule(buildRuleId, 'warrior_t', talentId, passiveTier))
}

function talentLabel(talentIds: readonly PassiveTalentId[]) {
  if (talentIds.length === 0) {
    return 'no passives'
  }
  return talentIds
    .map((talentId) => getPassiveTalentDefinition(talentId)?.name ?? talentId)
    .join(' + ')
}

export function createPassiveDeltaVariants(
  stage: StageInfo,
  options: CreatePassiveDeltaVariantsOptions = {},
): DeltaVariant[] {
  const baseBuild = resolveRequestedBaseBuild(stage, options)
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
