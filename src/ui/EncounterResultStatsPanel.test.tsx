import { describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { EncounterResultStatsPanel } from './EncounterResultStatsPanel'
import type { EncounterStats } from '../game/encounter/combatStats'

const emptyStats: EncounterStats = {
  durationMs: 4300,
  tankDamageTaken: [
    {
      id: 'tank',
      sourceName: '测试敌人',
      effectName: '重击',
      category: '敌人技能',
      total: 40,
      count: 2,
      average: 20,
      share: 1,
    },
  ],
  partyDamageTaken: [],
  pressureGained: [],
  castHandling: [
    {
      id: 'cast',
      enemyName: '测试敌人',
      skillName: '火雨',
      dangerLevel: 'high',
      interruptedCount: 0,
      controlledCount: 0,
      completedCount: 1,
      unhandleableCount: 0,
      totalCasts: 1,
      handlerNames: [],
    },
    {
      id: 'murloc-upgrade',
      enemyName: '鱼人吹箭者',
      skillName: '鱼人升级',
      dangerLevel: 'medium',
      interruptedCount: 2,
      controlledCount: 0,
      completedCount: 6,
      unhandleableCount: 0,
      totalCasts: 8,
      handlerNames: ['拳击'],
    },
  ],
  damageDealt: [
    {
      id: 'damage',
      sourceName: '玩家',
      effectName: '盾牌猛击',
      category: '玩家技能伤害',
      total: 30,
      count: 1,
      average: 30,
      share: 1,
    },
  ],
  playerHealingAndAbsorb: [],
  partyHealingAndAbsorb: [],
  healingAndAbsorb: [],
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

describe('EncounterResultStatsPanel', () => {
  it('renders six stat tabs and switches table content', async () => {
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
          stageTitle: '测试关卡',
          reason: '测试胜利',
          stats: emptyStats,
          onReturnToStageSelect: vi.fn(),
          onRetryStage: vi.fn(),
        }))
      })

      expect(container.textContent).toContain('坦克承伤')
      expect(container.textContent).toContain('压力来源')
      expect(container.textContent).toContain('打断情况')
      expect(container.textContent).toContain('造成伤害')
      expect(container.textContent).toContain('治疗/吸收')
      expect(container.textContent).toContain('统计坦克实际受到的伤害')
      expect(container.textContent).toContain('总量 40 伤害，最大来源：重击')

      await act(async () => {
        const damageTab = [...container.querySelectorAll('button')]
          .find((button) => button.textContent === '造成伤害') as HTMLButtonElement
        damageTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.textContent).toContain('盾牌猛击')
      expect(container.textContent).toContain('玩家技能伤害')

      await act(async () => {
        const castTab = [...container.querySelectorAll('button')]
          .find((button) => button.textContent === '打断情况') as HTMLButtonElement
        castTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.textContent).toContain('记录敌方读条是否被打断或控制')
      expect(container.textContent).toContain('高危读条漏处理 1 次')
      expect(container.textContent).toContain('鱼人吹箭者')
      expect(container.textContent).toContain('鱼人升级')
      expect(container.textContent).toContain('2/8')
      expect(container.textContent).toContain('拳击')
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
