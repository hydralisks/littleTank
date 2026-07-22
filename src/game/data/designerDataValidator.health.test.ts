import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { validateDesignerDataWorkbooks, type DesignerDataWorkbookMap } from './designerDataValidator'

type Row = Record<string, string | number | boolean>

const SHEETS = {
  areas: '\u533a\u57df',
  stages: '\u5173\u5361',
  legends: '\u56fe\u4f8b',
  openings: '\u5173\u5361\u5f00\u573a',
  placements: '\u654c\u4eba\u5e03\u7f6e',
  openingStatuses: '\u5f00\u573a\u72b6\u6001',
  affixBindings: '\u5173\u5361\u8bcd\u7f00\u7ed1\u5b9a',
  affixDefinitions: '\u8bcd\u7f00\u5b9a\u4e49',
  specialRuleBindings: '\u7279\u6b8a\u89c4\u5219\u7ed1\u5b9a',
  specialRuleDefinitions: '\u7279\u6b8a\u89c4\u5219\u5b9a\u4e49',
  enemyDefinitions: '\u654c\u4eba\u5b9a\u4e49',
  enemySkills: '\u654c\u4eba\u6280\u80fd',
  enemyBuffs: '\u654c\u65b9Buff',
  playerDebuffs: '\u73a9\u5bb6Debuff',
  partyDebuffs: '\u961f\u4f0dDebuff',
  iconMap: '\u56fe\u6807\u8d44\u6e90\u6620\u5c04',
  classDefinitions: '\u804c\u4e1a\u5b9a\u4e49',
  buildRules: '\u6784\u7b51\u89c4\u5219\u5b9a\u4e49',
  activeSkills: '\u4e3b\u52a8\u6280\u80fd\u5b9a\u4e49',
  activeEffects: '\u4e3b\u52a8\u6280\u80fd\u6548\u679c',
  activeStatuses: '\u73a9\u5bb6\u4e3b\u52a8\u72b6\u6001\u5b9a\u4e49',
  passiveTalents: '\u88ab\u52a8\u5929\u8d4b\u5b9a\u4e49',
  passiveEffects: '\u88ab\u52a8\u5929\u8d4b\u6548\u679c',
  passiveStatuses: '\u73a9\u5bb6\u88ab\u52a8\u72b6\u6001\u5b9a\u4e49',
  defaultActiveBuilds: '\u9ed8\u8ba4\u4e3b\u52a8\u6784\u7b51',
  defaultPassiveBuilds: '\u9ed8\u8ba4\u88ab\u52a8\u6784\u7b51',
}

function workbookFromSheets(sheets: Record<string, Row[]>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName)
  }
  return workbook
}

function emptySheet(headers: string[]): Row[] {
  return [Object.fromEntries(headers.map((header) => [header, '']))]
}

function stageRows(): Row[] {
  return Array.from({ length: 18 }, (_, index) => {
    const areaId = index < 6 ? 'harbor' : index < 12 ? 'midland' : 'highland'
    const order = (index % 6) + 1
    return {
      stageId: `${areaId}-${order}`,
      areaId,
      order,
      title: `${areaId}-${order}`,
      subtitle: 'test',
      strategyTips: index === 1 ? '' : 'tip',
      unlockedActiveSkillIdsCsv: index === 0 ? 'warrior_t_taunt' : '',
    }
  })
}

function createChallengeWorkbookMap() {
  const stages = Array.from({ length: 9 }, (_, index) => ({
    stageId: `Challenge-${index + 1}`,
    areaId: 'Challenge',
    order: index + 1,
    title: `Challenge-${index + 1}`,
    unlockedActiveSkillIdsCsv: 'warrior_t_taunt',
    passiveTalentUnlockTier: Math.floor(index / 3) + 1,
    challengeId: `CH-${index + 1}`,
    allowedClassIdsCsv: 'warrior_t',
    buildRuleId: 'standard_5slot',
    enabled: true,
  }))
  return {
    challengeStageContent: workbookFromSheets({
      [SHEETS.areas]: [{ areaId: 'Challenge', title: 'Challenge', shortTitle: 'CH', mapLabel: 'Challenge', description: 'test', accent: '#fff' }],
      [SHEETS.stages]: stages,
      [SHEETS.legends]: [{ areaId: 'Challenge', id: 'stable', iconId: 'stable', label: 'Stable', source: 'test', target: 'test', description: 'test' }],
    }),
    challengeEncounterBalance: workbookFromSheets({
      [SHEETS.openings]: stages.map((stage) => ({
        stageId: stage.stageId,
        playerHp: 100,
        playerMaxHp: 100,
        playerResource: 0,
        playerGcdRemainingMs: 0,
        partyHp: 100,
        partyMaxHp: 100,
        partyPressure: 0,
        partyMaxPressure: 100,
        buildRuleId: stage.buildRuleId,
      })),
      [SHEETS.placements]: emptySheet(['stageId', 'spawnId', 'enemyId', 'row', 'col']),
      [SHEETS.openingStatuses]: emptySheet(['stageId', 'targetType', 'statusId', 'sourceType']),
      [SHEETS.affixBindings]: emptySheet(['stageId', 'affixIdsCsv']),
      [SHEETS.affixDefinitions]: emptySheet(['affixId', 'affixName', 'iconId', 'description', 'delayMs', 'targetType', 'targetSelector', 'statusId']),
      [SHEETS.specialRuleBindings]: emptySheet(['stageId', 'ruleIdsCsv']),
      [SHEETS.specialRuleDefinitions]: emptySheet(['ruleId', 'ruleName', 'iconId', 'description', 'ruleLogicId']),
      [SHEETS.iconMap]: emptySheet(['iconId', 'iconName', 'assetKey', 'iconType']),
    }),
  }
}

function createWorkbookMap(): DesignerDataWorkbookMap {
  return {
    stageContent: workbookFromSheets({
      [SHEETS.areas]: [
        { areaId: 'harbor', title: 'Harbor', shortTitle: 'Harbor', mapLabel: 'Harbor', description: 'test', accent: '#fff' },
        { areaId: 'midland', title: 'Midland', shortTitle: 'Midland', mapLabel: 'Midland', description: 'test', accent: '#fff' },
        { areaId: 'highland', title: 'Highland', shortTitle: 'Highland', mapLabel: 'Highland', description: 'test', accent: '#fff' },
      ],
      [SHEETS.stages]: stageRows(),
      [SHEETS.legends]: [{ areaId: 'harbor', id: 'stable', iconId: 'stable', label: 'Stable', source: 'test', target: 'test', description: 'test' }],
    }),
    encounterBalance: workbookFromSheets({
      [SHEETS.openings]: [
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
        },
        {
          stageId: 'harbor-2',
          playerHp: 900,
          playerMaxHp: 1000,
          playerResource: 50,
          playerGcdRemainingMs: 0,
          partyHp: 900,
          partyMaxHp: 1000,
          partyPressure: 10,
          partyMaxPressure: 100,
          buildRuleId: 'standard_5slot',
        },
      ],
      [SHEETS.placements]: [{ stageId: 'harbor-1', spawnId: 'harbor-1-e01', enemyId: 'harbor_raider', row: 1, col: 1 }],
      [SHEETS.openingStatuses]: emptySheet(['stageId', 'targetType', 'statusId', 'sourceType']),
      [SHEETS.affixBindings]: emptySheet(['stageId', 'affixIdsCsv']),
      [SHEETS.affixDefinitions]: emptySheet(['affixId', 'affixName', 'iconId', 'description', 'delayMs', 'targetType', 'targetSelector', 'statusId']),
      [SHEETS.specialRuleBindings]: emptySheet(['stageId', 'ruleIdsCsv']),
      [SHEETS.specialRuleDefinitions]: emptySheet(['ruleId', 'ruleName', 'iconId', 'description', 'ruleLogicId']),
    }),
    enemyData: workbookFromSheets({
      [SHEETS.enemyDefinitions]: [{ enemyId: 'harbor_raider', name: 'Raider', baseMaxHp: 100, skillIdsCsv: 'bone-jab', skillCycleCsv: 'bone-jab', threatLogic: 'normal' }],
      [SHEETS.enemySkills]: [{ skillId: 'bone-jab', skillName: 'Bone Jab', targetRuleId: 'mostInjured', castTimeMs: 1000, recoveryMs: 500, damageType: 'physical', castBreakRule: 'controlOnly' }],
      [SHEETS.enemyBuffs]: emptySheet(['statusId', 'statusName', 'iconId', 'durationMs', 'isDispellable', 'description', 'effectLogicId']),
      [SHEETS.playerDebuffs]: emptySheet(['statusId', 'statusName', 'iconId', 'durationMs', 'isDispellable', 'description', 'effectLogicId']),
      [SHEETS.partyDebuffs]: emptySheet(['statusId', 'statusName', 'iconId', 'durationMs', 'isDispellable', 'description', 'effectLogicId']),
      [SHEETS.iconMap]: [
        { iconId: 'stable', iconName: 'Stable', assetKey: 'stable', iconType: 'status', enabled: true },
        { iconId: 'taunt', iconName: 'Taunt', assetKey: 'taunt', iconType: 'skill', enabled: true },
        { iconId: 'taunted', iconName: 'Taunted', assetKey: 'taunted', iconType: 'status', enabled: true },
        { iconId: 'vitalReserve', iconName: 'Vital Reserve', assetKey: 'guarded', iconType: 'talent', enabled: true },
      ],
    }),
    playerBuild: workbookFromSheets({
      [SHEETS.classDefinitions]: [{ classId: 'warrior_t', className: 'Warrior Tank', roleTag: 'tank', classDescription: 'test', recommendedBuildRuleIdsCsv: 'standard_5slot' }],
      [SHEETS.buildRules]: [{ buildRuleId: 'standard_5slot', classId: 'warrior_t', ruleName: 'Standard', description: 'test', totalBuildPoints: 28, maxActiveSlots: 5, enabledHotkeysCsv: '1,2,3,4,Q', inheritancePolicy: 'keep_active_first' }],
      [SHEETS.activeSkills]: [{ skillId: 'warrior_t_taunt', classId: 'warrior_t', skillName: 'Taunt', shortName: 'Taunt', description: 'test', iconId: 'taunt', pointCost: 4, resourceCost: 0, cooldownMs: 1000, gcdMs: 800, targetingType: 'currentEnemy', skillLogicId: 'taunt_single', castStopMode: 'none', canAffectSkull: true }],
      [SHEETS.activeEffects]: [{ skillEffectId: 'warrior_t_taunt_main', skillId: 'warrior_t_taunt', effectIndex: 1, targetSelector: 'current', statusId: 'taunted', durationMs: 1000, threatSource: 'player' }],
      [SHEETS.activeStatuses]: [{ statusId: 'taunted', statusName: 'Taunted', statusCategory: 'enemyDebuff', iconId: 'taunted', durationMs: 1000, maxStacks: 1, dispellable: false, description: 'test', effectLogicId: 'enemy_taunted' }],
      [SHEETS.passiveTalents]: [{ talentId: 'warrior_t_vital_reserve', classId: 'warrior_t', talentName: 'Vital Reserve', category: 'party', cost: 1, description: 'test', iconId: 'vitalReserve', talentLogicId: 'player_max_hp_up', tier: 0 }],
      [SHEETS.passiveEffects]: [{ talentEffectId: 'warrior_t_vital_reserve_main', talentId: 'warrior_t_vital_reserve', effectIndex: 1, talentLogicId: 'player_max_hp_up', targetScope: 'player' }],
      [SHEETS.passiveStatuses]: emptySheet(['statusId', 'statusName', 'statusCategory', 'iconId', 'durationMs', 'maxStacks', 'dispellable', 'description', 'effectLogicId']),
      [SHEETS.defaultActiveBuilds]: [{ presetId: 'standard_5slot', buildRuleId: 'standard_5slot', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 }],
      [SHEETS.defaultPassiveBuilds]: [{ presetId: 'standard_5slot', buildRuleId: 'standard_5slot', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 }],
      [SHEETS.iconMap]: [
        { iconId: 'taunt', iconName: 'Taunt', assetKey: 'taunt', iconType: 'skill', enabled: true },
        { iconId: 'taunted', iconName: 'Taunted', assetKey: 'taunted', iconType: 'status', enabled: true },
        { iconId: 'vitalReserve', iconName: 'Vital Reserve', assetKey: 'guarded', iconType: 'talent', enabled: true },
      ],
    }),
    ...createChallengeWorkbookMap(),
  }
}

describe('designerDataValidator health summary', () => {
  it('reports summary metrics and non-fatal stage coverage warnings', () => {
    const result = validateDesignerDataWorkbooks(createWorkbookMap())

    expect(result.valid).toBe(true)
    expect(result.summary.totalStages).toBe(18)
    expect(result.summary.totalOpenings).toBe(2)
    expect(result.summary.totalPlacements).toBe(1)
    expect(result.summary.issueCountsByCode).toEqual({})
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'stage_without_placements', value: 'harbor-2' }),
        expect.objectContaining({ code: 'missing_strategy_tips', value: 'harbor-2' }),
        expect.objectContaining({ code: 'stage_without_opening', value: 'harbor-3' }),
      ]),
    )
  })
})
