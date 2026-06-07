import type { CSSProperties } from 'react'
import type { SkillHotkey, SkillId, SkillState } from '../game/encounter/encounterTypes'
import { lockedSkillIcon, skillIconMap } from './iconMaps'
import { resolveIconAssetUrl } from './statusIconResolver'

export interface SkillBarSlotView {
  hotkey: SkillHotkey
  skill: SkillState | null
}

interface SkillBarProps {
  slots: SkillBarSlotView[]
  currentResource: number
  gcdRemainingMs: number
  combatLocked: boolean
  onActivateSkill: (skillId: SkillId) => void
}

function getCooldownAngle(skill: SkillState) {
  if (skill.cooldownMs <= 0 || skill.remainingCooldownMs <= 0) {
    return '0deg'
  }

  const remainingRatio = Math.max(0, Math.min(1, skill.remainingCooldownMs / skill.cooldownMs))
  return `${remainingRatio * 360}deg`
}

function getGcdAngle(skill: SkillState, gcdRemainingMs: number) {
  if (skill.gcdMs <= 0 || gcdRemainingMs <= 0) {
    return '0deg'
  }

  const remainingRatio = Math.max(0, Math.min(1, gcdRemainingMs / skill.gcdMs))
  return `${remainingRatio * 360}deg`
}

function formatCooldownDigits(remainingCooldownMs: number) {
  if (remainingCooldownMs <= 0) {
    return null
  }

  if (remainingCooldownMs >= 10_000) {
    return `${Math.ceil(remainingCooldownMs / 1000)}`
  }

  return (remainingCooldownMs / 1000).toFixed(1)
}

export function SkillBar({
  slots,
  currentResource,
  gcdRemainingMs,
  combatLocked,
  onActivateSkill,
}: SkillBarProps) {
  return (
    <section className="panel skill-panel" data-tutorial-id="skill-bar">
      <div className="skill-grid">
        {slots.map(({ hotkey, skill }) => {
          if (!skill) {
            return (
              <div key={hotkey} className="skill-card is-locked" aria-label={`${hotkey} 未激活`}>
                <div className="skill-card__meta">
                  <span className="skill-key">{hotkey}</span>
                  <strong className="skill-name">未激活</strong>
                  <span className="skill-cost">在技能配置中解锁</span>
                </div>

                <div className="skill-icon-box is-locked">
                  <img className="skill-icon-image" src={lockedSkillIcon} alt="" aria-hidden="true" />
                </div>
              </div>
            )
          }

          const hasCooldown = skill.remainingCooldownMs > 0
          const lacksResource = currentResource < skill.resourceCost
          const lockedByGcd = gcdRemainingMs > 0 && skill.gcdMs > 0
          const hasGcdOverlay = lockedByGcd
          const cooldownDigits = formatCooldownDigits(skill.remainingCooldownMs)
          const chargeCount =
            typeof skill.maxCharges === 'number' && skill.maxCharges > 1
              ? skill.currentCharges ?? skill.maxCharges
              : null

          return (
            <button
              key={hotkey}
              type="button"
              className={[
                'skill-card',
                hasCooldown ? 'is-cooling' : 'is-ready',
                lacksResource ? 'is-starved' : '',
                lockedByGcd ? 'is-gcd-locked' : '',
                combatLocked ? 'is-combat-locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onActivateSkill(skill.id)}
              disabled={combatLocked}
              aria-disabled={combatLocked || hasCooldown || lacksResource || lockedByGcd}
              title={skill.name}
            >
              <div className="skill-card__meta">
                <span className="skill-key">{hotkey}</span>
                <strong className="skill-name">{skill.shortName}</strong>
                <span className="skill-cost">
                  消耗 {skill.resourceCost}
                  {lockedByGcd ? ' / 公共冷却' : ''}
                </span>
              </div>

              <div
                className={['skill-icon-box', hasCooldown ? 'is-cooling' : 'is-ready'].join(' ')}
                style={
                  {
                    '--skill-cooldown-angle': getCooldownAngle(skill),
                    '--skill-gcd-angle': getGcdAngle(skill, gcdRemainingMs),
                  } as CSSProperties
                }
              >
                <img
                  className="skill-icon-image"
                  src={resolveIconAssetUrl(skill.iconId, 'skill') ?? skillIconMap[skill.id]}
                  alt=""
                  aria-hidden="true"
                />
                {hasCooldown ? <span className="skill-icon-cooldown" aria-hidden="true" /> : null}
                {hasGcdOverlay ? <span className="skill-icon-gcd" aria-hidden="true" /> : null}
                {cooldownDigits ? (
                  <span className="skill-icon-timer" aria-hidden="true">
                    {cooldownDigits}
                  </span>
                ) : null}
                {chargeCount !== null ? (
                  <span className="skill-icon-charge-count" aria-hidden="true">
                    {chargeCount}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
