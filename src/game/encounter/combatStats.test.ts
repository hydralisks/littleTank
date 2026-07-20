import { describe, expect, it } from 'vitest'
import { buildEncounterStats } from './combatStats'
import type { CombatLogEvent, EncounterState } from './encounterTypes'

function createState(combatLog: CombatLogEvent[]): EncounterState {
  return {
    name: '测试战斗',
    stage: {
      id: 'test-stage',
      areaId: 'test-area',
      areaTitle: '测试区域',
      stageNumber: 1,
      playerMaxHp: 100,
      partyMaxHp: 100,
      partyMaxPressure: 100,
      partyAutoDamageIntervalMs: 1000,
      partyAutoDamageTargetCount: 1,
      partyAutoDamageMin: 0,
      partyAutoDamageMax: 0,
      playerAutoDamage: 0,
      playerAutoHeal: 0,
      partyAutoHeal: 0,
      buildRuleId: 'standard_5slot',
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
      damageSources: [],
    },
    timeMs: 5200,
    player: {
      hp: 90,
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
      hp: 80,
      maxHp: 100,
      pressure: 20,
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
      partyPressureLastValue: 0,
      damageTakenResourceWindowRemainingMs: 0,
      damageTakenResourceGainedInWindow: 0,
      damageSources: [],
      commandQueue: [],
      eventQueue: [],
      combatLog,
      lastRejectedCommandMessage: null,
      lastProcessedEvents: [],
      pauseOverlay: null,
    },
    result: null,
  }
}

describe('combat stats aggregation', () => {
  it('aggregates tank damage and pressure by source and ability', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'tank-1',
        occurredAtMs: 1000,
        type: 'damage',
        source: { kind: 'enemy', id: 'enemy-a', name: '豺狼人' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'enemySkill', id: 'strike', name: '重击' },
        amount: 20,
      },
      {
        id: 'tank-2',
        occurredAtMs: 2000,
        type: 'damage',
        source: { kind: 'enemy', id: 'enemy-a', name: '豺狼人' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'enemySkill', id: 'strike', name: '重击' },
        amount: 10,
      },
      {
        id: 'party-1',
        occurredAtMs: 3000,
        type: 'pressure',
        source: { kind: 'enemy', id: 'enemy-b', name: '鱼人' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'enemySkill', id: 'warcry', name: '战吼' },
        amount: 12,
      },
    ]))

    expect(stats.durationMs).toBe(5200)
    expect(stats.tankDamageTaken).toMatchObject([
      {
        sourceName: '豺狼人',
        effectName: '重击',
        category: '敌人技能',
        total: 30,
        count: 2,
        average: 15,
        share: 1,
      },
    ])
    expect(stats.pressureGained).toMatchObject([
      {
        sourceName: '鱼人',
        effectName: '战吼',
        category: '压力',
        total: 12,
        count: 1,
        average: 12,
        share: 1,
      },
    ])
  })

  it('merges enemy amount rows from the same enemy template and skill', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'tank-1',
        occurredAtMs: 1000,
        type: 'damage',
        source: { kind: 'enemy', id: 'murloc-scout-1', name: '鱼人斥候' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'enemySkill', id: 'murloc-strike', name: '鱼人攻击' },
        amount: 8,
      },
      {
        id: 'tank-2',
        occurredAtMs: 2000,
        type: 'damage',
        source: { kind: 'enemy', id: 'murloc-scout-2', name: '鱼人斥候' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'enemySkill', id: 'murloc-strike', name: '鱼人攻击' },
        amount: 12,
      },
      {
        id: 'pressure-1',
        occurredAtMs: 3000,
        type: 'pressure',
        source: { kind: 'enemy', id: 'murloc-scout-1', name: '鱼人斥候' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'enemySkill', id: 'murloc-shout', name: '鱼人呼喊' },
        amount: 5,
      },
      {
        id: 'pressure-2',
        occurredAtMs: 4000,
        type: 'pressure',
        source: { kind: 'enemy', id: 'murloc-scout-2', name: '鱼人斥候' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'enemySkill', id: 'murloc-shout', name: '鱼人呼喊' },
        amount: 7,
      },
    ]))

    expect(stats.tankDamageTaken).toMatchObject([
      {
        sourceName: '鱼人斥候',
        effectName: '鱼人攻击',
        total: 20,
        count: 2,
        average: 10,
        share: 1,
      },
    ])
    expect(stats.pressureGained).toMatchObject([
      {
        sourceName: '鱼人斥候',
        effectName: '鱼人呼喊',
        total: 12,
        count: 2,
        average: 6,
        share: 1,
      },
    ])
  })

  it('labels status, affix, and stage rule pressure sources', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'status-pressure',
        occurredAtMs: 1000,
        type: 'pressure',
        source: { kind: 'status', id: 'fear', name: '恐慌' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'status', id: 'fear', name: '恐慌' },
        amount: 3,
      },
      {
        id: 'affix-pressure',
        occurredAtMs: 2000,
        type: 'pressure',
        source: { kind: 'affix', id: 'storm', name: '风暴词缀' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'affix', id: 'storm', name: '风暴压迫' },
        amount: 5,
      },
      {
        id: 'rule-pressure',
        occurredAtMs: 3000,
        type: 'pressure',
        source: { kind: 'stageRule', id: 'timer', name: '关卡倒计时' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'stageRule', id: 'timer', name: '强制推进' },
        amount: 7,
      },
    ]))

    expect(stats.pressureGained.map((row) => [row.effectName, row.category])).toEqual([
      ['强制推进', '关卡规则'],
      ['风暴压迫', '词缀'],
      ['恐慌', '状态'],
    ])
  })

  it('aggregates damage dealt by player-side source category', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'skill',
        occurredAtMs: 1000,
        type: 'damage',
        source: { kind: 'player', id: 'player', name: '玩家' },
        target: { kind: 'enemy', id: 'enemy-a', name: '豺狼人' },
        ability: { kind: 'playerSkill', id: 'shield-slam', name: '盾牌猛击' },
        amount: 30,
      },
      {
        id: 'auto',
        occurredAtMs: 2000,
        type: 'damage',
        source: { kind: 'partyAutoAttack', id: 'party-auto', name: '队伍自动攻击' },
        target: { kind: 'enemy', id: 'enemy-a', name: '豺狼人' },
        ability: { kind: 'autoAttack', id: 'party-auto', name: '队伍自动攻击' },
        amount: 20,
      },
    ]))

    expect(stats.damageDealt).toMatchObject([
      { effectName: '盾牌猛击', category: '玩家技能伤害', total: 30, share: 0.6 },
      { effectName: '队伍自动攻击', category: '队伍自动攻击伤害', total: 20, share: 0.4 },
    ])
  })

  it('keeps healing and absorb rows separate', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'heal',
        occurredAtMs: 1000,
        type: 'healing',
        source: { kind: 'player', id: 'player', name: '玩家' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'playerSkill', id: 'rally', name: '集结呐喊' },
        amount: 40,
      },
      {
        id: 'absorb',
        occurredAtMs: 2000,
        type: 'absorb-created',
        source: { kind: 'player', id: 'player', name: '玩家' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'playerSkill', id: 'ignore-pain', name: '无视苦痛' },
        amount: 25,
      },
    ]))

    expect(stats.healingAndAbsorb).toMatchObject([
      { effectName: '集结呐喊', kind: 'healing', category: '玩家技能治疗', total: 40, share: 40 / 65 },
      { effectName: '无视苦痛', kind: 'absorb', category: '玩家技能吸收', total: 25, share: 25 / 65 },
    ])
    expect(stats.enemyHealingAndAbsorb).toEqual([])
  })

  it('calculates healing and absorb shares from their combined total', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'auto-heal',
        occurredAtMs: 1000,
        type: 'healing',
        source: { kind: 'partyAutoHeal', id: 'party-auto-heal', name: '自动治疗' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'autoHeal', id: 'party-auto-heal', name: '自动治疗' },
        amount: 20,
      },
      {
        id: 'ignore-pain',
        occurredAtMs: 2000,
        type: 'absorb-created',
        source: { kind: 'player', id: 'player', name: '玩家' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'playerSkill', id: 'ignore-pain', name: '无视苦痛' },
        amount: 30,
      },
    ]))

    expect(stats.healingAndAbsorb).toMatchObject([
      { effectName: '无视苦痛', kind: 'absorb', total: 30, share: 0.6 },
      { effectName: '自动治疗', kind: 'healing', total: 20, share: 0.4 },
    ])
  })

  it('keeps enemy healing and absorb shares separate from player side healing and absorb', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'player-heal',
        occurredAtMs: 1000,
        type: 'healing',
        source: { kind: 'player', id: 'player', name: 'Player' },
        target: { kind: 'tank', id: 'tank', name: 'Tank' },
        ability: { kind: 'playerSkill', id: 'rally', name: 'Rally' },
        amount: 20,
      },
      {
        id: 'enemy-heal',
        occurredAtMs: 2000,
        type: 'healing',
        source: { kind: 'enemy', id: 'enemy-healer', name: 'Enemy Healer' },
        target: { kind: 'enemy', id: 'enemy-target', name: 'Enemy Target' },
        ability: { kind: 'enemySkill', id: 'enemy-heal', name: 'Enemy Heal' },
        amount: 30,
      },
      {
        id: 'enemy-absorb',
        occurredAtMs: 3000,
        type: 'absorb-created',
        source: { kind: 'enemy', id: 'enemy-healer', name: 'Enemy Healer' },
        target: { kind: 'enemy', id: 'enemy-target', name: 'Enemy Target' },
        ability: { kind: 'status', id: 'enemy-shield', name: 'Enemy Shield' },
        amount: 10,
      },
    ]))

    expect(stats.healingAndAbsorb).toMatchObject([
      { effectName: 'Rally', kind: 'healing', total: 20, share: 1 },
    ])
    expect(stats.enemyHealingAndAbsorb).toMatchObject([
      { effectName: 'Enemy Heal', kind: 'healing', total: 30, share: 0.75 },
      { effectName: 'Enemy Shield', kind: 'absorb', total: 10, share: 0.25 },
    ])
  })

  it('puts enemy healing on the enemy healing and absorb page', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'enemy-heal',
        occurredAtMs: 1000,
        type: 'healing',
        source: { kind: 'enemy', id: 'enemy-healer', name: '鱼人治疗者' },
        target: { kind: 'enemy', id: 'enemy-target', name: '鱼人斥候' },
        ability: { kind: 'status', id: 'fortified', name: '强化' },
        amount: 26,
      },
    ]))

    expect(stats.healingAndAbsorb).toEqual([])
    expect(stats.enemyHealingAndAbsorb).toMatchObject([
      {
        sourceName: '鱼人治疗者',
        effectName: '强化',
        category: '敌人治疗',
        total: 26,
        share: 1,
      },
    ])
  })

  it('keeps effective healing, raw healing, and overhealing in internal totals', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'heal-overheal',
        occurredAtMs: 1000,
        type: 'healing',
        source: { kind: 'player', id: 'player', name: '玩家' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'playerSkill', id: 'rally', name: '集结呐喊' },
        amount: 20,
        rawAmount: 50,
        overhealAmount: 30,
      },
    ]))

    expect(stats.healingAndAbsorb).toMatchObject([
      {
        effectName: '集结呐喊',
        total: 20,
        rawTotal: 50,
        overhealTotal: 30,
      },
    ])
  })

  it('aggregates actually consumed absorb separately from created absorb', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'absorb-created',
        occurredAtMs: 1000,
        type: 'absorb-created',
        source: { kind: 'player', id: 'player', name: '玩家' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'playerSkill', id: 'ignore-pain', name: '无视苦痛' },
        amount: 30,
      },
      {
        id: 'absorb-consumed',
        occurredAtMs: 2000,
        type: 'absorb-consumed',
        source: { kind: 'player', id: 'player', name: '玩家' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'playerSkill', id: 'ignore-pain', name: '无视苦痛' },
        amount: 12,
      },
    ]))

    expect(stats.healingAndAbsorb).toMatchObject([
      {
        effectName: '无视苦痛',
        kind: 'absorb',
        total: 30,
      },
    ])
    expect(stats.absorbConsumed).toMatchObject([
      {
        effectName: '无视苦痛',
        category: '玩家技能吸收',
        total: 12,
      },
    ])
  })

  it('splits party damage and player or party healing into separate stat buckets', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'party-damage',
        occurredAtMs: 1000,
        type: 'damage',
        source: { kind: 'enemy', id: 'enemy-caster', name: 'Enemy Caster' },
        target: { kind: 'party', id: 'party', name: 'Party' },
        ability: { kind: 'enemySkill', id: 'shadow-nova', name: 'Shadow Nova' },
        amount: 18,
      },
      {
        id: 'player-heal',
        occurredAtMs: 2000,
        type: 'healing',
        source: { kind: 'player', id: 'player', name: 'Player' },
        target: { kind: 'tank', id: 'tank', name: 'Tank' },
        ability: { kind: 'playerSkill', id: 'rally', name: 'Rally' },
        amount: 20,
      },
      {
        id: 'party-heal',
        occurredAtMs: 3000,
        type: 'healing',
        source: { kind: 'partyAutoHeal', id: 'party-auto-heal', name: 'Auto Heal' },
        target: { kind: 'party', id: 'party', name: 'Party' },
        ability: { kind: 'autoHeal', id: 'party-auto-heal', name: 'Auto Heal' },
        amount: 30,
      },
      {
        id: 'party-absorb',
        occurredAtMs: 4000,
        type: 'absorb-created',
        source: { kind: 'player', id: 'player', name: 'Player' },
        target: { kind: 'party', id: 'party', name: 'Party' },
        ability: { kind: 'playerSkill', id: 'guard', name: 'Guard' },
        amount: 10,
      },
    ]))

    expect(stats.partyDamageTaken).toMatchObject([
      { sourceName: 'Enemy Caster', effectName: 'Shadow Nova', total: 18, share: 1 },
    ])
    expect(stats.playerHealingAndAbsorb).toMatchObject([
      { effectName: 'Rally', kind: 'healing', total: 20, share: 1 },
    ])
    expect(stats.partyHealingAndAbsorb).toMatchObject([
      { effectName: 'Auto Heal', kind: 'healing', total: 30, share: 0.75 },
      { effectName: 'Guard', kind: 'absorb', total: 10, share: 0.25 },
    ])
    expect(stats.healingAndAbsorb).toMatchObject([
      { effectName: 'Auto Heal', kind: 'healing', total: 30, share: 0.5 },
      { effectName: 'Rally', kind: 'healing', total: 20, share: 1 / 3 },
      { effectName: 'Guard', kind: 'absorb', total: 10, share: 1 / 6 },
    ])
  })

  it('summarizes cast handling results', () => {
    const stats = buildEncounterStats(createState([
      {
        id: 'cast-start',
        occurredAtMs: 1000,
        type: 'cast-started',
        source: { kind: 'enemy', id: 'enemy-a', name: '豺狼人' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'enemySkill', id: 'strike', name: '重击' },
        castId: 'cast-a',
        enemyId: 'enemy-a',
        enemySkillId: 'strike',
        dangerLevel: 'high',
        breakRule: 'interruptOrControl',
      },
      {
        id: 'cast-interrupt',
        occurredAtMs: 1500,
        type: 'cast-interrupted',
        source: { kind: 'enemy', id: 'enemy-a', name: '豺狼人' },
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: { kind: 'enemySkill', id: 'strike', name: '重击' },
        castId: 'cast-a',
        enemyId: 'enemy-a',
        enemySkillId: 'strike',
        dangerLevel: 'high',
        breakRule: 'interruptOrControl',
        handlerSkillId: 'interrupt',
        handlerName: '拳击',
      },
      {
        id: 'cast-resolved',
        occurredAtMs: 2500,
        type: 'cast-resolved',
        source: { kind: 'enemy', id: 'enemy-b', name: '鱼人' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'enemySkill', id: 'shout', name: '喊叫' },
        castId: 'cast-b',
        enemyId: 'enemy-b',
        enemySkillId: 'shout',
        dangerLevel: 'medium',
        breakRule: 'unstoppable',
      },
    ]))

    expect(stats.castHandling).toMatchObject([
      {
        enemyName: '豺狼人',
        skillName: '重击',
        dangerLevel: 'high',
        interruptedCount: 1,
        totalCasts: 1,
        completedCount: 0,
        unhandleableCount: 0,
      },
      {
        enemyName: '鱼人',
        skillName: '喊叫',
        dangerLevel: 'medium',
        interruptedCount: 0,
        totalCasts: 1,
        completedCount: 0,
        unhandleableCount: 1,
      },
    ])
  })

  it('aggregates cast handling by enemy template and skill with interrupted over started count', () => {
    const stats = buildEncounterStats(createState([
      ...Array.from({ length: 8 }, (_, index): CombatLogEvent => ({
        id: `cast-start-${index}`,
        occurredAtMs: 1000 + index * 100,
        type: 'cast-started',
        source: { kind: 'enemy', id: `murloc-darter-${index % 2}`, name: '鱼人吹箭者' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'enemySkill', id: 'murloc-upgrade', name: '鱼人升级' },
        castId: `cast-${index}`,
        enemyId: `murloc-darter-${index % 2}`,
        enemySkillId: 'murloc-upgrade',
        dangerLevel: 'medium',
        breakRule: 'interruptOrControl',
      })),
      ...Array.from({ length: 2 }, (_, index): CombatLogEvent => ({
        id: `cast-interrupted-${index}`,
        occurredAtMs: 1500 + index * 100,
        type: 'cast-interrupted',
        source: { kind: 'enemy', id: `murloc-darter-${index}`, name: '鱼人吹箭者' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'enemySkill', id: 'murloc-upgrade', name: '鱼人升级' },
        castId: `cast-${index}`,
        enemyId: `murloc-darter-${index}`,
        enemySkillId: 'murloc-upgrade',
        dangerLevel: 'medium',
        breakRule: 'interruptOrControl',
        handlerSkillId: 'interrupt',
        handlerName: '拳击',
      })),
      ...Array.from({ length: 6 }, (_, index): CombatLogEvent => ({
        id: `cast-resolved-${index}`,
        occurredAtMs: 2000 + index * 100,
        type: 'cast-resolved',
        source: { kind: 'enemy', id: `murloc-darter-${index % 2}`, name: '鱼人吹箭者' },
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: { kind: 'enemySkill', id: 'murloc-upgrade', name: '鱼人升级' },
        castId: `cast-${index + 2}`,
        enemyId: `murloc-darter-${index % 2}`,
        enemySkillId: 'murloc-upgrade',
        dangerLevel: 'medium',
        breakRule: 'interruptOrControl',
      })),
    ]))

    expect(stats.castHandling).toMatchObject([
      {
        enemyName: '鱼人吹箭者',
        skillName: '鱼人升级',
        dangerLevel: 'medium',
        interruptedCount: 2,
        controlledCount: 0,
        completedCount: 6,
        unhandleableCount: 0,
        totalCasts: 8,
        handlerNames: ['拳击'],
      },
    ])
  })

  it('returns empty rows for an empty combat log', () => {
    const stats = buildEncounterStats(createState([]))

    expect(stats.tankDamageTaken).toEqual([])
    expect(stats.pressureGained).toEqual([])
    expect(stats.castHandling).toEqual([])
    expect(stats.damageDealt).toEqual([])
    expect(stats.healingAndAbsorb).toEqual([])
    expect(stats.enemyHealingAndAbsorb).toEqual([])
  })
})
