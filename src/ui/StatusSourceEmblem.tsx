import type { CSSProperties } from 'react'
import type { PlayerClassId, StatusSourceKind } from '../game/encounter/encounterTypes'
import { ClassEmblemIcon } from './ClassEmblemIcon'
import { tryGetClassEmblemDefinition } from './classEmblemRegistry'
import { getSourceShape } from './statusIconPresentation'

interface StatusSourceEmblemProps {
  sourceKind?: StatusSourceKind
  sourceClassId?: PlayerClassId
}

export function StatusSourceEmblem({ sourceKind, sourceClassId }: StatusSourceEmblemProps) {
  const shape = getSourceShape(sourceKind)
  if (!shape) {
    return null
  }

  const definition = tryGetClassEmblemDefinition(sourceClassId)
  return (
    <span
      className={`status-source-emblem status-source-emblem--${shape}`}
      data-status-source={sourceKind}
      data-source-shape={shape}
      style={{ '--source-emblem-color': definition?.color ?? '#aeb7c4' } as CSSProperties}
      aria-hidden="true"
    >
      <ClassEmblemIcon classId={sourceClassId} className="status-source-emblem__motif" />
    </span>
  )
}
