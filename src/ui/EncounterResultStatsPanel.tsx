import { useMemo, useState } from 'react'
import type {
  CastHandlingRow,
  EncounterStats,
  HealingAbsorbRow,
  StatAmountRow,
} from '../game/encounter/combatStats'
import type { EncounterOutcome } from '../game/encounter/encounterTypes'

type ResultStatsTabId =
  | 'tank'
  | 'partyDamage'
  | 'pressure'
  | 'casts'
  | 'damage'
  | 'playerHealing'
  | 'partyHealing'
  | 'enemyHealing'

interface ResultStatsTab {
  id: ResultStatsTabId
  label: string
  description: string
}

interface EncounterResultStatsPanelProps {
  outcome: EncounterOutcome
  stageTitle: string
  reason: string
  stats: EncounterStats
  onReturnToStageSelect: () => void
  onRetryStage: () => void
}

const TABS: ResultStatsTab[] = [
  { id: 'tank', label: '坦克承伤', description: '统计坦克实际受到的伤害，用来判断本场最需要防御或打断的来源。' },
  { id: 'partyDamage', label: '队伍承伤', description: '统计队伍实际受到的伤害，用来判断哪些敌方技能或状态正在压低队伍血线。' },
  { id: 'pressure', label: '压力来源', description: '统计队伍压力增加的来源，用来判断哪些机制正在把后排推向崩盘。' },
  { id: 'casts', label: '打断情况', description: '记录敌方读条是否被打断或控制，用来判断关键读条是否漏处理。' },
  { id: 'damage', label: '造成伤害', description: '统计玩家技能、玩家自动攻击、队伍自动攻击和天赋造成的伤害。' },
  { id: 'playerHealing', label: '玩家治疗/吸收', description: '统计作用在坦克身上的治疗量和产生的吸收盾；吸收表示生成值，不表示实际消耗值。' },
  { id: 'partyHealing', label: '队伍治疗/吸收', description: '统计作用在队伍身上的治疗量和产生的吸收盾；吸收表示生成值，不表示实际消耗值。' },
  { id: 'enemyHealing', label: '敌方治疗/吸收', description: '单独统计敌方治疗量和敌方产生的吸收盾，不与玩家和队伍的治疗/吸收混算占比。' },
]

function formatTime(timeMs: number) {
  return `${(timeMs / 1000).toFixed(1)}s`
}

function formatAmount(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function formatShare(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatDanger(value: CastHandlingRow['dangerLevel']) {
  if (value === 'high') {
    return '高'
  }
  if (value === 'medium') {
    return '中'
  }
  return '低'
}

function getTotal(rows: readonly StatAmountRow[]) {
  return rows.reduce((sum, row) => sum + row.total, 0)
}

function getTopSummary(rows: readonly StatAmountRow[], unit: string) {
  const top = rows[0]
  if (!top) {
    return '本页暂无统计。'
  }

  return `总量 ${formatAmount(getTotal(rows))}${unit}，最大来源：${top.effectName} ${formatAmount(top.total)}${unit}，占 ${formatShare(top.share)}。`
}

function AmountTable({ rows }: { rows: readonly StatAmountRow[] }) {
  if (rows.length === 0) {
    return <div className="result-stats-empty">本场没有产生该类事件。</div>
  }

  return (
    <table className="result-stats-table">
      <thead>
        <tr>
          <th>来源</th>
          <th>项目</th>
          <th>分类</th>
          <th>总量</th>
          <th>次数</th>
          <th>平均</th>
          <th>占比</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.sourceName}</td>
            <td>{row.effectName}</td>
            <td>{row.category}</td>
            <td>{formatAmount(row.total)}</td>
            <td>{row.count}</td>
            <td>{formatAmount(row.average)}</td>
            <td>{formatShare(row.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function HealingTable({ rows }: { rows: readonly HealingAbsorbRow[] }) {
  if (rows.length === 0) {
    return <div className="result-stats-empty">本场没有产生该类事件。</div>
  }

  return (
    <table className="result-stats-table">
      <thead>
        <tr>
          <th>来源</th>
          <th>项目</th>
          <th>类型</th>
          <th>分类</th>
          <th>总量</th>
          <th>次数</th>
          <th>占比</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.sourceName}</td>
            <td>{row.effectName}</td>
            <td>{row.kind === 'absorb' ? '吸收' : '治疗'}</td>
            <td>{row.category}</td>
            <td>{formatAmount(row.total)}</td>
            <td>{row.count}</td>
            <td>{formatShare(row.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CastTable({ rows }: { rows: readonly CastHandlingRow[] }) {
  if (rows.length === 0) {
    return <div className="result-stats-empty">本场没有产生该类事件。</div>
  }

  return (
    <table className="result-stats-table">
      <thead>
        <tr>
          <th>敌人</th>
          <th>技能</th>
          <th>危险度</th>
          <th>打断成功/总计</th>
          <th>控制成功</th>
          <th>完成/不可处理</th>
          <th>处理方式</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.enemyName}</td>
            <td>{row.skillName}</td>
            <td>{formatDanger(row.dangerLevel)}</td>
            <td>{row.interruptedCount}/{row.totalCasts}</td>
            <td>{row.controlledCount}</td>
            <td>{row.completedCount}/{row.unhandleableCount}</td>
            <td>{row.handlerNames.length > 0 ? row.handlerNames.join('、') : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function EncounterResultStatsPanel({
  outcome,
  stageTitle,
  reason,
  stats,
  onReturnToStageSelect,
  onRetryStage,
}: EncounterResultStatsPanelProps) {
  const [activeTab, setActiveTab] = useState<ResultStatsTabId>('tank')
  const activeTabInfo = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]
  const activeContent = useMemo(() => {
    if (activeTab === 'tank') {
      return {
        summary: getTopSummary(stats.tankDamageTaken, ' 伤害'),
        table: <AmountTable rows={stats.tankDamageTaken} />,
      }
    }
    if (activeTab === 'partyDamage') {
      return {
        summary: getTopSummary(stats.partyDamageTaken, ' 伤害'),
        table: <AmountTable rows={stats.partyDamageTaken} />,
      }
    }
    if (activeTab === 'pressure') {
      return {
        summary: getTopSummary(stats.pressureGained, ' 压力'),
        table: <AmountTable rows={stats.pressureGained} />,
      }
    }
    if (activeTab === 'casts') {
      const totalCasts = stats.castHandling.reduce((sum, row) => sum + row.totalCasts, 0)
      const interrupted = stats.castHandling.reduce((sum, row) => sum + row.interruptedCount, 0)
      const controlled = stats.castHandling.reduce((sum, row) => sum + row.controlledCount, 0)
      const highMissed = stats.castHandling.reduce((sum, row) => (
        row.dangerLevel === 'high' ? sum + row.completedCount + row.unhandleableCount : sum
      ), 0)
      return {
        summary: stats.castHandling.length > 0
          ? `读条开始 ${totalCasts} 次，成功打断 ${interrupted} 次，控制 ${controlled} 次，高危读条漏处理 ${highMissed} 次。`
          : '本页暂无统计。',
        table: <CastTable rows={stats.castHandling} />,
      }
    }
    if (activeTab === 'damage') {
      return {
        summary: getTopSummary(stats.damageDealt, ' 伤害'),
        table: <AmountTable rows={stats.damageDealt} />,
      }
    }
    if (activeTab === 'playerHealing') {
      return {
        summary: getTopSummary(stats.playerHealingAndAbsorb, ' 治疗/吸收'),
        table: <HealingTable rows={stats.playerHealingAndAbsorb} />,
      }
    }
    if (activeTab === 'partyHealing') {
      return {
        summary: getTopSummary(stats.partyHealingAndAbsorb, ' 治疗/吸收'),
        table: <HealingTable rows={stats.partyHealingAndAbsorb} />,
      }
    }

    return {
      summary: getTopSummary(stats.enemyHealingAndAbsorb, ' 治疗/吸收'),
      table: <HealingTable rows={stats.enemyHealingAndAbsorb} />,
    }
  }, [activeTab, stats])

  return (
    <section className="result-stats-panel">
      <header className="result-stats-header">
        <div>
          <p className="result-stats-kicker">{outcome === 'victory' ? '胜利' : '失败'}</p>
          <h2>{stageTitle}</h2>
          <p>{reason}</p>
        </div>
        <div className="result-stats-duration">
          <span>战斗时长</span>
          <strong>{formatTime(stats.durationMs)}</strong>
        </div>
      </header>

      <nav className="result-stats-tabs" aria-label="战斗统计">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="result-stats-explain">{activeTabInfo.description}</div>
      <div className="result-stats-summary">{activeContent.summary}</div>
      <div className="result-stats-table-wrap">{activeContent.table}</div>

      <footer className="result-stats-actions">
        {outcome === 'defeat' ? (
          <button type="button" className="result-action result-action--primary" onClick={onRetryStage}>
            <span className="result-action__title">我不信了</span>
          </button>
        ) : (
          <button type="button" className="result-action result-action--primary" onClick={onReturnToStageSelect}>
            <span className="result-action__title">简单简单</span>
          </button>
        )}
      </footer>
    </section>
  )
}
