import type { StageId } from '../game/data/stageTemplates'
import type { PersistedBuildState, PlayerClassId } from '../game/encounter/encounterTypes'
import {
  deriveCampaignUnlockedClassIds,
  type ClassProgressionState,
  type StageVictoriesByClass,
} from '../game/progression/classProgression'
import { WARRIOR_T_CLASS_ID } from '../game/playerClasses/playerClassRuntimeRegistry'

export interface TutorialSaveState {
  seenStageSelectStageIds: StageId[]
  seenEncounterStageIds: StageId[]
  seenMonsterCodexTutorial: boolean
  autoEquippedStageIdsByClass: Record<PlayerClassId, StageId[]>
  manualBuildConfiguredStageIdsByClass: Record<PlayerClassId, StageId[]>
}

interface LegacyTutorialSaveState {
  seenStageSelectStageIds: StageId[]
  seenEncounterStageIds: StageId[]
  seenMonsterCodexTutorial: boolean
  autoEquippedStageIds: StageId[]
  manualBuildConfiguredStageIds: StageId[]
}

export interface SaveGameState extends ClassProgressionState {
  highestClearedStageIndex: number
  stageId: StageId
  selectedClassId: PlayerClassId
  buildsByClassId: Record<PlayerClassId, PersistedBuildState>
  seenEnemyDefinitionIds: string[]
  tutorial: TutorialSaveState
}

const SAVE_SCHEMA_VERSION = '2'
const LEGACY_SAVE_SCHEMA_VERSION = '1'
const SAVE_NAMESPACE_GLOBAL_KEY = '__LITTLETANK_SAVE_NAMESPACE__'

function getGlobalSaveNamespace() {
  const value = (globalThis as typeof globalThis & Record<string, unknown>)[SAVE_NAMESPACE_GLOBAL_KEY]
  return typeof value === 'string' && value.trim() ? value.trim() : 'dev'
}

export function getSaveStorageKey(namespace = getGlobalSaveNamespace(), version = SAVE_SCHEMA_VERSION) {
  return `littleTank.save.${version}.${namespace}`
}

export function createEmptyTutorialSaveState(): TutorialSaveState {
  return {
    seenStageSelectStageIds: [],
    seenEncounterStageIds: [],
    seenMonsterCodexTutorial: false,
    autoEquippedStageIdsByClass: {},
    manualBuildConfiguredStageIdsByClass: {},
  }
}

function normalizeStageIdList(value: unknown): StageId[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is StageId => typeof entry === 'string'))]
    : []
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))]
    : []
}

function normalizeLegacyTutorialSaveState(value: unknown): LegacyTutorialSaveState {
  const tutorial = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
  return {
    seenStageSelectStageIds: normalizeStageIdList(tutorial.seenStageSelectStageIds),
    seenEncounterStageIds: normalizeStageIdList(tutorial.seenEncounterStageIds),
    seenMonsterCodexTutorial: tutorial.seenMonsterCodexTutorial === true,
    autoEquippedStageIds: normalizeStageIdList(tutorial.autoEquippedStageIds),
    manualBuildConfiguredStageIds: normalizeStageIdList(tutorial.manualBuildConfiguredStageIds),
  }
}

function isPersistedBuildState(value: unknown): value is PersistedBuildState {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<PersistedBuildState>
  return Boolean(
    candidate.loadout
    && typeof candidate.loadout === 'object'
    && Array.isArray(candidate.passiveTalentIds),
  )
}

function normalizeBuildsByClass(value: unknown): Record<PlayerClassId, PersistedBuildState> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const builds: Record<PlayerClassId, PersistedBuildState> = {}
  for (const [classId, build] of Object.entries(value)) {
    if (classId.trim().length > 0 && isPersistedBuildState(build)) {
      builds[classId] = {
        loadout: { ...build.loadout },
        passiveTalentIds: normalizeStringList(build.passiveTalentIds),
      }
    }
  }
  return builds
}

function normalizeStageVictoriesByClass(value: unknown): StageVictoriesByClass {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([classId]) => classId.trim().length > 0)
      .map(([classId, stageIds]) => [classId, normalizeStageIdList(stageIds)]),
  )
}

function normalizeStageIdsByClass(value: unknown): Record<PlayerClassId, StageId[]> {
  return normalizeStageVictoriesByClass(value)
}

function normalizeV2TutorialSaveState(value: unknown): TutorialSaveState {
  if (!value || typeof value !== 'object') {
    return createEmptyTutorialSaveState()
  }
  const tutorial = value as Record<string, unknown>
  return {
    seenStageSelectStageIds: normalizeStageIdList(tutorial.seenStageSelectStageIds),
    seenEncounterStageIds: normalizeStageIdList(tutorial.seenEncounterStageIds),
    seenMonsterCodexTutorial: tutorial.seenMonsterCodexTutorial === true,
    autoEquippedStageIdsByClass: normalizeStageIdsByClass(tutorial.autoEquippedStageIdsByClass),
    manualBuildConfiguredStageIdsByClass: normalizeStageIdsByClass(tutorial.manualBuildConfiguredStageIdsByClass),
  }
}

function normalizeV2Save(parsed: Record<string, unknown>): SaveGameState | null {
  if (
    typeof parsed.highestClearedStageIndex !== 'number'
    || typeof parsed.stageId !== 'string'
  ) {
    return null
  }

  const buildsByClassId = normalizeBuildsByClass(parsed.buildsByClassId)
  if (Object.keys(buildsByClassId).length === 0) {
    return null
  }
  const challengeVictoriesByClass = normalizeStageVictoriesByClass(parsed.challengeVictoriesByClass)
  const campaignUnlockedClassIds = deriveCampaignUnlockedClassIds(
    challengeVictoriesByClass,
    normalizeStringList(parsed.campaignUnlockedClassIds),
  )

  return {
    highestClearedStageIndex: parsed.highestClearedStageIndex,
    stageId: parsed.stageId,
    selectedClassId: typeof parsed.selectedClassId === 'string' && parsed.selectedClassId.trim()
      ? parsed.selectedClassId
      : WARRIOR_T_CLASS_ID,
    buildsByClassId,
    challengeVictoriesByClass,
    campaignVictoriesByClass: normalizeStageVictoriesByClass(parsed.campaignVictoriesByClass),
    campaignUnlockedClassIds,
    seenEnemyDefinitionIds: normalizeStringList(parsed.seenEnemyDefinitionIds),
    tutorial: normalizeV2TutorialSaveState(parsed.tutorial),
  }
}

function migrateLegacySave(parsed: Record<string, unknown>): SaveGameState | null {
  if (
    typeof parsed.highestClearedStageIndex !== 'number'
    || typeof parsed.stageId !== 'string'
    || !isPersistedBuildState(parsed.build)
  ) {
    return null
  }

  const legacyTutorial = normalizeLegacyTutorialSaveState(parsed.tutorial)
  return {
    highestClearedStageIndex: parsed.highestClearedStageIndex,
    stageId: parsed.stageId,
    selectedClassId: WARRIOR_T_CLASS_ID,
    buildsByClassId: { warrior_t: parsed.build },
    challengeVictoriesByClass: {},
    campaignVictoriesByClass: {},
    campaignUnlockedClassIds: [WARRIOR_T_CLASS_ID],
    seenEnemyDefinitionIds: normalizeStringList(parsed.seenEnemyDefinitionIds),
    tutorial: {
      seenStageSelectStageIds: legacyTutorial.seenStageSelectStageIds,
      seenEncounterStageIds: legacyTutorial.seenEncounterStageIds,
      seenMonsterCodexTutorial: legacyTutorial.seenMonsterCodexTutorial,
      autoEquippedStageIdsByClass: { warrior_t: legacyTutorial.autoEquippedStageIds },
      manualBuildConfiguredStageIdsByClass: { warrior_t: legacyTutorial.manualBuildConfiguredStageIds },
    },
  }
}

export function shouldAutoEquipNewSkillsForStage(
  tutorial: TutorialSaveState,
  classId: PlayerClassId,
  stageId: StageId,
  newlyUnlockedActiveSkillIds: readonly string[],
) {
  return (
    newlyUnlockedActiveSkillIds.length > 0
    && !(tutorial.autoEquippedStageIdsByClass[classId] ?? []).includes(stageId)
    && !(tutorial.manualBuildConfiguredStageIdsByClass[classId] ?? []).includes(stageId)
  )
}

export function loadSaveGame(storage: Storage = globalThis.localStorage, namespace = getGlobalSaveNamespace()) {
  if (!storage) {
    return null
  }
  const currentRaw = storage.getItem(getSaveStorageKey(namespace))
  const legacyRaw = storage.getItem(getSaveStorageKey(namespace, LEGACY_SAVE_SCHEMA_VERSION))
  const raw = currentRaw ?? legacyRaw
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized = currentRaw ? normalizeV2Save(parsed) : migrateLegacySave(parsed)
    if (!normalized) {
      return null
    }
    return {
      ...normalized,
      campaignUnlockedClassIds: deriveCampaignUnlockedClassIds(
        normalized.challengeVictoriesByClass,
        normalized.campaignUnlockedClassIds,
      ),
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
