import { describe, expect, it } from 'vitest'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  applyPlayerBuildWorkbookOverrides,
  getDefaultPersistedBuildForRule,
  resetPlayerBuildCatalog,
} from '../data/playerBuildCatalog'
import { getStageById } from '../data/stageTemplates'
import {
  activateSkill,
  createInitialEncounterState,
  selectEnemy,
  tickEncounter,
} from './encounterFactory'
import type { CombatLogEvent } from './encounterTypes'

function createEncounter() {
  const stage = getStageById('harbor-1')
  return createInitialEncounterState(stage, 'warrior_t', {
    ...getDefaultPersistedBuildForRule(getStageBuildRuleId(stage), 'warrior_t'),
    loadout: {
      '1': 'warrior_t_shield_slam',
      '2': 'warrior_t_rallying_cry',
      '3': 'warrior_t_interrupt',
      '4': null,
      Q: null,
      E: null,
      R: null,
      F: null,
    },
  })
}

function createIgnorePainEncounter() {
  const stage = getStageById('harbor-1')
  return createInitialEncounterState(stage, 'warrior_t', {
    ...getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t'),
    loadout: {
      '1': 'warrior_t_shield_slam',
      '2': null,
      '3': null,
      '4': null,
      Q: 'warrior_t_ignore_pain',
      E: null,
      R: null,
      F: null,
    },
  })
}

function emptyPlayerBuildOverrides() {
  return {
    classDefinitions: [],
    buildRuleDefinitions: [],
    activeSkillDefinitions: [],
    activeSkillEffectDefinitions: [],
    activeStatusDefinitions: [],
    passiveTalentDefinitions: [],
    passiveTalentEffectDefinitions: [],
    passiveStatusDefinitions: [],
    defaultActiveBuilds: [],
    defaultPassiveBuilds: [],
    iconDefinitions: [],
  }
}

function withTemporaryIgnorePainSkill(run: () => void) {
  applyPlayerBuildWorkbookOverrides({
    ...emptyPlayerBuildOverrides(),
    activeSkillDefinitions: [
      {
        skillId: 'warrior_t_ignore_pain',
        classId: 'warrior_t',
        skillName: '无视苦痛',
        shortName: '无视',
        resourceCost: 20,
        cooldownMs: 0,
        gcdMs: 0,
        targetingType: 'self',
        skillLogicId: 'ignore_pain',
        grantedStatusIds: ['ignorePain'],
      },
    ],
    activeSkillEffectDefinitions: [
      {
        skillEffectId: 'warrior_t_ignore_pain_main',
        skillId: 'warrior_t_ignore_pain',
        skillLogicId: 'ignore_pain',
        targetSelector: 'self',
        valueA: 30,
        valueB: 0.5,
        durationMs: 5000,
        statusId: 'ignorePain',
      },
    ],
    activeStatusDefinitions: [
      {
        statusId: 'ignorePain',
        statusName: '无视苦痛',
        statusCategory: 'playerBuff',
        iconId: 'warrior_t_ignorePain_status_pic',
        durationMs: 5000,
        maxStacks: 1,
        dispellable: false,
        effectLogicId: 'playerBuff_ignorePain',
      },
    ],
  })

  try {
    run()
  } finally {
    resetPlayerBuildCatalog()
  }
}

function eventsOfType<T extends CombatLogEvent['type']>(
  state: ReturnType<typeof createEncounter> | ReturnType<typeof createIgnorePainEncounter>,
  type: T,
) {
  return state.runtime.combatLog.filter((event): event is Extract<CombatLogEvent, { type: T }> => event.type === type)
}

describe('combat telemetry integration', () => {
  it('records player skill damage and healing', () => {
    const selected = selectEnemy(createEncounter(), 'harbor-1-e01')
    const withDamage = tickEncounter(activateSkill(selected, 'warrior_t_shield_slam'), 100)
    const withHealing = activateSkill({
      ...withDamage,
      player: {
        ...withDamage.player,
        hp: withDamage.player.maxHp - 30,
        resource: withDamage.player.maxResource,
        gcdRemainingMs: 0,
      },
      party: {
        ...withDamage.party,
        hp: withDamage.party.maxHp - 30,
      },
    }, 'warrior_t_rallying_cry')

    expect(eventsOfType(withDamage, 'damage')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'player' }),
          target: expect.objectContaining({ kind: 'enemy' }),
          ability: expect.objectContaining({ id: 'warrior_t_shield_slam' }),
        }),
      ]),
    )
    expect(eventsOfType(withHealing, 'healing')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'player' }),
          ability: expect.objectContaining({ id: 'warrior_t_rallying_cry' }),
        }),
      ]),
    )
  })

  it('records raw healing and overhealing for player healing skills', () => {
    const base = createEncounter()
    const wounded = {
      ...base,
      player: {
        ...base.player,
        hp: base.player.maxHp - 5,
        resource: base.player.maxResource,
        gcdRemainingMs: 0,
      },
      party: {
        ...base.party,
        hp: base.party.maxHp - 8,
      },
    }
    const healed = activateSkill(wounded, 'warrior_t_rallying_cry')
    const healingEvents = eventsOfType(healed, 'healing')
      .filter((event) => event.ability?.id === 'warrior_t_rallying_cry')

    expect(healingEvents.length).toBeGreaterThan(0)
    expect(healingEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: expect.objectContaining({ kind: 'tank' }),
          amount: 5,
          rawAmount: expect.any(Number),
          overhealAmount: expect.any(Number),
        }),
        expect.objectContaining({
          target: expect.objectContaining({ kind: 'party' }),
          amount: 8,
          rawAmount: expect.any(Number),
          overhealAmount: expect.any(Number),
        }),
      ]),
    )
    for (const event of healingEvents) {
      expect(event.rawAmount ?? 0).toBeGreaterThan(event.amount)
      expect(event.overhealAmount).toBeCloseTo((event.rawAmount ?? 0) - event.amount)
    }
  })

  it('records actually consumed absorb when ignore pain prevents tank damage', () => {
    withTemporaryIgnorePainSkill(() => {
      const base = createIgnorePainEncounter()
      const shielded = activateSkill({
        ...base,
        player: {
          ...base.player,
          resource: base.player.maxResource,
          gcdRemainingMs: 0,
        },
      }, 'warrior_t_ignore_pain')
      const castingEnemy = {
        ...shielded.enemies[0],
        cast: {
          id: 'bone-jab',
          name: 'Bone Jab',
          target: 'tank' as const,
          remainingMs: 0,
          totalMs: 100,
          breakRule: 'interruptOrControl' as const,
          dangerLevel: 'medium' as const,
        },
      }
      const damaged = tickEncounter({
        ...shielded,
        player: {
          ...shielded.player,
          gcdRemainingMs: 0,
        },
        enemies: [castingEnemy, ...shielded.enemies.slice(1)],
      }, 100)

      expect(eventsOfType(damaged, 'absorb-consumed')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: expect.objectContaining({ kind: 'player' }),
            target: expect.objectContaining({ kind: 'tank' }),
            ability: expect.objectContaining({ id: 'ignorePain' }),
            amount: expect.any(Number),
          }),
        ]),
      )
    })
  })

  it('records enemy cast pressure and tank damage after casts resolve', () => {
    const enemyWithTankCast = {
      ...createEncounter().enemies[0],
      cast: {
        id: 'bone-jab',
        name: 'Bone Jab',
        target: 'tank' as const,
        remainingMs: 0,
        totalMs: 100,
        breakRule: 'interruptOrControl' as const,
        dangerLevel: 'medium' as const,
      },
    }
    const enemyWithPartyCast = {
      ...createEncounter().enemies[1],
      cast: {
        id: 'ember-bolt',
        name: 'Ember Bolt',
        target: 'party' as const,
        remainingMs: 0,
        totalMs: 100,
        breakRule: 'interruptOrControl' as const,
        dangerLevel: 'high' as const,
      },
    }
    const base = createEncounter()
    const nextState = tickEncounter({
      ...base,
      enemies: [enemyWithTankCast, enemyWithPartyCast, ...base.enemies.slice(2)],
    }, 100)

    expect(eventsOfType(nextState, 'damage')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'enemy' }),
          target: expect.objectContaining({ kind: 'tank' }),
          ability: expect.objectContaining({ id: 'bone-jab' }),
        }),
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'enemy' }),
          target: expect.objectContaining({ kind: 'party' }),
          ability: expect.objectContaining({ id: 'ember-bolt' }),
        }),
      ]),
    )
    expect(eventsOfType(nextState, 'pressure')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'enemy' }),
          target: expect.objectContaining({ kind: 'party' }),
          ability: expect.objectContaining({ id: 'ember-bolt' }),
        }),
      ]),
    )
  })

  it('records stage rule and status pressure sources', () => {
    const base = createEncounter()
    const withStatus = {
      ...base,
      party: {
        ...base.party,
        statuses: [
          ...base.party.statuses,
          {
            id: 'test-pressure',
            label: '测试压迫',
            shortLabel: '压',
            remainingMs: 5000,
            totalMs: 5000,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'steady_pressure_rise',
          },
        ],
      },
      runtime: {
        ...base.runtime,
        partyStatusRuntime: {
          ...base.runtime.partyStatusRuntime,
          'test-pressure': {
            initialized: true,
            intervalElapsedMs: 0,
          },
        },
      },
    }

    const nextState = tickEncounter(withStatus, 1000)

    expect(eventsOfType(nextState, 'pressure')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'stageRule' }),
          target: expect.objectContaining({ kind: 'party' }),
        }),
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'status', id: 'test-pressure' }),
          target: expect.objectContaining({ kind: 'party' }),
          ability: expect.objectContaining({ id: 'test-pressure' }),
        }),
      ]),
    )
  })

  it('records enemy status healing when an enemy buff heals on apply', () => {
    const base = createEncounter()
    const casterEnemy = {
      ...base.enemies[0],
      cast: {
        id: 'dark-mend',
        name: '暗影愈合',
        target: 'enemy' as const,
        remainingMs: 0,
        totalMs: 100,
        breakRule: 'interruptOrControl' as const,
        dangerLevel: 'medium' as const,
      },
    }
    const woundedEnemy = {
      ...base.enemies[1],
      hp: Math.max(1, base.enemies[1].maxHp - 40),
      cast: null,
    }
    const nextState = tickEncounter({
      ...base,
      enemies: [casterEnemy, woundedEnemy, ...base.enemies.slice(2)],
    }, 100)

    expect(eventsOfType(nextState, 'healing')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'enemy', id: woundedEnemy.id }),
          target: expect.objectContaining({ kind: 'enemy', id: woundedEnemy.id }),
          ability: expect.objectContaining({ kind: 'status', id: 'fortified' }),
          amount: 26,
        }),
      ]),
    )
  })

  it('records enemy channel status damage against tank and party', () => {
    const tankBase = createEncounter()
    const tankChannelEnemy = {
      ...tankBase.enemies[0],
      cast: {
        id: 'wind_strike!',
        name: '风击',
        target: 'tank' as const,
        remainingMs: 1000,
        totalMs: 1000,
        breakRule: 'interruptOrControl' as const,
        dangerLevel: 'medium' as const,
        phase: 'channeling' as const,
      },
      statuses: [
        ...tankBase.enemies[0].statuses,
        {
          id: 'wind_strike!',
          label: '风击',
          shortLabel: '风',
          remainingMs: 1000,
          totalMs: 1000,
          tone: 'danger' as const,
          kind: 'enemyBuff' as const,
          effectLogicId: 'wind_strike!_status',
          channelSourceSkillId: 'wind_strike!',
        },
      ],
    }
    const tankNextState = tickEncounter({
      ...tankBase,
      enemies: [tankChannelEnemy, ...tankBase.enemies.slice(1)],
    }, 500)

    expect(eventsOfType(tankNextState, 'damage')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'enemy', id: tankChannelEnemy.id }),
          target: expect.objectContaining({ kind: 'tank' }),
          ability: expect.objectContaining({ kind: 'status', id: 'wind_strike!' }),
          amount: 5,
        }),
      ]),
    )

    const partyBase = createEncounter()
    const partyChannelEnemy = {
      ...partyBase.enemies[0],
      cast: {
        id: 'wind_strike!',
        name: '风击',
        target: 'party' as const,
        remainingMs: 1000,
        totalMs: 1000,
        breakRule: 'interruptOrControl' as const,
        dangerLevel: 'medium' as const,
        phase: 'channeling' as const,
      },
      statuses: [
        ...partyBase.enemies[0].statuses,
        {
          id: 'wind_strike!',
          label: '风击',
          shortLabel: '风',
          remainingMs: 1000,
          totalMs: 1000,
          tone: 'danger' as const,
          kind: 'enemyBuff' as const,
          effectLogicId: 'wind_strike!_status',
          channelSourceSkillId: 'wind_strike!',
        },
      ],
    }
    const partyNextState = tickEncounter({
      ...partyBase,
      enemies: [partyChannelEnemy, ...partyBase.enemies.slice(1)],
    }, 500)

    expect(eventsOfType(partyNextState, 'damage')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ kind: 'enemy', id: partyChannelEnemy.id }),
          target: expect.objectContaining({ kind: 'party' }),
          ability: expect.objectContaining({ kind: 'status', id: 'wind_strike!' }),
          amount: 5,
        }),
      ]),
    )
  })
})
