import { describe, expect, it } from 'vitest'
import {
  createEmptyClassProgression,
  getClassTrialProgress,
  hasClassVictory,
  recordStageVictory,
} from './classProgression'

describe('classProgression', () => {
  it('permanently unlocks a class only after that class wins all three trial stages', () => {
    let progress = createEmptyClassProgression()
    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-1', classId: 'druid_bear_t' })
    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-2', classId: 'druid_bear_t' })
    expect(progress.campaignUnlockedClassIds).toEqual(['warrior_t'])

    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-3', classId: 'warrior_t' })
    expect(progress.campaignUnlockedClassIds).toEqual(['warrior_t'])

    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-3', classId: 'druid_bear_t' })
    progress = recordStageVictory(progress, { mode: 'challenge', stageId: 'Challenge-3', classId: 'druid_bear_t' })
    expect(progress.campaignUnlockedClassIds).toEqual(['warrior_t', 'druid_bear_t'])
    expect(progress.challengeVictoriesByClass.druid_bear_t).toEqual([
      'Challenge-1',
      'Challenge-2',
      'Challenge-3',
    ])
    expect(getClassTrialProgress(progress.challengeVictoriesByClass, 'druid_bear_t')).toEqual({
      completed: 3,
      required: 3,
    })
  })

  it('records campaign victories independently for each class', () => {
    const progress = recordStageVictory(createEmptyClassProgression(), {
      mode: 'campaign',
      stageId: 'WestFall-1',
      classId: 'druid_bear_t',
    })

    expect(hasClassVictory(progress.campaignVictoriesByClass, 'druid_bear_t', 'WestFall-1')).toBe(true)
    expect(hasClassVictory(progress.challengeVictoriesByClass, 'druid_bear_t', 'WestFall-1')).toBe(false)
  })
})
