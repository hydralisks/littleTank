import {
  CircleDashed,
  Eye,
  Mountain,
  PawPrint,
  Skull,
  Sword,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { PlayerClassId } from '../game/encounter/encounterTypes'

export type ClassEmblemMotif =
  | 'sword'
  | 'bear-claw'
  | 'skull'
  | 'wrench'
  | 'eye'
  | 'mountain'

export interface ClassEmblemDefinition {
  classId: PlayerClassId
  motif: ClassEmblemMotif
  color: string
  label: string
  icon: LucideIcon
  recognitionTestedAt18px: boolean
}

const CLASS_EMBLEM_DEFINITIONS: Record<string, ClassEmblemDefinition> = {
  warrior_t: {
    classId: 'warrior_t',
    motif: 'sword',
    color: '#f2a23a',
    label: '战士 T：剑纹章',
    icon: Sword,
    recognitionTestedAt18px: true,
  },
  druid_bear_t: {
    classId: 'druid_bear_t',
    motif: 'bear-claw',
    color: '#52d68b',
    label: '熊 T：熊抓纹章',
    icon: PawPrint,
    recognitionTestedAt18px: true,
  },
  death_knight_t: {
    classId: 'death_knight_t',
    motif: 'skull',
    color: '#e14d75',
    label: '死亡骑士 T：骷髅头纹章',
    icon: Skull,
    recognitionTestedAt18px: false,
  },
  tinker_t: {
    classId: 'tinker_t',
    motif: 'wrench',
    color: '#3ad7e8',
    label: '修补匠 T：扳手纹章',
    icon: Wrench,
    recognitionTestedAt18px: false,
  },
  black_dragon_evoker_t: {
    classId: 'black_dragon_evoker_t',
    motif: 'eye',
    color: '#ff7043',
    label: '黑龙唤魔师 T：眼睛纹章',
    icon: Eye,
    recognitionTestedAt18px: false,
  },
  earth_elemental_t: {
    classId: 'earth_elemental_t',
    motif: 'mountain',
    color: '#e2bd55',
    label: '土元素 T：山峰纹章',
    icon: Mountain,
    recognitionTestedAt18px: false,
  },
}

export function tryGetClassEmblemDefinition(classId?: PlayerClassId) {
  return classId ? CLASS_EMBLEM_DEFINITIONS[classId] ?? null : null
}

export function getClassEmblemDefinition(classId: PlayerClassId) {
  const definition = tryGetClassEmblemDefinition(classId)
  if (!definition) {
    throw new Error(`Class emblem is not registered: ${classId}`)
  }
  return definition
}

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
