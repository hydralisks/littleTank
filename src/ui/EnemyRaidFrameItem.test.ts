import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getEnemyCastFillPercent, isHighDangerCastVisual } from './enemyRaidFrameVisuals'
import type { EnemyState } from '../game/encounter/encounterTypes'
import { EnemyRaidFrameList } from './EnemyRaidFrameList'

function enemyWithCast(
  dangerLevel: 'low' | 'medium' | 'high',
  target: 'tank' | 'ally' | 'party' | 'enemy' | 'self',
): EnemyState {
  return {
    id: 'enemy-a',
    definitionId: 'enemy-a',
    name: 'Enemy A',
    row: 1,
    col: 1,
    hp: 100,
    maxHp: 100,
    skillIds: ['skill-a'],
    skillCycle: ['skill-a'],
    skillCycleIndex: 0,
    threatLogic: 'normal',
    target: 'tank',
    threatState: 'safe',
    tankThreat: 10,
    allyThreat: 0,
    isSkull: false,
    statuses: [],
    cast: {
      id: 'skill-a',
      name: 'Skill A',
      target,
      remainingMs: 500,
      totalMs: 1000,
      breakRule: 'controlOnly',
      dangerLevel,
    },
    recoveryRemainingMs: 0,
    pendingRetryCastSkillId: null,
  }
}

describe('EnemyRaidFrameItem danger visuals', () => {
  it('shows high danger cast visuals for high danger casts regardless of target', () => {
    expect(isHighDangerCastVisual(enemyWithCast('high', 'tank'))).toBe(true)
    expect(isHighDangerCastVisual(enemyWithCast('high', 'party'))).toBe(true)
  })

  it('shows medium danger cast visuals only when the cast target is party', () => {
    expect(isHighDangerCastVisual(enemyWithCast('medium', 'party'))).toBe(true)
    expect(isHighDangerCastVisual(enemyWithCast('medium', 'tank'))).toBe(false)
    expect(isHighDangerCastVisual(enemyWithCast('medium', 'ally'))).toBe(false)
  })

  it('counts channeling casts down by remaining time for reverse cast bars', () => {
    const channelingEnemy = enemyWithCast('high', 'tank')
    channelingEnemy.cast = {
      ...channelingEnemy.cast!,
      phase: 'channeling',
      remainingMs: 750,
      totalMs: 1000,
    }

    expect(getEnemyCastFillPercent(channelingEnemy)).toBe(75)
    expect(getEnemyCastFillPercent(enemyWithCast('high', 'tank'))).toBe(50)
  })

  it('places enemy frames into their explicit row and col grid slots', () => {
    const topRight = {
      ...enemyWithCast('low', 'tank'),
      id: 'top-right',
      row: 1,
      col: 5,
    }
    const bottomLeft = {
      ...enemyWithCast('low', 'tank'),
      id: 'bottom-left',
      row: 5,
      col: 1,
    }

    const markup = renderToStaticMarkup(createElement(EnemyRaidFrameList, {
      enemies: [topRight, bottomLeft],
      selectedEnemyId: null,
      onSelectEnemy: () => undefined,
    }))

    expect(markup).toContain('data-grid-row="1"')
    expect(markup).toContain('data-grid-col="5"')
    expect(markup).toContain('data-grid-row="5"')
    expect(markup).toContain('data-grid-col="1"')
    expect(markup).toContain('data-grid-slot="1-1"')
    expect(markup.indexOf('data-grid-slot="1-1"')).toBeLessThan(markup.indexOf('data-enemy-id="top-right"'))
    expect(markup.indexOf('data-enemy-id="top-right"')).toBeLessThan(markup.indexOf('data-enemy-id="bottom-left"'))
  })
})
