import type {
  BuildRuleDefinition,
  PassiveTalentCategory,
  PassiveTalentDefinition,
  PassiveTalentId,
} from '../game/encounter/encounterTypes'
import { getStatusesForTalent } from '../game/data/playerBuildCatalog'
import { StatusBadge } from './StatusBadge'

interface PassiveTalentPanelProps {
  isOpen: boolean
  buildRule?: BuildRuleDefinition
  talents: PassiveTalentDefinition[]
  selectedPassiveTalentIds: PassiveTalentId[]
  totalPoints: number
  activePoints: number
  passivePoints: number
  remainingPoints: number
  onClose: () => void
  onToggleTalent: (talentId: PassiveTalentId) => void
  canToggleTalent: (talentId: PassiveTalentId) => boolean
}

const categoryLabels: Record<PassiveTalentCategory, string> = {
  player: '玩家数值类',
  skill: '技能变化类',
  party: '团队决策类',
}

const categoryDescriptions: Record<PassiveTalentCategory, string> = {
  player: '影响生命上限、资源获取和玩家常驻增益。',
  skill: '改变主动技能的作用方式、冷却和公共冷却关系。',
  party: '调整队伍上限、压力节奏以及整体构筑预算。',
}

export function PassiveTalentPanel({
  isOpen,
  buildRule,
  talents,
  selectedPassiveTalentIds,
  totalPoints,
  activePoints,
  passivePoints,
  remainingPoints,
  onClose,
  onToggleTalent,
  canToggleTalent,
}: PassiveTalentPanelProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="build-modal" role="dialog" aria-modal="true" aria-labelledby="passive-panel-title">
      <button type="button" className="build-modal__backdrop" onClick={onClose} aria-label="关闭被动天赋" />

      <section className="build-modal__panel">
        <div className="build-modal__header">
          <div className="build-modal__title-block">
            <p className="panel-kicker">被动天赋</p>
            <div className="build-modal__title-row">
              <h2 id="passive-panel-title">本场被动构筑</h2>
              {buildRule ? <strong className="build-modal__rule-name">{buildRule.ruleName}</strong> : null}
            </div>
          </div>
          <button type="button" className="build-modal__close" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="build-summary" data-tutorial-id="build-points-summary">
          <div className="build-summary__card">
            <span className="build-summary__label">总技能点</span>
            <strong>{totalPoints}</strong>
          </div>
          <div className="build-summary__card">
            <span className="build-summary__label">主动技能</span>
            <strong>{activePoints}</strong>
          </div>
          <div className="build-summary__card">
            <span className="build-summary__label">被动天赋</span>
            <strong>{passivePoints}</strong>
          </div>
          <div className="build-summary__card is-highlight">
            <span className="build-summary__label">剩余点数</span>
            <strong>{remainingPoints}</strong>
          </div>
        </div>

        <div className="build-modal__body build-modal__body--passive">
          <div className="passive-talent-layout" data-tutorial-id="passive-talent-list">
            {(['player', 'skill', 'party'] as PassiveTalentCategory[]).map((category) => (
              <section key={category} className="build-section passive-category">
              <div className="build-section__heading">
                <h3>{categoryLabels[category]}</h3>
                <span>{categoryDescriptions[category]}</span>
              </div>

              <div className="passive-card-list">
                {talents
                  .filter((talent) => talent.category === category)
                  .map((talent) => {
                    const selected = selectedPassiveTalentIds.includes(talent.id)
                    const canToggle = canToggleTalent(talent.id)

                    return (
                      <article
                        key={talent.id}
                        className={[
                          'passive-talent-card',
                          selected ? 'is-selected' : '',
                          !canToggle ? 'is-disabled' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div className="passive-talent-card__head">
                          <strong>{talent.name}</strong>
                          <span>{talent.cost} 点</span>
                        </div>
                        <p>{talent.description}</p>
                        {getStatusesForTalent(talent.id).length > 0 ? (
                          <div className="passive-chip-list">
                            {getStatusesForTalent(talent.id).map((status) => (
                              <article key={status.statusId} className="passive-chip">
                                <div className="stage-legend__head">
                                  <StatusBadge
                                      status={{
                                        id: status.statusId,
                                        iconId: status.iconId,
                                        label: status.statusName,
                                        shortLabel: '',
                                        remainingMs: 0,
                                      totalMs: 0,
                                      tone: 'neutral',
                                      kind: 'neutral',
                                    }}
                                    size="small"
                                  />
                                  <strong>{status.statusName}</strong>
                                </div>
                                <p>{status.description}</p>
                              </article>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="passive-talent-card__action"
                          disabled={!canToggle}
                          onClick={() => onToggleTalent(talent.id)}
                        >
                          {selected ? '取消选择' : canToggle ? '选择天赋' : '点数不足'}
                        </button>
                      </article>
                    )
                  })}
              </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
