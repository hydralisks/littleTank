import type {
  CombatDiagnostics,
  CombatDiagnosticSignal,
  CombatDiagnosticSignalId,
} from '../encounter/combatDiagnostics'

export type DiagnosticAttemptOutcome = 'victory' | 'defeat' | 'timeout'
export type DiagnosticSummaryConfidence = 'low' | 'medium' | 'high'

export interface DiagnosticAttemptSample {
  outcome: DiagnosticAttemptOutcome
  durationMs: number
  diagnostics: CombatDiagnostics
}

export interface DiagnosticSignalSummary {
  id: CombatDiagnosticSignalId
  attemptsWithSignal: number
  defeatRate: number
  victoryRate: number
  meanMetricOnDefeat: number
  maxMetric: number
  confidence: DiagnosticSummaryConfidence
  internalActionIds: string[]
}

export interface DiagnosticScenarioSummary {
  attempts: number
  victories: number
  passRate: number
  signals: DiagnosticSignalSummary[]
}

const INTERNAL_ACTIONS_BY_SIGNAL: Record<CombatDiagnosticSignalId, string[]> = {
  tank_damage_concentrated: ['try_tank_damage_source_focus'],
  pressure_concentrated: ['try_pressure_source_focus'],
  high_danger_casts_completed: ['try_high_danger_interrupt_focus'],
  enemy_healing_present: ['try_enemy_healer_focus'],
  high_overhealing: ['try_later_healing_windows'],
  absorb_low_consumption: ['review_absorb_timing_or_value'],
}

interface SignalAccumulator {
  id: CombatDiagnosticSignalId
  attemptsWithSignal: number
  victoryAttemptsWithSignal: number
  defeatAttemptsWithSignal: number
  metricOnDefeatTotal: number
  maxMetric: number
}

function isFailureOutcome(outcome: DiagnosticAttemptOutcome) {
  return outcome !== 'victory'
}

function summarizeSignalsById(signals: readonly CombatDiagnosticSignal[]) {
  const byId = new Map<CombatDiagnosticSignalId, number>()

  for (const signal of signals) {
    byId.set(signal.id, Math.max(byId.get(signal.id) ?? 0, signal.metric))
  }

  return byId
}

function confidenceFor(attempts: number, attemptsWithSignal: number): DiagnosticSummaryConfidence {
  if (attempts >= 10 && attemptsWithSignal >= 3) {
    return 'high'
  }

  if (attempts >= 2 && attemptsWithSignal >= 2) {
    return 'medium'
  }

  return 'low'
}

export function createDiagnosticScenarioSummary(
  samples: readonly DiagnosticAttemptSample[],
): DiagnosticScenarioSummary {
  const attempts = samples.length
  const victories = samples.filter((sample) => sample.outcome === 'victory').length
  const failureAttempts = samples.filter((sample) => isFailureOutcome(sample.outcome)).length
  const accumulators = new Map<CombatDiagnosticSignalId, SignalAccumulator>()

  for (const sample of samples) {
    const signalsById = summarizeSignalsById(sample.diagnostics.signals)

    for (const [id, metric] of signalsById.entries()) {
      const current = accumulators.get(id) ?? {
        id,
        attemptsWithSignal: 0,
        victoryAttemptsWithSignal: 0,
        defeatAttemptsWithSignal: 0,
        metricOnDefeatTotal: 0,
        maxMetric: 0,
      }

      current.attemptsWithSignal += 1
      current.maxMetric = Math.max(current.maxMetric, metric)

      if (sample.outcome === 'victory') {
        current.victoryAttemptsWithSignal += 1
      } else {
        current.defeatAttemptsWithSignal += 1
        current.metricOnDefeatTotal += metric
      }

      accumulators.set(id, current)
    }
  }

  return {
    attempts,
    victories,
    passRate: attempts > 0 ? victories / attempts : 0,
    signals: [...accumulators.values()]
      .map((entry) => ({
        id: entry.id,
        attemptsWithSignal: entry.attemptsWithSignal,
        defeatRate: failureAttempts > 0 ? entry.defeatAttemptsWithSignal / failureAttempts : 0,
        victoryRate: victories > 0 ? entry.victoryAttemptsWithSignal / victories : 0,
        meanMetricOnDefeat: entry.defeatAttemptsWithSignal > 0
          ? entry.metricOnDefeatTotal / entry.defeatAttemptsWithSignal
          : 0,
        maxMetric: entry.maxMetric,
        confidence: confidenceFor(attempts, entry.attemptsWithSignal),
        internalActionIds: INTERNAL_ACTIONS_BY_SIGNAL[entry.id],
      }))
      .sort((left, right) =>
        right.defeatRate - left.defeatRate ||
        right.meanMetricOnDefeat - left.meanMetricOnDefeat ||
        left.id.localeCompare(right.id),
      ),
  }
}
