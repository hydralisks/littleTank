import type { BalanceProfileTier } from './difficultyScoring'
import type { PlayerClassId } from '../encounter/encounterTypes'
import type { BalanceScenarioDataEstimate, TraceableBalanceScenarioResult } from './balanceSimulator'

export type DataEstimateScenarioMode = 'fixed' | 'learning'

export interface DataEstimateScenarioRow extends BalanceScenarioDataEstimate {
  stageId: string
  classId: PlayerClassId
  buildRuleId: string
  mode: DataEstimateScenarioMode
  profileId: string
  profileTier: BalanceProfileTier
  buildId: string
  passRate: number
}

export interface DataEstimateStageSummary extends BalanceScenarioDataEstimate {
  stageId: string
  classId: PlayerClassId
  buildRuleId: string
  title: string
  mode: DataEstimateScenarioMode
  profileId: string
  profileTier: BalanceProfileTier
  buildId: string
  passRate: number
}

export interface DataEstimateStageReport {
  stageId: string
  classId: PlayerClassId
  buildRuleId: string
  title: string
  summary: DataEstimateStageSummary
  scenarios: DataEstimateScenarioRow[]
}

export interface DataEstimateReport {
  generatedAt: string
  title: string
  stages: DataEstimateStageReport[]
}

interface BuildDataEstimateReportInput {
  generatedAt: string
  title: string
  stages: readonly {
    stageId: string
    classId: PlayerClassId
    buildRuleId: string
    title: string
    fixedAnalysis?: {
      scenarios?: readonly TraceableBalanceScenarioResult[]
    }
    learningAnalysis?: {
      finalAnalysis?: {
        scenarios?: readonly TraceableBalanceScenarioResult[]
      }
    }
  }[]
}

function roundMetric(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? roundMetric(value).toFixed(2) : '0.00'
}

function toScenarioRows(
  stageId: string,
  classId: PlayerClassId,
  buildRuleId: string,
  mode: DataEstimateScenarioMode,
  scenarios: readonly TraceableBalanceScenarioResult[] = [],
): DataEstimateScenarioRow[] {
  return scenarios.flatMap((scenario) => {
    if (!scenario.dataEstimate) {
      return []
    }

    return [{
      stageId,
      classId,
      buildRuleId,
      mode,
      profileId: scenario.profileId,
      profileTier: scenario.profileTier,
      buildId: scenario.buildId,
      passRate: scenario.passRate,
      attempts: scenario.dataEstimate.attempts,
      averageDurationSec: roundMetric(scenario.dataEstimate.averageDurationSec),
      playerResourcePerSec: roundMetric(scenario.dataEstimate.playerResourcePerSec),
      tankDamageTakenPerSec: roundMetric(scenario.dataEstimate.tankDamageTakenPerSec),
      healingAndAbsorbPerSec: roundMetric(scenario.dataEstimate.healingAndAbsorbPerSec),
      playerSideDamagePerSec: roundMetric(scenario.dataEstimate.playerSideDamagePerSec),
      partyPressurePerSec: roundMetric(scenario.dataEstimate.partyPressurePerSec),
    }]
  })
}

function selectReferenceScenario(rows: readonly DataEstimateScenarioRow[]) {
  return [...rows].sort((left, right) =>
    right.passRate - left.passRate ||
    left.tankDamageTakenPerSec - right.tankDamageTakenPerSec ||
    right.playerSideDamagePerSec - left.playerSideDamagePerSec ||
    left.mode.localeCompare(right.mode) ||
    left.buildId.localeCompare(right.buildId),
  )[0]
}

function emptySummary(
  stageId: string,
  classId: PlayerClassId,
  buildRuleId: string,
  title: string,
): DataEstimateStageSummary {
  return {
    stageId,
    classId,
    buildRuleId,
    title,
    mode: 'fixed',
    profileId: 'none',
    profileTier: 'average',
    buildId: 'none',
    passRate: 0,
    attempts: 0,
    averageDurationSec: 0,
    playerResourcePerSec: 0,
    tankDamageTakenPerSec: 0,
    healingAndAbsorbPerSec: 0,
    playerSideDamagePerSec: 0,
    partyPressurePerSec: 0,
  }
}

export function buildDataEstimateReport(input: BuildDataEstimateReportInput): DataEstimateReport {
  return {
    generatedAt: input.generatedAt,
    title: input.title,
    stages: input.stages.map((stage) => {
      const scenarios = [
        ...toScenarioRows(stage.stageId, stage.classId, stage.buildRuleId, 'fixed', stage.fixedAnalysis?.scenarios),
        ...toScenarioRows(
          stage.stageId,
          stage.classId,
          stage.buildRuleId,
          'learning',
          stage.learningAnalysis?.finalAnalysis?.scenarios,
        ),
      ]
      const reference = selectReferenceScenario(scenarios)
      const summary: DataEstimateStageSummary = reference
        ? {
            ...reference,
            title: stage.title,
          }
        : emptySummary(stage.stageId, stage.classId, stage.buildRuleId, stage.title)

      return {
        stageId: stage.stageId,
        classId: stage.classId,
        buildRuleId: stage.buildRuleId,
        title: stage.title,
        summary,
        scenarios,
      }
    }),
  }
}

function renderSummaryRows(report: DataEstimateReport) {
  return report.stages.map((stage) => {
    const summary = stage.summary
    return `| \`${stage.stageId} / ${stage.classId} / ${stage.buildRuleId}\` | ${stage.title} | \`${summary.mode}\` | \`${summary.profileTier}/${summary.profileId}\` | \`${summary.buildId}\` | ${formatPercent(summary.passRate)} | ${formatNumber(summary.averageDurationSec)} | ${formatNumber(summary.playerResourcePerSec)} | ${formatNumber(summary.tankDamageTakenPerSec)} | ${formatNumber(summary.healingAndAbsorbPerSec)} | ${formatNumber(summary.playerSideDamagePerSec)} | ${formatNumber(summary.partyPressurePerSec)} |`
  })
}

function renderScenarioRows(stage: DataEstimateStageReport) {
  if (stage.scenarios.length === 0) {
    return ['| 无样本 | - | - | - | - | - | - | - | - | - | - |']
  }

  return [...stage.scenarios]
    .sort((left, right) =>
      left.mode.localeCompare(right.mode) ||
      left.profileTier.localeCompare(right.profileTier) ||
      left.profileId.localeCompare(right.profileId) ||
      right.passRate - left.passRate ||
      left.buildId.localeCompare(right.buildId),
    )
    .map((scenario) =>
      `| \`${scenario.mode}\` | \`${scenario.profileTier}/${scenario.profileId}\` | \`${scenario.buildId}\` | ${scenario.attempts} | ${formatPercent(scenario.passRate)} | ${formatNumber(scenario.averageDurationSec)} | ${formatNumber(scenario.playerResourcePerSec)} | ${formatNumber(scenario.tankDamageTakenPerSec)} | ${formatNumber(scenario.healingAndAbsorbPerSec)} | ${formatNumber(scenario.playerSideDamagePerSec)} | ${formatNumber(scenario.partyPressurePerSec)} |`,
    )
}

export function renderDataEstimateMarkdown(report: DataEstimateReport) {
  const lines = [
    `# ${report.title}`,
    '',
    `生成时间：${report.generatedAt}`,
    '',
    '本报告由自动评测战斗样本聚合生成，用于观察关卡基础数值规模。数值会受 build、AI 档位、通关/失败时长影响，因此优先看同一批报告内的横向对比。',
    '',
    '## 字段说明',
    '',
    '| 字段 | 含义 | 为什么重要 |',
    '| --- | --- | --- |',
    '| 资源/秒 | 玩家职业资源的正向获取量，目前战士T为怒气/秒 | 判断本关是否支持当前技能循环和防御技能覆盖 |',
    '| 承伤/秒 | 坦克实际受到的伤害/秒 | 衡量坦克生存压力和治疗需求 |',
    '| 治疗吸收/秒 | 玩家与队伍为玩家侧产生的治疗和吸收/秒 | 衡量本关防御与恢复供给是否跟得上承伤 |',
    '| 造成伤害/秒 | 玩家、天赋与队伍对敌方造成的伤害/秒 | 判断击杀速度、软狂暴和敌方循环暴露时间 |',
    '| 压力/秒 | 队伍压力条增长/秒 | 衡量非坦克承压、漏怪或全队技能风险 |',
    '',
    '## 关卡参考值',
    '',
    '| 关卡 | 名称 | 参考模式 | profile | build | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...renderSummaryRows(report),
    '',
  ]

  for (const stage of report.stages) {
    lines.push(
      `## \`${stage.stageId} / ${stage.classId} / ${stage.buildRuleId}\` ${stage.title}`,
      '',
      '| 模式 | profile | build | 样本数 | 通过率 | 平均时长(s) | 资源/秒 | 承伤/秒 | 治疗吸收/秒 | 造成伤害/秒 | 压力/秒 |',
      '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...renderScenarioRows(stage),
      '',
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}
