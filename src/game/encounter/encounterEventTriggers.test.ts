import { describe, expect, it } from 'vitest'
import type { EncounterEvent, EncounterState } from './encounterTypes'
import { applyEncounterEventTriggers, type EncounterEventTrigger } from './encounterEventTriggers'

function createTriggerState(): EncounterState {
  return {
    name: 'trigger test',
    stage: {
      id: 'test-stage',
      areaId: 'test',
      areaTitle: 'Test',
      stageNumber: 1,
      buildRuleId: 'test',
      partyAutoDamageIntervalMs: 1000,
      partyAutoDamageTargetCount: 1,
      partyAutoDamageMin: 0,
      partyAutoDamageMax: 0,
      playerAutoDamage: 0,
      playerAutoHeal: 0,
      partyAutoHeal: 0,
      playerMaxHp: 100,
      partyMaxHp: 100,
      partyMaxPressure: 100,
      damageSources: [],
      tuning: {
        ambientPressurePerSecond: 0,
        enemyCastTimeMultiplier: 1,
        enemyDamageMultiplier: 1,
        enemyHealingMultiplier: 1,
        playerResourceRegenMultiplier: 1,
        warningLabel: '',
        victoryReason: '',
        defeatPlayerReason: '',
        defeatPartyReason: '',
        defeatPressureReason: '',
      },
      affixes: [],
      specialRules: [],
    },
    timeMs: 0,
    player: {
      hp: 100,
      maxHp: 100,
      resource: 0,
      maxResource: 100,
      gcdRemainingMs: 0,
      currentTargetId: null,
      mitigation: null,
      buffs: [],
      debuffs: [],
    },
    party: {
      hp: 100,
      maxHp: 100,
      pressure: 50,
      maxPressure: 100,
      currentTargetId: null,
      statuses: [],
    },
    enemies: [],
    skills: [],
    passiveTalentIds: [],
    runtime: {
      periodicPlayerStunRemainingMs: 0,
      pendingAffixTriggers: [],
      stageRuleRuntime: {},
      partyStatusRuntime: {},
      partyAutoDamageRemainingMs: 0,
      partyPressureNoGainMs: 0,
      partyPressureLastValue: 50,
      damageTakenResourceWindowRemainingMs: 0,
      damageTakenResourceGainedInWindow: 0,
      damageSources: [],
      commandQueue: [],
      eventQueue: [],
      combatLog: [],
      lastRejectedCommandMessage: null,
      lastProcessedEvents: [],
      pauseOverlay: null,
    },
    result: null,
  }
}

describe('encounter event triggers', () => {
  it('applies matching triggers in event order and persists trigger runtime', () => {
    const events: EncounterEvent[] = [
      {
        type: 'player/skill-activated',
        occurredAtMs: 10,
        skillId: 'warrior_t_taunt',
      },
      {
        type: 'player/resource-changed',
        occurredAtMs: 20,
        amount: 5,
        reason: 'test',
      },
    ]
    const calls: string[] = []
    const trigger: EncounterEventTrigger<number> = {
      id: 'pressure-on-skill',
      eventTypes: ['player/skill-activated'],
      getRuntime: (state) => state.runtime.partyStatusRuntime['pressure-on-skill']?.triggerCount ?? 0,
      setRuntime: (state, runtime) => ({
        ...state,
        runtime: {
          ...state.runtime,
          partyStatusRuntime: {
            ...state.runtime.partyStatusRuntime,
            'pressure-on-skill': {
              initialized: true,
              intervalElapsedMs: 0,
              triggerCount: runtime,
            },
          },
        },
      }),
      apply: (state, event, runtime) => {
        calls.push(`${event.type}:${runtime}`)
        return {
          state: {
            ...state,
            party: {
              ...state.party,
              pressure: state.party.pressure - 3,
            },
          },
          runtime: runtime + 1,
        }
      },
    }

    const result = applyEncounterEventTriggers(createTriggerState(), events, [trigger])

    expect(calls).toEqual(['player/skill-activated:0'])
    expect(result.party.pressure).toBe(47)
    expect(result.runtime.partyStatusRuntime['pressure-on-skill']).toMatchObject({
      initialized: true,
      triggerCount: 1,
    })
  })
})
