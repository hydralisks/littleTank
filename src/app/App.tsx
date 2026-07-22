import { useEffect, useState } from 'react'
import { getStageBuildRuleId } from '../game/data/encounterTemplates'
import {
  getDefaultPersistedBuildForRule,
  normalizePersistedBuildForRule,
} from '../game/data/playerBuildCatalog'
import {
  campaignStageOrder,
  getNextStageId,
  getPassiveTalentUnlockTierForStage,
  getStageById,
  getUnlockedActiveSkillIdsForStage,
  stageOrder,
  type StageId,
} from '../game/data/stageTemplates'
import {
  appendSeenEnemyDefinitionIds,
  getEnemyDefinitionIdsForStage,
} from '../game/data/monsterCodex'
import type { PersistedBuildState, PlayerClassId } from '../game/encounter/encounterTypes'
import { WARRIOR_T_CLASS_ID } from '../game/playerClasses/playerClassRuntimeRegistry'
import {
  createEmptyClassProgression,
  recordStageVictory,
  type ClassProgressionState,
} from '../game/progression/classProgression'
import {
  getAvailableClassIdsForStage,
  resolveStageClassId,
} from '../game/progression/stageClassAvailability'
import { EncounterScreen } from '../ui/EncounterScreen'
import { StageSelectScreen, type StageSelectMode } from '../ui/StageSelectScreen'
import {
  createEmptyTutorialSaveState,
  loadSaveGame,
  saveSaveGame,
  shouldAutoEquipNewSkillsForStage,
  type TutorialSaveState,
} from './saveGame'

const INITIAL_HIGHEST_CLEARED_STAGE_INDEX = -1
const INITIAL_MAX_UNLOCKED_STAGE_INDEX = 0

function appendUniqueStageId(stageIds: readonly StageId[], stageId: StageId) {
  return stageIds.includes(stageId) ? [...stageIds] : [...stageIds, stageId]
}

function App() {
  const initialStageId = campaignStageOrder[0] ?? stageOrder[0]
  const [loadedSave] = useState(() => loadSaveGame())
  const [screen, setScreen] = useState<'select' | 'encounter'>('select')
  const [stageSelectMode, setStageSelectMode] = useState<StageSelectMode>('campaign')
  const [stageId, setStageId] = useState<StageId>(loadedSave?.stageId ?? initialStageId)
  const [encounterInstance, setEncounterInstance] = useState(0)
  const [highestClearedStageIndex, setHighestClearedStageIndex] = useState(
    loadedSave?.highestClearedStageIndex ?? INITIAL_HIGHEST_CLEARED_STAGE_INDEX,
  )
  const [selectedClassId, setSelectedClassId] = useState<PlayerClassId>(
    loadedSave?.selectedClassId ?? WARRIOR_T_CLASS_ID,
  )
  const [encounterClassId, setEncounterClassId] = useState<PlayerClassId>(WARRIOR_T_CLASS_ID)
  const [buildsByClassId, setBuildsByClassId] = useState<Record<PlayerClassId, PersistedBuildState>>(() =>
    loadedSave?.buildsByClassId ?? {
      warrior_t: getDefaultPersistedBuildForRule(
        getStageBuildRuleId(getStageById(initialStageId)),
        WARRIOR_T_CLASS_ID,
      ),
    },
  )
  const [classProgression, setClassProgression] = useState<ClassProgressionState>(() =>
    loadedSave
      ? {
          challengeVictoriesByClass: loadedSave.challengeVictoriesByClass,
          campaignVictoriesByClass: loadedSave.campaignVictoriesByClass,
          campaignUnlockedClassIds: loadedSave.campaignUnlockedClassIds,
        }
      : createEmptyClassProgression(),
  )
  const [tutorialState, setTutorialState] = useState<TutorialSaveState>(() =>
    loadedSave?.tutorial ?? createEmptyTutorialSaveState(),
  )
  const [seenEnemyDefinitionIds, setSeenEnemyDefinitionIds] = useState<string[]>(
    () => loadedSave?.seenEnemyDefinitionIds ?? [],
  )
  const [tutorialReplayVersion, setTutorialReplayVersion] = useState(0)

  const progressionUnlockedStageIndex = Math.min(highestClearedStageIndex + 1, campaignStageOrder.length - 1)
  const maxUnlockedStageIndex = Math.max(progressionUnlockedStageIndex, INITIAL_MAX_UNLOCKED_STAGE_INDEX)
  const recommendedStageId = campaignStageOrder[Math.max(0, progressionUnlockedStageIndex)] ?? initialStageId

  useEffect(() => {
    saveSaveGame({
      highestClearedStageIndex,
      stageId,
      selectedClassId,
      buildsByClassId,
      ...classProgression,
      seenEnemyDefinitionIds,
      tutorial: tutorialState,
    })
  }, [
    buildsByClassId,
    classProgression,
    highestClearedStageIndex,
    seenEnemyDefinitionIds,
    selectedClassId,
    stageId,
    tutorialState,
  ])

  function startStage(
    nextStageId: StageId,
    mode: StageSelectMode,
    classId: PlayerClassId,
    clearedCampaignIndex = highestClearedStageIndex,
  ) {
    const nextStageIndex = mode === 'campaign' ? campaignStageOrder.indexOf(nextStageId) : stageOrder.indexOf(nextStageId)
    const nextMaxUnlockedStageIndex = Math.max(
      Math.min(clearedCampaignIndex + 1, campaignStageOrder.length - 1),
      INITIAL_MAX_UNLOCKED_STAGE_INDEX,
    )
    if (nextStageIndex < 0 || (mode === 'campaign' && nextStageIndex > nextMaxUnlockedStageIndex)) {
      return
    }

    const nextStage = getStageById(nextStageId)
    const availableClassIds = getAvailableClassIdsForStage(nextStage, {
      highestClearedCampaignStageIndex: clearedCampaignIndex,
      ...classProgression,
    })
    if (!availableClassIds.includes(classId)) {
      return
    }

    const buildRuleId = getStageBuildRuleId(nextStage)
    const sourceBuild = buildsByClassId[classId]
      ?? getDefaultPersistedBuildForRule(buildRuleId, classId)
    const newlyUnlockedSkillIds = nextStage.unlockedActiveSkillIds
    const shouldAutoEquipNewSkills = shouldAutoEquipNewSkillsForStage(
      tutorialState,
      classId,
      nextStageId,
      newlyUnlockedSkillIds,
    )
    const normalized = normalizePersistedBuildForRule(
      sourceBuild,
      buildRuleId,
      classId,
      getPassiveTalentUnlockTierForStage(nextStage),
      getUnlockedActiveSkillIdsForStage(nextStage),
      shouldAutoEquipNewSkills ? newlyUnlockedSkillIds : [],
    )

    setBuildsByClassId((current) => ({ ...current, [classId]: normalized.build }))
    if (shouldAutoEquipNewSkills) {
      setTutorialState((current) => ({
        ...current,
        autoEquippedStageIdsByClass: {
          ...current.autoEquippedStageIdsByClass,
          [classId]: appendUniqueStageId(
            current.autoEquippedStageIdsByClass[classId] ?? [],
            nextStageId,
          ),
        },
      }))
    }
    setSeenEnemyDefinitionIds((current) =>
      appendSeenEnemyDefinitionIds(current, getEnemyDefinitionIdsForStage(nextStageId)),
    )
    setEncounterClassId(classId)
    setStageSelectMode(mode)
    setStageId(nextStageId)
    setEncounterInstance((value) => value + 1)
    setScreen('encounter')
  }

  function settleStageVictory() {
    setClassProgression((current) => recordStageVictory(current, {
      mode: stageSelectMode,
      stageId,
      classId: encounterClassId,
    }))
    if (stageSelectMode === 'campaign') {
      const clearedIndex = campaignStageOrder.indexOf(stageId)
      if (clearedIndex >= 0) {
        setHighestClearedStageIndex((current) => Math.max(current, clearedIndex))
      }
    }
  }

  function handleReturnToStageSelect(outcome?: 'victory' | 'defeat') {
    if (outcome === 'victory') {
      settleStageVictory()
    }
    setScreen('select')
  }

  function handleAdvanceStage() {
    settleStageVictory()
    const clearedIndex = campaignStageOrder.indexOf(stageId)
    const nextStageId = getNextStageId(stageId)
    if (!nextStageId) {
      setScreen('select')
      return
    }

    const nextStage = getStageById(nextStageId)
    const nextClearedIndex = Math.max(highestClearedStageIndex, clearedIndex)
    const availableClassIds = getAvailableClassIdsForStage(nextStage, {
      highestClearedCampaignStageIndex: nextClearedIndex,
      ...classProgression,
    })
    const nextClassId = resolveStageClassId(encounterClassId, availableClassIds)
    if (!nextClassId) {
      setScreen('select')
      return
    }
    startStage(nextStageId, 'campaign', nextClassId, nextClearedIndex)
  }

  function markStageSelectTutorialSeen(seenStageId: StageId) {
    setTutorialState((current) => ({
      ...current,
      seenStageSelectStageIds: appendUniqueStageId(current.seenStageSelectStageIds, seenStageId),
    }))
  }

  function markEncounterTutorialSeen(seenStageId: StageId) {
    setTutorialState((current) => ({
      ...current,
      seenEncounterStageIds: appendUniqueStageId(current.seenEncounterStageIds, seenStageId),
    }))
  }

  function markMonsterCodexTutorialSeen() {
    setTutorialState((current) => ({
      ...current,
      seenMonsterCodexTutorial: true,
    }))
  }

  function resetTutorials() {
    setTutorialState((current) => ({
      ...current,
      seenStageSelectStageIds: [],
      seenEncounterStageIds: [],
      seenMonsterCodexTutorial: false,
    }))
    setTutorialReplayVersion((value) => value + 1)
  }

  if (screen === 'select') {
    return (
      <StageSelectScreen
        defaultMode={stageSelectMode}
        defaultSelectedStageId={recommendedStageId}
        highestClearedStageIndex={highestClearedStageIndex}
        maxUnlockedStageIndex={maxUnlockedStageIndex}
        partyStageId={recommendedStageId}
        selectedClassId={selectedClassId}
        buildsByClassId={buildsByClassId}
        {...classProgression}
        seenEnemyDefinitionIds={seenEnemyDefinitionIds}
        monsterCodexTutorialSeen={tutorialState.seenMonsterCodexTutorial}
        stageSelectTutorialSeenStageIds={tutorialState.seenStageSelectStageIds}
        tutorialReplayVersion={tutorialReplayVersion}
        onSelectClass={setSelectedClassId}
        onStartStage={startStage}
        onResetTutorials={resetTutorials}
        onMonsterCodexTutorialComplete={markMonsterCodexTutorialSeen}
        onStageSelectTutorialComplete={markStageSelectTutorialSeen}
        onBuildChange={(classId, build, editedStageId) => {
          setBuildsByClassId((current) => ({ ...current, [classId]: build }))
          setTutorialState((current) => ({
            ...current,
            manualBuildConfiguredStageIdsByClass: {
              ...current.manualBuildConfiguredStageIdsByClass,
              [classId]: appendUniqueStageId(
                current.manualBuildConfiguredStageIdsByClass[classId] ?? [],
                editedStageId,
              ),
            },
          }))
        }}
      />
    )
  }

  const encounterStage = getStageById(stageId)
  const encounterBuild = buildsByClassId[encounterClassId]
    ?? getDefaultPersistedBuildForRule(getStageBuildRuleId(encounterStage), encounterClassId)

  return (
    <EncounterScreen
      key={`${stageId}-${encounterClassId}-${encounterInstance}`}
      stage={encounterStage}
      classId={encounterClassId}
      buildState={encounterBuild}
      unlockedPassiveTalentTier={getPassiveTalentUnlockTierForStage(encounterStage)}
      unlockedActiveSkillIds={getUnlockedActiveSkillIdsForStage(encounterStage)}
      tutorialEnabled={!tutorialState.seenEncounterStageIds.includes(stageId)}
      onTutorialComplete={() => markEncounterTutorialSeen(stageId)}
      onBuildChange={(build) => {
        setBuildsByClassId((current) => ({ ...current, [encounterClassId]: build }))
        setTutorialState((current) => ({
          ...current,
          manualBuildConfiguredStageIdsByClass: {
            ...current.manualBuildConfiguredStageIdsByClass,
            [encounterClassId]: appendUniqueStageId(
              current.manualBuildConfiguredStageIdsByClass[encounterClassId] ?? [],
              stageId,
            ),
          },
        }))
      }}
      onReturnToStageSelect={handleReturnToStageSelect}
      onRetryStage={() => startStage(stageId, stageSelectMode, encounterClassId)}
      onAdvanceStage={handleAdvanceStage}
    />
  )
}

export default App
