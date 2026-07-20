import type { StageInfo } from '../data/stageTemplates'
import type { SkillId } from '../encounter/encounterTypes'
import type { BalanceBuildVariant } from './balanceSimulator'
import type {
  LearningCastStrategy,
  LearningStageBalanceAnalysis,
  LearningTacticalStrategy,
} from './learningBalanceEvaluator'

export type StrategyTipAttentionMode = 'baseline' | 'low_attention' | 'ignored' | 'violated'

export type StrategyTipSignal =
  | 'passive_heavy'
  | 'interrupt_or_control'
  | 'defensive_timing'
  | 'spell_reflect'
  | 'priority_kill'
  | 'aoe_positioning'
  | 'mechanic_chain'
  | 'resource_absorb_uptime'

export type StrategyTipDependencyLabel = 'low' | 'medium' | 'high' | 'critical'

export interface StrategyTipsModeResult {
  mode: StrategyTipAttentionMode
  bestPassRate: number
  selectedBuildIds: string[]
  selectedCastStrategyIds: string[]
  selectedTacticalStrategyIds: string[]
  notes: string[]
}

export interface StrategyTipsStageSensitivity {
  stageId: string
  title: string
  strategyTips: string
  signals: StrategyTipSignal[]
  baseline: StrategyTipsModeResult
  lowAttention: StrategyTipsModeResult
  ignored: StrategyTipsModeResult
  violated: StrategyTipsModeResult
  dependency: StrategyTipDependencySummary
}

export interface StrategyTipsChapterSensitivityReport {
  title: string
  generatedAt: string
  sampleLabel: string
  stages: StrategyTipsStageSensitivity[]
}

export interface StrategyTipDependencySummary {
  label: StrategyTipDependencyLabel
  absoluteDrop: number
  relativeDrop: number
  reasons: string[]
}

const SIGNAL_LABELS: Record<StrategyTipSignal, string> = {
  passive_heavy: '被动/天赋构筑',
  interrupt_or_control: '打断/控制',
  defensive_timing: '减伤时机',
  spell_reflect: '法术反射',
  priority_kill: '优先击杀/集火',
  aoe_positioning: 'AOE覆盖',
  mechanic_chain: '机制联动',
  resource_absorb_uptime: '资源与吸收覆盖',
}

const MODE_LABELS: Record<StrategyTipAttentionMode, string> = {
  baseline: '正常参考',
  low_attention: '不太注意',
  ignored: '完全忽视',
  violated: '故意违反',
}

const DEPENDENCY_LABELS: Record<StrategyTipDependencyLabel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '关键',
}

const SIGNAL_PATTERNS: Array<{ signal: StrategyTipSignal, patterns: RegExp[] }> = [
  {
    signal: 'passive_heavy',
    patterns: [/被动|天赋|tier\s*2|放弃|腾出|少带|少主动|不适合当前关卡的主动技能|passive|talent/i],
  },
  {
    signal: 'interrupt_or_control',
    patterns: [/打断|控制|引导|读条|施法|飞弹|连击|interrupt|channel|cast/i],
  },
  {
    signal: 'defensive_timing',
    patterns: [/减伤|盾墙|盾牌格挡|攻势|猛|扛过|集体攻击|defensive|mitigation/i],
  },
  {
    signal: 'spell_reflect',
    patterns: [/反弹|反射|盾牌反射|闪电术|飞弹|法术|reflect|spell|lightning|missile/i],
  },
  {
    signal: 'priority_kill',
    patterns: [/优先|集火|先击杀|先杀|击杀|高伤害|高威胁|治疗|最低|血量最低|focus|priority|kill|healer/i],
  },
  {
    signal: 'aoe_positioning',
    patterns: [/复仇|群体伤害|aoe|覆盖|更多目标|群体/i],
  },
  {
    signal: 'mechanic_chain',
    patterns: [/蜡像|暗影之锄|同一目标|命中同一|联动|消耗/i],
  },
  {
    signal: 'resource_absorb_uptime',
    patterns: [/怒气|无视苦痛|吸收|覆盖|保持|resource|absorb|uptime/i],
  },
]

const TIP_ALIGNED_SKILL_IDS_BY_SIGNAL: Partial<Record<StrategyTipSignal, SkillId[]>> = {
  interrupt_or_control: ['warrior_t_interrupt', 'warrior_t_stun'],
  defensive_timing: ['warrior_t_shield_wall', 'warrior_t_ignore_pain', 'warrior_t_shield_block'],
  spell_reflect: ['warrior_t_shield_reflection'],
  priority_kill: ['warrior_t_shield_slam', 'warrior_t_revenge'],
  aoe_positioning: ['warrior_t_revenge'],
  resource_absorb_uptime: ['warrior_t_ignore_pain'],
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function classifyStrategyTipSignals(strategyTips: string | undefined): StrategyTipSignal[] {
  const text = normalizeText(strategyTips ?? '')
  if (!text) {
    return []
  }

  return SIGNAL_PATTERNS
    .filter(({ patterns }) => patterns.some((pattern) => pattern.test(text)))
    .map(({ signal }) => signal)
}

function activeSkillIdsOf(candidate: BalanceBuildVariant) {
  return Object.values(candidate.build.loadout).filter(Boolean) as SkillId[]
}

function isTipAlignedBuild(candidate: BalanceBuildVariant, signals: readonly StrategyTipSignal[]) {
  const activeSkillIds = activeSkillIdsOf(candidate)
  const passiveTalentCount = candidate.build.passiveTalentIds.length

  if (
    signals.includes('passive_heavy') &&
    (passiveTalentCount >= 4 || (passiveTalentCount >= 2 && activeSkillIds.length <= 2))
  ) {
    return true
  }

  return signals.some((signal) => {
    const skillIds = TIP_ALIGNED_SKILL_IDS_BY_SIGNAL[signal]
    return skillIds ? skillIds.some((skillId) => activeSkillIds.includes(skillId)) : false
  })
}

export function filterViolatedBuildCandidates(
  candidates: readonly BalanceBuildVariant[],
  signals: readonly StrategyTipSignal[],
) {
  if (signals.length === 0) {
    return [...candidates]
  }

  const filtered = candidates.filter((candidate) => !isTipAlignedBuild(candidate, signals))
  return filtered.length > 0 ? filtered : [...candidates]
}

export function filterViolatedCastStrategies(
  castStrategies: readonly LearningCastStrategy[],
  signals: readonly StrategyTipSignal[],
) {
  if (!signals.includes('interrupt_or_control') && !signals.includes('spell_reflect')) {
    return [...castStrategies]
  }

  const filtered = castStrategies.filter((strategy) =>
    strategy.id === 'late-window' || strategy.id === 'broad-low-mid-casts'
  )
  return filtered.length > 0 ? filtered : [...castStrategies]
}

export function filterViolatedTacticalStrategies(
  tacticalStrategies: readonly LearningTacticalStrategy[],
  signals: readonly StrategyTipSignal[],
) {
  const filtered = tacticalStrategies.filter((strategy) => {
    if (signals.includes('priority_kill') && (
      strategy.id === 'kill-high-impact' ||
      strategy.id === 'mechanic-focus' ||
      strategy.profileOverrides.targetPriorityMode === 'kill_high_impact' ||
      strategy.profileOverrides.targetPriorityMode === 'mechanic_focus'
    )) {
      return false
    }

    if (signals.includes('mechanic_chain') && strategy.id.startsWith('mechanic-wax-')) {
      return false
    }

    return true
  })

  return filtered.length > 0 ? filtered : [...tacticalStrategies]
}

export function createStageWithoutStrategyTips(stage: StageInfo): StageInfo {
  return {
    ...stage,
    strategyTips: '',
  }
}

export function modeLabel(mode: StrategyTipAttentionMode) {
  return MODE_LABELS[mode]
}

export function signalLabel(signal: StrategyTipSignal) {
  return SIGNAL_LABELS[signal]
}

export function dependencyLabel(label: StrategyTipDependencyLabel) {
  return DEPENDENCY_LABELS[label]
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function formatPassRateDrop(baselinePassRate: number, degradedPassRate: number) {
  const absoluteDrop = Math.max(0, baselinePassRate - degradedPassRate)
  const relativeDrop = baselinePassRate > 0 ? absoluteDrop / baselinePassRate : 0
  return `${Math.round(absoluteDrop * 100)}pp / ${Math.round(relativeDrop * 100)}%`
}

export function summarizeStrategyTipDependency(
  baselinePassRate: number,
  ignoredPassRate: number,
): StrategyTipDependencySummary {
  const absoluteDrop = Math.max(0, baselinePassRate - ignoredPassRate)
  const relativeDrop = baselinePassRate > 0 ? absoluteDrop / baselinePassRate : 0
  const label: StrategyTipDependencyLabel =
    (baselinePassRate >= 0.2 && ignoredPassRate <= 0.05 && absoluteDrop >= 0.25) || absoluteDrop >= 0.45
      ? 'critical'
      : absoluteDrop >= 0.25
        ? 'high'
        : absoluteDrop >= 0.1
          ? 'medium'
          : 'low'

  return {
    label,
    absoluteDrop,
    relativeDrop,
    reasons: [
      `完全忽视 strategyTips 后通过率下降 ${formatPassRateDrop(baselinePassRate, ignoredPassRate)}`,
      label === 'critical'
        ? '提示可能对应关键解法或关键构筑。'
        : label === 'high'
          ? '提示对稳定通关有明显帮助。'
          : label === 'medium'
            ? '提示能提升表现，但不是唯一通路。'
            : '提示依赖较低，常规学习路径基本能覆盖。',
    ],
  }
}

export function createStrategyTipsModeResult(
  mode: StrategyTipAttentionMode,
  analysis: LearningStageBalanceAnalysis,
  notes: readonly string[] = [],
): StrategyTipsModeResult {
  return {
    mode,
    bestPassRate: analysis.learningDifficultyRating.bestPassRate,
    selectedBuildIds: analysis.selectedBuildIds,
    selectedCastStrategyIds: analysis.selectedCastStrategyIds,
    selectedTacticalStrategyIds: analysis.selectedTacticalStrategyIds,
    notes: [...notes],
  }
}

function formatModeCell(baseline: StrategyTipsModeResult, mode: StrategyTipsModeResult) {
  if (mode.mode === 'baseline') {
    return formatPercent(mode.bestPassRate)
  }

  return `${formatPercent(mode.bestPassRate)}（-${formatPassRateDrop(baseline.bestPassRate, mode.bestPassRate)}）`
}

function formatList(values: readonly string[]) {
  return values.length > 0 ? values.join('、') : '无'
}

function summarizeChapter(stages: readonly StrategyTipsStageSensitivity[]) {
  const critical = stages.filter((stage) => stage.dependency.label === 'critical')
  const high = stages.filter((stage) => stage.dependency.label === 'high')
  const medium = stages.filter((stage) => stage.dependency.label === 'medium')
  const low = stages.filter((stage) => stage.dependency.label === 'low')
  const lines: string[] = []

  lines.push(`- 关键依赖：${critical.length > 0 ? critical.map((stage) => `\`${stage.stageId}\``).join('、') : '无'}`)
  lines.push(`- 高依赖：${high.length > 0 ? high.map((stage) => `\`${stage.stageId}\``).join('、') : '无'}`)
  lines.push(`- 中依赖：${medium.length > 0 ? medium.map((stage) => `\`${stage.stageId}\``).join('、') : '无'}`)
  lines.push(`- 低依赖：${low.length > 0 ? low.map((stage) => `\`${stage.stageId}\``).join('、') : '无'}`)

  return lines.join('\n')
}

export function renderStrategyTipsSensitivityMarkdown(report: StrategyTipsChapterSensitivityReport) {
  const lines: string[] = [
    `# ${report.title}`,
    '',
    `生成时间：${report.generatedAt}`,
    '',
    `采样预算：\`${report.sampleLabel}\`。本文档用于内部验证 strategyTips 对学习型 AI 的影响，不作为玩家侧结算评价。`,
    '',
    '## 总结',
    '',
    summarizeChapter(report.stages),
    '',
    '## 通过率下降对比',
    '',
    '| 关卡 | 提示信号 | 正常参考 | 不太注意 | 完全忽视 | 故意违反 | 提示依赖度 |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...report.stages.map((stage) =>
      [
        `\`${stage.stageId}\` ${stage.title}`,
        formatList(stage.signals.map(signalLabel)),
        formatModeCell(stage.baseline, stage.baseline),
        formatModeCell(stage.baseline, stage.lowAttention),
        formatModeCell(stage.baseline, stage.ignored),
        formatModeCell(stage.baseline, stage.violated),
        dependencyLabel(stage.dependency.label),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    ),
    '',
    '## 逐关说明',
    '',
    ...report.stages.flatMap((stage) => [
      `### ${stage.stageId} ${stage.title}`,
      '',
      `- strategyTips：${stage.strategyTips || '无'}`,
      `- 识别信号：${formatList(stage.signals.map(signalLabel))}`,
      `- 依赖判断：${dependencyLabel(stage.dependency.label)}；${stage.dependency.reasons.join('；')}`,
      `- 不太注意：${stage.lowAttention.notes.join('；') || '移除提示优先构筑候选。'}`,
      `- 完全忽视：${stage.ignored.notes.join('；') || '清空提示文本并移除提示优先构筑候选。'}`,
      `- 故意违反：${stage.violated.notes.join('；') || '未识别到可稳定反向验证的提示项。'}`,
      '',
    ]),
  ]

  return `${lines.join('\n').trimEnd()}\n`
}
