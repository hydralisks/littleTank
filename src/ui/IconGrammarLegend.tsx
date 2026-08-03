import type { StatusEffect } from '../game/encounter/encounterTypes'
import type { IconGrammarLegendPayload } from './tutorialGuide'
import { ClassEmblemIcon, getClassEmblemDefinition } from './classEmblemRegistry'
import { StatusBadge } from './StatusBadge'
import { StatusSourceEmblem } from './StatusSourceEmblem'

interface IconGrammarLegendProps {
  legend: IconGrammarLegendPayload
}

function createLegendStatus(overrides: Partial<StatusEffect>): StatusEffect {
  return {
    id: 'icon-grammar-example',
    iconId: 'shieldWall',
    label: '图标语法示例',
    shortLabel: '示',
    remainingMs: 4_000,
    totalMs: 8_000,
    tone: 'buff',
    kind: 'playerBuff',
    ...overrides,
  }
}

export function IconGrammarLegend({ legend }: IconGrammarLegendProps) {
  if (legend.kind === 'class-emblems') {
    return (
      <div className="icon-grammar-legend icon-grammar-legend--classes" data-icon-grammar-legend={legend.kind}>
        {legend.classIds.map((classId) => {
          const definition = getClassEmblemDefinition(classId)
          return (
            <div className="icon-grammar-legend__item" key={classId}>
              <span className="icon-grammar-legend__class-mark">
                <ClassEmblemIcon classId={classId} />
              </span>
              <span>{definition.label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (legend.kind === 'source-shapes') {
    return (
      <div className="icon-grammar-legend icon-grammar-legend--sources" data-icon-grammar-legend={legend.kind}>
        <div className="icon-grammar-legend__item">
          <span className="icon-grammar-legend__source-preview">
            <StatusSourceEmblem sourceKind="activeSkill" sourceClassId={legend.classId} />
          </span>
          <span>主动技能</span>
        </div>
        <div className="icon-grammar-legend__item">
          <span className="icon-grammar-legend__source-preview">
            <StatusSourceEmblem sourceKind="passiveTalent" sourceClassId={legend.classId} />
          </span>
          <span>被动天赋</span>
        </div>
      </div>
    )
  }

  const statuses = [
    createLegendStatus({ sourceKind: 'activeSkill', sourceClassId: legend.classId }),
    createLegendStatus({
      id: 'icon-grammar-party',
      kind: 'neutral',
      sourceKind: 'passiveTalent',
      sourceClassId: legend.classId,
    }),
    createLegendStatus({
      id: 'icon-grammar-stacks',
      kind: 'playerDebuff',
      tone: 'danger',
      sourceKind: 'activeSkill',
      sourceClassId: legend.classId,
      stacks: 3,
      maxStacks: 5,
    }),
  ]

  return (
    <div className="icon-grammar-legend icon-grammar-legend--statuses" data-icon-grammar-legend={legend.kind}>
      {statuses.map((status) => <StatusBadge key={status.id} status={status} size="large" />)}
    </div>
  )
}
