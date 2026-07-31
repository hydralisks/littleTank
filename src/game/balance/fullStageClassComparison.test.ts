import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildFullStageClassComparison,
  renderFullStageClassComparisonMarkdown,
  type FullStageBalanceInput,
} from './fullStageClassComparison'

function stageResult(input: {
  stageId: string
  classId: 'warrior_t' | 'druid_bear_t'
  fixedPassRate: number
  automatedLabel: string
  manualLabel: string
  learningPassRate?: number
  operationScore?: number
}) {
  return {
    stageId: input.stageId,
    classId: input.classId,
    buildRuleId: '8slot_0',
    manualLabel: input.manualLabel,
    automatedLabel: input.automatedLabel,
    fixedAnalysis: {
      rating: {
        label: input.automatedLabel,
        overallBestPassRate: input.fixedPassRate,
        averageBestPassRate: input.fixedPassRate - 0.1,
        skilledBestPassRate: input.fixedPassRate,
        expertBestPassRate: input.fixedPassRate + 0.1,
      },
    },
    learningAnalysis: {
      learningDifficultyRating: {
        label: input.automatedLabel,
        bestPassRate: input.learningPassRate ?? input.fixedPassRate,
        executionLoad: {
          label: 'composite_load',
          score: input.operationScore ?? 40,
        },
      },
    },
    bestBuildsByProfile: [{
      profileId: 'expert-test',
      profileTier: 'expert',
      buildId: `${input.classId}-best`,
      passRate: input.fixedPassRate,
      loadout: { '1': `${input.classId}_skill` },
      passiveTalentIds: [`${input.classId}_talent`],
    }],
    ratingReasons: ['fixture signal'],
  }
}

describe('full-stage tank class comparison', () => {
  it('keeps Chinese names for raw and tracked comparison reports', () => {
    const script = fs.readFileSync('scripts/buildFullStageClassComparison.mjs', 'utf8')

    expect(script).toContain("'熊T与战士T全关卡完整预算对比-2026-07-30'")
    expect(script).toContain("'docs', 'reports'")
    expect(script).toContain("'熊T与战士T全关卡完整预算对比报告-2026-07-30.md'")
  })

  it('compares current Warrior T and Bear T results by stage', () => {
    const input: FullStageBalanceInput = {
      generatedAt: '2026-07-30T00:00:00.000Z',
      stages: [
        stageResult({
          stageId: 'WestFall-1',
          classId: 'warrior_t',
          fixedPassRate: 0.8,
          automatedLabel: 'balanced',
          manualLabel: 'easy',
          operationScore: 30,
        }),
        stageResult({
          stageId: 'WestFall-1',
          classId: 'druid_bear_t',
          fixedPassRate: 0.6,
          automatedLabel: 'hard',
          manualLabel: 'balanced',
          operationScore: 55,
        }),
      ],
    }

    const result = buildFullStageClassComparison(input)

    expect(result.rows).toEqual([
      expect.objectContaining({
        stageId: 'WestFall-1',
        warriorPassRate: 0.8,
        bearPassRate: 0.6,
        passRateDifference: -0.2,
        warriorDifficulty: 'balanced',
        bearDifficulty: 'hard',
        warriorOperationScore: 30,
        bearOperationScore: 55,
        flags: ['pass_rate_gap'],
      }),
    ])
    expect(result.rows[0].warriorBestBuild?.buildId).toBe('warrior_t-best')
    expect(result.rows[0].bearBestBuild?.buildId).toBe('druid_bear_t-best')
    expect(renderFullStageClassComparisonMarkdown(result)).toContain('| WestFall-1 |')
  })

  it('keeps a visible row when one class result is missing', () => {
    const result = buildFullStageClassComparison({
      generatedAt: '2026-07-30T00:00:00.000Z',
      stages: [stageResult({
        stageId: 'Challenge-1',
        classId: 'warrior_t',
        fixedPassRate: 0.9,
        automatedLabel: 'easy',
        manualLabel: 'easy',
      })],
    })

    expect(result.rows).toEqual([
      expect.objectContaining({
        stageId: 'Challenge-1',
        bearPassRate: null,
        flags: ['missing_class_result'],
      }),
    ])
  })

  it('flags difficulty gaps over one tier and manual-to-auto gaps per class', () => {
    const result = buildFullStageClassComparison({
      generatedAt: '2026-07-30T00:00:00.000Z',
      stages: [
        stageResult({
          stageId: "Zul'Aman-6",
          classId: 'warrior_t',
          fixedPassRate: 0.5,
          automatedLabel: 'balanced',
          manualLabel: 'balanced',
        }),
        stageResult({
          stageId: "Zul'Aman-6",
          classId: 'druid_bear_t',
          fixedPassRate: 0.5,
          automatedLabel: 'near_impossible',
          manualLabel: 'balanced',
        }),
      ],
    })

    expect(result.rows[0].flags).toEqual([
      'difficulty_gap_over_one_tier',
      'bear_manual_auto_gap',
    ])
  })

  it('normalizes the manual balance label before comparing difficulty tiers', () => {
    const result = buildFullStageClassComparison({
      generatedAt: '2026-07-30T00:00:00.000Z',
      stages: [
        stageResult({
          stageId: 'WestFall-2',
          classId: 'warrior_t',
          fixedPassRate: 1,
          automatedLabel: 'trivial',
          manualLabel: 'balance',
        }),
        stageResult({
          stageId: 'WestFall-2',
          classId: 'druid_bear_t',
          fixedPassRate: 1,
          automatedLabel: 'trivial',
          manualLabel: 'balance',
        }),
      ],
    })

    expect(result.rows[0]).toEqual(expect.objectContaining({
      warriorManualDifficulty: 'balanced',
      bearManualDifficulty: 'balanced',
      flags: ['warrior_manual_auto_gap', 'bear_manual_auto_gap'],
    }))
  })

  it('renders aggregate target coverage and high-risk gaps before the stage tables', () => {
    const result = buildFullStageClassComparison({
      generatedAt: '2026-07-30T00:00:00.000Z',
      stages: [
        stageResult({
          stageId: 'Challenge-5',
          classId: 'warrior_t',
          fixedPassRate: 1,
          automatedLabel: 'trivial',
          manualLabel: 'hard',
        }),
        stageResult({
          stageId: 'Challenge-5',
          classId: 'druid_bear_t',
          fixedPassRate: 0.75,
          automatedLabel: 'balanced',
          manualLabel: 'hard',
        }),
      ],
    })

    const markdown = renderFullStageClassComparisonMarkdown(result)
    expect(markdown).toContain('## 结论与风险')
    expect(markdown).toContain('40%~90% 目标区间')
    expect(markdown).toContain('Challenge-5（熊低 25%）')
  })

  it('ends generated Markdown with exactly one newline', () => {
    const result = buildFullStageClassComparison({
      generatedAt: '2026-07-30T00:00:00.000Z',
      stages: [stageResult({
        stageId: 'Challenge-1',
        classId: 'warrior_t',
        fixedPassRate: 0.9,
        automatedLabel: 'easy',
        manualLabel: 'easy',
      })],
    })

    expect(renderFullStageClassComparisonMarkdown(result)).toMatch(/[^\n]\n$/)
  })
})
