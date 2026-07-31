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

  it('keeps the complete bear class enabled for challenge snapshot activation', () => {
    const workbook = parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx'))
    const bear = workbook.classDefinitions.find((entry) => entry.classId === 'druid_bear_t')
    expect(bear).toMatchObject({ classId: 'druid_bear_t', className: '熊T', enabled: true })
    expect(getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t').loadout).toMatchObject({
      '1': 'druid_bear_t_growl',
      '2': 'druid_bear_t_mangle',
      '3': 'druid_bear_t_thrash',
      '4': 'druid_bear_t_skull_bash',
      'Q': 'druid_bear_t_ironfur',
    })
    const slotZero = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const slotOne = getDefaultPersistedBuildForRule('8slot_1', 'druid_bear_t')
    expect(slotOne).toEqual(slotZero)
  })

  it('contains sixteen active skills and twenty-one talents with Pain Rage in tier zero', () => {
    const active = getActiveSkillCatalog().filter((entry) => entry.classId === 'druid_bear_t')
    const talents = getPassiveTalentCatalog().filter((entry) => entry.classId === 'druid_bear_t')
    const talentsById = new Map(talents.map((entry) => [entry.id, entry]))
    expect(active).toHaveLength(16)
    expect(talents).toHaveLength(21)
    expect(talents.reduce<Record<number, number>>((counts, talent) => {
      counts[talent.tier] = (counts[talent.tier] ?? 0) + 1
      return counts
    }, {})).toEqual({ 0: 6, 1: 5, 2: 5, 3: 5 })
    expect(talentsById.get('druid_bear_t_pain_rage')).toMatchObject({
      cost: 4,
      tier: 0,
      talentLogicId: 'bear_pain_rage',
      exclusiveGroup: 'druid_bear_t_thrash_choice',
    })
    expect(talentsById.get('druid_bear_t_pain_immunity')).toMatchObject({
      cost: 3,
      tier: 0,
      uiOrder: 5,
      talentLogicId: 'bear_pain_immunity',
      exclusiveGroup: 'druid_bear_t_thrash_choice',
    })
    expect(talentsById.get('druid_bear_t_water_fire_immunity')).toMatchObject({
      cost: 4,
      tier: 2,
      uiOrder: 15,
      talentLogicId: 'bear_water_fire_immunity',
      exclusiveGroup: 'druid_bear_t_ironfur_choice',
    })
    expect(talentsById.get('druid_bear_t_thick_hide')).toMatchObject({
      exclusiveGroup: 'druid_bear_t_ironfur_choice',
    })
    expect(talentsById.get('druid_bear_t_regenerative_bond')).toMatchObject({ cost: 1 })
    const partyOffenseTalents = [
      'druid_bear_t_iron_thorns',
      'druid_bear_t_natural_inspiration',
      'druid_bear_t_mark_of_the_wild',
    ]
    expect(talents.filter((entry) => partyOffenseTalents.includes(entry.id))).toEqual(
      expect.arrayContaining(partyOffenseTalents.map((id) => expect.objectContaining({
        id,
        category: 'party',
        cost: 3,
        tier: 1,
        exclusiveGroup: 'druid_bear_t_party_offense',
      }))),
    )
    expect(talents.map((entry) => entry.id)).not.toEqual(expect.arrayContaining([
      'druid_bear_t_ironfur_reserve',
      'druid_bear_t_blood_scent',
      'druid_bear_t_pack_presence',
      'druid_bear_t_natural_tenacity',
      'druid_bear_t_wild_recovery',
    ]))
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
    const active = new Map(workbook.activeSkillDefinitions.map((entry) => [entry.skillId, entry]))
    const activeEffects = new Map(workbook.activeSkillEffectDefinitions.map((entry) => [entry.skillId, entry]))
    const activeEffectsById = new Map(workbook.activeSkillEffectDefinitions.map((entry) => [entry.skillEffectId, entry]))
    const talentsById = new Map(workbook.passiveTalentDefinitions.map((entry) => [entry.talentId, entry]))
    const talentEffects = new Map(workbook.passiveTalentEffectDefinitions.map((entry) => [entry.talentId, entry]))
    const activeStatuses = new Map(workbook.activeStatusDefinitions.map((entry) => [entry.statusId, entry]))
    const passiveStatuses = new Map(workbook.passiveStatusDefinitions.map((entry) => [entry.statusId, entry]))
    const springReturns = workbook.passiveTalentEffectDefinitions.find((entry) => entry.talentId === 'druid_bear_t_spring_returns')
    const guardianStatus = workbook.passiveStatusDefinitions.find((entry) => entry.statusId === 'druid_bear_t_guardian_of_the_grove')
    const rageExhaustion = workbook.passiveStatusDefinitions.find((entry) => entry.statusId === 'druid_bear_t_rage_exhaustion')
    const icons = new Map(workbook.iconDefinitions.map((entry) => [entry.iconId, entry.assetKey]))

    expect(active.get('druid_bear_t_skull_bash')?.resourceCost).toBe(0)
    expect(active.get('druid_bear_t_ironfur')?.resourceCost).toBe(20)
    expect(active.get('druid_bear_t_frenzied_regeneration')?.resourceCost).toBe(20)
    expect(active.get('druid_bear_t_frenzied_regeneration')?.cooldownMs).toBe(18000)
    expect(active.get('druid_bear_t_thrash')?.cooldownMs).toBe(9000)
    expect(activeEffects.get('druid_bear_t_thrash')).toMatchObject({
      valueA: 10,
      valueB: 10,
      threatDelta: 0,
      threatMultiplier: 5,
    })
    expect(active.get('druid_bear_t_moonfire')?.cooldownMs).toBe(15000)
    expect(activeEffects.get('druid_bear_t_moonfire')).toMatchObject({
      valueA: 5,
      durationMs: 12000,
      threatDelta: 0,
      threatMultiplier: 5,
    })
    expect(activeEffects.get('druid_bear_t_swipe')).toMatchObject({
      valueA: 8,
      threatDelta: 0,
      threatMultiplier: 5,
    })
    expect(activeEffects.get('druid_bear_t_ironfur')).toMatchObject({ valueA: 20 })
    expect(activeStatuses.get('druid_bear_t_ironfur')).toMatchObject({ maxStacks: 3 })
    expect(active.get('druid_bear_t_barkskin')?.cooldownMs).toBe(30000)
    expect(activeEffects.get('druid_bear_t_barkskin')).toMatchObject({ valueB: 0.3, durationMs: 10000 })
    expect(activeStatuses.get('druid_bear_t_barkskin')).toMatchObject({ durationMs: 10000 })
    expect(activeEffectsById.get('druid_bear_t_regrowth_main')).toMatchObject({ valueA: 25, valueB: 5 })
    expect(activeEffectsById.get('druid_bear_t_regrowth_tick')).toMatchObject({ valueA: 5, valueB: 3 })
    expect(activeEffects.get('druid_bear_t_mangle')?.valueB).toBe(15)
    expect(activeEffects.get('druid_bear_t_incarnation_ursoc')).toMatchObject({
      valueA: 0.35,
      valueB: 0,
      durationMs: 30000,
    })
    expect(activeStatuses.get('druid_bear_t_incarnation_ursoc')?.durationMs).toBe(30000)
    expect(talentEffects.get('druid_bear_t_pain_rage')).toMatchObject({ valueA: 2, valueB: 10 })
    expect(talentEffects.get('druid_bear_t_savage_focus')).toMatchObject({ valueA: 7, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_iron_thorns')).toMatchObject({ valueA: 0.15, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_great_bear_vigor')).toMatchObject({ valueA: 0.3, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_ursine_threat')).toMatchObject({ valueA: 0.35, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_natural_inspiration')).toMatchObject({ valueA: 0.25, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_mark_of_the_wild')).toMatchObject({ valueA: 0.25, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_skull_bash_instinct')).toMatchObject({ valueA: 15, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_regrowth_of_the_pack')).toMatchObject({ valueA: 0.5, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_bark_dispelling')).toMatchObject({ valueA: 0.1, valueB: 0 })
    expect(talentEffects.get('druid_bear_t_water_fire_immunity')).toMatchObject({ valueA: 0.2, valueB: 0.1 })
    expect(talentEffects.get('druid_bear_t_broken_bark')).toMatchObject({ valueA: 30, valueB: 10 })
    expect(passiveStatuses.get('druid_bear_t_broken_bark_shield')?.description).toContain('吸收30点全伤害')
    expect(talentEffects.get('druid_bear_t_guardian_of_the_grove')).toMatchObject({ valueA: 0.25, valueB: 0.8 })
    expect(talentEffects.get('druid_bear_t_last_bear_stand')).toMatchObject({ valueA: 0.15, valueB: 10 })
    expect(talentEffects.get('druid_bear_t_thick_hide')).toMatchObject({ valueA: 0.1 })
    expect(talentsById.get('druid_bear_t_thick_hide')?.description).toContain('与铁鬃线性叠加')
    expect(talentsById.get('druid_bear_t_regrowth_of_the_pack')?.description).toContain('即时治疗')
    expect(talentsById.get('druid_bear_t_regrowth_of_the_pack')?.description).toContain('持续治疗不治疗队伍')
    expect(talentEffects.get('druid_bear_t_moonlit_resolve')).toMatchObject({ valueA: 0.1 })
    expect(active.get('druid_bear_t_rage_of_the_sleeper')).toMatchObject({
      resourceCost: 20,
      unlockHint: 'WF-5解锁',
    })
    expect(active.get('druid_bear_t_survival_instincts')?.unlockHint).toBe('ZA-3解锁')
    expect(activeEffects.get('druid_bear_t_rage_of_the_sleeper')).toMatchObject({
      valueA: 0.25,
      valueB: 0.25,
      durationMs: 10000,
    })
    expect(activeStatuses.get('druid_bear_t_rage_of_the_sleeper')?.durationMs).toBe(10000)
    expect([...talentEffects.keys()]).not.toEqual(expect.arrayContaining([
      'druid_bear_t_natural_tenacity',
      'druid_bear_t_wild_recovery',
    ]))
    expect(springReturns).toMatchObject({ valueA: 60, valueB: 5 })
    expect(guardianStatus).toMatchObject({ statusCategory: 'partyBuff', enabled: true })
    expect(rageExhaustion).toMatchObject({
      statusCategory: 'enemyDebuff',
      durationMs: 10000,
      dispellable: true,
      effectLogicId: 'bear_rage_exhaustion',
      enabled: true,
    })
    expect(icons.get('druid_bear_t_pain_rage_pic')).toBe('bear-pain-rage')
    expect(icons.get('druid_bear_t_rage_exhaustion_pic')).toBe('bear-rage-lock')

    const defaultWestFallBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    expect(defaultWestFallBuild.passiveTalentIds).toContain('druid_bear_t_mark_of_the_wild')
    expect(defaultWestFallBuild.passiveTalentIds).not.toEqual(expect.arrayContaining([
      'druid_bear_t_iron_thorns',
      'druid_bear_t_natural_inspiration',
    ]))
  })
})
