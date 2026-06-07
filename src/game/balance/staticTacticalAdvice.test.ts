import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides, createEncounterTemplate } from '../data/encounterTemplates'
import { applyEnemyWorkbookOverrides } from '../data/enemyCatalog'
import { applyPlayerBuildWorkbookOverrides, resetPlayerBuildCatalog } from '../data/playerBuildCatalog'
import { applyStageWorkbookOverrides, getStageById } from '../data/stageTemplates'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../data/workbookLoader'
import {
  getStaticPriorityInterrupts,
  getStaticPriorityKillTargets,
} from './staticTacticalAdvice'

describe('static tactical advice', () => {
  beforeAll(() => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyEnemyWorkbookOverrides(parseEnemyWorkbook(XLSX.readFile('public/designer-data/enemy_data.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
  })

  afterAll(() => {
    applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
    applyEncounterWorkbookOverrides({
      openingOverrides: {},
      placementOverrides: {},
      openingStatusOverrides: {},
      affixBindings: {},
      affixDefinitions: {},
      specialRuleBindings: {},
      specialRuleDefinitions: {},
    })
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
      iconDefinitions: [],
    })
    resetPlayerBuildCatalog()
  })

  it('ranks RD4 injured apprentice before monk as priority kill targets', () => {
    const stage = getStageById('RingingDeeps-4')
    const advice = getStaticPriorityKillTargets(createEncounterTemplate(stage))

    expect(advice.slice(0, 2).map((target) => target.enemyName)).toEqual([
      '受伤的狗头人学徒',
      '狗头人武僧',
    ])
    expect(advice[0].reason).toContain('击杀成本')
  })

  it('ranks RD4 interrupt choices by prevented damage and output-disruption tradeoff', () => {
    const stage = getStageById('RingingDeeps-4')
    const advice = getStaticPriorityInterrupts(createEncounterTemplate(stage))

    expect(advice[0]).toMatchObject({
      enemyName: '受伤的狗头人学徒',
      skillId: 'flame_missiles',
    })
    expect(advice.some((entry) => entry.skillId === 'slow')).toBe(true)
    expect(advice.find((entry) => entry.skillId === 'slow')?.reason).toContain('输出节奏')
  })
})
