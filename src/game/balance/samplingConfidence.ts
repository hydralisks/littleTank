export type DeltaConfidence = 'low' | 'medium' | 'high'
export type DeltaVerdict = 'strong_gain' | 'minor_gain' | 'neutral' | 'regression' | 'inconclusive'

export interface DeltaConfidenceInput {
  attempts: number
  seedCount: number
  baselinePassRate: number
  comparedPassRate: number
}

export interface DeltaVerdictInput {
  passRateDelta: number
  confidence: DeltaConfidence
}

export interface DeltaComparisonAssessment {
  passRateDelta: number
  relativeDelta: number
  confidence: DeltaConfidence
  verdict: DeltaVerdict
  reasons: string[]
}

function absoluteDelta(input: Pick<DeltaConfidenceInput, 'baselinePassRate' | 'comparedPassRate'>) {
  return Math.abs(input.comparedPassRate - input.baselinePassRate)
}

function normalizedAttempts(value: number) {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
}

function normalizedSeedCount(value: number) {
  return Math.max(1, Math.floor(Number.isFinite(value) ? value : 1))
}

export function classifyDeltaConfidence(input: DeltaConfidenceInput): DeltaConfidence {
  const attempts = normalizedAttempts(input.attempts)
  const delta = absoluteDelta(input)
  const bothNearZero = input.baselinePassRate < 0.1 && input.comparedPassRate < 0.1

  if (bothNearZero && delta < 0.25) {
    return 'low'
  }

  if (attempts < 30 || delta < 0.1) {
    return 'low'
  }

  if (input.baselinePassRate === 0 && input.comparedPassRate > 0 && attempts < 100) {
    return 'medium'
  }

  if (attempts >= 100 && delta >= 0.15) {
    return 'high'
  }

  if (attempts >= 30 && delta >= 0.15) {
    return 'medium'
  }

  return 'low'
}

export function classifyDeltaVerdict(input: DeltaVerdictInput): DeltaVerdict {
  if (input.passRateDelta <= -0.1) {
    return 'regression'
  }
  if (input.confidence === 'low' && Math.abs(input.passRateDelta) < 0.15) {
    return 'inconclusive'
  }
  if (input.passRateDelta >= 0.25 && input.confidence !== 'low') {
    return 'strong_gain'
  }
  if (input.passRateDelta >= 0.1) {
    return 'minor_gain'
  }
  if (Math.abs(input.passRateDelta) < 0.1) {
    return 'neutral'
  }
  return 'inconclusive'
}

export function createDeltaComparisonAssessment(input: DeltaConfidenceInput): DeltaComparisonAssessment {
  const attempts = normalizedAttempts(input.attempts)
  const seedCount = normalizedSeedCount(input.seedCount)
  const passRateDelta = input.comparedPassRate - input.baselinePassRate
  const relativeDelta = input.baselinePassRate > 0
    ? passRateDelta / input.baselinePassRate
    : input.comparedPassRate > 0
      ? Number.POSITIVE_INFINITY
      : 0
  const confidence = classifyDeltaConfidence(input)
  const verdict = classifyDeltaVerdict({ passRateDelta, confidence })

  return {
    passRateDelta,
    relativeDelta,
    confidence,
    verdict,
    reasons: [
      `delta ${Math.round(passRateDelta * 100)} percentage points`,
      `attempts ${attempts}`,
      `seed count ${seedCount}`,
      `confidence ${confidence}`,
    ],
  }
}
