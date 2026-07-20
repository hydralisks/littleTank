import { describe, expect, it } from 'vitest'
import { buildCombatDiagnostics } from './combatDiagnostics'
import type { EncounterStats } from './combatStats'

function createStats(): EncounterStats {
  return {
    durationMs: 30_000,
    tankDamageTaken: [
      {
        id: 'tank-heavy',
        sourceName: 'Test Enemy',
        effectName: 'Heavy Hit',
        category: 'Enemy Skill',
        total: 70,
        count: 2,
        average: 35,
        share: 0.7,
      },
      {
        id: 'tank-small',
        sourceName: 'Test Enemy',
        effectName: 'Scratch',
        category: 'Enemy Skill',
        total: 30,
        count: 3,
        average: 10,
        share: 0.3,
      },
    ],
    partyDamageTaken: [],
    pressureGained: [
      {
        id: 'pressure-heavy',
        sourceName: 'Test Enemy',
        effectName: 'Fear',
        category: 'Pressure',
        total: 60,
        count: 3,
        average: 20,
        share: 0.75,
      },
      {
        id: 'pressure-small',
        sourceName: 'Stage Rule',
        effectName: 'Push',
        category: 'Stage Rule',
        total: 20,
        count: 2,
        average: 10,
        share: 0.25,
      },
    ],
    castHandling: [
      {
        id: 'danger-cast',
        enemyName: 'Test Enemy',
        skillName: 'Danger Cast',
        dangerLevel: 'high',
        interruptedCount: 0,
        controlledCount: 0,
        completedCount: 2,
        unhandleableCount: 0,
        totalCasts: 2,
        handlerNames: [],
      },
    ],
    damageDealt: [],
    playerHealingAndAbsorb: [
      {
        id: 'player-heal',
        sourceName: 'Player',
        effectName: 'Rally',
        category: 'Player Healing',
        kind: 'healing',
        total: 40,
        rawTotal: 100,
        overhealTotal: 60,
        count: 2,
        average: 20,
        share: 40 / 70,
      },
      {
        id: 'ignore-pain',
        sourceName: 'Player',
        effectName: 'Ignore Pain',
        category: 'Player Absorb',
        kind: 'absorb',
        total: 30,
        count: 1,
        average: 30,
        share: 30 / 70,
      },
    ],
    partyHealingAndAbsorb: [],
    healingAndAbsorb: [
      {
        id: 'player-heal',
        sourceName: 'Player',
        effectName: 'Rally',
        category: 'Player Healing',
        kind: 'healing',
        total: 40,
        rawTotal: 100,
        overhealTotal: 60,
        count: 2,
        average: 20,
        share: 0.4,
      },
      {
        id: 'ignore-pain',
        sourceName: 'Player',
        effectName: 'Ignore Pain',
        category: 'Player Absorb',
        kind: 'absorb',
        total: 30,
        count: 1,
        average: 30,
        share: 0.3,
      },
    ],
    enemyHealingAndAbsorb: [
      {
        id: 'enemy-heal',
        sourceName: 'Test Healer',
        effectName: 'Restore',
        category: 'Enemy Healing',
        kind: 'healing',
        total: 30,
        rawTotal: 30,
        overhealTotal: 0,
        count: 1,
        average: 30,
        share: 1,
      },
    ],
    absorbConsumed: [
      {
        id: 'ignore-pain-consumed',
        sourceName: 'Player',
        effectName: 'Ignore Pain',
        category: 'Player Absorb',
        total: 6,
        count: 1,
        average: 6,
        share: 1,
      },
    ],
  }
}

describe('combat diagnostics', () => {
  it('builds internal summary totals and diagnostic signals from encounter stats', () => {
    const diagnostics = buildCombatDiagnostics(createStats())

    expect(diagnostics.topTankDamageSource?.effectName).toBe('Heavy Hit')
    expect(diagnostics.topPressureSource?.effectName).toBe('Fear')
    expect(diagnostics.totals).toMatchObject({
      tankDamageTaken: 100,
      pressureGained: 80,
      effectiveHealing: 40,
      rawHealing: 100,
      overhealing: 60,
      absorbCreated: 30,
      absorbConsumed: 6,
      highDangerCompletedCasts: 2,
      enemyHealing: 30,
    })
    expect(diagnostics.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tank_damage_concentrated', metric: 0.7 }),
        expect.objectContaining({ id: 'pressure_concentrated', metric: 0.75 }),
        expect.objectContaining({ id: 'high_danger_casts_completed', metric: 2 }),
        expect.objectContaining({ id: 'enemy_healing_present', metric: 30 }),
        expect.objectContaining({ id: 'high_overhealing', metric: 0.6 }),
        expect.objectContaining({ id: 'absorb_low_consumption', metric: 0.2 }),
      ]),
    )
  })
})
