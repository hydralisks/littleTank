import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyStageWorkbookOverrides } from '../data/stageTemplates'
import { parseStageWorkbook } from '../data/workbookLoader'
import {
  getChallengeGroupForStage,
  getClassTrialPolicy,
  isChallengeStageOpen,
} from './classTrialPolicy'

describe('classTrialPolicy', () => {
  beforeAll(() => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
  })

  afterAll(() => {
    applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
  })

  it('maps bear and blood DK to fixed three-challenge groups', () => {
    expect(getClassTrialPolicy('druid_bear_t')).toMatchObject({
      challengeIds: ['Challenge-1', 'Challenge-2', 'Challenge-3'],
      requiredCampaignStageId: 'RingingDeeps-6',
    })
    expect(getClassTrialPolicy('dk_blood_t')).toMatchObject({
      challengeIds: ['Challenge-4', 'Challenge-5', 'Challenge-6'],
      requiredCampaignStageId: 'WestFall-6',
    })
    expect(getChallengeGroupForStage('Challenge-7')).toMatchObject({
      challengeIds: ['Challenge-7', 'Challenge-8', 'Challenge-9'],
      requiredCampaignStageId: "Zul'Aman-6",
      trialClassId: undefined,
    })
  })

  it('opens each group only after its campaign milestone is cleared', () => {
    expect(isChallengeStageOpen('Challenge-1', 4)).toBe(false)
    expect(isChallengeStageOpen('Challenge-1', 5)).toBe(true)
    expect(isChallengeStageOpen('Challenge-4', 10)).toBe(false)
    expect(isChallengeStageOpen('Challenge-4', 11)).toBe(true)
  })
})
