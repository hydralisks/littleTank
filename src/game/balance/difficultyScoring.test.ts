import { describe, expect, it } from 'vitest'
import {
  classifyDifficultyFromPassRates,
  type BalanceScenarioResult,
} from './difficultyScoring'

function scenario(
  profileTier: BalanceScenarioResult['profileTier'],
  passRate: number,
  buildId = 'default',
): BalanceScenarioResult {
  return {
    stageId: 'Test-1',
    profileId: `${profileTier}-${buildId}`,
    profileTier,
    buildId,
    attempts: 20,
    victories: Math.round(passRate * 20),
    passRate,
  }
}

describe('difficulty scoring by pass rates', () => {
  it('classifies difficulty from profile/build pass rates only', () => {
    expect(classifyDifficultyFromPassRates([
      scenario('average', 0.62),
      scenario('skilled', 0.82),
      scenario('expert', 0.92),
    ]).label).toBe('balanced')

    expect(classifyDifficultyFromPassRates([
      scenario('average', 0.04),
      scenario('skilled', 0.28),
      scenario('expert', 0.58),
    ]).label).toBe('expert')

    expect(classifyDifficultyFromPassRates([
      scenario('average', 0),
      scenario('skilled', 0),
      scenario('expert', 0.08),
    ]).label).toBe('near_impossible')

    expect(classifyDifficultyFromPassRates([
      scenario('average', 0),
      scenario('skilled', 0),
      scenario('expert', 0),
    ]).label).toBe('impossible')
  })

  it('does not let remaining hp or pressure-like fields change the label', () => {
    const lowIndirectValues = [
      { ...scenario('average', 0.6), playerHpRatio: 0.01, partyPressureRatio: 0.99 },
      { ...scenario('skilled', 0.8), playerHpRatio: 0.02, partyPressureRatio: 0.98 },
    ] as unknown as BalanceScenarioResult[]
    const highIndirectValues = [
      { ...scenario('average', 0.6), playerHpRatio: 1, partyPressureRatio: 0 },
      { ...scenario('skilled', 0.8), playerHpRatio: 1, partyPressureRatio: 0 },
    ] as unknown as BalanceScenarioResult[]

    expect(classifyDifficultyFromPassRates(lowIndirectValues)).toEqual(
      classifyDifficultyFromPassRates(highIndirectValues),
    )
  })

  it('explains labels using only pass-rate bands and build/profile spread', () => {
    const rating = classifyDifficultyFromPassRates([
      { ...scenario('average', 0.18, 'safe'), profileId: 'average-sample' },
      { ...scenario('average', 0.38, 'damage'), profileId: 'average-sample' },
      scenario('skilled', 0.62, 'damage'),
    ])

    expect(rating.label).toBe('hard')
    expect(rating.reasons.join('\n')).toContain('average 最佳通过率：38%')
    expect(rating.reasons.join('\n')).toContain('skilled 最佳通过率：62%')
    expect(rating.reasons.join('\n')).not.toMatch(/hp|pressure/i)
  })

  it('averages each profile winner inside the same operation tier', () => {
    const rating = classifyDifficultyFromPassRates([
      scenario('average', 1, 'average1-default'),
      {
        ...scenario('average', 0.6, 'average2-default'),
        profileId: 'average2-default',
      },
      {
        ...scenario('average', 0.2, 'average3-default'),
        profileId: 'average3-default',
      },
      scenario('skilled', 0.4),
      scenario('expert', 0.4),
    ])

    expect(rating.averageBestPassRate).toBeCloseTo(0.6)
    expect(rating.label).toBe('balanced')
  })

  it('lowers difficulty one step when a build with at least four spare points reaches half of the best build pass rate', () => {
    const results = [
      { ...scenario('average', 0.9, 'optimal'), profileId: 'average-sample' },
      { ...scenario('average', 0.55, 'spare-four'), profileId: 'average-sample' },
      { ...scenario('average', 0.2, 'spare-low'), profileId: 'average-sample' },
      { ...scenario('skilled', 0.88, 'optimal'), profileId: 'skilled-sample' },
      { ...scenario('expert', 0.93, 'optimal'), profileId: 'expert-sample' },
    ]

    const rating = classifyDifficultyFromPassRates(results, {
      buildRemainingPoints: {
        optimal: 0,
        'spare-four': 4,
        'spare-low': 4,
      },
    })

    expect(rating.label).toBe('trivial')
    expect(rating.halfBestBuildCount).toBe(2)
    expect(rating.sparePointHalfBestBuildCount).toBe(1)
    expect(rating.reasons.join('\n')).toContain('build 宽容度修正')
  })

  it('only lowers difficulty when underfilled builds still reach at least half of the best pass rate', () => {
    const results = [
      { ...scenario('average', 0.9, 'optimal'), profileId: 'average-sample' },
      { ...scenario('average', 0.55, 'underfilled-half'), profileId: 'average-sample' },
      { ...scenario('average', 0.4, 'underfilled-low'), profileId: 'average-sample' },
      { ...scenario('skilled', 0.88, 'optimal'), profileId: 'skilled-sample' },
      { ...scenario('expert', 0.93, 'optimal'), profileId: 'expert-sample' },
    ]

    const rating = classifyDifficultyFromPassRates(results, {
      buildRemainingPoints: {
        optimal: 0,
        'underfilled-half': 3,
        'underfilled-low': 4,
      },
    })

    expect(rating.label).toBe('easy')
    expect(rating.halfBestBuildCount).toBe(2)
    expect(rating.sparePointHalfBestBuildCount).toBe(0)
    expect(rating.reasons.join('\n')).not.toContain('build 宽容度修正')
  })

  it('does not count half-best builds when every build has zero pass rate', () => {
    const rating = classifyDifficultyFromPassRates([
      { ...scenario('average', 0, 'default'), profileId: 'average-sample' },
      { ...scenario('skilled', 0, 'spare'), profileId: 'skilled-sample' },
      { ...scenario('expert', 0, 'spare'), profileId: 'expert-sample' },
    ], {
      buildRemainingPoints: {
        default: 0,
        spare: 4,
      },
    })

    expect(rating.label).toBe('impossible')
    expect(rating.halfBestBuildCount).toBe(0)
    expect(rating.sparePointHalfBestBuildCount).toBe(0)
    expect(rating.reasons.join('\n')).not.toContain('build 宽容度修正')
  })
})
