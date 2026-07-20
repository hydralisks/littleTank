import { getEnemyDefinition } from '../data/enemyCatalog'
import { getActiveSkillDefinition, getPassiveModifiers, getSkillEffectsForSkill } from '../data/skillTemplates'
import { createCombatLogEventId, recordCombatLogEvents } from './combatLog'
import { enqueueEncounterEvent } from './encounterEvents'
import { reducePartyPressureByEffectiveHealing } from './partyHealingPressure'
import {
  createEnemyStatusEffect,
  createPlayerBuildStatusEffect,
} from './encounterStatusEffects'
import { getEnemyStatusDamageTakenMultiplier } from './enemyStatusEffectRegistry'
import type {
  ActiveSkillEffectDefinition,
  EncounterEvent,
  EncounterState,
  EnemyState,
  SkillId,
  StatusEffect,
} from './encounterTypes'

const TAUNT_THREAT_BOOST = 72
const MASS_TAUNT_THREAT_BOOST = 48

export interface RuntimeSkillHelpers {
  clamp: (value: number, min: number, max: number) => number
  finalizeEncounterState: (state: EncounterState) => EncounterState
  withCurrentTarget: (
    state: EncounterState,
    updater: (enemy: EnemyState) => EnemyState,
  ) => EncounterState
  withTargetIds: (
    state: EncounterState,
    targetIds: Set<string>,
    updater: (enemy: EnemyState) => EnemyState,
  ) => EncounterState
  getCrossTargetIds: (state: EncounterState) => Set<string>
  getEnemyTargetIdsBySelector: (state: EncounterState, selector: string) => Set<string>
  applyThreatGain: (enemy: EnemyState, tankThreatGain: number, allyThreatGain?: number) => EnemyState
  appendOrReplaceEnemyStatus: (enemy: EnemyState, status: StatusEffect) => EnemyState
  canStopCast: (enemy: EnemyState, skillId: SkillId) => boolean
  canPlayerSkillAffectEnemy: (enemy: EnemyState, skillId: SkillId) => boolean
  advanceEnemySkillCycle: (enemy: EnemyState) => EnemyState
  changePlayerResource: (
    state: EncounterState,
    amount: number,
    reason: string,
    sourceSkillId?: SkillId,
  ) => EncounterState
}

function getPrimaryTargetSelector(skillId: SkillId, fallbackSelector: string) {
  return getSkillEffectsForSkill(skillId)[0]?.targetSelector ?? fallbackSelector
}

function getPrimarySkillEffect(skillId: SkillId) {
  return getSkillEffectsForSkill(skillId)[0]
}

function getSkillEffectByIndex(skillId: SkillId, effectIndex: number) {
  return getSkillEffectsForSkill(skillId).find((effect) => effect.effectIndex === effectIndex)
}

function resolveEffectThreat(effect: ActiveSkillEffectDefinition | undefined, damage: number) {
  if (!effect) {
    return { tankThreatDelta: 0, allyThreatDelta: 0 }
  }

  const threatGain = damage * (effect.threatMultiplier ?? 0) + (effect.threatDelta ?? 0)
  if (threatGain === 0) {
    return { tankThreatDelta: 0, allyThreatDelta: 0 }
  }

  return effect.threatSource === 'party'
    ? { tankThreatDelta: 0, allyThreatDelta: threatGain }
    : { tankThreatDelta: threatGain, allyThreatDelta: 0 }
}

function withEffectThreatMultiplier(
  effect: ActiveSkillEffectDefinition | undefined,
  threatMultiplier: number | null,
) {
  if (!effect || threatMultiplier === null) {
    return effect
  }

  return {
    ...effect,
    threatMultiplier,
  }
}

function enqueueEncounterEvents(state: EncounterState, events: EncounterEvent[]) {
  return events.reduce((nextState, event) => enqueueEncounterEvent(nextState, event), state)
}

function mapTargetingTypeToSelector(targetingType: string) {
  switch (targetingType) {
    case 'crossEnemy':
      return 'cross'
    case 'matrix3x3Enemy':
      return 'matrix3x3'
    case 'topLeft2x2Enemy':
      return 'topLeft2x2'
    case 'allEnemy':
      return 'allEnemy'
    case 'currentEnemy':
    default:
      return 'current'
  }
}

function getSkillDefinitionTargetSelector(skillId: SkillId) {
  return mapTargetingTypeToSelector(getActiveSkillDefinition(skillId)?.targetingType ?? 'currentEnemy')
}

function getSkillDefinitionTargetIds(
  state: EncounterState,
  skillId: SkillId,
  helpers: RuntimeSkillHelpers,
) {
  return helpers.getEnemyTargetIdsBySelector(state, getSkillDefinitionTargetSelector(skillId))
}

function getInterruptTargetIds(
  state: EncounterState,
  skillId: SkillId,
  helpers: RuntimeSkillHelpers,
) {
  const skillDefinition = getActiveSkillDefinition(skillId)
  if (skillDefinition?.targetingType === 'allEnemy') {
    return getSkillDefinitionTargetIds(state, skillId, helpers)
  }

  return state.player.currentTargetId ? new Set([state.player.currentTargetId]) : new Set<string>()
}

function getCurrentTargetEnemy(state: EncounterState) {
  if (!state.player.currentTargetId) {
    return null
  }

  return state.enemies.find((enemy) => enemy.id === state.player.currentTargetId) ?? null
}

function buildThreatAndStatusEvents(
  state: EncounterState,
  enemyId: string,
  status: StatusEffect,
  tankThreatDelta: number,
  allyThreatDelta = 0,
) {
  const events: EncounterEvent[] = [
    {
      type: 'enemy/status-applied',
      occurredAtMs: state.timeMs,
      enemyId,
      statusId: status.id,
      status,
    },
  ]

  if (tankThreatDelta !== 0 || allyThreatDelta !== 0) {
    events.push({
      type: 'enemy/threat-applied',
      occurredAtMs: state.timeMs,
      enemyId,
      tankThreatDelta,
      allyThreatDelta,
    })
  }

  return events
}

function resolveCounteredDurationMs(enemy: EnemyState, skillId: SkillId) {
  const enemyCounteredDurationMs =
    enemy.definitionId
      ? getEnemyDefinition(enemy.definitionId)?.counteredDurationMs
      : undefined

  if (typeof enemyCounteredDurationMs === 'number' && enemyCounteredDurationMs >= 0) {
    return enemyCounteredDurationMs
  }

  return getPrimarySkillEffect(skillId)?.durationMs ?? 0
}

function buildDamageAndDeathEvents(
  state: EncounterState,
  enemies: EnemyState[],
  effect: ActiveSkillEffectDefinition | undefined,
  skillId: SkillId,
  primaryTargetId: string | null,
  primaryDamage: number,
  secondaryDamage: number,
) {
  const playerDamageMultiplier = getPlayerDamageMultiplier(state)
  return enemies.flatMap((enemy) => {
    const damage =
      (enemy.id === primaryTargetId ? primaryDamage : secondaryDamage) *
      playerDamageMultiplier *
      getEnemyStatusDamageTakenMultiplier(enemy)
    const threat = resolveEffectThreat(effect, damage)
    const events: EncounterEvent[] = [
      {
        type: 'enemy/damage-applied',
        occurredAtMs: state.timeMs,
        enemyId: enemy.id,
        amount: damage,
        sourceSkillId: skillId,
      },
    ]

    if (threat.tankThreatDelta !== 0 || threat.allyThreatDelta !== 0) {
      events.push({
        type: 'enemy/threat-applied',
        occurredAtMs: state.timeMs,
        enemyId: enemy.id,
        tankThreatDelta: threat.tankThreatDelta,
        allyThreatDelta: threat.allyThreatDelta,
      })
    }

    if (enemy.hp - damage <= 0) {
      events.push({
        type: 'enemy/died',
        occurredAtMs: state.timeMs,
        enemyId: enemy.id,
        sourceSkillId: skillId,
      })

      if (state.player.currentTargetId === enemy.id) {
        events.push({
          type: 'player/current-target-cleared',
          occurredAtMs: state.timeMs,
          previousTargetEnemyId: enemy.id,
        })
      }
    }

    return events
  })
}

function getPlayerDamageMultiplier(state: EncounterState) {
  const watchedMultiplier = state.enemies.some((enemy) =>
    enemy.hp > 0 &&
    enemy.cast?.target === 'tank' &&
    enemy.statuses.some(
      (status) => status.effectLogicId === 'murlocWatching_status' && status.remainingMs !== 0,
    ),
  )
    ? 0.5
    : 1

  return watchedMultiplier * state.player.buffs.reduce(
    (multiplier, status) => multiplier * (1 + (status.damageMultiplierBonus ?? 0)),
    1,
  )
}

function isHealingSuppressedByMurlocWatch(state: EncounterState, target: 'player' | 'party') {
  return state.enemies.some((enemy) =>
    enemy.hp > 0 &&
    (
      target === 'player'
        ? enemy.cast?.target === 'tank'
        : enemy.cast?.target === 'party' || enemy.cast?.target === 'ally'
    ) &&
    enemy.statuses.some(
      (status) => status.effectLogicId === 'murlocWatching_status' && status.remainingMs !== 0,
    ),
  )
}

function getHealingReceivedMultiplier(state: EncounterState, target: 'player' | 'party') {
  if (target === 'player') {
    return state.player.debuffs.some((status) =>
      status.effectLogicId === 'trollRuptured_status' &&
      status.remainingMs !== 0
    )
      ? 0.5
      : 1
  }

  return state.party.statuses.some((status) =>
    status.effectLogicId === 'trollRuptured_p_status' &&
    status.remainingMs !== 0
  )
    ? 0
    : 1
}

function clampHealing(
  previousHp: number,
  nextHp: number,
  maxHp: number,
  healingSuppressed: boolean,
  helpers: RuntimeSkillHelpers,
) {
  const cappedHp = helpers.clamp(nextHp, 0, maxHp)
  return healingSuppressed && cappedHp > previousHp ? previousHp : cappedHp
}

function buildHealingTelemetryInput<TTarget extends 'tank' | 'party'>(
  target: { kind: TTarget, id: string, name: string },
  previousHp: number,
  nextHp: number,
  rawAmount: number,
) {
  const amount = Math.max(0, nextHp - previousHp)
  return {
    target,
    amount,
    rawAmount: Math.max(0, rawAmount),
    overhealAmount: Math.max(0, rawAmount - amount),
  }
}

function buildFlatDamageEvents(
  state: EncounterState,
  enemies: EnemyState[],
  effect: ActiveSkillEffectDefinition | undefined,
  skillId: SkillId,
  baseDamage: number,
) {
  return buildDamageAndDeathEvents(
    state,
    enemies,
    effect,
    skillId,
    state.player.currentTargetId,
    baseDamage,
    baseDamage,
  )
}

type RuntimeSkillHandler = (
  state: EncounterState,
  skillId: SkillId,
  helpers: RuntimeSkillHelpers,
) => EncounterState

function applyTauntToTargets(
  state: EncounterState,
  skillId: SkillId,
  targetIds: Set<string>,
) {
  const effect = getPrimarySkillEffect(skillId)
  const threatDelta = effect?.threatDelta ?? TAUNT_THREAT_BOOST
  const durationMs = effect?.durationMs ?? 3_000
  const statusId = effect?.statusId ?? 'taunted'
  const status = createPlayerBuildStatusEffect(statusId, durationMs)

  if (!status) {
    return state
  }

  return enqueueEncounterEvents(
    state,
    state.enemies
      .filter((enemy) => targetIds.has(enemy.id))
      .flatMap((enemy) =>
        buildThreatAndStatusEvents(
          state,
          enemy.id,
          status,
          Math.max(0, enemy.allyThreat + threatDelta - enemy.tankThreat),
        ),
      ),
  )
}

function applyStunToTargets(
  state: EncounterState,
  skillId: SkillId,
  helpers: RuntimeSkillHelpers,
  targetIds: Set<string>,
) {
  const effect = getPrimarySkillEffect(skillId)
  const durationMs = effect?.durationMs ?? 2_000
  const statusId = effect?.statusId ?? 'stunned'
  const threatDelta = effect?.threatDelta ?? 18
  const affectedEnemies = state.enemies.filter((enemy) => {
    if (!targetIds.has(enemy.id) || !helpers.canPlayerSkillAffectEnemy(enemy, skillId)) {
      return false
    }

    if (!enemy.cast) {
      return true
    }

    return helpers.canStopCast(enemy, skillId)
  })
  const status = createPlayerBuildStatusEffect(statusId, durationMs)

  if (!status) {
    return state
  }

  return enqueueEncounterEvents(
    state,
    affectedEnemies.flatMap((enemy) => {
      const events = buildThreatAndStatusEvents(state, enemy.id, status, threatDelta)
      if (!enemy.cast) {
        return events
      }

      return [
        {
          type: 'enemy/cast-controlled',
          occurredAtMs: state.timeMs,
          enemyId: enemy.id,
          skillId: enemy.cast.id,
          sourceSkillId: skillId,
          pendingRetryCastSkillId: enemy.cast.phase === 'channeling' ? null : enemy.cast.id,
          ...(enemy.cast.phase === 'channeling' ? { advanceSkillCycle: true } : {}),
        } satisfies EncounterEvent,
        ...events,
      ]
    }),
  )
}

function applyPlayerBuffFromPrimaryEffect(
  state: EncounterState,
  skillId: SkillId,
  fallbackStatusId: string,
  fallbackDurationMs: number,
) {
  const effect = getPrimarySkillEffect(skillId)
  const skillDefinition = getActiveSkillDefinition(skillId)
  const statusId = effect?.statusId ?? fallbackStatusId
  const durationMs = (effect?.durationMs ?? fallbackDurationMs) +
    (skillId === 'warrior_t_shield_block'
      ? getPassiveModifiers(state.passiveTalentIds).shieldBlockDurationBonusMs
      : 0)
  const status = createPlayerBuildStatusEffect(statusId, durationMs)

  if (!status) {
    return state
  }

  const nextStatus =
    status.id === 'ignorePain'
      ? {
          ...status,
          combatLogSource: { kind: 'player' as const, id: 'player', name: '玩家' },
          combatLogAbility: { kind: 'playerSkill' as const, id: skillId, name: skillDefinition?.name },
          absorbRemaining: Math.max(0, effect?.valueA ?? 0),
          absorbRatio: Math.max(0, Math.min(1, effect?.valueB ?? 0)),
        }
      : status.id === 'shieldBlock'
        ? {
            ...status,
            combatLogSource: { kind: 'player' as const, id: 'player', name: '玩家' },
            combatLogAbility: { kind: 'playerSkill' as const, id: skillId, name: skillDefinition?.name },
            damageReductionRatio: Math.max(0, Math.min(1, effect?.valueB ?? 0.5)),
            damageReductionTypes: ['physical' as const],
          }
      : {
          ...status,
          combatLogSource: { kind: 'player' as const, id: 'player', name: '玩家' },
          combatLogAbility: { kind: 'playerSkill' as const, id: skillId, name: skillDefinition?.name },
        }

  const nextState = {
    ...state,
    player: {
      ...state.player,
      buffs: [
        ...state.player.buffs.filter((entry) => entry.id !== nextStatus.id),
        nextStatus,
      ],
    },
  }

  return nextStatus.absorbRemaining && nextStatus.absorbRemaining > 0
    ? recordCombatLogEvents(nextState, [
        {
          id: createCombatLogEventId(state, 'absorb-created', `${skillId}:tank`),
          occurredAtMs: state.timeMs,
          type: 'absorb-created',
          source: { kind: 'player', id: 'player', name: '玩家' },
          target: { kind: 'tank', id: 'tank', name: '坦克' },
          ability: { kind: 'playerSkill', id: skillId, name: skillDefinition?.name },
          amount: nextStatus.absorbRemaining,
        },
      ])
    : nextState
}

const PLAYER_SKILL_RUNTIME_REGISTRY: Record<string, RuntimeSkillHandler> = {
  taunt_single: (state, skillId) => {
    const targetEnemy = getCurrentTargetEnemy(state)
    if (!targetEnemy) {
      return state
    }

    return applyTauntToTargets(state, skillId, new Set([targetEnemy.id]))
  },
  taunt: (state, skillId, helpers) => {
    return applyTauntToTargets(state, skillId, getSkillDefinitionTargetIds(state, skillId, helpers))
  },
  interrupt_cast: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const targetIds = getInterruptTargetIds(state, skillId, helpers)
    const affectedEnemies = state.enemies.filter(
      (enemy) => targetIds.has(enemy.id) && enemy.cast && helpers.canStopCast(enemy, skillId),
    )

    if (affectedEnemies.length === 0) {
      return state
    }

    const events: EncounterEvent[] = affectedEnemies.flatMap((enemy) => {
      if (!enemy.cast) {
        return []
      }

      const counteredDurationMs = resolveCounteredDurationMs(enemy, skillId)
      const status =
        counteredDurationMs > 0 ? createEnemyStatusEffect('countered', counteredDurationMs) : null

      return [
        {
          type: 'enemy/cast-interrupted',
          occurredAtMs: state.timeMs,
          enemyId: enemy.id,
          skillId: enemy.cast.id,
          sourceSkillId: skillId,
          recoveryRemainingMs: counteredDurationMs,
          advanceSkillCycle: true,
        },
        ...(status
          ? [
              {
                type: 'enemy/status-applied',
                occurredAtMs: state.timeMs,
                enemyId: enemy.id,
                statusId: status.id,
                status,
              } satisfies EncounterEvent,
            ]
          : []),
        {
          type: 'enemy/threat-applied',
          occurredAtMs: state.timeMs,
          enemyId: enemy.id,
          tankThreatDelta: 24,
          allyThreatDelta: 0,
        },
      ]
    })

    if (modifiers.interruptVulnerabilityDurationMs > 0) {
      const vulnerability = createPlayerBuildStatusEffect(
        'honedReflexesed',
        modifiers.interruptVulnerabilityDurationMs,
      )

      if (vulnerability) {
        for (const enemy of affectedEnemies) {
          events.push({
            type: 'enemy/status-applied',
            occurredAtMs: state.timeMs,
            enemyId: enemy.id,
            statusId: vulnerability.id,
            status: {
              ...vulnerability,
              damageTakenMultiplierBonus: modifiers.interruptVulnerabilityDamageTakenMultiplierBonus,
            },
          })
        }
      }
    }

    return enqueueEncounterEvents(state, events)
  },
  stun_single: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const fallbackSelector = getSkillDefinitionTargetSelector(skillId)
    const targetIds = modifiers.stunHitsCross
      ? helpers.getCrossTargetIds(state)
      : helpers.getEnemyTargetIdsBySelector(
          state,
          getPrimaryTargetSelector(skillId, fallbackSelector),
        )
    return applyStunToTargets(state, skillId, helpers, targetIds)
  },
  stun: (state, skillId, helpers) => {
    return applyStunToTargets(state, skillId, helpers, getSkillDefinitionTargetIds(state, skillId, helpers))
  },
  mass_taunt: (state, skillId, helpers) => {
    const effect = getPrimarySkillEffect(skillId)
    const selector = effect?.targetSelector ?? 'allEnemy'
    const targetIds = helpers.getEnemyTargetIdsBySelector(state, selector)
    const threatDelta = effect?.threatDelta ?? MASS_TAUNT_THREAT_BOOST
    const durationMs = effect?.durationMs ?? 2_000
    const statusId = effect?.statusId ?? 'mass-taunt'
    const affectedEnemies = state.enemies.filter((enemy) => targetIds.has(enemy.id))
    const status = createPlayerBuildStatusEffect(statusId, durationMs)

    if (!status) {
      return state
    }

    return enqueueEncounterEvents(
      state,
      affectedEnemies.flatMap((enemy) =>
        buildThreatAndStatusEvents(
          state,
          enemy.id,
          status,
          Math.max(0, enemy.allyThreat + threatDelta - enemy.tankThreat),
        ),
      ),
    )
  },
  shield_wall: (state, skillId) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const effect = getPrimarySkillEffect(skillId)
    const durationMs = effect?.durationMs ?? 4_000
    const remainingMs = Math.round(durationMs * modifiers.shieldWallDurationMultiplier)
    const statusId = effect?.statusId ?? 'shieldWall'
    const mitigationStatus = createPlayerBuildStatusEffect(statusId, remainingMs)

    if (!mitigationStatus) {
      return state
    }

    return {
      ...state,
      player: {
        ...state.player,
        mitigation: {
          ...mitigationStatus,
        },
      },
    }
  },
  cleave_adjacent: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const effect = getPrimarySkillEffect(skillId)
    const fallbackSelector =
      mapTargetingTypeToSelector(getActiveSkillDefinition(skillId)?.targetingType ?? 'currentEnemy')
    const targetIds = modifiers.cleaveHitsCross
      ? helpers.getCrossTargetIds(state)
      : helpers.getEnemyTargetIdsBySelector(
          state,
          getPrimaryTargetSelector(
            skillId,
            fallbackSelector === 'current' ? 'adjacent' : fallbackSelector,
          ),
        )
    const affectedEnemies = state.enemies.filter((enemy) => targetIds.has(enemy.id))
    const primaryDamage = effect?.valueA ?? 22
    const secondaryDamage = effect?.valueB ?? 10

    return enqueueEncounterEvents(
      state,
      buildDamageAndDeathEvents(
        state,
        affectedEnemies,
        effect,
        skillId,
        state.player.currentTargetId,
        primaryDamage,
        secondaryDamage,
      ),
    )
  },
  revenge: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const effect = getPrimarySkillEffect(skillId)
    const targetIds = helpers.getEnemyTargetIdsBySelector(
      state,
      getPrimaryTargetSelector(skillId, getSkillDefinitionTargetSelector(skillId)),
    )
    const damage = effect?.valueA ?? 10
    const affectedEnemies = state.enemies.filter((enemy) => targetIds.has(enemy.id))

    const damagedState = enqueueEncounterEvents(
      state,
      buildDamageAndDeathEvents(
        state,
        affectedEnemies,
        effect,
        skillId,
        state.player.currentTargetId,
        damage,
        damage,
      ),
    )

    return modifiers.revengeRefundChance > 0 && Math.random() < modifiers.revengeRefundChance
      ? helpers.changePlayerResource(damagedState, modifiers.revengeRefundResource, 'skill_logic', skillId)
      : damagedState
  },
  ignore_pain: (state, skillId) =>
    applyPlayerBuffFromPrimaryEffect(state, skillId, 'ignorePain', 5_000),
  shield_block: (state, skillId) =>
    applyPlayerBuffFromPrimaryEffect(state, skillId, 'shieldBlock', 7_000),
  shield_slam: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const effect = getPrimarySkillEffect(skillId)
    const targetEnemy = getCurrentTargetEnemy(state)
    if (!targetEnemy) {
      return state
    }

    const damagedState = enqueueEncounterEvents(
      helpers.changePlayerResource(state, 10, 'skill_logic', skillId),
      buildFlatDamageEvents(state, [targetEnemy], effect, skillId, effect?.valueA ?? 15),
    )

    if (modifiers.shieldSlamPunishDurationMs <= 0) {
      return damagedState
    }

    const status = createPlayerBuildStatusEffect('punished', modifiers.shieldSlamPunishDurationMs)
    if (!status) {
      return damagedState
    }

    return enqueueEncounterEvents(damagedState, [
      {
        type: 'enemy/status-applied',
        occurredAtMs: state.timeMs,
        enemyId: targetEnemy.id,
        statusId: status.id,
        status: {
          ...status,
          stacks: 1,
          maxStacks: modifiers.shieldSlamPunishMaxStacks,
          outgoingDamageReductionRatio: modifiers.shieldSlamPunishOutgoingDamageReductionRatio,
        },
      },
    ])
  },
  shield_reflection: (state, skillId) =>
    applyPlayerBuffFromPrimaryEffect(state, skillId, 'shieldReflection', 1_000),
  avatar: (state, skillId, helpers) => {
    const rageEffect = getSkillEffectByIndex(skillId, 1)
    const buffEffect = getSkillEffectByIndex(skillId, 2) ?? getPrimarySkillEffect(skillId)
    const nextState = helpers.changePlayerResource(
      state,
      rageEffect?.valueA ?? 50,
      'skill_logic',
      skillId,
    )
    const status = createPlayerBuildStatusEffect(
      buffEffect?.statusId ?? 'avatar',
      buffEffect?.durationMs ?? 16_000,
    )

    if (!status) {
      return nextState
    }

    const avatarStatus = {
      ...status,
      damageMultiplierBonus: Math.max(0, buffEffect?.valueB ?? 0.5),
    }

    return {
      ...nextState,
      player: {
        ...nextState.player,
        buffs: [
          ...nextState.player.buffs.filter((entry) => entry.id !== avatarStatus.id),
          avatarStatus,
        ],
      },
    }
  },
  shockwave: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const targetIds = helpers.getEnemyTargetIdsBySelector(
      state,
      modifiers.shockwaveUsesMatrix3x3
        ? 'matrix3x3'
        : getPrimaryTargetSelector(skillId, getSkillDefinitionTargetSelector(skillId)),
    )
    return applyStunToTargets(state, skillId, helpers, targetIds)
  },
  thunderstruck: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const effect = getPrimarySkillEffect(skillId)
    const targetIds = helpers.getEnemyTargetIdsBySelector(
      state,
      getPrimaryTargetSelector(skillId, getSkillDefinitionTargetSelector(skillId)),
    )
    const affectedEnemies = state.enemies.filter((enemy) => targetIds.has(enemy.id))
    const damage = (effect?.valueA ?? 15) * modifiers.thunderstruckDamageMultiplier

    return enqueueEncounterEvents(
      helpers.changePlayerResource(state, 10, 'skill_logic', skillId),
      buildFlatDamageEvents(
        state,
        affectedEnemies,
        withEffectThreatMultiplier(effect, modifiers.thunderstruckThreatMultiplierOverride),
        skillId,
        damage,
      ),
    )
  },
  rallying_cry: (state, skillId, helpers) => {
    const effects = getSkillEffectsForSkill(skillId)
    const playerHealRatio = effects[0]?.valueB ?? 0.2
    const partyHealRatio = effects[1]?.valueB ?? playerHealRatio

    const nextPlayerHp = clampHealing(
      state.player.hp,
      state.player.hp + state.player.maxHp * playerHealRatio * getHealingReceivedMultiplier(state, 'player'),
      state.player.maxHp,
      isHealingSuppressedByMurlocWatch(state, 'player'),
      helpers,
    )
    const nextPartyHp = clampHealing(
      state.party.hp,
      state.party.hp + state.party.maxHp * partyHealRatio * getHealingReceivedMultiplier(state, 'party'),
      state.party.maxHp,
      isHealingSuppressedByMurlocWatch(state, 'party'),
      helpers,
    )
    const nextState = {
      ...state,
      player: {
        ...state.player,
        hp: nextPlayerHp,
      },
      party: reducePartyPressureByEffectiveHealing({
        ...state.party,
        hp: nextPartyHp,
      }, Math.max(0, nextPartyHp - state.party.hp)),
    }
    const events = [
      buildHealingTelemetryInput(
        { kind: 'tank' as const, id: 'tank', name: '坦克' },
        state.player.hp,
        nextPlayerHp,
        state.player.maxHp * playerHealRatio * getHealingReceivedMultiplier(state, 'player'),
      ),
      buildHealingTelemetryInput(
        { kind: 'party' as const, id: 'party', name: '队伍' },
        state.party.hp,
        nextPartyHp,
        state.party.maxHp * partyHealRatio * getHealingReceivedMultiplier(state, 'party'),
      ),
    ].filter((event) => event.amount > 0).map((event) => ({
      id: createCombatLogEventId(state, 'healing', `${skillId}:${event.target.kind}`),
      occurredAtMs: state.timeMs,
      type: 'healing' as const,
      source: { kind: 'player' as const, id: 'player', name: '玩家' },
      target: event.target,
      ability: { kind: 'playerSkill' as const, id: skillId, name: getActiveSkillDefinition(skillId)?.name },
      amount: event.amount,
      rawAmount: event.rawAmount,
      overhealAmount: event.overhealAmount,
    }))

    return recordCombatLogEvents(nextState, events)
  },
  intervene: (state, skillId) => {
    const effect = getPrimarySkillEffect(skillId)
    const status = createPlayerBuildStatusEffect(
      effect?.statusId ?? 'intervened',
      effect?.durationMs ?? 5_000,
    )

    if (!status) {
      return state
    }

    return {
      ...state,
      party: {
        ...state.party,
        statuses: [
          ...state.party.statuses.filter((entry) => entry.id !== status.id),
          status,
        ],
      },
    }
  },
  demoralizing_shout: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const effect = getPrimarySkillEffect(skillId)
    const status = createPlayerBuildStatusEffect(
      effect?.statusId ?? 'demoralized',
      effect?.durationMs ?? 5_000,
    )
    const targetIds = helpers.getEnemyTargetIdsBySelector(
      state,
      getPrimaryTargetSelector(skillId, getSkillDefinitionTargetSelector(skillId)),
    )

    if (!status) {
      return state
    }

    const demoralizedStatus = {
      ...status,
      outgoingDamageReductionRatio: Math.max(0, Math.min(1, effect?.valueB ?? 0.25)),
    }

    return enqueueEncounterEvents(
      modifiers.demoralizingShoutResourceGain > 0
        ? helpers.changePlayerResource(state, modifiers.demoralizingShoutResourceGain, 'skill_logic', skillId)
        : state,
      state.enemies
        .filter((enemy) => targetIds.has(enemy.id))
        .flatMap((enemy) =>
          buildThreatAndStatusEvents(
            state,
            enemy.id,
            demoralizedStatus,
            effect?.threatDelta ?? 20,
          ),
        ),
    )
  },
  burst_single: (state, skillId, helpers) => {
    const modifiers = getPassiveModifiers(state.passiveTalentIds)
    const effect = getPrimarySkillEffect(skillId)
    const selector = effect?.targetSelector ?? 'current'
    const targetIds = helpers.getEnemyTargetIdsBySelector(state, selector)
    const primaryDamage = (effect?.valueA ?? 48) * modifiers.burstEffectMultiplier
    const secondaryDamage =
      (effect?.valueB ?? effect?.valueA ?? 48) * modifiers.burstEffectMultiplier
    const affectedEnemies = state.enemies.filter((enemy) => targetIds.has(enemy.id))

    return enqueueEncounterEvents(
      state,
      buildDamageAndDeathEvents(
        state,
        affectedEnemies,
        effect,
        skillId,
        state.player.currentTargetId,
        primaryDamage,
        secondaryDamage,
      ),
    )
  },
  panic_recovery: (state, skillId, helpers) => {
    const nextPartyHp = clampHealing(
      state.party.hp,
      state.party.hp + 120 * getHealingReceivedMultiplier(state, 'party'),
      state.party.maxHp,
      isHealingSuppressedByMurlocWatch(state, 'party'),
      helpers,
    )
    const nextPlayerHp = clampHealing(
      state.player.hp,
      state.player.hp + 80 * getHealingReceivedMultiplier(state, 'player'),
      state.player.maxHp,
      isHealingSuppressedByMurlocWatch(state, 'player'),
      helpers,
    )
    const nextState = {
      ...state,
      party: reducePartyPressureByEffectiveHealing({
        ...state.party,
        hp: nextPartyHp,
        pressure: Math.max(0, state.party.pressure - 20),
      }, Math.max(0, nextPartyHp - state.party.hp)),
      player: {
        ...state.player,
        hp: nextPlayerHp,
      },
    }
    const events = [
      buildHealingTelemetryInput(
        { kind: 'party' as const, id: 'party', name: '队伍' },
        state.party.hp,
        nextPartyHp,
        120 * getHealingReceivedMultiplier(state, 'party'),
      ),
      buildHealingTelemetryInput(
        { kind: 'tank' as const, id: 'tank', name: '坦克' },
        state.player.hp,
        nextPlayerHp,
        80 * getHealingReceivedMultiplier(state, 'player'),
      ),
    ].filter((event) => event.amount > 0).map((event) => ({
      id: createCombatLogEventId(state, 'healing', `${skillId}:${event.target.kind}`),
      occurredAtMs: state.timeMs,
      type: 'healing' as const,
      source: { kind: 'player' as const, id: 'player', name: '玩家' },
      target: event.target,
      ability: { kind: 'playerSkill' as const, id: skillId, name: getActiveSkillDefinition(skillId)?.name },
      amount: event.amount,
      rawAmount: event.rawAmount,
      overhealAmount: event.overhealAmount,
    }))

    return recordCombatLogEvents(nextState, events)
  },
  rage_gain_debug: (state, skillId, helpers) =>
    helpers.changePlayerResource(state, 12, 'skill_logic', skillId),
}

export function resolvePlayerSkillRuntime(
  state: EncounterState,
  skillId: SkillId,
  helpers: RuntimeSkillHelpers,
) {
  const skillDefinition = getActiveSkillDefinition(skillId)
  if (!skillDefinition) {
    return state
  }

  const handler = PLAYER_SKILL_RUNTIME_REGISTRY[skillDefinition.skillLogicId]
  return handler
    ? helpers.finalizeEncounterState(handler(state, skillId, helpers))
    : helpers.finalizeEncounterState(state)
}

export function hasPlayerSkillRuntime(skillLogicId: string) {
  return skillLogicId in PLAYER_SKILL_RUNTIME_REGISTRY
}
