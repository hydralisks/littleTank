import type { StatusEffect } from '../game/encounter/encounterTypes'
import { clampVisibleStacks } from './statusIconPresentation'

interface StatusStackBadgeProps {
  status: Pick<StatusEffect, 'stacks' | 'maxStacks'>
}

export function StatusStackBadge({ status }: StatusStackBadgeProps) {
  const stacks = clampVisibleStacks(status)
  if (stacks === null) {
    return null
  }

  return (
    <span className="status-stack-badge" data-status-stacks aria-label={`${stacks} 层`}>
      <span>{stacks}</span>
    </span>
  )
}
