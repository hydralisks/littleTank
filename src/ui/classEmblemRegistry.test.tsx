import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ClassEmblemIcon,
  getClassEmblemDefinition,
  tryGetClassEmblemDefinition,
} from './classEmblemRegistry'

describe('classEmblemRegistry', () => {
  it.each([
    ['warrior_t', 'sword', '#f2a23a'],
    ['druid_bear_t', 'bear-claw', '#52d68b'],
    ['death_knight_t', 'skull', '#e14d75'],
    ['tinker_t', 'wrench', '#3ad7e8'],
    ['black_dragon_evoker_t', 'eye', '#ff7043'],
    ['earth_elemental_t', 'mountain', '#e2bd55'],
  ] as const)('registers %s with %s', (classId, motif, color) => {
    expect(getClassEmblemDefinition(classId)).toMatchObject({ motif, color })
  })

  it('renders a labeled motif and keeps unknown classes neutral', () => {
    expect(renderToStaticMarkup(<ClassEmblemIcon classId="warrior_t" />)).toContain('战士 T：剑纹章')
    expect(tryGetClassEmblemDefinition('unknown')).toBeNull()
  })
})
