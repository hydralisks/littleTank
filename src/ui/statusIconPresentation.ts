import type {
  StatusEffect,
  StatusSourceKind,
} from '../game/encounter/encounterTypes'

export type StatusSemantic =
  | 'beneficial'
  | 'harmful'
  | 'party-beneficial'
  | 'party-harmful'
  | 'neutral'

export type StatusSourceShape = 'banner' | 'oval-shield'

export function getStatusSemantic(status: Pick<StatusEffect, 'kind' | 'tone'>): StatusSemantic {
  if (status.kind === 'playerBuff') {
    return 'beneficial'
  }
  if (status.kind === 'enemyBuff' || status.kind === 'playerDebuff') {
    return 'harmful'
  }
  if (status.kind === 'partyDebuff') {
    return 'party-harmful'
  }
  if (status.tone === 'buff') {
    return 'party-beneficial'
  }
  if (status.tone === 'danger') {
    return 'harmful'
  }
  return 'neutral'
}

export function getSourceShape(sourceKind?: StatusSourceKind): StatusSourceShape | null {
  if (sourceKind === 'activeSkill') {
    return 'banner'
  }
  if (sourceKind === 'passiveTalent') {
    return 'oval-shield'
  }
  return null
}

export function clampVisibleStacks(status: Pick<StatusEffect, 'stacks' | 'maxStacks'>) {
  if (!status.maxStacks || status.maxStacks <= 1 || !status.stacks || status.stacks <= 1) {
    return null
  }
  return Math.min(status.stacks, status.maxStacks)
}
