import type { PersistedBuildState } from '../game/encounter/encounterTypes'
import type { StageId } from '../game/data/stageTemplates'

export interface TutorialSaveState {
  seenStageSelectStageIds: StageId[]
  seenEncounterStageIds: StageId[]
  seenMonsterCodexTutorial: boolean
  autoEquippedStageIds: StageId[]
  manualBuildConfiguredStageIds: StageId[]
}

export interface SaveGameState {
  highestClearedStageIndex: number
  stageId: StageId
  build: PersistedBuildState
  seenEnemyDefinitionIds: string[]
  tutorial: TutorialSaveState
}

const SAVE_SCHEMA_VERSION = '1'
const SAVE_NAMESPACE_GLOBAL_KEY = '__LITTLETANK_SAVE_NAMESPACE__'

function getGlobalSaveNamespace() {
  const value = (globalThis as typeof globalThis & Record<string, unknown>)[SAVE_NAMESPACE_GLOBAL_KEY]
  return typeof value === 'string' && value.trim() ? value.trim() : 'dev'
}

export function getSaveStorageKey(namespace = getGlobalSaveNamespace()) {
  return `littleTank.save.${SAVE_SCHEMA_VERSION}.${namespace}`
}

export function createEmptyTutorialSaveState(): TutorialSaveState {
  return {
    seenStageSelectStageIds: [],
    seenEncounterStageIds: [],
    seenMonsterCodexTutorial: false,
    autoEquippedStageIds: [],
    manualBuildConfiguredStageIds: [],
  }
}

function normalizeStageIdList(value: unknown): StageId[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is StageId => typeof entry === 'string')
    : []
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))]
    : []
}

function normalizeTutorialSaveState(value: unknown): TutorialSaveState {
  if (!value || typeof value !== 'object') {
    return createEmptyTutorialSaveState()
  }

  const tutorial = value as Partial<Record<keyof TutorialSaveState, unknown>>

  return {
    seenStageSelectStageIds: normalizeStageIdList(tutorial.seenStageSelectStageIds),
    seenEncounterStageIds: normalizeStageIdList(tutorial.seenEncounterStageIds),
    seenMonsterCodexTutorial: tutorial.seenMonsterCodexTutorial === true,
    autoEquippedStageIds: normalizeStageIdList(tutorial.autoEquippedStageIds),
    manualBuildConfiguredStageIds: normalizeStageIdList(tutorial.manualBuildConfiguredStageIds),
  }
}

export function shouldAutoEquipNewSkillsForStage(
  tutorial: TutorialSaveState,
  stageId: StageId,
  newlyUnlockedActiveSkillIds: readonly string[],
) {
  return (
    newlyUnlockedActiveSkillIds.length > 0 &&
    !tutorial.autoEquippedStageIds.includes(stageId) &&
    !tutorial.manualBuildConfiguredStageIds.includes(stageId)
  )
}

export function loadSaveGame(storage: Storage = globalThis.localStorage, namespace = getGlobalSaveNamespace()) {
  if (!storage) {
    return null
  }

  const raw = storage.getItem(getSaveStorageKey(namespace))
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as SaveGameState
    if (
      typeof parsed.highestClearedStageIndex !== 'number' ||
      typeof parsed.stageId !== 'string' ||
      !parsed.build ||
      typeof parsed.build !== 'object'
    ) {
      return null
    }

    return {
      ...parsed,
      seenEnemyDefinitionIds: normalizeStringList(parsed.seenEnemyDefinitionIds),
      tutorial: normalizeTutorialSaveState(parsed.tutorial),
    }
  } catch {
    return null
  }
}

export function saveSaveGame(
  state: SaveGameState,
  storage: Storage = globalThis.localStorage,
  namespace = getGlobalSaveNamespace(),
) {
  if (!storage) {
    return
  }

  storage.setItem(getSaveStorageKey(namespace), JSON.stringify(state))
}

export function clearSaveGame(storage: Storage = globalThis.localStorage, namespace = getGlobalSaveNamespace()) {
  if (!storage) {
    return
  }

  storage.removeItem(getSaveStorageKey(namespace))
}
