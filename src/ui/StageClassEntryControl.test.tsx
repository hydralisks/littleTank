import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { StageClassEntryControl } from './StageClassEntryControl'

describe('StageClassEntryControl', () => {
  it('reserves 12 vertical-first slots and selects or enters with the chosen class', async () => {
    const dom = new JSDOM('<div id="root"></div>')
    const globalScope = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousActEnvironment = globalScope.IS_REACT_ACT_ENVIRONMENT
    Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
    Object.defineProperty(globalScope, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
    const onSelectClass = vi.fn()
    const onEnter = vi.fn()
    const root = createRoot(dom.window.document.getElementById('root')!)

    try {
      await act(async () => root.render(createElement(StageClassEntryControl, {
        classes: [
          { classId: 'warrior_t', className: '战士T', buttonIconKey: 'sword', cleared: true },
          { classId: 'druid_bear_t', className: '熊T', buttonIconKey: 'paw-print', cleared: false },
          { classId: 'dk_blood_t', className: '死亡骑士T', buttonIconKey: 'droplets', cleared: false },
          { classId: 'fourth_t', className: '第四职业', buttonIconKey: 'shield', cleared: false },
        ],
        selectedClassId: 'warrior_t',
        disabled: false,
        onSelectClass,
        onEnter,
      })))

      const slots = [...dom.window.document.querySelectorAll('.stage-class-entry__slot')]
      expect(slots).toHaveLength(12)
      expect(slots.slice(0, 4).map((slot) => slot.getAttribute('data-class-id'))).toEqual([
        'warrior_t', 'druid_bear_t', 'dk_blood_t', 'fourth_t',
      ])
      expect(dom.window.document.querySelector('[data-class-id="warrior_t"] .stage-class-entry__check')).not.toBeNull()
      expect(dom.window.document.querySelector('.stage-class-entry__enter')?.textContent).toBe('战士T 进入这一关')

      await act(async () => {
        dom.window.document.querySelector<HTMLElement>('[data-class-id="druid_bear_t"]')
          ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      expect(onSelectClass).toHaveBeenCalledWith('druid_bear_t')

      await act(async () => {
        dom.window.document.querySelector<HTMLElement>('.stage-class-entry__enter')
          ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      expect(onEnter).toHaveBeenCalledOnce()
    } finally {
      await act(async () => root.unmount())
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow })
      Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument })
      Object.defineProperty(globalScope, 'IS_REACT_ACT_ENVIRONMENT', {
        configurable: true,
        value: previousActEnvironment,
      })
      dom.window.close()
    }
  })
})
