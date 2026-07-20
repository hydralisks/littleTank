import type { DifficultyLabel } from './difficultyScoring'
import type { ManualDifficultyLabel } from './balanceReport'
import type { StaticStageDifficultyMetrics } from './staticStageScoring'

export type BalanceRecommendationSeverity = 'none' | 'low' | 'medium' | 'high'

export type BalanceRecommendationIssueType =
  | 'raw_numbers_too_high'
  | 'raw_numbers_too_low'
  | 'mechanic_execution_load'
  | 'ai_strategy_gap'
  | 'build_dependency'
  | 'static_ai_disagreement'

export interface BalanceDesignRecommendationInput {
  stageId: string
  manualLabel: ManualDifficultyLabel
  staticLabel: DifficultyLabel
  fixedLabel: DifficultyLabel
  learningLabel: DifficultyLabel
  staticMetrics: StaticStageDifficultyMetrics
  fixedBestPassRate: number
  learningBestPassRate: number
  learningEffortScore: number
  learningExecutionLoadScore: number
  halfBestBuildCount: number
}

export interface BalanceDesignRecommendation {
  severity: BalanceRecommendationSeverity
  issueTypes: BalanceRecommendationIssueType[]
  confidence: 'low' | 'medium' | 'high'
  summary: string
  suggestions: string[]
}

const LABEL_RANK: Record<DifficultyLabel, number> = {
  trivial: 0,
  easy: 1,
  balanced: 2,
  hard: 3,
  expert: 4,
  near_impossible: 5,
  impossible: 6,
  invalid_data: 7,
}

function manualRank(label: ManualDifficultyLabel) {
  if (label === 'near_impossible / impossible') {
    return LABEL_RANK.near_impossible
  }

  if (label === 'unrated') {
    return LABEL_RANK.invalid_data
  }

  return LABEL_RANK[label] ?? LABEL_RANK.invalid_data
}

function rank(label: DifficultyLabel) {
  return LABEL_RANK[label] ?? LABEL_RANK.invalid_data
}

function clampPercent(value: number) {
  return Math.max(5, Math.min(30, Math.round(value)))
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function severityFromGap(maxGap: number): BalanceRecommendationSeverity {
  if (maxGap >= 2) {
    return 'high'
  }
  if (maxGap === 1) {
    return 'medium'
  }
  return 'low'
}

function confidenceFor(input: BalanceDesignRecommendationInput, issueTypes: readonly BalanceRecommendationIssueType[]) {
  const allHarderThanManual =
    rank(input.staticLabel) > manualRank(input.manualLabel) &&
    rank(input.fixedLabel) > manualRank(input.manualLabel) &&
    rank(input.learningLabel) > manualRank(input.manualLabel)
  if (allHarderThanManual || issueTypes.includes('raw_numbers_too_high')) {
    return 'high'
  }
  if (issueTypes.includes('ai_strategy_gap') || issueTypes.includes('static_ai_disagreement')) {
    return 'medium'
  }
  return 'low'
}

export function createBalanceDesignRecommendation(
  input: BalanceDesignRecommendationInput,
): BalanceDesignRecommendation {
  if (input.manualLabel === 'unrated') {
    return {
      severity: 'none',
      issueTypes: [],
      confidence: 'low',
      summary: `静态 ${input.staticLabel}，固定策略 AI ${input.fixedLabel}，学习型 AI ${input.learningLabel}，人工目标 unrated。`,
      suggestions: ['暂无人工基线，先只展示静态数值、固定策略 AI、学习型 AI 的分层结果，不输出削弱或增强建议。'],
    }
  }

  const manual = manualRank(input.manualLabel)
  const staticGap = rank(input.staticLabel) - manual
  const fixedGap = rank(input.fixedLabel) - manual
  const learningGap = rank(input.learningLabel) - manual
  const maxHarderGap = Math.max(staticGap, fixedGap, learningGap)
  const maxEasierGap = Math.max(-staticGap, -fixedGap, -learningGap)
  const issueTypes: BalanceRecommendationIssueType[] = []
  const suggestions: string[] = []

  if (staticGap >= 1 && fixedGap >= 1 && learningGap >= 1) {
    issueTypes.push('raw_numbers_too_high')
    const hpReducePercent = clampPercent((input.staticMetrics.durationPressureRisk + input.staticMetrics.totalEnemyHp / 100) / 2)
    suggestions.push(`三层评测都高于人工目标，建议先只读反馈给策划：可尝试把总生命值或关键敌人生命值下调约 ${hpReducePercent}% 后重新测试。`)
  }

  if (staticGap <= -1 && fixedGap <= -1 && learningGap <= -1) {
    issueTypes.push('raw_numbers_too_low')
    suggestions.push('三层评测都低于人工目标，若人工记录确认仍偏简单，可考虑提高高价值敌人生命值、缩短低危循环间隔，或增加一个需要处理的中危技能。')
  }

  if (input.learningEffortScore >= 60 || input.learningExecutionLoadScore >= 45 || input.staticMetrics.mechanicRisk >= 45) {
    issueTypes.push('mechanic_execution_load')
    suggestions.push('学习型 AI 显示技巧或执行负载偏高，数值建议优先放在机制链的容错上：延长关键读条/引导窗口 200-500ms，降低同轮叠加伤害，或减少必须同时监控的目标。')
  }

  if (input.fixedBestPassRate + 0.25 < input.learningBestPassRate || (fixedGap >= 2 && learningGap <= 0)) {
    issueTypes.push('ai_strategy_gap')
    suggestions.push('固定策略 AI 明显弱于学习型 AI 时，先检查 AI 是否缺少目标优先级、打断保留或机制链策略；给策划的反馈更适合写成教学提示，而不是直接要求削弱数值。')
  }

  if (input.halfBestBuildCount <= 1 && input.learningBestPassRate > 0) {
    issueTypes.push('build_dependency')
    suggestions.push('可行 build 很窄，建议检查是否需要在教程、默认 build 或技能解锁提示中强调关键技能/天赋；若不希望构筑检查过强，可给替代技能增加约 10%-20% 的容错空间。')
  }

  if (Math.abs(staticGap - learningGap) >= 2 || Math.abs(staticGap - fixedGap) >= 2) {
    issueTypes.push('static_ai_disagreement')
    suggestions.push('静态评分与模拟结果差异较大时，优先把它当作诊断信号：检查静态公式是否漏算工具覆盖、目标结构、治疗/自动伤害，或检查模拟 AI 是否没学会该关核心打法。')
  }

  if (suggestions.length === 0) {
    suggestions.push('三层评测没有给出明确数值调整信号，建议保持当前策划表，仅在人工测试继续积累后再调整。')
  }

  const uniqueIssueTypes = unique(issueTypes)
  const severity =
    uniqueIssueTypes.length === 0
      ? 'none'
      : uniqueIssueTypes.includes('raw_numbers_too_high') && uniqueIssueTypes.includes('mechanic_execution_load')
        ? 'high'
      : severityFromGap(Math.max(maxHarderGap, maxEasierGap))

  return {
    severity,
    issueTypes: uniqueIssueTypes,
    confidence: confidenceFor(input, uniqueIssueTypes),
    summary: `静态 ${input.staticLabel}，固定策略 AI ${input.fixedLabel}，学习型 AI ${input.learningLabel}，人工目标 ${input.manualLabel}。`,
    suggestions,
  }
}
