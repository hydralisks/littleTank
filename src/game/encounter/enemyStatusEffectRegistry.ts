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

const ENEMY_STATUS_EFFECT_REGISTRY: Record<string, EnemyStatusEffectHandler> = {
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
