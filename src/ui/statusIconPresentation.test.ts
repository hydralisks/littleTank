import { describe, expect, it } from 'vitest'
import { clampVisibleStacks, getSourceShape, getStatusSemantic } from './statusIconPresentation'

describe('statusIconPresentation', () => {
  it.each([
    ['playerBuff', 'beneficial'],
    ['enemyBuff', 'harmful'],
    ['playerDebuff', 'harmful'],
    ['partyDebuff', 'party-harmful'],
    ['neutral', 'neutral'],
  ] as const)('maps %s to %s', (kind, semantic) => {
    expect(getStatusSemantic({ kind, tone: 'neutral' })).toBe(semantic)
  })

  it('uses a banner for active skills and an oval shield for passive talents', () => {
    expect(getSourceShape('activeSkill')).toBe('banner')
    expect(getSourceShape('passiveTalent')).toBe('oval-shield')
    expect(getSourceShape('encounter')).toBeNull()
    expect(getSourceShape('system')).toBeNull()
  })

  it('hides one stack and clamps excessive stacks to maxStacks', () => {
    expect(clampVisibleStacks({ stacks: 1, maxStacks: 5 })).toBeNull()
    expect(clampVisibleStacks({ stacks: 2, maxStacks: 5 })).toBe(2)
    expect(clampVisibleStacks({ stacks: 7, maxStacks: 5 })).toBe(5)
  })
})
