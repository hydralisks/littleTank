import type {
  ActiveSkillDefinition,
  BuildRuleDefinition,
  SkillHotkey,
  SkillId,
  SkillLoadout,
} from '../game/encounter/encounterTypes'
import { ACTIVE_SKILL_POINT_COST, SKILL_HOTKEYS } from '../game/data/skillTemplates'
import { getSkillEffectsForSkill, getStatusesForSkill } from '../game/data/playerBuildCatalog'
import { lockedSkillIcon, skillIconMap } from './iconMaps'
import { resolveIconAssetUrl } from './statusIconResolver'
import { StatusBadge } from './StatusBadge'

interface SkillConfigPanelProps {
  isOpen: boolean
  loadout: SkillLoadout
  selectedHotkey: SkillHotkey | null
  buildRule?: BuildRuleDefinition
  activeSkills: ActiveSkillDefinition[]
  totalPoints: number
  activePoints: number
  passivePoints: number
  remainingPoints: number
  onClose: () => void
  onSelectHotkey: (hotkey: SkillHotkey) => void
  onAssignSkill: (skillId: SkillId) => void
  onClearHotkey: (hotkey: SkillHotkey) => void
  canAssignToSelectedHotkey: (skillId: SkillId) => boolean
}

function getAssignedHotkey(loadout: SkillLoadout, skillId: SkillId) {
  return SKILL_HOTKEYS.find((hotkey) => loadout[hotkey] === skillId) ?? null
}

function wrapShortName(shortName: string) {
  if (shortName.length <= 4) {
    return [shortName]
  }

  const midpoint = Math.ceil(shortName.length / 2)
  return [shortName.slice(0, midpoint), shortName.slice(midpoint)]
}

function getSkillTargetSelectorText(skillId: SkillId) {
  const selectors = getSkillEffectsForSkill(skillId)
    .map((effect) => effect.targetSelector)
    .filter((selector, index, allSelectors) => selector && allSelectors.indexOf(selector) === index)

  return selectors.length > 0 ? selectors.join('、') : null
}

export function SkillConfigPanel({
  isOpen,
  loadout,
  selectedHotkey,
  buildRule,
  activeSkills,
  totalPoints,
  activePoints,
  passivePoints,
  remainingPoints,
  onClose,
  onSelectHotkey,
  onAssignSkill,
  onClearHotkey,
  canAssignToSelectedHotkey,
}: SkillConfigPanelProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="build-modal" role="dialog" aria-modal="true" aria-labelledby="skill-config-title">
      <button type="button" className="build-modal__backdrop" onClick={onClose} aria-label="关闭技能配置" />

      <section className="build-modal__panel">
        <div className="build-modal__header">
          <div className="build-modal__title-block">
            <p className="panel-kicker">技能配置</p>
            <div className="build-modal__title-row">
              <h2 id="skill-config-title">本场主动构筑</h2>
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

        <div className="build-modal__body">
          <section className="build-section build-section--slots" data-tutorial-id="skill-config-slots">
            <div className="build-section__heading build-section__heading--slots">
              <h3>热键栏位</h3>
              <span className="build-section__hotkey-legend">开放键位：{buildRule?.enabledHotkeys.join('/') ?? SKILL_HOTKEYS.join('/')}</span>
              <strong className="build-section__cost-note">每个技能 {ACTIVE_SKILL_POINT_COST} 技能点</strong>
            </div>

            <div className="loadout-grid">
              {SKILL_HOTKEYS.map((hotkey) => {
                const skillId = loadout[hotkey]
                const skill = skillId ? activeSkills.find((entry) => entry.id === skillId) ?? null : null

                return (
                  <article
                    key={hotkey}
                    className={[
                      'loadout-slot',
                      selectedHotkey === hotkey ? 'is-selected' : '',
                      skill ? 'is-filled' : 'is-empty',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <button type="button" className="loadout-slot__pick" onClick={() => onSelectHotkey(hotkey)}>
                      <span className="loadout-slot__hotkey">{hotkey}</span>
                      <div className="loadout-slot__main">
                        <img
                          className="loadout-slot__icon"
                          src={skill ? resolveIconAssetUrl(skill.iconId, 'skill') ?? skillIconMap[skill.id] : lockedSkillIcon}
                          alt=""
                          aria-hidden="true"
                        />
                        <strong className="loadout-slot__name">
                          {(skill ? wrapShortName(skill.shortName) : ['未激活']).map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </strong>
                      </div>
                      <span className="loadout-slot__meta">{skill ? `${skill.pointCost} 点` : '锁定'}</span>
                    </button>

                    {skill ? (
                      <button type="button" className="loadout-slot__clear" onClick={() => onClearHotkey(hotkey)}>
                        清空
                      </button>
                    ) : null}
                  </article>
                )
              })}
            </div>

          </section>

          <section className="build-section build-section--library" data-tutorial-id="skill-library">
            <div className="build-section__heading">
              <h3>可选主动技能</h3>
              <span>点击技能放入当前选中的热键栏位。</span>
            </div>

            <div className="skill-library">
              {activeSkills.map((skill) => {
                const assignedHotkey = getAssignedHotkey(loadout, skill.id)
                const canAssign = selectedHotkey ? canAssignToSelectedHotkey(skill.id) : false
                const targetSelectorText = getSkillTargetSelectorText(skill.id)
                const actionLabel = !selectedHotkey
                  ? '先选择左侧栏位'
                  : assignedHotkey === selectedHotkey
                    ? `已放入 ${selectedHotkey}`
                    : assignedHotkey
                      ? `交换到 ${selectedHotkey}`
                      : `放入 ${selectedHotkey}`

                return (
                  <article key={skill.id} className="skill-library-card">
                    <img
                      className="skill-library-card__icon"
                      src={resolveIconAssetUrl(skill.iconId, 'skill') ?? skillIconMap[skill.id]}
                      alt=""
                      aria-hidden="true"
                    />
                    <div className="skill-library-card__body">
                      <div className="skill-library-card__head">
                        <strong>{skill.name}</strong>
                        <span>{skill.pointCost} 点</span>
                      </div>
                      <p>{skill.description}</p>
                      {targetSelectorText ? (
                        <p className="skill-library-card__target">
                          作用目标：{targetSelectorText}
                        </p>
                      ) : null}
                      <div className="skill-library-card__foot">
                        <span>{assignedHotkey ? `已装备到 ${assignedHotkey}` : '当前未装备'}</span>
                        <button
                          type="button"
                          className="skill-library-card__action"
                          disabled={!selectedHotkey || !canAssign}
                          onClick={() => onAssignSkill(skill.id)}
                        >
                          {!selectedHotkey ? actionLabel : canAssign ? actionLabel : '点数不足'}
                        </button>
                      </div>
                      {getStatusesForSkill(skill.id).length > 0 ? (
                        <div className="passive-chip-list">
                          {getStatusesForSkill(skill.id).map((status) => (
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
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
