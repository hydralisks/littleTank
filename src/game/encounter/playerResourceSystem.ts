import type { PassiveTalentModifiers, PlayerState } from './encounterTypes'

export interface PlayerResourceDefinition {
  id: string
  label: string
  maxResource: number
  passiveGainPerSecond: number
  damageTakenGainDivisor: number
  minimumDamageTakenGain: number
}

const PLAYER_RESOURCE_DEFINITIONS: Record<string, PlayerResourceDefinition> = {
  warrior_t: {
    id: 'rage',
    label: '怒气',
    maxResource: 100,
    passiveGainPerSecond: 3,
    damageTakenGainDivisor: 5,
    minimumDamageTakenGain: 4,
  },
}

export function getPlayerResourceDefinition(classId = 'warrior_t') {
  return PLAYER_RESOURCE_DEFINITIONS[classId] ?? PLAYER_RESOURCE_DEFINITIONS.warrior_t
}

export function getPassiveResourceGain(
  deltaMs: number,
  modifiers: Pick<PassiveTalentModifiers, 'playerResourceRegenMultiplier'>,
  classId = 'warrior_t',
) {
  const definition = getPlayerResourceDefinition(classId)
  return definition.passiveGainPerSecond * modifiers.playerResourceRegenMultiplier * (deltaMs / 1000)
}

export function getDamageTakenResourceGain(playerDamage: number, classId = 'warrior_t') {
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
