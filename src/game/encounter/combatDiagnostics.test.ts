import { describe, expect, it } from 'vitest'
import { buildCombatDiagnostics } from './combatDiagnostics'
import type { EncounterStats } from './combatStats'

function createStats(): EncounterStats {
  return {
    durationMs: 30_000,
    tankDamageTaken: [
      {
        id: 'tank-heavy',
        sourceName: '测试敌人',
        effectName: '重击',
        category: '敌人技能',
        total: 70,
        count: 2,
        average: 35,
        share: 0.7,
      },
      {
        id: 'tank-small',
        sourceName: '测试敌人',
        effectName: '擦伤',
        category: '敌人技能',
        total: 30,
        count: 3,
        average: 10,
        share: 0.3,
      },
    ],
    pressureGained: [
      {
        id: 'pressure-heavy',
        sourceName: '测试敌人',
        effectName: '恐吓',
        category: '压力',
        total: 60,
        count: 3,
        average: 20,
        share: 0.75,
      },
      {
        id: 'pressure-small',
        sourceName: '关卡规则',
        effectName: '推进',
        category: '关卡规则',
        total: 20,
        count: 2,
        average: 10,
        share: 0.25,
      },
    ],
    castHandling: [
      {
        id: 'danger-cast',
        enemyName: '测试敌人',
        skillName: '毁灭读条',
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
    healingAndAbsorb: [
      {
        id: 'player-heal',
        sourceName: '玩家',
        effectName: '集结呐喊',
        category: '玩家技能治疗',
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
        sourceName: '玩家',
        effectName: '无视苦痛',
        category: '玩家技能吸收',
        kind: 'absorb',
        total: 30,
        count: 1,
        average: 30,
        share: 0.3,
      },
      {
        id: 'enemy-heal',
        sourceName: '测试治疗者',
        effectName: '恢复',
        category: '敌人治疗',
        kind: 'healing',
        total: 30,
        rawTotal: 30,
        overhealTotal: 0,
        count: 1,
        average: 30,
        share: 0.3,
      },
    ],
    enemyHealingAndAbsorb: [],
    absorbConsumed: [
      {
        id: 'ignore-pain-consumed',
        sourceName: '玩家',
        effectName: '无视苦痛',
        category: '玩家技能吸收',
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

    expect(diagnostics.topTankDamageSource?.effectName).toBe('重击')
    expect(diagnostics.topPressureSource?.effectName).toBe('恐吓')
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
