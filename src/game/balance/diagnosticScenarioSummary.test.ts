import { describe, expect, it } from 'vitest'
import { createDiagnosticScenarioSummary } from './diagnosticScenarioSummary'
import type { CombatDiagnostics } from '../encounter/combatDiagnostics'

function diagnostics(signals: CombatDiagnostics['signals']): CombatDiagnostics {
  return {
    topTankDamageSource: null,
    topPressureSource: null,
    topDamageDealtSource: null,
    topHealingOrAbsorbSource: null,
    totals: {
      tankDamageTaken: 0,
      pressureGained: 0,
      damageDealt: 0,
      effectiveHealing: 0,
      rawHealing: 0,
      overhealing: 0,
      absorbCreated: 0,
      absorbConsumed: 0,
      highDangerCompletedCasts: 0,
      enemyHealing: 0,
    },
    signals,
  }
}

describe('diagnostic scenario summary', () => {
  it('aggregates diagnostic signals by outcome and maps them to internal action candidates', () => {
    const summary = createDiagnosticScenarioSummary([
      {
        outcome: 'defeat',
        durationMs: 1000,
        diagnostics: diagnostics([
          {
            id: 'high_danger_casts_completed',
            severity: 'critical',
            metric: 2,
            evidence: { completedCasts: 2 },
          },
        ]),
      },
      {
        outcome: 'defeat',
        durationMs: 1200,
        diagnostics: diagnostics([
          {
            id: 'high_danger_casts_completed',
            severity: 'critical',
            metric: 1,
            evidence: { completedCasts: 1 },
          },
        ]),
      },
      {
        outcome: 'victory',
        durationMs: 900,
        diagnostics: diagnostics([]),
      },
    ])

    expect(summary).toMatchObject({
      attempts: 3,
      victories: 1,
      passRate: 1 / 3,
    })
    expect(summary.signals).toEqual([
      expect.objectContaining({
        id: 'high_danger_casts_completed',
        attemptsWithSignal: 2,
        defeatRate: 1,
        victoryRate: 0,
        meanMetricOnDefeat: 1.5,
        confidence: 'medium',
        internalActionIds: ['try_high_danger_interrupt_focus'],
      }),
    ])
  })
})
