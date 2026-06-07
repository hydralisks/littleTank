import type { StatusEffect } from '../game/encounter/encounterTypes'
import { getEnemyIconAssetKey } from '../game/data/enemyCatalog'
import { getIconAssetKey } from '../game/data/playerBuildCatalog'
import { statusIconMap } from './iconMaps'

export function sanitizeIconAssetKey(assetKey: string) {
  return assetKey.replace(/[^A-Za-z0-9_-]/g, '-')
}

export function resolveIconAssetUrl(iconId: string, preferredType: 'skill' | 'status' = 'status') {
  const assetKey = getEnemyIconAssetKey(iconId) ?? getIconAssetKey(iconId)

  if (assetKey) {
    const folder = preferredType === 'skill' ? 'skill-icons' : 'status-icons'
    return `/${folder}/${sanitizeIconAssetKey(assetKey)}.svg`
  }

  return null
}

export function resolveStatusIconUrl(status: Pick<StatusEffect, 'id' | 'iconId'>) {
  const iconId = status.iconId ?? status.id
  const resolvedUrl = resolveIconAssetUrl(iconId, 'status')

  if (resolvedUrl) {
    return resolvedUrl
  }

  return statusIconMap[iconId] ?? statusIconMap[status.id] ?? statusIconMap.stable
}
