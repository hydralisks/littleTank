import { afterEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseStageWorkbook } from '../data/workbookLoader'
import {
  applyStageWorkbookOverrides,
  campaignStageOrder,
  getStageById,
} from '../data/stageTemplates'
import {
  createEmptyClassProgression,
  recordStageVictory,
} from '../progression/classProgression'
import { getAvailableClassIdsForStage } from '../progression/stageClassAvailability'

const BEAR_SKILLS = [
  'druid_bear_t_growl',
  'druid_bear_t_mangle',
  'druid_bear_t_thrash',
  'druid_bear_t_skull_bash',
  'druid_bear_t_ironfur',
  'druid_bear_t_frenzied_regeneration',
  'druid_bear_t_swipe',
  'druid_bear_t_moonfire',
  'druid_bear_t_barkskin',
  'druid_bear_t_rage_of_the_sleeper',
  'druid_bear_t_lunar_beam',
  'druid_bear_t_incarnation_ursoc',
  'druid_bear_t_survival_instincts',
  'druid_bear_t_regrowth',
  'druid_bear_t_berserk',
  'druid_bear_t_roar',
] as const

const WARRIOR_ONLY_TERMS = [
  '挑战怒吼',
  '复仇',
  '盾墙',
  '盾牌格挡',
  '盾牌反射',
  '盾牌猛击',
  '无视苦痛',
  '风暴之锤',
  '拳击',
]

function readChallengeRows() {
  const workbook = XLSX.readFile('public/designer-data/challenge_stage_content.xlsx')
  const sheet = workbook.Sheets['关卡']
  if (!sheet) {
    throw new Error('Missing 关卡 sheet')
  }
  return XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })
    .filter((row) => /^Challenge-[1-9]$/.test(String(row.stageId)))
}

function readCampaignRows() {
  const workbook = XLSX.readFile('public/designer-data/stage_content.xlsx')
  const sheet = workbook.Sheets['关卡']
  if (!sheet) {
    throw new Error('Missing 关卡 sheet')
  }
  return XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })
}

function parseCsv(value: string | number) {
  return String(value).split(',').map((entry) => entry.trim()).filter(Boolean)
}

function readSheetRows(fileName: string, sheetName: string) {
  const workbook = XLSX.readFile(`public/designer-data/${fileName}`)
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Missing ${sheetName} sheet in ${fileName}`)
  }
  return XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' })
}

describe('Bear T challenge workbook snapshots', () => {
  afterEach(() => {
    applyStageWorkbookOverrides({
      areaOverrides: [],
      stageOverrides: [],
      legendOverrides: [],
    })
  })

  it.each([
    { first: 1, last: 3, buildRuleId: 'standard_5slot', tier: 1, bearSkillCount: 5 },
    { first: 4, last: 6, buildRuleId: '8slot_0', tier: 2, bearSkillCount: 10 },
    { first: 7, last: 9, buildRuleId: '8slot_2', tier: 3, bearSkillCount: 16 },
  ])('keeps Challenge $first-$last on the cumulative bear snapshot', ({ first, last, buildRuleId, tier, bearSkillCount }) => {
    const rows = readChallengeRows()

    for (let stageNumber = first; stageNumber <= last; stageNumber += 1) {
      const row = rows.find((entry) => entry.stageId === `Challenge-${stageNumber}`)
      expect(row, `Challenge-${stageNumber}`).toBeDefined()
      expect(row?.buildRuleId).toBe(buildRuleId)
      expect(Number(row?.passiveTalentUnlockTier)).toBe(tier)
      expect(parseCsv(row?.allowedClassIdsCsv ?? '')).toEqual(['warrior_t', 'druid_bear_t'])

      const unlockedSkillIds = parseCsv(row?.unlockedActiveSkillIdsCsv ?? '')
      expect(unlockedSkillIds.filter((skillId) => skillId.startsWith('druid_bear_t_')))
        .toEqual(BEAR_SKILLS.slice(0, bearSkillCount))
      expect(unlockedSkillIds.some((skillId) => skillId.startsWith('warrior_t_'))).toBe(true)
    }
  })

  it.each([
    { stageId: 'RingingDeeps-6', bearSkillCount: 5 },
    { stageId: 'WestFall-1', bearSkillCount: 7 },
    { stageId: 'WestFall-3', bearSkillCount: 9 },
    { stageId: 'WestFall-5', bearSkillCount: 10 },
    { stageId: "Zul'Aman-1", bearSkillCount: 11 },
    { stageId: "Zul'Aman-2", bearSkillCount: 12 },
    { stageId: "Zul'Aman-3", bearSkillCount: 13 },
    { stageId: "Zul'Aman-5", bearSkillCount: 16 },
  ])('keeps $stageId on the approved cumulative Bear campaign snapshot', ({ stageId, bearSkillCount }) => {
    applyStageWorkbookOverrides(parseStageWorkbook(
      XLSX.readFile('public/designer-data/stage_content.xlsx'),
    ))

    const unlockedSkillIds = campaignStageOrder
      .slice(0, campaignStageOrder.indexOf(stageId) + 1)
      .flatMap((campaignStageId) => {
        const row = readCampaignRows().find((entry) => entry.stageId === campaignStageId)
        return parseCsv(row?.unlockedActiveSkillIdsCsv ?? '')
      })
    const bearSkillIds = [...new Set(unlockedSkillIds.filter((skillId) => skillId.startsWith('druid_bear_t_')))]

    expect(bearSkillIds).toEqual(BEAR_SKILLS.slice(0, bearSkillCount))
  })

  it('uses class-neutral challenge guidance after adding Bear T', () => {
    for (const row of readChallengeRows()) {
      const guidance = [
        row.strategyTips,
        row.recommendedActiveSkillNamesCsv,
        row.recommendedPassiveTalentNamesCsv,
      ].join(',')
      for (const term of WARRIOR_ONLY_TERMS) {
        expect(guidance, `${row.stageId} contains ${term}`).not.toContain(term)
      }
    }
  })

  it('keeps the first Bear trial group compatible with its five-skill toolkit', () => {
    const affix = readSheetRows('challenge_encounter_balance.xlsx', '词缀定义')
      .find((row) => row.affixId === 'affix_dislike')
    const placements = readSheetRows('challenge_encounter_balance.xlsx', '敌人布置')
    const openings = readSheetRows('challenge_encounter_balance.xlsx', '关卡开场')
    const affixBindings = readSheetRows('challenge_encounter_balance.xlsx', '关卡词缀绑定')
    const activeEffects = readSheetRows('player_build.xlsx', '主动技能效果')

    expect(Number(affix?.valueA)).toBe(3)
    expect(Number(affix?.valueB)).toBe(2)
    expect(String(affix?.description)).toContain('2倍仇恨')
    expect(placements.find((row) => row.spawnId === 'Challenge-2-e03')?.enemyId).toBe('murloc_tidehunter')
    expect(placements.find((row) => row.spawnId === 'Challenge-2-e01')?.enemyId).toBe('kobold_miner')
    expect(placements.find((row) => row.spawnId === 'Challenge-2-e02')?.enemyId).toBe('kobold_apprentice')
    expect(placements.find((row) => row.spawnId === 'Challenge-3-e03')?.enemyId).toBe('murloc_tidehunter')
    expect(placements.find((row) => row.spawnId === 'Challenge-3-e04')?.enemyId).toBe('coldlight_seer')
    expect(placements.filter((row) => String(row.spawnId).startsWith('Challenge-1-')).map((row) => (
      Number(row.hpOverride)
    ))).toEqual([80, 80, 120, 120, 160])
    expect(Number(activeEffects.find((row) => row.skillEffectId === 'druid_bear_t_ironfur_main')?.valueA)).toBe(20)
    expect(openings.find((row) => row.stageId === 'Challenge-2')).toMatchObject({
      playerHp: '140',
      playerMaxHp: '140',
      playerAutoHeal: '3',
    })
    expect(openings.find((row) => row.stageId === 'Challenge-3')).toMatchObject({
      playerHp: '180',
      playerMaxHp: '180',
      playerAutoHeal: '5',
    })
    expect(openings.find((row) => row.stageId === 'Challenge-1')?.playerAutoHeal).toBe('3')
    expect(affixBindings.find((row) => row.stageId === 'Challenge-1')?.affixIdsCsv).toBe('affix_oldGrudge')
  })

  it('uses the real workbook for the Bear trial, campaign unlock, and cumulative challenges', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(
      XLSX.readFile('public/designer-data/stage_content.xlsx'),
    ))
    applyStageWorkbookOverrides(parseStageWorkbook(
      XLSX.readFile('public/designer-data/challenge_stage_content.xlsx'),
    ))
    const registeredClassIds = ['warrior_t', 'druid_bear_t']
    const enabledClassIds = ['warrior_t', 'druid_bear_t']
    const ringingDeepsEndIndex = campaignStageOrder.indexOf('RingingDeeps-6')
    const westFallEndIndex = campaignStageOrder.indexOf('WestFall-6')
    const zulAmanEndIndex = campaignStageOrder.indexOf("Zul'Aman-6")
    let progression = createEmptyClassProgression()

    expect(getAvailableClassIdsForStage(getStageById('Challenge-1'), {
      ...progression,
      highestClearedCampaignStageIndex: ringingDeepsEndIndex - 1,
      registeredClassIds,
      enabledClassIds,
    })).toEqual([])
    expect(getAvailableClassIdsForStage(getStageById('Challenge-1'), {
      ...progression,
      highestClearedCampaignStageIndex: ringingDeepsEndIndex,
      registeredClassIds,
      enabledClassIds,
    })).toEqual(['warrior_t', 'druid_bear_t'])

    progression = recordStageVictory(progression, { mode: 'challenge', stageId: 'Challenge-1', classId: 'druid_bear_t' })
    progression = recordStageVictory(progression, { mode: 'challenge', stageId: 'Challenge-2', classId: 'druid_bear_t' })
    expect(progression.campaignUnlockedClassIds).toEqual(['warrior_t'])
    progression = recordStageVictory(progression, { mode: 'challenge', stageId: 'Challenge-3', classId: 'druid_bear_t' })
    expect(progression.campaignUnlockedClassIds).toEqual(['warrior_t', 'druid_bear_t'])

    expect(getAvailableClassIdsForStage(getStageById('WestFall-1'), {
      ...progression,
      highestClearedCampaignStageIndex: ringingDeepsEndIndex,
      registeredClassIds,
      enabledClassIds,
    })).toEqual(['warrior_t', 'druid_bear_t'])
    expect(getAvailableClassIdsForStage(getStageById('Challenge-4'), {
      ...progression,
      highestClearedCampaignStageIndex: westFallEndIndex,
      registeredClassIds,
      enabledClassIds,
    })).toEqual(['warrior_t', 'druid_bear_t'])
    expect(getAvailableClassIdsForStage(getStageById('Challenge-7'), {
      ...progression,
      highestClearedCampaignStageIndex: zulAmanEndIndex,
      registeredClassIds,
      enabledClassIds,
    })).toEqual(['warrior_t', 'druid_bear_t'])
  })
})
