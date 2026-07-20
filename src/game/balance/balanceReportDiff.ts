export interface DiffableBalanceStage {
  stageId: string
  manualLabel?: string
  staticScore?: {
    label?: string
    score?: number
  }
  fixedAnalysis?: {
    rating?: {
      label?: string
      overallBestPassRate?: number
    }
  }
  learningAnalysis?: {
    learningDifficultyRating?: {
      label?: string
      bestPassRate?: number
    }
  }
}

export interface DiffableBalanceReport {
  generatedAt: string
  stages: DiffableBalanceStage[]
}

export interface BalanceStageDiff {
  stageId: string
  staticLabelDelta: string
  fixedLabelDelta: string
  learningLabelDelta: string
  fixedPassRateDelta: number
  learningPassRateDelta: number
}

export interface BalanceReportDiff {
  previousGeneratedAt: string
  currentGeneratedAt: string
  changedStages: BalanceStageDiff[]
  addedStageIds: string[]
  removedStageIds: string[]
}

function stageMap(report: DiffableBalanceReport) {
  return new Map(report.stages.map((stage) => [stage.stageId, stage]))
}

function labelDelta(previousLabel?: string, currentLabel?: string) {
  const previous = previousLabel ?? 'unknown'
  const current = currentLabel ?? 'unknown'
  return previous === current ? '' : `${previous} -> ${current}`
}

function numericDelta(previousValue = 0, currentValue = 0) {
  return Number((currentValue - previousValue).toFixed(4))
}

function hasMeaningfulChange(diff: BalanceStageDiff) {
  return Boolean(
    diff.staticLabelDelta ||
      diff.fixedLabelDelta ||
      diff.learningLabelDelta ||
      Math.abs(diff.fixedPassRateDelta) >= 0.005 ||
      Math.abs(diff.learningPassRateDelta) >= 0.005,
  )
}

export function summarizeBalanceReportDiff(
  previousReport: DiffableBalanceReport,
  currentReport: DiffableBalanceReport,
): BalanceReportDiff {
  const previousStages = stageMap(previousReport)
  const currentStages = stageMap(currentReport)
  const changedStages: BalanceStageDiff[] = []

  for (const [stageId, currentStage] of currentStages) {
    const previousStage = previousStages.get(stageId)
    if (!previousStage) {
      continue
    }

    const diff: BalanceStageDiff = {
      stageId,
      staticLabelDelta: labelDelta(previousStage.staticScore?.label, currentStage.staticScore?.label),
      fixedLabelDelta: labelDelta(previousStage.fixedAnalysis?.rating?.label, currentStage.fixedAnalysis?.rating?.label),
      learningLabelDelta: labelDelta(
        previousStage.learningAnalysis?.learningDifficultyRating?.label,
        currentStage.learningAnalysis?.learningDifficultyRating?.label,
      ),
      fixedPassRateDelta: numericDelta(
        previousStage.fixedAnalysis?.rating?.overallBestPassRate,
        currentStage.fixedAnalysis?.rating?.overallBestPassRate,
      ),
      learningPassRateDelta: numericDelta(
        previousStage.learningAnalysis?.learningDifficultyRating?.bestPassRate,
        currentStage.learningAnalysis?.learningDifficultyRating?.bestPassRate,
      ),
    }

    if (hasMeaningfulChange(diff)) {
      changedStages.push(diff)
    }
  }

  return {
    previousGeneratedAt: previousReport.generatedAt,
    currentGeneratedAt: currentReport.generatedAt,
    changedStages: changedStages.sort((left, right) => left.stageId.localeCompare(right.stageId)),
    addedStageIds: currentReport.stages
      .map((stage) => stage.stageId)
      .filter((stageId) => !previousStages.has(stageId))
      .sort(),
    removedStageIds: previousReport.stages
      .map((stage) => stage.stageId)
      .filter((stageId) => !currentStages.has(stageId))
      .sort(),
  }
}

function formatDeltaPercent(value: number) {
  const rounded = Math.round(value * 100)
  return `${rounded >= 0 ? '+' : ''}${rounded}%`
}

function formatLabelDelta(value: string) {
  return value || 'no change'
}

function formatStageList(label: string, stageIds: string[]) {
  if (stageIds.length === 0) {
    return `${label}：无`
  }

  return `${label}：${stageIds.map((stageId) => `\`${stageId}\``).join('、')}`
}

export function renderBalanceReportDiffMarkdown(diff: BalanceReportDiff) {
  const lines = [
    '# 自动评分差异报告',
    '',
    `旧报告时间：${diff.previousGeneratedAt}`,
    `新报告时间：${diff.currentGeneratedAt}`,
    '',
    formatStageList('新增关卡', diff.addedStageIds),
    formatStageList('移除关卡', diff.removedStageIds),
    '',
    '| 关卡 | 静态评分 | 固定策略 AI | 学习型 AI | 固定 AI 通过率变化 | 学习 AI 通过率变化 |',
    '| --- | --- | --- | --- | ---: | ---: |',
  ]

  if (diff.changedStages.length === 0) {
    lines.push('| 无变化 | no change | no change | no change | 0% | 0% |')
  } else {
    lines.push(
      ...diff.changedStages.map((stage) =>
        `| \`${stage.stageId}\` | \`${formatLabelDelta(stage.staticLabelDelta)}\` | \`${formatLabelDelta(stage.fixedLabelDelta)}\` | \`${formatLabelDelta(stage.learningLabelDelta)}\` | \`${formatDeltaPercent(stage.fixedPassRateDelta)}\` | \`${formatDeltaPercent(stage.learningPassRateDelta)}\` |`,
      ),
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}
