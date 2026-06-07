import type {
  CastHandlingRow,
  EncounterStats,
  HealingAbsorbRow,
  StatAmountRow,
} from './combatStats'

export type CombatDiagnosticSeverity = 'info' | 'notice' | 'warning' | 'critical'

export type CombatDiagnosticSignalId =
  | 'tank_damage_concentrated'
  | 'pressure_concentrated'
  | 'high_danger_casts_completed'
  | 'enemy_healing_present'
  | 'high_overhealing'
  | 'absorb_low_consumption'

export interface CombatDiagnosticSignal {
  id: CombatDiagnosticSignalId
  severity: CombatDiagnosticSeverity
  metric: number
  sourceName?: string
  effectName?: string
  evidence: Record<string, number | string>
}

export interface CombatDiagnosticTotals {
  tankDamageTaken: number
  pressureGained: number
  damageDealt: number
  effectiveHealing: number
  rawHealing: number
  overhealing: number
  absorbCreated: number
  absorbConsumed: number
  highDangerCompletedCasts: number
  enemyHealing: number
}

export interface CombatDiagnostics {
  topTankDamageSource: StatAmountRow | null
  topPressureSource: StatAmountRow | null
  topDamageDealtSource: StatAmountRow | null
  topHealingOrAbsorbSource: HealingAbsorbRow | null
  totals: CombatDiagnosticTotals
  signals: CombatDiagnosticSignal[]
}

function sumRows(rows: readonly StatAmountRow[]) {
  return rows.reduce((sum, row) => sum + row.total, 0)
}

function topRow<T extends StatAmountRow>(rows: readonly T[]) {
  return rows[0] ?? null
}

function highDangerCompletedCasts(rows: readonly CastHandlingRow[]) {
  return rows.reduce((sum, row) => (
    row.dangerLevel === 'high' ? sum + row.completedCount : sum
  ), 0)
}

function healingRows(rows: readonly HealingAbsorbRow[]) {
  return rows.filter((row) => row.kind === 'healing')
}

function absorbRows(rows: readonly HealingAbsorbRow[]) {
  return rows.filter((row) => row.kind === 'absorb')
}

function isEnemyHealingOrAbsorbRow(row: HealingAbsorbRow) {
  return row.category === '敌人治疗' || row.category === '敌人吸收'
}

function buildTotals(stats: EncounterStats): CombatDiagnosticTotals {
  const healing = healingRows(stats.healingAndAbsorb).filter((row) => !isEnemyHealingOrAbsorbRow(row))
  const absorbCreated = absorbRows(stats.healingAndAbsorb).filter((row) => !isEnemyHealingOrAbsorbRow(row))
  const enemyHealing = [
    ...healingRows(stats.enemyHealingAndAbsorb),
    ...healingRows(stats.healingAndAbsorb).filter(isEnemyHealingOrAbsorbRow),
  ]

  return {
    tankDamageTaken: sumRows(stats.tankDamageTaken),
    pressureGained: sumRows(stats.pressureGained),
    damageDealt: sumRows(stats.damageDealt),
    effectiveHealing: sumRows(healing),
    rawHealing: healing.reduce((sum, row) => sum + (row.rawTotal ?? row.total), 0),
    overhealing: healing.reduce((sum, row) => sum + (row.overhealTotal ?? 0), 0),
    absorbCreated: sumRows(absorbCreated),
    absorbConsumed: sumRows(stats.absorbConsumed),
    highDangerCompletedCasts: highDangerCompletedCasts(stats.castHandling),
    enemyHealing: sumRows(enemyHealing),
  }
}

function concentrationSignal(
  id: Extract<CombatDiagnosticSignalId, 'tank_damage_concentrated' | 'pressure_concentrated'>,
  row: StatAmountRow | null,
  total: number,
): CombatDiagnosticSignal | null {
  if (!row || total <= 0 || row.share < 0.5) {
    return null
  }

  return {
    id,
    severity: row.share >= 0.7 ? 'warning' : 'notice',
    metric: row.share,
    sourceName: row.sourceName,
    effectName: row.effectName,
    evidence: {
      total,
      rowTotal: row.total,
      share: row.share,
    },
  }
}

function compactSignals(signals: Array<CombatDiagnosticSignal | null>) {
  return signals.filter((signal): signal is CombatDiagnosticSignal => signal !== null)
}

export function buildCombatDiagnostics(stats: EncounterStats): CombatDiagnostics {
  const totals = buildTotals(stats)
  const topTankDamageSource = topRow(stats.tankDamageTaken)
  const topPressureSource = topRow(stats.pressureGained)
  const topDamageDealtSource = topRow(stats.damageDealt)
  const topHealingOrAbsorbSource = topRow(stats.healingAndAbsorb)
  const overhealRatio = totals.rawHealing > 0 ? totals.overhealing / totals.rawHealing : 0
  const absorbConsumptionRatio = totals.absorbCreated > 0
    ? totals.absorbConsumed / totals.absorbCreated
    : 0

  return {
    topTankDamageSource,
    topPressureSource,
    topDamageDealtSource,
    topHealingOrAbsorbSource,
    totals,
    signals: compactSignals([
      concentrationSignal('tank_damage_concentrated', topTankDamageSource, totals.tankDamageTaken),
      concentrationSignal('pressure_concentrated', topPressureSource, totals.pressureGained),
      totals.highDangerCompletedCasts > 0
        ? {
            id: 'high_danger_casts_completed',
            severity: 'critical',
            metric: totals.highDangerCompletedCasts,
            evidence: {
              completedCasts: totals.highDangerCompletedCasts,
            },
          }
        : null,
      totals.enemyHealing > 0
        ? {
            id: 'enemy_healing_present',
            severity: 'notice',
            metric: totals.enemyHealing,
            evidence: {
              total: totals.enemyHealing,
            },
          }
        : null,
      overhealRatio >= 0.4
        ? {
            id: 'high_overhealing',
            severity: overhealRatio >= 0.7 ? 'warning' : 'notice',
            metric: overhealRatio,
            evidence: {
              rawHealing: totals.rawHealing,
              overhealing: totals.overhealing,
            },
          }
        : null,
      totals.absorbCreated > 0 && absorbConsumptionRatio < 0.25
        ? {
            id: 'absorb_low_consumption',
            severity: 'notice',
            metric: absorbConsumptionRatio,
            evidence: {
              absorbCreated: totals.absorbCreated,
              absorbConsumed: totals.absorbConsumed,
            },
          }
        : null,
    ]),
  }
}
