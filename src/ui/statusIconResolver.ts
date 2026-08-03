import type { StatusEffect } from '../game/encounter/encounterTypes'
import { getEnemyIconAssetKey } from '../game/data/enemyCatalog'
import { getBuildIconDefinition } from '../game/data/playerBuildCatalog'
import { statusIconMap } from './iconMaps'

export function sanitizeIconAssetKey(assetKey: string) {
  return assetKey.replace(/[^A-Za-z0-9_-]/g, '-')
}

export function resolveIconAssetUrl(iconId: string) {
  const definition = getBuildIconDefinition(iconId)
  if (definition) {
    const folder = definition.iconType === 'skill' ? 'skill-icons' : 'status-icons'
    return `/${folder}/${sanitizeIconAssetKey(definition.assetKey)}.svg`
  }

  const enemyAssetKey = getEnemyIconAssetKey(iconId)
  if (enemyAssetKey) {
    return `/status-icons/${sanitizeIconAssetKey(enemyAssetKey)}.svg`
  }

  return null
}

export function resolveStatusAssetUrl(iconId: string) {
  const enemyAssetKey = getEnemyIconAssetKey(iconId)
  return enemyAssetKey
    ? `/status-icons/${sanitizeIconAssetKey(enemyAssetKey)}.svg`
    : resolveIconAssetUrl(iconId)
}

export function resolveStatusIconUrl(status: Pick<StatusEffect, 'id' | 'iconId'>) {
  const iconId = status.iconId ?? status.id
  const resolvedUrl = resolveStatusAssetUrl(iconId)

  if (resolvedUrl) {
    return resolvedUrl
  }

  return statusIconMap[iconId] ?? statusIconMap[status.id] ?? statusIconMap.stable
}
