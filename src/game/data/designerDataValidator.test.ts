import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { validateDesignerDataWorkbooks, type DesignerDataWorkbookMap } from './designerDataValidator'

type Row = Record<string, string | number | boolean>

function workbookFromSheets(sheets: Record<string, Row[]>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()

  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName)
  }

  return workbook
}

function createStageRows(): Row[] {
  const rows: Row[] = []

  for (const areaId of ['harbor', 'midland', 'highland']) {
    for (let order = 1; order <= 6; order += 1) {
      rows.push({
        stageId: `${areaId}-${order}`,
        areaId,
        order,
        title: `${areaId}-${order}`,
        subtitle: 'test',
        unlockedActiveSkillIdsCsv: order === 1 && areaId === 'harbor' ? 'warrior_t_taunt' : '',
      })
    }
  }

  return rows
}

function createValidWorkbookMap(): DesignerDataWorkbookMap {
  return {
    stageContent: workbookFromSheets({
      '区域': [
        { areaId: 'harbor', title: 'Harbor', shortTitle: 'Harbor', mapLabel: 'Harbor', description: 'test', accent: '#fff' },
        { areaId: 'midland', title: 'Midland', shortTitle: 'Midland', mapLabel: 'Midland', description: 'test', accent: '#fff' },
        { areaId: 'highland', title: 'Highland', shortTitle: 'Highland', mapLabel: 'Highland', description: 'test', accent: '#fff' },
      ],
      '关卡': createStageRows(),
      '图例': [{ areaId: 'harbor', id: 'stable', iconId: 'stable', label: 'Stable', source: 'test', target: 'test', description: 'test' }],
    }),
    encounterBalance: workbookFromSheets({
      '关卡开场': [
        {
          stageId: 'harbor-1',
          playerHp: 900,
          playerMaxHp: 1000,
          playerResource: 50,
          playerGcdRemainingMs: 0,
          partyHp: 900,
          partyMaxHp: 1000,
          partyPressure: 10,
          partyMaxPressure: 100,
          buildRuleId: 'standard_5slot',
          playerAutoDamage: 5,
          playerAutoHeal: 6,
          partyAutoHeal: 7,
        },
      ],
      '敌人布置': [
        {
          stageId: 'harbor-1',
          spawnId: 'harbor-1-e01',
          enemyId: 'harbor_raider',
          row: 1,
          col: 1,
          openingCastSkillNum: 1,
          openingTankThreat: 84,
          openingAllyThreat: 28,
        },
      ],
      '开场状态': [
        {
          stageId: 'harbor-1',
          targetType: 'enemy',
          targetId: 'harbor-1-e01',
          statusId: 'ember-aegis',
          sourceType: 'manual',
        },
      ],
      '关卡词缀绑定': [{ stageId: 'harbor-1', affixIdsCsv: 'harbor_opening_guard' }],
      '词缀定义': [
        {
          affixId: 'harbor_opening_guard',
          affixName: 'Opening Guard',
          iconId: 'ember-aegis',
          description: 'test',
          delayMs: 1000,
          targetType: 'enemy',
          targetSelector: 'frontRow',
          statusId: 'ember-aegis',
          enabled: true,
        },
      ],
      '特殊规则绑定': [{ stageId: 'harbor-1', ruleIdsCsv: 'opening_pressure_shift' }],
      '特殊规则定义': [
        {
          ruleId: 'opening_pressure_shift',
          ruleName: 'Opening Pressure',
          iconId: 'battle-seal',
          description: 'test',
          ruleLogicId: 'opening_pressure_shift',
          enabled: true,
        },
      ],
    }),
    enemyData: workbookFromSheets({
      '敌人定义': [
        {
          enemyId: 'harbor_raider',
          name: 'Raider',
          baseMaxHp: 100,
          skillIdsCsv: 'bone-jab',
          skillCycleCsv: 'bone-jab',
          threatLogic: 'normal',
          counteredDurationMs: 1200,
          isSkull: false,
        },
      ],
      '敌人技能': [
        {
          skillId: 'bone-jab',
          skillName: 'Bone Jab',
          targetRuleId: 'mostInjured',
          castTimeMs: 1000,
          recoveryMs: 500,
          damageType: 'physical',
          playerDamage: 10,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIdsCsv: 'sundered',
          appliedSelfStatusIdsCsv: 'ember-aegis',
          castBreakRule: 'controlOnly',
          dangerLevel: 'low',
        },
      ],
      '敌方Buff': [
        {
          statusId: 'ember-aegis',
          statusName: 'Aegis',
          iconId: 'ember-aegis',
          durationMs: 1000,
          isDispellable: true,
          description: 'test',
          effectLogicId: 'none',
        },
      ],
      '玩家Debuff': [
        {
          statusId: 'sundered',
          statusName: 'Sundered',
          iconId: 'sundered',
          durationMs: 1000,
          isDispellable: true,
          description: 'test',
          effectLogicId: 'none',
        },
      ],
      '队伍Debuff': [
        {
          statusId: 'formation-break',
          statusName: 'Formation Break',
          iconId: 'formation-break',
          durationMs: 1000,
          isDispellable: false,
          description: 'test',
          effectLogicId: 'none',
        },
      ],
      '图标资源映射': [
        { iconId: 'stable', iconName: 'Stable', assetKey: 'stable', iconType: 'status', enabled: true },
        { iconId: 'battle-seal', iconName: 'Battle Seal', assetKey: 'battle-seal', iconType: 'rule', enabled: true },
        { iconId: 'ember-aegis', iconName: 'Aegis', assetKey: 'ember-aegis', iconType: 'status', enabled: true },
        { iconId: 'sundered', iconName: 'Sundered', assetKey: 'sundered', iconType: 'status', enabled: true },
        { iconId: 'formation-break', iconName: 'Formation Break', assetKey: 'sundered', iconType: 'status', enabled: true },
      ],
    }),
    playerBuild: workbookFromSheets({
      '职业定义': [
        {
          classId: 'warrior_t',
          className: 'Warrior Tank',
          roleTag: 'tank',
          classDescription: 'test',
          recommendedBuildRuleIdsCsv: 'standard_5slot',
          enabled: true,
        },
      ],
      '构筑规则定义': [
        {
          buildRuleId: 'standard_5slot',
          classId: 'warrior_t',
          ruleName: 'Standard',
          description: 'test',
          totalBuildPoints: 28,
          maxActiveSlots: 5,
          enabledHotkeysCsv: '1,2,3,4,Q',
          inheritancePolicy: 'keep_active_first',
          enabled: true,
        },
      ],
      '主动技能定义': [
        {
          skillId: 'warrior_t_taunt',
          classId: 'warrior_t',
          skillName: 'Taunt',
          shortName: 'Taunt',
          description: 'test',
          iconId: 'taunt',
          pointCost: 4,
          resourceCost: 0,
          cooldownMs: 1000,
          gcdMs: 800,
          targetingType: 'currentEnemy',
          skillLogicId: 'taunt_single',
          castStopMode: 'none',
          canAffectSkull: true,
          enabled: true,
        },
      ],
      '主动技能效果': [
        {
          skillEffectId: 'warrior_t_taunt_main',
          skillId: 'warrior_t_taunt',
          effectIndex: 1,
          targetSelector: 'current',
          statusId: 'taunted',
          durationMs: 1000,
          threatSource: 'player',
          enabled: true,
        },
      ],
      '玩家主动状态定义': [
        {
          statusId: 'taunted',
          statusName: 'Taunted',
          statusCategory: 'enemyDebuff',
          iconId: 'taunted',
          durationMs: 1000,
          maxStacks: 1,
          dispellable: false,
          description: 'test',
          effectLogicId: 'enemy_taunted',
          enabled: true,
        },
      ],
      '被动天赋定义': [
        {
          talentId: 'warrior_t_vital_reserve',
          classId: 'warrior_t',
          talentName: 'Vital Reserve',
          category: 'party',
          cost: 1,
          description: 'test',
          iconId: 'vitalReserve',
          talentLogicId: 'player_max_hp_up',
          tier: 0,
          enabled: true,
        },
      ],
      '被动天赋效果': [
        {
          talentEffectId: 'warrior_t_vital_reserve_main',
          talentId: 'warrior_t_vital_reserve',
          effectIndex: 1,
          talentLogicId: 'player_max_hp_up',
          targetScope: 'player',
          enabled: true,
        },
      ],
      '玩家被动状态定义': [
        {
          statusId: 'vanguard-oath',
          statusName: 'Vanguard Oath',
          statusCategory: 'playerBuff',
          iconId: 'vanguard-oath',
          durationMs: 0,
          maxStacks: 1,
          dispellable: false,
          description: 'test',
          effectLogicId: 'player_damage_reduction',
          enabled: true,
        },
      ],
      '默认主动构筑': [
        {
          presetId: 'standard_5slot',
          buildRuleId: 'standard_5slot',
          classId: 'warrior_t',
          hotkey: '1',
          skillId: 'warrior_t_taunt',
          priority: 1,
        },
      ],
      '默认被动构筑': [
        {
          presetId: 'standard_5slot',
          buildRuleId: 'standard_5slot',
          classId: 'warrior_t',
          talentId: 'warrior_t_vital_reserve',
          selected: true,
          priority: 1,
        },
      ],
      '图标资源映射': [
        { iconId: 'taunt', iconName: 'Taunt', assetKey: 'taunt', iconType: 'skill', enabled: true },
        { iconId: 'taunted', iconName: 'Taunted', assetKey: 'taunted', iconType: 'status', enabled: true },
        { iconId: 'vitalReserve', iconName: 'Vital Reserve', assetKey: 'guarded', iconType: 'talent', enabled: true },
        { iconId: 'vanguard-oath', iconName: 'Vanguard Oath', assetKey: 'vanguard-oath', iconType: 'status', enabled: true },
      ],
    }),
  }
}

describe('designerDataValidator', () => {
  it('accepts mostInjured and optional encounter opening auto fields', () => {
    const result = validateDesignerDataWorkbooks(createValidWorkbookMap())

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('accepts a blank compatibility classId on shared build rules', () => {
    const workbooks = createValidWorkbookMap()
    const ruleRows = XLSX.utils.sheet_to_json<Row>(workbooks.playerBuild.Sheets['构筑规则定义'], { defval: '' })
    ruleRows[0].classId = ''
    workbooks.playerBuild.Sheets['构筑规则定义'] = XLSX.utils.json_to_sheet(ruleRows)

    const result = validateDesignerDataWorkbooks(workbooks)

    expect(result.errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sheet: '构筑规则定义', field: 'classId' }),
    ]))
  })

  it('rejects invalid target rules and invalid auto opening numbers', () => {
    const workbooks = createValidWorkbookMap()
    const skillRows = XLSX.utils.sheet_to_json<Row>(workbooks.enemyData.Sheets['敌人技能'], { defval: '' })
    skillRows[0].targetRuleId = 'bad-target-rule'
    workbooks.enemyData.Sheets['敌人技能'] = XLSX.utils.json_to_sheet(skillRows)

    const openingRows = XLSX.utils.sheet_to_json<Row>(workbooks.encounterBalance.Sheets['关卡开场'], { defval: '' })
    openingRows[0].playerAutoDamage = 'bad-auto-damage'
    openingRows[0].playerAutoHeal = -1
    workbooks.encounterBalance.Sheets['关卡开场'] = XLSX.utils.json_to_sheet(openingRows)

    const result = validateDesignerDataWorkbooks(workbooks)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'targetRuleId', code: 'invalid_enum', value: 'bad-target-rule' }),
        expect.objectContaining({ field: 'playerAutoDamage', code: 'invalid_number', value: 'bad-auto-damage' }),
        expect.objectContaining({ field: 'playerAutoHeal', code: 'invalid_range', value: '-1' }),
      ]),
    )
  })

  it('rejects invalid structured status, affix, and special rule parameters', () => {
    const workbooks = createValidWorkbookMap()

    const enemyBuffSheet = workbooks.enemyData.Sheets[workbooks.enemyData.SheetNames[2]]
    const enemyBuffRows = XLSX.utils.sheet_to_json<Row>(enemyBuffSheet, { defval: '' })
    enemyBuffRows[0].valueA = 'bad-status-value'
    enemyBuffRows[0].tickIntervalMs = -1
    workbooks.enemyData.Sheets[workbooks.enemyData.SheetNames[2]] = XLSX.utils.json_to_sheet(enemyBuffRows)

    const affixSheet = workbooks.encounterBalance.Sheets[workbooks.encounterBalance.SheetNames[4]]
    const affixRows = XLSX.utils.sheet_to_json<Row>(affixSheet, { defval: '' })
    affixRows[0].valueB = 'bad-affix-value'
    workbooks.encounterBalance.Sheets[workbooks.encounterBalance.SheetNames[4]] = XLSX.utils.json_to_sheet(affixRows)

    const ruleSheet = workbooks.encounterBalance.Sheets[workbooks.encounterBalance.SheetNames[6]]
    const ruleRows = XLSX.utils.sheet_to_json<Row>(ruleSheet, { defval: '' })
    ruleRows[0].tickIntervalMs = -5
    workbooks.encounterBalance.Sheets[workbooks.encounterBalance.SheetNames[6]] = XLSX.utils.json_to_sheet(ruleRows)

    const result = validateDesignerDataWorkbooks(workbooks)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'valueA', code: 'invalid_number', value: 'bad-status-value' }),
        expect.objectContaining({ field: 'tickIntervalMs', code: 'invalid_range', value: '-1' }),
        expect.objectContaining({ field: 'valueB', code: 'invalid_number', value: 'bad-affix-value' }),
        expect.objectContaining({ field: 'tickIntervalMs', code: 'invalid_range', value: '-5' }),
      ]),
    )
  })

  it('rejects mechanism parameter combinations that cannot take effect', () => {
    const workbooks = createValidWorkbookMap()

    const enemySkillSheet = workbooks.enemyData.Sheets['敌人技能']
    const enemySkillRows = XLSX.utils.sheet_to_json<Row>(enemySkillSheet, { defval: '' })
    enemySkillRows[0].castTimeMs = 0
    enemySkillRows[0].castBreakRule = 'interruptOrControl'
    enemySkillRows[0].appliedTargetStatusIdsCsv = 'sundered'
    workbooks.enemyData.Sheets['敌人技能'] = XLSX.utils.json_to_sheet(enemySkillRows)

    const playerDebuffSheet = workbooks.enemyData.Sheets['玩家Debuff']
    const playerDebuffRows = XLSX.utils.sheet_to_json<Row>(playerDebuffSheet, { defval: '' })
    playerDebuffRows[0].durationMs = 0
    workbooks.enemyData.Sheets['玩家Debuff'] = XLSX.utils.json_to_sheet(playerDebuffRows)

    const activeEffectSheet = workbooks.playerBuild.Sheets['主动技能效果']
    const activeEffectRows = XLSX.utils.sheet_to_json<Row>(activeEffectSheet, { defval: '' })
    activeEffectRows[0].statusId = 'taunted'
    activeEffectRows[0].durationMs = 0
    workbooks.playerBuild.Sheets['主动技能效果'] = XLSX.utils.json_to_sheet(activeEffectRows)

    const affixSheet = workbooks.encounterBalance.Sheets['词缀定义']
    const affixRows = XLSX.utils.sheet_to_json<Row>(affixSheet, { defval: '' })
    affixRows[0].statusId = ''
    workbooks.encounterBalance.Sheets['词缀定义'] = XLSX.utils.json_to_sheet(affixRows)

    const result = validateDesignerDataWorkbooks(workbooks)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: '敌人技能',
          field: 'castBreakRule',
          code: 'invalid_combination',
          value: 'interruptOrControl requires castTimeMs or channelingMs',
        }),
        expect.objectContaining({
          sheet: '玩家Debuff',
          field: 'durationMs',
          code: 'invalid_combination',
          value: 'status used by enemy skill requires durationMs',
        }),
        expect.objectContaining({
          sheet: '主动技能效果',
          field: 'durationMs',
          code: 'invalid_combination',
          value: 'status effect requires positive durationMs',
        }),
        expect.objectContaining({
          sheet: '词缀定义',
          field: 'statusId',
          code: 'missing_required',
        }),
      ]),
    )
  })

  it('rejects missing required parameters for known effect logic ids', () => {
    const workbooks = createValidWorkbookMap()

    const enemyBuffSheet = workbooks.enemyData.Sheets['敌方Buff']
    const enemyBuffRows = XLSX.utils.sheet_to_json<Row>(enemyBuffSheet, { defval: '' })
    enemyBuffRows[0].effectLogicId = 'enemy_heal_small'
    enemyBuffRows[0].valueA = ''
    workbooks.enemyData.Sheets['敌方Buff'] = XLSX.utils.json_to_sheet(enemyBuffRows)

    const partyDebuffSheet = workbooks.enemyData.Sheets['队伍Debuff']
    const partyDebuffRows = XLSX.utils.sheet_to_json<Row>(partyDebuffSheet, { defval: '' })
    partyDebuffRows[0].effectLogicId = 'wind_strike!_status'
    partyDebuffRows[0].valueA = 5
    partyDebuffRows[0].tickIntervalMs = ''
    workbooks.enemyData.Sheets['队伍Debuff'] = XLSX.utils.json_to_sheet(partyDebuffRows)

    const specialRuleSheet = workbooks.encounterBalance.Sheets['特殊规则定义']
    const specialRuleRows = XLSX.utils.sheet_to_json<Row>(specialRuleSheet, { defval: '' })
    specialRuleRows[0].ruleLogicId = 'andThen'
    specialRuleRows[0].valueA = ''
    workbooks.encounterBalance.Sheets['特殊规则定义'] = XLSX.utils.json_to_sheet(specialRuleRows)

    const result = validateDesignerDataWorkbooks(workbooks)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: '敌方Buff',
          field: 'valueA',
          code: 'missing_required',
          value: 'enemy_heal_small requires valueA',
        }),
        expect.objectContaining({
          sheet: '队伍Debuff',
          field: 'tickIntervalMs',
          code: 'missing_required',
          value: 'wind_strike!_status requires tickIntervalMs',
        }),
        expect.objectContaining({
          sheet: '特殊规则定义',
          field: 'valueA',
          code: 'missing_required',
          value: 'andThen requires valueA',
        }),
      ]),
    )
  })
})
