import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parseStageWorkbook,
  resolveDesignerDataSource,
} from './workbookLoader'

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
