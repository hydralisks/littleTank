import { describe, expect, it } from 'vitest'
import { createBalanceDesignRecommendation } from './balanceRecommendation'

describe('balance design recommendation', () => {
  it('keeps recommendations neutral when the manual baseline is unrated', () => {
    const recommendation = createBalanceDesignRecommendation({
      stageId: "Zul'Aman-1",
      manualLabel: 'unrated',
      staticLabel: 'hard',
      fixedLabel: 'expert',
      learningLabel: 'balanced',
      staticMetrics: {
        enemyCount: 4,
        totalEnemyHp: 620,
        rawThreatScore: 72,
        unavoidablePressureScore: 24,
        answerablePressureScore: 36,
        toolMitigationScore: 30,
        enemySupportRisk: 12,
        effectiveSupportRisk: 8,
        executionComplexityScore: 34,
        adjustedThreatScore: 58,
        estimatedEnemyCastRisk: 28,
        estimatedPartyPressureRisk: 19,
        castDensityRisk: 22,
        targetComplexityRisk: 30,
        operationLoadRisk: 24,
        mechanicRisk: 35,
        toolCoverageScore: 31,
        durationPressureRisk: 18,
        availableActiveSkillCount: 6,
        playerAutoDamage: 3,
        playerAutoHeal: 0,
        partyAutoHeal: 0,
      },
      fixedBestPassRate: 0.2,
      learningBestPassRate: 0.58,
      learningEffortScore: 44,
      learningExecutionLoadScore: 26,
      halfBestBuildCount: 2,
    })

    expect(recommendation.severity).toBe('none')
    expect(recommendation.issueTypes).toEqual([])
    expect(recommendation.confidence).toBe('low')
    expect(recommendation.summary).toContain('unrated')
    expect(recommendation.suggestions.join('\n')).toContain('人工基线')
  })

  it('recommends numeric relief when all three evaluators are harder than the target', () => {
    const recommendation = createBalanceDesignRecommendation({
      stageId: 'RingingDeeps-6',
      manualLabel: 'expert',
      staticLabel: 'near_impossible',
      fixedLabel: 'near_impossible',
      learningLabel: 'near_impossible',
      staticMetrics: {
        enemyCount: 4,
        totalEnemyHp: 720,
        rawThreatScore: 96,
        unavoidablePressureScore: 34,
        answerablePressureScore: 58,
        toolMitigationScore: 28,
        enemySupportRisk: 18,
        effectiveSupportRisk: 12,
        executionComplexityScore: 42,
        adjustedThreatScore: 82,
        estimatedEnemyCastRisk: 34,
        estimatedPartyPressureRisk: 24,
        castDensityRisk: 18,
        targetComplexityRisk: 48,
        operationLoadRisk: 30,
        mechanicRisk: 52,
        toolCoverageScore: 32,
        durationPressureRisk: 22,
        availableActiveSkillCount: 5,
        playerAutoDamage: 3,
        playerAutoHeal: 0,
        partyAutoHeal: 0,
      },
      fixedBestPassRate: 0.1,
      learningBestPassRate: 0.12,
      learningEffortScore: 72,
      learningExecutionLoadScore: 68,
      halfBestBuildCount: 1,
    })

    expect(recommendation.severity).toBe('high')
    expect(recommendation.issueTypes).toContain('raw_numbers_too_high')
    expect(recommendation.issueTypes).toContain('mechanic_execution_load')
    expect(recommendation.suggestions.join('\n')).toContain('总生命值')
    expect(recommendation.suggestions.join('\n')).toContain('机制链')
  })

  it('recommends tutorial or AI coverage checks when static score is easy but simulations disagree', () => {
    const recommendation = createBalanceDesignRecommendation({
      stageId: 'RingingDeeps-4',
      manualLabel: 'hard',
      staticLabel: 'balanced',
      fixedLabel: 'near_impossible',
      learningLabel: 'hard',
      staticMetrics: {
        enemyCount: 4,
        totalEnemyHp: 520,
        rawThreatScore: 64,
        unavoidablePressureScore: 14,
        answerablePressureScore: 32,
        toolMitigationScore: 34,
        enemySupportRisk: 8,
        effectiveSupportRisk: 5,
        executionComplexityScore: 20,
        adjustedThreatScore: 38,
        estimatedEnemyCastRisk: 25,
        estimatedPartyPressureRisk: 18,
        castDensityRisk: 35,
        targetComplexityRisk: 42,
        operationLoadRisk: 21,
        mechanicRisk: 31,
        toolCoverageScore: 39,
        durationPressureRisk: 12,
        availableActiveSkillCount: 4,
        playerAutoDamage: 3,
        playerAutoHeal: 0,
        partyAutoHeal: 0,
      },
      fixedBestPassRate: 0.01,
      learningBestPassRate: 0.13,
      learningEffortScore: 20,
      learningExecutionLoadScore: 11,
      halfBestBuildCount: 1,
    })

    expect(recommendation.issueTypes).toContain('ai_strategy_gap')
    expect(recommendation.suggestions.join('\n')).toContain('先检查 AI')
    expect(recommendation.suggestions.join('\n')).toContain('教学提示')
  })
})
