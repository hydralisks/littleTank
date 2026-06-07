import { getEnemySkillDefinition, getEnemyStatusDefinition } from '../game/data/enemyCatalog'
import type { StageInfo } from '../game/data/stageTemplates'
import type { EncounterState, StatusEffect } from '../game/encounter/encounterTypes'
import { StatusBadge } from './StatusBadge'

interface StageStatusPanelProps {
  isOpen: boolean
  stage: StageInfo
  encounter: EncounterState
  onClose: () => void
}

interface StageLegendEntry {
  id: string
  iconId: string
  label: string
  target: string
  source: string
  description: string
}

function createLegendStatus(id: string, label: string): StatusEffect {
  return {
    id,
    iconId: id,
    label,
    shortLabel: '',
    remainingMs: 0,
    totalMs: 0,
    tone: 'neutral',
    kind: 'neutral',
  }
}

function getLegendTarget(statusId: string) {
  const status = getEnemyStatusDefinition(statusId)
  switch (status?.kind) {
    case 'enemyBuff':
      return '敌方'
    case 'playerDebuff':
      return '玩家'
    case 'partyDebuff':
      return '队伍'
    default:
      return '战场'
  }
}

function buildLegend(stage: StageInfo, encounter: EncounterState): StageLegendEntry[] {
  const entries = new Map<string, StageLegendEntry>()

  for (const entry of stage.legend) {
    entries.set(entry.id, {
      id: entry.id,
      iconId: entry.iconId ?? entry.id,
      label: entry.label,
      target: entry.target,
      source: entry.source,
      description: entry.description,
    })
  }

  for (const enemy of encounter.enemies) {
    for (const skillId of enemy.skillIds) {
      const definition = getEnemySkillDefinition(skillId)
      if (!definition) {
        continue
      }

      for (const statusId of [
        ...definition.appliedTargetStatusIds,
        ...definition.appliedSelfStatusIds,
      ]) {
        const status = getEnemyStatusDefinition(statusId)
        if (!status) {
          continue
        }

        entries.set(statusId, {
          id: statusId,
          iconId: status.iconId,
          label: status.statusName,
          target: getLegendTarget(statusId),
          source: '敌人技能',
          description: status.description,
        })
      }
    }
  }

  for (const affix of encounter.stage.affixes) {
    const status = getEnemyStatusDefinition(affix.statusId)
    if (!status) {
      continue
    }

    entries.set(affix.statusId, {
      id: affix.statusId,
      iconId: status.iconId,
      label: status.statusName,
      target: getLegendTarget(affix.statusId),
      source: `关卡词缀：${affix.affixName}`,
      description: status.description,
    })
  }

  for (const rule of encounter.stage.specialRules) {
    for (const statusId of rule.grantedStatusIds) {
      const status = getEnemyStatusDefinition(statusId)
      if (!status) {
        continue
      }

        entries.set(statusId, {
          id: statusId,
          iconId: status.iconId,
          label: status.statusName,
          target: getLegendTarget(statusId),
          source: `特殊规则：${rule.ruleName}`,
          description: status.description,
        })
    }
  }

  return [...entries.values()]
}

export function StageStatusPanel({ isOpen, stage, encounter, onClose }: StageStatusPanelProps) {
  if (!isOpen) {
    return null
  }

  const legend = buildLegend(stage, encounter)

  return (
    <div className="build-modal" role="dialog" aria-modal="true" aria-labelledby="stage-panel-title">
      <button type="button" className="build-modal__backdrop" onClick={onClose} aria-label="关闭本场状态" />

      <section className="build-modal__panel stage-modal">
        <div className="build-modal__header">
          <div>
            <p className="panel-kicker">本场状态</p>
            <h2 id="stage-panel-title">{stage.title} 关卡说明</h2>
          </div>
          <button type="button" className="build-modal__close" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="stage-layout">
          <div className="stage-sections">
            <section className="build-section stage-section">
              <div className="build-section__heading">
                <h3>关卡词缀</h3>
                <span>决定本关的主要危险主题和敌方强化方向。</span>
              </div>
              <div className="stage-card-list">
                {encounter.stage.affixes.map((entry) => (
                  <article key={entry.affixId} className="stage-card">
                    <StatusBadge status={createLegendStatus(entry.iconId, entry.affixName)} size="large" />
                    <div className="stage-card__body">
                      <strong>{entry.affixName}</strong>
                      <p>{entry.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="build-section stage-section">
              <div className="build-section__heading">
                <h3>特殊规则</h3>
                <span>帮助理解本关节奏判定和后续逻辑入口。</span>
              </div>
              <div className="stage-card-list">
                {encounter.stage.specialRules.map((entry) => (
                  <article key={entry.ruleId} className="stage-card">
                    <StatusBadge status={createLegendStatus(entry.iconId, entry.ruleName)} size="large" />
                    <div className="stage-card__body">
                      <strong>{entry.ruleName}</strong>
                      <p>{entry.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="build-section stage-legend">
            <div className="build-section__heading">
              <h3>本关图例</h3>
              <span>仅收录非玩家构筑造成的状态图标及其效果。</span>
            </div>
            <div className="stage-legend__list">
              {legend.map((entry) => (
                <article key={entry.id} className="stage-legend__item">
                  <StatusBadge status={createLegendStatus(entry.iconId, entry.label)} size="large" />
                  <div className="stage-legend__body">
                    <div className="stage-legend__head">
                      <strong>{entry.label}</strong>
                      <span>{entry.target}</span>
                    </div>
                    <span className="stage-legend__source">{entry.source}</span>
                    <p>{entry.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
