export type DifficultyLabel =
  | 'trivial'
  | 'easy'
  | 'balanced'
  | 'hard'
  | 'expert'
  | 'near_impossible'
  | 'impossible'
  | 'invalid_data'

export type BalanceProfileTier = 'average' | 'skilled' | 'expert'

export interface BalanceScenarioResult {
  stageId: string
  profileId: string
  profileTier: BalanceProfileTier
  buildId: string
  attempts: number
  victories: number
  passRate: number
}

export interface DifficultyRating {
  label: DifficultyLabel
  averageBestPassRate: number
  skilledBestPassRate: number
  expertBestPassRate: number
  overallBestPassRate: number
  halfBestBuildCount: number
  sparePointHalfBestBuildCount: number
  reasons: string[]
}

export interface DifficultyScoringOptions {
  buildRemainingPoints?: Record<string, number>
  flexibilityMinimumSparePoints?: number
}

const PROFILE_TIERS: BalanceProfileTier[] = ['average', 'skilled', 'expert']

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function bestPassRatesByProfileForTier(results: readonly BalanceScenarioResult[], tier: BalanceProfileTier) {
  const tierResults = results.filter((result) => result.profileTier === tier)
  const bestByProfile = new Map<string, number>()

  for (const result of tierResults) {
    bestByProfile.set(result.profileId, Math.max(bestByProfile.get(result.profileId) ?? 0, result.passRate))
  }

  return [...bestByProfile.values()]
}

function bestPassRateForTier(results: readonly BalanceScenarioResult[], tier: BalanceProfileTier) {
  const rates = bestPassRatesByProfileForTier(results, tier)
  return rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0
}

function hasSamplesForTier(results: readonly BalanceScenarioResult[], tier: BalanceProfileTier) {
  return results.some((result) => result.profileTier === tier && result.attempts > 0)
}

function hasAnyValidAttempt(results: readonly BalanceScenarioResult[]) {
  return results.some((result) => result.attempts > 0 && Number.isFinite(result.passRate))
}

function getBuildSpreadReason(results: readonly BalanceScenarioResult[]) {
  const ratesByBuild = new Map<string, number[]>()

  for (const result of results) {
    ratesByBuild.set(result.buildId, [...(ratesByBuild.get(result.buildId) ?? []), result.passRate])
  }

  const buildBestRates = [...ratesByBuild.entries()]
    .map(([buildId, passRates]) => ({
      buildId,
      passRate: Math.max(...passRates),
    }))
    .sort((left, right) => right.passRate - left.passRate)

  if (buildBestRates.length <= 1) {
    return '单 build 样本；难度标签仅根据 profile 通过率区间判断'
  }

  const best = buildBestRates[0]
  const worst = buildBestRates[buildBestRates.length - 1]
  return `build 差异：${best.buildId} 最高 ${formatPercent(best.passRate)}，${worst.buildId} 最高 ${formatPercent(worst.passRate)}`
}

function getBestPassRateByBuild(results: readonly BalanceScenarioResult[]) {
  const bestPassRateByBuild = new Map<string, number>()
  for (const result of results) {
    bestPassRateByBuild.set(result.buildId, Math.max(bestPassRateByBuild.get(result.buildId) ?? 0, result.passRate))
  }

  return bestPassRateByBuild
}

function getHalfBestBuildStats(
  results: readonly BalanceScenarioResult[],
  options: DifficultyScoringOptions,
) {
  const bestPassRateByBuild = getBestPassRateByBuild(results)
  const overallBestBuildPassRate = [...bestPassRateByBuild.values()].reduce((best, rate) => Math.max(best, rate), 0)
  if (overallBestBuildPassRate <= 0) {
    return {
      overallBestBuildPassRate,
      halfBestThreshold: 0,
      halfBestBuildCount: 0,
      sparePointHalfBestBuildCount: 0,
      minimumSparePoints: Math.max(0, options.flexibilityMinimumSparePoints ?? 4),
    }
  }

  const halfBestThreshold = overallBestBuildPassRate / 2
  const buildRemainingPoints = options.buildRemainingPoints ?? {}
  const minimumSparePoints = Math.max(0, options.flexibilityMinimumSparePoints ?? 4)
  const halfBestBuilds = [...bestPassRateByBuild.entries()].filter(([, passRate]) => passRate >= halfBestThreshold)
  const sparePointHalfBestBuilds = halfBestBuilds.filter(([buildId]) => (buildRemainingPoints[buildId] ?? 0) >= minimumSparePoints)

  return {
    overallBestBuildPassRate,
    halfBestThreshold,
    halfBestBuildCount: halfBestBuilds.length,
    sparePointHalfBestBuildCount: sparePointHalfBestBuilds.length,
    minimumSparePoints,
  }
}

function stepDownDifficulty(label: DifficultyLabel): DifficultyLabel {
  switch (label) {
    case 'trivial':
      return 'trivial'
    case 'easy':
      return 'trivial'
    case 'balanced':
      return 'easy'
    case 'hard':
      return 'balanced'
    case 'expert':
      return 'hard'
    case 'near_impossible':
      return 'expert'
    default:
      return label
  }
}

function labelFromPassRates({
  averageBest,
  skilledBest,
  expertBest,
  overallBest,
  hasSkilledSamples,
  hasExpertSamples,
}: {
  averageBest: number
  skilledBest: number
  expertBest: number
  overallBest: number
  hasSkilledSamples: boolean
  hasExpertSamples: boolean
}): DifficultyLabel {
  if (overallBest <= 0) {
    return 'impossible'
  }

  if (hasExpertSamples && hasSkilledSamples && expertBest < 0.2 && skilledBest < 0.1) {
    return 'near_impossible'
  }

  if (averageBest >= 0.95) {
    return 'trivial'
  }

  if (averageBest >= 0.8) {
    return 'easy'
  }

  if (averageBest >= 0.55) {
    return 'balanced'
  }

  if (averageBest >= 0.25 || skilledBest >= 0.55) {
    return 'hard'
  }

  if (expertBest >= 0.35 || skilledBest >= 0.2) {
    return 'expert'
  }

  return 'near_impossible'
}

export function classifyDifficultyFromPassRates(
  results: readonly BalanceScenarioResult[],
  options: DifficultyScoringOptions = {},
): DifficultyRating {
  if (results.length === 0 || !hasAnyValidAttempt(results)) {
    return {
      label: 'invalid_data',
      averageBestPassRate: 0,
      skilledBestPassRate: 0,
      expertBestPassRate: 0,
      overallBestPassRate: 0,
      halfBestBuildCount: 0,
      sparePointHalfBestBuildCount: 0,
      reasons: ['没有有效通过率样本'],
    }
  }

  const averageBest = bestPassRateForTier(results, 'average')
  const skilledBest = bestPassRateForTier(results, 'skilled')
  const expertBest = bestPassRateForTier(results, 'expert')
  const hasSkilledSamples = hasSamplesForTier(results, 'skilled')
  const hasExpertSamples = hasSamplesForTier(results, 'expert')
  const overallBest = Math.max(...PROFILE_TIERS.map((tier) => bestPassRateForTier(results, tier)))
  const baseLabel = labelFromPassRates({
    averageBest,
    skilledBest,
    expertBest,
    overallBest,
    hasSkilledSamples,
    hasExpertSamples,
  })
  const halfBestStats = getHalfBestBuildStats(results, options)
  const flexibilityAdjustment = halfBestStats.sparePointHalfBestBuildCount > 0 ? halfBestStats : null
  const label =
    flexibilityAdjustment && baseLabel !== 'impossible'
      ? stepDownDifficulty(baseLabel)
      : baseLabel

  return {
    label,
    averageBestPassRate: averageBest,
    skilledBestPassRate: skilledBest,
    expertBestPassRate: expertBest,
    overallBestPassRate: overallBest,
    halfBestBuildCount: halfBestStats.halfBestBuildCount,
    sparePointHalfBestBuildCount: halfBestStats.sparePointHalfBestBuildCount,
    reasons: [
      `average 最佳通过率：${formatPercent(averageBest)}`,
      `skilled 最佳通过率：${formatPercent(skilledBest)}`,
      `expert 最佳通过率：${formatPercent(expertBest)}`,
      '各操作档位通过率取该档位内每个 profile 的最佳合法 build 后再平均',
      `半最优 build 数量：${halfBestStats.halfBestBuildCount}，阈值 ${formatPercent(halfBestStats.halfBestThreshold)}`,
      ...(flexibilityAdjustment
        ? [
            `build 宽容度修正：${flexibilityAdjustment.sparePointHalfBestBuildCount} 个空余 ${flexibilityAdjustment.minimumSparePoints}+ 技能点的 build 达到最优 build 通过率的一半以上`,
          ]
        : []),
      getBuildSpreadReason(results),
    ],
  }
}
