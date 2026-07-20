import { getEnemyStatusDefinition } from '../data/enemyCatalog'
import {
  createStatusEffectFromDefinition as createPlayerBuildStatusEffectFromDefinition,
  getPlayerBuildStatusDefinition,
} from '../data/skillTemplates'
import type { StatusEffect } from './encounterTypes'

export function createEnemyStatusEffect(statusId: string, durationMs?: number): StatusEffect | null {
  const definition = getEnemyStatusDefinition(statusId)

  if (!definition) {
    return null
  }

  const resolvedDurationMs = durationMs ?? definition.durationMs
  return {
    id: definition.statusId,
    iconId: definition.iconId,
    label: definition.statusName,
    shortLabel: definition.statusName.slice(0, 1),
    remainingMs: resolvedDurationMs,
    totalMs: resolvedDurationMs,
    tone: 'danger',
    kind: definition.kind,
    effectLogicId: definition.effectLogicId,
    ...(typeof definition.valueA === 'number' ? { valueA: definition.valueA } : {}),
    ...(typeof definition.valueB === 'number' ? { valueB: definition.valueB } : {}),
    ...(typeof definition.tickIntervalMs === 'number' ? { tickIntervalMs: definition.tickIntervalMs } : {}),
    ...(definition.effectLogicId === 'soulSensitive_status' || definition.effectLogicId === 'soulSensitive_p_status'
      ? { maxStacks: 5 }
      : {}),
    ...(definition.effectLogicId === 'shadowWaved_status'
      ? { maxStacks: 99 }
      : {}),
  }
}

export function createPlayerBuildStatusEffect(
  statusId: string,
  durationMs?: number,
): StatusEffect | null {
  const definition = getPlayerBuildStatusDefinition(statusId)

  if (!definition) {
    return null
  }

  return createPlayerBuildStatusEffectFromDefinition({
    ...definition,
    ...(typeof durationMs === 'number' ? { durationMs } : {}),
  })
}
