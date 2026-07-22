import { afterEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  canUseSkillInRule,
  canUseTalentInRule,
  getActivePointCost,
  getActiveSkillDefinition,
  getBuildRuleDefinition,
  getRemainingBuildPoints,
  getDefaultPersistedBuildForRule,
  getPassiveTalentDefinition,
  normalizePersistedBuildForRule,
  applyPlayerBuildWorkbookOverrides,
  resetPlayerBuildCatalog,
} from '../data/playerBuildCatalog'
import { parsePlayerBuildWorkbook, parseStageWorkbook } from '../data/workbookLoader'
import {
  applyStageWorkbookOverrides,
  getPassiveTalentUnlockTierForStage,
  getStageById,
  getUnlockedActiveSkillIdsForStage,
} from '../data/stageTemplates'
import {
  generateStageBalanceBuilds,
  generateStrategyTipBuildCandidates,
  getBuildSignature,
} from './balanceBuildGenerator'

describe('balance build generator', () => {
  afterEach(() => {
    resetPlayerBuildCatalog()
    applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
  })
  it('generates only builds owned by the requested class', () => {
    const stage = getStageById('harbor-4')
    const variants = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 4,
      maxPassiveVariants: 2,
    })

    expect(variants.length).toBeGreaterThan(0)
    expect(variants.every((variant) => variant.classId === 'warrior_t')).toBe(true)
    for (const variant of variants) {
      expect(Object.values(variant.build.loadout).filter(Boolean).every(
        (skillId) => getActiveSkillDefinition(skillId!)?.classId === 'warrior_t',
      )).toBe(true)
      expect(variant.build.passiveTalentIds.every(
        (talentId) => getPassiveTalentDefinition(talentId)?.classId === 'warrior_t',
      )).toBe(true)
    }
  })
  it('includes the normalized default build first', () => {
    const stage = getStageById('harbor-4')
    const buildRuleId = getStageBuildRuleId(stage)
    const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
    const passiveTier = getPassiveTalentUnlockTierForStage(stage)
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 8,
      maxPassiveVariants: 4,
    })

    expect(builds[0].id).toBe('default')
    expect(builds[0].build).toEqual(
      normalizePersistedBuildForRule(
        getDefaultPersistedBuildForRule(buildRuleId, 'warrior_t'),
        buildRuleId, 'warrior_t',
        passiveTier,
        unlockedSkillIds,
        stage.unlockedActiveSkillIds,
      ).build,
    )
  })

  it('generates only legal active skills, enabled hotkeys, passive tiers, and point totals', () => {
    const stage = getStageById('harbor-6')
    const buildRuleId = getStageBuildRuleId(stage)
    const rule = getBuildRuleDefinition(buildRuleId)
    const unlockedSkillIds = getUnlockedActiveSkillIdsForStage(stage)
    const passiveTier = getPassiveTalentUnlockTierForStage(stage)
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 20,
      maxPassiveVariants: 8,
    })

    expect(rule).toBeDefined()
    expect(builds.length).toBeGreaterThan(1)
    expect(builds.some((variant) => variant.build.passiveTalentIds.length > 0)).toBe(true)

    for (const variant of builds) {
      const activeSkills = Object.entries(variant.build.loadout)
        .filter(([, skillId]) => Boolean(skillId))
      expect(activeSkills.length).toBeLessThanOrEqual(rule!.maxActiveSlots)
      expect(getActivePointCost(variant.build.loadout)).toBeLessThanOrEqual(rule!.totalBuildPoints)
      expect(getRemainingBuildPoints(buildRuleId, variant.build.loadout, variant.build.passiveTalentIds)).toBeGreaterThanOrEqual(0)

      for (const [hotkey, skillId] of activeSkills) {
        expect(rule!.enabledHotkeys).toContain(hotkey)
        expect(canUseSkillInRule(buildRuleId, 'warrior_t', skillId!, unlockedSkillIds)).toBe(true)
      }

      for (const talentId of variant.build.passiveTalentIds) {
        expect(canUseTalentInRule(buildRuleId, 'warrior_t', talentId, passiveTier)).toBe(true)
      }
    }
  })

  it('keeps active-only candidates before passive talents unlock', () => {
    const stage = getStageById('harbor-3')
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 12,
      maxPassiveVariants: 4,
    })

    expect(getPassiveTalentUnlockTierForStage(stage)).toBe(-1)
    expect(builds.length).toBeGreaterThan(1)
    expect(builds.some((variant) => variant.id !== 'default' && variant.build.passiveTalentIds.length === 0)).toBe(true)
  })

  it('deduplicates builds by stable normalized signature', () => {
    const stage = getStageById('harbor-6')
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 30,
      maxPassiveVariants: 8,
    })
    const signatures = builds.map((variant) => getBuildSignature(variant.build))

    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('respects active and passive generation caps while preserving default', () => {
    const stage = getStageById('harbor-6')
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 3,
      maxPassiveVariants: 2,
    })

    expect(builds[0].id).toBe('default')
    expect(builds.length).toBeLessThanOrEqual(1 + 3 * 2)
  })

  it('keeps late uiOrder passive pairs in the capped search space', () => {
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById('harbor-6')
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 10,
      maxPassiveVariants: 3,
    })

    expect(
      builds.some((variant) =>
        variant.build.passiveTalentIds.includes('warrior_t_reinforced_plates') &&
        variant.build.passiveTalentIds.includes('warrior_t_barbaric_training'),
      ),
    ).toBe(true)
  })

  it('includes low-active high-passive candidates for late stages with large point budgets', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById('WestFall-6')
    const buildRuleId = getStageBuildRuleId(stage)
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 18,
      maxPassiveVariants: 3,
    })

    expect(
      builds.some((variant) => {
        const activeCount = Object.values(variant.build.loadout).filter(Boolean).length
        return (
          activeCount <= 2 &&
          variant.build.passiveTalentIds.length >= 4 &&
          getRemainingBuildPoints(buildRuleId, variant.build.loadout, variant.build.passiveTalentIds) >= 0
        )
      }),
    ).toBe(true)
  })

  it('adds passive-heavy build candidates when strategy tips recommend trading active skills for talents', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById('WestFall-6')
    const candidates = generateStrategyTipBuildCandidates(stage, 'warrior_t', { maxCandidates: 6 })

    expect(candidates.length).toBeGreaterThan(0)
    expect(
      candidates.some((variant) => {
        const activeCount = Object.values(variant.build.loadout).filter(Boolean).length
        return (
          activeCount <= 2 &&
          variant.build.passiveTalentIds.includes('warrior_t_reinforced_plates') &&
          variant.build.passiveTalentIds.includes('warrior_t_barbaric_training') &&
          variant.build.passiveTalentIds.includes('warrior_t_defensive_stance') &&
          variant.build.passiveTalentIds.includes('warrior_t_defenders_aegis') &&
          variant.build.passiveTalentIds.includes('warrior_t_immortal_stance')
        )
      }),
    ).toBe(true)
  })
})
