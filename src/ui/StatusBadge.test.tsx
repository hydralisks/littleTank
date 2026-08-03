import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import type { StatusEffect } from '../game/encounter/encounterTypes'
import { StatusBadge } from './StatusBadge'

function createStatus(overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    id: 'test-status',
    iconId: 'shieldWall',
    label: '测试状态',
    shortLabel: '测',
    remainingMs: 4_000,
    totalMs: 8_000,
    tone: 'buff',
    kind: 'playerBuff',
    ...overrides,
  }
}

function renderStatus(status: StatusEffect, size: 'small' | 'large' = 'small') {
  const markup = renderToStaticMarkup(createElement(StatusBadge, { status, size }))
  return new JSDOM(markup, { url: 'http://localhost/' }).window.document
}

describe('StatusBadge layered presentation', () => {
  it('composes semantic frame, stacks, and timer without rendering source metadata', () => {
    const document = renderStatus(createStatus({
      kind: 'playerDebuff',
      tone: 'danger',
      sourceKind: 'activeSkill',
      sourceClassId: 'warrior_t',
      stacks: 7,
      maxStacks: 5,
    }), 'large')

    expect(document.querySelector('.status-square--harmful')).not.toBeNull()
    expect(document.querySelector('[data-status-semantic="harmful"]')).not.toBeNull()
    expect(document.querySelector('[data-status-source]')).toBeNull()
    expect(document.querySelector('[data-source-shape]')).toBeNull()
    expect(document.querySelector('[data-class-motif]')).toBeNull()
    expect(document.querySelector('[data-status-stacks]')?.textContent).toBe('5')
    expect(document.querySelector('.status-square__overlay')).not.toBeNull()
  })

  it('ignores passive source metadata in the visual presentation', () => {
    const document = renderStatus(createStatus({
      sourceKind: 'passiveTalent',
      sourceClassId: 'druid_bear_t',
    }))

    expect(document.querySelector('[data-status-source]')).toBeNull()
    expect(document.querySelector('[data-source-shape]')).toBeNull()
    expect(document.querySelector('[data-class-motif]')).toBeNull()
    expect(document.querySelector('[data-status-semantic="beneficial"]')).not.toBeNull()
  })

  it('keeps legacy and permanent statuses readable without fabricated overlays', () => {
    const document = renderStatus(createStatus({
      remainingMs: -1,
      totalMs: -1,
      sourceKind: undefined,
      sourceClassId: undefined,
      stacks: 1,
      maxStacks: 5,
    }))

    expect(document.querySelector('.status-square__icon')).not.toBeNull()
    expect(document.querySelector('[data-status-source]')).toBeNull()
    expect(document.querySelector('[data-status-stacks]')).toBeNull()
    expect(document.querySelector('.status-square__overlay')).toBeNull()
  })

  it.each([
    ['playerBuff', 'buff', 'beneficial'],
    ['neutral', 'buff', 'party-beneficial'],
    ['partyDebuff', 'danger', 'party-harmful'],
    ['neutral', 'neutral', 'neutral'],
  ] as const)('renders %s/%s as %s', (kind, tone, semantic) => {
    const document = renderStatus(createStatus({ kind, tone }))
    expect(document.querySelector(`.status-square--${semantic}`)).not.toBeNull()
  })
})
