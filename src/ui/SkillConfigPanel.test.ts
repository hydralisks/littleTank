import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import * as XLSX from 'xlsx'
import type { BuildRuleDefinition, SkillLoadout } from '../game/encounter/encounterTypes'
import {
  applyPlayerBuildWorkbookOverrides,
  getActiveSkillDefinition,
  resetPlayerBuildCatalog,
} from '../game/data/playerBuildCatalog'
import { parsePlayerBuildWorkbook } from '../game/data/workbookLoader'
import { SkillConfigPanel } from './SkillConfigPanel'

const emptyLoadout: SkillLoadout = {
  '1': null,
  '2': null,
  '3': null,
  '4': null,
  Q: null,
  E: null,
  R: null,
  F: null,
}

const testBuildRule: BuildRuleDefinition = {
  buildRuleId: 'test_rule',
  classId: 'warrior_t',
  ruleName: '测试构筑规则',
  description: '',
  totalBuildPoints: 20,
  maxActiveSlots: 5,
  enabledHotkeys: ['1', '2', '3', '4', 'Q'],
  inheritancePolicy: 'keep_active_first',
  enabled: true,
}

describe('SkillConfigPanel', () => {
  afterEach(() => {
    resetPlayerBuildCatalog()
  })

  it('does not render bottom action helper text inside empty hotkey slots', () => {
    const markup = renderToStaticMarkup(
      createElement(SkillConfigPanel, {
        isOpen: true,
        loadout: emptyLoadout,
        selectedHotkey: '1',
        buildRule: testBuildRule,
        activeSkills: [],
        totalPoints: 20,
        activePoints: 0,
        passivePoints: 0,
        remainingPoints: 20,
        onClose: vi.fn(),
        onSelectHotkey: vi.fn(),
        onAssignSkill: vi.fn(),
        onClearHotkey: vi.fn(),
        canAssignToSelectedHotkey: () => true,
      }),
    )
    const dom = new JSDOM(markup, { url: 'http://localhost/' })
    const emptySlot = dom.window.document.querySelector('.loadout-slot.is-empty')

    expect(emptySlot?.querySelector('.loadout-slot__action')).toBeNull()
    expect(emptySlot?.textContent).not.toContain('点击后可尝试解锁')
  })

  it('renders active effect target selectors in skill detail text', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(workbook))
    const revenge = getActiveSkillDefinition('warrior_t_revenge')
    const rallyingCry = getActiveSkillDefinition('warrior_t_rallying_cry')

    if (!revenge || !rallyingCry) {
      throw new Error('Expected current designer workbook to define revenge and rallying cry')
    }

    const markup = renderToStaticMarkup(
      createElement(SkillConfigPanel, {
        isOpen: true,
        loadout: emptyLoadout,
        selectedHotkey: '1',
        buildRule: testBuildRule,
        activeSkills: [revenge, rallyingCry],
        totalPoints: 20,
        activePoints: 0,
        passivePoints: 0,
        remainingPoints: 20,
        onClose: vi.fn(),
        onSelectHotkey: vi.fn(),
        onAssignSkill: vi.fn(),
        onClearHotkey: vi.fn(),
        canAssignToSelectedHotkey: () => true,
      }),
    )
    const dom = new JSDOM(markup, { url: 'http://localhost/' })
    const cardTexts = [...dom.window.document.querySelectorAll('.skill-library-card')]
      .map((card) => card.textContent ?? '')

    expect(cardTexts.find((text) => text.includes('复仇'))).toContain('作用目标：topLeft2x2')
    expect(cardTexts.find((text) => text.includes('集结呐喊'))).toContain('作用目标：self、party')
  })

  it('uses the granted status icon id when rendering skill-related statuses', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(workbook))
    const shieldBlock = getActiveSkillDefinition('warrior_t_shield_block')

    if (!shieldBlock) {
      throw new Error('Expected current designer workbook to define shield block')
    }

    const markup = renderToStaticMarkup(
      createElement(SkillConfigPanel, {
        isOpen: true,
        loadout: emptyLoadout,
        selectedHotkey: '1',
        buildRule: testBuildRule,
        activeSkills: [shieldBlock],
        totalPoints: 20,
        activePoints: 0,
        passivePoints: 0,
        remainingPoints: 20,
        onClose: vi.fn(),
        onSelectHotkey: vi.fn(),
        onAssignSkill: vi.fn(),
        onClearHotkey: vi.fn(),
        canAssignToSelectedHotkey: () => true,
      }),
    )
    const dom = new JSDOM(markup, { url: 'http://localhost/' })
    const statusIcon = dom.window.document.querySelector('.passive-chip .status-square__icon')

    expect(statusIcon?.getAttribute('src')).toBe('/status-icons/shieldBlock.svg')
  })
})
