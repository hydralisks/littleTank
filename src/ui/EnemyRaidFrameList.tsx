import type { EnemyState } from '../game/encounter/encounterTypes'
import { EnemyRaidFrameItem } from './EnemyRaidFrameItem'

interface EnemyRaidFrameListProps {
  enemies: EnemyState[]
  selectedEnemyId: string | null
  onSelectEnemy: (enemyId: string) => void
}

export function EnemyRaidFrameList({
  enemies,
  selectedEnemyId,
  onSelectEnemy,
}: EnemyRaidFrameListProps) {
  const gridSize = 5
  const maxSlots = gridSize * gridSize
  const enemyBySlot = new Map(
    enemies
      .filter((enemy) => enemy.row >= 1 && enemy.row <= gridSize && enemy.col >= 1 && enemy.col <= gridSize)
      .map((enemy) => [`${enemy.row}-${enemy.col}`, enemy]),
  )

  return (
    <section className="panel enemy-panel" data-tutorial-id="enemy-frames">
      <div className="enemy-list" data-tutorial-id="enemy-cast-and-threat">
        {Array.from({ length: maxSlots }, (_, index) => {
          const row = Math.floor(index / gridSize) + 1
          const col = (index % gridSize) + 1
          const slotKey = `${row}-${col}`
          const enemy = enemyBySlot.get(slotKey)

          return enemy ? (
            <EnemyRaidFrameItem
              key={enemy.id}
              enemy={enemy}
              isSelected={enemy.id === selectedEnemyId}
              onSelect={() => onSelectEnemy(enemy.id)}
            />
          ) : (
            <div
              key={`empty-slot-${slotKey}`}
              className="enemy-frame enemy-frame--empty"
              data-grid-slot={slotKey}
              aria-hidden="true"
            />
          )
        })}
      </div>
    </section>
  )
}
