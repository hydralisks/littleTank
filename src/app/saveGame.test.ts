import { describe, expect, it } from 'vitest'
import { getDefaultPersistedBuildForRule } from '../game/data/playerBuildCatalog'
import {
  getSaveStorageKey,
  loadSaveGame,
  saveSaveGame,
  shouldAutoEquipNewSkillsForStage,
} from './saveGame'

function createStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key)
    },
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('saveGame', () => {
  it('returns null when no save exists for the namespace', () => {
    expect(loadSaveGame(createStorage(), 'empty-package')).toBeNull()
  })

  it('round-trips class-scoped progression and build state in localStorage', () => {
    const storage = createStorage()
    const build = getDefaultPersistedBuildForRule('tutorial_3slot', 'warrior_t')

    saveSaveGame({
      highestClearedStageIndex: 1,
      stageId: 'RingingDeeps-2',
      selectedClassId: 'warrior_t',
      buildsByClassId: { warrior_t: build },
      challengeVictoriesByClass: { druid_bear_t: ['Challenge-1'] },
      campaignVictoriesByClass: { warrior_t: ['RingingDeeps-1'] },
      campaignUnlockedClassIds: ['warrior_t'],
      seenEnemyDefinitionIds: ['kobold_miner', 'kobold_apprentice'],
      tutorial: {
        seenStageSelectStageIds: ['RingingDeeps-2'],
        seenEncounterStageIds: ['RingingDeeps-1'],
        seenMonsterCodexTutorial: true,
        autoEquippedStageIdsByClass: { warrior_t: ['RingingDeeps-2'] },
        manualBuildConfiguredStageIdsByClass: { warrior_t: ['RingingDeeps-3'] },
      },
    }, storage, 'package-a')

    expect(loadSaveGame(storage, 'package-a')).toEqual({
      highestClearedStageIndex: 1,
      stageId: 'RingingDeeps-2',
      selectedClassId: 'warrior_t',
      buildsByClassId: { warrior_t: build },
      challengeVictoriesByClass: { druid_bear_t: ['Challenge-1'] },
      campaignVictoriesByClass: { warrior_t: ['RingingDeeps-1'] },
      campaignUnlockedClassIds: ['warrior_t'],
      seenEnemyDefinitionIds: ['kobold_miner', 'kobold_apprentice'],
      tutorial: {
        seenStageSelectStageIds: ['RingingDeeps-2'],
        seenEncounterStageIds: ['RingingDeeps-1'],
        seenMonsterCodexTutorial: true,
        autoEquippedStageIdsByClass: { warrior_t: ['RingingDeeps-2'] },
        manualBuildConfiguredStageIdsByClass: { warrior_t: ['RingingDeeps-3'] },
      },
    })
  })

  it('migrates a legacy v1 save into warrior-scoped state without deleting the old key', () => {
    const storage = createStorage()
    const legacyBuild = getDefaultPersistedBuildForRule('tutorial_2slot', 'warrior_t')
    const legacyKey = getSaveStorageKey('legacy', '1')
    storage.setItem(legacyKey, JSON.stringify({
      highestClearedStageIndex: 0,
      stageId: 'RingingDeeps-1',
      build: legacyBuild,
      seenEnemyDefinitionIds: ['kobold_miner'],
      tutorial: {
        seenStageSelectStageIds: ['RingingDeeps-1'],
        seenEncounterStageIds: [],
        seenMonsterCodexTutorial: false,
        autoEquippedStageIds: ['RingingDeeps-2'],
        manualBuildConfiguredStageIds: ['RingingDeeps-3'],
      },
    }))

    expect(loadSaveGame(storage, 'legacy')).toEqual({
      highestClearedStageIndex: 0,
      stageId: 'RingingDeeps-1',
      selectedClassId: 'warrior_t',
      buildsByClassId: { warrior_t: legacyBuild },
      challengeVictoriesByClass: {},
      campaignVictoriesByClass: {},
      campaignUnlockedClassIds: ['warrior_t'],
      seenEnemyDefinitionIds: ['kobold_miner'],
      tutorial: {
        seenStageSelectStageIds: ['RingingDeeps-1'],
        seenEncounterStageIds: [],
        seenMonsterCodexTutorial: false,
        autoEquippedStageIdsByClass: { warrior_t: ['RingingDeeps-2'] },
        manualBuildConfiguredStageIdsByClass: { warrior_t: ['RingingDeeps-3'] },
      },
    })
    expect(storage.getItem(legacyKey)).not.toBeNull()
  })

  it('derives missing permanent class eligibility from victories idempotently', () => {
    const storage = createStorage()
    const build = getDefaultPersistedBuildForRule('standard_5slot', 'warrior_t')
    storage.setItem(getSaveStorageKey('completed-bear'), JSON.stringify({
      highestClearedStageIndex: 5,
      stageId: 'Challenge-3',
      selectedClassId: 'druid_bear_t',
      buildsByClassId: { warrior_t: build },
      challengeVictoriesByClass: {
        druid_bear_t: ['Challenge-1', 'Challenge-2', 'Challenge-3', 'Challenge-3'],
      },
      campaignVictoriesByClass: {},
      campaignUnlockedClassIds: ['warrior_t'],
      seenEnemyDefinitionIds: [],
      tutorial: {},
    }))

    const firstLoad = loadSaveGame(storage, 'completed-bear')
    const secondLoad = loadSaveGame(storage, 'completed-bear')
    expect(firstLoad?.campaignUnlockedClassIds).toEqual(['warrior_t', 'druid_bear_t'])
    expect(firstLoad?.challengeVictoriesByClass.druid_bear_t).toEqual([
      'Challenge-1', 'Challenge-2', 'Challenge-3',
    ])
    expect(secondLoad).toEqual(firstLoad)
  })

  it('uses separate v2 keys for different package namespaces', () => {
    const storage = createStorage()
    const build = getDefaultPersistedBuildForRule('tutorial_2slot', 'warrior_t')

    saveSaveGame({
      highestClearedStageIndex: 0,
      stageId: 'RingingDeeps-1',
      selectedClassId: 'warrior_t',
      buildsByClassId: { warrior_t: build },
      challengeVictoriesByClass: {},
      campaignVictoriesByClass: {},
      campaignUnlockedClassIds: ['warrior_t'],
      seenEnemyDefinitionIds: [],
      tutorial: {
        seenStageSelectStageIds: [],
        seenEncounterStageIds: [],
        seenMonsterCodexTutorial: false,
        autoEquippedStageIdsByClass: {},
        manualBuildConfiguredStageIdsByClass: {},
      },
    }, storage, 'old-package')

    expect(loadSaveGame(storage, 'new-package')).toBeNull()
    expect(storage.getItem(getSaveStorageKey('old-package'))).not.toBeNull()
    expect(storage.getItem(getSaveStorageKey('new-package'))).toBeNull()
  })

  it('tracks stage-entry auto equip independently for each class', () => {
    const tutorial = {
      seenStageSelectStageIds: [],
      seenEncounterStageIds: [],
      seenMonsterCodexTutorial: false,
      autoEquippedStageIdsByClass: { warrior_t: ['RingingDeeps-2'] },
      manualBuildConfiguredStageIdsByClass: { druid_bear_t: ['RingingDeeps-2'] },
    }

    expect(shouldAutoEquipNewSkillsForStage(
      tutorial,
      'druid_bear_t',
      'RingingDeeps-3',
      ['druid_bear_t_growl'],
    )).toBe(true)
    expect(shouldAutoEquipNewSkillsForStage(
      tutorial,
      'warrior_t',
      'RingingDeeps-2',
      ['warrior_t_interrupt'],
    )).toBe(false)
    expect(shouldAutoEquipNewSkillsForStage(
      tutorial,
      'druid_bear_t',
      'RingingDeeps-2',
      ['druid_bear_t_growl'],
    )).toBe(false)
  })
})
