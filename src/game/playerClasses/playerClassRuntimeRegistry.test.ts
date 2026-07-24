import { describe, expect, it } from 'vitest'
import {
  WARRIOR_T_CLASS_ID,
  getPlayerClassRuntimeDefinition,
  getPlayerClassRuntimeDefinitions,
} from './playerClassRuntimeRegistry'

describe('playerClassRuntimeRegistry', () => {
  it('returns the registered warrior runtime with stable technical metadata', () => {
    expect(getPlayerClassRuntimeDefinition(WARRIOR_T_CLASS_ID)).toMatchObject({
      classId: 'warrior_t',
      selectionOrder: 0,
      buttonIconKey: 'sword',
      aiStrategyId: 'warrior_t_default',
      primaryResource: {
        id: 'rage',
        label: '怒气',
        maxResource: 100,
      },
    })
    expect(getPlayerClassRuntimeDefinitions().map((entry) => entry.classId)).toEqual(['warrior_t', 'druid_bear_t'])
  })

  it('throws instead of silently using warrior metadata for an unknown class', () => {
    expect(() => getPlayerClassRuntimeDefinition('missing_tank')).toThrowError(
      'Player class runtime is not registered: missing_tank',
    )
  })
})
