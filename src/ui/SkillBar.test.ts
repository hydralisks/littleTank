import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import type { SkillState } from '../game/encounter/encounterTypes'
import { SkillBar, type SkillBarSlotView } from './SkillBar'

function createSkill(overrides: Partial<SkillState>): SkillState {
  return {
    id: 'test-skill',
    name: '测试技能',
    shortName: '测试',
    iconId: 'taunt',
    hotkey: '1',
    cooldownMs: 8_000,
    remainingCooldownMs: 0,
    resourceCost: 10,
    gcdMs: 1_500,
    ...overrides,
  }
}

function findSkillCardByHotkey(container: HTMLElement, hotkey: string) {
  return [...container.querySelectorAll('.skill-card')].find((element) =>
    element.querySelector('.skill-key')?.textContent?.includes(hotkey),
  ) as HTMLElement | undefined
}

describe('SkillBar', () => {
  it('renders an orange gcd countdown overlay only on skills affected by gcd', () => {
    const slots: SkillBarSlotView[] = [
      {
        hotkey: '1',
        skill: createSkill({
          id: 'warrior_t_taunt',
          hotkey: '1',
          gcdMs: 1_500,
        }),
      },
      {
        hotkey: '2',
        skill: createSkill({
          id: 'warrior_t_interrupt',
          hotkey: '2',
          gcdMs: 0,
        }),
      },
    ]
    const markup = renderToStaticMarkup(
      createElement(SkillBar, {
        slots,
        currentResource: 100,
        gcdRemainingMs: 750,
        combatLocked: false,
        onActivateSkill: vi.fn(),
      }),
    )
    const dom = new JSDOM(markup)
    const container = dom.window.document.body

    const gcdLockedCard = findSkillCardByHotkey(container, '1')
    const gcdFreeCard = findSkillCardByHotkey(container, '2')
    const gcdOverlay = gcdLockedCard?.querySelector('.skill-icon-gcd') as HTMLElement | null

    expect(gcdOverlay).not.toBeNull()
    expect((gcdLockedCard?.querySelector('.skill-icon-box') as HTMLElement | null)?.style.getPropertyValue('--skill-gcd-angle')).toBe('180deg')
    expect(gcdFreeCard?.querySelector('.skill-icon-gcd')).toBeNull()
  })

  it('renders a lower-left charge count badge for charge-based skills', () => {
    const slots: SkillBarSlotView[] = [
      {
        hotkey: 'Q',
        skill: createSkill({
          id: 'warrior_t_shield_wall',
          hotkey: 'Q',
          maxCharges: 2,
          currentCharges: 1,
        }),
      },
    ]
    const markup = renderToStaticMarkup(
      createElement(SkillBar, {
        slots,
        currentResource: 100,
        gcdRemainingMs: 0,
        combatLocked: false,
        onActivateSkill: vi.fn(),
      }),
    )
    const dom = new JSDOM(markup)
    const container = dom.window.document.body

    const chargeBadge = container.querySelector('.skill-icon-charge-count')

    expect(chargeBadge?.textContent).toBe('1')
  })
})
