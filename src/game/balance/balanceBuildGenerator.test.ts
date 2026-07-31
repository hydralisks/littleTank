import { afterEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides, getStageBuildRuleId } from '../data/encounterTemplates'
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
import { parseEncounterWorkbook, parsePlayerBuildWorkbook, parseStageWorkbook } from '../data/workbookLoader'
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
    applyEncounterWorkbookOverrides({
      openingOverrides: {},
      placementOverrides: {},
      openingStatusOverrides: {},
      affixBindings: {},
      affixDefinitions: {},
      specialRuleBindings: {},
      specialRuleDefinitions: {},
    })
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

  it('covers every unlocked class skill even when the active candidate cap is smaller', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById("Zul'Aman-5")
    const unlockedBearSkills = getUnlockedActiveSkillIdsForStage(stage)
      .filter((skillId) => getActiveSkillDefinition(skillId)?.classId === 'druid_bear_t')
    const builds = generateStageBalanceBuilds(stage, 'druid_bear_t', {
      maxActiveBuilds: 8,
      maxPassiveVariants: 1,
    })
    const coveredSkillIds = new Set(builds.flatMap((variant) => (
      Object.values(variant.build.loadout).filter((skillId): skillId is string => Boolean(skillId))
    )))

    expect(unlockedBearSkills.every((skillId) => coveredSkillIds.has(skillId))).toBe(true)
    expect(builds.some((variant) => unlockedBearSkills.slice(-8).every(
      (skillId) => Object.values(variant.build.loadout).includes(skillId),
    ))).toBe(true)
    expect(builds.some((variant) => {
      const equipped = Object.values(variant.build.loadout).filter(Boolean)
      return equipped.length === 6 && unlockedBearSkills.slice(-6).every((skillId) => equipped.includes(skillId))
    })).toBe(true)
  })

  it('includes overlapping full-slot windows for mid-campaign class builds', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById('WestFall-3')
    const builds = generateStageBalanceBuilds(stage, 'druid_bear_t', {
      maxActiveBuilds: 8,
      maxPassiveVariants: 3,
    })

    expect(builds.some((variant) => {
      const equipped = new Set(Object.values(variant.build.loadout).filter(Boolean))
      return (
        [
          'druid_bear_t_mangle',
          'druid_bear_t_thrash',
          'druid_bear_t_ironfur',
          'druid_bear_t_frenzied_regeneration',
          'druid_bear_t_barkskin',
        ].every((skillId) => equipped.has(skillId)) &&
        variant.build.passiveTalentIds.includes('druid_bear_t_great_bear_vigor') &&
        variant.build.passiveTalentIds.includes('druid_bear_t_broken_bark')
      )
    })).toBe(true)
  })

  it('never generates more than one Bear T party-offense talent per build', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById('WestFall-6')
    const exclusiveTalentIds = new Set([
      'druid_bear_t_iron_thorns',
      'druid_bear_t_natural_inspiration',
      'druid_bear_t_mark_of_the_wild',
    ])

    const builds = generateStageBalanceBuilds(stage, 'druid_bear_t', {
      maxActiveBuilds: 16,
      maxPassiveVariants: 6,
    })

    expect(builds.length).toBeGreaterThan(1)
    expect(builds.every((variant) => (
      variant.build.passiveTalentIds.filter((talentId) => exclusiveTalentIds.has(talentId)).length <= 1
    ))).toBe(true)
    expect([...exclusiveTalentIds].every((talentId) => (
      builds.some((variant) => variant.build.passiveTalentIds.includes(talentId))
    ))).toBe(true)
  })

  it('surfaces both sides of each Bear T choice without generating conflicting pairs', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById("Zul'Aman-5")
    const exclusiveGroups = [
      ['druid_bear_t_pain_rage', 'druid_bear_t_pain_immunity'],
      ['druid_bear_t_thick_hide', 'druid_bear_t_water_fire_immunity'],
    ]
    const builds = generateStageBalanceBuilds(stage, 'druid_bear_t', {
      maxActiveBuilds: 16,
      maxPassiveVariants: 10,
    })

    expect(builds.length).toBeGreaterThan(1)
    for (const talentIds of exclusiveGroups) {
      expect(builds.every((variant) => (
        variant.build.passiveTalentIds.filter((talentId) => talentIds.includes(talentId)).length <= 1
      ))).toBe(true)
      expect(talentIds.every((talentId) => (
        builds.some((variant) => variant.build.passiveTalentIds.includes(talentId))
      ))).toBe(true)
    }
  })

  it('includes an eight-slot rage-damage and layered-survival build for late campaign stages', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById("Zul'Aman-2")
    const builds = generateStageBalanceBuilds(stage, 'druid_bear_t', {
      maxActiveBuilds: 12,
      maxPassiveVariants: 3,
    })
    const expectedSkillIds = [
      'druid_bear_t_mangle',
      'druid_bear_t_thrash',
      'druid_bear_t_skull_bash',
      'druid_bear_t_ironfur',
      'druid_bear_t_frenzied_regeneration',
      'druid_bear_t_barkskin',
      'druid_bear_t_rage_of_the_sleeper',
      'druid_bear_t_lunar_beam',
    ]

    expect(builds.some((variant) => {
      const equipped = new Set(Object.values(variant.build.loadout).filter(Boolean))
      return (
        expectedSkillIds.every((skillId) => equipped.has(skillId)) &&
        variant.build.passiveTalentIds.includes('druid_bear_t_regenerative_bond') &&
        variant.build.passiveTalentIds.includes('druid_bear_t_ursoc_shelter')
      )
    })).toBe(true)
  })

  it('retains the eight-slot Bear core loop after all late-campaign skills unlock', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById("Zul'Aman-5")
    const builds = generateStageBalanceBuilds(stage, 'druid_bear_t', {
      maxActiveBuilds: 8,
      maxPassiveVariants: 3,
    })
    const requiredSkillIds = [
      'druid_bear_t_mangle',
      'druid_bear_t_thrash',
      'druid_bear_t_skull_bash',
      'druid_bear_t_ironfur',
      'druid_bear_t_frenzied_regeneration',
      'druid_bear_t_barkskin',
      'druid_bear_t_rage_of_the_sleeper',
    ]
    const maxHpSkillIds = [
      'druid_bear_t_lunar_beam',
      'druid_bear_t_incarnation_ursoc',
    ]

    expect(builds.some((variant) => {
      const equipped = new Set(Object.values(variant.build.loadout).filter(Boolean))
      return (
        requiredSkillIds.every((skillId) => equipped.has(skillId)) &&
        maxHpSkillIds.some((skillId) => equipped.has(skillId)) &&
        variant.build.passiveTalentIds.includes('druid_bear_t_broken_bark')
      )
    })).toBe(true)
  })

  it('keeps broad uiOrder passive pairs in the capped search space', () => {
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
    const stage = getStageById('harbor-6')
    const builds = generateStageBalanceBuilds(stage, 'warrior_t', {
      maxActiveBuilds: 10,
      maxPassiveVariants: 3,
    })

    expect(
      builds.some((variant) =>
        variant.build.passiveTalentIds.includes('warrior_t_reinforced_plates') &&
        variant.build.passiveTalentIds.includes('warrior_t_focused_vigor'),
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
          variant.build.passiveTalentIds.includes('warrior_t_raise_banner') &&
          variant.build.passiveTalentIds.includes('warrior_t_barbaric_training') &&
          variant.build.passiveTalentIds.includes('warrior_t_defenders_aegis') &&
          (
            variant.build.passiveTalentIds.includes('warrior_t_defensive_stance') ||
            variant.build.passiveTalentIds.includes('warrior_t_immortal_stance')
          )
        )
      }),
    ).toBe(true)
  })
})
