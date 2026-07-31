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
  selectBestActiveSkillPresenceScenarios,
  type DeltaScenarioResult,
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
    const variants = createPassiveDeltaVariants(stage, 'warrior_t', {
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
    const variants = createPassiveDeltaVariants(stage, 'warrior_t', {
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
      classId: 'warrior_t', stage,
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
    expect(result.classId).toBe('warrior_t')
    expect(result.scenarios.every((scenario) => scenario.classId === 'warrior_t')).toBe(true)
    expect(result.comparisons.every((comparison) => comparison.classId === 'warrior_t')).toBe(true)
    expect(result.scenarios.length).toBeGreaterThan(1)
    expect(result.comparisons.length).toBe(result.scenarios.length - 1)
    expect(result.comparisons.every((comparison) => comparison.confidence)).toBe(true)
    expect(result.comparisons.every((comparison) => comparison.verdict)).toBe(true)
  })

  it('discovers legal Bear talents when no explicit passive list is provided', () => {
    const variants = createPassiveDeltaVariants(getStageById('WestFall-1'), 'druid_bear_t', {
      baseBuildId: 'default',
      includePairs: false,
    })

    const talentIds = variants.flatMap((variant) => variant.build.passiveTalentIds)
    expect(talentIds.some((talentId) => talentId.startsWith('druid_bear_t_'))).toBe(true)
    expect(talentIds.some((talentId) => talentId.startsWith('warrior_t_'))).toBe(false)
  })

  it('compares the best builds containing and excluding each active skill', () => {
    const stage = getStageById('WestFall-1')
    const result = runStageDeltaAnalysis({
      classId: 'druid_bear_t', stage,
      type: 'active',
      attemptsPerScenario: 1,
      seedCount: 1,
      profile: {
        id: 'active-delta-test-profile',
        tier: 'expert',
        reactionDelayMs: 220,
        mistakeRate: 0,
        decisionIntervalMs: 140,
        preserveKeyStopSkills: true,
        evaluateEnemySkillImpact: true,
        preferControlForChanneling: true,
      },
      maxDurationMs: 20_000,
    })

    expect(result.analysisType).toBe('active')
    expect(result.comparisons.length).toBeGreaterThanOrEqual(7)
    for (const comparison of result.comparisons) {
      expect(comparison.activeSkillId).toMatch(/^druid_bear_t_/)
      expect(Object.values(comparison.baselineLoadout ?? {})).not.toContain(comparison.activeSkillId)
      expect(Object.values(comparison.comparedLoadout ?? {})).toContain(comparison.activeSkillId)
    }
  })

  it('selects the highest-pass-rate containing and excluding builds independently', () => {
    const skillId = 'druid_bear_t_mangle'
    const scenario = (
      variantId: string,
      passRate: number,
      loadout: Partial<DeltaScenarioResult['loadout']>,
    ): DeltaScenarioResult => ({
      stageId: 'WestFall-1',
      classId: 'druid_bear_t',
      baselineVariantId: 'candidate_pool',
      variantId,
      variantLabel: variantId,
      variantKind: 'active_candidate',
      attempts: 10,
      victories: Math.round(passRate * 10),
      passRate,
      seedCount: 1,
      passiveTalentIds: [],
      loadout: {
        '1': null,
        '2': null,
        '3': null,
        '4': null,
        Q: null,
        E: null,
        R: null,
        F: null,
        ...loadout,
      },
    })
    const scenarios = [
      scenario('lower_with', 0.4, { '1': skillId }),
      scenario('best_with', 0.8, { '1': skillId, '2': 'druid_bear_t_thrash' }),
      scenario('lower_without', 0.3, { '1': 'druid_bear_t_thrash' }),
      scenario('best_without', 0.7, { '1': 'druid_bear_t_moonfire' }),
    ]

    expect(selectBestActiveSkillPresenceScenarios(scenarios, skillId)).toMatchObject({
      containing: { variantId: 'best_with' },
      excluding: { variantId: 'best_without' },
    })
  })
})
