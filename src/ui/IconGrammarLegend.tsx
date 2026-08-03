import type { StatusEffect } from '../game/encounter/encounterTypes'
import type { IconGrammarLegendPayload } from './tutorialGuide'
import { StatusBadge } from './StatusBadge'

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
  const classId = 'classId' in legend ? legend.classId : 'warrior_t'
  const statuses = [
    createLegendStatus({ sourceKind: 'activeSkill', sourceClassId: classId }),
    createLegendStatus({
      id: 'icon-grammar-party',
      kind: 'neutral',
      sourceKind: 'passiveTalent',
      sourceClassId: classId,
    }),
    createLegendStatus({
      id: 'icon-grammar-stacks',
      kind: 'playerDebuff',
      tone: 'danger',
      sourceKind: 'activeSkill',
      sourceClassId: classId,
      stacks: 3,
      maxStacks: 5,
    }),
  ]

  return (
    <div className="icon-grammar-legend icon-grammar-legend--statuses" data-icon-grammar-legend="status-layers">
      {statuses.map((status) => <StatusBadge key={status.id} status={status} size="large" />)}
    </div>
  )
}
