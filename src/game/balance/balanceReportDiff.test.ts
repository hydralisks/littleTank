import { describe, expect, it } from 'vitest'
import { renderBalanceReportDiffMarkdown, summarizeBalanceReportDiff, type DiffableBalanceReport } from './balanceReportDiff'

const previousReport: DiffableBalanceReport = {
  generatedAt: '2026-06-01T00:00:00.000Z',
  stages: [
    {
      stageId: 'WestFall-1',
      classId: 'warrior_t',
      buildRuleId: 'standard_5slot',
      manualLabel: 'easy',
      staticScore: { label: 'easy', score: 24 },
      fixedAnalysis: { rating: { label: 'balanced', overallBestPassRate: 0.6 } },
      learningAnalysis: { learningDifficultyRating: { label: 'easy', bestPassRate: 0.8 } },
    },
    {
      stageId: 'WestFall-2',
      classId: 'warrior_t',
      buildRuleId: 'standard_5slot',
      manualLabel: 'balanced',
      staticScore: { label: 'balanced', score: 36 },
      fixedAnalysis: { rating: { label: 'hard', overallBestPassRate: 0.3 } },
      learningAnalysis: { learningDifficultyRating: { label: 'balanced', bestPassRate: 0.62 } },
    },
  ],
}

const currentReport: DiffableBalanceReport = {
  generatedAt: '2026-06-02T00:00:00.000Z',
  stages: [
    {
      stageId: 'WestFall-1',
      classId: 'warrior_t',
      buildRuleId: 'standard_5slot',
      manualLabel: 'easy',
      staticScore: { label: 'balanced', score: 32 },
      fixedAnalysis: { rating: { label: 'easy', overallBestPassRate: 0.8 } },
      learningAnalysis: { learningDifficultyRating: { label: 'trivial', bestPassRate: 0.92 } },
    },
    {
      stageId: 'WestFall-3',
      classId: 'warrior_t',
      buildRuleId: 'standard_5slot',
      manualLabel: 'balanced',
      staticScore: { label: 'balanced', score: 40 },
      fixedAnalysis: { rating: { label: 'balanced', overallBestPassRate: 0.55 } },
      learningAnalysis: { learningDifficultyRating: { label: 'balanced', bestPassRate: 0.58 } },
    },
  ],
}

describe('balance report diff', () => {
  it('summarizes changed, added, and removed stages', () => {
    const diff = summarizeBalanceReportDiff(previousReport, currentReport)

    expect(diff.changedStages).toEqual([
      expect.objectContaining({
        stageId: 'WestFall-1 / warrior_t / standard_5slot',
        staticLabelDelta: 'easy -> balanced',
        fixedLabelDelta: 'balanced -> easy',
        learningLabelDelta: 'easy -> trivial',
        fixedPassRateDelta: 0.2,
        learningPassRateDelta: 0.12,
      }),
    ])
    expect(diff.addedStageIds).toEqual(['WestFall-3 / warrior_t / standard_5slot'])
    expect(diff.removedStageIds).toEqual(['WestFall-2 / warrior_t / standard_5slot'])
  })

  it('renders planner-readable markdown', () => {
    const markdown = renderBalanceReportDiffMarkdown(summarizeBalanceReportDiff(previousReport, currentReport))

    expect(markdown).toContain('# 自动评分差异报告')
    expect(markdown).toContain('| `WestFall-1 / warrior_t / standard_5slot` | `easy -> balanced` | `balanced -> easy` | `easy -> trivial` | `+20%` | `+12%` |')
    expect(markdown).toContain('新增关卡：`WestFall-3 / warrior_t / standard_5slot`')
    expect(markdown).toContain('移除关卡：`WestFall-2 / warrior_t / standard_5slot`')
  })
})
