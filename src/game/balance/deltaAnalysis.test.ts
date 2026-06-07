import { beforeAll, describe, expect, it } from 'vitest'
import XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides } from '../data/encounterTemplates'
import { applyEnemyWorkbookOverrides } from '../data/enemyCatalog'
import { applyPlayerBuildWorkbookOverrides } from '../data/playerBuildCatalog'
import { applyStageWorkbookOverrides, getStageById } from '../data/stageTemplates'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../data/workbookLoader'
import {
  createPassiveDeltaVariants,
  runStageDeltaAnalysis,
} from './deltaAnalysis'

beforeAll(() => {
  applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
  applyEnemyWorkbookOverrides(parseEnemyWorkbook(XLSX.readFile('public/designer-data/enemy_data.xlsx')))
  applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
})

describe('delta analysis', () => {
  it('creates passive variants while preserving active loadout', () => {
    const stage = getStageById('WestFall-2')
    const variants = createPassiveDeltaVariants(stage, {
      baseBuildId: 'default',
      talentIds: ['warrior_t_raise_banner', 'warrior_t_barbaric_training', 'warrior_t_focused_vigor'],
      includePairs: true,
    })

    const baseline = variants.find((variant) => variant.kind === 'baseline')
    expect(baseline).toBeTruthy()
    expect(variants.some((variant) => variant.id.includes('warrior_t_raise_banner'))).toBe(true)
    expect(variants.some((variant) => variant.id.includes('warrior_t_barbaric_training'))).toBe(true)
    expect(variants.some((variant) => variant.id.includes('warrior_t_focused_vigor'))).toBe(true)
    expect(variants.some((variant) => variant.id.includes('warrior_t_raise_banner+warrior_t_barbaric_training'))).toBe(true)
    expect(new Set(variants.map((variant) => JSON.stringify(variant.build.loadout))).size).toBe(1)
  })

  it('accepts an explicit base build for focused delta comparisons', () => {
    const stage = getStageById('WestFall-2')
    const variants = createPassiveDeltaVariants(stage, {
      baseBuild: {
        loadout: {
          '1': 'warrior_t_interrupt',
          '2': 'warrior_t_revenge',
          '3': 'warrior_t_ignore_pain',
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: ['warrior_t_raise_banner', 'warrior_t_barbaric_training'],
      },
      talentIds: ['warrior_t_raise_banner'],
      includePairs: false,
    })

    expect(variants[0].build.loadout['1']).toBe('warrior_t_interrupt')
    expect(variants[0].build.loadout['2']).toBe('warrior_t_revenge')
    expect(variants[0].build.loadout['3']).toBe('warrior_t_ignore_pain')
    expect(variants[0].build.passiveTalentIds).toEqual([])
  })

  it('runs a small passive delta analysis with confidence and comparisons', () => {
    const stage = getStageById('WestFall-2')
    const result = runStageDeltaAnalysis({
      stage,
      type: 'passive',
      baseBuildId: 'default',
      talentIds: ['warrior_t_raise_banner', 'warrior_t_barbaric_training'],
      includePairs: true,
      attemptsPerScenario: 1,
      seedCount: 1,
      profile: {
        id: 'delta-test-profile',
        tier: 'average',
        reactionDelayMs: 250,
        mistakeRate: 0,
        decisionIntervalMs: 150,
        preserveKeyStopSkills: true,
        evaluateEnemySkillImpact: true,
        preferControlForChanneling: true,
      },
      maxDurationMs: 20_000,
    })

    expect(result.stageId).toBe('WestFall-2')
    expect(result.scenarios.length).toBeGreaterThan(1)
    expect(result.comparisons.length).toBe(result.scenarios.length - 1)
    expect(result.comparisons.every((comparison) => comparison.confidence)).toBe(true)
    expect(result.comparisons.every((comparison) => comparison.verdict)).toBe(true)
  })
})
