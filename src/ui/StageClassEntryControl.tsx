import { Check, Droplets, PawPrint, Shield, Sword, type LucideIcon } from 'lucide-react'
import type { PlayerClassId } from '../game/encounter/encounterTypes'
import type { PlayerClassRuntimeDefinition } from '../game/playerClasses/playerClassRuntimeRegistry'

export interface StageClassEntryOption {
  classId: PlayerClassId
  className: string
  buttonIconKey: PlayerClassRuntimeDefinition['buttonIconKey']
  cleared: boolean
}

interface StageClassEntryControlProps {
  classes: readonly StageClassEntryOption[]
  selectedClassId: PlayerClassId
  disabled: boolean
  onSelectClass: (classId: PlayerClassId) => void
  onEnter: () => void
}

const ICONS: Record<PlayerClassRuntimeDefinition['buttonIconKey'], LucideIcon> = {
  sword: Sword,
  'paw-print': PawPrint,
  droplets: Droplets,
  shield: Shield,
}

const SLOT_COUNT = 12

export function StageClassEntryControl({
  classes,
  selectedClassId,
  disabled,
  onSelectClass,
  onEnter,
}: StageClassEntryControlProps) {
  const selected = classes.find((entry) => entry.classId === selectedClassId) ?? classes[0]

  return (
    <div className="stage-class-entry">
      <button
        type="button"
        className="stage-class-entry__enter stage-map__enter-action"
        disabled={disabled || !selected}
        onClick={onEnter}
      >
        {disabled ? '尚未解锁' : `${selected?.className ?? ''} 进入这一关`}
      </button>
      <div className="stage-class-entry__grid" aria-label="选择本关职业">
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const option = classes[index]
          if (!option) {
            return <span key={`empty-${index}`} className="stage-class-entry__slot is-empty" aria-hidden="true" />
          }
          const Icon = ICONS[option.buttonIconKey]
          return (
            <button
              key={option.classId}
              type="button"
              className={[
                'stage-class-entry__slot',
                option.classId === selectedClassId ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              data-class-id={option.classId}
              title={option.className}
              aria-label={`选择${option.className}`}
              aria-pressed={option.classId === selectedClassId}
              onClick={() => onSelectClass(option.classId)}
            >
              <Icon aria-hidden="true" />
              {option.cleared
                ? <Check className="stage-class-entry__check" aria-label="已使用该职业通关" />
                : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
