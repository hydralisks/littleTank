import { afterEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides } from '../data/encounterTemplates'
import { applyPlayerBuildWorkbookOverrides, resetPlayerBuildCatalog } from '../data/playerBuildCatalog'
import { applyStageWorkbookOverrides, getStageById } from '../data/stageTemplates'
import {
  parseEncounterWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../data/workbookLoader'
import {
  buildManualPlaytestCandidateForStage,
  parseManualPlaytestWorkbook,
} from './manualPlaytestBuilds'

describe('manual playtest builds', () => {
  afterEach(() => {
    resetPlayerBuildCatalog()
    applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
    applyEncounterWorkbookOverrides({
      openingOverrides: {},
      placementOverrides: {},
      openingStatusOverrides: {},
      affixDefinitions: {},
      affixBindings: {},
      specialRuleDefinitions: {},
      specialRuleBindings: {},
    })
  })

  it('parses Chinese manual recommendations into a normalized legal build candidate', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          stageId: "Zul'Aman-6",
          manualDifficulty: 'expert',
          recommendedActiveSkillNamesCsv: '挑战怒吼、盾墙、盾牌格挡、无视苦痛、雷霆打击、盾牌猛击、天神下凡、复仇',
          recommendedPassiveTalentNamesCsv: '加固板甲、刚毅姿态、血涌、护卫神盾、野蛮训练',
          source: 'manual',
          enabled: true,
        },
      ]),
      '人工测评',
    )

    const entries = parseManualPlaytestWorkbook(workbook)
    const stage = getStageById("Zul'Aman-6")
    const candidate = buildManualPlaytestCandidateForStage(entries, stage)

    expect(candidate?.id).toBe('manual_playtest_recommended')
    expect(Object.values(candidate?.build.loadout ?? {})).toEqual([
      'warrior_t_mass_taunt',
      'warrior_t_shield_wall',
      'warrior_t_shield_block',
      'warrior_t_ignore_pain',
      'warrior_t_thunderstruck',
      'warrior_t_shield_slam',
      'warrior_t_avatar',
      'warrior_t_revenge',
    ])
    expect(candidate?.build.passiveTalentIds).toEqual([
      'warrior_t_reinforced_plates',
      'warrior_t_immortal_stance',
      'warrior_t_bloodsurge',
      'warrior_t_defenders_aegis',
      'warrior_t_barbaric_training',
    ])
  })
})
