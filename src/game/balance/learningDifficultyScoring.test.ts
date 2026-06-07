import { describe, expect, it } from 'vitest'
import {
  classifyLearningDifficulty,
  evaluateLearningEffort,
  evaluateLearningExecutionLoad,
  evaluateLearningPath,
  type LearningDifficultyScenario,
} from './learningDifficultyScoring'

function scenario(
  passRate: number,
  buildId = 'default',
  castStrategyId = 'balanced-window',
  tacticalStrategyId = 'strict-threat',
): LearningDifficultyScenario {
  return {
    stageId: 'Test-1',
    profileId: 'learning',
    profileTier: 'average',
    buildId,
    attempts: 100,
    victories: Math.round(passRate * 100),
    passRate,
    castStrategyId,
    tacticalStrategyId,
  }
}

describe('learning difficulty scoring', () => {
  it('classifies strong learned-player pass rates with tighter thresholds', () => {
    expect(classifyLearningDifficulty([scenario(0.86)]).label).toBe('trivial')
    expect(classifyLearningDifficulty([scenario(0.7)]).label).toBe('easy')
    expect(classifyLearningDifficulty([scenario(0.55)]).label).toBe('balanced')
    expect(classifyLearningDifficulty([scenario(0.35)]).label).toBe('hard')
    expect(classifyLearningDifficulty([scenario(0.15)]).label).toBe('expert')
    expect(classifyLearningDifficulty([scenario(0.05)]).label).toBe('near_impossible')
    expect(classifyLearningDifficulty([scenario(0.04)]).label).toBe('impossible')
  })

  it('lowers learned difficulty when several builds preserve strong pass rates', () => {
    const rating = classifyLearningDifficulty([
      scenario(0.68, 'best'),
      scenario(0.66, 'backup-a'),
      scenario(0.65, 'backup-b'),
      scenario(0.4, 'weak'),
    ], {
      flexibleBuildMinCount: 3,
      flexibleBuildBestRatio: 0.8,
      flexibleBuildMinPassRate: 0.65,
    })

    expect(rating.label).toBe('easy')
    expect(rating.baseLabel).toBe('balanced')
    expect(rating.flexibleBuildCount).toBe(3)
  })

  it('scores high learning effort when success depends on non-default build and special tactics', () => {
    const effort = evaluateLearningEffort({
      explorationScenarios: [
        scenario(0.05, 'default', 'balanced-window', 'strict-threat'),
        scenario(0.72, 'generated_14_2', 'late-window', 'mechanic-wax-party-chain'),
        scenario(0.68, 'generated_14_2', 'broad-window', 'allow-irregular-leak'),
      ],
      finalScenarios: [
        scenario(0.72, 'generated_14_2', 'late-window', 'mechanic-wax-party-chain'),
      ],
      selectedBuildIds: ['generated_14_2'],
      selectedCastStrategyIds: ['late-window'],
      selectedTacticalStrategyIds: ['mechanic-wax-party-chain'],
    })

    expect(effort.label).toBe('high')
    expect(effort.score).toBeGreaterThanOrEqual(60)
    expect(effort.reasons.join('\n')).toContain('非默认 build')
    expect(effort.reasons.join('\n')).toContain('机制链')
  })

  it('scores low learning effort for default build and ordinary strategies', () => {
    const effort = evaluateLearningEffort({
      explorationScenarios: [
        scenario(0.9, 'default', 'balanced-window', 'strict-threat'),
        scenario(0.88, 'generated_2_0', 'balanced-window', 'strict-threat'),
      ],
      finalScenarios: [
        scenario(0.9, 'default', 'balanced-window', 'strict-threat'),
      ],
      selectedBuildIds: ['default'],
      selectedCastStrategyIds: ['balanced-window'],
      selectedTacticalStrategyIds: ['strict-threat'],
    })

    expect(effort.label).toBe('none')
    expect(effort.score).toBeLessThan(20)
  })

  it('lowers learned difficulty when a fight has only a few clear operation windows', () => {
    const executionLoad = evaluateLearningExecutionLoad({
      enemyCount: 2,
      activeSkillCount: 2,
      selectedBuildIds: ['default'],
      selectedCastStrategyIds: ['late-window'],
      selectedTacticalStrategyIds: ['kill-high-impact'],
      learningEffortScore: 20,
    })
    const rating = classifyLearningDifficulty([scenario(0.18)], {
      executionLoad,
    })

    expect(executionLoad.label).toBe('clear_windows')
    expect(rating.baseLabel).toBe('expert')
    expect(rating.label).toBe('hard')
  })

  it('can lower very low clear-window pass rates by two labels for tutorial-style execution clarity', () => {
    const executionLoad = evaluateLearningExecutionLoad({
      enemyCount: 2,
      activeSkillCount: 2,
      selectedBuildIds: ['generated_3_0'],
      selectedCastStrategyIds: ['late-window'],
      selectedTacticalStrategyIds: ['kill-high-impact'],
      learningEffortScore: 20,
    })
    const rating = classifyLearningDifficulty([scenario(0.11, 'generated_3_0')], {
      executionLoad,
    })

    expect(executionLoad.adjustment).toBe(-2)
    expect(rating.baseLabel).toBe('near_impossible')
    expect(rating.label).toBe('hard')
  })

  it('lowers learned difficulty by one label for low-key fights with several enemies but basic learning effort', () => {
    const executionLoad = evaluateLearningExecutionLoad({
      enemyCount: 4,
      activeSkillCount: 4,
      selectedBuildIds: ['generated_8_1'],
      selectedCastStrategyIds: ['late-window'],
      selectedTacticalStrategyIds: ['allow-irregular-leak'],
      learningEffortScore: 20,
    })
    const rating = classifyLearningDifficulty([scenario(0.18, 'generated_8_1')], {
      executionLoad,
    })

    expect(executionLoad.label).toBe('clear_windows')
    expect(executionLoad.adjustment).toBe(-1)
    expect(rating.baseLabel).toBe('expert')
    expect(rating.label).toBe('hard')
  })

  it('lowers near-impossible clear-window tutorial results by two labels when execution is still simple', () => {
    const executionLoad = evaluateLearningExecutionLoad({
      enemyCount: 4,
      activeSkillCount: 4,
      selectedBuildIds: ['generated_8_1'],
      selectedCastStrategyIds: ['late-window'],
      selectedTacticalStrategyIds: ['allow-irregular-leak'],
      learningEffortScore: 20,
    })
    const rating = classifyLearningDifficulty([scenario(0.13, 'generated_8_1')], {
      executionLoad,
    })

    expect(executionLoad.label).toBe('clear_windows')
    expect(executionLoad.adjustment).toBe(-1)
    expect(rating.baseLabel).toBe('near_impossible')
    expect(rating.label).toBe('hard')
  })

  it('raises learned difficulty when many keys and special tactics create composite operation load', () => {
    const executionLoad = evaluateLearningExecutionLoad({
      enemyCount: 4,
      activeSkillCount: 8,
      selectedBuildIds: ['generated_14_2'],
      selectedCastStrategyIds: ['late-window', 'broad-low-mid-casts'],
      selectedTacticalStrategyIds: ['allow-irregular-leak', 'mechanic-wax-party-chain'],
      learningEffortScore: 62,
    })
    const rating = classifyLearningDifficulty([scenario(0.74, 'generated_14_2')], {
      executionLoad,
    })

    expect(executionLoad.label).toBe('composite_load')
    expect(rating.baseLabel).toBe('easy')
    expect(rating.label).toBe('balanced')
  })

  it('keeps direct learning paths neutral when default builds already work', () => {
    const path = evaluateLearningPath({
      explorationScenarios: [
        scenario(0.95, 'default', 'balanced-window', 'strict-threat'),
        scenario(0.92, 'generated_2_0', 'balanced-window', 'strict-threat'),
      ],
      finalScenarios: [
        scenario(0.95, 'default', 'balanced-window', 'strict-threat'),
      ],
      selectedBuilds: [
        { buildId: 'default', activeSkillCount: 4, passiveTalentCount: 2 },
      ],
      selectedCastStrategyIds: ['balanced-window'],
      selectedTacticalStrategyIds: ['strict-threat'],
      hasStrategyTips: false,
    })

    expect(path.label).toBe('direct')
    expect(path.adjustment).toBe(0)
    expect(path.score).toBeLessThan(25)
  })

  it('scores hidden-solution paths when success depends on narrow passive-heavy non-default builds', () => {
    const path = evaluateLearningPath({
      explorationScenarios: [
        scenario(0.05, 'default', 'balanced-window', 'strict-threat'),
        scenario(0.9, 'generated_14_2', 'late-window', 'allow-irregular-leak'),
        scenario(0.18, 'generated_3_0', 'balanced-window', 'strict-threat'),
        scenario(0.12, 'generated_4_0', 'balanced-window', 'strict-threat'),
        scenario(0.1, 'generated_5_0', 'balanced-window', 'strict-threat'),
      ],
      finalScenarios: [
        scenario(0.9, 'generated_14_2', 'late-window', 'allow-irregular-leak'),
        scenario(0.86, 'generated_15_2', 'late-window', 'allow-irregular-leak'),
      ],
      selectedBuilds: [
        { buildId: 'generated_14_2', activeSkillCount: 2, passiveTalentCount: 12 },
        { buildId: 'generated_15_2', activeSkillCount: 2, passiveTalentCount: 11 },
      ],
      selectedCastStrategyIds: ['late-window'],
      selectedTacticalStrategyIds: ['allow-irregular-leak'],
      hasStrategyTips: true,
    })

    expect(path.label).toBe('hidden_solution')
    expect(path.adjustment).toBe(2)
    expect(path.score).toBeGreaterThanOrEqual(75)
  })

  it('raises learning difficulty when the final pass rate comes from a specialized learning path', () => {
    const rating = classifyLearningDifficulty([scenario(0.96, 'generated_14_2')], {
      learningPath: {
        label: 'hidden_solution',
        score: 80,
        adjustment: 2,
        reasons: ['narrow passive-heavy solution'],
      },
    })

    expect(rating.baseLabel).toBe('trivial')
    expect(rating.label).toBe('balanced')
    expect(rating.learningPath?.label).toBe('hidden_solution')
  })
})
