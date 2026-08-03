import { describe, expect, it } from 'vitest'
import { createEnemyStatusEffect, createPlayerBuildStatusEffect } from './encounterStatusEffects'

describe('encounterStatusEffects provenance', () => {
  it('marks enemy-authored statuses as encounter effects', () => {
    expect(createEnemyStatusEffect('ember-aegis')).toMatchObject({
      sourceKind: 'encounter',
    })
  })

  it('lets the applying class override a shared active status class', () => {
    expect(createPlayerBuildStatusEffect('taunted', 3_000, {
      sourceClassId: 'druid_bear_t',
    })).toMatchObject({
      sourceKind: 'activeSkill',
      sourceClassId: 'druid_bear_t',
    })
  })
})
