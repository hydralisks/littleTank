import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import * as XLSX from 'xlsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BuildRuleDefinition, PassiveTalentDefinition } from '../game/encounter/encounterTypes'
import {
  applyPlayerBuildWorkbookOverrides,
  getPassiveTalentDefinition,
  resetPlayerBuildCatalog,
} from '../game/data/playerBuildCatalog'
import { parsePlayerBuildWorkbook } from '../game/data/workbookLoader'
import { PassiveTalentPanel } from './PassiveTalentPanel'

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

function createTalent(index: number): PassiveTalentDefinition {
  return {
    id: `test_passive_${index}`,
    classId: 'warrior_t',
    name: index === 18 ? '刚毅姿态' : `测试天赋 ${index}`,
    category: index % 3 === 0 ? 'player' : index % 3 === 1 ? 'skill' : 'party',
    cost: 1,
    description: '用于验证较长的被动天赋列表仍然放在可滚动区域内。',
    iconId: 'test_icon',
    talentLogicId: 'test_logic',
    tier: index > 12 ? 2 : 1,
    grantedStatusIds: [],
    enabled: true,
  }
}

describe('PassiveTalentPanel', () => {
  afterEach(() => {
    resetPlayerBuildCatalog()
  })

  it('keeps the passive talent list inside the modal body scroll region', () => {
    const markup = renderToStaticMarkup(
      createElement(PassiveTalentPanel, {
        isOpen: true,
        buildRule: testBuildRule,
        talents: Array.from({ length: 18 }, (_, index) => createTalent(index + 1)),
        selectedPassiveTalentIds: [],
        totalPoints: 20,
        activePoints: 8,
        passivePoints: 0,
        remainingPoints: 12,
        onClose: vi.fn(),
        onToggleTalent: vi.fn(),
        canToggleTalent: () => true,
      }),
    )
    const dom = new JSDOM(markup, { url: 'http://localhost/' })
    const scrollBody = dom.window.document.querySelector('.build-modal__body')
    const talentList = dom.window.document.querySelector('[data-tutorial-id="passive-talent-list"]')

    expect(scrollBody).not.toBeNull()
    expect(scrollBody?.contains(talentList)).toBe(true)
    expect(talentList?.textContent).toContain('刚毅姿态')
  })
  it('uses the granted status icon id when rendering passive talent-related statuses', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(workbook))
    const immortalStance = getPassiveTalentDefinition('warrior_t_immortal_stance')

    if (!immortalStance) {
      throw new Error('Expected current designer workbook to define immortal stance')
    }

    const markup = renderToStaticMarkup(
      createElement(PassiveTalentPanel, {
        isOpen: true,
        buildRule: testBuildRule,
        talents: [immortalStance],
        selectedPassiveTalentIds: [],
        totalPoints: 20,
        activePoints: 8,
        passivePoints: 0,
        remainingPoints: 12,
        onClose: vi.fn(),
        onToggleTalent: vi.fn(),
        canToggleTalent: () => true,
      }),
    )
    const dom = new JSDOM(markup, { url: 'http://localhost/' })
    const statusIcon = dom.window.document.querySelector('.passive-chip .status-square__icon')

    expect(statusIcon?.getAttribute('src')).toBe('/status-icons/immortalStance.svg')
  })
})
