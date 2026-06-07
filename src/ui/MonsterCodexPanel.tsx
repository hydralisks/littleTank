import { useMemo, useState } from 'react'
import type { MonsterCodexEntry, MonsterCodexSkillEntry } from '../game/data/monsterCodex'

interface MonsterCodexPanelProps {
  isOpen: boolean
  entries: readonly MonsterCodexEntry[]
  onClose: () => void
}

function formatSeconds(ms: number) {
  if (ms <= 0) {
    return '无'
  }
  return `${(ms / 1000).toFixed(1)}秒`
}

function formatSkillImpact(skill: MonsterCodexSkillEntry) {
  const values = [
    skill.playerDamage > 0 ? `命中坦克时伤害 ${skill.playerDamage}` : null,
    skill.partyDamageOnHit > 0 ? `命中坦克时aoe ${skill.partyDamageOnHit}` : null,
    skill.partyDamageOnMiss > 0 ? `命中队伍时伤害 ${skill.partyDamageOnMiss}` : null,
    skill.pressureOnHit > 0 ? `命中坦克时压力 ${skill.pressureOnHit}` : null,
    skill.pressureOnMiss > 0 ? `命中队伍时压力 ${skill.pressureOnMiss}` : null,
  ].filter(Boolean)

  return values.length > 0 ? values.join(' / ') : '无直接伤害或压力'
}

export function MonsterCodexPanel({ isOpen, entries, onClose }: MonsterCodexPanelProps) {
  const sortedEntries = useMemo(
    () => [...entries].sort((left, right) => left.name.localeCompare(right.name) || left.enemyId.localeCompare(right.enemyId)),
    [entries],
  )
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null)
  const selectedEntry = sortedEntries.find((entry) => entry.enemyId === selectedEnemyId) ?? sortedEntries[0] ?? null

  if (!isOpen) {
    return null
  }

  return (
    <div className="monster-codex__backdrop" role="presentation" onClick={onClose}>
      <section
        className="monster-codex"
        role="dialog"
        aria-modal="true"
        aria-label="怪物图鉴"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="monster-codex__header">
          <div>
            <p className="monster-codex__eyebrow">ENEMY RECORDS</p>
            <h2>怪物图鉴</h2>
          </div>
          <button type="button" className="monster-codex__close" aria-label="关闭怪物图鉴" onClick={onClose}>
            X
          </button>
        </header>

        {sortedEntries.length === 0 ? (
          <div className="monster-codex__empty">
            <strong>还没有记录</strong>
            <span>进入一场战斗后，本关出现过的敌人会加入图鉴。</span>
          </div>
        ) : (
          <div className="monster-codex__layout">
            <nav className="monster-codex__list" aria-label="已解锁怪物">
              {sortedEntries.map((entry) => (
                <button
                  key={entry.enemyId}
                  type="button"
                  className={[
                    'monster-codex__list-item',
                    selectedEntry?.enemyId === entry.enemyId ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedEnemyId(entry.enemyId)}
                >
                  <strong>{entry.name}</strong>
                  <span>{entry.isSkull ? '首领' : entry.threatLogicLabel}</span>
                </button>
              ))}
            </nav>

            {selectedEntry ? (
              <article className="monster-codex__detail">
                <div className="monster-codex__title-row">
                  <div>
                    <p className="monster-codex__enemy-id">{selectedEntry.enemyId}</p>
                    <h3>{selectedEntry.name}</h3>
                  </div>
                  {selectedEntry.isSkull ? <span className="monster-codex__boss-tag">首领</span> : null}
                </div>

                <div className="monster-codex__stats">
                  <span><strong>{selectedEntry.baseMaxHp}</strong>最大生命值</span>
                  <span><strong>{selectedEntry.threatLogicLabel}</strong>仇恨逻辑</span>
                  <span><strong>{selectedEntry.firstAppearingStage?.title ?? '未知'}</strong>首次出现</span>
                </div>

                <section className="monster-codex__section">
                  <h4>输出循环</h4>
                  <p className="monster-codex__cycle">
                    {selectedEntry.skillCycle.map((skill) => skill.name).join(' -> ') || '无固定循环'}
                  </p>
                </section>

                <section className="monster-codex__section">
                  <h4>技能列表</h4>
                  <div className="monster-codex__skills">
                    {selectedEntry.skills.map((skill) => (
                      <div key={skill.skillId} className="monster-codex__skill">
                        <div className="monster-codex__skill-head">
                          <strong>{skill.name}</strong>
                          <span>{skill.dangerLabel}危 / {skill.breakRuleLabel}</span>
                        </div>
                        <p>{formatSkillImpact(skill)}</p>
                        <dl>
                          <div><dt>目标</dt><dd>{skill.targetLabel}</dd></div>
                          <div><dt>施法</dt><dd>{formatSeconds(skill.castTimeMs)}</dd></div>
                          <div><dt>引导</dt><dd>{formatSeconds(skill.channelingMs)}</dd></div>
                          <div><dt>恢复</dt><dd>{formatSeconds(skill.recoveryMs)}</dd></div>
                        </dl>
                      </div>
                    ))}
                  </div>
                </section>
              </article>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
