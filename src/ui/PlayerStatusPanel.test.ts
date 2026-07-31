import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import type { PlayerState, StatusEffect } from '../game/encounter/encounterTypes'
import { PlayerStatusPanel } from './PlayerStatusPanel'

function createStatus(id: string, absorbRemaining?: number): StatusEffect {
  return {
    id,
    label: id,
    shortLabel: '',
    remainingMs: 5_000,
    totalMs: 5_000,
    tone: 'buff',
    kind: 'neutral',
    ...(typeof absorbRemaining === 'number' ? { absorbRemaining, absorbRatio: 1 } : {}),
  }
}

function createPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    classId: 'druid_bear_t',
    hp: 100,
    maxHp: 150,
    resource: 30,
    maxResource: 100,
    gcdRemainingMs: 0,
    currentTargetId: null,
    mitigation: null,
    buffs: [],
    debuffs: [],
    ...overrides,
  }
}

function renderPlayer(player: PlayerState) {
  const markup = renderToStaticMarkup(createElement(PlayerStatusPanel, { player }))
  return new JSDOM(markup, { url: 'http://localhost/' }).window.document
}

describe('PlayerStatusPanel absorb meter', () => {
  it('sums absorb from buffs and the independent mitigation state', () => {
    const document = renderPlayer(createPlayer({
      buffs: [createStatus('buff-shield', 30), createStatus('ordinary-buff')],
      mitigation: createStatus('mitigation-shield', 45),
    }))
    const absorb = document.querySelector('[data-player-absorb]')

    expect(absorb?.getAttribute('aria-label')).toBe('当前吸收盾 75')
    expect(absorb?.getAttribute('style')).toContain('width:50%')
  })

  it('does not render the white bar when no absorb remains', () => {
    const document = renderPlayer(createPlayer({
      buffs: [createStatus('spent-shield', 0), createStatus('ordinary-buff')],
    }))

    expect(document.querySelector('.player-health-meters')).not.toBeNull()
    expect(document.querySelector('[data-player-absorb]')).toBeNull()
  })

  it('caps the visual width without truncating the accessible total', () => {
    const document = renderPlayer(createPlayer({
      buffs: [createStatus('oversized-shield', 200)],
    }))
    const absorb = document.querySelector('[data-player-absorb]')

    expect(absorb?.getAttribute('aria-label')).toBe('当前吸收盾 200')
    expect(absorb?.getAttribute('style')).toContain('width:100%')
  })
})
