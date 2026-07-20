import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  appendEncounterWorkbookOverrides,
  applyEncounterWorkbookOverrides,
  getStageBuildRuleId,
} from './encounterTemplates'
import { applyStageWorkbookOverrides, getUnlockedActiveSkillIdsForStage } from './stageTemplates'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parseStageWorkbook,
  resolveDesignerDataSource,
} from './workbookLoader'
import { getStageById } from './stageTemplates'
import type { StageNumber } from './stageTemplates'

describe('resolveDesignerDataSource', () => {
  it('uses desktop data pack when the desktop runtime flag is set', () => {
    expect(resolveDesignerDataSource(true)).toBe('desktop')
  })

  it('uses web xlsx loading when the desktop runtime flag is absent', () => {
    expect(resolveDesignerDataSource(false)).toBe('web')
  })
})

describe('parseStageWorkbook', () => {
  it('reads optional strategy tips from stage rows', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '区域')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        stageId: 'RingingDeeps-6',
        areaId: 'RingingDeeps',
        order: 6,
        title: '蜡烛之王',
        strategyTips: '让蜡像和暗影之锄打在同一侧',
      },
    ]), '关卡')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '图例')

    const overrides = parseStageWorkbook(workbook)

    expect(overrides.stageOverrides[0]).toMatchObject({
      stageId: 'RingingDeeps-6',
      strategyTips: '让蜡像和暗影之锄打在同一侧',
    })
  })

  it('reads challenge stage metadata from stage rows', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '区域')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        stageId: 'Challenge-1',
        areaId: 'Challenge',
        order: 1,
        title: '鱼人登陆队',
        challengeId: 'CH-1',
        recommendedDifficulty: 'balanced',
        allowedClassIdsCsv: 'warrior_t',
        enemySummary: '鱼人斥候、鱼人猎潮者',
        unlockedActiveSkillIdsCsv: 'warrior_t_taunt,warrior_t_interrupt',
        passiveTalentUnlockTier: 1,
      },
    ]), '关卡')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '图例')

    const overrides = parseStageWorkbook(workbook)

    expect(overrides.stageOverrides[0]).toMatchObject({
      stageId: 'Challenge-1',
      challengeId: 'CH-1',
      recommendedDifficulty: 'balanced',
      allowedClassIds: ['warrior_t'],
      enemySummary: '鱼人斥候、鱼人猎潮者',
      unlockedActiveSkillIds: ['warrior_t_taunt', 'warrior_t_interrupt'],
      passiveTalentUnlockTier: 1,
    })
  })
})

describe('parseEnemyWorkbook', () => {
  it('reads structured status parameters from enemy status sheets', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '敌人定义')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '敌人技能')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        statusId: 'murloc_healing',
        statusName: '鱼人在治疗',
        iconId: 'murlocHealing_status_pic',
        durationMs: 0,
        isDispellable: false,
        description: '使得目标立刻回复75生命值',
        effectLogicId: 'murlocHealing_status',
        valueA: 75,
      },
      {
        statusId: 'windStrike!',
        statusName: '疾风连击！',
        iconId: 'windStrike!_status_pic',
        durationMs: 3000,
        isDispellable: false,
        description: '每0.5秒对当前目标造成5点伤害',
        effectLogicId: 'wind_strike!_status',
        valueA: 5,
        tickIntervalMs: 500,
      },
    ]), '敌方Buff')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        statusId: 'battleHunger',
        statusName: '战斗饥渴',
        iconId: 'battleHunger_status_pic',
        durationMs: -1,
        isDispellable: false,
        description: '玩家持续受到每秒5%最大生命值的物理伤害',
        effectLogicId: 'battleHunger_status',
        valueA: 0.05,
        tickIntervalMs: 1000,
      },
    ]), '玩家Debuff')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        statusId: 'sensitive',
        statusName: '敏感吗',
        iconId: 'sensitive_status_pic',
        durationMs: -1,
        isDispellable: false,
        description: '队伍被敌人攻击命中后额外增加10点压力',
        effectLogicId: 'sensitive_status',
        valueA: 10,
      },
    ]), '队伍Debuff')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '图标资源映射')

    const overrides = parseEnemyWorkbook(workbook)

    expect(overrides.enemyBuffDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: 'murloc_healing', valueA: 75 }),
        expect.objectContaining({ statusId: 'windStrike!', valueA: 5, tickIntervalMs: 500 }),
      ]),
    )
    expect(overrides.playerDebuffDefinitions[0]).toMatchObject({
      statusId: 'battleHunger',
      valueA: 0.05,
      tickIntervalMs: 1000,
    })
    expect(overrides.partyDebuffDefinitions[0]).toMatchObject({
      statusId: 'sensitive',
      valueA: 10,
    })
  })
})

describe('parseEncounterWorkbook', () => {
  it('reads structured parameters from affix and special rule definitions', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '关卡开场')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '敌人布置')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '开场状态')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '关卡词缀绑定')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        affixId: 'affix_dislike',
        affixName: '它们不喜欢你',
        iconId: 'dislike_affix_pic',
        description: '你的队伍开场的三次攻击会产生5倍仇恨',
        delayMs: 0,
        targetType: 'party',
        targetSelector: 'party',
        statusId: 'disliked',
        durationMsOverride: -1,
        stacks: 1,
        valueA: 3,
        valueB: 5,
        tickIntervalMs: 0,
        enabled: true,
      },
    ]), '词缀定义')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '特殊规则绑定')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        ruleId: 'andThen',
        ruleName: '然后呢',
        iconId: 'andThen_rule_pic',
        description: '15秒后如果没有敌人死亡，则给于玩家“战斗饥渴”debuff。任意敌人死亡后重置20秒倒计时',
        ruleLogicId: 'andThen',
        grantedStatusIdsCsv: 'battleHunger',
        valueA: 15000,
        valueB: 20000,
        tickIntervalMs: 0,
        enabled: true,
      },
    ]), '特殊规则定义')

    const overrides = parseEncounterWorkbook(workbook)

    expect(overrides.affixDefinitions.affix_dislike).toMatchObject({
      valueA: 3,
      valueB: 5,
      tickIntervalMs: 0,
    })
    expect(overrides.specialRuleDefinitions.andThen).toMatchObject({
      valueA: 15000,
      valueB: 20000,
      tickIntervalMs: 0,
    })
  })
})

describe('encounter workbook mode boundaries', () => {
  function stageNumberForTest(stageId: string): StageNumber {
    const value = Number(stageId.split('-')[1] ?? 1)
    return Math.min(6, Math.max(1, value)) as StageNumber
  }

  it('keeps story build rules when challenge encounter overrides are appended', () => {
    applyEncounterWorkbookOverrides({
      openingOverrides: {
        'harbor-1': { buildRuleId: 'story_rule' },
      },
      placementOverrides: {},
      openingStatusOverrides: {},
      affixBindings: {},
      affixDefinitions: {},
      specialRuleBindings: {},
      specialRuleDefinitions: {},
    })

    appendEncounterWorkbookOverrides({
      openingOverrides: {
        'Challenge-1': { buildRuleId: 'challenge_rule' },
      },
      placementOverrides: {},
      openingStatusOverrides: {},
      affixBindings: {},
      affixDefinitions: {},
      specialRuleBindings: {},
      specialRuleDefinitions: {},
    }, { stageIdPrefix: 'Challenge-' })

    expect(getStageBuildRuleId(getStageById('harbor-1'))).toBe('story_rule')
    expect(getStageBuildRuleId({
      ...getStageById('harbor-1'),
      id: 'Challenge-1',
      areaId: 'Challenge',
      stageNumber: 1,
    })).toBe('challenge_rule')
  })

  it('does not change story workbook build rules when challenge workbook data is appended', () => {
    const storyEncounterWorkbook = XLSX.readFile('public/designer-data/encounter_balance.xlsx')
    const challengeEncounterWorkbook = XLSX.readFile('public/designer-data/challenge_encounter_balance.xlsx')

    applyEncounterWorkbookOverrides(parseEncounterWorkbook(storyEncounterWorkbook))
    const storyBuildRuleIds = ['RingingDeeps-1', 'RingingDeeps-4', 'WestFall-6'].map((stageId) =>
      getStageBuildRuleId({
        ...getStageById('harbor-1'),
        id: stageId,
        areaId: stageId.startsWith('WestFall') ? 'WestFall' : 'RingingDeeps',
        stageNumber: stageNumberForTest(stageId),
      }),
    )

    appendEncounterWorkbookOverrides(
      parseEncounterWorkbook(challengeEncounterWorkbook),
      { stageIdPrefix: 'Challenge-' },
    )

    const afterChallengeAppendBuildRuleIds = ['RingingDeeps-1', 'RingingDeeps-4', 'WestFall-6'].map((stageId) =>
      getStageBuildRuleId({
        ...getStageById('harbor-1'),
        id: stageId,
        areaId: stageId.startsWith('WestFall') ? 'WestFall' : 'RingingDeeps',
        stageNumber: stageNumberForTest(stageId),
      }),
    )

    expect(afterChallengeAppendBuildRuleIds).toEqual(storyBuildRuleIds)
  })
})

describe('challenge stage workbook mode boundaries', () => {
  it('uses only explicit challenge unlock fields instead of deriving them from source story stages', () => {
    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'RingingDeeps', title: 'RingingDeeps' },
        { areaId: 'Challenge', title: 'Challenge' },
      ],
      stageOverrides: [
        {
          stageId: 'RingingDeeps-1',
          areaId: 'RingingDeeps',
          order: 1,
          unlockedActiveSkillIds: ['warrior_t_taunt'],
        },
      ],
      legendOverrides: [],
    })

    applyStageWorkbookOverrides({
      areaOverrides: [
        { areaId: 'Challenge', title: 'Challenge' },
      ],
      stageOverrides: [
        {
          stageId: 'Challenge-1',
          areaId: 'Challenge',
          order: 1,
          unlockedActiveSkillIds: [],
          passiveTalentUnlockTier: -1,
        },
      ],
      legendOverrides: [],
      updateCampaignOrder: false,
    })

    const challengeStage = getStageById('Challenge-1')

    expect(getUnlockedActiveSkillIdsForStage(challengeStage)).toEqual([])
  })
})
