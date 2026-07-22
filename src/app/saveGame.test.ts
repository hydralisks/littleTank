import { describe, expect, it } from 'vitest'
import { getDefaultPersistedBuildForRule } from '../game/data/playerBuildCatalog'
import { getSaveStorageKey, loadSaveGame, saveSaveGame, shouldAutoEquipNewSkillsForStage } from './saveGame'

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

  it('round-trips progression and build state in localStorage', () => {
    const storage = createStorage()
    const build = getDefaultPersistedBuildForRule('tutorial_3slot', 'warrior_t')

    saveSaveGame({
      highestClearedStageIndex: 1,
      stageId: 'RingingDeeps-2',
      build,
      seenEnemyDefinitionIds: ['kobold_miner', 'kobold_apprentice'],
      tutorial: {
        seenStageSelectStageIds: ['RingingDeeps-2'],
        seenEncounterStageIds: ['RingingDeeps-1'],
        seenMonsterCodexTutorial: true,
        autoEquippedStageIds: ['RingingDeeps-2'],
        manualBuildConfiguredStageIds: ['RingingDeeps-3'],
      },
    }, storage, 'package-a')

    expect(loadSaveGame(storage, 'package-a')).toEqual({
      highestClearedStageIndex: 1,
      stageId: 'RingingDeeps-2',
      build,
      seenEnemyDefinitionIds: ['kobold_miner', 'kobold_apprentice'],
      tutorial: {
        seenStageSelectStageIds: ['RingingDeeps-2'],
        seenEncounterStageIds: ['RingingDeeps-1'],
        seenMonsterCodexTutorial: true,
        autoEquippedStageIds: ['RingingDeeps-2'],
        manualBuildConfiguredStageIds: ['RingingDeeps-3'],
      },
    })
  })

  it('normalizes old saves without tutorial state', () => {
    const storage = createStorage()
    const build = getDefaultPersistedBuildForRule('tutorial_2slot', 'warrior_t')

    storage.setItem(getSaveStorageKey('old-save'), JSON.stringify({
      highestClearedStageIndex: 0,
      stageId: 'RingingDeeps-1',
      build,
    }))

    expect(loadSaveGame(storage, 'old-save')).toEqual({
      highestClearedStageIndex: 0,
      stageId: 'RingingDeeps-1',
      build,
      seenEnemyDefinitionIds: [],
      tutorial: {
        seenStageSelectStageIds: [],
        seenEncounterStageIds: [],
        seenMonsterCodexTutorial: false,
        autoEquippedStageIds: [],
        manualBuildConfiguredStageIds: [],
      },
    })
  })

  it('uses separate keys for different package namespaces', () => {
    const storage = createStorage()
    const build = getDefaultPersistedBuildForRule('tutorial_2slot', 'warrior_t')

    saveSaveGame({
      highestClearedStageIndex: 0,
      stageId: 'RingingDeeps-1',
      build,
      seenEnemyDefinitionIds: [],
      tutorial: {
        seenStageSelectStageIds: [],
        seenEncounterStageIds: [],
        seenMonsterCodexTutorial: false,
        autoEquippedStageIds: [],
        manualBuildConfiguredStageIds: [],
      },
    }, storage, 'old-package')

    expect(loadSaveGame(storage, 'new-package')).toBeNull()
    expect(storage.getItem(getSaveStorageKey('old-package'))).not.toBeNull()
    expect(storage.getItem(getSaveStorageKey('new-package'))).toBeNull()
  })

  it('skips stage-entry auto equip after the player manually configured that stage build', () => {
    expect(shouldAutoEquipNewSkillsForStage({
      seenStageSelectStageIds: [],
      seenEncounterStageIds: [],
      seenMonsterCodexTutorial: false,
      autoEquippedStageIds: [],
      manualBuildConfiguredStageIds: [],
    }, 'RingingDeeps-2', ['warrior_t_interrupt'])).toBe(true)

    expect(shouldAutoEquipNewSkillsForStage({
      seenStageSelectStageIds: [],
      seenEncounterStageIds: [],
      seenMonsterCodexTutorial: false,
      autoEquippedStageIds: [],
      manualBuildConfiguredStageIds: ['RingingDeeps-2'],
    }, 'RingingDeeps-2', ['warrior_t_interrupt'])).toBe(false)

    expect(shouldAutoEquipNewSkillsForStage({
      seenStageSelectStageIds: [],
      seenEncounterStageIds: [],
      seenMonsterCodexTutorial: false,
      autoEquippedStageIds: ['RingingDeeps-2'],
      manualBuildConfiguredStageIds: [],
    }, 'RingingDeeps-2', ['warrior_t_interrupt'])).toBe(false)
  })
})
