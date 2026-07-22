import { describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import {
  getEncounterScreenKeyboardAction,
  handleEncounterScreenKeyDown,
  type EncounterScreenKeyboardSkill,
} from './encounterScreenKeyboard'
import { EncounterScreen } from './EncounterScreen'
import { applyEncounterWorkbookOverrides } from '../game/data/encounterTemplates'
import { getDefaultPersistedBuildForRule } from '../game/data/playerBuildCatalog'
import { getStageById } from '../game/data/stageTemplates'
import type { StageInfo } from '../game/data/stageTemplates'

const testSkills: EncounterScreenKeyboardSkill[] = [
  { hotkey: '1', id: 'warrior_t_taunt' },
  { hotkey: 'Q', id: 'warrior_t_shield_wall' },
]

function createScreenHarness() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  const { window } = dom
  const container = window.document.getElementById('root')

  if (!container) {
    throw new Error('Missing root container in jsdom harness')
  }

  return { dom, window, container }
}

function setGlobalProperty(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

function findSkillCardByHotkey(container: HTMLElement, hotkey: string) {
  return [...container.querySelectorAll('.skill-card')].find((element) =>
    element.querySelector('.skill-key')?.textContent?.includes(hotkey),
  ) as HTMLElement | undefined
}

function makeRingingDeepsStage(stageNumber: StageInfo['stageNumber']): StageInfo {
  return {
    ...getStageById('harbor-1'),
    id: 'harbor-1',
    areaId: 'RingingDeeps',
    areaTitle: 'Ringing Deeps',
    stageNumber,
    title: `RingingDeeps-${stageNumber}`,
  }
}

function countKeydownSubscriptions(calls: unknown[][]) {
  return calls.filter((call) => call[0] === 'keydown').length
}

describe('EncounterScreen keyboard behavior', () => {
  it('queues target cycling with Tab when no panel is open and combat is not paused', () => {
    expect(
      getEncounterScreenKeyboardAction({
        key: 'Tab',
        shiftKey: false,
        openPanel: null,
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'cycle-target',
      direction: 1,
      preventDefault: true,
    })

    expect(
      getEncounterScreenKeyboardAction({
        key: 'Tab',
        shiftKey: true,
        openPanel: null,
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'cycle-target',
      direction: -1,
      preventDefault: true,
    })
  })

  it('queues skill activation for matching hotkeys when no panel is open and combat is not paused', () => {
    expect(
      getEncounterScreenKeyboardAction({
        key: '1',
        shiftKey: false,
        openPanel: null,
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'activate-skill',
      skillId: 'warrior_t_taunt',
      preventDefault: true,
    })

    expect(
      getEncounterScreenKeyboardAction({
        key: 'q',
        shiftKey: false,
        openPanel: null,
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'activate-skill',
      skillId: 'warrior_t_shield_wall',
      preventDefault: true,
    })
  })

  it('suppresses Tab and hotkey game actions while paused', () => {
    expect(
      getEncounterScreenKeyboardAction({
        key: 'Tab',
        shiftKey: false,
        openPanel: null,
        pauseVisible: true,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'noop',
      reason: 'paused',
      preventDefault: false,
    })

    expect(
      getEncounterScreenKeyboardAction({
        key: '1',
        shiftKey: false,
        openPanel: null,
        pauseVisible: true,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'noop',
      reason: 'paused',
      preventDefault: false,
    })
  })

  it('closes panel first, otherwise toggles pause with Escape', () => {
    expect(
      getEncounterScreenKeyboardAction({
        key: 'Escape',
        shiftKey: false,
        openPanel: 'skills',
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'close-panel',
      preventDefault: true,
    })

    expect(
      getEncounterScreenKeyboardAction({
        key: 'Escape',
        shiftKey: false,
        openPanel: null,
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'open-pause',
      preventDefault: true,
    })

    expect(
      getEncounterScreenKeyboardAction({
        key: 'Escape',
        shiftKey: false,
        openPanel: null,
        pauseVisible: true,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'close-pause',
      preventDefault: true,
    })
  })

  it('returns explicit no-op decisions for irrelevant keys and unmatched hotkeys', () => {
    expect(
      getEncounterScreenKeyboardAction({
        key: 'x',
        shiftKey: false,
        openPanel: null,
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'noop',
      reason: 'unhandled-key',
      preventDefault: false,
    })

    expect(
      getEncounterScreenKeyboardAction({
        key: '1',
        shiftKey: false,
        openPanel: 'passives',
        pauseVisible: false,
        skills: testSkills,
      }),
    ).toEqual({
      type: 'noop',
      reason: 'panel-open',
      preventDefault: false,
    })
  })
})

describe('EncounterScreen keydown handling', () => {
  it('prevents default and dispatches target cycling for Tab', () => {
    const preventDefault = vi.fn()
    const closePanel = vi.fn()
    const openPause = vi.fn()
    const closePause = vi.fn()
    const cycleTarget = vi.fn()
    const activateSkill = vi.fn()

    const outcome = handleEncounterScreenKeyDown({
      event: {
        key: 'Tab',
        shiftKey: true,
        preventDefault,
      },
      openPanel: null,
      pauseVisible: false,
      skills: testSkills,
      onClosePanel: closePanel,
      onOpenPause: openPause,
      onClosePause: closePause,
      onCycleTarget: cycleTarget,
      onActivateSkill: activateSkill,
    })

    expect(outcome).toEqual({
      type: 'cycle-target',
      direction: -1,
      preventDefault: true,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(cycleTarget).toHaveBeenCalledWith(-1)
    expect(closePanel).not.toHaveBeenCalled()
    expect(openPause).not.toHaveBeenCalled()
    expect(closePause).not.toHaveBeenCalled()
    expect(activateSkill).not.toHaveBeenCalled()
  })

  it('prevents default and dispatches matching hotkey activations', () => {
    const preventDefault = vi.fn()
    const activateSkill = vi.fn()

    const outcome = handleEncounterScreenKeyDown({
      event: {
        key: 'q',
        shiftKey: false,
        preventDefault,
      },
      openPanel: null,
      pauseVisible: false,
      skills: testSkills,
      onClosePanel: vi.fn(),
      onOpenPause: vi.fn(),
      onClosePause: vi.fn(),
      onCycleTarget: vi.fn(),
      onActivateSkill: activateSkill,
    })

    expect(outcome).toEqual({
      type: 'activate-skill',
      skillId: 'warrior_t_shield_wall',
      preventDefault: true,
    })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(activateSkill).toHaveBeenCalledWith('warrior_t_shield_wall')
  })

  it('reroutes Escape to close panels or toggle pause with preventDefault', () => {
    const closePanel = vi.fn()
    const openPause = vi.fn()
    const closePause = vi.fn()

    const panelOutcome = handleEncounterScreenKeyDown({
      event: {
        key: 'Escape',
        shiftKey: false,
        preventDefault: vi.fn(),
      },
      openPanel: 'skills',
      pauseVisible: false,
      skills: testSkills,
      onClosePanel: closePanel,
      onOpenPause: openPause,
      onClosePause: closePause,
      onCycleTarget: vi.fn(),
      onActivateSkill: vi.fn(),
    })

    const pauseOpenPreventDefault = vi.fn()
    const pauseOpenOutcome = handleEncounterScreenKeyDown({
      event: {
        key: 'Escape',
        shiftKey: false,
        preventDefault: pauseOpenPreventDefault,
      },
      openPanel: null,
      pauseVisible: false,
      skills: testSkills,
      onClosePanel: vi.fn(),
      onOpenPause: openPause,
      onClosePause: closePause,
      onCycleTarget: vi.fn(),
      onActivateSkill: vi.fn(),
    })

    const pauseClosePreventDefault = vi.fn()
    const pauseCloseOutcome = handleEncounterScreenKeyDown({
      event: {
        key: 'Escape',
        shiftKey: false,
        preventDefault: pauseClosePreventDefault,
      },
      openPanel: null,
      pauseVisible: true,
      skills: testSkills,
      onClosePanel: vi.fn(),
      onOpenPause: openPause,
      onClosePause: closePause,
      onCycleTarget: vi.fn(),
      onActivateSkill: vi.fn(),
    })

    expect(panelOutcome.type).toBe('close-panel')
    expect(closePanel).toHaveBeenCalledTimes(1)
    expect(pauseOpenOutcome.type).toBe('open-pause')
    expect(openPause).toHaveBeenCalledTimes(1)
    expect(pauseOpenPreventDefault).toHaveBeenCalledTimes(1)
    expect(pauseCloseOutcome.type).toBe('close-pause')
    expect(closePause).toHaveBeenCalledTimes(1)
    expect(pauseClosePreventDefault).toHaveBeenCalledTimes(1)
  })

  it('blocks paused or panel-open game actions without preventDefault side effects', () => {
    const pausedPreventDefault = vi.fn()
    const pausedCycleTarget = vi.fn()
    const pausedActivateSkill = vi.fn()

    const pausedOutcome = handleEncounterScreenKeyDown({
      event: {
        key: 'Tab',
        shiftKey: false,
        preventDefault: pausedPreventDefault,
      },
      openPanel: null,
      pauseVisible: true,
      skills: testSkills,
      onClosePanel: vi.fn(),
      onOpenPause: vi.fn(),
      onClosePause: vi.fn(),
      onCycleTarget: pausedCycleTarget,
      onActivateSkill: pausedActivateSkill,
    })

    const panelPreventDefault = vi.fn()
    const panelActivateSkill = vi.fn()
    const panelOutcome = handleEncounterScreenKeyDown({
      event: {
        key: '1',
        shiftKey: false,
        preventDefault: panelPreventDefault,
      },
      openPanel: 'passives',
      pauseVisible: false,
      skills: testSkills,
      onClosePanel: vi.fn(),
      onOpenPause: vi.fn(),
      onClosePause: vi.fn(),
      onCycleTarget: vi.fn(),
      onActivateSkill: panelActivateSkill,
    })

    expect(pausedOutcome).toEqual({
      type: 'noop',
      reason: 'paused',
      preventDefault: false,
    })
    expect(pausedPreventDefault).not.toHaveBeenCalled()
    expect(pausedCycleTarget).not.toHaveBeenCalled()
    expect(pausedActivateSkill).not.toHaveBeenCalled()

    expect(panelOutcome).toEqual({
      type: 'noop',
      reason: 'panel-open',
      preventDefault: false,
    })
    expect(panelPreventDefault).not.toHaveBeenCalled()
    expect(panelActivateSkill).not.toHaveBeenCalled()
  })

  it('treats irrelevant keys as no-ops without side effects', () => {
    const preventDefault = vi.fn()
    const closePanel = vi.fn()
    const openPause = vi.fn()
    const closePause = vi.fn()
    const cycleTarget = vi.fn()
    const activateSkill = vi.fn()

    const outcome = handleEncounterScreenKeyDown({
      event: {
        key: 'x',
        shiftKey: false,
        preventDefault,
      },
      openPanel: null,
      pauseVisible: false,
      skills: testSkills,
      onClosePanel: closePanel,
      onOpenPause: openPause,
      onClosePause: closePause,
      onCycleTarget: cycleTarget,
      onActivateSkill: activateSkill,
    })

    expect(outcome).toEqual({
      type: 'noop',
      reason: 'unhandled-key',
      preventDefault: false,
    })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(closePanel).not.toHaveBeenCalled()
    expect(openPause).not.toHaveBeenCalled()
    expect(closePause).not.toHaveBeenCalled()
    expect(cycleTarget).not.toHaveBeenCalled()
    expect(activateSkill).not.toHaveBeenCalled()
  })
})

describe('EncounterScreen component keyboard integration', () => {
  it('clears stale keydown subscription churn across ticks and routes live window events through fresh state', async () => {
    const { dom, window, container } = createScreenHarness()
    const globalWithReactAct = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousKeyboardEvent = globalThis.KeyboardEvent
    const previousMouseEvent = globalThis.MouseEvent
    const previousEvent = globalThis.Event
    const previousIS_REACT_ACT_ENVIRONMENT = globalWithReactAct.IS_REACT_ACT_ENVIRONMENT
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const onBuildChange = vi.fn()
    const onReturnToStageSelect = vi.fn()
    const onRetryStage = vi.fn()
    const onAdvanceStage = vi.fn()
    const stage = getStageById('harbor-1')
    const buildState = getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t')
    let root: Root | null = null

    vi.useFakeTimers()

    setGlobalProperty('window', window as typeof globalThis.window)
    setGlobalProperty('document', window.document)
    setGlobalProperty('navigator', window.navigator)
    setGlobalProperty('HTMLElement', window.HTMLElement)
    setGlobalProperty('Node', window.Node)
    setGlobalProperty('KeyboardEvent', window.KeyboardEvent)
    setGlobalProperty('MouseEvent', window.MouseEvent)
    setGlobalProperty('Event', window.Event)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

    try {
      root = createRoot(container)

      await act(async () => {
        root!.render(
          createElement(EncounterScreen, {
            stage,
            classId: 'warrior_t',
            buildState,
            unlockedPassiveTalentTier: 3,
            unlockedActiveSkillIds: Object.values(buildState.loadout).filter((skillId): skillId is string => Boolean(skillId)),
            onBuildChange,
            onReturnToStageSelect,
            onRetryStage,
            onAdvanceStage,
          }),
        )
      })

      const keydownAddsAfterMount = countKeydownSubscriptions(addEventListenerSpy.mock.calls)
      const keydownRemovesAfterMount = countKeydownSubscriptions(removeEventListenerSpy.mock.calls)
      expect(keydownAddsAfterMount).toBeGreaterThanOrEqual(1)

      await act(async () => {
        vi.advanceTimersByTime(300)
      })

      const keydownAddsAfterTicks = countKeydownSubscriptions(addEventListenerSpy.mock.calls)
      const keydownRemovesAfterTicks = countKeydownSubscriptions(removeEventListenerSpy.mock.calls)

      expect(keydownAddsAfterTicks).toBe(keydownAddsAfterMount)
      expect(keydownRemovesAfterTicks).toBe(keydownRemovesAfterMount)
      expect(container.querySelector('.result-overlay--pause')).toBeNull()

      await act(async () => {
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(container.querySelector('.result-overlay--pause')).not.toBeNull()

      await act(async () => {
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab' }))
      })

      expect(container.querySelector('.result-overlay--pause')).not.toBeNull()

      await act(async () => {
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(container.querySelector('.result-overlay--pause')).toBeNull()

      await act(async () => {
        const firstEnemyFrame = container.querySelector('.enemy-frame[data-enemy-id]') as HTMLElement | null
        firstEnemyFrame?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        vi.advanceTimersByTime(100)
      })

      await act(async () => {
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: '1' }))
      })

      const hotkeyOneCardBeforeFlush = findSkillCardByHotkey(container, '1')

      expect(hotkeyOneCardBeforeFlush).toBeDefined()
      expect(hotkeyOneCardBeforeFlush?.className.includes('is-cooling')).toBe(false)
      expect(hotkeyOneCardBeforeFlush?.querySelector('.skill-icon-timer')).toBeNull()

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      const hotkeyOneCardAfterFlush = findSkillCardByHotkey(container, '1')

      expect(container.querySelector('.result-overlay--pause')).toBeNull()
      expect(hotkeyOneCardAfterFlush).toBeDefined()
      expect(hotkeyOneCardAfterFlush?.className.includes('is-cooling')).toBe(true)
      expect(hotkeyOneCardAfterFlush?.querySelector('.skill-icon-timer')?.textContent).toMatch(/\d/)
    } finally {
      const rootToUnmount = root

      if (rootToUnmount) {
        await act(async () => {
          rootToUnmount.unmount()
        })
      }

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
      vi.useRealTimers()
      dom.window.close()
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('navigator', previousNavigator)
      setGlobalProperty('HTMLElement', previousHTMLElement)
      setGlobalProperty('Node', previousNode)
      setGlobalProperty('KeyboardEvent', previousKeyboardEvent)
      setGlobalProperty('MouseEvent', previousMouseEvent)
      setGlobalProperty('Event', previousEvent)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIS_REACT_ACT_ENVIRONMENT)
    }
  })

  it('shows RingingDeeps combat tutorial and pauses encounter ticks until skipped', async () => {
    const { dom, window, container } = createScreenHarness()
    const globalWithReactAct = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousKeyboardEvent = globalThis.KeyboardEvent
    const previousMouseEvent = globalThis.MouseEvent
    const previousEvent = globalThis.Event
    const previousIS_REACT_ACT_ENVIRONMENT = globalWithReactAct.IS_REACT_ACT_ENVIRONMENT
    const stage = makeRingingDeepsStage(1)
    const buildState = getDefaultPersistedBuildForRule('tutorial_2slot', 'warrior_t')
    let root: Root | null = null

    vi.useFakeTimers()

    setGlobalProperty('window', window as typeof globalThis.window)
    setGlobalProperty('document', window.document)
    setGlobalProperty('navigator', window.navigator)
    setGlobalProperty('HTMLElement', window.HTMLElement)
    setGlobalProperty('Node', window.Node)
    setGlobalProperty('KeyboardEvent', window.KeyboardEvent)
    setGlobalProperty('MouseEvent', window.MouseEvent)
    setGlobalProperty('Event', window.Event)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

    try {
      root = createRoot(container)

      await act(async () => {
        root!.render(
          createElement(EncounterScreen, {
            stage,
            classId: 'warrior_t',
            buildState,
            unlockedPassiveTalentTier: 0,
            unlockedActiveSkillIds: Object.values(buildState.loadout).filter((skillId): skillId is string => Boolean(skillId)),
            onBuildChange: vi.fn(),
            onReturnToStageSelect: vi.fn(),
            onRetryStage: vi.fn(),
            onAdvanceStage: vi.fn(),
          }),
        )
      })

      expect(container.querySelector('.tutorial-overlay')?.textContent).toContain('选择攻击目标')
      expect(container.querySelector('[data-tutorial-id="enemy-frames"]')).not.toBeNull()
      expect(container.querySelector('[data-tutorial-id="skill-bar"]')).not.toBeNull()
      expect(container.querySelector('[data-tutorial-id="team-status"]')).not.toBeNull()
      expect(container.querySelector('.header-chip--time')?.textContent).toContain('0.0s')

      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      expect(container.querySelector('.header-chip--time')?.textContent).toContain('0.0s')

      await act(async () => {
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
      })

      expect(container.querySelector('.result-overlay--pause')).toBeNull()

      await act(async () => {
        const skipButton = container.querySelector('.tutorial-overlay__skip') as HTMLElement | null
        skipButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.tutorial-overlay')).toBeNull()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(container.querySelector('.header-chip--time')?.textContent).toContain('0.2s')
    } finally {
      const rootToUnmount = root

      if (rootToUnmount) {
        await act(async () => {
          rootToUnmount.unmount()
        })
      }

      vi.useRealTimers()
      dom.window.close()
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('navigator', previousNavigator)
      setGlobalProperty('HTMLElement', previousHTMLElement)
      setGlobalProperty('Node', previousNode)
      setGlobalProperty('KeyboardEvent', previousKeyboardEvent)
      setGlobalProperty('MouseEvent', previousMouseEvent)
      setGlobalProperty('Event', previousEvent)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIS_REACT_ACT_ENVIRONMENT)
    }
  })

  it('does not show combat tutorial when save data has already marked it seen', async () => {
    const { dom, window, container } = createScreenHarness()
    const globalWithReactAct = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousKeyboardEvent = globalThis.KeyboardEvent
    const previousMouseEvent = globalThis.MouseEvent
    const previousEvent = globalThis.Event
    const previousIS_REACT_ACT_ENVIRONMENT = globalWithReactAct.IS_REACT_ACT_ENVIRONMENT
    const stage = makeRingingDeepsStage(1)
    const buildState = getDefaultPersistedBuildForRule('tutorial_2slot', 'warrior_t')
    let root: Root | null = null

    setGlobalProperty('window', window as typeof globalThis.window)
    setGlobalProperty('document', window.document)
    setGlobalProperty('navigator', window.navigator)
    setGlobalProperty('HTMLElement', window.HTMLElement)
    setGlobalProperty('Node', window.Node)
    setGlobalProperty('KeyboardEvent', window.KeyboardEvent)
    setGlobalProperty('MouseEvent', window.MouseEvent)
    setGlobalProperty('Event', window.Event)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

    try {
      root = createRoot(container)

      await act(async () => {
        root!.render(
          createElement(EncounterScreen, {
            stage,
            classId: 'warrior_t',
            buildState,
            unlockedPassiveTalentTier: 0,
            unlockedActiveSkillIds: Object.values(buildState.loadout).filter((skillId): skillId is string => Boolean(skillId)),
            tutorialEnabled: false,
            onBuildChange: vi.fn(),
            onReturnToStageSelect: vi.fn(),
            onRetryStage: vi.fn(),
            onAdvanceStage: vi.fn(),
          }),
        )
      })

      expect(container.querySelector('.tutorial-overlay')).toBeNull()
    } finally {
      const rootToUnmount = root

      if (rootToUnmount) {
        await act(async () => {
          rootToUnmount.unmount()
        })
      }

      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('navigator', previousNavigator)
      setGlobalProperty('HTMLElement', previousHTMLElement)
      setGlobalProperty('Node', previousNode)
      setGlobalProperty('KeyboardEvent', previousKeyboardEvent)
      setGlobalProperty('MouseEvent', previousMouseEvent)
      setGlobalProperty('Event', previousEvent)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIS_REACT_ACT_ENVIRONMENT)
      dom.window.close()
    }
  })

  it('returns to the map from victory without offering an alternate victory button', async () => {
    applyEncounterWorkbookOverrides({
      openingOverrides: {},
      placementOverrides: {
        'harbor-1': [
          {
            stageId: 'harbor-1',
            spawnId: 'harbor-1-test-defeated',
            enemyId: 'harbor_raider',
            row: 1,
            col: 1,
            hpOverride: 0,
            maxHpOverride: 100,
          },
        ],
      },
      openingStatusOverrides: {},
      affixBindings: {},
      affixDefinitions: {},
      specialRuleBindings: {},
      specialRuleDefinitions: {},
    })

    const { dom, window, container } = createScreenHarness()
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousNavigator = globalThis.navigator
    const previousHTMLElement = globalThis.HTMLElement
    const previousNode = globalThis.Node
    const previousKeyboardEvent = globalThis.KeyboardEvent
    const previousMouseEvent = globalThis.MouseEvent
    const previousEvent = globalThis.Event
    const previousIS_REACT_ACT_ENVIRONMENT = (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean
    }).IS_REACT_ACT_ENVIRONMENT
    const onBuildChange = vi.fn()
    const onReturnToStageSelect = vi.fn()
    const onRetryStage = vi.fn()
    const onAdvanceStage = vi.fn()
    const stage = getStageById('harbor-1')
    const buildState = getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t')
    let root: Root | null = null

    vi.useFakeTimers()

    setGlobalProperty('window', window as typeof globalThis.window)
    setGlobalProperty('document', window.document)
    setGlobalProperty('navigator', window.navigator)
    setGlobalProperty('HTMLElement', window.HTMLElement)
    setGlobalProperty('Node', window.Node)
    setGlobalProperty('KeyboardEvent', window.KeyboardEvent)
    setGlobalProperty('MouseEvent', window.MouseEvent)
    setGlobalProperty('Event', window.Event)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)

    try {
      root = createRoot(container)
      await act(async () => {
        root!.render(
          createElement(EncounterScreen, {
            stage,
            classId: 'warrior_t',
            buildState,
            unlockedPassiveTalentTier: 3,
            unlockedActiveSkillIds: Object.values(buildState.loadout).filter((skillId): skillId is string => Boolean(skillId)),
            onBuildChange,
            onReturnToStageSelect,
            onRetryStage,
            onAdvanceStage,
          }),
        )
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(container.querySelectorAll('.result-action').length).toBe(1)
      expect(container.querySelector('.result-action__title')?.textContent).toBe('简单简单')

      await act(async () => {
        const victoryButton = container.querySelector('.result-action') as HTMLElement | null
        victoryButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      })

      expect(onReturnToStageSelect).toHaveBeenCalledWith('victory')
      expect(onAdvanceStage).not.toHaveBeenCalled()
      expect(onRetryStage).not.toHaveBeenCalled()
      expect(container.textContent).not.toContain('算他厉害')
    } finally {
      applyEncounterWorkbookOverrides({
        openingOverrides: {},
        placementOverrides: {},
        openingStatusOverrides: {},
        affixBindings: {},
        affixDefinitions: {},
        specialRuleBindings: {},
        specialRuleDefinitions: {},
      })
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('navigator', previousNavigator)
      setGlobalProperty('HTMLElement', previousHTMLElement)
      setGlobalProperty('Node', previousNode)
      setGlobalProperty('KeyboardEvent', previousKeyboardEvent)
      setGlobalProperty('MouseEvent', previousMouseEvent)
      setGlobalProperty('Event', previousEvent)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIS_REACT_ACT_ENVIRONMENT)
      vi.useRealTimers()
      dom.window.close()
    }
  })
})
