import { applyEncounterEventTriggers, type EncounterEventTrigger } from './encounterEventTriggers'
import type { CombatTarget, EncounterEvent, EncounterState, EnemyState, StatusEffect } from './encounterTypes'

export type EnemyChannelStopReason = 'completed' | 'controlled' | 'interrupted'

export interface EnemyStatusApplyContext {
  tuning: EncounterState['stage']['tuning']
}

export interface EnemyChannelStopContext {
  skillId: string
  reason: EnemyChannelStopReason
}

export interface EnemyStatusTickContext {
  deltaMs: number
  castTarget: CombatTarget | null
  remainingMsAfterTick: number
}

export interface EnemyStatusEventContext {
  enemyId: string
}

export interface EnemyStatusEffectHelpers {
  removeEnemyStatus: (enemy: EnemyState, statusId: string) => EnemyState
  applyEnemyThreatDelta: (
    state: EncounterState,
    enemyId: string,
    tankThreatDelta: number,
    allyThreatDelta?: number,
  ) => EncounterState
}

export interface EnemyStatusEffectHandler {
  onApply?: (
    enemy: EnemyState,
    status: StatusEffect,
    context: EnemyStatusApplyContext,
    helpers: EnemyStatusEffectHelpers,
  ) => EnemyState
  onChannelStop?: (
    enemy: EnemyState,
    status: StatusEffect,
    context: EnemyChannelStopContext,
    helpers: EnemyStatusEffectHelpers,
  ) => EnemyState
  onTick?: (
    state: EncounterState,
    enemy: EnemyState,
    status: StatusEffect,
    context: EnemyStatusTickContext,
  ) => EncounterState
  onEvent?: (
    state: EncounterState,
    status: StatusEffect,
    context: EnemyStatusEventContext,
    event: EncounterEvent,
    helpers: EnemyStatusEffectHelpers,
  ) => EncounterState
}

export interface EnemyStatusTickEffectApplication {
  status: StatusEffect
  previousState: EncounterState
  nextState: EncounterState
}

const helpers: EnemyStatusEffectHelpers = {
  removeEnemyStatus: (enemy, statusId) => ({
    ...enemy,
    statuses: enemy.statuses.filter((status) => status.id !== statusId),
  }),
  applyEnemyThreatDelta: (state, enemyId, tankThreatDelta, allyThreatDelta = 0) => ({
    ...state,
    enemies: state.enemies.map((enemy) =>
      enemy.id === enemyId
        ? {
            ...enemy,
            tankThreat: Math.max(0, enemy.tankThreat + tankThreatDelta),
            allyThreat: Math.max(0, enemy.allyThreat + allyThreatDelta),
          }
        : enemy,
    ),
  }),
}

function getStatusValue(status: StatusEffect, field: 'valueA' | 'valueB', fallback: number) {
  return typeof status[field] === 'number' ? status[field] : fallback
}

function getStatusTickIntervalMs(status: StatusEffect, fallback: number) {
  return Math.max(1, status.tickIntervalMs ?? fallback)
}

function isStatusActive(status: StatusEffect) {
  return status.remainingMs !== 0
}

function getPercentStatusValue(status: StatusEffect, field: 'valueA' | 'valueB', fallback: number) {
  return getStatusValue(status, field, fallback) / 100
}

function mapEnemyStatus(enemy: EnemyState, statusId: string, updater: (status: StatusEffect) => StatusEffect | null) {
  return {
    ...enemy,
    statuses: enemy.statuses.flatMap((status) => {
      if (status.id !== statusId) {
        return [status]
      }

      const nextStatus = updater(status)
      return nextStatus ? [nextStatus] : []
    }),
  }
}

function appendOrReplaceEnemyStatus(enemy: EnemyState, status: StatusEffect) {
  return {
    ...enemy,
    statuses: [
      ...enemy.statuses.filter((entry) => entry.id !== status.id),
      status,
    ],
  }
}

function consumeEnemyStatusStack(enemy: EnemyState, statusId: string) {
  return mapEnemyStatus(enemy, statusId, (status) => {
    const currentStacks = Math.max(1, Math.floor(status.stacks ?? 1))
    return currentStacks > 1
      ? {
          ...status,
          stacks: currentStacks - 1,
          maxStacks: status.maxStacks ?? currentStacks,
        }
      : null
  })
}

function isTrollEnemy(enemy: EnemyState) {
  return enemy.definitionId.includes('troll')
}

export function getEnemyStatusDamageTakenMultiplier(enemy: EnemyState) {
  return enemy.statuses.reduce((multiplier, status) => {
    if (!isStatusActive(status)) {
      return multiplier
    }

    if (status.effectLogicId === 'shellUp_status') {
      return multiplier * (1 - getPercentStatusValue(status, 'valueA', 70))
    }

    if (
      status.effectLogicId === 'spiritShelled_status' &&
      (status.stacks ?? getStatusValue(status, 'valueA', 3)) > 0
    ) {
      return 0
    }

    return multiplier * (1 + (status.damageTakenMultiplierBonus ?? 0))
  }, 1)
}

export function getEnemyStatusOutgoingDamageMultiplier(enemy: EnemyState) {
  return enemy.statuses.reduce((multiplier, status) => {
    if (!isStatusActive(status)) {
      return multiplier
    }

    if (
      status.effectLogicId === 'berserkerPotioned_status' ||
      status.effectLogicId === 'forestBerserkerPotioned_status'
    ) {
      return multiplier * (1 + getPercentStatusValue(status, 'valueA', 50))
    }

    return multiplier * (1 + (status.damageMultiplierBonus ?? 0))
  }, 1)
}

export function resolveEnemyIncomingDamage(enemy: EnemyState, amount: number) {
  const spiritShell = enemy.statuses.find((status) =>
    status.effectLogicId === 'spiritShelled_status' &&
    isStatusActive(status) &&
    (status.stacks ?? getStatusValue(status, 'valueA', 3)) > 0,
  )

  if (!spiritShell) {
    return { enemy, amount }
  }

  const currentStacks = Math.max(1, Math.floor(spiritShell.stacks ?? getStatusValue(spiritShell, 'valueA', 3)))
  const nextEnemy = mapEnemyStatus(enemy, spiritShell.id, (status) => {
    const nextStacks = currentStacks - 1
    return nextStacks > 0
      ? {
          ...status,
          stacks: nextStacks,
          maxStacks: status.maxStacks ?? Math.max(currentStacks, Math.floor(getStatusValue(status, 'valueA', 3))),
        }
      : null
  })

  return { enemy: nextEnemy, amount: 0 }
}

const ENEMY_STATUS_EFFECT_REGISTRY: Record<string, EnemyStatusEffectHandler> = {
  challenge_initial_party_threat_status: {
    onApply: (enemy, status) => ({
      ...enemy,
      allyThreat: Math.max(0, enemy.allyThreat + getStatusValue(status, 'valueA', 55)),
    }),
  },
  challenge_periodic_absorb_status: {
    onTick: (state, enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 4000)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      if (Math.max(0, previousTicks - currentTicks) <= 0) {
        return state
      }

      const shieldAmount = getStatusValue(status, 'valueA', 20)
      const shieldStatus: StatusEffect = {
        id: 'challenge_coldlight_barrier',
        iconId: 'challenge_coldlight_guard',
        label: '寒光护盾',
        shortLabel: '护盾',
        remainingMs: 4000,
        totalMs: 4000,
        tone: 'buff',
        kind: 'enemyBuff',
        effectLogicId: 'none',
        absorbRemaining: shieldAmount,
        valueA: shieldAmount,
        combatLogSource: status.combatLogSource,
        combatLogAbility: status.combatLogAbility,
      }

      return {
        ...state,
        enemies: state.enemies.map((entry) =>
          entry.id === enemy.id
            ? {
                ...entry,
                statuses: [
                  ...entry.statuses.filter((entryStatus) => entryStatus.id !== shieldStatus.id),
                  shieldStatus,
                ],
              }
            : entry,
        ),
        runtime: {
          ...state.runtime,
          combatLog: [
            ...state.runtime.combatLog,
            {
              id: `${state.timeMs}:absorb-created:${enemy.id}:challenge-coldlight-barrier`,
              occurredAtMs: state.timeMs,
              type: 'absorb-created',
              source: { kind: 'enemy', id: enemy.definitionId, name: enemy.name },
              target: { kind: 'enemy', id: enemy.id, name: enemy.name },
              ability: { kind: 'status', id: status.id, name: status.label },
              amount: shieldAmount,
            },
          ],
        },
      }
    },
  },
  challenge_periodic_elite_reinforce_status: {
    onTick: (state, enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (!enemy.isSkull || previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 5000)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      if (Math.max(0, previousTicks - currentTicks) <= 0) {
        return state
      }

      const bonus = getStatusValue(status, 'valueA', 10) / 100
      const reinforcedStatus: StatusEffect = {
        id: 'challenge_elite_reinforced',
        iconId: 'challenge_wax_order',
        label: '蜡影强化',
        shortLabel: '强化',
        remainingMs: 4500,
        totalMs: 4500,
        tone: 'buff',
        kind: 'enemyBuff',
        effectLogicId: 'challenge_magic_damage_boost_status',
        valueA: bonus,
        combatLogSource: status.combatLogSource,
        combatLogAbility: status.combatLogAbility,
      }

      return {
        ...state,
        enemies: state.enemies.map((entry) =>
          entry.id === enemy.id
            ? {
                ...entry,
                statuses: [
                  ...entry.statuses.filter((entryStatus) => entryStatus.id !== reinforcedStatus.id),
                  reinforcedStatus,
                ],
              }
            : entry,
        ),
      }
    },
  },
  challenge_troll_regen_mist_status: {
    onTick: (state, enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (!isTrollEnemy(enemy) || previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 1000)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      const elapsedTicks = Math.max(0, previousTicks - currentTicks)
      if (elapsedTicks <= 0) {
        return state
      }

      const healing = elapsedTicks * getStatusValue(status, 'valueA', 12)
      return {
        ...state,
        enemies: state.enemies.map((entry) =>
          entry.id === enemy.id
            ? {
                ...entry,
                hp: Math.min(entry.maxHp, entry.hp + healing),
              }
            : entry,
        ),
      }
    },
  },
  challenge_shield_formation_status: {
    onEvent: (state, status, context, event) => {
      if (event.type !== 'enemy/damage-applied' || event.enemyId !== context.enemyId) {
        return state
      }

      return {
        ...state,
        enemies: state.enemies.map((enemy) => {
          if (enemy.id !== context.enemyId || !enemy.isSkull) {
            return enemy
          }

          const damageReductionRatio = Math.max(0, Math.min(1, getStatusValue(status, 'valueA', 0.45)))
          const durationMs = Math.max(1, Math.floor(getStatusValue(status, 'valueB', 3500)))
          return appendOrReplaceEnemyStatus({
            ...enemy,
            statuses: enemy.statuses.filter((entry) => entry.id !== status.id),
          }, {
            id: 'challenge_shield_formation_braced',
            iconId: 'challenge_shield_formation_braced',
            label: '盾阵换防',
            shortLabel: '盾阵',
            remainingMs: durationMs,
            totalMs: durationMs,
            tone: 'buff',
            kind: 'enemyBuff',
            effectLogicId: 'none',
            damageTakenMultiplierBonus: -damageReductionRatio,
            combatLogSource: status.combatLogSource,
            combatLogAbility: status.combatLogAbility,
          })
        }),
      }
    },
  },
  enemy_threat_on_player_skill: {
    onEvent: (state, status, context, event, effectHelpers) =>
      event.type === 'player/skill-activated' && state.player.currentTargetId === context.enemyId
        ? effectHelpers.applyEnemyThreatDelta(state, context.enemyId, getStatusValue(status, 'valueA', 8))
        : state,
  },
  enemy_heal_small: {
    onApply: (enemy, status, context) => ({
      ...enemy,
      hp: Math.max(
        0,
        Math.min(
          enemy.maxHp,
          enemy.hp + Math.round(getStatusValue(status, 'valueA', 26) * context.tuning.enemyHealingMultiplier),
        ),
      ),
    }),
  },
  'run!_status': {
    onTick: (state, enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 500)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      const elapsedTicks = Math.max(0, previousTicks - currentTicks)
      if (elapsedTicks <= 0) {
        return state
      }
      const healing = getStatusValue(status, 'valueA', 2)

      return {
        ...state,
        enemies: state.enemies.map((entry) =>
          entry.id === enemy.id
            ? {
                ...entry,
                hp: Math.min(entry.maxHp, entry.hp + elapsedTicks * healing),
              }
            : entry,
        ),
      }
    },
    onChannelStop: (enemy, status, context, effectHelpers) => {
      if (status.channelSourceSkillId && status.channelSourceSkillId !== context.skillId) {
        return enemy
      }

      return effectHelpers.removeEnemyStatus(enemy, status.id)
    },
  },
  murlocHealing_status: {
    onApply: (enemy, status) => ({
      ...enemy,
      hp: Math.min(enemy.maxHp, enemy.hp + getStatusValue(status, 'valueA', 75)),
    }),
  },
  berserkerPotioned_status: {
    onApply: (enemy, status) =>
      mapEnemyStatus(enemy, status.id, (entry) => ({
        ...entry,
        damageMultiplierBonus: getPercentStatusValue(status, 'valueA', 50),
      })),
  },
  forestBerserkerPotioned_status: {
    onApply: (enemy, status) =>
      mapEnemyStatus(enemy, status.id, (entry) => ({
        ...entry,
        damageMultiplierBonus: getPercentStatusValue(status, 'valueA', 50),
      })),
    onTick: (state, enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 1000)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      const elapsedTicks = Math.max(0, previousTicks - currentTicks)
      if (elapsedTicks <= 0) {
        return state
      }

      const healing = elapsedTicks * getStatusValue(status, 'valueB', 5)
      return {
        ...state,
        enemies: state.enemies.map((entry) =>
          entry.id === enemy.id
            ? {
                ...entry,
                hp: Math.min(entry.maxHp, entry.hp + healing),
              }
            : entry,
        ),
      }
    },
  },
  forestPotioned_status: {
    onTick: (state, enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 1000)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      const elapsedTicks = Math.max(0, previousTicks - currentTicks)
      if (elapsedTicks <= 0) {
        return state
      }

      const healing = elapsedTicks * getStatusValue(status, 'valueB', 10)
      return {
        ...state,
        enemies: state.enemies.map((entry) =>
          entry.id === enemy.id
            ? {
                ...entry,
                hp: Math.min(entry.maxHp, entry.hp + healing),
              }
            : entry,
        ),
      }
    },
  },
  'berserker!_status': {
    onTick: (state, _enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 1000)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      const elapsedTicks = Math.max(0, previousTicks - currentTicks)
      if (elapsedTicks <= 0) {
        return state
      }

      const damage = elapsedTicks * getStatusValue(status, 'valueA', 4)
      if (context.castTarget === 'party' || context.castTarget === 'ally') {
        return {
          ...state,
          party: {
            ...state.party,
            hp: Math.max(0, state.party.hp - damage),
          },
        }
      }

      return {
        ...state,
        player: {
          ...state.player,
          hp: Math.max(0, state.player.hp - damage),
        },
      }
    },
    onChannelStop: (enemy, status, context, effectHelpers) => {
      if (status.channelSourceSkillId && status.channelSourceSkillId !== context.skillId) {
        return enemy
      }

      return effectHelpers.removeEnemyStatus(enemy, status.id)
    },
  },
  spiritShelled_status: {
    onApply: (enemy, status) =>
      mapEnemyStatus(enemy, status.id, (entry) => {
        const stacks = Math.max(1, Math.floor(getStatusValue(status, 'valueA', 3)))
        return {
          ...entry,
          stacks,
          maxStacks: stacks,
        }
      }),
  },
  shadowWaved_status: {
    onApply: (enemy, status, context) => ({
      ...enemy,
      hp: Math.min(
        enemy.maxHp,
        enemy.hp + Math.round(getStatusValue(status, 'valueA', 30) * context.tuning.enemyHealingMultiplier),
      ),
    }),
    onEvent: (state, status, context, event) => {
      if (
        event.type !== 'enemy/damage-applied' ||
        event.enemyId !== context.enemyId ||
        event.amount <= 0 ||
        !isStatusActive(status)
      ) {
        return state
      }

      const sourceOwner = event.sourceOwner ?? 'player'
      if (sourceOwner !== 'player' && sourceOwner !== 'party') {
        return state
      }

      const enemy = state.enemies.find((entry) => entry.id === context.enemyId)
      if (!enemy) {
        return state
      }

      const damage = Math.max(0, Math.round(getStatusValue(status, 'valueB', 10)))
      if (damage <= 0) {
        return {
          ...state,
          enemies: state.enemies.map((entry) =>
            entry.id === context.enemyId ? consumeEnemyStatusStack(entry, status.id) : entry,
          ),
        }
      }

      if (sourceOwner === 'party') {
        const previousPartyHp = state.party.hp
        const nextPartyHp = Math.max(0, previousPartyHp - damage)
        const dealtDamage = Math.max(0, previousPartyHp - nextPartyHp)
        return {
          ...state,
          party: {
            ...state.party,
            hp: nextPartyHp,
          },
          enemies: state.enemies.map((entry) =>
            entry.id === context.enemyId ? consumeEnemyStatusStack(entry, status.id) : entry,
          ),
          runtime: {
            ...state.runtime,
            combatLog: dealtDamage > 0
              ? [
                  ...state.runtime.combatLog,
                  {
                    id: `${event.occurredAtMs}:damage:${context.enemyId}:${status.id}:shadow-waved-party`,
                    occurredAtMs: event.occurredAtMs,
                    type: 'damage',
                    source: status.combatLogSource ?? { kind: 'enemy', id: enemy.id, name: enemy.name },
                    target: { kind: 'party', id: 'party', name: '队伍' },
                    ability: status.combatLogAbility ?? { kind: 'status', id: status.id, name: status.label },
                    amount: dealtDamage,
                    damageType: 'physical',
                  },
                ]
              : state.runtime.combatLog,
          },
        }
      }

      const previousPlayerHp = state.player.hp
      const nextPlayerHp = Math.max(0, previousPlayerHp - damage)
      const dealtDamage = Math.max(0, previousPlayerHp - nextPlayerHp)
      return {
        ...state,
        player: {
          ...state.player,
          hp: nextPlayerHp,
        },
        enemies: state.enemies.map((entry) =>
          entry.id === context.enemyId ? consumeEnemyStatusStack(entry, status.id) : entry,
        ),
        runtime: {
          ...state.runtime,
          combatLog: dealtDamage > 0
            ? [
                ...state.runtime.combatLog,
                {
                  id: `${event.occurredAtMs}:damage:${context.enemyId}:${status.id}:shadow-waved-player`,
                  occurredAtMs: event.occurredAtMs,
                  type: 'damage',
                  source: status.combatLogSource ?? { kind: 'enemy', id: enemy.id, name: enemy.name },
                  target: { kind: 'tank', id: 'tank', name: '坦克' },
                  ability: status.combatLogAbility ?? { kind: 'status', id: status.id, name: status.label },
                  amount: dealtDamage,
                  damageType: 'physical',
                },
              ]
            : state.runtime.combatLog,
        },
      }
    },
  },
  shellUp_status: {
    onApply: (enemy, status) =>
      mapEnemyStatus(enemy, status.id, (entry) => ({
        ...entry,
        damageTakenMultiplierBonus: -getPercentStatusValue(status, 'valueA', 70),
      })),
  },
  channel_self_until_end: {
    onChannelStop: (enemy, status, context, effectHelpers) => {
      if (status.channelSourceSkillId && status.channelSourceSkillId !== context.skillId) {
        return enemy
      }

      return effectHelpers.removeEnemyStatus(enemy, status.id)
    },
  },
  'got!_status': {
    onChannelStop: (enemy, status, context, effectHelpers) => {
      if (status.channelSourceSkillId && status.channelSourceSkillId !== context.skillId) {
        return enemy
      }

      return effectHelpers.removeEnemyStatus(enemy, status.id)
    },
  },
  'wind_strike!_status': {
    onTick: (state, _enemy, status, context) => {
      const previousRemainingMs = status.remainingMs
      if (previousRemainingMs <= 0 || context.deltaMs <= 0) {
        return state
      }

      const tickIntervalMs = getStatusTickIntervalMs(status, 500)
      const previousTicks = Math.floor(previousRemainingMs / tickIntervalMs)
      const currentTicks = Math.floor(Math.max(0, context.remainingMsAfterTick) / tickIntervalMs)
      const elapsedTicks = Math.max(0, previousTicks - currentTicks)
      if (elapsedTicks <= 0) {
        return state
      }

      const damage = elapsedTicks * getStatusValue(status, 'valueA', 5)
      if (context.castTarget === 'party' || context.castTarget === 'ally') {
        return {
          ...state,
          party: {
            ...state.party,
            hp: Math.max(0, state.party.hp - damage),
          },
        }
      }

      return {
        ...state,
        player: {
          ...state.player,
          hp: Math.max(0, state.player.hp - damage),
        },
      }
    },
    onChannelStop: (enemy, status, context, effectHelpers) => {
      if (status.channelSourceSkillId && status.channelSourceSkillId !== context.skillId) {
        return enemy
      }

      return effectHelpers.removeEnemyStatus(enemy, status.id)
    },
  },
}

export function applyEnemyStatusEventEffects(
  state: EncounterState,
  event: EncounterEvent,
) {
  const triggers = state.enemies.flatMap((enemy) =>
    enemy.statuses.flatMap((status): EncounterEventTrigger<StatusEffect>[] => {
      const effectLogicId = status.effectLogicId
      if (!effectLogicId) {
        return []
      }

      const handler = ENEMY_STATUS_EFFECT_REGISTRY[effectLogicId]
      if (!handler?.onEvent) {
        return []
      }

      return [{
        id: `enemy-status:${enemy.id}:${status.id}`,
        getRuntime: () => status,
        setRuntime: (currentState) => currentState,
        apply: (currentState, currentEvent, currentStatus) => ({
          state: handler.onEvent!(
            currentState,
            currentStatus,
            { enemyId: enemy.id },
            currentEvent,
            helpers,
          ),
          runtime: currentStatus,
        }),
      }]
    }),
  )

  return applyEncounterEventTriggers(state, [event], triggers)
}

export function applyEnemyStatusOnApply(
  effectLogicId: string,
  enemy: EnemyState,
  status: StatusEffect,
  context: EnemyStatusApplyContext,
) {
  const handler = ENEMY_STATUS_EFFECT_REGISTRY[effectLogicId]
  return handler?.onApply ? handler.onApply(enemy, status, context, helpers) : enemy
}

export function applyEnemyStatusChannelStopEffects(
  enemy: EnemyState,
  context: EnemyChannelStopContext,
) {
  let nextEnemy = enemy
  const statuses = [...enemy.statuses]

  for (const status of statuses) {
    const effectLogicId = status.effectLogicId
    if (!effectLogicId) {
      continue
    }

    const handler = ENEMY_STATUS_EFFECT_REGISTRY[effectLogicId]
    if (handler?.onChannelStop) {
      nextEnemy = handler.onChannelStop(nextEnemy, status, context, helpers)
    }
  }

  return nextEnemy
}

export function applyEnemyStatusTickEffects(
  state: EncounterState,
  enemy: EnemyState,
  statusBeforeTickById: ReadonlyMap<string, StatusEffect>,
  deltaMs: number,
) {
  return applyEnemyStatusTickEffectsWithApplications(state, enemy, statusBeforeTickById, deltaMs).state
}

export function applyEnemyStatusTickEffectsWithApplications(
  state: EncounterState,
  enemy: EnemyState,
  statusBeforeTickById: ReadonlyMap<string, StatusEffect>,
  deltaMs: number,
) {
  let nextState = state
  const applications: EnemyStatusTickEffectApplication[] = []
  const statusAfterTickById = new Map(enemy.statuses.map((status) => [status.id, status]))

  for (const previousStatus of statusBeforeTickById.values()) {
    const effectLogicId = previousStatus.effectLogicId
    if (!effectLogicId) {
      continue
    }

    const handler = ENEMY_STATUS_EFFECT_REGISTRY[effectLogicId]
    if (handler?.onTick) {
      const previousState = nextState
      nextState = handler.onTick(nextState, enemy, previousStatus, {
        deltaMs,
        castTarget: enemy.cast?.target ?? null,
        remainingMsAfterTick: statusAfterTickById.get(previousStatus.id)?.remainingMs ?? 0,
      })
      applications.push({
        status: previousStatus,
        previousState,
        nextState,
      })
    }
  }

  return {
    state: nextState,
    applications,
  }
}
