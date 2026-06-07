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
    .flatMap(([hotkey, skillId]) => (skillId ? [`${hotkey}=${skillId}`] : []))
    .join(', ') || 'none'
}

function renderPassives(passiveTalentIds: readonly string[]) {
  return passiveTalentIds.length > 0 ? passiveTalentIds.join(', ') : 'none'
}

function confidenceText(confidence: string) {
  if (confidence === 'high') {
    return '高'
  }
  if (confidence === 'medium') {
    return '中'
  }
  return '低'
}

function verdictText(verdict: string) {
  switch (verdict) {
    case 'strong_gain':
      return '强收益'
    case 'minor_gain':
      return '轻微收益'
    case 'regression':
      return '负收益'
    case 'neutral':
      return '接近持平'
    default:
      return '结论不足'
  }
}

function allComparisons(report: DeltaReport) {
  return report.stages.flatMap((stage) =>
    stage.comparisons.map((comparison) => ({
      ...comparison,
      stageId: stage.stageId,
    })),
  )
}

function renderCandidateList(
  title: string,
  rows: ReturnType<typeof allComparisons>,
  emptyText: string,
) {
  return [
    `### ${title}`,
    '',
    rows.length > 0
      ? rows
        .slice(0, 8)
        .map((comparison) =>
          `- \`${comparison.stageId}\`：${comparison.comparedVariantLabel}，通过率 ${formatPercent(comparison.baselinePassRate)} -> ${formatPercent(comparison.comparedPassRate)}，Delta ${formatPercent(comparison.passRateDelta)}，置信度：${confidenceText(comparison.confidence)}，结论：${verdictText(comparison.verdict)}。`,
        )
        .join('\n')
      : `- ${emptyText}`,
    '',
  ]
}

function renderDesignerSummary(report: DeltaReport) {
  const comparisons = allComparisons(report)
  const strong = comparisons
    .filter((comparison) => comparison.verdict === 'strong_gain')
    .sort((left, right) => right.passRateDelta - left.passRateDelta)
  const positiveLowConfidence = comparisons
    .filter((comparison) => comparison.verdict === 'minor_gain')
    .sort((left, right) => right.passRateDelta - left.passRateDelta)
  const weak = comparisons
    .filter((comparison) => comparison.verdict === 'regression')
    .sort((left, right) => left.passRateDelta - right.passRateDelta)
  const inconclusive = comparisons
    .filter((comparison) => comparison.verdict === 'inconclusive')
    .sort((left, right) => Math.abs(right.passRateDelta) - Math.abs(left.passRateDelta))

  return [
    '## 重点结论',
    '',
    '这一节把后续明细表中的 delta 结果翻译成策划可读的候选结论。`quick` 样本如果显示低置信度，只能说明“值得复核”，不能直接作为最终调参依据。',
    '',
    ...renderCandidateList('过强候选', strong, '本次样本没有达到中/高置信度的强收益候选。'),
    ...renderCandidateList('正收益但需要复核', positiveLowConfidence, '本次样本没有明显正收益候选。'),
    ...renderCandidateList('偏弱或负收益候选', weak, '本次样本没有明显负收益候选。'),
    ...renderCandidateList('结论不足但值得关注', inconclusive, '本次样本没有额外的结论不足项。'),
  ]
}

function renderFieldGuide() {
  return [
    '## 表格字段说明',
    '',
    '| 字段 | 含义 | 为什么重要 |',
    '| --- | --- | --- |',
    '| `Variant` | 当前被测试的被动、被动组合或 build 变体。 | 用来定位具体是哪一个天赋或组合造成差异。 |',
    '| `Pass rate` | 该变体在当前样本中的通关率。 | 直接衡量这个变体在现有 AI 评测下能否稳定过关。 |',
    '| `Delta` | 当前变体通关率减去 baseline 通关率。 | 这是判断“变强/变弱”的核心指标，比单看通关率更能说明边际贡献。 |',
    '| `Relative delta` | `Delta / baseline pass rate`。baseline 为 0 且变体非 0 时显示 `n/a`。 | 用来判断提升相对原方案有多大，尤其适合 baseline 已经较高或较低的情况。 |',
    '| `Confidence` | 按样本量和 delta 幅度给出的置信度：low / medium / high。 | 防止把 12 次 quick 样本的随机波动误读为确定结论。 |',
    '| `Verdict` | 自动归类：strong_gain、minor_gain、neutral、regression、inconclusive。 | 方便快速筛选过强候选、偏弱候选和需要复跑的项目。 |',
    '| `Reasons` | 生成 confidence 与 verdict 的简短依据。 | 帮助复查某个结论是因为 delta 大、样本少，还是因为两边都接近 0。 |',
    '| `Attempts` | 该变体本轮模拟次数。 | 样本越少，结果越容易受随机性影响。 |',
    '| `Victories` | 该变体通关次数。 | 与 Attempts 一起构成 Pass rate，也能看出 1 场胜负对结果影响多大。 |',
    '| `Passives` | 当前变体携带的被动天赋 ID。 | 用来核对测试内容是否正是要比较的天赋或组合。 |',
    '| `Loadout` | 当前变体携带的主动技能配置。 | delta 对照必须确认主动配置一致，否则无法判断差异来自被动还是主动技能。 |',
    '',
  ]
}

export function renderDeltaReportMarkdown(report: DeltaReport) {
  const lines = [
    '# Delta Analysis',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    'This report is read-only. It compares targeted build variants with the existing simulator and does not modify designer workbooks.',
    '',
    ...renderDesignerSummary(report),
    ...renderFieldGuide(),
    '## 关卡总览',
    '',
    '| 关卡 | Baseline | 强收益项 | 低置信度项 |',
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
      '下表逐项比较每个变体相对 baseline 的收益。重点看 `Delta`、`Confidence` 和 `Verdict`：Delta 说明收益方向和幅度，Confidence 说明样本是否足够可信，Verdict 给出自动归类。',
      '',
      '| Variant | Pass rate | Delta | Relative delta | Confidence | Verdict | Reasons |',
      '| --- | ---: | ---: | ---: | --- | --- | --- |',
      ...stage.comparisons.map((comparison) =>
        `| ${comparison.comparedVariantLabel} | ${formatPercent(comparison.comparedPassRate)} | ${formatPercent(comparison.passRateDelta)} | ${formatPercent(comparison.relativeDelta)} | \`${comparison.confidence}\` | \`${comparison.verdict}\` | ${comparison.reasons.join('<br>')} |`,
      ),
      '',
      '### Variants',
      '',
      '下表用于核对每个 variant 实际跑了什么配置。若两个 variant 的 `Loadout` 不同，则 delta 不能被解释为纯被动收益。',
      '',
      '| Variant | Kind | Attempts | Victories | Pass rate | Passives | Loadout |',
      '| --- | --- | ---: | ---: | ---: | --- | --- |',
      ...stage.scenarios.map((scenario) =>
        `| \`${scenario.variantId}\` | \`${scenario.variantKind}\` | ${scenario.attempts} | ${scenario.victories} | ${formatPercent(scenario.passRate)} | ${renderPassives(scenario.passiveTalentIds)} | ${renderLoadout(scenario.loadout)} |`,
      ),
      '',
    )

    const needsRerun = stage.comparisons.filter((comparison) => comparison.confidence === 'low')
    if (needsRerun.length > 0) {
      lines.push(
        '### Needs rerun',
        '',
        ...needsRerun.map((comparison) =>
          `- ${comparison.comparedVariantLabel}: rerun with \`--sample=standard\` or \`--sample=full\` before treating this as a tuning recommendation.`,
        ),
        '',
      )
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}
