import { describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { EncounterResultStatsPanel } from './EncounterResultStatsPanel'
import type { EncounterStats } from '../game/encounter/combatStats'

const stats: EncounterStats = {
  durationMs: 5000,
  tankDamageTaken: [],
  pressureGained: [],
  castHandling: [],
  damageDealt: [],
  healingAndAbsorb: [
    {
      id: 'player-heal',
      sourceName: 'Player',
      effectName: 'Player Heal',
      category: 'Player Healing',
      kind: 'healing',
      total: 20,
      count: 1,
      average: 20,
      share: 1,
    },
  ],
  enemyHealingAndAbsorb: [
    {
      id: 'enemy-heal',
      sourceName: 'Enemy Healer',
      effectName: 'Enemy Heal',
      category: 'Enemy Healing',
      kind: 'healing',
      total: 30,
      count: 1,
      average: 30,
      share: 1,
    },
  ],
  absorbConsumed: [],
}

describe('EncounterResultStatsPanel enemy healing page', () => {
  it('shows enemy healing and absorb in a separate tab', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>')
    const container = dom.window.document.getElementById('root')
    if (!container) {
      throw new Error('Missing root')
    }

    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousMouseEvent = globalThis.MouseEvent
    const previousIS_REACT_ACT_ENVIRONMENT = (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }).IS_REACT_ACT_ENVIRONMENT
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: dom.window })
    Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: dom.window.document })
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, writable: true, value: dom.window.HTMLElement })
    Object.defineProperty(globalThis, 'Node', { configurable: true, writable: true, value: dom.window.Node })
    Object.defineProperty(globalThis, 'MouseEvent', { configurable: true, writable: true, value: dom.window.MouseEvent })
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(createElement(EncounterResultStatsPanel, {
          outcome: 'victory',
          stageTitle: 'Test Stage',
          reason: 'Victory',
          stats,
          onReturnToStageSelect: vi.fn(),
          onRetryStage: vi.fn(),
        }))
      })

      const tabs = [...container.querySelectorAll('.result-stats-tabs button')] as HTMLButtonElement[]
      expect(tabs).toHaveLength(6)

      await act(async () => {
        tabs[5].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.textContent).toContain('Enemy Heal')
      expect(container.textContent).toContain('Enemy Healing')
      expect(container.textContent).not.toContain('Player Heal')
    } finally {
      await act(async () => {
        root.unmount()
      })
      Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: previousWindow })
      Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: previousDocument })
      Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, writable: true, value: previousHTMLElement })
      Object.defineProperty(globalThis, 'Node', { configurable: true, writable: true, value: previousNode })
      Object.defineProperty(globalThis, 'MouseEvent', { configurable: true, writable: true, value: previousMouseEvent })
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
        configurable: true,
        writable: true,
        value: previousIS_REACT_ACT_ENVIRONMENT,
      })
      dom.window.close()
    }
  })
})
