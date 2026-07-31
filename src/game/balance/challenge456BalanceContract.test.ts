import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

function readRows(fileName: string, sheetName: string) {
  const workbook = XLSX.readFile(`public/designer-data/${fileName}`)
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Missing sheet ${sheetName} in ${fileName}`)
  return XLSX.utils.sheet_to_json<Record<string, string | number | boolean>>(sheet, { defval: '' })
}

function requireUniqueRow(
  rows: Array<Record<string, string | number | boolean>>,
  key: string,
  value: string,
) {
  const matches = rows.filter((row) => String(row[key]) === value)
  expect(matches, `${key}=${value}`).toHaveLength(1)
  return matches[0]
}

describe('Challenge 4-6 dual-class balance contract', () => {
  it('keeps the WF-6 class snapshot and build boundary for all three stages', () => {
    const stages = readRows('challenge_stage_content.xlsx', '关卡')

    for (const stageId of ['Challenge-4', 'Challenge-5', 'Challenge-6']) {
      const stage = requireUniqueRow(stages, 'stageId', stageId)
      const skills = String(stage.unlockedActiveSkillIdsCsv).split(',').filter(Boolean)
      expect(stage).toMatchObject({
        allowedClassIdsCsv: 'warrior_t,druid_bear_t',
        buildRuleId: '8slot_0',
        passiveTalentUnlockTier: 2,
      })
      expect(skills.filter((skillId) => skillId.startsWith('warrior_t_'))).toHaveLength(10)
      expect(skills.filter((skillId) => skillId.startsWith('druid_bear_t_'))).toHaveLength(10)
      expect(skills).not.toContain('druid_bear_t_incarnation_ursoc')
    }
  })

  it('uses the first Challenge-5 support-chain health tuning', () => {
    const spawns = readRows('challenge_encounter_balance.xlsx', '敌人布置')

    expect(requireUniqueRow(spawns, 'spawnId', 'Challenge-5-e02')).toMatchObject({
      hpOverride: 550,
      maxHpOverride: 550,
    })
    expect(requireUniqueRow(spawns, 'spawnId', 'Challenge-5-e03')).toMatchObject({
      hpOverride: 825,
      maxHpOverride: 825,
    })
  })

  it('uses Challenge-6 tidal vulnerability as the expert pressure control', () => {
    const spawns = readRows('challenge_encounter_balance.xlsx', '敌人布置')
    const affixes = readRows('challenge_encounter_balance.xlsx', '词缀定义')
    const stages = readRows('challenge_stage_content.xlsx', '关卡')

    expect(requireUniqueRow(spawns, 'spawnId', 'Challenge-6-e01')).toMatchObject({
      hpOverride: '',
      maxHpOverride: '',
    })
    expect(requireUniqueRow(affixes, 'affixId', 'challenge_tide_order')).toMatchObject({
      valueA: 0.18,
      valueB: 5,
    })
    expect(requireUniqueRow(affixes, 'affixId', 'challenge_wax_order')).toMatchObject({ valueA: 14 })
    expect(String(requireUniqueRow(stages, 'stageId', 'Challenge-6').affix2Description)).toContain('18%')
  })

  it('uses Challenge-4 opening party threat as its shared aggro check', () => {
    const affixes = readRows('challenge_encounter_balance.xlsx', '词缀定义')
    const stages = readRows('challenge_stage_content.xlsx', '关卡')

    expect(requireUniqueRow(affixes, 'affixId', 'challenge_scattered_opening')).toMatchObject({ valueA: 55 })
    expect(String(requireUniqueRow(stages, 'stageId', 'Challenge-4').affix2Description)).toContain('55点')
  })
})
