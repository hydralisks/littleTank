import { describe, expect, it } from 'vitest'
import {
  buildStageSelectBuildRuleModal,
  buildStageSelectConflictModal,
  shouldShowBuildConflictButton,
} from './stageSelectViewModel'

describe('stageSelectViewModel', () => {
  it('always builds modal sections when a build rule exists', () => {
    expect(
      buildStageSelectBuildRuleModal({
        ruleName: '标准五键构筑',
        description: '开放 1/2/3/4/Q 五个键位。',
        totalBuildPoints: 28,
        maxActiveSlots: 5,
        enabledHotkeys: ['1', '2', '3', '4', 'Q'],
      }).sections.length,
    ).toBeGreaterThan(0)
  })

  it('shows conflict button only when warnings exist', () => {
    expect(shouldShowBuildConflictButton([])).toBe(false)
    expect(shouldShowBuildConflictButton(['技能冲突'])).toBe(true)
  })

  it('maps warning messages into conflict modal rows', () => {
    expect(buildStageSelectConflictModal(['A', 'B']).items).toEqual(['A', 'B'])
  })

  it('only shows active build-rule fields still owned by build rules', () => {
    const modal = buildStageSelectBuildRuleModal({
      ruleName: '???',
      description: '??',
      totalBuildPoints: 10,
      maxActiveSlots: 2,
      enabledHotkeys: ['1', '2'],
    })

    expect(modal.sections).toHaveLength(4)
  })
})
