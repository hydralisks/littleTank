import { describe, expect, it } from 'vitest'
import {
  appendSeenEnemyDefinitionIds,
  buildMonsterCodexEntries,
  getEnemyDefinitionIdsForStage,
} from './monsterCodex'

describe('monster codex data helpers', () => {
  it('extracts unique enemy definition ids from a stage encounter template', () => {
    const ids = getEnemyDefinitionIdsForStage('harbor-4')

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('appends newly seen enemy ids without duplicates while preserving order', () => {
    expect(appendSeenEnemyDefinitionIds(['a', 'b'], ['b', 'c', 'a', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('builds display entries with skills, cycles, and appearing stages for seen enemies', () => {
    const seenIds = getEnemyDefinitionIdsForStage('harbor-4')
    const entries = buildMonsterCodexEntries(seenIds)
    const first = entries[0]

    expect(first).toBeDefined()
    expect(first.enemyId).toBe(seenIds[0])
    expect(first.name.length).toBeGreaterThan(0)
    expect(first.baseMaxHp).toBeGreaterThan(0)
    expect(['普通', '无理', '嗜血']).toContain(first.threatLogicLabel)
    expect(first.appearsInStages.length).toBeGreaterThan(0)
    expect(first.firstAppearingStage?.stageId).toBe(first.appearsInStages[0].stageId)
    expect(first.skills.length).toBeGreaterThan(0)
    expect(first.skillCycle.length).toBeGreaterThan(0)
    expect(first.skills[0].breakRuleLabel.length).toBeGreaterThan(0)
    expect(first.skills[0].dangerLabel.length).toBeGreaterThan(0)
  })

  it('supports the App stage-start unlock flow', () => {
    const stageIds = getEnemyDefinitionIdsForStage('harbor-4')
    const next = appendSeenEnemyDefinitionIds(['existing_enemy'], stageIds)

    expect(next).toContain('existing_enemy')
    for (const enemyId of stageIds) {
      expect(next).toContain(enemyId)
    }
  })
})
