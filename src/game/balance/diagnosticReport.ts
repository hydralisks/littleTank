import type { DiagnosticScenarioSummary } from './diagnosticScenarioSummary'

interface DiagnosticScenarioReportEntry {
  profileId: string
  buildId: string
  passRate: number
  diagnosticSummary?: DiagnosticScenarioSummary
}

const ACTION_LABELS: Record<string, string> = {
  try_tank_damage_source_focus: '坦克承伤来源处理',
  try_pressure_source_focus: '压力来源处理',
  try_high_danger_interrupt_focus: '高危读条处理优先级',
  try_enemy_healer_focus: '敌方治疗处理',
  try_later_healing_windows: '治疗窗口后移',
  review_absorb_timing_or_value: '吸收时机或数值复核',
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatMetric(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

function actionLabels(actionIds: readonly string[]) {
  return actionIds.map((id) => ACTION_LABELS[id] ?? id).join('、')
}

interface AggregatedSignalRow {
  id: string
  attempts: number
  attemptsWithSignal: number
  failureAttempts: number
  victoryAttempts: number
  failureAttemptsWithSignal: number
  victoryAttemptsWithSignal: number
  metricOnDefeatTotal: number
  maxMetric: number
  internalActionIds: string[]
}

function confidenceFor(attempts: number, attemptsWithSignal: number) {
  if (attempts >= 10 && attemptsWithSignal >= 3) {
    return 'high'
  }

  if (attempts >= 2 && attemptsWithSignal >= 2) {
    return 'medium'
  }

  return 'low'
}

function aggregateSignals(entries: readonly DiagnosticScenarioReportEntry[]) {
  const rows = new Map<string, AggregatedSignalRow>()

  for (const entry of entries) {
    const summary = entry.diagnosticSummary
    if (!summary) {
      continue
    }

    const failureAttempts = Math.max(0, summary.attempts - summary.victories)
    for (const signal of summary.signals) {
      const current = rows.get(signal.id) ?? {
        id: signal.id,
        attempts: 0,
        attemptsWithSignal: 0,
        failureAttempts: 0,
        victoryAttempts: 0,
        failureAttemptsWithSignal: 0,
        victoryAttemptsWithSignal: 0,
        metricOnDefeatTotal: 0,
        maxMetric: 0,
        internalActionIds: [],
      }
      const failureAttemptsWithSignal = signal.defeatRate * failureAttempts
      const victoryAttemptsWithSignal = signal.victoryRate * summary.victories

      rows.set(signal.id, {
        ...current,
        attempts: current.attempts + summary.attempts,
        attemptsWithSignal: current.attemptsWithSignal + signal.attemptsWithSignal,
        failureAttempts: current.failureAttempts + failureAttempts,
        victoryAttempts: current.victoryAttempts + summary.victories,
        failureAttemptsWithSignal: current.failureAttemptsWithSignal + failureAttemptsWithSignal,
        victoryAttemptsWithSignal: current.victoryAttemptsWithSignal + victoryAttemptsWithSignal,
        metricOnDefeatTotal: current.metricOnDefeatTotal + signal.meanMetricOnDefeat * failureAttemptsWithSignal,
        maxMetric: Math.max(current.maxMetric, signal.maxMetric),
        internalActionIds: [...new Set([...current.internalActionIds, ...signal.internalActionIds])],
      })
    }
  }

  return [...rows.values()]
    .map((row) => {
      const defeatRate = row.failureAttempts > 0 ? row.failureAttemptsWithSignal / row.failureAttempts : 0
      const victoryRate = row.victoryAttempts > 0 ? row.victoryAttemptsWithSignal / row.victoryAttempts : 0
      const coverage = row.attempts > 0 ? row.attemptsWithSignal / row.attempts : 0
      return {
        ...row,
        coverage,
        defeatRate,
        victoryRate,
        meanMetricOnDefeat: row.failureAttemptsWithSignal > 0
          ? row.metricOnDefeatTotal / row.failureAttemptsWithSignal
          : 0,
        confidence: confidenceFor(row.attempts, row.attemptsWithSignal),
      }
    })
    .sort((left, right) =>
      right.defeatRate - left.defeatRate ||
      right.coverage - left.coverage ||
      left.id.localeCompare(right.id),
    )
    .slice(0, 3)
}

export function renderDiagnosticScenarioSummariesMarkdown(
  title: string,
  entries: readonly DiagnosticScenarioReportEntry[],
) {
  const rows = aggregateSignals(entries)

  if (rows.length === 0) {
    return [
      `## ${title}`,
      '',
      '暂无诊断样本。',
      '',
    ].join('\n')
  }

  return [
    `## ${title}`,
    '',
    '该表为内部自动测评使用，只展示聚合后的结构信号和候选 action，不作为玩家结算内容。',
    '',
    '| 诊断信号 | 样本覆盖 | 失败样本出现率 | 胜利样本出现率 | 失败均值 | 置信度 | 候选 action |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...rows.map((row) => `| \`${row.id}\` | ${formatPercent(row.coverage)} | ${formatPercent(row.defeatRate)} | ${formatPercent(row.victoryRate)} | ${formatMetric(row.meanMetricOnDefeat)} | \`${row.confidence}\` | ${actionLabels(row.internalActionIds)} |`),
    '',
  ].join('\n')
}
