import { afterEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  buildSkillsFromLoadout,
  canUseSkillInRule,
  getActiveSkillDefinition,
  getBuildRuleDefinition,
  getDefaultPersistedBuildForRule,
  getPassiveModifiers,
  getPassiveTalentDefinition,
  getPassiveTalentCatalog,
  getPlayerBuildStatusDefinition,
  getPlayerClassDefinition,
  getSkillEffectsForSkill,
  getTalentEffectsForTalent,
  getNextPassiveTalentIdsForToggle,
  normalizePersistedBuildForRule,
  applyPlayerBuildWorkbookOverrides,
  canUseTalentInRule,
  resetPlayerBuildCatalog,
} from './playerBuildCatalog'
import {
  applyStageWorkbookOverrides,
  getUnlockedActiveSkillIdsForStage,
  getPassiveTalentUnlockTierForStage,
  getStageById,
} from './stageTemplates'
import { parsePlayerBuildWorkbook } from './workbookLoader'

function emptyPlayerBuildOverrides() {
  return {
    classDefinitions: [],
    buildRuleDefinitions: [],
    activeSkillDefinitions: [],
    activeSkillEffectDefinitions: [],
    activeStatusDefinitions: [],
    passiveTalentDefinitions: [],
    passiveTalentEffectDefinitions: [],
    passiveStatusDefinitions: [],
    defaultActiveBuilds: [],
    defaultPassiveBuilds: [],
    iconDefinitions: [],
  }
}

function applyTestBearBuildOverrides() {
  applyPlayerBuildWorkbookOverrides({
    ...emptyPlayerBuildOverrides(),
    classDefinitions: [{
      classId: 'druid_bear_t',
      className: '熊T',
      roleTag: 'tank',
      classDescription: 'Test bear tank.',
      recommendedBuildRuleIds: ['standard_5slot'],
      enabled: true,
    }],
    activeSkillDefinitions: [{
      skillId: 'druid_bear_t_growl',
      classId: 'druid_bear_t',
      skillName: '低吼',
      shortName: '低吼',
      description: 'Test taunt.',
      iconId: 'taunt',
      pointCost: 4,
      resourceCost: 0,
      cooldownMs: 8_000,
      gcdMs: 800,
      targetingType: 'currentEnemy',
      skillLogicId: 'taunt_single',
      castStopMode: 'none',
      canAffectSkull: true,
      enabled: true,
    }],
    passiveTalentDefinitions: [{
      talentId: 'druid_bear_t_thick_hide',
      classId: 'druid_bear_t',
      talentName: '厚皮',
      category: 'player',
      cost: 2,
      description: 'Test passive.',
      iconId: 'vitalReserve',
      talentLogicId: 'player_max_hp_up',
      tier: 1,
      enabled: true,
    }],
    defaultActiveBuilds: [{
      presetId: 'standard_5slot',
      buildRuleId: 'standard_5slot',
      classId: 'druid_bear_t',
      hotkey: '1',
      skillId: 'druid_bear_t_growl',
      priority: 1,
    }],
    defaultPassiveBuilds: [{
      presetId: 'standard_5slot',
      buildRuleId: 'standard_5slot',
      classId: 'druid_bear_t',
      talentId: 'druid_bear_t_thick_hide',
      selected: true,
      priority: 1,
    }],
  })
}

describe('playerBuildCatalog class-aware build data', () => {
  afterEach(() => {
    resetPlayerBuildCatalog()
  })

  it('exposes warrior_t as the first formal playable class', () => {
    const playerClass = getPlayerClassDefinition('warrior_t')

    expect(playerClass).toBeDefined()
    expect(playerClass?.className).toBe('战士T')
    expect(playerClass?.roleTag).toBe('tank')
  })

  it('binds standard build rules to warrior_t without demo0 active skill examples', () => {
    const standardRule = getBuildRuleDefinition('standard_5slot')
    const defaultBuild = getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t')

    expect(standardRule?.classId).toBe('warrior_t')
    expect(defaultBuild.loadout['1']).toBe('warrior_t_taunt')
    expect(getActiveSkillDefinition('warrior_t_taunt')?.classId).toBe('warrior_t')
    expect(getActiveSkillDefinition('demo0_taunt')).toBeUndefined()
    expect(getActiveSkillDefinition('taunt')).toBeUndefined()
  })

  it('selects defaults and legal content by explicit class without cross-class fallback', () => {
    applyTestBearBuildOverrides()

    expect(getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t')).toMatchObject({
      loadout: { '1': 'druid_bear_t_growl' },
      passiveTalentIds: ['druid_bear_t_thick_hide'],
    })
    expect(canUseSkillInRule(
      'standard_5slot',
      'druid_bear_t',
      'warrior_t_taunt',
      ['warrior_t_taunt', 'druid_bear_t_growl'],
    )).toBe(false)
    expect(() => getDefaultPersistedBuildForRule('standard_5slot', 'dk_blood_t')).toThrowError(
      'Missing default active build for class dk_blood_t and rule standard_5slot',
    )
  })

  it('removes skills and talents owned by another class during normalization', () => {
    applyTestBearBuildOverrides()

    const normalized = normalizePersistedBuildForRule(
      {
        loadout: {
          '1': 'warrior_t_taunt',
          '2': 'druid_bear_t_growl',
          '3': null,
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: ['warrior_t_vital_reserve', 'druid_bear_t_thick_hide'],
      },
      'standard_5slot',
      'druid_bear_t',
      1,
      ['warrior_t_taunt', 'druid_bear_t_growl'],
    )

    expect(Object.values(normalized.build.loadout).filter(Boolean)).toEqual(['druid_bear_t_growl'])
    expect(normalized.build.passiveTalentIds).toEqual(['druid_bear_t_thick_hide'])
    expect(normalized.warnings.some((warning) => warning.code === 'removed_skill')).toBe(true)
    expect(normalized.warnings.some((warning) => warning.code === 'removed_talent')).toBe(true)
  })

  it('does not load demo0 active skill examples from the current designer workbook', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    const overrides = parsePlayerBuildWorkbook(workbook)

    expect(overrides.activeSkillDefinitions.some((entry) => entry.skillId.startsWith('demo0_'))).toBe(false)
    expect(overrides.activeSkillEffectDefinitions.some((entry) => entry.skillId?.startsWith('demo0_'))).toBe(false)
  })

  it('stores planner-facing effect rows for warrior_t skills and talents', () => {
    expect(getSkillEffectsForSkill('warrior_t_taunt')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 'warrior_t_taunt',
          targetSelector: 'current',
          threatDelta: 72,
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_taunt')?.skillLogicId).toBe('taunt_single')

    expect(getSkillEffectsForSkill('warrior_t_mass_taunt')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 'warrior_t_mass_taunt',
          targetSelector: 'allEnemy',
        }),
      ]),
    )

    expect(getSkillEffectsForSkill('warrior_t_burst')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 'warrior_t_burst',
          targetSelector: 'current',
          threatMultiplier: 5,
        }),
      ]),
    )

    expect(getTalentEffectsForTalent('warrior_t_vital_reserve')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          talentId: 'warrior_t_vital_reserve',
          talentLogicId: 'player_max_hp_up',
        }),
      ]),
    )
  })

  it('can reset workbook overrides back to the built-in player build catalog', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillEffectDefinitions: [
        {
          skillEffectId: 'warrior_t_taunt_main',
          skillId: 'warrior_t_taunt',
          threatDelta: 50,
        },
      ],
    })

    expect(getSkillEffectsForSkill('warrior_t_taunt')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          threatDelta: 50,
        }),
      ]),
    )

    resetPlayerBuildCatalog()

    expect(getSkillEffectsForSkill('warrior_t_taunt')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          threatDelta: 72,
        }),
      ]),
    )
  })

  it('applies warrior_t talent registry modifiers and skill template mutations', () => {
    const build = getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t')
    const passiveTalentIds = ['warrior_t_snap_interrupt', 'warrior_t_vital_reserve']

    expect(getPassiveTalentDefinition('warrior_t_snap_interrupt')?.classId).toBe('warrior_t')

    const modifiers = getPassiveModifiers(passiveTalentIds)
    const skills = buildSkillsFromLoadout(build.loadout, passiveTalentIds)
    const interrupt = skills.find((skill) => skill.id === 'warrior_t_interrupt')

    expect(modifiers.playerMaxHpBonus).toBeGreaterThan(0)
    expect(modifiers.interruptIgnoresGcd).toBe(true)
    expect(interrupt?.gcdMs).toBe(0)
  })

  it('applies passive talent modifiers from planner effect rows', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      passiveTalentDefinitions: [
        {
          talentId: 'xlsx_effect_hp_talent',
          classId: 'warrior_t',
          talentName: 'Xlsx Effect HP',
          category: 'player',
          cost: 1,
          description: 'Uses valueA from the effect row.',
          iconId: 'vitalReserve',
          talentLogicId: 'player_max_hp_up',
          tier: 0,
          grantedStatusIds: [],
          enabled: true,
        },
      ],
      passiveTalentEffectDefinitions: [
        {
          talentEffectId: 'xlsx_effect_hp_talent_main',
          talentId: 'xlsx_effect_hp_talent',
          effectIndex: 1,
          talentLogicId: 'player_max_hp_up',
          targetScope: 'player',
          valueA: 321,
          enabled: true,
        },
      ],
    })

    expect(getPassiveModifiers(['xlsx_effect_hp_talent']).playerMaxHpBonus).toBe(321)
  })

  it('uses party as the planner-facing passive talent category', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      passiveTalentDefinitions: [
        {
          talentId: 'xlsx_party_category_talent',
          classId: 'warrior_t',
          talentName: 'Party Category Talent',
          category: 'party',
          cost: 1,
          description: 'Should load with the party category.',
          iconId: 'rallyingStandard',
          talentLogicId: 'party_pressure_cap_up',
          tier: 0,
          grantedStatusIds: [],
          enabled: true,
        },
      ],
    })

    expect(getPassiveTalentDefinition('xlsx_party_category_talent')?.category).toBe('party')
  })

  it('requires passive talent workbook rows to provide tier', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          talentId: 'xlsx_missing_tier_talent',
          talentName: 'Missing Tier Talent',
          category: 'player',
          cost: 1,
          description: 'Should not load without tier.',
          iconId: 'vitalReserve',
          talentLogicId: 'player_max_hp_up',
          enabled: true,
        },
        {
          talentId: 'xlsx_tier_zero_talent',
          talentName: 'Tier Zero Talent',
          category: 'player',
          cost: 1,
          description: 'Should load with tier 0.',
          iconId: 'vitalReserve',
          talentLogicId: 'player_max_hp_up',
          tier: 0,
          enabled: true,
        },
      ]),
      '被动天赋定义',
    )

    const overrides = parsePlayerBuildWorkbook(workbook)
    applyPlayerBuildWorkbookOverrides(overrides)

    expect(overrides.passiveTalentDefinitions.map((entry) => entry.talentId)).not.toContain('xlsx_missing_tier_talent')
    expect(getPassiveTalentDefinition('xlsx_missing_tier_talent')).toBeUndefined()
    expect(getPassiveTalentDefinition('xlsx_tier_zero_talent')).toMatchObject({
      id: 'xlsx_tier_zero_talent',
      tier: 0,
    })
  })

  it('ignores deprecated build-rule skill and talent allow force lock columns', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          buildRuleId: 'xlsx_deprecated_columns_rule',
          classId: 'warrior_t',
          ruleName: 'Deprecated Columns Rule',
          description: 'Deprecated columns should not affect runtime.',
          totalBuildPoints: 28,
          maxActiveSlots: 5,
          enabledHotkeysCsv: '1,2,3,4,Q',
          allowedActiveSkillIdsCsv: 'warrior_t_taunt',
          allowedTalentIdsCsv: 'warrior_t_vital_reserve',
          forcedSkillIdsCsv: 'warrior_t_taunt',
          forcedTalentIdsCsv: 'warrior_t_vital_reserve',
          lockedSkillIdsCsv: 'warrior_t_shield_slam',
          lockedTalentIdsCsv: 'warrior_t_snap_interrupt',
          inheritancePolicy: 'keep_active_first',
          enabled: true,
        },
      ]),
      '构筑规则定义',
    )

    const overrides = parsePlayerBuildWorkbook(workbook)
    applyPlayerBuildWorkbookOverrides(overrides)
    const rule = getBuildRuleDefinition('xlsx_deprecated_columns_rule')

    expect(overrides.buildRuleDefinitions[0]).not.toHaveProperty('allowedActiveSkillIds')
    expect(rule).toMatchObject({
      buildRuleId: 'xlsx_deprecated_columns_rule',
      enabledHotkeys: ['1', '2', '3', '4', 'Q'],
    })
    expect(canUseSkillInRule('xlsx_deprecated_columns_rule', 'warrior_t', 'warrior_t_shield_slam', [
      'warrior_t_taunt',
      'warrior_t_shield_slam',
    ])).toBe(true)
    expect(canUseTalentInRule('xlsx_deprecated_columns_rule', 'warrior_t', 'warrior_t_snap_interrupt', 2)).toBe(true)
  })

  it('unlocks tier 0 passive talents only after the third stage is complete', () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'Ringing Deeps' },
        { areaId: 'WestFall', title: 'Westfall' },
        { areaId: 'Highland', title: 'Highland' },
      ],
      stageOverrides: [
        { stageId: 'RingingDeeps-1', areaId: 'RingingDeeps', order: 1 },
        { stageId: 'RingingDeeps-2', areaId: 'RingingDeeps', order: 2 },
        { stageId: 'RingingDeeps-3', areaId: 'RingingDeeps', order: 3 },
        { stageId: 'RingingDeeps-4', areaId: 'RingingDeeps', order: 4 },
        { stageId: 'RingingDeeps-5', areaId: 'RingingDeeps', order: 5 },
        { stageId: 'RingingDeeps-6', areaId: 'RingingDeeps', order: 6 },
        { stageId: 'WestFall-1', areaId: 'WestFall', order: 1 },
        { stageId: 'WestFall-6', areaId: 'WestFall', order: 6 },
      ],
      legendOverrides: [],
    })

    try {
      expect(getPassiveTalentUnlockTierForStage(getStageById('RingingDeeps-1'))).toBe(-1)
      expect(getPassiveTalentUnlockTierForStage(getStageById('RingingDeeps-2'))).toBe(-1)
      expect(getPassiveTalentUnlockTierForStage(getStageById('RingingDeeps-3'))).toBe(-1)
      expect(getPassiveTalentUnlockTierForStage(getStageById('RingingDeeps-4'))).toBe(0)
      expect(getPassiveTalentUnlockTierForStage(getStageById('RingingDeeps-6'))).toBe(1)
      expect(getPassiveTalentUnlockTierForStage(getStageById('WestFall-6'))).toBe(2)
    } finally {
      applyStageWorkbookOverrides({
        areaOverrides: [],
        stageOverrides: [],
        legendOverrides: [],
      })
    }
  })

  it('lets workbook overrides pin passive talent unlock tier for independent challenge stages', () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'Challenge', title: 'Challenge' },
      ],
      stageOverrides: [
        { stageId: 'Challenge-1', areaId: 'Challenge', order: 1 },
        { stageId: 'Challenge-2', areaId: 'Challenge', order: 2 },
        { stageId: 'Challenge-3', areaId: 'Challenge', order: 3, passiveTalentUnlockTier: 2 },
      ],
      legendOverrides: [],
    })

    try {
      expect(getPassiveTalentUnlockTierForStage(getStageById('Challenge-3'))).toBe(2)
    } finally {
      applyStageWorkbookOverrides({
        areaOverrides: [],
        stageOverrides: [],
        legendOverrides: [],
      })
    }
  })

  it('blocks and normalizes passive talents above the unlocked tier', () => {
    const sourceBuild = getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t')
    const lockedTierTalent = 'warrior_t_snap_interrupt'

    expect(getPassiveTalentDefinition(lockedTierTalent)?.tier).toBeGreaterThan(1)
    expect(canUseTalentInRule('standard_5slot', 'warrior_t', lockedTierTalent, 1)).toBe(false)
    expect(canUseTalentInRule('standard_5slot', 'warrior_t', lockedTierTalent, 2)).toBe(true)

    const normalized = normalizePersistedBuildForRule(
      {
        ...sourceBuild,
        passiveTalentIds: ['warrior_t_vital_reserve', lockedTierTalent],
      },
      'standard_5slot', 'warrior_t',
      1,
    )

    expect(normalized.build.passiveTalentIds).toEqual(['warrior_t_vital_reserve'])
    expect(normalized.warnings.some((warning) => warning.code === 'removed_talent')).toBe(true)
  })

  it('exposes RingingDeeps-6 tier 1 passive talents in uiOrder order without legacy demo talents', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(workbook))
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'Ringing Deeps' },
      ],
      stageOverrides: [
        { stageId: 'RingingDeeps-1', areaId: 'RingingDeeps', order: 1 },
        { stageId: 'RingingDeeps-2', areaId: 'RingingDeeps', order: 2 },
        { stageId: 'RingingDeeps-3', areaId: 'RingingDeeps', order: 3 },
        { stageId: 'RingingDeeps-4', areaId: 'RingingDeeps', order: 4 },
        { stageId: 'RingingDeeps-5', areaId: 'RingingDeeps', order: 5 },
        { stageId: 'RingingDeeps-6', areaId: 'RingingDeeps', order: 6 },
      ],
      legendOverrides: [],
    })

    try {
      const visibleTalents = getPassiveTalentCatalog()
        .filter((talent) => canUseTalentInRule('standard_5slot', 'warrior_t', talent.id, getPassiveTalentUnlockTierForStage(getStageById('RingingDeeps-6'))))
        .filter((talent) => talent.classId === 'warrior_t')

      expect(visibleTalents.map((talent) => talent.id)).toEqual([
        'warrior_t_reinforced_plates',
        'warrior_t_snap_interrupt',
        'warrior_t_defensive_stance',
        'warrior_t_raise_banner',
        'warrior_t_defenders_aegis',
        'warrior_t_barbaric_training',
        'warrior_t_bloodsurge',
        'warrior_t_focused_vigor',
      ])
      expect(visibleTalents.filter((talent) => talent.category === 'player').map((talent) => talent.uiOrder)).toEqual([1, 3, 7, 8])
      expect(visibleTalents.filter((talent) => talent.category === 'skill').map((talent) => talent.uiOrder)).toEqual([2, 5])
      expect(visibleTalents.filter((talent) => talent.category === 'party').map((talent) => talent.uiOrder)).toEqual([4, 6])
      expect(visibleTalents.some((talent) => talent.id.startsWith('demo0_'))).toBe(false)
      expect(visibleTalents.map((talent) => talent.name)).toContain('血涌')
      expect(visibleTalents.map((talent) => talent.name)).toContain('聚力')
    } finally {
      applyStageWorkbookOverrides({
        areaOverrides: [],
        stageOverrides: [],
        legendOverrides: [],
      })
    }
  })

  it('keeps active skill unlocks scoped to stage-prefix cumulative unlock ids', () => {
    const harbor6Skills = getUnlockedActiveSkillIdsForStage(getStageById('harbor-6'))
    const midland4Skills = getUnlockedActiveSkillIdsForStage(getStageById('midland-4'))

    expect(getStageById('midland-4').unlockedActiveSkillIds).toEqual([])
    expect(harbor6Skills).toEqual([
      'warrior_t_taunt',
      'warrior_t_interrupt',
      'warrior_t_stun',
      'warrior_t_mass_taunt',
      'warrior_t_shield_wall',
    ])
    expect(midland4Skills).toEqual([
      ...harbor6Skills,
      'warrior_t_revenge',
      'warrior_t_ignore_pain',
      'warrior_t_shield_block',
      'warrior_t_shield_slam',
    ])
    expect(canUseSkillInRule('standard_5slot', 'warrior_t', 'warrior_t_shield_reflection', midland4Skills)).toBe(false)
    expect(canUseSkillInRule('standard_5slot', 'warrior_t', 'warrior_t_shield_slam', midland4Skills)).toBe(true)
    expect(canUseSkillInRule('full_8slot', 'warrior_t', 'warrior_t_avatar', midland4Skills)).toBe(false)

    const normalized = normalizePersistedBuildForRule(
      {
        loadout: {
          '1': 'warrior_t_taunt',
          '2': 'warrior_t_shield_slam',
          '3': 'warrior_t_avatar',
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: [],
      },
      'full_8slot', 'warrior_t',
      Infinity,
      midland4Skills,
    )

    expect(Object.values(normalized.build.loadout)).toContain('warrior_t_shield_slam')
    expect(Object.values(normalized.build.loadout)).not.toContain('warrior_t_avatar')
    expect(normalized.warnings.some((warning) => warning.code === 'removed_skill')).toBe(true)
  })

  it('auto-equips only newly unlocked active skills into available hotkeys for first stage entry', () => {
    const normalized = normalizePersistedBuildForRule(
      {
        loadout: {
          '1': 'warrior_t_taunt',
          '2': null,
          '3': null,
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: [],
      },
      'tutorial_2slot', 'warrior_t',
      Infinity,
      ['warrior_t_taunt', 'warrior_t_interrupt'],
      ['warrior_t_interrupt'],
    )

    expect(normalized.build.loadout).toMatchObject({
      '1': 'warrior_t_taunt',
      '2': 'warrior_t_interrupt',
    })
  })

  it('does not auto-restore older unlocked skills that the player removed from the build', () => {
    const normalized = normalizePersistedBuildForRule(
      {
        loadout: {
          '1': 'warrior_t_taunt',
          '2': null,
          '3': null,
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: [],
      },
      'tutorial_3slot', 'warrior_t',
      Infinity,
      ['warrior_t_taunt', 'warrior_t_interrupt', 'warrior_t_stun'],
      ['warrior_t_stun'],
    )

    expect(Object.values(normalized.build.loadout)).not.toContain('warrior_t_interrupt')
    expect(normalized.build.loadout['2']).toBe('warrior_t_stun')
  })

  it('replaces the last enabled active hotkeys when newly unlocked skills have no empty slot', () => {
    const normalized = normalizePersistedBuildForRule(
      {
        loadout: {
          '1': 'warrior_t_taunt',
          '2': 'warrior_t_interrupt',
          '3': 'warrior_t_stun',
          '4': 'warrior_t_mass_taunt',
          Q: 'warrior_t_shield_wall',
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: [],
      },
      'standard_5slot', 'warrior_t',
      Infinity,
      [
        'warrior_t_taunt',
        'warrior_t_interrupt',
        'warrior_t_stun',
        'warrior_t_mass_taunt',
        'warrior_t_shield_wall',
        'warrior_t_cleave',
      ],
      ['warrior_t_cleave'],
    )

    expect(normalized.build.loadout.Q).toBe('warrior_t_cleave')
    expect(Object.values(normalized.build.loadout)).not.toContain('warrior_t_shield_wall')
  })

  it('replaces the last enabled active hotkeys when empty slots exist but build points are exhausted', () => {
    const normalized = normalizePersistedBuildForRule(
      {
        loadout: {
          '1': 'warrior_t_taunt',
          '2': 'warrior_t_interrupt',
          '3': null,
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: ['warrior_t_vital_reserve', 'warrior_t_snap_interrupt'],
      },
      'tutorial_3slot', 'warrior_t',
      Infinity,
      ['warrior_t_taunt', 'warrior_t_interrupt', 'warrior_t_stun'],
      ['warrior_t_stun'],
    )

    expect(normalized.build.loadout['1']).toBe('warrior_t_taunt')
    expect(normalized.build.loadout['2']).toBe('warrior_t_stun')
    expect(normalized.build.loadout['3']).toBeNull()
    expect(Object.values(normalized.build.loadout)).not.toContain('warrior_t_interrupt')
    expect(normalized.build.passiveTalentIds).toEqual(['warrior_t_vital_reserve', 'warrior_t_snap_interrupt'])
  })

  it('loads rage costs for xlsx-defined spenders from the designer workbook', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    const overrides = parsePlayerBuildWorkbook(workbook)

    applyPlayerBuildWorkbookOverrides(overrides)

    expect(getActiveSkillDefinition('warrior_t_revenge')?.resourceCost).toBe(20)
    expect(getActiveSkillDefinition('warrior_t_ignore_pain')?.resourceCost).toBe(20)
    expect(getActiveSkillDefinition('warrior_t_shield_block')?.resourceCost).toBe(20)
    expect(getActiveSkillDefinition('warrior_t_shield_block')?.skillLogicId).toBe('shield_block')
    expect(getSkillEffectsForSkill('warrior_t_shield_block')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          statusId: 'shieldBlock',
          durationMs: 7000,
          valueB: 0.5,
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_shield_slam')).toMatchObject({
      skillLogicId: 'shield_slam',
      resourceCost: 0,
    })
    expect(getSkillEffectsForSkill('warrior_t_shield_slam')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueA: 15,
          threatMultiplier: 5,
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_shield_reflection')).toMatchObject({
      skillLogicId: 'shield_reflection',
    })
    expect(getSkillEffectsForSkill('warrior_t_shield_reflection')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          durationMs: 1000,
          statusId: 'shieldReflection',
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_avatar')).toMatchObject({
      skillLogicId: 'avatar',
    })
    expect(getSkillEffectsForSkill('warrior_t_avatar')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueA: 50,
        }),
        expect.objectContaining({
          durationMs: 16000,
          valueB: 0.5,
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_shockwave')).toMatchObject({
      skillLogicId: 'shockwave',
    })
    expect(getSkillEffectsForSkill('warrior_t_shockwave')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetSelector: 'cross',
          valueA: 5,
          durationMs: 2000,
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_thunderstruck')).toMatchObject({
      skillLogicId: 'thunderstruck',
    })
    expect(getSkillEffectsForSkill('warrior_t_thunderstruck')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetSelector: 'matrix3x3',
          valueA: 15,
          threatMultiplier: 5,
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_rallying_cry')).toMatchObject({
      skillLogicId: 'rallying_cry',
    })
    expect(getSkillEffectsForSkill('warrior_t_rallying_cry')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          valueB: 0.2,
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_intervene')).toMatchObject({
      skillLogicId: 'intervene',
    })
    expect(getSkillEffectsForSkill('warrior_t_intervene')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          durationMs: 5000,
          statusId: 'intervened',
        }),
      ]),
    )
    expect(getActiveSkillDefinition('warrior_t_demoralizing_shout')).toMatchObject({
      skillLogicId: 'demoralizing_shout',
    })
    expect(getSkillEffectsForSkill('warrior_t_demoralizing_shout')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetSelector: 'allEnemy',
          valueB: 0.25,
          threatDelta: 20,
        }),
      ]),
    )
  })

  it('adds new xlsx-defined active status definitions instead of only overriding built-ins', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeStatusDefinitions: [
        {
          statusId: 'xlsx-only-status',
          statusName: '表格新增状态',
          statusCategory: 'playerBuff',
          iconId: 'battle-seal',
          durationMs: 1234,
          maxStacks: 2,
          dispellable: false,
          description: '由 xlsx 新增的主动状态。',
          effectLogicId: 'xlsx_only_logic',
          enabled: true,
        },
      ],
    })

    expect(getPlayerBuildStatusDefinition('xlsx-only-status')).toMatchObject({
      statusId: 'xlsx-only-status',
      statusName: '表格新增状态',
      statusCategory: 'playerBuff',
      durationMs: 1234,
      maxStacks: 2,
      effectLogicId: 'xlsx_only_logic',
    })
  })

  it('loads the 16 planner-defined warrior_t passive talent logic ids from player_build.xlsx', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    const overrides = parsePlayerBuildWorkbook(workbook)

    applyPlayerBuildWorkbookOverrides(overrides)

    const passiveTalentIds = [
      'warrior_t_reinforced_plates',
      'warrior_t_defensive_stance',
      'warrior_t_raise_banner',
      'warrior_t_snap_interrupt',
      'warrior_t_defenders_aegis',
      'warrior_t_barbaric_training',
      'warrior_t_bloodsurge',
      'warrior_t_focused_vigor',
      'warrior_t_honed_reflexes',
      'warrior_t_frothing_berserker',
      'warrior_t_punish',
      'warrior_t_enduring_defenses',
      'warrior_t_immortal_stance',
      'warrior_t_booming_voice',
      'warrior_t_rumbling_earth',
      'warrior_t_crackling_thunder',
    ]

    expect(passiveTalentIds.map((talentId) => getPassiveTalentDefinition(talentId)?.talentLogicId)).toEqual([
      'reinforced_plates',
      'defensive_stance',
      'raise_banner',
      'snap_interrupt',
      'defenders_aegis',
      'barbaric_training',
      'bloodsurge',
      'focused_vigor',
      'honed_reflexes',
      'frothing_berserker',
      'punish',
      'enduring_defenses',
      'immortal_stance',
      'booming_voice',
      'rumbling_earth',
      'crackling_thunder',
    ])
    expect(getPassiveTalentCatalog().filter((talent) => passiveTalentIds.includes(talent.id)).map((talent) => talent.id)).toEqual([
      'warrior_t_reinforced_plates',
      'warrior_t_snap_interrupt',
      'warrior_t_defensive_stance',
      'warrior_t_raise_banner',
      'warrior_t_defenders_aegis',
      'warrior_t_barbaric_training',
      'warrior_t_bloodsurge',
      'warrior_t_focused_vigor',
      'warrior_t_honed_reflexes',
      'warrior_t_frothing_berserker',
      'warrior_t_punish',
      'warrior_t_enduring_defenses',
      'warrior_t_immortal_stance',
      'warrior_t_booming_voice',
      'warrior_t_rumbling_earth',
      'warrior_t_crackling_thunder',
    ])

    const modifiers = getPassiveModifiers(passiveTalentIds)

    expect(modifiers).toMatchObject({
      playerMaxHpMultiplier: 1.5,
      partyMaxPressureMultiplier: 1.5,
      interruptIgnoresGcd: true,
      shieldWallMaxCharges: 2,
      partyDamageMultiplier: 1.5,
      partyThreatMultiplier: 0.7,
      partyPressureCanDriftDown: false,
      playerAutoAttackResourceGainBonus: 1,
      playerAutoAttackDamageBonus: 1,
      interruptVulnerabilityDurationMs: 5000,
      interruptVulnerabilityDamageTakenMultiplierBonus: 0.5,
      revengeRefundChance: 0.5,
      revengeRefundResource: 10,
      shieldSlamPunishDurationMs: 8000,
      shieldSlamPunishMaxStacks: 3,
      shieldSlamPunishOutgoingDamageReductionRatio: 0.1,
      shieldBlockDurationBonusMs: 3000,
      demoralizingShoutResourceGain: 50,
      shockwaveUsesMatrix3x3: true,
      thunderstruckDamageMultiplier: 3,
      thunderstruckThreatMultiplierOverride: 2,
    })
    expect(modifiers.playerPassiveBuffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'defensiveStance',
          damageReductionRatio: 0.1,
          damageReductionTypes: ['physical', 'magic'],
        }),
        expect.objectContaining({
          id: 'immortalStance',
          damageReductionRatio: 0.3,
          damageReductionTypes: ['physical', 'magic'],
          damageMultiplierBonus: -0.2,
        }),
      ]),
    )
    expect(getPlayerBuildStatusDefinition('punished')).toMatchObject({
      durationMs: 8000,
      maxStacks: 3,
      effectLogicId: 'enemyDebuff_punished',
    })
  })

  it('uses passive talent exclusive groups from player_build.xlsx when toggling talents', () => {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    const overrides = parsePlayerBuildWorkbook(workbook)

    applyPlayerBuildWorkbookOverrides(overrides)

    expect(getPassiveTalentDefinition('warrior_t_reinforced_plates')?.exclusiveGroup).toBe('1')
    expect(getPassiveTalentDefinition('warrior_t_raise_banner')?.exclusiveGroup).toBe('1')
    expect(getNextPassiveTalentIdsForToggle('warrior_t_raise_banner', ['warrior_t_reinforced_plates'])).toEqual([
      'warrior_t_raise_banner',
    ])
    expect(getNextPassiveTalentIdsForToggle('warrior_t_raise_banner', ['warrior_t_raise_banner'])).toEqual([])
  })
})
