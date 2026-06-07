import type { BalanceScenarioResult, DifficultyLabel } from './difficultyScoring'
import type { BalanceScoringMode, BestBuildProfileSummary } from './balanceSimulator'

export type ManualDifficultyLabel = DifficultyLabel | 'near_impossible / impossible'

export interface BalanceStageReport {
  stageId: string
  title: string
  manualLabel: ManualDifficultyLabel
  automatedLabel: DifficultyLabel
  scoringMode: BalanceScoringMode
  buildSearchMode?: 'single_phase' | 'two_phase'
  phaseOneBuildCount?: number
  finalBuildCount?: number
  testedBuildCount: number
  bestBuildsByProfile: BestBuildProfileSummary[]
  ratingReasons: string[]
  scenarios: BalanceScenarioResult[]
  recommendation: string
}

export interface BalanceReport {
  generatedAt: string
  stages: BalanceStageReport[]
}

export const RINGING_DEEPS_MANUAL_BASELINES: Record<string, ManualDifficultyLabel> = {
  'RingingDeeps-1': 'easy',
  'RingingDeeps-2': 'easy',
  'RingingDeeps-3': 'hard',
  'RingingDeeps-4': 'hard',
  'RingingDeeps-5': 'balanced',
  'RingingDeeps-6': 'expert',
}

export const WESTFALL_MANUAL_BASELINES: Record<string, ManualDifficultyLabel> = {
  'WestFall-1': 'easy',
  'WestFall-2': 'balanced',
  'WestFall-3': 'balanced',
  'WestFall-4': 'hard',
  'WestFall-5': 'balanced',
  'WestFall-6': 'hard',
}

export function getManualDifficultyBaseline(stageId: string): ManualDifficultyLabel {
  return WESTFALL_MANUAL_BASELINES[stageId] ?? RINGING_DEEPS_MANUAL_BASELINES[stageId] ?? 'unrated'
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function renderScenarioRow(result: BalanceScenarioResult) {
  return `| \`${result.profileId}\` | \`${result.profileTier}\` | \`${result.buildId}\` | ${result.victories}/${result.attempts} | ${formatPercent(result.passRate)} |`
}

const LOADOUT_HOTKEY_ORDER = ['1', '2', '3', '4', 'Q', 'E', 'R', 'F'] as const

function renderLoadout(loadout: BestBuildProfileSummary['loadout']) {
  const entries = LOADOUT_HOTKEY_ORDER.flatMap((hotkey) => {
    const skillId = loadout[hotkey]
    return skillId ? [`${hotkey}=${skillId}`] : []
  })

  return entries.length > 0 ? entries.join(', ') : '空'
}

function renderPassives(passiveTalentIds: BestBuildProfileSummary['passiveTalentIds']) {
  return passiveTalentIds.length > 0 ? passiveTalentIds.join(', ') : '无'
}

function renderBestBuildRow(summary: BestBuildProfileSummary) {
  return `| \`${summary.profileId}\` | \`${summary.profileTier}\` | \`${summary.buildId}\` | ${summary.victories}/${summary.attempts} | ${formatPercent(summary.passRate)} | ${renderLoadout(summary.loadout)} | ${renderPassives(summary.passiveTalentIds)} |`
}

function translateReason(reason: string) {
  const averageMatch = reason.match(/^average best pass rate: (.+)$/)
  if (averageMatch) {
    return `average 最佳通过率：${averageMatch[1]}`
  }

  const skilledMatch = reason.match(/^skilled best pass rate: (.+)$/)
  if (skilledMatch) {
    return `skilled 最佳通过率：${skilledMatch[1]}`
  }

  const expertMatch = reason.match(/^expert best pass rate: (.+)$/)
  if (expertMatch) {
    return `expert 最佳通过率：${expertMatch[1]}`
  }

  const halfBestMatch = reason.match(/^half-best build count: (\d+) at threshold (.+)$/)
  if (halfBestMatch) {
    return `半最优 build 数量：${halfBestMatch[1]}，阈值 ${halfBestMatch[2]}`
  }

  if (reason === 'tier pass rates average each profile winner inside that tier') {
    return '各操作档位通过率取该档位内每个 profile 的最佳合法 build 后再平均'
  }

  if (reason.startsWith('build flexibility adjustment:')) {
    return reason
      .replace(/^build flexibility adjustment:/, 'build 宽容度修正：')
      .replace(/ build\(s\) with /, ' 个空余 ')
      .replace(/\+ spare points reach at least half of the best build pass rate/, '+ 技能点的 build 达到最优 build 通过率的一半以上')
  }

  const buildSpreadMatch = reason.match(/^build spread: (.+) best (.+), (.+) best (.+)$/)
  if (buildSpreadMatch) {
    return `build 差异：${buildSpreadMatch[1]} 最高 ${buildSpreadMatch[2]}，${buildSpreadMatch[3]} 最高 ${buildSpreadMatch[4]}`
  }

  if (reason === 'single build sample; label is based on profile pass-rate bands') {
    return '单 build 样本；难度标签仅根据 profile 通过率区间判断'
  }

  return reason
}

function renderHalfBestBuildCount(stage: BalanceStageReport) {
  const translatedReasons = stage.ratingReasons.map(translateReason)
  const halfBestCount = translatedReasons.find((reason) => reason.startsWith('半最优 build 数量：'))
  return halfBestCount ?? `半最优 build 数量：${stage.bestBuildsByProfile.length}`
}

export function renderBalanceReportMarkdown(report: BalanceReport) {
  const lines = [
    '# RingingDeeps 平衡性报告',
    '',
    `生成时间：${report.generatedAt}`,
    '',
    '本报告仅用于只读分析。它只根据不同操作档位和 build 变体的通过率评估难度；策划表的修改必须由策划/设计方在 `public/designer-data` 中完成并重新导入。',
    '',
  ]

  for (const stage of report.stages) {
    lines.push(
      `## ${stage.stageId} - ${stage.title}`,
      '',
      `人工基线：\`${stage.manualLabel}\``,
      '',
      `自动标签：\`${stage.automatedLabel}\``,
      '',
      `评分模式：\`${stage.scoringMode}\``,
      '',
      ...(stage.buildSearchMode
        ? [
            `build 搜索模式：\`${stage.buildSearchMode}\``,
            `第一阶段 build 数：${stage.phaseOneBuildCount ?? stage.testedBuildCount}`,
            `最终 build 数：${stage.finalBuildCount ?? stage.testedBuildCount}`,
            '',
          ]
        : []),
      `测试 build 数：${stage.testedBuildCount}`,
      '',
      '最佳 build：',
      '',
      '| Profile | 档位 | Build | 通关 | 通过率 | 主动配置 | 被动天赋 |',
      '| --- | --- | --- | ---: | ---: | --- | --- |',
      ...stage.bestBuildsByProfile.map(renderBestBuildRow),
      '',
      renderHalfBestBuildCount(stage),
      '',
      '理由：',
      ...stage.ratingReasons.map((reason) => `- ${translateReason(reason)}`),
      '',
      `建议：${stage.recommendation}`,
      '',
      '| Profile | 档位 | Build | 通关 | 通过率 |',
      '| --- | --- | --- | ---: | ---: |',
      ...stage.scenarios.map(renderScenarioRow),
      '',
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}
