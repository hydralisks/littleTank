import { getPlayerClassRuntimeDefinition } from '../playerClasses/playerClassRuntimeRegistry'
import type { PassiveTalentModifiers, PlayerClassId, PlayerState } from './encounterTypes'

export function getPlayerResourceDefinition(classId: PlayerClassId) {
  return getPlayerClassRuntimeDefinition(classId).primaryResource
}

export function getPassiveResourceGain(
  deltaMs: number,
  modifiers: Pick<PassiveTalentModifiers, 'playerResourceRegenMultiplier'>,
  classId: PlayerClassId,
) {
  const definition = getPlayerResourceDefinition(classId)
  return definition.passiveGainPerSecond * modifiers.playerResourceRegenMultiplier * (deltaMs / 1000)
}

export function getDamageTakenResourceGain(playerDamage: number, classId: PlayerClassId) {
  if (playerDamage <= 0) {
    return 0
  }

  const definition = getPlayerResourceDefinition(classId)
  return Math.min(
    definition.minimumDamageTakenGain,
    Math.round(playerDamage / definition.damageTakenGainDivisor),
  )
}

export function changePlayerResource(player: PlayerState, delta: number): PlayerState {
  return {
    ...player,
    resource: Math.max(0, Math.min(player.maxResource, player.resource + delta)),
  }
}
