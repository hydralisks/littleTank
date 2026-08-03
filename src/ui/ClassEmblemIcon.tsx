import { CircleDashed } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { PlayerClassId } from '../game/encounter/encounterTypes'
import { tryGetClassEmblemDefinition } from './classEmblemRegistry'

interface ClassEmblemIconProps {
  classId?: PlayerClassId
  className?: string
}

export function ClassEmblemIcon({ classId, className }: ClassEmblemIconProps) {
  const definition = tryGetClassEmblemDefinition(classId)
  const Icon = definition?.icon ?? CircleDashed
  const motif = definition?.motif ?? 'neutral'
  const label = definition?.label ?? '未知职业纹章'

  return (
    <Icon
      className={className}
      data-class-motif={motif}
      aria-label={label}
      role="img"
      style={{ '--class-emblem-color': definition?.color ?? '#aeb7c4' } as CSSProperties}
    />
  )
}
