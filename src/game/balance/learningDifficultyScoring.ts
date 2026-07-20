import type {
  BalanceProfileTier,
  BalanceScenarioResult,
  DifficultyLabel,
} from './difficultyScoring'

export interface LearningDifficultyScenario extends BalanceScenarioResult {
  castStrategyId?: string
  tacticalStrategyId?: string
}

export interface LearningDifficultyRating {
  label: DifficultyLabel
  baseLabel: DifficultyLabel
  bestPassRate: number
  flexibleBuildCount: number
  flexibleBuildThreshold: number
  executionLoad?: LearningExecutionLoadRating
  learningPath?: LearningPathRating
  learningEffort?: LearningEffortRating
  reasons: string[]
}

export interface LearningDifficultyOptions {
  flexibleBuildMinCount?: number
  flexibleBuildBestRatio?: number
  flexibleBuildMinPassRate?: number
  executionLoad?: LearningExecutionLoadRating
  learningPath?: LearningPathRating
  learningEffort?: LearningEffortRating
}

export type LearningEffortLabel = 'none' | 'basic' | 'moderate' | 'high' | 'specialist'

export interface LearningEffortRating {
  label: LearningEffortLabel
  score: number
  reasons: string[]
}

export interface LearningEffortOptions {
  explorationScenarios: readonly LearningDifficultyScenario[]
  finalScenarios: readonly LearningDifficultyScenario[]
  selectedBuildIds: readonly string[]
  selectedCastStrategyIds: readonly string[]
  selectedTacticalStrategyIds: readonly string[]
}

export type LearningExecutionLoadLabel = 'clear_windows' | 'normal' | 'composite_load'

export interface LearningExecutionLoadRating {
  label: LearningExecutionLoadLabel
  score: number
  adjustment: -2 | -1 | 0 | 1
  reasons: string[]
}

export interface LearningExecutionLoadOptions {
  enemyCount: number
  activeSkillCount: number
  selectedBuildIds: readonly string[]
  selectedCastStrategyIds: readonly string[]
  selectedTacticalStrategyIds: readonly string[]
  learningEffortScore: number
}

export type LearningPathLabel = 'direct' | 'learned' | 'specialized' | 'hidden_solution'

export interface LearningPathRating {
  label: LearningPathLabel
  score: number
  adjustment: 0 | 1 | 2
  reasons: string[]
}

export interface LearningPathBuildSummary {
  buildId: string
  activeSkillCount: number
  passiveTalentCount: number
}

export interface LearningPathOptions {
  explorationScenarios: readonly LearningDifficultyScenario[]
  finalScenarios: readonly LearningDifficultyScenario[]
  selectedBuilds: readonly LearningPathBuildSummary[]
  selectedCastStrategyIds: readonly string[]
  selectedTacticalStrategyIds: readonly string[]
  hasStrategyTips?: boolean
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

const DIFFICULTY_RANK: Record<DifficultyLabel, number> = {
  invalid_data: -1,
  trivial: 0,
  easy: 1,
  balanced: 2,
  hard: 3,
  expert: 4,
  near_impossible: 5,
  impossible: 6,
}

function maxDifficultyLabel(labels: readonly DifficultyLabel[]) {
  return labels.reduce((best, label) =>
    DIFFICULTY_RANK[label] > DIFFICULTY_RANK[best] ? label : best
  )
}

function executionLoadDifficultyLabel(executionLoad: LearningExecutionLoadRating | undefined): DifficultyLabel | null {
  if (!executionLoad) {
    return null
  }

  if (executionLoad.label === 'composite_load') {
    return 'hard'
  }

  return 'trivial'
}

function learningPathDifficultyLabel(learningPath: LearningPathRating | undefined): DifficultyLabel | null {
  if (!learningPath) {
    return null
  }

  switch (learningPath.label) {
    case 'hidden_solution':
    case 'specialized':
      return 'hard'
    case 'learned':
      return 'balanced'
    case 'direct':
      return 'trivial'
  }
}

function learningEffortDifficultyLabel(learningEffort: LearningEffortRating | undefined): DifficultyLabel | null {
  if (!learningEffort) {
    return null
  }

  switch (learningEffort.label) {
    case 'specialist':
      return 'expert'
    case 'high':
      return 'hard'
    case 'moderate':
      return 'balanced'
    case 'basic':
    case 'none':
      return 'trivial'
  }
}

function learningLabelFromBestPassRate(bestPassRate: number): DifficultyLabel {
  if (bestPassRate >= 0.85) {
    return 'trivial'
  }
  if (bestPassRate >= 0.7) {
    return 'easy'
  }
  if (bestPassRate >= 0.55) {
    return 'balanced'
  }
  if (bestPassRate >= 0.35) {
    return 'hard'
  }
  if (bestPassRate >= 0.15) {
    return 'expert'
  }
  if (bestPassRate >= 0.05) {
    return 'near_impossible'
  }
  return 'impossible'
}

function bestPassRateByBuild(results: readonly LearningDifficultyScenario[]) {
  const rates = new Map<string, number>()
  for (const result of results) {
    rates.set(result.buildId, Math.max(rates.get(result.buildId) ?? 0, result.passRate))
  }
  return rates
}

function hasValidSamples(results: readonly LearningDifficultyScenario[]) {
  return results.some((result) => result.attempts > 0 && Number.isFinite(result.passRate))
}

function median(values: readonly number[]) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function learningPathLabelFromScore(score: number): LearningPathLabel {
  if (score >= 75) {
    return 'hidden_solution'
  }
  if (score >= 50) {
    return 'specialized'
  }
  if (score >= 25) {
    return 'learned'
  }
  return 'direct'
}

function learningPathAdjustmentFromLabel(label: LearningPathLabel): 0 | 1 | 2 {
  if (label === 'hidden_solution') {
    return 2
  }
  if (label === 'specialized') {
    return 1
  }
  return 0
}

export function evaluateLearningPath(options: LearningPathOptions): LearningPathRating {
  const bestFinalPassRate = options.finalScenarios.reduce((best, result) => Math.max(best, result.passRate), 0)
  const fallbackBestPassRate = options.explorationScenarios.reduce((best, result) => Math.max(best, result.passRate), 0)
  const bestPassRate = Math.max(bestFinalPassRate, fallbackBestPassRate)
  const defaultBuildPassRate = maxPassRateForBuild(options.explorationScenarios, 'default')
  const selectedNonDefaultBuild = options.selectedBuilds.some((build) => build.buildId !== 'default')
  const minSelectedActiveSkillCount = options.selectedBuilds.reduce(
    (min, build) => Math.min(min, build.activeSkillCount),
    Number.POSITIVE_INFINITY,
  )
  const maxSelectedPassiveTalentCount = options.selectedBuilds.reduce(
    (max, build) => Math.max(max, build.passiveTalentCount),
    0,
  )
  const explorationBuildRates = bestPassRateByBuild(options.explorationScenarios)
  const finalBuildRates = bestPassRateByBuild(options.finalScenarios)
  const sampledBuildRates = explorationBuildRates.size > 0 ? explorationBuildRates : finalBuildRates
  const viableBuildThreshold = Math.max(0.65, bestPassRate * 0.8)
  const viableBuildCount = [...sampledBuildRates.values()].filter((rate) => rate >= viableBuildThreshold).length
  const explorationPassRates = options.explorationScenarios
    .filter((result) => result.attempts > 0 && Number.isFinite(result.passRate))
    .map((result) => result.passRate)
  const explorationMedianPassRate = median(explorationPassRates)
  const selectedSpecialCast = selectedUsesSpecialCastPlan(options.selectedCastStrategyIds)
  const selectedSpecialTactic = selectedUsesSpecialTactic(options.selectedTacticalStrategyIds)
  const hasFiniteActiveCount = Number.isFinite(minSelectedActiveSkillCount)

  let score = 0
  const reasons: string[] = []
  const defaultGap = bestPassRate - defaultBuildPassRate

  if (selectedNonDefaultBuild && defaultGap >= 0.5) {
    score += 30
    reasons.push(`默认 build 与学习结果差距极大：最优 ${formatPercent(bestPassRate)}，默认 ${formatPercent(defaultBuildPassRate)}`)
  } else if (selectedNonDefaultBuild && defaultGap >= 0.25) {
    score += 18
    reasons.push(`默认 build 与学习结果有明显差距：最优 ${formatPercent(bestPassRate)}，默认 ${formatPercent(defaultBuildPassRate)}`)
  }

  if (selectedNonDefaultBuild) {
    score += 10
    reasons.push('最终选择了非默认 build，玩家需要先找到构筑方向')
  }

  if (hasFiniteActiveCount && minSelectedActiveSkillCount <= 2 && maxSelectedPassiveTalentCount >= 6) {
    score += 18
    reasons.push('最终 build 主动技能很少且被动投入很高，属于偏构筑解法')
  }

  if (maxSelectedPassiveTalentCount >= 10) {
    score += 28
    reasons.push('最终 build 使用 10 个以上被动天赋，明显依赖被动堆叠')
  }

  if (viableBuildCount <= 2 && bestPassRate >= 0.55) {
    score += 20
    reasons.push(`高通过率 build 数量较窄：${viableBuildCount} 个达到 ${formatPercent(viableBuildThreshold)}`)
  }

  if (options.hasStrategyTips && (selectedSpecialCast || selectedSpecialTactic)) {
    score += 10
    reasons.push('最终策略使用了策划提示对应的特殊读条或战术处理')
  }

  if (explorationMedianPassRate <= 0.25 && bestPassRate >= 0.7) {
    score += 18
    reasons.push(`探索期中位通过率较低（${formatPercent(explorationMedianPassRate)}），但最终最优较高，说明学习路径较曲折`)
  }

  if (reasons.length === 0) {
    reasons.push('默认构筑或常规策略已经能覆盖主要通关路径')
  }

  const clampedScore = Math.min(100, Math.max(0, Math.round(score)))
  const label = learningPathLabelFromScore(clampedScore)
  return {
    label,
    score: clampedScore,
    adjustment: learningPathAdjustmentFromLabel(label),
    reasons,
  }
}

export function classifyLearningDifficulty(
  results: readonly LearningDifficultyScenario[],
  options: LearningDifficultyOptions = {},
): LearningDifficultyRating {
  if (!hasValidSamples(results)) {
    return {
      label: 'invalid_data',
      baseLabel: 'invalid_data',
      bestPassRate: 0,
      flexibleBuildCount: 0,
      flexibleBuildThreshold: 0,
      reasons: ['没有有效学习型 AI 样本'],
    }
  }

  const buildRates = bestPassRateByBuild(results)
  const bestPassRate = [...buildRates.values()].reduce((best, rate) => Math.max(best, rate), 0)
  const baseLabel = learningLabelFromBestPassRate(bestPassRate)
  const flexibleBuildMinCount = Math.max(1, Math.floor(options.flexibleBuildMinCount ?? 3))
  const flexibleBuildBestRatio = Math.max(0, options.flexibleBuildBestRatio ?? 0.8)
  const flexibleBuildMinPassRate = Math.max(0, options.flexibleBuildMinPassRate ?? 0.65)
  const flexibleBuildThreshold = Math.max(flexibleBuildMinPassRate, bestPassRate * flexibleBuildBestRatio)
  const flexibleBuildCount = [...buildRates.values()].filter((rate) => rate >= flexibleBuildThreshold).length
  const hasFlexibleBuildCoverage = flexibleBuildCount >= flexibleBuildMinCount && baseLabel !== 'impossible'
  const executionLoad = options.executionLoad
  const learningPath = options.learningPath
  const learningEffort = options.learningEffort
  const executionLoadLabel = executionLoadDifficultyLabel(executionLoad)
  const learningPathLabel = learningPathDifficultyLabel(learningPath)
  const learningEffortLabel = learningEffortDifficultyLabel(learningEffort)
  const label = maxDifficultyLabel([
    baseLabel,
    ...(executionLoadLabel ? [executionLoadLabel] : []),
    ...(learningPathLabel ? [learningPathLabel] : []),
    ...(learningEffortLabel ? [learningEffortLabel] : []),
  ])
  const executionLoadReasons = executionLoad && executionLoadLabel
    ? [`operation-load difficulty: ${executionLoadLabel} (${executionLoad.label}, score ${executionLoad.score})`]
    : []
  const learningPathReasons = learningPath && learningPathLabel
    ? [`learning-path difficulty: ${learningPathLabel} (${learningPath.label}, score ${learningPath.score})`]
    : []
  const learningEffortReasons = learningEffort && learningEffortLabel
    ? [`skill-requirement difficulty: ${learningEffortLabel} (${learningEffort.label}, score ${learningEffort.score})`]
    : []

  return {
    label,
    baseLabel,
    bestPassRate,
    flexibleBuildCount,
    flexibleBuildThreshold,
    ...(executionLoad ? { executionLoad } : {}),
    ...(learningPath ? { learningPath } : {}),
    ...(learningEffort ? { learningEffort } : {}),
    reasons: [
      `pass-rate difficulty: ${baseLabel}`,
      ...executionLoadReasons,
      ...learningPathReasons,
      ...learningEffortReasons,
      `composite learning difficulty uses the maximum dimension: ${label}`,
      ...(hasFlexibleBuildCoverage
        ? ['multiple builds meet the stability threshold; this is recorded as flexibility and no longer lowers the final difficulty']
        : []),
      ...(DIFFICULTY_RANK[label] > DIFFICULTY_RANK[baseLabel]
        ? ['composite difficulty is above the pass-rate dimension because another dimension is stricter']
        : []),
      ...(executionLoadLabel && DIFFICULTY_RANK[executionLoadLabel] < DIFFICULTY_RANK[baseLabel]
        ? ['operation-load dimension is below pass-rate difficulty; pass-rate remains the limiting dimension']
        : []),
      `学习型 AI 最佳通过率：${formatPercent(bestPassRate)}`,
      `学习型 AI 使用单一较强玩家 profile，不再拆分 average/skilled/expert`,
      `多 build 稳定阈值：${formatPercent(flexibleBuildThreshold)}，达标 build 数：${flexibleBuildCount}`,
      ...(learningPath && learningPath.adjustment > 0
        ? [`学习路径为 ${learningPath.label}，作为独立维度参与综合取最大值`]
        : []),
    ],
  }
}

export function evaluateLearningExecutionLoad(options: LearningExecutionLoadOptions): LearningExecutionLoadRating {
  const usesNonDefaultBuild = options.selectedBuildIds.some((buildId) => buildId !== 'default')
  const specialCastCount = options.selectedCastStrategyIds.filter((strategyId) =>
    strategyId === 'late-window' || strategyId === 'broad-low-mid-casts'
  ).length
  const specialTacticCount = options.selectedTacticalStrategyIds.filter((strategyId) =>
    strategyId === 'allow-irregular-leak' ||
    strategyId === 'mechanic-focus' ||
    strategyId.startsWith('mechanic-wax-')
  ).length

  let score = 0
  const reasons: string[] = []

  if (options.enemyCount <= 2) {
    score -= 12
    reasons.push('敌人数量少，关键观察窗口更集中')
  } else if (options.enemyCount >= 4) {
    score += 16
    reasons.push('敌人数量多，需要同时监控更多目标')
  }

  if (options.activeSkillCount <= 2) {
    score -= 26
    reasons.push('主动键位少，学会后执行成本较低')
  } else if (options.activeSkillCount <= 4 && options.learningEffortScore <= 25) {
    score -= 18
    reasons.push('键位数量仍低，且技巧需求较低，窗口学会后可重复执行')
  } else if (options.activeSkillCount >= 5) {
    score += 10
    reasons.push('主动键位较多，GCD/冷却/资源冲突概率上升')
  }

  if (options.activeSkillCount >= 8) {
    score += 18
    reasons.push('完整 8 键构筑会显著提高注意力与按键管理负载')
  }

  if (usesNonDefaultBuild) {
    score += 10
    reasons.push('需要切换到非默认 build，增加构筑学习成本')
  }

  if (specialCastCount > 0) {
    score += specialCastCount * (options.learningEffortScore <= 25 ? 3 : 8)
    reasons.push('读条策略不是纯常规处理，需要额外节奏判断')
  }

  if (specialTacticCount > 0) {
    score += specialTacticCount * (options.learningEffortScore <= 25 ? 3 : 10)
    reasons.push('战术策略涉及 irregular、机制目标或机制链处理')
  }

  if (options.learningEffortScore >= 60) {
    score += 14
    reasons.push('技巧需求较高，执行时需要记住关卡专属规则')
  } else if (options.learningEffortScore <= 20) {
    score -= 6
    reasons.push('技巧需求较低，学习后的操作模式更接近常规打法')
  }

  if (options.activeSkillCount <= 2 && options.learningEffortScore <= 25) {
    return {
      label: 'clear_windows',
      score,
      adjustment: usesNonDefaultBuild ? -2 : -1,
      reasons,
    }
  }

  if (options.activeSkillCount <= 4 && options.learningEffortScore <= 35) {
    return { label: 'clear_windows', score, adjustment: -1, reasons }
  }

  if (options.activeSkillCount >= 5 && options.learningEffortScore >= 40 && score >= 40) {
    return { label: 'composite_load', score, adjustment: 1, reasons }
  }

  if (score <= -35) {
    return { label: 'clear_windows', score, adjustment: -2, reasons }
  }
  if (score <= -14) {
    return { label: 'clear_windows', score, adjustment: -1, reasons }
  }
  if (score >= 45) {
    return { label: 'composite_load', score, adjustment: 1, reasons }
  }
  return { label: 'normal', score, adjustment: 0, reasons }
}

function learningEffortLabelFromScore(score: number): LearningEffortLabel {
  if (score >= 80) {
    return 'specialist'
  }
  if (score >= 60) {
    return 'high'
  }
  if (score >= 40) {
    return 'moderate'
  }
  if (score >= 20) {
    return 'basic'
  }
  return 'none'
}

function maxPassRateForBuild(results: readonly LearningDifficultyScenario[], buildId: string) {
  return results
    .filter((result) => result.buildId === buildId)
    .reduce((best, result) => Math.max(best, result.passRate), 0)
}

function maxPassRateForCastStrategy(results: readonly LearningDifficultyScenario[], strategyId: string) {
  return results
    .filter((result) => result.castStrategyId === strategyId)
    .reduce((best, result) => Math.max(best, result.passRate), 0)
}

function maxPassRateForTacticalStrategy(results: readonly LearningDifficultyScenario[], strategyId: string) {
  return results
    .filter((result) => result.tacticalStrategyId === strategyId)
    .reduce((best, result) => Math.max(best, result.passRate), 0)
}

function selectedUsesSpecialTactic(strategyIds: readonly string[]) {
  return strategyIds.some((strategyId) =>
    strategyId === 'allow-irregular-leak' ||
    strategyId === 'mechanic-focus' ||
    strategyId.startsWith('mechanic-wax-')
  )
}

function selectedUsesMechanicChain(strategyIds: readonly string[]) {
  return strategyIds.some((strategyId) => strategyId.startsWith('mechanic-wax-'))
}

function selectedUsesSpecialCastPlan(strategyIds: readonly string[]) {
  return strategyIds.some((strategyId) =>
    strategyId === 'late-window' ||
    strategyId === 'broad-low-mid-casts'
  )
}

export function evaluateLearningEffort(options: LearningEffortOptions): LearningEffortRating {
  const bestFinalPassRate = options.finalScenarios.reduce((best, result) => Math.max(best, result.passRate), 0)
  const defaultBuildPassRate = maxPassRateForBuild(options.explorationScenarios, 'default')
  const selectedNonDefaultBuild = options.selectedBuildIds.some((buildId) => buildId !== 'default')
  const selectedSpecialCast = selectedUsesSpecialCastPlan(options.selectedCastStrategyIds)
  const selectedSpecialTactic = selectedUsesSpecialTactic(options.selectedTacticalStrategyIds)
  const selectedMechanicChain = selectedUsesMechanicChain(options.selectedTacticalStrategyIds)
  const selectedBuildCount = options.selectedBuildIds.length

  let score = 0
  const reasons: string[] = []

  if (selectedNonDefaultBuild && bestFinalPassRate - defaultBuildPassRate >= 0.25) {
    score += 24
    reasons.push(`非默认 build 明显优于默认 build：最佳 ${formatPercent(bestFinalPassRate)}，默认 ${formatPercent(defaultBuildPassRate)}`)
  } else if (selectedNonDefaultBuild) {
    score += 10
    reasons.push('学习结果使用非默认 build，但默认 build 差距不大')
  }

  if (selectedSpecialCast) {
    const selectedCastBest = options.selectedCastStrategyIds.reduce(
      (best, strategyId) => Math.max(best, maxPassRateForCastStrategy(options.explorationScenarios, strategyId)),
      0,
    )
    const ordinaryCastBest = ['balanced-window', 'broad-window'].reduce(
      (best, strategyId) => Math.max(best, maxPassRateForCastStrategy(options.explorationScenarios, strategyId)),
      0,
    )
    const bonus = selectedCastBest - ordinaryCastBest >= 0.15 ? 18 : 10
    score += bonus
    reasons.push('读条处理需要学习特殊窗口或中低危读条处理')
  }

  const selectedTacticBest = options.selectedTacticalStrategyIds.reduce(
    (best, strategyId) => Math.max(best, maxPassRateForTacticalStrategy(options.explorationScenarios, strategyId)),
    0,
  )
  const ordinaryTacticBest = ['strict-threat', 'kill-high-impact'].reduce(
    (best, strategyId) => Math.max(best, maxPassRateForTacticalStrategy(options.explorationScenarios, strategyId)),
    0,
  )
  const specialTacticGain = selectedTacticBest - ordinaryTacticBest

  if (selectedSpecialTactic && !selectedMechanicChain && specialTacticGain > 0.05) {
    const bonus = selectedTacticBest - ordinaryTacticBest >= 0.15 ? 22 : 14
    score += bonus
    reasons.push('战术选择需要处理特殊目标、irregular 分摊或机制目标优先')
  }

  if (selectedMechanicChain && specialTacticGain > 0.05) {
    score += 26
    reasons.push('学习结果依赖机制链规划，例如蜡像与暗影之锄的目标联动')
  }

  if (selectedBuildCount <= 1 && bestFinalPassRate > 0) {
    score += 12
    reasons.push('最终可用 build 很窄，玩家需要较准确地找到解法')
  }

  if (reasons.length === 0) {
    reasons.push('默认 build 与常规策略即可覆盖主要通过率')
  }

  const clampedScore = Math.min(100, Math.round(score))
  return {
    label: learningEffortLabelFromScore(clampedScore),
    score: clampedScore,
    reasons,
  }
}

export function asLearningDifficultyScenarios(
  results: readonly BalanceScenarioResult[],
): LearningDifficultyScenario[] {
  return results.map((result) => ({
    ...result,
    profileTier: result.profileTier as BalanceProfileTier,
  }))
}
