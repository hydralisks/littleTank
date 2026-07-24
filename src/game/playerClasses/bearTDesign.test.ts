import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyPlayerBuildWorkbookOverrides, getActiveSkillCatalog, getDefaultPersistedBuildForRule, getPassiveTalentCatalog, resetPlayerBuildCatalog } from '../data/playerBuildCatalog'
import { parsePlayerBuildWorkbook } from '../data/workbookLoader'
import { getPlayerClassRuntimeDefinition } from './playerClassRuntimeRegistry'
import { hasPlayerSkillRuntime } from '../encounter/playerSkillRuntimeRegistry'
import { hasPassiveTalentLogic } from '../data/playerTalentLogicRegistry'

describe('guardian druid bear tank design contract', () => {
  beforeEach(() => {
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
  })

  afterEach(() => {
    resetPlayerBuildCatalog()
  })

  it('keeps the complete bear class staged for challenge snapshot activation', () => {
    const workbook = parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx'))
    const bear = workbook.classDefinitions.find((entry) => entry.classId === 'druid_bear_t')
    expect(bear).toMatchObject({ classId: 'druid_bear_t', className: '熊T', enabled: false })
    expect(getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t').loadout).toMatchObject({
      '1': 'druid_bear_t_growl',
      '2': 'druid_bear_t_mangle',
      '3': 'druid_bear_t_thrash',
      '4': 'druid_bear_t_skull_bash',
      'Q': 'druid_bear_t_ironfur',
    })
  })

  it('contains sixteen active skills and twenty talents split evenly across tiers', () => {
    const active = getActiveSkillCatalog().filter((entry) => entry.classId === 'druid_bear_t')
    const talents = getPassiveTalentCatalog().filter((entry) => entry.classId === 'druid_bear_t')
    expect(active).toHaveLength(16)
    expect(talents).toHaveLength(20)
    expect(talents.reduce<Record<number, number>>((counts, talent) => {
      counts[talent.tier] = (counts[talent.tier] ?? 0) + 1
      return counts
    }, {})).toEqual({ 0: 5, 1: 5, 2: 5, 3: 5 })
    expect([...active, ...talents].every((entry) => entry.id.startsWith('druid_bear_t_'))).toBe(true)
  })

  it('does not inherit warrior time or damage-taken rage generation', () => {
    expect(getPlayerClassRuntimeDefinition('druid_bear_t').primaryResource).toMatchObject({
      id: 'rage',
      maxResource: 100,
      passiveGainPerSecond: 0,
      damageTakenGainDivisor: 0,
      minimumDamageTakenGain: 0,
    })
  })

  it('registers runtime handlers for every bear skill and talent logic id', () => {
    for (const skill of getActiveSkillCatalog().filter((entry) => entry.classId === 'druid_bear_t')) {
      expect(hasPlayerSkillRuntime(skill.skillLogicId), skill.skillLogicId).toBe(true)
    }
    for (const talent of getPassiveTalentCatalog().filter((entry) => entry.classId === 'druid_bear_t')) {
      expect(hasPassiveTalentLogic(talent.talentLogicId), talent.talentLogicId).toBe(true)
    }
  })

  it('keeps bear talent tuning values in the workbook instead of runtime-only prose', () => {
    const workbook = parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx'))
    const springReturns = workbook.passiveTalentEffectDefinitions.find((entry) => entry.talentId === 'druid_bear_t_spring_returns')
    const guardianStatus = workbook.passiveStatusDefinitions.find((entry) => entry.statusId === 'druid_bear_t_guardian_of_the_grove')

    expect(springReturns).toMatchObject({ valueA: 30, valueB: 5 })
    expect(guardianStatus).toMatchObject({ statusCategory: 'partyBuff', enabled: true })
  })
})
