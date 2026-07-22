import { describe, expect, it } from 'vitest'
import { compareTankClassTrialResults } from './tankClassBalanceComparison'

describe('tankClassBalanceComparison', () => {
  it('flags tool gaps and strength overflow using the approved pass-rate thresholds', () => {
    const comparison = compareTankClassTrialResults({
      classId: 'druid_bear_t',
      stages: [
        { stageId: 'Challenge-1', warriorBestPassRate: 0.20, classBestPassRate: 0.04, warriorDifficulty: 'hard', classDifficulty: 'expert' },
        { stageId: 'Challenge-2', warriorBestPassRate: 0.69, classBestPassRate: 0.85, warriorDifficulty: 'hard', classDifficulty: 'easy' },
        { stageId: 'Challenge-3', warriorBestPassRate: 0.50, classBestPassRate: 0.65, warriorDifficulty: 'balanced', classDifficulty: 'balanced' },
      ],
    })

    expect(comparison.stageResults[0].flags).toContain('tool_gap')
    expect(comparison.stageResults[1].flags).toContain('strength_overflow')
    expect(comparison.stageResults[1].flags).toContain('difficulty_gap_over_one_tier')
    expect(comparison.averagePassRateDifference).toBeCloseTo(0.05)
  })
})
