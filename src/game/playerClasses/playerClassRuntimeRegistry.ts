import type { PlayerClassId, PlayerClassRuntimeState } from '../encounter/encounterTypes'

export const WARRIOR_T_CLASS_ID: PlayerClassId = 'warrior_t'
export const DRUID_BEAR_T_CLASS_ID: PlayerClassId = 'druid_bear_t'

export interface PlayerPrimaryResourceDefinition {
  id: string
  label: string
  maxResource: number
  passiveGainPerSecond: number
  damageTakenGainDivisor: number
  minimumDamageTakenGain: number
}

export interface PlayerClassRuntimeDefinition {
  classId: PlayerClassId
  selectionOrder: number
  buttonIconKey: 'sword' | 'paw-print' | 'droplets' | 'shield'
  aiStrategyId: string
  primaryResource: PlayerPrimaryResourceDefinition
  initializeRuntime: () => PlayerClassRuntimeState
}

const PLAYER_CLASS_RUNTIME_DEFINITIONS: Record<PlayerClassId, PlayerClassRuntimeDefinition> = {
  warrior_t: {
    classId: WARRIOR_T_CLASS_ID,
    selectionOrder: 0,
    buttonIconKey: 'sword',
    aiStrategyId: 'warrior_t_default',
    primaryResource: {
      id: 'rage',
      label: '怒气',
      maxResource: 100,
      passiveGainPerSecond: 3,
      damageTakenGainDivisor: 5,
      minimumDamageTakenGain: 4,
    },
    initializeRuntime: () => ({}),
  },
  druid_bear_t: {
    classId: DRUID_BEAR_T_CLASS_ID,
    selectionOrder: 1,
    buttonIconKey: 'paw-print',
    aiStrategyId: 'druid_bear_t_default',
    primaryResource: {
      id: 'rage',
      label: '怒气',
      maxResource: 100,
      passiveGainPerSecond: 0,
      damageTakenGainDivisor: 0,
      minimumDamageTakenGain: 0,
    },
    initializeRuntime: () => ({}),
  },
}

export function hasPlayerClassRuntimeDefinition(classId: PlayerClassId) {
  return Boolean(PLAYER_CLASS_RUNTIME_DEFINITIONS[classId])
}

export function getPlayerClassRuntimeDefinition(classId: PlayerClassId) {
  const definition = PLAYER_CLASS_RUNTIME_DEFINITIONS[classId]
  if (!definition) {
    throw new Error(`Player class runtime is not registered: ${classId}`)
  }
  return definition
}

export function getPlayerClassRuntimeDefinitions() {
  return Object.values(PLAYER_CLASS_RUNTIME_DEFINITIONS)
    .sort((left, right) => left.selectionOrder - right.selectionOrder || left.classId.localeCompare(right.classId))
}
