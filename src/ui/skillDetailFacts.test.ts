import { describe, expect, it } from 'vitest'
import type {
  ActiveSkillDefinition,
  ActiveSkillEffectDefinition,
} from '../game/encounter/encounterTypes'
import { buildSkillDetailFacts } from './skillDetailFacts'

function createSkill(overrides: Partial<ActiveSkillDefinition> = {}): ActiveSkillDefinition {
  return {
    id: 'test_skill',
    classId: 'druid_bear_t',
    name: '测试技能',
    shortName: '测试',
    description: '',
    iconId: 'test',
    cooldownMs: 9_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 1_500,
    pointCost: 4,
    targetingType: 'enemy',
    skillLogicId: 'bear_thrash',
    castStopMode: 'none',
    canAffectSkull: false,
    grantedStatusIds: [],
    ...overrides,
  }
}

function createEffect(
  overrides: Partial<ActiveSkillEffectDefinition> = {},
): ActiveSkillEffectDefinition {
  return {
    skillEffectId: 'effect',
    skillId: 'test_skill',
    effectIndex: 1,
    targetSelector: 'cross',
    enabled: true,
    ...overrides,
  }
}

describe('buildSkillDetailFacts', () => {
  it('formats cooldown, Bear damage, threat, and rage from base definitions', () => {
    expect(buildSkillDetailFacts(
      createSkill(),
      [createEffect({ valueA: 10, valueB: 10, threatMultiplier: 5 })],
    )).toEqual([
      { key: 'cooldown', label: '技能冷却', value: '9 秒' },
      { key: 'damage', label: '技能伤害', value: '10' },
      { key: 'threatMultiplier', label: '仇恨倍数', value: '×5' },
      { key: 'resourceGain', label: '怒气获取', value: '10' },
    ])
  })

  it('formats Bear mitigation, duration, and fixed healing facts', () => {
    expect(buildSkillDetailFacts(
      createSkill({ skillLogicId: 'bear_barkskin', cooldownMs: 30_000 }),
      [createEffect({ valueB: 0.3, durationMs: 10_000 })],
    )).toEqual([
      { key: 'cooldown', label: '技能冷却', value: '30 秒' },
      { key: 'damageReduction', label: '全伤害减免', value: '30%' },
      { key: 'duration', label: '持续时间', value: '10 秒' },
    ])

    expect(buildSkillDetailFacts(
      createSkill({ skillLogicId: 'bear_regrowth', cooldownMs: 20_000, resourceCost: 20 }),
      [
        createEffect({ effectIndex: 1, valueA: 25, valueB: 5, durationMs: 6_000 }),
        createEffect({ skillEffectId: 'tick', effectIndex: 2, valueA: 5, valueB: 3, durationMs: 6_000 }),
      ],
    )).toEqual([
      { key: 'cooldown', label: '技能冷却', value: '20 秒' },
      { key: 'healing', label: '即时治疗', value: '25' },
      { key: 'healingPerTick', label: '每跳治疗', value: '5' },
      { key: 'healingTicks', label: '治疗跳数', value: '3' },
      { key: 'duration', label: '持续时间', value: '6 秒' },
      { key: 'resourceCost', label: '怒气消耗', value: '20' },
    ])
  })

  it('formats Warrior absorb, mitigation, damage, and team-healing facts', () => {
    expect(buildSkillDetailFacts(
      createSkill({ classId: 'warrior_t', skillLogicId: 'ignore_pain', cooldownMs: 0, resourceCost: 20 }),
      [createEffect({ valueA: 25, valueB: 0.5, durationMs: 5_000 })],
    )).toEqual([
      { key: 'absorb', label: '吸收盾', value: '25' },
      { key: 'absorbRatio', label: '伤害吸收比例', value: '50%' },
      { key: 'duration', label: '持续时间', value: '5 秒' },
      { key: 'resourceCost', label: '怒气消耗', value: '20' },
    ])

    expect(buildSkillDetailFacts(
      createSkill({ classId: 'warrior_t', skillLogicId: 'shield_block', cooldownMs: 0, resourceCost: 20 }),
      [createEffect({ valueB: 0.5, durationMs: 7_000 })],
    )).toEqual([
      { key: 'physicalReduction', label: '物理伤害减免', value: '50%' },
      { key: 'duration', label: '持续时间', value: '7 秒' },
      { key: 'resourceCost', label: '怒气消耗', value: '20' },
    ])

    expect(buildSkillDetailFacts(
      createSkill({ classId: 'warrior_t', skillLogicId: 'rallying_cry', cooldownMs: 20_000, resourceCost: 10 }),
      [
        createEffect({ targetSelector: 'self', valueB: 0.2, threatMultiplier: 1 }),
        createEffect({ skillEffectId: 'party', effectIndex: 2, targetSelector: 'party', valueB: 0.2, threatMultiplier: 1 }),
      ],
    )).toEqual([
      { key: 'cooldown', label: '技能冷却', value: '20 秒' },
      { key: 'threatMultiplier', label: '仇恨倍数', value: '×1' },
      { key: 'playerHealingRatio', label: '自身最大生命值治疗', value: '20%' },
      { key: 'partyHealingRatio', label: '队伍最大生命值治疗', value: '20%' },
      { key: 'resourceCost', label: '怒气消耗', value: '10' },
    ])
  })

  it('formats percentage-point fields without treating them as ratios', () => {
    expect(buildSkillDetailFacts(
      createSkill({ skillLogicId: 'bear_ironfur', cooldownMs: 0, resourceCost: 20 }),
      [createEffect({ valueA: 20, durationMs: 8_000 })],
    )).toEqual([
      { key: 'physicalReductionPerStack', label: '每层物理伤害减免', value: '20%' },
      { key: 'duration', label: '持续时间', value: '8 秒' },
      { key: 'resourceCost', label: '怒气消耗', value: '20' },
    ])
  })

  it('omits zero cooldown, disabled effects, duplicate threat, and unknown value semantics', () => {
    const facts = buildSkillDetailFacts(
      createSkill({ cooldownMs: 0, skillLogicId: 'unknown_logic' }),
      [
        createEffect({ valueA: 999, valueB: 888, threatMultiplier: 5 }),
        createEffect({ skillEffectId: 'duplicate', effectIndex: 2, threatMultiplier: 5 }),
        createEffect({ skillEffectId: 'disabled', effectIndex: 3, threatMultiplier: 9, enabled: false }),
      ],
    )

    expect(facts).toEqual([
      { key: 'threatMultiplier', label: '仇恨倍数', value: '×5' },
    ])
  })
})
