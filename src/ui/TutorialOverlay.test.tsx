import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { TutorialOverlay } from './TutorialOverlay'
import type { TutorialStep } from './tutorialGuide'

function parseInlinePx(style: string, property: 'left' | 'top') {
  const match = style.match(new RegExp(`${property}: ([0-9.]+)px`))
  return match ? Number(match[1]) : Number.NaN
}

function setGlobalProperty(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

function createHarness() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><div id="target"></div></body></html>', {
    url: 'http://localhost/',
  })
  const { window } = dom
  const container = window.document.getElementById('root')
  const target = window.document.getElementById('target')

  if (!container || !target) {
    throw new Error('Missing test nodes')
  }

  target.setAttribute('data-tutorial-id', 'enemy-frames')
  target.getBoundingClientRect = () =>
    ({
      x: 120,
      y: 180,
      width: 240,
      height: 120,
      top: 180,
      left: 120,
      right: 360,
      bottom: 300,
      toJSON: () => undefined,
    }) as DOMRect

  return { dom, window, container, target }
}

describe('TutorialOverlay', () => {
  it('renders focus, arrow, and controls for the active tutorial step', async () => {
    const { dom, window, container } = createHarness()
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousKeyboardEvent = globalThis.KeyboardEvent
    const previousMouseEvent = globalThis.MouseEvent
    const previousEvent = globalThis.Event
    const previousIsActEnvironment = (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }).IS_REACT_ACT_ENVIRONMENT
    const onNext = vi.fn()
    const onSkip = vi.fn()
    let root: Root | null = null

    setGlobalProperty('window', window)
    setGlobalProperty('document', window.document)
    setGlobalProperty('KeyboardEvent', window.KeyboardEvent)
    setGlobalProperty('MouseEvent', window.MouseEvent)
    setGlobalProperty('Event', window.Event)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

    try {
      root = createRoot(container)
      const step: TutorialStep = {
        id: 'rd1-target-selection',
        title: '选择攻击目标',
        body: '点击敌人框可以选择目标。',
        target: '[data-tutorial-id="enemy-frames"]',
        placement: 'right',
      }

      await act(async () => {
        root!.render(
          createElement(TutorialOverlay, {
            step,
            onNext,
            onSkip,
          }),
        )
      })

      expect(container.querySelector('.tutorial-overlay')).not.toBeNull()
      expect(container.querySelector('.tutorial-overlay__spotlight')).not.toBeNull()
      expect(container.querySelector('.tutorial-overlay__arrow')).not.toBeNull()
      expect(container.querySelector('.tutorial-overlay__title')?.textContent).toContain('选择攻击目标')

      await act(async () => {
        container.querySelector('.tutorial-overlay__next')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        container.querySelector('.tutorial-overlay__skip')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      })

      expect(onNext).toHaveBeenCalledTimes(1)
      expect(onSkip).toHaveBeenCalledTimes(1)
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('KeyboardEvent', previousKeyboardEvent)
      setGlobalProperty('MouseEvent', previousMouseEvent)
      setGlobalProperty('Event', previousEvent)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
      dom.window.close()
    }
  })

  it('returns null when no step is active', async () => {
    const { dom, window, container } = createHarness()
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }).IS_REACT_ACT_ENVIRONMENT
    let root: Root | null = null

    setGlobalProperty('window', window)
    setGlobalProperty('document', window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

    try {
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(TutorialOverlay, { step: null, onNext: vi.fn(), onSkip: vi.fn() }))
      })

      expect(container.innerHTML).toBe('')
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
      dom.window.close()
    }
  })

  it('keeps the tutorial card inside the viewport when the preferred side would overflow', async () => {
    const { dom, window, container, target } = createHarness()
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }).IS_REACT_ACT_ENVIRONMENT
    let root: Root | null = null

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 800,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 520,
    })
    target.getBoundingClientRect = () =>
      ({
        x: 24,
        y: 80,
        width: 620,
        height: 300,
        top: 80,
        left: 24,
        right: 644,
        bottom: 380,
        toJSON: () => undefined,
      }) as DOMRect

    setGlobalProperty('window', window)
    setGlobalProperty('document', window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

    try {
      root = createRoot(container)
      const step: TutorialStep = {
        id: 'rd1-target-selection',
        title: '战斗区域',
        body: '这里是战斗区域。',
        target: '[data-tutorial-id="enemy-frames"]',
        placement: 'right',
      }

      await act(async () => {
        root!.render(createElement(TutorialOverlay, { step, onNext: vi.fn(), onSkip: vi.fn() }))
      })

      const card = container.querySelector('.tutorial-overlay__card') as HTMLElement | null
      const style = card?.getAttribute('style') ?? ''

      expect(style).toContain('left: 416px')
      expect(style).toContain('top: 155px')
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
      dom.window.close()
    }
  })

  it('keeps every tutorial placement inside the viewport near screen edges', async () => {
    const placements: Array<TutorialStep['placement']> = ['right', 'left', 'top', 'bottom', 'center']

    for (const placement of placements) {
      const { dom, window, container, target } = createHarness()
      const previousWindow = globalThis.window
      const previousDocument = globalThis.document
      const previousIsActEnvironment = (globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean
      }).IS_REACT_ACT_ENVIRONMENT
      let root: Root | null = null

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 640,
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 420,
      })
      target.getBoundingClientRect = () =>
        ({
          x: placement === 'left' ? 8 : 420,
          y: placement === 'top' ? 8 : 280,
          width: 190,
          height: 100,
          top: placement === 'top' ? 8 : 280,
          left: placement === 'left' ? 8 : 420,
          right: placement === 'left' ? 198 : 610,
          bottom: placement === 'top' ? 108 : 380,
          toJSON: () => undefined,
        }) as DOMRect

      setGlobalProperty('window', window)
      setGlobalProperty('document', window.document)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

      try {
        root = createRoot(container)
        const step: TutorialStep = {
          id: `edge-${placement}`,
          title: `Edge ${placement}`,
          body: 'Edge placement.',
          target: '[data-tutorial-id="enemy-frames"]',
          placement,
        }

        await act(async () => {
          root!.render(createElement(TutorialOverlay, { step, onNext: vi.fn(), onSkip: vi.fn() }))
        })

        const card = container.querySelector('.tutorial-overlay__card') as HTMLElement | null
        const style = card?.getAttribute('style') ?? ''
        const left = parseInlinePx(style, 'left')
        const top = parseInlinePx(style, 'top')

        expect(left, placement).toBeGreaterThanOrEqual(24)
        expect(left, placement).toBeLessThanOrEqual(256)
        expect(top, placement).toBeGreaterThanOrEqual(24)
        expect(top, placement).toBeLessThanOrEqual(246)
      } finally {
        if (root) {
          await act(async () => {
            root!.unmount()
          })
        }
        setGlobalProperty('window', previousWindow)
        setGlobalProperty('document', previousDocument)
        setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
        dom.window.close()
      }
    }
  })
})
