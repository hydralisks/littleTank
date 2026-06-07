import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
import * as XLSX from 'xlsx'
import { applyStageWorkbookOverrides, getStageById } from '../game/data/stageTemplates'
import {
  applyPlayerBuildWorkbookOverrides,
  getDefaultPersistedBuildForRule,
  resetPlayerBuildCatalog,
} from '../game/data/playerBuildCatalog'
import type { PersistedBuildState } from '../game/encounter/encounterTypes'
import { parsePlayerBuildWorkbook } from '../game/data/workbookLoader'
import { buildMonsterCodexEntries, getEnemyDefinitionIdsForStage } from '../game/data/monsterCodex'
import { getStageNodeLayout } from './stageSelectMapLayout'
import { StageSelectScreen } from './StageSelectScreen'
import { getStageSelectTutorialScript } from './tutorialGuide'

function setGlobalProperty(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

describe('StageSelectScreen map layout', () => {
  afterEach(() => {
    applyStageWorkbookOverrides({
      areaOverrides: [],
      stageOverrides: [],
      legendOverrides: [],
    })
    resetPlayerBuildCatalog()
  })

  it('places stage nodes by explicit area and order instead of stage id prefix', () => {
    applyStageWorkbookOverrides({
      areaOverrides: [],
      stageOverrides: [
        {
          stageId: 'harbor-1',
          areaId: 'midland',
          order: 4,
        },
      ],
      legendOverrides: [],
    })

    expect(getStageNodeLayout(getStageById('harbor-1'))).toEqual({ x: '52%', y: '41%' })
  })

  it('reuses map layout slots for dynamic workbook area ids', () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'Ringing Deeps' },
        { areaId: 'WestFall', title: 'Westfall' },
        { areaId: 'Highland', title: 'Highland' },
      ],
      stageOverrides: [
        { stageId: 'RingingDeeps-1', areaId: 'RingingDeeps', order: 1 },
        { stageId: 'RingingDeeps-5', areaId: 'RingingDeeps', order: 5 },
        { stageId: 'WestFall-2', areaId: 'WestFall', order: 2 },
        { stageId: 'Highland-6', areaId: 'Highland', order: 6 },
      ],
      legendOverrides: [],
    })

    expect(getStageNodeLayout(getStageById('RingingDeeps-5'))).toEqual({ x: '24%', y: '49%' })
    expect(getStageNodeLayout(getStageById('WestFall-2'))).toEqual({ x: '52%', y: '63%' })
    expect(getStageNodeLayout(getStageById('Highland-6'))).toEqual({ x: '86%', y: '67%' })
  })

  it('renders the stage select screen with dynamic workbook area ids', async () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'Ringing Deeps', shortTitle: 'RD', mapLabel: 'RD', accent: '#abcdef' },
        { areaId: 'WestFall', title: 'Westfall', shortTitle: 'WF', mapLabel: 'WF', accent: '#fedcba' },
        { areaId: 'Highland', title: 'Highland', shortTitle: 'HL', mapLabel: 'HL', accent: '#123456' },
      ],
      stageOverrides: [
        { stageId: 'RingingDeeps-1', areaId: 'RingingDeeps', order: 1 },
        { stageId: 'RingingDeeps-2', areaId: 'RingingDeeps', order: 2 },
        { stageId: 'RingingDeeps-3', areaId: 'RingingDeeps', order: 3 },
        { stageId: 'RingingDeeps-4', areaId: 'RingingDeeps', order: 4 },
        { stageId: 'RingingDeeps-5', areaId: 'RingingDeeps', order: 5 },
        { stageId: 'RingingDeeps-6', areaId: 'RingingDeeps', order: 6 },
        { stageId: 'WestFall-1', areaId: 'WestFall', order: 1 },
        { stageId: 'Highland-1', areaId: 'Highland', order: 1 },
      ],
      legendOverrides: [],
    })

    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'RingingDeeps-5',
          highestClearedStageIndex: 3,
          maxUnlockedStageIndex: 7,
          partyStageId: 'RingingDeeps-5',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_2slot'),
          onStartStage: () => undefined,
        }))
      })

      expect(container.innerHTML).toContain('Ringing Deeps')
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
    }
  })

  it('keeps the enter-stage action inside the map and points at the selected stage', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    const onStartStage = vi.fn()
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'harbor-1',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 1,
          partyStageId: 'harbor-1',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_2slot'),
          onStartStage,
        }))
      })

      const mapAction = container.querySelector('.stage-map > .stage-map__enter-action') as HTMLElement | null
      const selectedArrow = container.querySelector('.stage-map > .stage-map__selected-arrow') as HTMLElement | null
      expect(mapAction).not.toBeNull()
      expect(container.querySelector('.stage-brief > .stage-brief__action')).toBeNull()
      expect(selectedArrow?.style.getPropertyValue('--arrow-from-x')).toBe('50%')
      expect(selectedArrow?.style.getPropertyValue('--arrow-to-x')).toBe('10%')
      expect(selectedArrow?.style.getPropertyValue('--arrow-to-y')).toBe('78%')

      await act(async () => {
        const westfallNode = [...container.querySelectorAll('.stage-node')]
          .find((node) => node.textContent?.includes('2')) as HTMLElement | undefined
        westfallNode?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(selectedArrow?.style.getPropertyValue('--arrow-to-x')).toBe('16%')
      expect(selectedArrow?.style.getPropertyValue('--arrow-to-y')).toBe('68%')

      await act(async () => {
        mapAction?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(onStartStage).toHaveBeenCalledWith('harbor-2')
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

  it('renders affixes and rules in the stage summary but keeps them out of the legend detail', async () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'TestArea', title: 'Test Area', shortTitle: 'TA', mapLabel: 'TA', accent: '#abcdef' },
      ],
      stageOverrides: [
        {
          stageId: 'TestArea-1',
          areaId: 'TestArea',
          order: 1,
          title: 'Stage Info Test',
          subtitle: 'Brief subtitle',
          affix1Title: 'Opening Affix',
          affix1Description: 'Affix description row',
          affix1IconId: 'affix-icon',
          rule1Title: 'Opening Rule',
          rule1Description: 'Rule description row',
          rule1IconId: 'rule-icon',
        },
      ],
      legendOverrides: [
        {
          areaId: 'TestArea',
          id: 'generated-status',
          iconId: 'status-icon',
          label: 'Generated Status',
          source: 'Enemy Skill',
          target: 'Player',
          description: 'Status description row',
        },
      ],
    })

    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'TestArea-1',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 0,
          partyStageId: 'TestArea-1',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_2slot'),
          onStartStage: () => undefined,
        }))
      })

      expect(container.querySelector('.stage-brief__counts')).toBeNull()
      expect(container.querySelector('.stage-brief__info-list')?.textContent).toContain('Opening Affix')
      expect(container.querySelector('.stage-brief__info-list')?.textContent).toContain('Affix description row')
      expect(container.querySelector('.stage-brief__info-list')?.textContent).toContain('Opening Rule')
      expect(container.querySelector('.stage-brief__info-list')?.textContent).toContain('Rule description row')

      await act(async () => {
        const legendButton = container.querySelector('.stage-brief__legend-button') as HTMLElement | null
        legendButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.stage-brief__modal')?.textContent).not.toContain('Opening Affix')
      expect(container.querySelector('.stage-brief__modal')?.textContent).not.toContain('Opening Rule')
      expect(container.querySelector('.stage-brief__modal')?.textContent).toContain('Generated Status')
      expect(container.querySelector('.stage-brief__modal')?.textContent).toContain('Status description row')
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
    }
  })

  it('keeps current build details inside the selected stage build submenu', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'harbor-1',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 0,
          partyStageId: 'harbor-1',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_2slot'),
          onStartStage: () => undefined,
        }))
      })

      expect(container.querySelector('.stage-brief > .stage-brief__section .stage-brief__build-actions')).toBeNull()
      expect(container.querySelector('.stage-brief__build-menu-button')).not.toBeNull()

      await act(async () => {
        const buildButton = container.querySelector('.stage-brief__build-menu-button') as HTMLElement | null
        buildButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      const buildModal = container.querySelector('.stage-brief__modal')
      expect(buildModal?.querySelector('.stage-brief__focus-list')).not.toBeNull()
      expect(buildModal?.querySelector('.stage-brief__build-actions')).not.toBeNull()
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
    }
  })

  it('opens skill and passive build panels from the selected stage build submenu', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'harbor-1',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 0,
          partyStageId: 'harbor-1',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_2slot'),
          onStartStage: () => undefined,
          onBuildChange: () => undefined,
        }))
      })

      await act(async () => {
        const buildButton = container.querySelector('.stage-brief__build-menu-button') as HTMLElement | null
        buildButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.stage-brief__skill-config-button')).not.toBeNull()
      expect(container.querySelector('.stage-brief__passive-config-button')).not.toBeNull()

      await act(async () => {
        const skillButton = container.querySelector('.stage-brief__skill-config-button') as HTMLElement | null
        skillButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      expect(container.querySelector('.build-modal')).not.toBeNull()

      await act(async () => {
        const closeButton = container.querySelector('.build-modal__close') as HTMLElement | null
        closeButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        const buildButton = container.querySelector('.stage-brief__build-menu-button') as HTMLElement | null
        buildButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        const passiveButton = container.querySelector('.stage-brief__passive-config-button') as HTMLElement | null
        passiveButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      expect(container.querySelector('.build-modal')).not.toBeNull()
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
    }
  })

  it('can toggle an unlocked passive talent from the passive build panel', async () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(workbook))

    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    const onBuildChange = vi.fn()
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      const persistedBuild: PersistedBuildState = {
        ...getDefaultPersistedBuildForRule('tutorial_5slot'),
        passiveTalentIds: [],
      }

      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'harbor-4',
          highestClearedStageIndex: 2,
          maxUnlockedStageIndex: 3,
          partyStageId: 'harbor-4',
          persistedBuild,
          onStartStage: () => undefined,
          onBuildChange,
        }))
      })

      await act(async () => {
        const buildButton = container.querySelector('.stage-brief__build-menu-button') as HTMLElement | null
        buildButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        const passiveButton = container.querySelector('.stage-brief__passive-config-button') as HTMLElement | null
        passiveButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      const enabledAction = [...container.querySelectorAll('.passive-talent-card__action')]
        .find((button) => !button.hasAttribute('disabled')) as HTMLElement | undefined

      expect(enabledAction).toBeDefined()
      expect([...container.querySelectorAll('.passive-talent-card__action')]
        .filter((button) => button.hasAttribute('disabled'))).toHaveLength(0)

      await act(async () => {
        enabledAction?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(onBuildChange).toHaveBeenCalledWith(
        expect.objectContaining({
          passiveTalentIds: expect.arrayContaining(['warrior_t_reinforced_plates']),
        }),
        'harbor-4',
      )
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount()
        })
      }
      setGlobalProperty('window', previousWindow)
      setGlobalProperty('document', previousDocument)
      setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', previousIsActEnvironment)
    }
  })

  it('marks RingingDeeps tutorial stages with stage-select tutorial steps', () => {
    expect(getStageSelectTutorialScript({
      id: 'RingingDeeps-2',
      areaId: 'RingingDeeps',
      areaTitle: 'Ringing Deeps',
      stageNumber: 2,
      title: 'RingingDeeps-2',
      subtitle: '',
      affixes: [],
      rules: [],
      legend: [],
      unlockedActiveSkillIds: [],
    })).not.toBeNull()

    expect(getStageSelectTutorialScript({
      id: 'RingingDeeps-4',
      areaId: 'RingingDeeps',
      areaTitle: 'Ringing Deeps',
      stageNumber: 4,
      title: 'RingingDeeps-4',
      subtitle: '',
      affixes: [],
      rules: [],
      legend: [],
      unlockedActiveSkillIds: [],
    })?.map((step) => step.target)).toEqual([
      '[data-tutorial-id="stage-build-menu"]',
      '[data-tutorial-id="stage-passive-config-button"]',
      '[data-tutorial-id="build-points-summary"]',
      '[data-tutorial-id="passive-talent-list"]',
    ])
  })

  it('shows RingingDeeps stage-select tutorial and opens requested build panels', async () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'Ringing Deeps', shortTitle: 'RD', mapLabel: 'RD', accent: '#6fd3ff' },
      ],
      stageOverrides: [
        { stageId: 'RingingDeeps-2', areaId: 'RingingDeeps', order: 2, title: 'RingingDeeps-2' },
      ],
      legendOverrides: [],
    })

    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'RingingDeeps-2',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 0,
          partyStageId: 'RingingDeeps-2',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_3slot'),
          onStartStage: () => undefined,
          onBuildChange: () => undefined,
        }))
      })

      expect(container.querySelector('.tutorial-overlay')?.textContent).toContain('进入本关构筑')
      expect(container.querySelector('[data-tutorial-id="stage-build-menu"]')).not.toBeNull()

      await act(async () => {
        const nextButton = container.querySelector('.tutorial-overlay__next') as HTMLElement | null
        nextButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.stage-brief__modal--build')).not.toBeNull()
      expect(container.querySelector('[data-tutorial-id="stage-skill-config-button"]')).not.toBeNull()

      await act(async () => {
        const nextButton = container.querySelector('.tutorial-overlay__next') as HTMLElement | null
        nextButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.build-modal')).not.toBeNull()
      expect(container.querySelector('[data-tutorial-id="skill-config-slots"]')).not.toBeNull()

      await act(async () => {
        const skipButton = container.querySelector('.tutorial-overlay__skip') as HTMLElement | null
        skipButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.tutorial-overlay')).toBeNull()
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

  it('does not replay a stage-select tutorial that save data has already marked seen', async () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'Ringing Deeps', shortTitle: 'RD', mapLabel: 'RD', accent: '#6fd3ff' },
      ],
      stageOverrides: [
        { stageId: 'RingingDeeps-2', areaId: 'RingingDeeps', order: 2, title: 'RingingDeeps-2' },
      ],
      legendOverrides: [],
    })

    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'RingingDeeps-2',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 0,
          partyStageId: 'RingingDeeps-2',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_3slot'),
          stageSelectTutorialSeenStageIds: ['RingingDeeps-2'],
          onStartStage: () => undefined,
          onBuildChange: () => undefined,
        }))
      })

      expect(container.querySelector('.tutorial-overlay')).toBeNull()
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

  it('allows closing the skill config panel during the RingingDeeps 2 tutorial', async () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'Ringing Deeps', shortTitle: 'RD', mapLabel: 'RD', accent: '#6fd3ff' },
      ],
      stageOverrides: [
        { stageId: 'RingingDeeps-2', areaId: 'RingingDeeps', order: 2, title: 'RingingDeeps-2' },
      ],
      legendOverrides: [],
    })

    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'RingingDeeps-2',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 0,
          partyStageId: 'RingingDeeps-2',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_3slot'),
          onStartStage: () => undefined,
          onBuildChange: () => undefined,
        }))
      })

      await act(async () => {
        const nextButton = container.querySelector('.tutorial-overlay__next') as HTMLElement | null
        nextButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        const nextButton = container.querySelector('.tutorial-overlay__next') as HTMLElement | null
        nextButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.build-modal')).not.toBeNull()

      await act(async () => {
        const closeButton = container.querySelector('.build-modal__close') as HTMLElement | null
        closeButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.querySelector('.build-modal')).toBeNull()
      expect(container.querySelector('.tutorial-overlay')).toBeNull()
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

  it('opens the monster codex from the map header and shows encountered enemies', async () => {
    const seenEnemyDefinitionIds = [getEnemyDefinitionIdsForStage('harbor-4')[0]]
    const firstAppearingStageTitle = buildMonsterCodexEntries(seenEnemyDefinitionIds)[0]?.firstAppearingStage?.title
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'harbor-4',
          highestClearedStageIndex: 3,
          maxUnlockedStageIndex: 3,
          partyStageId: 'harbor-4',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_5slot'),
          seenEnemyDefinitionIds,
          onStartStage: () => undefined,
        }))
      })

      const codexButton = [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('怪物图鉴')) as HTMLElement | undefined
      expect(codexButton).toBeDefined()

      await act(async () => {
        codexButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(container.textContent).toContain('怪物图鉴')
      expect(container.querySelector('.monster-codex')).not.toBeNull()
      expect(container.textContent).toContain(firstAppearingStageTitle ?? '')
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

  it('hides the monster codex until RingingDeeps 2 has been cleared', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'harbor-2',
          highestClearedStageIndex: 0,
          maxUnlockedStageIndex: 2,
          partyStageId: 'harbor-3',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_3slot'),
          seenEnemyDefinitionIds: [getEnemyDefinitionIdsForStage('harbor-2')[0]],
          onStartStage: () => undefined,
        }))
      })

      expect(container.querySelector('[data-tutorial-id="monster-codex-button"]')).toBeNull()
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

  it('shows the monster codex tutorial once the codex unlocks', async () => {
    const seenEnemyDefinitionIds = [getEnemyDefinitionIdsForStage('harbor-4')[0]]
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'http://localhost/',
    })
    const previousWindow = globalThis.window
    const previousDocument = globalThis.document
    const previousIsActEnvironment = (globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT
    setGlobalProperty('window', dom.window)
    setGlobalProperty('document', dom.window.document)
    setGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
    const onMonsterCodexTutorialComplete = vi.fn()
    let root: Root | null = null

    try {
      const container = dom.window.document.getElementById('root')
      if (!container) {
        throw new Error('Missing root container')
      }
      root = createRoot(container)
      await act(async () => {
        root!.render(createElement(StageSelectScreen, {
          defaultSelectedStageId: 'harbor-3',
          highestClearedStageIndex: 1,
          maxUnlockedStageIndex: 2,
          partyStageId: 'harbor-3',
          persistedBuild: getDefaultPersistedBuildForRule('tutorial_3slot'),
          seenEnemyDefinitionIds,
          monsterCodexTutorialSeen: false,
          onMonsterCodexTutorialComplete,
          onStartStage: () => undefined,
        }))
      })

      expect(container.querySelector('[data-tutorial-id="monster-codex-button"]')).not.toBeNull()
      expect(container.textContent).toContain('仇恨逻辑')
      expect(container.textContent).toContain('输出循环')

      await act(async () => {
        const nextButton = container.querySelector('.tutorial-overlay__next') as HTMLElement | null
        nextButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })

      expect(onMonsterCodexTutorialComplete).toHaveBeenCalledTimes(1)
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
})
