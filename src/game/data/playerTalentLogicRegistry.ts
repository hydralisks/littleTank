import type {
  PassiveTalentDefinition,
  PassiveTalentEffectDefinition,
  PassiveTalentModifiers,
  PlayerBuildStatusDefinition,
  StatusEffect,
} from '../encounter/encounterTypes'

export interface PassiveTalentLogicHelpers {
  resolveStatusDefinition: (statusId: string) => PlayerBuildStatusDefinition | undefined
  createStatusEffectFromDefinition: (definition: PlayerBuildStatusDefinition) => StatusEffect
  resolveTalentEffects: (talentId: string) => PassiveTalentEffectDefinition[]
}

type PassiveTalentLogicHandler = (
  talent: PassiveTalentDefinition,
  modifiers: PassiveTalentModifiers,
  helpers: PassiveTalentLogicHelpers,
) => PassiveTalentModifiers

const runtimeOnlyTalent: PassiveTalentLogicHandler = (_talent, modifiers) => modifiers

const PASSIVE_TALENT_LOGIC_REGISTRY: Record<string, PassiveTalentLogicHandler> = {
  player_max_hp_up: (talent, modifiers, helpers) => ({
    ...modifiers,
    playerMaxHpBonus: modifiers.playerMaxHpBonus + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 180),
  }),
  reinforced_plates: (talent, modifiers, helpers) => ({
    ...modifiers,
    playerMaxHpMultiplier: modifiers.playerMaxHpMultiplier * (1 + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 0.5)),
  }),
  resource_regen_up: (talent, modifiers, helpers) => ({
    ...modifiers,
    playerResourceRegenMultiplier: modifiers.playerResourceRegenMultiplier * firstNonZeroEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 1.65),
  }),
  grant_permanent_buff: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)
    const statusIds = effects.map((effect) => effect.statusId).filter((statusId): statusId is string => Boolean(statusId))
    const resolvedStatusIds = statusIds.length > 0 ? statusIds : talent.grantedStatusIds

    return {
      ...modifiers,
      playerDamageTakenMultiplier: modifiers.playerDamageTakenMultiplier * firstNonZeroEffectValue(effects, 'valueB', 0.9),
      playerPassiveBuffs: [
        ...modifiers.playerPassiveBuffs,
        ...resolvedStatusIds
          .map(helpers.resolveStatusDefinition)
          .filter((status): status is PlayerBuildStatusDefinition => Boolean(status))
          .map(helpers.createStatusEffectFromDefinition),
      ],
    }
  },
  player_resource_cap_up: (talent, modifiers, helpers) => ({
    ...modifiers,
    playerMaxResourceBonus: modifiers.playerMaxResourceBonus + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 25),
  }),
  stun_hits_cross: (_talent, modifiers) => ({
    ...modifiers,
    stunHitsCross: true,
  }),
  interrupt_ignore_gcd: (_talent, modifiers) => ({
    ...modifiers,
    interruptIgnoresGcd: true,
  }),
  snap_interrupt: (_talent, modifiers) => ({
    ...modifiers,
    interruptIgnoresGcd: true,
  }),
  burst_half_cd_lower_effect: (_talent, modifiers) => ({
    ...modifiers,
    burstCooldownMultiplier: modifiers.burstCooldownMultiplier * 0.5,
    burstEffectMultiplier: modifiers.burstEffectMultiplier * 0.78,
  }),
  cleave_hits_cross: (_talent, modifiers) => ({
    ...modifiers,
    cleaveHitsCross: true,
  }),
  shield_wall_extended: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)

    return {
      ...modifiers,
      shieldWallDurationMultiplier: modifiers.shieldWallDurationMultiplier * firstNonZeroEffectValue(effects, 'valueA', 1.6),
      shieldWallCooldownMultiplier: modifiers.shieldWallCooldownMultiplier * firstNonZeroEffectValue(effects, 'valueB', 0.72),
    }
  },
  party_pressure_cap_up: (talent, modifiers, helpers) => ({
    ...modifiers,
    partyMaxPressureBonus: modifiers.partyMaxPressureBonus + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 18),
  }),
  raise_banner: (talent, modifiers, helpers) => ({
    ...modifiers,
    partyMaxPressureMultiplier: modifiers.partyMaxPressureMultiplier * (1 + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 0.5)),
  }),
  party_pressure_drift_down_with_periodic_stun: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)

    return {
      ...modifiers,
      periodicPlayerStunIntervalMs: firstNonZeroEffectValue(effects, 'valueA', 12_000),
      periodicPlayerStunDurationMs: firstNonZeroEffectValue(effects, 'valueB', 2_000),
    }
  },
  party_hp_half_taunt_cd_down: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)

    return {
      ...modifiers,
      partyMaxHpMultiplier: modifiers.partyMaxHpMultiplier * firstNonZeroEffectValue(effects, 'valueA', 0.5),
      tauntCooldownMultiplier: modifiers.tauntCooldownMultiplier * firstNonZeroEffectValue(effects, 'valueB', 0.55),
      massTauntCooldownMultiplier: modifiers.massTauntCooldownMultiplier * firstNonZeroEffectValue(effects, 'valueB', 0.55),
    }
  },
  bonus_build_points_with_pressure_drift_up: (talent, modifiers, helpers) => ({
    ...modifiers,
    bonusBuildPoints: modifiers.bonusBuildPoints + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 8),
  }),
  party_pressure_cap_up_large: (talent, modifiers, helpers) => ({
    ...modifiers,
    partyMaxPressureBonus: modifiers.partyMaxPressureBonus + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 24),
  }),
  party_hp_regen_with_pressure_up: (talent, modifiers, helpers) => ({
    ...modifiers,
    partyHpDriftPerSecond: modifiers.partyHpDriftPerSecond + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 6),
  }),
  defensive_stance: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)
    const reduction = firstNonZeroEffectValue(effects, 'valueA', 0.1)

    return {
      ...modifiers,
      playerPassiveBuffs: [
        ...modifiers.playerPassiveBuffs,
        ...createPassiveStatuses(talent, helpers).map((status) => ({
          ...status,
          damageReductionRatio: reduction,
          damageReductionTypes: ['physical' as const, 'magic' as const],
        })),
      ],
    }
  },
  defenders_aegis: (_talent, modifiers) => ({
    ...modifiers,
    shieldWallMaxCharges: Math.max(modifiers.shieldWallMaxCharges, 2),
  }),
  barbaric_training: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)

    return {
      ...modifiers,
      partyDamageMultiplier: modifiers.partyDamageMultiplier * (1 + firstNonZeroEffectValue(effects, 'valueA', 0.5)),
      partyThreatMultiplier: modifiers.partyThreatMultiplier * (1 - firstNonZeroEffectValue(effects, 'valueB', 0.3)),
      partyPressureCanDriftDown: false,
    }
  },
  bloodsurge: (talent, modifiers, helpers) => ({
    ...modifiers,
    playerAutoAttackResourceGainBonus:
      modifiers.playerAutoAttackResourceGainBonus + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 1),
  }),
  focused_vigor: (talent, modifiers, helpers) => ({
    ...modifiers,
    playerAutoAttackDamageBonus:
      modifiers.playerAutoAttackDamageBonus + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 1),
  }),
  honed_reflexes: (talent, modifiers, helpers) => {
    const status = createPassiveStatuses(talent, helpers)[0]

    return {
      ...modifiers,
      interruptVulnerabilityDurationMs: status?.remainingMs && status.remainingMs > 0 ? status.remainingMs : 5_000,
      interruptVulnerabilityDamageTakenMultiplierBonus: 0.5,
    }
  },
  frothing_berserker: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)

    return {
      ...modifiers,
      revengeRefundChance: firstNonZeroEffectValue(effects, 'valueA', 0.5),
      revengeRefundResource: firstNonZeroEffectValue(effects, 'valueB', 10),
    }
  },
  punish: (talent, modifiers, helpers) => {
    const status = createPassiveStatuses(talent, helpers)[0]

    return {
      ...modifiers,
      shieldSlamPunishDurationMs: status?.remainingMs && status.remainingMs > 0 ? status.remainingMs : 8_000,
      shieldSlamPunishMaxStacks: status?.maxStacks ?? 3,
      shieldSlamPunishOutgoingDamageReductionRatio: 0.1,
    }
  },
  enduring_defenses: (talent, modifiers, helpers) => ({
    ...modifiers,
    shieldBlockDurationBonusMs:
      modifiers.shieldBlockDurationBonusMs + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 3) * 1000,
  }),
  immortal_stance: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)
    const damageReductionRatio = firstNonZeroEffectValue(effects, 'valueA', 0.3)
    const outgoingDamageReductionRatio = firstNonZeroEffectValue(effects, 'valueB', 0.2)

    return {
      ...modifiers,
      playerPassiveBuffs: [
        ...modifiers.playerPassiveBuffs,
        ...createPassiveStatuses(talent, helpers).map((status) => ({
          ...status,
          damageReductionRatio,
          damageReductionTypes: ['physical' as const, 'magic' as const],
          damageMultiplierBonus: -outgoingDamageReductionRatio,
        })),
      ],
    }
  },
  booming_voice: (talent, modifiers, helpers) => ({
    ...modifiers,
    demoralizingShoutResourceGain:
      modifiers.demoralizingShoutResourceGain + sumEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 50),
  }),
  rumbling_earth: (_talent, modifiers) => ({
    ...modifiers,
    shockwaveUsesMatrix3x3: true,
  }),
  crackling_thunder: (talent, modifiers, helpers) => {
    const effects = helpers.resolveTalentEffects(talent.id)

    return {
      ...modifiers,
      thunderstruckDamageMultiplier:
        modifiers.thunderstruckDamageMultiplier * firstNonZeroEffectValue(effects, 'valueA', 3),
      thunderstruckThreatMultiplierOverride: firstNonZeroEffectValue(effects, 'valueB', 2),
    }
  },
  bear_physical_reduction: (talent, modifiers, helpers) => ({
    ...modifiers,
    bearPhysicalDamageReduction: Math.max(
      modifiers.bearPhysicalDamageReduction,
      firstNonZeroEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 0.08),
    ),
  }),
  bear_threat_multiplier: (talent, modifiers, helpers) => ({
    ...modifiers,
    bearThreatMultiplier: modifiers.bearThreatMultiplier * (
      1 + firstNonZeroEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 0.2)
    ),
  }),
  bear_generator_bonus: runtimeOnlyTalent,
  bear_control_duration_reduction: (talent, modifiers, helpers) => ({
    ...modifiers,
    bearControlDurationMultiplier: modifiers.bearControlDurationMultiplier * (
      1 - firstNonZeroEffectValue(helpers.resolveTalentEffects(talent.id), 'valueA', 0.25)
    ),
  }),
  bear_ironfur_reserve: runtimeOnlyTalent,
  bear_blood_scent: runtimeOnlyTalent,
  bear_skull_bash_instinct: runtimeOnlyTalent,
  bear_broken_bark: runtimeOnlyTalent,
  bear_pack_presence: runtimeOnlyTalent,
  bear_moonlit_resolve: runtimeOnlyTalent,
  bear_bark_dispelling: runtimeOnlyTalent,
  bear_regenerative_bond: runtimeOnlyTalent,
  bear_ursoc_shelter: runtimeOnlyTalent,
  bear_wild_recovery: runtimeOnlyTalent,
  bear_regrowth_of_the_pack: runtimeOnlyTalent,
  bear_guardian_of_the_grove: runtimeOnlyTalent,
  bear_feral_aftershock: runtimeOnlyTalent,
  bear_last_bear_stand: runtimeOnlyTalent,
  bear_spring_returns: runtimeOnlyTalent,
}

function createPassiveStatuses(
  talent: PassiveTalentDefinition,
  helpers: PassiveTalentLogicHelpers,
) {
  const effects = helpers.resolveTalentEffects(talent.id)
  const statusIds = effects.map((effect) => effect.statusId).filter((statusId): statusId is string => Boolean(statusId))
  const resolvedStatusIds = statusIds.length > 0 ? statusIds : talent.grantedStatusIds

  return resolvedStatusIds
    .map(helpers.resolveStatusDefinition)
    .filter((status): status is PlayerBuildStatusDefinition => Boolean(status))
    .map(helpers.createStatusEffectFromDefinition)
}

function firstNonZeroEffectValue(
  effects: PassiveTalentEffectDefinition[],
  field: 'valueA' | 'valueB',
  fallback: number,
) {
  return effects.find((effect) => typeof effect[field] === 'number' && effect[field] !== 0)?.[field] ?? fallback
}

function sumEffectValue(
  effects: PassiveTalentEffectDefinition[],
  field: 'valueA' | 'valueB',
  fallback: number,
) {
  if (effects.length === 0) {
    return fallback
  }

  return effects.reduce((total, effect) => total + (effect[field] ?? 0), 0)
}

export function applyPassiveTalentLogic(
  talent: PassiveTalentDefinition,
  modifiers: PassiveTalentModifiers,
  helpers: PassiveTalentLogicHelpers,
) {
  const handler = PASSIVE_TALENT_LOGIC_REGISTRY[talent.talentLogicId]
  return handler ? handler(talent, modifiers, helpers) : modifiers
}

export function hasPassiveTalentLogic(talentLogicId: string) {
  return talentLogicId in PASSIVE_TALENT_LOGIC_REGISTRY
}
