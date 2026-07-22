import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyStageWorkbookOverrides, getStageById } from '../data/stageTemplates'
import { parseStageWorkbook } from '../data/workbookLoader'
import { createEmptyClassProgression } from './classProgression'
import { getAvailableClassIdsForStage, resolveStageClassId } from './stageClassAvailability'

describe('stageClassAvailability', () => {
  beforeAll(() => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
  })

  afterAll(() => {
    applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
  })

  it('enforces chapter one, cumulative trials, runtime/data readiness, and content caps', () => {
    const futureClassIds = ['warrior_t', 'druid_bear_t', 'dk_blood_t']
    const baseStage = getStageById('RingingDeeps-1')
    const challenge1WithBearContent = {
      ...baseStage,
      id: 'Challenge-1',
      allowedClassIds: ['warrior_t', 'druid_bear_t'],
    }
    const challenge4WithAllContent = {
      ...baseStage,
      id: 'Challenge-4',
      allowedClassIds: futureClassIds,
    }
    const challenge4WithWarriorOnlyContent = {
      ...challenge4WithAllContent,
      allowedClassIds: ['warrior_t'],
    }
    const chapterOneWithAllContent = {
      ...baseStage,
      allowedClassIds: futureClassIds,
    }
    const afterRingingDeeps = {
      ...createEmptyClassProgression(),
      highestClearedCampaignStageIndex: 5,
      registeredClassIds: futureClassIds,
      enabledClassIds: futureClassIds,
    }
    const bearPermanentlyUnlocked = {
      ...afterRingingDeeps,
      highestClearedCampaignStageIndex: 11,
      campaignUnlockedClassIds: ['warrior_t', 'druid_bear_t'],
    }

    expect(getAvailableClassIdsForStage(getStageById('RingingDeeps-1'), afterRingingDeeps)).toEqual(['warrior_t'])
    expect(getAvailableClassIdsForStage(chapterOneWithAllContent, bearPermanentlyUnlocked)).toEqual(['warrior_t'])
    expect(getAvailableClassIdsForStage(challenge1WithBearContent, afterRingingDeeps)).toEqual([
      'warrior_t', 'druid_bear_t',
    ])
    expect(getAvailableClassIdsForStage(challenge4WithAllContent, bearPermanentlyUnlocked)).toEqual([
      'warrior_t', 'druid_bear_t', 'dk_blood_t',
    ])
    expect(getAvailableClassIdsForStage(challenge4WithWarriorOnlyContent, bearPermanentlyUnlocked)).toEqual([
      'warrior_t',
    ])
  })

  it('returns no classes for a locked challenge and resolves unavailable preferences safely', () => {
    const baseStage = getStageById('RingingDeeps-1')
    const lockedChallenge = {
      ...baseStage,
      id: 'Challenge-4',
      allowedClassIds: ['warrior_t', 'dk_blood_t'],
    }
    const input = {
      ...createEmptyClassProgression(),
      highestClearedCampaignStageIndex: 5,
      registeredClassIds: ['warrior_t', 'dk_blood_t'],
      enabledClassIds: ['warrior_t', 'dk_blood_t'],
    }

    expect(getAvailableClassIdsForStage(lockedChallenge, input)).toEqual([])
    expect(resolveStageClassId('dk_blood_t', ['warrior_t'])).toBe('warrior_t')
    expect(resolveStageClassId('dk_blood_t', [])).toBeNull()
  })
})
