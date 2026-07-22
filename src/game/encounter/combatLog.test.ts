import { describe, expect, it } from 'vitest'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import { getDefaultPersistedBuildForRule } from '../data/playerBuildCatalog'
import { getStageById } from '../data/stageTemplates'
import { createInitialEncounterState } from './encounterFactory'
import { recordCombatLogEvent, recordCombatLogEvents } from './combatLog'
import type { CombatLogEvent } from './encounterTypes'

function createEncounter() {
  const stage = getStageById('harbor-1')
  return createInitialEncounterState(stage, getDefaultPersistedBuildForRule(getStageBuildRuleId(stage), 'warrior_t'))
}

function createDamageEvent(id: string, amount: number): CombatLogEvent {
  return {
    id,
    occurredAtMs: 1200,
    type: 'damage',
    source: { kind: 'enemy', id: 'enemy-1', name: '测试敌人' },
    target: { kind: 'tank', id: 'tank', name: '坦克' },
    ability: { kind: 'enemySkill', id: 'heavy-hit', name: '重击' },
    amount,
    damageType: 'physical',
  }
}

describe('combat log recording', () => {
  it('appends one combat log event without mutating the previous state', () => {
    const encounter = createEncounter()
    const event = createDamageEvent('damage-1', 18)

    const nextState = recordCombatLogEvent(encounter, event)

    expect(encounter.runtime.combatLog).toEqual([])
    expect(nextState.runtime.combatLog).toEqual([event])
    expect(nextState.runtime).not.toBe(encounter.runtime)
  })

  it('appends multiple combat log events in submit order', () => {
    const encounter = createEncounter()
    const first = createDamageEvent('damage-1', 18)
    const second = createDamageEvent('damage-2', 12)

    const nextState = recordCombatLogEvents(encounter, [first, second])

    expect(nextState.runtime.combatLog.map((event) => event.id)).toEqual(['damage-1', 'damage-2'])
  })
})
