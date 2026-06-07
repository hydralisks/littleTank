import type { CSSProperties } from 'react'
import type { StatusEffect } from '../game/encounter/encounterTypes'
import { resolveStatusIconUrl } from './statusIconResolver'

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

  return (
    <span
      className={[
        'status-square',
        `status-square--${size}`,
        status.kind === 'enemyBuff'
          ? 'is-enemy-buff'
          : status.kind === 'playerDebuff'
            ? 'is-player-debuff'
            : status.kind === 'partyDebuff'
              ? 'is-party-debuff'
            : 'is-neutral',
      ].join(' ')}
      style={
        {
          '--status-rotation': getProgressAngle(status),
          '--status-overlay-angle': getProgressAngle(status),
        } as CSSProperties
      }
      title={status.label}
    >
      <img
        className="status-square__icon"
        src={resolveStatusIconUrl(status)}
        alt=""
        aria-hidden="true"
      />
      {hasCountdown ? (
        <span className="status-square__overlay" aria-hidden="true" />
      ) : null}
    </span>
  )
}
