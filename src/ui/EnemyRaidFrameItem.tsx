import type { CSSProperties } from 'react'
import type { EnemyState } from '../game/encounter/encounterTypes'
import { getEnemyCastFillPercent, isHighDangerCastVisual } from './enemyRaidFrameVisuals'
import { StatusBadge } from './StatusBadge'

interface EnemyRaidFrameItemProps {
  enemy: EnemyState
  isSelected: boolean
  onSelect: () => void
}

function targetLabel(target: 'tank' | 'ally' | 'party' | 'enemy' | 'self') {
  if (target === 'tank') {
    return '坦克'
  }

  if (target === 'ally') {
    return '队友'
  }

  if (target === 'party') {
    return '队伍'
  }

  if (target === 'enemy') {
    return '敌方'
  }

  return '自身'
}

export function EnemyRaidFrameItem({
  enemy,
  isSelected,
  onSelect,
}: EnemyRaidFrameItemProps) {
  const isDead = enemy.hp <= 0
  const visibleStatuses = enemy.statuses.filter((status) => status.id !== 'stable')
  const healthPercent = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)))
  const castPercent = getEnemyCastFillPercent(enemy)
  const isThreatLocked = !isDead && (enemy.cast?.target === 'self' || enemy.cast?.target === 'enemy')

  return (
    <button
      type="button"
      data-enemy-id={enemy.id}
      data-grid-row={enemy.row}
      data-grid-col={enemy.col}
      className={[
        'enemy-frame',
        isDead ? 'is-dead' : '',
        isThreatLocked ? 'threat-locked' : `threat-${enemy.threatState}`,
        isSelected ? 'is-selected' : '',
        isHighDangerCastVisual(enemy) ? 'is-high-danger' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--enemy-health-fill': `${healthPercent}%`,
          '--enemy-cast-fill': `${castPercent}%`,
        } as CSSProperties
      }
      onClick={onSelect}
    >
      {isDead ? <span className="enemy-death-ghost" aria-hidden="true">👻</span> : null}

      {isSelected ? (
        <svg
          className="enemy-selection-ring"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            className="enemy-selection-ring__base"
            x="1.5"
            y="1.5"
            width="97"
            height="97"
            rx="0"
            ry="0"
          />
          <rect
            className="enemy-selection-ring__dash"
            x="1.5"
            y="1.5"
            width="97"
            height="97"
            rx="0"
            ry="0"
          />
        </svg>
      ) : null}

      <div className="enemy-frame__line enemy-frame__line--title">
        <span className="enemy-name">{enemy.name}</span>
        <span className="enemy-hp-inline">{`${enemy.hp}/${enemy.maxHp}`}</span>
        <span className="enemy-arrow">{'>'}</span>
        <span className="enemy-target-small">
          {isDead ? '已死亡' : targetLabel(enemy.cast?.target ?? enemy.target)}
        </span>
      </div>

      <div className="enemy-frame__line enemy-frame__line--states">
        {visibleStatuses.map((status) => (
          <StatusBadge key={status.id} status={status} />
        ))}
      </div>

      <div className="enemy-frame__line enemy-frame__line--cast">
        <div
          className={[
            'enemy-cast-track',
            !isDead && enemy.cast ? 'is-active' : 'is-idle',
            enemy.cast?.breakRule === 'interruptOrControl' ? 'is-break-interrupt-or-control' : '',
            enemy.cast?.breakRule === 'controlOnly' ? 'is-break-control-only' : '',
            enemy.cast?.breakRule === 'unstoppable' ? 'is-break-unstoppable' : '',
            enemy.cast?.phase === 'channeling' ? 'is-channeling' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="enemy-cast-name">{isDead ? '已死亡' : enemy.cast?.name ?? '无施法'}</span>
        </div>
      </div>
    </button>
  )
}
