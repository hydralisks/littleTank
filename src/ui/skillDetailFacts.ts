import type {
  ActiveSkillDefinition,
  ActiveSkillEffectDefinition,
} from '../game/encounter/encounterTypes'

export interface SkillDetailFact {
  key: string
  label: string
  value: string
}

interface OrderedSkillDetailFact extends SkillDetailFact {
  order: number
}

const FACT_ORDER = {
  cooldown: 10,
  damage: 20,
  threat: 30,
  mitigation: 40,
  healing: 50,
  absorb: 60,
  duration: 70,
  resource: 80,
} as const

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100
  return String(rounded)
}

function formatMilliseconds(value: number) {
  return `${formatNumber(value / 1000)} 秒`
}

function formatRatio(value: number) {
  return `${formatNumber(value * 100)}%`
}

function formatPercentagePoints(value: number) {
  return `${formatNumber(value)}%`
}

function isPositiveNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function buildSkillDetailFacts(
  skill: ActiveSkillDefinition,
  skillEffects: ActiveSkillEffectDefinition[],
): SkillDetailFact[] {
  const effects = skillEffects
    .filter((effect) => effect.enabled)
    .sort((left, right) => left.effectIndex - right.effectIndex)
  const primary = effects.find((effect) => effect.effectIndex === 1) ?? effects[0]
  const secondary = effects.find((effect) => effect.effectIndex === 2)
  const facts: OrderedSkillDetailFact[] = []

  const addFact = (
    key: string,
    label: string,
    value: number | undefined,
    formatter: (entry: number) => string,
    order: number,
  ) => {
    if (!isPositiveNumber(value)) {
      return
    }

    const formattedValue = formatter(value)
    if (facts.some((fact) => fact.key === key && fact.value === formattedValue)) {
      return
    }

    facts.push({ key, label, value: formattedValue, order })
  }

  const addDuration = (effect: ActiveSkillEffectDefinition | undefined = primary) => {
    addFact('duration', '持续时间', effect?.durationMs, formatMilliseconds, FACT_ORDER.duration)
  }

  addFact('cooldown', '技能冷却', skill.cooldownMs, formatMilliseconds, FACT_ORDER.cooldown)

  const threatMultipliers = [...new Set(
    effects
      .map((effect) => effect.threatMultiplier)
      .filter(isPositiveNumber),
  )]
  if (threatMultipliers.length > 0) {
    facts.push({
      key: 'threatMultiplier',
      label: '仇恨倍数',
      value: threatMultipliers.map((value) => `×${formatNumber(value)}`).join(' / '),
      order: FACT_ORDER.threat,
    })
  }

  switch (skill.skillLogicId) {
    case 'stun':
    case 'shockwave':
      addFact('damage', '技能伤害', primary?.valueA, formatNumber, FACT_ORDER.damage)
      addDuration()
      break
    case 'thunderstruck':
    case 'revenge':
    case 'shield_slam':
    case 'bear_swipe':
      addFact('damage', '技能伤害', primary?.valueA, formatNumber, FACT_ORDER.damage)
      break
    case 'ignore_pain':
      addFact('absorb', '吸收盾', primary?.valueA, formatNumber, FACT_ORDER.absorb)
      addFact('absorbRatio', '伤害吸收比例', primary?.valueB, formatRatio, FACT_ORDER.absorb + 1)
      addDuration()
      break
    case 'shield_block':
      addFact('physicalReduction', '物理伤害减免', primary?.valueB, formatRatio, FACT_ORDER.mitigation)
      addDuration()
      break
    case 'avatar':
      addFact('damageIncrease', '技能伤害提高', secondary?.valueB, formatRatio, FACT_ORDER.damage)
      addDuration(secondary)
      addFact('resourceGain', '怒气获取', primary?.valueA, formatNumber, FACT_ORDER.resource)
      break
    case 'rallying_cry': {
      const playerEffect = effects.find((effect) => effect.targetSelector === 'self') ?? primary
      const partyEffect = effects.find((effect) => effect.targetSelector === 'party') ?? secondary
      addFact('playerHealingRatio', '自身最大生命值治疗', playerEffect?.valueB, formatRatio, FACT_ORDER.healing)
      addFact('partyHealingRatio', '队伍最大生命值治疗', partyEffect?.valueB, formatRatio, FACT_ORDER.healing + 1)
      break
    }
    case 'demoralizing_shout':
      addFact('targetDamageReduction', '目标伤害降低', primary?.valueB, formatRatio, FACT_ORDER.mitigation)
      addDuration()
      break
    case 'bear_mangle':
    case 'bear_thrash':
      addFact('damage', '技能伤害', primary?.valueA, formatNumber, FACT_ORDER.damage)
      addFact('resourceGain', '怒气获取', primary?.valueB, formatNumber, FACT_ORDER.resource)
      break
    case 'bear_moonfire':
      addFact('damage', '立即及每跳伤害', primary?.valueA, formatNumber, FACT_ORDER.damage)
      addFact('damageInterval', '伤害间隔', primary?.valueB, (value) => `${formatNumber(value)} 秒`, FACT_ORDER.damage + 1)
      addDuration()
      break
    case 'bear_ironfur':
      addFact(
        'physicalReductionPerStack',
        '每层物理伤害减免',
        primary?.valueA,
        formatPercentagePoints,
        FACT_ORDER.mitigation,
      )
      addDuration()
      break
    case 'bear_frenzied_regeneration':
      addFact('healingPerTickRatio', '每跳最大生命值治疗', primary?.valueA, formatRatio, FACT_ORDER.healing)
      addFact('healingTicks', '治疗跳数', primary?.valueB, formatNumber, FACT_ORDER.healing + 1)
      addDuration()
      break
    case 'bear_barkskin':
      addFact('damageReduction', '全伤害减免', primary?.valueB, formatRatio, FACT_ORDER.mitigation)
      addDuration()
      break
    case 'bear_survival_instincts':
      addFact('maxHpIncrease', '最大生命值提高', primary?.valueA, formatRatio, FACT_ORDER.mitigation)
      addFact('damageReduction', '全伤害减免', primary?.valueB, formatRatio, FACT_ORDER.mitigation + 1)
      addDuration()
      break
    case 'bear_lunar_beam':
      addFact('maxHpIncrease', '最大生命值提高', primary?.valueA, formatRatio, FACT_ORDER.mitigation)
      addFact('healingPerTickRatio', '每跳最大生命值治疗', secondary?.valueA, formatRatio, FACT_ORDER.healing)
      addFact('healingTicks', '治疗跳数', secondary?.valueB, formatNumber, FACT_ORDER.healing + 1)
      addDuration()
      break
    case 'bear_incarnation_ursoc':
      addFact('maxHpIncrease', '最大生命值提高', primary?.valueA, formatRatio, FACT_ORDER.mitigation)
      addDuration()
      break
    case 'bear_rage_of_the_sleeper':
      addFact('maxHpIncrease', '最大生命值提高', primary?.valueA, formatRatio, FACT_ORDER.mitigation)
      addFact('damageReduction', '全伤害减免', primary?.valueB, formatRatio, FACT_ORDER.mitigation + 1)
      addDuration()
      break
    case 'bear_regrowth':
      addFact('healing', '即时治疗', primary?.valueA, formatNumber, FACT_ORDER.healing)
      addFact('healingPerTick', '每跳治疗', secondary?.valueA, formatNumber, FACT_ORDER.healing + 1)
      addFact('healingTicks', '治疗跳数', secondary?.valueB, formatNumber, FACT_ORDER.healing + 2)
      addDuration()
      break
    case 'bear_berserk':
      addFact('resourceGain', '怒气获取', primary?.valueA, formatNumber, FACT_ORDER.resource)
      break
    case 'shield_wall':
    case 'shield_reflection':
    case 'intervene':
    case 'taunt':
    case 'taunt_single':
    case 'interrupt_cast':
      addDuration()
      break
  }

  addFact(
    'resourceCost',
    skill.classId === 'warrior_t' || skill.classId === 'druid_bear_t' ? '怒气消耗' : '资源消耗',
    skill.resourceCost,
    formatNumber,
    FACT_ORDER.resource + 1,
  )

  return facts
    .sort((left, right) => left.order - right.order)
    .map(({ key, label, value }) => ({ key, label, value }))
}
