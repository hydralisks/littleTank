import type { StageInfo } from '../data/stageTemplates'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  canUseTalentInRule,
  getActiveSkillDefinition,
  getDefaultPersistedBuildForRule,
  getPassiveTalentCatalog,
  getPassiveTalentDefinition,
  normalizePersistedBuildForRule,
} from '../data/playerBuildCatalog'
import { getPassiveTalentUnlockTierForStage, getUnlockedActiveSkillIdsForStage } from '../data/stageTemplates'
import type {
  PassiveTalentId,
  PersistedBuildState,
  PlayerClassId,
  SkillId,
  SkillLoadout,
} from '../encounter/encounterTypes'
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

export type DeltaAnalysisType = 'passive' | 'active' | 'build'

export interface DeltaVariant {
  id: string
  classId: PlayerClassId
  label: string
  kind: 'baseline' | 'add_passive' | 'passive_combo' | 'active_candidate' | 'custom_build'
  build: PersistedBuildState
}

export interface DeltaScenarioResult {
  stageId: string
  classId: PlayerClassId
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
  classId: PlayerClassId
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
  activeSkillId?: SkillId
  baselineLoadout?: SkillLoadout
  comparedLoadout?: SkillLoadout
}

export interface StageDeltaAnalysis {
  stageId: string
  classId: PlayerClassId
  buildRuleId: string
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
  classId: PlayerClassId
  type: DeltaAnalysisType
  profile: BalanceOperationProfile
  attemptsPerScenario: number
  seedCount: number
  maxDurationMs: number
}

function buildSignature(build: PersistedBuildState) {
  const loadoutPart = Object.entries(build.loadout)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([hotkey, skillId]) => `${hotkey}=${skillId ?? ''}`)
    .join(';')
  const passivePart = build.passiveTalentIds.slice().sort((left, right) => left.localeCompare(right)).join(',')
  return `${loadoutPart}|${passivePart}`
}

function getNormalizedDefaultBuild(stage: StageInfo, classId: PlayerClassId) {
  const buildRuleId = getStageBuildRuleId(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)

  return normalizePersistedBuildForRule(
    getDefaultPersistedBuildForRule(buildRuleId, classId),
    buildRuleId, classId,
    passiveTier,
    unlockedSkillIds,
    stage.unlockedActiveSkillIds,
  ).build
}

function resolveBaseBuild(stage: StageInfo, classId: PlayerClassId, baseBuildId?: string): PersistedBuildState {
  if (!baseBuildId || baseBuildId === 'default' || baseBuildId === 'best') {
    return getNormalizedDefaultBuild(stage, classId)
  }

  const generated = generateStageBalanceBuilds(stage, classId, { maxActiveBuilds: 24, maxPassiveVariants: 8 })
  return generated.find((variant) => variant.id === baseBuildId)?.build ?? getNormalizedDefaultBuild(stage, classId)
}

function resolveRequestedBaseBuild(
  stage: StageInfo,
  classId: PlayerClassId,
  options: CreatePassiveDeltaVariantsOptions,
): PersistedBuildState {
  return options.baseBuild
    ? normalizeBuild(stage, classId, options.baseBuild)
    : resolveBaseBuild(stage, classId, options.baseBuildId)
}

function normalizeBuild(stage: StageInfo, classId: PlayerClassId, build: PersistedBuildState) {
  const buildRuleId = getStageBuildRuleId(stage)
  return normalizePersistedBuildForRule(
    build,
    buildRuleId, classId,
    getPassiveTalentUnlockTierForStage(stage),
    getUnlockedActiveSkillIdsForStage(stage),
    stage.unlockedActiveSkillIds,
  ).build
}

function legalTalentIds(stage: StageInfo, classId: PlayerClassId, requested?: PassiveTalentId[]) {
  const buildRuleId = getStageBuildRuleId(stage)
  const passiveTier = getPassiveTalentUnlockTierForStage(stage)
  const source = requested && requested.length > 0
    ? requested
    : getPassiveTalentCatalog()
      .filter((talent) => talent.classId === classId && talent.enabled)
      .map((talent) => talent.id)
  return source.filter((talentId) => canUseTalentInRule(buildRuleId, classId, talentId, passiveTier))
}

function getLegalActiveSkillIds(stage: StageInfo, classId: PlayerClassId) {
  return getUnlockedActiveSkillIdsForStage(stage)
    .filter((skillId): skillId is SkillId => getActiveSkillDefinition(skillId)?.classId === classId)
}

export function selectBestActiveSkillPresenceScenarios(
  scenarios: readonly DeltaScenarioResult[],
  skillId: SkillId,
) {
  const bestMatching = (includesSkill: boolean) => scenarios
    .filter((scenario) => Object.values(scenario.loadout).includes(skillId) === includesSkill)
    .sort((left, right) => right.passRate - left.passRate || left.variantId.localeCompare(right.variantId))[0]

  return {
    containing: bestMatching(true),
    excluding: bestMatching(false),
  }
}

export function createActiveDeltaVariants(stage: StageInfo, classId: PlayerClassId): DeltaVariant[] {
  return generateStageBalanceBuilds(stage, classId, {
    maxActiveBuilds: 96,
    maxPassiveVariants: 1,
  }).map((variant) => ({
    id: `active_${variant.id}`,
    classId,
    label: variant.id === 'default' ? 'Default active build' : variant.id,
    kind: 'active_candidate' as const,
    build: {
      loadout: { ...variant.build.loadout },
      passiveTalentIds: [],
    },
  }))
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
  classId: PlayerClassId,
  options: CreatePassiveDeltaVariantsOptions = {},
): DeltaVariant[] {
  const baseBuild = resolveRequestedBaseBuild(stage, classId, options)
  const activeOnlyBase = normalizeBuild(stage, classId, {
    loadout: baseBuild.loadout,
    passiveTalentIds: [],
  })
  const talentIds = legalTalentIds(stage, classId, options.talentIds)
  const variants: DeltaVariant[] = [
    {
      id: 'baseline_no_passives',
      classId,
      label: 'No passives',
      kind: 'baseline',
      build: activeOnlyBase,
    },
  ]

  for (const talentId of talentIds) {
    const build = normalizeBuild(stage, classId, {
      loadout: activeOnlyBase.loadout,
      passiveTalentIds: [talentId],
    })
    if (build.passiveTalentIds.includes(talentId)) {
      variants.push({
        id: `passive_${talentId}`,
        classId,
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
        const build = normalizeBuild(stage, classId, {
          loadout: activeOnlyBase.loadout,
          passiveTalentIds: pair,
        })
        if (pair.every((talentId) => build.passiveTalentIds.includes(talentId))) {
          variants.push({
            id: `passive_${pair.join('+')}`,
            classId,
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
    classId: variant.classId,
    build: variant.build,
  }))
}

export function runStageDeltaAnalysis(options: RunStageDeltaAnalysisOptions): StageDeltaAnalysis {
  const runVariants = (variants: DeltaVariant[]) => runStageBalanceAnalysis({
    stage: options.stage,
    classId: options.classId,
    builds: toBuildVariants(variants),
    profiles: [options.profile],
    attemptsPerScenario: options.attemptsPerScenario,
    maxDurationMs: options.maxDurationMs,
  })
  const mapScenarios = (
    variants: DeltaVariant[],
    analysis: ReturnType<typeof runStageBalanceAnalysis>,
    baselineVariantId: string,
  ): DeltaScenarioResult[] => {
    const variantById = new Map(variants.map((variant) => [variant.id, variant] as const))
    return analysis.scenarios.map((scenario) => {
      const variant = variantById.get(scenario.buildId)
      if (!variant) throw new Error(`Missing delta variant for ${scenario.buildId}`)
      return {
        stageId: scenario.stageId,
        classId: options.classId,
        baselineVariantId,
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
  }

  let variants: DeltaVariant[]
  let scenarios: DeltaScenarioResult[]
  let baselineVariantId: string

  if (options.type === 'active') {
    const candidates = createActiveDeltaVariants(options.stage, options.classId)
    const candidateScenarios = mapScenarios(candidates, runVariants(candidates), 'candidate_pool')
    const candidateById = new Map(candidates.map((variant) => [variant.id, variant] as const))
    variants = getLegalActiveSkillIds(options.stage, options.classId).flatMap((skillId) => {
      const { containing, excluding } = selectBestActiveSkillPresenceScenarios(candidateScenarios, skillId)
      const containingSource = containing ? candidateById.get(containing.variantId) : undefined
      const excludingSource = excluding ? candidateById.get(excluding.variantId) : undefined
      if (!containingSource || !excludingSource) return []

      const withId = `active_with_${skillId}`
      const withoutId = `active_without_${skillId}`
      const label = getActiveSkillDefinition(skillId)?.name ?? skillId
      return [
        {
          id: withId,
          classId: options.classId,
          label: `With ${label}`,
          kind: 'active_candidate' as const,
          build: {
            loadout: { ...containingSource.build.loadout },
            passiveTalentIds: [...containingSource.build.passiveTalentIds],
          },
        },
        {
          id: withoutId,
          classId: options.classId,
          label: `Without ${label}`,
          kind: 'active_candidate' as const,
          build: {
            loadout: { ...excludingSource.build.loadout },
            passiveTalentIds: [...excludingSource.build.passiveTalentIds],
          },
        },
      ]
    })
    baselineVariantId = 'paired_skill_ablation'
    scenarios = mapScenarios(variants, runVariants(variants), baselineVariantId)
  } else {
    variants = createPassiveDeltaVariants(options.stage, options.classId, options)
    const baseline = variants.find((variant) => variant.kind === 'baseline') ?? variants[0]
    baselineVariantId = baseline.id
    scenarios = mapScenarios(variants, runVariants(variants), baselineVariantId)
  }

  const createComparison = (
    baselineScenario: DeltaScenarioResult,
    comparedScenario: DeltaScenarioResult,
    activeSkillId?: SkillId,
  ): DeltaComparison => {
      const assessment = createDeltaComparisonAssessment({
        attempts: Math.min(baselineScenario.attempts, comparedScenario.attempts),
        seedCount: Math.min(baselineScenario.seedCount, comparedScenario.seedCount),
        baselinePassRate: baselineScenario.passRate,
        comparedPassRate: comparedScenario.passRate,
      })
      return {
        stageId: comparedScenario.stageId,
        classId: options.classId,
        baselineVariantId: baselineScenario.variantId,
        comparedVariantId: comparedScenario.variantId,
        comparedVariantLabel: activeSkillId
          ? getActiveSkillDefinition(activeSkillId)?.name ?? activeSkillId
          : comparedScenario.variantLabel,
        baselinePassRate: baselineScenario.passRate,
        comparedPassRate: comparedScenario.passRate,
        passRateDelta: assessment.passRateDelta,
        relativeDelta: assessment.relativeDelta,
        confidence: assessment.confidence,
        verdict: assessment.verdict,
        reasons: assessment.reasons,
        ...(activeSkillId ? {
          activeSkillId,
          baselineLoadout: { ...baselineScenario.loadout },
          comparedLoadout: { ...comparedScenario.loadout },
        } : {}),
      }
  }

  const comparisons = options.type === 'active'
    ? getLegalActiveSkillIds(options.stage, options.classId).flatMap((skillId) => {
        const containing = scenarios.find((scenario) => scenario.variantId === `active_with_${skillId}`)
        const excluding = scenarios.find((scenario) => scenario.variantId === `active_without_${skillId}`)
        return containing && excluding ? [createComparison(excluding, containing, skillId)] : []
      })
    : scenarios
      .filter((scenario) => scenario.variantId !== baselineVariantId)
      .map((scenario) => {
        const baselineScenario = scenarios.find((entry) => entry.variantId === baselineVariantId)
        if (!baselineScenario) throw new Error(`Missing baseline scenario for ${baselineVariantId}`)
        return createComparison(baselineScenario, scenario)
      })

  return {
    stageId: options.stage.id,
    classId: options.classId,
    buildRuleId: getStageBuildRuleId(options.stage),
    title: options.stage.title,
    analysisType: options.type,
    baselineVariantId,
    scenarios,
    comparisons,
  }
}
