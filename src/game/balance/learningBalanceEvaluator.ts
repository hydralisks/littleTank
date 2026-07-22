import type { StageInfo } from '../data/stageTemplates'
import type { EncounterState, PlayerClassId } from '../encounter/encounterTypes'
import { createInitialEncounterState } from '../encounter/encounterFactory'
import { createEncounterTemplate } from '../data/encounterTemplates'
import { generateStageBalanceBuilds } from './balanceBuildGenerator'
import {
  runBalanceScenario,
  runStageBalanceAnalysis,
  selectTwoPhaseBalanceBuilds,
  selectTwoPhaseSharedStrategyIds,
  type BalanceBuildVariant,
  type BalanceOperationProfile,
  type StageBalanceAnalysis,
  type TraceableBalanceScenarioResult,
} from './balanceSimulator'
import type { BalanceScenarioResult } from './difficultyScoring'
import {
  classifyLearningDifficulty,
  evaluateLearningExecutionLoad,
  evaluateLearningEffort,
  evaluateLearningPath,
  type LearningExecutionLoadRating,
  type LearningDifficultyRating,
  type LearningEffortRating,
  type LearningPathRating,
} from './learningDifficultyScoring'

export interface LearningCastStrategy {
  id: string
  profileOverrides: Partial<BalanceOperationProfile>
}

export interface LearningTacticalStrategy {
  id: string
  profileOverrides: Partial<BalanceOperationProfile>
}

export interface LearningScenarioResult extends BalanceScenarioResult {
  castStrategyId: string
  tacticalStrategyId: string
}

export interface LearningStageBalanceAnalysis {
  stageId: string
  classId: PlayerClassId
  learningMode: 'build_and_cast_strategy_search' | 'build_cast_and_tactical_strategy_search'
  phaseOneBuildCount: number
  selectedBuildIds: string[]
  selectedCastStrategyIds: string[]
  selectedTacticalStrategyIds: string[]
  explorationScenarios: LearningScenarioResult[]
  finalAnalysis: StageBalanceAnalysis
  learningDifficultyRating: LearningDifficultyRating
  learningEffort: LearningEffortRating
  learningExecutionLoad: LearningExecutionLoadRating
  learningPath: LearningPathRating
}

export interface RunLearningStageBalanceAnalysisOptions {
  stage: StageInfo
  classId: PlayerClassId
  profiles: BalanceOperationProfile[]
  castStrategies: LearningCastStrategy[]
  tacticalStrategies?: LearningTacticalStrategy[]
  phaseOneAttemptsPerScenario: number
  attemptsPerScenario: number
  maxDurationMs: number
  buildCandidates?: BalanceBuildVariant[]
  phaseOneMaxActiveBuilds?: number
  phaseOneMaxPassiveVariants?: number
  finalBuildCount?: number
  finalStrategyCount?: number
  tickMs?: number
  initialStateMutator?: (state: EncounterState) => EncounterState
  collectTrace?: boolean
  collectDiagnostics?: boolean
}

function normalizeCastStrategies(castStrategies: readonly LearningCastStrategy[]) {
  return castStrategies.length > 0
    ? castStrategies
    : [{ id: 'default', profileOverrides: {} }] satisfies LearningCastStrategy[]
}

function normalizeTacticalStrategies(tacticalStrategies: readonly LearningTacticalStrategy[] | undefined) {
  return tacticalStrategies && tacticalStrategies.length > 0
    ? tacticalStrategies
    : [{ id: 'default', profileOverrides: {} }] satisfies LearningTacticalStrategy[]
}

function isWaxChainStrategy(strategy: LearningTacticalStrategy) {
  return strategy.id.startsWith('mechanic-wax-') ||
    strategy.profileOverrides.mechanicChainPlan === 'wax_party_then_hoe_party' ||
    strategy.profileOverrides.mechanicChainPlan === 'wax_tank_then_hoe_tank'
}

function isIntentionalLeakStrategy(strategy: LearningTacticalStrategy) {
  return strategy.id === 'allow-irregular-leak' ||
    strategy.profileOverrides.irregularThreatPolicy === 'allow_leak_when_tank_pressure_high'
}

function isMechanicFocusStrategy(strategy: LearningTacticalStrategy) {
  return strategy.id === 'mechanic-focus' ||
    strategy.id === 'kill-high-impact' ||
    strategy.profileOverrides.targetPriorityMode === 'mechanic_focus' ||
    strategy.profileOverrides.targetPriorityMode === 'kill_high_impact'
}

function normalizeStrategyText(value: string | undefined) {
  return (value ?? '').toLowerCase()
}

function stageAllowsWaxChainTactics(stage: StageInfo, stageSkillIds: readonly string[]) {
  const tips = normalizeStrategyText(stage.strategyTips)
  const hasTip =
    /wax|hoe|shadow/.test(tips) ||
    tips.includes('蜡') ||
    tips.includes('暗影') ||
    tips.includes('锄')
  const hasMechanic = stageSkillIds.some((skillId) => /wax|hoe|shadow|figure/i.test(skillId))

  return hasTip || hasMechanic
}

function stageAllowsIntentionalLeakTactics(stage: StageInfo, stageSkillIds: readonly string[]) {
  const tips = normalizeStrategyText(stage.strategyTips)
  const hasTip =
    /leak|ignore|pressure|irregular/.test(tips) ||
    tips.includes('漏') ||
    tips.includes('无理') ||
    tips.includes('壓力') ||
    tips.includes('压力') ||
    tips.includes('硬吃')
  const hasMechanic = stageSkillIds.some((skillId) => /irregular|pressure|leak/i.test(skillId))

  return hasTip || hasMechanic
}

function stageAllowsMechanicFocusTactics(stage: StageInfo, stageSkillIds: readonly string[]) {
  const tips = normalizeStrategyText(stage.strategyTips)
  const hasTip =
    /focus|priority|kill|high.?impact|mechanic/.test(tips) ||
    tips.includes('优先') ||
    tips.includes('優先') ||
    tips.includes('集火') ||
    tips.includes('先杀') ||
    tips.includes('先殺') ||
    tips.includes('击杀') ||
    tips.includes('擊殺') ||
    tips.includes('机制') ||
    tips.includes('機制')
  const hasMechanic = stageSkillIds.some((skillId) => /priority|focus|high.?impact|mechanic/i.test(skillId))

  return hasTip || hasMechanic
}

export function filterLearningTacticalStrategiesForStage(
  stage: StageInfo,
  tacticalStrategies: readonly LearningTacticalStrategy[],
  stageSkillIds: readonly string[],
) {
  const allowWaxChain = stageAllowsWaxChainTactics(stage, stageSkillIds)
  const allowIntentionalLeak = stageAllowsIntentionalLeakTactics(stage, stageSkillIds)
  const allowMechanicFocus = stageAllowsMechanicFocusTactics(stage, stageSkillIds)

  return tacticalStrategies.filter((strategy) => {
    if (isWaxChainStrategy(strategy)) {
      return allowWaxChain
    }

    if (isIntentionalLeakStrategy(strategy)) {
      return allowIntentionalLeak
    }

    if (isMechanicFocusStrategy(strategy)) {
      return allowMechanicFocus
    }

    return true
  })
}

function createStrategyProfile(
  profile: BalanceOperationProfile,
  castStrategy: LearningCastStrategy,
  tacticalStrategy: LearningTacticalStrategy,
): BalanceOperationProfile {
  return {
    ...profile,
    ...castStrategy.profileOverrides,
    ...tacticalStrategy.profileOverrides,
    id: `${profile.id}__cast_${castStrategy.id}__tactic_${tacticalStrategy.id}`,
    tier: profile.tier,
  }
}

function createInitialEnemyCount(
  stage: StageInfo,
  classId: PlayerClassId,
  build: BalanceBuildVariant['build'] | undefined,
) {
  if (!build) {
    return 0
  }

  return createInitialEncounterState(stage, classId, build).enemies.length
}

function runExplorationScenarios({
  stage,
  classId,
  builds,
  profiles,
  castStrategies,
  tacticalStrategies,
  attempts,
  maxDurationMs,
  tickMs,
  initialStateMutator,
}: {
  stage: StageInfo
  classId: PlayerClassId
  builds: readonly BalanceBuildVariant[]
  profiles: readonly BalanceOperationProfile[]
  castStrategies: readonly LearningCastStrategy[]
  tacticalStrategies: readonly LearningTacticalStrategy[]
  attempts: number
  maxDurationMs: number
  tickMs?: number
  initialStateMutator?: (state: EncounterState) => EncounterState
}) {
  const scenarios: LearningScenarioResult[] = []

  for (const build of builds) {
    for (const castStrategy of castStrategies) {
      for (const tacticalStrategy of tacticalStrategies) {
        for (const profile of profiles) {
          const scenario = runBalanceScenario({
            stage,
            classId,
            build: build.build,
            buildId: build.id,
            profile: createStrategyProfile(profile, castStrategy, tacticalStrategy),
            attempts,
            maxDurationMs,
            tickMs,
            initialStateMutator,
          })

          scenarios.push({
            ...scenario,
            profileId: profile.id,
            castStrategyId: castStrategy.id,
            tacticalStrategyId: tacticalStrategy.id,
          })
        }
      }
    }
  }

  return scenarios
}

export function runLearningStageBalanceAnalysis(
  options: RunLearningStageBalanceAnalysisOptions,
): LearningStageBalanceAnalysis {
  const phaseOneBuilds = options.buildCandidates && options.buildCandidates.length > 0
    ? options.buildCandidates
    : generateStageBalanceBuilds(options.stage, options.classId, {
      maxActiveBuilds: options.phaseOneMaxActiveBuilds ?? 24,
      maxPassiveVariants: options.phaseOneMaxPassiveVariants ?? 4,
    })
  const invalidBuild = phaseOneBuilds.find((variant) => variant.classId !== options.classId)
  if (invalidBuild) {
    throw new Error(
      `Balance build ${invalidBuild.id} belongs to ${invalidBuild.classId}, expected ${options.classId}`,
    )
  }
  const castStrategies = normalizeCastStrategies(options.castStrategies)
  const stageSkillIds = createEncounterTemplate(options.stage).enemies
    .flatMap((enemy) => enemy.skillCycle.length > 0 ? enemy.skillCycle : enemy.skillIds)
  const tacticalStrategies = filterLearningTacticalStrategiesForStage(
    options.stage,
    normalizeTacticalStrategies(options.tacticalStrategies),
    stageSkillIds,
  )
  const finalBuildCount = Math.max(1, Math.floor(options.finalBuildCount ?? 6))
  const finalStrategyCount = Math.max(1, Math.floor(options.finalStrategyCount ?? 2))
  const explorationScenarios = runExplorationScenarios({
    stage: options.stage,
    classId: options.classId,
    builds: phaseOneBuilds,
    profiles: options.profiles,
    castStrategies,
    tacticalStrategies,
    attempts: options.phaseOneAttemptsPerScenario,
    maxDurationMs: options.maxDurationMs,
    tickMs: options.tickMs,
    initialStateMutator: options.initialStateMutator,
  })
  const selectedBuilds = selectTwoPhaseBalanceBuilds(explorationScenarios, phaseOneBuilds, finalBuildCount)
  const selectedCastStrategyIds = selectTwoPhaseSharedStrategyIds(
    explorationScenarios.map((scenario) => ({
      strategyId: scenario.castStrategyId,
      passRate: scenario.passRate,
    })),
    finalStrategyCount,
  )
  const selectedTacticalStrategyIds = selectTwoPhaseSharedStrategyIds(
    explorationScenarios.map((scenario) => ({
      strategyId: scenario.tacticalStrategyId,
      passRate: scenario.passRate,
    })),
    finalStrategyCount,
  )
  const castStrategyById = new Map(castStrategies.map((strategy) => [strategy.id, strategy] as const))
  const tacticalStrategyById = new Map(tacticalStrategies.map((strategy) => [strategy.id, strategy] as const))
  const selectedCastStrategies = selectedCastStrategyIds.flatMap((strategyId) => {
    const strategy = castStrategyById.get(strategyId)
    return strategy ? [strategy] : []
  })
  const selectedTacticalStrategies = selectedTacticalStrategyIds.flatMap((strategyId) => {
    const strategy = tacticalStrategyById.get(strategyId)
    return strategy ? [strategy] : []
  })
  const finalProfiles = selectedCastStrategies.flatMap((castStrategy) =>
    selectedTacticalStrategies.flatMap((tacticalStrategy) =>
      options.profiles.map((profile) => createStrategyProfile(profile, castStrategy, tacticalStrategy)),
    ),
  )
  const finalAnalysis = runStageBalanceAnalysis({
    stage: options.stage,
    classId: options.classId,
    builds: selectedBuilds,
    profiles: finalProfiles,
    attemptsPerScenario: options.attemptsPerScenario,
    maxDurationMs: options.maxDurationMs,
    tickMs: options.tickMs,
    initialStateMutator: options.initialStateMutator,
    collectTrace: options.collectTrace,
    collectDiagnostics: options.collectDiagnostics,
  })
  const finalLearningScenarios = finalAnalysis.scenarios.map((scenario: TraceableBalanceScenarioResult) => {
    const [baseProfileId, suffix = ''] = scenario.profileId.split('__cast_')
    const [castStrategyId = 'default', tacticalPart = ''] = suffix.split('__tactic_')
    const tacticalStrategyId = tacticalPart || 'default'

    return {
      ...scenario,
      profileId: baseProfileId,
      castStrategyId,
      tacticalStrategyId,
    }
  })
  const learningEffort = evaluateLearningEffort({
    explorationScenarios,
    finalScenarios: finalLearningScenarios,
    selectedBuildIds: selectedBuilds.map((build) => build.id),
    selectedCastStrategyIds,
    selectedTacticalStrategyIds,
  })
  const selectedActiveSkillCount = selectedBuilds.reduce(
    (max, build) => Math.max(max, Object.values(build.build.loadout).filter(Boolean).length),
    0,
  )
  const learningExecutionLoad = evaluateLearningExecutionLoad({
    enemyCount: Math.max(0, createInitialEnemyCount(options.stage, options.classId, selectedBuilds[0]?.build)),
    activeSkillCount: selectedActiveSkillCount,
    selectedBuildIds: selectedBuilds.map((build) => build.id),
    selectedCastStrategyIds,
    selectedTacticalStrategyIds,
    learningEffortScore: learningEffort.score,
  })
  const learningPath = evaluateLearningPath({
    explorationScenarios,
    finalScenarios: finalLearningScenarios,
    selectedBuilds: selectedBuilds.map((build) => ({
      buildId: build.id,
      activeSkillCount: Object.values(build.build.loadout).filter(Boolean).length,
      passiveTalentCount: build.build.passiveTalentIds.length,
    })),
    selectedCastStrategyIds,
    selectedTacticalStrategyIds,
    hasStrategyTips: Boolean(options.stage.strategyTips?.trim()),
  })
  const learningDifficultyRating = classifyLearningDifficulty(finalLearningScenarios, {
    executionLoad: learningExecutionLoad,
    learningPath,
    learningEffort,
  })

  return {
    stageId: options.stage.id,
    classId: options.classId,
    learningMode:
      tacticalStrategies.length > 1
        ? 'build_cast_and_tactical_strategy_search'
        : 'build_and_cast_strategy_search',
    phaseOneBuildCount: phaseOneBuilds.length,
    selectedBuildIds: selectedBuilds.map((build) => build.id),
    selectedCastStrategyIds,
    selectedTacticalStrategyIds,
    explorationScenarios,
    learningDifficultyRating,
    learningEffort,
    learningExecutionLoad,
    learningPath,
    finalAnalysis: {
      ...finalAnalysis,
      buildSearchMode: 'two_phase',
      phaseOneBuildCount: phaseOneBuilds.length,
      finalBuildCount: selectedBuilds.length,
    },
  }
}
