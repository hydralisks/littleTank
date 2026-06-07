import { getEnemySkillDefinition } from '../data/enemyCatalog'
import { getActiveSkillDefinition } from '../data/skillTemplates'
import { createCombatLogEventId, recordCombatLogEvent } from './combatLog'
import type { CombatLogEvent, EncounterEvent, EncounterState, EnemyState, StatusEffect } from './encounterTypes'
import {
  applyEnemyStatusChannelStopEffects,
  applyEnemyStatusEventEffects,
  type EnemyChannelStopReason,
} from './enemyStatusEffectRegistry'
import { changePlayerResource } from './playerResourceSystem'

export interface EncounterEventHelpers {
  finalizeEncounterState: (state: EncounterState) => EncounterState
  applyThreatGain: (enemy: EnemyState, tankThreatGain: number, allyThreatGain?: number) => EnemyState
  appendOrReplaceEnemyStatus: (enemy: EnemyState, status: StatusEffect) => EnemyState
  advanceEnemySkillCycle: (enemy: EnemyState) => EnemyState
}

function updateEnemy(
  state: EncounterState,
  enemyId: string,
  updater: (enemy: EnemyState) => EnemyState,
) {
  return {
    ...state,
    enemies: state.enemies.map((enemy) => (enemy.id === enemyId ? updater(enemy) : enemy)),
  }
}

function stopEnemyChannel(
  enemy: EnemyState,
  skillId: string,
  reason: EnemyChannelStopReason,
) {
  return applyEnemyStatusChannelStopEffects(enemy, { skillId, reason })
}

function recordCombatLogForEncounterEvent(state: EncounterState, event: EncounterEvent) {
  if (event.type === 'enemy/damage-applied') {
    const enemy = state.enemies.find((entry) => entry.id === event.enemyId)
    const skill = getActiveSkillDefinition(event.sourceSkillId)
    return recordCombatLogEvent(state, {
      id: createCombatLogEventId(state, 'damage', `${event.sourceSkillId}:${event.enemyId}`),
      occurredAtMs: event.occurredAtMs,
      type: 'damage',
      source: { kind: 'player', id: 'player', name: '玩家' },
      target: { kind: 'enemy', id: event.enemyId, name: enemy?.name },
      ability: { kind: 'playerSkill', id: event.sourceSkillId, name: skill?.name },
      amount: event.amount,
    })
  }

  if (event.type === 'enemy/cast-interrupted' || event.type === 'enemy/cast-controlled') {
    const enemy = state.enemies.find((entry) => entry.id === event.enemyId)
    const cast = enemy?.cast
    const enemySkill = getEnemySkillDefinition(event.skillId)
    const sourceSkill = getActiveSkillDefinition(event.sourceSkillId)
    const type = event.type === 'enemy/cast-interrupted' ? 'cast-interrupted' : 'cast-controlled'
    const combatEvent: CombatLogEvent = {
      id: createCombatLogEventId(state, type, `${event.enemyId}:${event.skillId}:${event.sourceSkillId}`),
      occurredAtMs: event.occurredAtMs,
      type,
      source: { kind: 'enemy', id: event.enemyId, name: enemy?.name },
      target: { kind: cast?.target === 'ally' ? 'ally' : cast?.target === 'party' ? 'party' : 'tank' },
      ability: { kind: 'enemySkill', id: event.skillId, name: enemySkill?.skillName ?? cast?.name },
      castId: cast ? `${event.enemyId}:${cast.id}:${event.occurredAtMs - (cast.totalMs - cast.remainingMs)}` : undefined,
      enemyId: event.enemyId,
      enemySkillId: event.skillId,
      dangerLevel: cast?.dangerLevel ?? enemySkill?.dangerLevel ?? 'medium',
      breakRule: cast?.breakRule ?? enemySkill?.castBreakRule ?? 'interruptOrControl',
      handlerSkillId: event.sourceSkillId,
      handlerName: sourceSkill?.name,
    }
    return recordCombatLogEvent(state, combatEvent)
  }

  return state
}

function applyEncounterEvent(
  state: EncounterState,
  event: EncounterEvent,
  helpers: EncounterEventHelpers,
) {
  if (event.type === 'enemy/threat-applied') {
    return updateEnemy(state, event.enemyId, (enemy) =>
      helpers.applyThreatGain(enemy, event.tankThreatDelta, event.allyThreatDelta),
    )
  }

  if (event.type === 'enemy/status-applied') {
    return updateEnemy(state, event.enemyId, (enemy) =>
      helpers.appendOrReplaceEnemyStatus(enemy, event.status),
    )
  }

  if (event.type === 'enemy/damage-applied') {
    return updateEnemy(state, event.enemyId, (enemy) => ({
      ...enemy,
      hp: Math.max(0, enemy.hp - event.amount),
    }))
  }

  if (event.type === 'enemy/cast-interrupted') {
    return updateEnemy(state, event.enemyId, (enemy) => {
      const nextEnemy = stopEnemyChannel({
        ...enemy,
        cast: null,
        recoveryRemainingMs: event.recoveryRemainingMs,
        pendingRetryCastSkillId: null,
      }, event.skillId, 'interrupted')

      return event.advanceSkillCycle ? helpers.advanceEnemySkillCycle(nextEnemy) : nextEnemy
    })
  }

  if (event.type === 'enemy/cast-controlled') {
    return updateEnemy(state, event.enemyId, (enemy) => {
      const nextEnemy = stopEnemyChannel({
        ...enemy,
        cast: null,
        recoveryRemainingMs: 0,
        pendingRetryCastSkillId: event.pendingRetryCastSkillId,
      }, event.skillId, 'controlled')

      return event.advanceSkillCycle ? helpers.advanceEnemySkillCycle(nextEnemy) : nextEnemy
    })
  }

  if (event.type === 'enemy/died') {
    return updateEnemy(state, event.enemyId, (enemy) => ({
      ...enemy,
      hp: 0,
      cast: null,
      recoveryRemainingMs: 0,
      pendingRetryCastSkillId: null,
    }))
  }

  if (event.type === 'player/current-target-cleared') {
    if (state.player.currentTargetId !== event.previousTargetEnemyId) {
      return state
    }

    return {
      ...state,
      player: {
        ...state.player,
        currentTargetId: null,
      },
    }
  }

  if (event.type === 'player/resource-changed') {
    return {
      ...state,
      player: changePlayerResource(state.player, event.amount),
    }
  }

  return state
}

export function drainEncounterEvents(
  state: EncounterState,
  helpers: EncounterEventHelpers,
): EncounterState {
  if (state.runtime.eventQueue.length === 0) {
    return state
  }

  let nextState = state
  const processedEvents: EncounterEvent[] = []

  while (nextState.runtime.eventQueue.length > 0) {
    const [event, ...remainingEvents] = nextState.runtime.eventQueue
    nextState = {
      ...nextState,
      runtime: {
        ...nextState.runtime,
        eventQueue: remainingEvents,
      },
    }
    nextState = recordCombatLogForEncounterEvent(nextState, event)
    nextState = applyEncounterEvent(nextState, event, helpers)
    nextState = applyEnemyStatusEventEffects(nextState, event)
    processedEvents.push(event)
  }

  const finalizedState = helpers.finalizeEncounterState(nextState)
  return {
    ...finalizedState,
    runtime: {
      ...finalizedState.runtime,
      lastProcessedEvents: processedEvents,
    },
  }
}
