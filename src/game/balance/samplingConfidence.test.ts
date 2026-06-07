import { describe, expect, it } from 'vitest'
import {
  classifyDeltaConfidence,
  classifyDeltaVerdict,
  createDeltaComparisonAssessment,
} from './samplingConfidence'

describe('sampling confidence', () => {
  it('marks small samples as low confidence even with visible deltas', () => {
    expect(classifyDeltaConfidence({
      attempts: 12,
      baselinePassRate: 0.5,
      comparedPassRate: 0.75,
      seedCount: 1,
    })).toBe('low')
  })

  it('marks standard samples with meaningful deltas as medium confidence', () => {
    expect(classifyDeltaConfidence({
      attempts: 30,
      baselinePassRate: 0.5,
      comparedPassRate: 0.7,
      seedCount: 1,
    })).toBe('medium')
  })

  it('marks full samples with meaningful deltas as high confidence', () => {
    expect(classifyDeltaConfidence({
      attempts: 100,
      baselinePassRate: 0.4,
      comparedPassRate: 0.65,
      seedCount: 1,
    })).toBe('high')
  })

  it('keeps both-near-zero comparisons low confidence unless the gap is large', () => {
    expect(classifyDeltaConfidence({
      attempts: 100,
      baselinePassRate: 0,
      comparedPassRate: 0.08,
      seedCount: 1,
    })).toBe('low')
  })

  it('classifies verdicts from delta and confidence', () => {
    expect(classifyDeltaVerdict({ passRateDelta: 0.3, confidence: 'medium' })).toBe('strong_gain')
    expect(classifyDeltaVerdict({ passRateDelta: 0.12, confidence: 'low' })).toBe('inconclusive')
    expect(classifyDeltaVerdict({ passRateDelta: 0.12, confidence: 'medium' })).toBe('minor_gain')
    expect(classifyDeltaVerdict({ passRateDelta: 0.03, confidence: 'high' })).toBe('neutral')
    expect(classifyDeltaVerdict({ passRateDelta: -0.2, confidence: 'medium' })).toBe('regression')
  })

  it('returns reasons alongside confidence and verdict', () => {
    const assessment = createDeltaComparisonAssessment({
      attempts: 30,
      seedCount: 1,
      baselinePassRate: 0.25,
      comparedPassRate: 0.55,
    })

    expect(assessment.confidence).toBe('medium')
    expect(assessment.verdict).toBe('strong_gain')
    expect(assessment.passRateDelta).toBeCloseTo(0.3)
    expect(assessment.relativeDelta).toBeCloseTo(1.2)
    expect(assessment.reasons.join('\n')).toContain('delta')
  })
})
