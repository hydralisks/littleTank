import type { PlayerState, StatusEffect } from '../game/encounter/encounterTypes'
import { StatusBadge } from './StatusBadge'

interface PlayerStatusPanelProps {
  player: PlayerState
}

function asSeconds(remainingMs: number) {
  return `${(remainingMs / 1000).toFixed(1)}s`
}

function createPlaceholderStatus(label: string): StatusEffect {
  return {
    id: 'stable',
    label,
    shortLabel: '',
    remainingMs: 0,
    totalMs: 0,
    tone: 'neutral',
    kind: 'neutral',
  }
}

export function PlayerStatusPanel({ player }: PlayerStatusPanelProps) {
  const hpPercent = Math.round((player.hp / player.maxHp) * 100)
  const resourcePercent = Math.round((player.resource / player.maxResource) * 100)
  const visibleDebuffs = player.debuffs.filter((status) => status.id !== 'stable')
  const visibleBuffs = [...player.buffs, ...(player.mitigation ? [player.mitigation] : [])].filter(
    (status): status is StatusEffect => status.id !== 'stable',
  )

  return (
    <section className="panel status-panel status-panel--player">
      <div className="status-grid status-grid--player">
        <div className="status-card">
          <span className="status-label">玩家生命值</span>
          <strong>{Math.round(player.hp)}/{player.maxHp}</strong>
          <div className="meter">
            <div className="meter__fill meter__fill--hp" style={{ width: `${hpPercent}%` }} />
          </div>
          <span className="status-detail">公共冷却 {asSeconds(player.gcdRemainingMs)}</span>
        </div>

        <div className="status-card">
          <span className="status-label">玩家资源</span>
          <strong>{Math.round(player.resource)}/{player.maxResource}</strong>
          <div className="meter">
            <div className="meter__fill meter__fill--resource" style={{ width: `${resourcePercent}%` }} />
          </div>
        </div>

        <div className="status-card">
          <span className="status-label">当前增益</span>
          <div className="status-icon-row">
            {visibleBuffs.map((status, index) => (
              <StatusBadge key={`${status.id}-${index}`} status={status} size="large" />
            ))}
          </div>
          <span className="status-detail">
            {visibleBuffs.length > 0
              ? visibleBuffs
                  .map((status) =>
                    status.remainingMs > 0 ? `${status.label} ${asSeconds(status.remainingMs)}` : status.label,
                  )
                  .join(' / ')
              : '当前无关键增益'}
          </span>
        </div>

        <div className="status-card">
          <span className="status-label">当前减益</span>
          <div className="status-icon-row">
            {(visibleDebuffs.length > 0 ? visibleDebuffs : [createPlaceholderStatus('当前无减益')]).map((status, index) => (
              <StatusBadge key={`${status.id}-${index}`} status={status} size="large" />
            ))}
          </div>
          <span className="status-detail">
            {visibleDebuffs.length > 0
              ? visibleDebuffs.map((status) => `${status.label} ${asSeconds(status.remainingMs)}`).join(' / ')
              : '未受到关键减益'}
          </span>
        </div>
      </div>
    </section>
  )
}
