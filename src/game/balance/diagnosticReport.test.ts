import { describe, expect, it } from 'vitest'
import { renderDiagnosticScenarioSummariesMarkdown } from './diagnosticReport'
import type { DiagnosticScenarioSummary } from './diagnosticScenarioSummary'

function summary(): DiagnosticScenarioSummary {
  return {
    attempts: 3,
    victories: 1,
    passRate: 1 / 3,
    signals: [
      {
        id: 'high_danger_casts_completed',
        attemptsWithSignal: 2,
        defeatRate: 1,
        victoryRate: 0,
        meanMetricOnDefeat: 1.5,
        maxMetric: 2,
        confidence: 'medium',
        internalActionIds: ['try_high_danger_interrupt_focus'],
      },
    ],
  }
}

describe('diagnostic report renderer', () => {
  it('renders compact aggregate diagnostic action candidates from scenario summaries', () => {
    const markdown = renderDiagnosticScenarioSummariesMarkdown('固定策略 AI 内部诊断', [
      {
        profileId: 'average',
        buildId: 'default',
        passRate: 1 / 3,
        diagnosticSummary: summary(),
      },
    ])

    expect(markdown).toContain('## 固定策略 AI 内部诊断')
    expect(markdown).toContain('high_danger_casts_completed')
    expect(markdown).toContain('高危读条处理优先级')
    expect(markdown).toContain('medium')
    expect(markdown).toContain('| 诊断信号 | 样本覆盖 | 失败样本出现率 | 胜利样本出现率 | 失败均值 | 置信度 | 候选 action |')
    expect(markdown).not.toContain('| Profile | Build |')
    expect(markdown).not.toContain('`average`')
  })

  it('renders an empty note when no diagnostic summaries are available', () => {
    const markdown = renderDiagnosticScenarioSummariesMarkdown('学习型 AI 内部诊断', [
      {
        profileId: 'learning',
        buildId: 'default',
        passRate: 1,
      },
    ])

    expect(markdown).toContain('暂无诊断样本')
  })
})
