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
  classifyStaticDifficulty,
  scoreStageStaticDifficulty,
} from './staticStageScoring'

describe('static stage scoring', () => {
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

  it('produces a deterministic read-only numeric score and label from stage data', () => {
    const stage = getStageById('RingingDeeps-1')
    const result = scoreStageStaticDifficulty(stage)

    expect(result.stageId).toBe(stage.id)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.label).not.toBe('invalid_data')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('raises score when enemy output is much larger than player and party pressure budgets', () => {
    const stage = getStageById('RingingDeeps-1')
    const template = createEncounterTemplate(stage)
    const inflated = {
      ...template,
      enemies: template.enemies.map((enemy) => ({
        ...enemy,
        skillCycle: ['crusher-slam', 'ruin-volley'],
      })),
    }

    const baseline = scoreStageStaticDifficulty(stage, template)
    const harder = scoreStageStaticDifficulty(stage, inflated)

    expect(harder.score).toBeGreaterThan(baseline.score)
  })

  it('maps static scores to ordered difficulty labels', () => {
    expect(classifyStaticDifficulty(12)).toBe('trivial')
    expect(classifyStaticDifficulty(35)).toBe('balanced')
    expect(classifyStaticDifficulty(65)).toBe('expert')
    expect(classifyStaticDifficulty(90)).toBe('near_impossible')
  })

  it('accounts for encounter structure beyond average cast risk', () => {
    const stage = getStageById('RingingDeeps-1')
    const template = createEncounterTemplate(stage)
    const compactTwoEnemyTemplate = {
      ...template,
      enemies: template.enemies.slice(0, 2).map((enemy) => ({
        ...enemy,
        maxHp: 180,
        skillCycle: ['trash-toss'],
      })),
    }
    const wideFourEnemyTemplate = {
      ...template,
      enemies: template.enemies.slice(0, 2).flatMap((enemy, index) => [
        {
          ...enemy,
          id: `${enemy.id}-a`,
          maxHp: 90,
          skillCycle: index === 0 ? ['trash-toss', 'quick-stab'] : ['trash-toss'],
        },
        {
          ...enemy,
          id: `${enemy.id}-b`,
          maxHp: 90,
          skillCycle: index === 0 ? ['trash-toss'] : ['trash-toss', 'quick-stab'],
        },
      ]),
    }

    const compact = scoreStageStaticDifficulty(stage, compactTwoEnemyTemplate)
    const wide = scoreStageStaticDifficulty(stage, wideFourEnemyTemplate)

    expect(wide.metrics.targetComplexityRisk).toBeGreaterThan(compact.metrics.targetComplexityRisk)
    expect(wide.metrics.operationLoadRisk).toBeGreaterThan(compact.metrics.operationLoadRisk)
    expect(wide.score).toBeGreaterThan(compact.score)
  })

  it('exposes V3 raw, answerable, mitigation, support, and adjusted static score components', () => {
    const stage = getStageById('WestFall-3')
    const result = scoreStageStaticDifficulty(stage)

    expect(result.metrics.rawThreatScore).toBeGreaterThan(0)
    expect(result.metrics.unavoidablePressureScore).toBeGreaterThan(0)
    expect(result.metrics.answerablePressureScore).toBeGreaterThan(0)
    expect(result.metrics.toolMitigationScore).toBeGreaterThan(0)
    expect(result.metrics.enemySupportRisk).toBeGreaterThan(result.metrics.effectiveSupportRisk)
    expect(result.metrics.effectiveSupportRisk).toBeGreaterThan(0)
    expect(result.metrics.executionComplexityScore).toBeGreaterThan(0)
    expect(result.metrics.adjustedThreatScore).toBe(result.score)
    expect(result.reasons.some((reason) => reason.includes('可处理压力'))).toBe(true)
  })

  it('discounts interruptible mostInjured support risk below guaranteed full healing', () => {
    const stage = getStageById('WestFall-3')
    const template = createEncounterTemplate(stage)
    const supportScore = scoreStageStaticDifficulty(stage, {
      ...template,
      enemies: template.enemies.map((enemy) =>
        enemy.definitionId === 'coldlight_seer'
          ? {
              ...enemy,
              skillIds: ['murloc_heal'],
              skillCycle: ['murloc_heal'],
            }
          : {
              ...enemy,
              skillIds: [],
              skillCycle: [],
            },
      ),
    })

    expect(supportScore.metrics.enemySupportRisk).toBeGreaterThan(0)
    expect(supportScore.metrics.effectiveSupportRisk).toBeGreaterThan(0)
    expect(supportScore.metrics.enemySupportRisk).toBeGreaterThan(supportScore.metrics.effectiveSupportRisk)
    expect(supportScore.metrics.effectiveSupportRisk).toBeLessThan(20)
  })

  it('keeps RingingDeeps static labels in the same rough band as manual baselines', () => {
    expect(scoreStageStaticDifficulty(getStageById('RingingDeeps-3')).label).toBe('hard')
    expect(scoreStageStaticDifficulty(getStageById('RingingDeeps-4')).label).toBe('hard')
    expect(scoreStageStaticDifficulty(getStageById('RingingDeeps-5')).label).toBe('balanced')
    expect(scoreStageStaticDifficulty(getStageById('RingingDeeps-6')).label).toBe('expert')
  })

  it('calibrates WestFall first three static labels against manual playtest baselines', () => {
    expect(scoreStageStaticDifficulty(getStageById('WestFall-1')).label).toBe('easy')
    expect(scoreStageStaticDifficulty(getStageById('WestFall-2')).label).toBe('balanced')
    expect(scoreStageStaticDifficulty(getStageById('WestFall-3')).label).toBe('balanced')
  })
})
