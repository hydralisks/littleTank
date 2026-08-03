import type { CSSProperties } from 'react'
import type { StatusEffect } from '../game/encounter/encounterTypes'
import { StatusIconArtwork } from './StatusIconArtwork'
import { StatusSemanticFrame } from './StatusSemanticFrame'
import { StatusSourceEmblem } from './StatusSourceEmblem'
import { StatusStackBadge } from './StatusStackBadge'
import { getStatusSemantic } from './statusIconPresentation'

interface StatusBadgeProps {
  status: StatusEffect
  size?: 'small' | 'large'
}

function getElapsedRatio(status: StatusEffect) {
  const totalMs = Math.max(0, status.totalMs ?? status.remainingMs)

  if (!totalMs || totalMs <= 0) {
    return 0
  }

  return 1 - Math.max(0, Math.min(1, status.remainingMs / totalMs))
}

function getProgressAngle(status: StatusEffect) {
  return `${getElapsedRatio(status) * 360}deg`
}

export function StatusBadge({
  status,
  size = 'small',
}: StatusBadgeProps) {
  const hasCountdown = (status.totalMs ?? status.remainingMs) > 0 && status.remainingMs > 0
  const semantic = getStatusSemantic(status)

  return (
    <span
      className={[
        'status-square',
        `status-square--${size}`,
        `status-square--${semantic}`,
      ].join(' ')}
      style={
        {
          '--status-rotation': getProgressAngle(status),
          '--status-overlay-angle': getProgressAngle(status),
        } as CSSProperties
      }
      title={status.label}
    >
      <StatusIconArtwork status={status} hasCountdown={hasCountdown} />
      <StatusSemanticFrame semantic={semantic} />
      <StatusSourceEmblem sourceKind={status.sourceKind} sourceClassId={status.sourceClassId} />
      <StatusStackBadge status={status} />
    </span>
  )
}
