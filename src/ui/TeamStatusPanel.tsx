import type { EncounterResult, PartyState } from '../game/encounter/encounterTypes'
import { StatusBadge } from './StatusBadge'

interface TeamStatusPanelProps {
  party: PartyState
  warning: string
  result: EncounterResult | null
  resultChatter: string | null
}

export function TeamStatusPanel({
  party,
  warning,
  result,
  resultChatter,
}: TeamStatusPanelProps) {
  const hpPercent = Math.round((party.hp / party.maxHp) * 100)
  const pressurePercent = Math.round((party.pressure / party.maxPressure) * 100)
  const visibleStatuses = party.statuses.filter((status) => status.id !== 'stable')
  const resultSummary =
    result === null
      ? warning
      : result.outcome === 'victory'
        ? `成功关键：${result.reason}`
        : `失败原因：${result.reason}`

  return (
    <aside className="panel team-panel" data-tutorial-id="team-status">
      <div className="panel-heading">
        <h2>队伍状态</h2>
      </div>

      <div className="team-stack">
        <div className="status-card">
          <span className="status-label">队伍血量</span>
          <strong>{Math.round(party.hp)}/{party.maxHp}</strong>
          <div className="meter">
            <div className="meter__fill meter__fill--hp" style={{ width: `${hpPercent}%` }} />
          </div>
        </div>

        <div className="status-card">
          <span className="status-label">队伍状态</span>
          <div className="status-icon-row">
            {visibleStatuses.map((status, index) => (
              <StatusBadge key={`${status.id}-${index}`} status={status} size="large" />
            ))}
          </div>
          <span className="status-detail">
            {visibleStatuses.length > 0
              ? visibleStatuses.map((status) => status.label).join(' / ')
              : '当前无显著团队状态'}
          </span>
        </div>

        <div className="status-card">
          <span className="status-label">队伍压力</span>
          <strong>{Math.round(party.pressure)}/{party.maxPressure}</strong>
          <div className="meter">
            <div className="meter__fill meter__fill--pressure" style={{ width: `${pressurePercent}%` }} />
          </div>
        </div>

        <div className="warning-box">
          <span className="status-label">{result ? '战斗结果' : '团队预警'}</span>
          <strong>{resultSummary}</strong>
          {result && resultChatter ? (
            <span className="status-detail status-detail--quote">{resultChatter}</span>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
