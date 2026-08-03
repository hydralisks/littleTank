import type { StatusEffect } from '../game/encounter/encounterTypes'
import { resolveStatusIconUrl } from './statusIconResolver'

interface StatusIconArtworkProps {
  status: StatusEffect
  hasCountdown: boolean
}

export function StatusIconArtwork({ status, hasCountdown }: StatusIconArtworkProps) {
  return (
    <>
      <img
        className="status-square__icon"
        src={resolveStatusIconUrl(status)}
        alt=""
        aria-hidden="true"
      />
      {hasCountdown ? <span className="status-square__overlay" aria-hidden="true" /> : null}
    </>
  )
}
