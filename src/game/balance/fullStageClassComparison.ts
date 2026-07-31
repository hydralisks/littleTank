const DIFFICULTY_ORDER = [
  'trivial',
  'easy',
  'balanced',
  'hard',
  'expert',
  'near_impossible',
  'impossible',
  'invalid_data',
] as const

type ComparedClassId = 'warrior_t' | 'druid_bear_t'

interface BestBuildInput {
  profileId?: string
  profileTier?: string
  buildId?: string
  passRate?: number
  loadout?: Record<string, string | null>
  passiveTalentIds?: string[]
}

interface FullStageBalanceStageInput {
  stageId: string
  classId: string
  buildRuleId?: string
  manualLabel?: string
  automatedLabel?: string
  fixedAnalysis?: {
    rating?: {
      label?: string
      overallBestPassRate?: number
      averageBestPassRate?: number
      skilledBestPassRate?: number
      expertBestPassRate?: number
    }
  }
  learningAnalysis?: {
    learningDifficultyRating?: {
      label?: string
      bestPassRate?: number
      executionLoad?: {
        label?: string
        score?: number
      }
    }
  }
  bestBuildsByProfile?: BestBuildInput[]
  ratingReasons?: string[]
  recommendation?: unknown
}

export interface FullStageBalanceInput {
  generatedAt: string
  stages: FullStageBalanceStageInput[]
}

export interface FullStageBestBuild {
  buildId: string
  profileId: string
  profileTier: string
  passRate: number
  loadout: Record<string, string | null>
  passiveTalentIds: string[]
}

export interface FullStageClassComparisonRow {
  stageId: string
  buildRuleId: string
  warriorPassRate: number | null
  bearPassRate: number | null
  passRateDifference: number | null
  warriorAveragePassRate: number | null
  bearAveragePassRate: number | null
  warriorSkilledPassRate: number | null
  bearSkilledPassRate: number | null
  warriorExpertPassRate: number | null
  bearExpertPassRate: number | null
  warriorLearningPassRate: number | null
  bearLearningPassRate: number | null
  warriorDifficulty: string | null
  bearDifficulty: string | null
  warriorManualDifficulty: string | null
  bearManualDifficulty: string | null
  warriorOperationLabel: string | null
  bearOperationLabel: string | null
  warriorOperationScore: number | null
  bearOperationScore: number | null
  warriorBestBuild: FullStageBestBuild | null
  bearBestBuild: FullStageBestBuild | null
  warriorFailureSignals: string[]
  bearFailureSignals: string[]
  flags: string[]
}

export interface FullStageClassComparison {
  generatedAt: string
  sourceResultCount: number
  rows: FullStageClassComparisonRow[]
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeDifficultyLabel(label: string | undefined | null) {
  if (!label) return null
  return label === 'balance' ? 'balanced' : label
}

function difficultyIndex(label: string | null) {
  if (!label) return -1
  return DIFFICULTY_ORDER.indexOf(label as (typeof DIFFICULTY_ORDER)[number])
}

function hasDifficultyGap(left: string | null, right: string | null) {
  const leftIndex = difficultyIndex(left)
  const rightIndex = difficultyIndex(right)
  return leftIndex >= 0 && rightIndex >= 0 && Math.abs(leftIndex - rightIndex) > 1
}

function stageSortKey(stageId: string) {
  const group = stageId.startsWith('Challenge-')
    ? 0
    : stageId.startsWith('WestFall-')
      ? 1
      : stageId.startsWith("Zul'Aman-")
        ? 2
        : 3
  const stageNumber = Number(stageId.match(/-(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER)
  return [group, stageNumber, stageId] as const
}

function compareStageIds(left: string, right: string) {
  const leftKey = stageSortKey(left)
  const rightKey = stageSortKey(right)
  return leftKey[0] - rightKey[0] || leftKey[1] - rightKey[1] || leftKey[2].localeCompare(rightKey[2])
}

function selectBestBuild(stage: FullStageBalanceStageInput | undefined): FullStageBestBuild | null {
  const candidates = stage?.bestBuildsByProfile ?? []
  const best = [...candidates].sort((left, right) => (right.passRate ?? 0) - (left.passRate ?? 0))[0]
  if (!best) return null
  return {
    buildId: String(best.buildId ?? 'unknown'),
    profileId: String(best.profileId ?? 'unknown'),
    profileTier: String(best.profileTier ?? 'unknown'),
    passRate: finiteNumber(best.passRate) ?? 0,
    loadout: best.loadout ?? {},
    passiveTalentIds: best.passiveTalentIds ?? [],
  }
}

function getFailureSignals(stage: FullStageBalanceStageInput | undefined) {
  return (stage?.ratingReasons ?? []).map(String)
}

function summarizeStageClass(stage: FullStageBalanceStageInput | undefined) {
  const fixedRating = stage?.fixedAnalysis?.rating
  const learningRating = stage?.learningAnalysis?.learningDifficultyRating
  return {
    passRate: finiteNumber(fixedRating?.overallBestPassRate),
    averagePassRate: finiteNumber(fixedRating?.averageBestPassRate),
    skilledPassRate: finiteNumber(fixedRating?.skilledBestPassRate),
    expertPassRate: finiteNumber(fixedRating?.expertBestPassRate),
    learningPassRate: finiteNumber(learningRating?.bestPassRate),
    difficulty: normalizeDifficultyLabel(fixedRating?.label ?? stage?.automatedLabel),
    manualDifficulty: normalizeDifficultyLabel(stage?.manualLabel),
    operationLabel: learningRating?.executionLoad?.label ?? null,
    operationScore: finiteNumber(learningRating?.executionLoad?.score),
    bestBuild: selectBestBuild(stage),
    failureSignals: getFailureSignals(stage),
  }
}

export function buildFullStageClassComparison(input: FullStageBalanceInput): FullStageClassComparison {
  const stageIds = [...new Set(input.stages.map((stage) => stage.stageId))].sort(compareStageIds)
  const rows = stageIds.map((stageId): FullStageClassComparisonRow => {
    const findClass = (classId: ComparedClassId) => input.stages.find(
      (stage) => stage.stageId === stageId && stage.classId === classId,
    )
    const warriorStage = findClass('warrior_t')
    const bearStage = findClass('druid_bear_t')
    const warrior = summarizeStageClass(warriorStage)
    const bear = summarizeStageClass(bearStage)
    const flags: string[] = []

    if (!warriorStage || !bearStage) {
      flags.push('missing_class_result')
    } else {
      if (warrior.passRate !== null && bear.passRate !== null && Math.abs(bear.passRate - warrior.passRate) > 0.15) {
        flags.push('pass_rate_gap')
      }
      if (hasDifficultyGap(warrior.difficulty, bear.difficulty)) {
        flags.push('difficulty_gap_over_one_tier')
      }
      if (hasDifficultyGap(warrior.manualDifficulty, warrior.difficulty)) {
        flags.push('warrior_manual_auto_gap')
      }
      if (hasDifficultyGap(bear.manualDifficulty, bear.difficulty)) {
        flags.push('bear_manual_auto_gap')
      }
    }

    return {
      stageId,
      buildRuleId: warriorStage?.buildRuleId ?? bearStage?.buildRuleId ?? '',
      warriorPassRate: warrior.passRate,
      bearPassRate: bear.passRate,
      passRateDifference: warrior.passRate !== null && bear.passRate !== null
        ? round(bear.passRate - warrior.passRate)
        : null,
      warriorAveragePassRate: warrior.averagePassRate,
      bearAveragePassRate: bear.averagePassRate,
      warriorSkilledPassRate: warrior.skilledPassRate,
      bearSkilledPassRate: bear.skilledPassRate,
      warriorExpertPassRate: warrior.expertPassRate,
      bearExpertPassRate: bear.expertPassRate,
      warriorLearningPassRate: warrior.learningPassRate,
      bearLearningPassRate: bear.learningPassRate,
      warriorDifficulty: warrior.difficulty,
      bearDifficulty: bear.difficulty,
      warriorManualDifficulty: warrior.manualDifficulty,
      bearManualDifficulty: bear.manualDifficulty,
      warriorOperationLabel: warrior.operationLabel,
      bearOperationLabel: bear.operationLabel,
      warriorOperationScore: warrior.operationScore,
      bearOperationScore: bear.operationScore,
      warriorBestBuild: warrior.bestBuild,
      bearBestBuild: bear.bestBuild,
      warriorFailureSignals: warrior.failureSignals,
      bearFailureSignals: bear.failureSignals,
      flags,
    }
  })

  return {
    generatedAt: input.generatedAt,
    sourceResultCount: input.stages.length,
    rows,
  }
}

function formatPercent(value: number | null) {
  return value === null ? 'N/A' : `${Math.round(value * 10_000) / 100}%`
}

function average(values: Array<number | null>) {
  const finiteValues = values.filter((value): value is number => value !== null)
  if (finiteValues.length === 0) return null
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
}

function describePassRateGap(row: FullStageClassComparisonRow) {
  if (row.passRateDifference === null) return `${row.stageId}（缺少结果）`
  const direction = row.passRateDifference >= 0 ? '熊高' : '熊低'
  return `${row.stageId}（${direction} ${formatPercent(Math.abs(row.passRateDifference))}）`
}

function renderRiskSummary(report: FullStageClassComparison) {
  const lines = ['## 结论与风险', '']
  const groups = [
    ['挑战 1~9', (stageId: string) => stageId.startsWith('Challenge-')],
    ['WF 1~6', (stageId: string) => stageId.startsWith('WestFall-')],
    ['ZA 1~6', (stageId: string) => stageId.startsWith("Zul'Aman-")],
  ] as const

  for (const [title, matches] of groups) {
    const rows = report.rows.filter((row) => matches(row.stageId))
    if (rows.length === 0) continue
    const warriorInTarget = rows.filter((row) => row.warriorPassRate !== null
      && row.warriorPassRate >= 0.4 && row.warriorPassRate <= 0.9).length
    const bearInTarget = rows.filter((row) => row.bearPassRate !== null
      && row.bearPassRate >= 0.4 && row.bearPassRate <= 0.9).length
    lines.push(`- ${title}：固定策略平均通过率为战士 ${formatPercent(average(rows.map((row) => row.warriorPassRate)))}、熊 ${formatPercent(average(rows.map((row) => row.bearPassRate)))}；处于 40%~90% 目标区间的关卡为战士 ${warriorInTarget}/${rows.length}、熊 ${bearInTarget}/${rows.length}。`)
  }

  const passRateGaps = report.rows.filter((row) => row.flags.includes('pass_rate_gap'))
  lines.push(`- 通过率高风险差（绝对值超过 15%）：${passRateGaps.length > 0
    ? passRateGaps.map(describePassRateGap).join('、')
    : '无'}。`)

  const difficultyGaps = report.rows
    .filter((row) => row.flags.includes('difficulty_gap_over_one_tier'))
    .map((row) => row.stageId)
  lines.push(`- 职业自动难度相差超过一级：${difficultyGaps.join('、') || '无'}。`)

  const manualAutoGaps = report.rows.filter((row) => row.flags.some((flag) => flag.endsWith('_manual_auto_gap')))
  lines.push(`- 人工与自动难度相差超过一级：${manualAutoGaps.map((row) => row.stageId).join('、') || '无'}；这类结果应先复核 AI 策略覆盖和人工构筑，再决定是否调整职业数值。`)
  lines.push('')
  return lines
}

function formatDifficulty(automated: string | null, manual: string | null) {
  return `${automated ?? 'N/A'} / ${manual ?? 'N/A'}`
}

function groupTitle(stageId: string) {
  if (stageId.startsWith('Challenge-')) return '挑战 1~9'
  if (stageId.startsWith('WestFall-')) return 'WF 1~6'
  if (stageId.startsWith("Zul'Aman-")) return 'ZA 1~6'
  return '其他关卡'
}

export function renderFullStageClassComparisonMarkdown(report: FullStageClassComparison) {
  const lines = [
    '# 熊 T / 战士 T 全关卡完整预算对比',
    '',
    `生成时间：${report.generatedAt}`,
    '',
    `原始职业结果：${report.sourceResultCount}；关卡行：${report.rows.length}`,
    '',
    ...renderRiskSummary(report),
  ]

  for (const title of ['挑战 1~9', 'WF 1~6', 'ZA 1~6', '其他关卡']) {
    const rows = report.rows.filter((row) => groupTitle(row.stageId) === title)
    if (rows.length === 0) continue
    lines.push(`## ${title}`, '')
    lines.push('| 关卡 | 战士固定 | 熊固定 | 熊-战士 | 战士学习 | 熊学习 | 战士操作分 | 熊操作分 | 战士自动/人工 | 熊自动/人工 | 标记 |')
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |')
    for (const row of rows) {
      lines.push(`| ${row.stageId} | ${formatPercent(row.warriorPassRate)} | ${formatPercent(row.bearPassRate)} | ${formatPercent(row.passRateDifference)} | ${formatPercent(row.warriorLearningPassRate)} | ${formatPercent(row.bearLearningPassRate)} | ${row.warriorOperationScore ?? 'N/A'} | ${row.bearOperationScore ?? 'N/A'} | ${formatDifficulty(row.warriorDifficulty, row.warriorManualDifficulty)} | ${formatDifficulty(row.bearDifficulty, row.bearManualDifficulty)} | ${row.flags.join(', ') || '-'} |`)
    }
    lines.push('')
  }

  lines.push('## 最佳构筑记录', '')
  for (const row of report.rows) {
    lines.push(`### ${row.stageId}`, '')
    for (const [label, build] of [['战士 T', row.warriorBestBuild], ['熊 T', row.bearBestBuild]] as const) {
      if (!build) {
        lines.push(`- ${label}：缺少结果`)
        continue
      }
      const activeIds = Object.values(build.loadout).filter((skillId): skillId is string => Boolean(skillId))
      lines.push(`- ${label}：${build.buildId}，最佳样本 ${formatPercent(build.passRate)}；主动 ${activeIds.join('、') || '无'}；被动 ${build.passiveTalentIds.join('、') || '无'}`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}
