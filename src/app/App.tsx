import { useEffect, useState } from 'react'
import { getStageBuildRuleId } from '../game/data/encounterTemplates'
import {
  getDefaultPersistedBuildForRule,
  normalizePersistedBuildForRule,
} from '../game/data/playerBuildCatalog'
import { getNextStageId, getStageById, stageOrder, type StageId } from '../game/data/stageTemplates'
import {
  getPassiveTalentUnlockTierForStage,
  getUnlockedActiveSkillIdsForStage,
} from '../game/data/stageTemplates'
import {
  appendSeenEnemyDefinitionIds,
  getEnemyDefinitionIdsForStage,
} from '../game/data/monsterCodex'
import { EncounterScreen } from '../ui/EncounterScreen'
import { StageSelectScreen } from '../ui/StageSelectScreen'
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
  const initialStageId = stageOrder[0]
  const [loadedSave] = useState(() => loadSaveGame())
  const [screen, setScreen] = useState<'select' | 'encounter'>('select')
  const [stageId, setStageId] = useState<StageId>(loadedSave?.stageId ?? initialStageId)
  const [encounterInstance, setEncounterInstance] = useState(0)
  const [highestClearedStageIndex, setHighestClearedStageIndex] = useState(
    loadedSave?.highestClearedStageIndex ?? INITIAL_HIGHEST_CLEARED_STAGE_INDEX,
  )
  const [persistedBuild, setPersistedBuild] = useState(() =>
    loadedSave?.build ?? getDefaultPersistedBuildForRule(getStageBuildRuleId(getStageById(initialStageId))),
  )
  const [tutorialState, setTutorialState] = useState<TutorialSaveState>(() =>
    loadedSave?.tutorial ?? createEmptyTutorialSaveState(),
  )
  const [seenEnemyDefinitionIds, setSeenEnemyDefinitionIds] = useState<string[]>(
    () => loadedSave?.seenEnemyDefinitionIds ?? [],
  )
  const [tutorialReplayVersion, setTutorialReplayVersion] = useState(0)

  const progressionUnlockedStageIndex = Math.min(highestClearedStageIndex + 1, stageOrder.length - 1)
  const maxUnlockedStageIndex = Math.max(progressionUnlockedStageIndex, INITIAL_MAX_UNLOCKED_STAGE_INDEX)
  const recommendedStageId = stageOrder[Math.max(0, progressionUnlockedStageIndex)]

  useEffect(() => {
    saveSaveGame({
      highestClearedStageIndex,
      stageId,
      build: persistedBuild,
      seenEnemyDefinitionIds,
      tutorial: tutorialState,
    })
  }, [highestClearedStageIndex, persistedBuild, seenEnemyDefinitionIds, stageId, tutorialState])

  function startStage(nextStageId: StageId) {
    const nextStageIndex = stageOrder.indexOf(nextStageId)

    if (nextStageIndex < 0 || nextStageIndex > maxUnlockedStageIndex) {
      return
    }

    const nextStage = getStageById(nextStageId)
    const newlyUnlockedSkillIds = nextStage.unlockedActiveSkillIds
    const shouldAutoEquipNewSkills = shouldAutoEquipNewSkillsForStage(
      tutorialState,
      nextStageId,
      newlyUnlockedSkillIds,
    )
    const normalizedBuild = normalizePersistedBuildForRule(
      persistedBuild,
      getStageBuildRuleId(nextStage),
      getPassiveTalentUnlockTierForStage(nextStage),
      getUnlockedActiveSkillIdsForStage(nextStage),
      shouldAutoEquipNewSkills ? newlyUnlockedSkillIds : [],
    )

    setPersistedBuild(normalizedBuild.build)
    if (shouldAutoEquipNewSkills) {
      setTutorialState((current) => ({
        ...current,
        autoEquippedStageIds: current.autoEquippedStageIds.includes(nextStageId)
          ? current.autoEquippedStageIds
          : [...current.autoEquippedStageIds, nextStageId],
      }))
    }
    setSeenEnemyDefinitionIds((current) =>
      appendSeenEnemyDefinitionIds(current, getEnemyDefinitionIdsForStage(nextStageId))
    )
    setStageId(nextStageId)
    setEncounterInstance((value) => value + 1)
    setScreen('encounter')
  }

  function handleReturnToStageSelect(outcome?: 'victory' | 'defeat') {
    if (outcome === 'victory') {
      const clearedIndex = stageOrder.indexOf(stageId)
      setHighestClearedStageIndex((current) => Math.max(current, clearedIndex))
    }

    setScreen('select')
  }

  function handleAdvanceStage() {
    const clearedIndex = stageOrder.indexOf(stageId)
    setHighestClearedStageIndex((current) => Math.max(current, clearedIndex))

    const nextStageId = getNextStageId(stageId)

    if (!nextStageId) {
      setScreen('select')
      return
    }

    startStage(nextStageId)
  }

  function markStageSelectTutorialSeen(seenStageId: StageId) {
    setTutorialState((current) => ({
      ...current,
      seenStageSelectStageIds: current.seenStageSelectStageIds.includes(seenStageId)
        ? current.seenStageSelectStageIds
        : [...current.seenStageSelectStageIds, seenStageId],
    }))
  }

  function markEncounterTutorialSeen(seenStageId: StageId) {
    setTutorialState((current) => ({
      ...current,
      seenEncounterStageIds: current.seenEncounterStageIds.includes(seenStageId)
        ? current.seenEncounterStageIds
        : [...current.seenEncounterStageIds, seenStageId],
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
        defaultSelectedStageId={recommendedStageId}
        highestClearedStageIndex={highestClearedStageIndex}
        maxUnlockedStageIndex={maxUnlockedStageIndex}
        partyStageId={recommendedStageId}
        persistedBuild={persistedBuild}
        seenEnemyDefinitionIds={seenEnemyDefinitionIds}
        monsterCodexTutorialSeen={tutorialState.seenMonsterCodexTutorial}
        stageSelectTutorialSeenStageIds={tutorialState.seenStageSelectStageIds}
        tutorialReplayVersion={tutorialReplayVersion}
        onStartStage={startStage}
        onResetTutorials={resetTutorials}
        onMonsterCodexTutorialComplete={markMonsterCodexTutorialSeen}
        onStageSelectTutorialComplete={markStageSelectTutorialSeen}
        onBuildChange={(build, editedStageId) => {
          const nextTutorialState = {
            ...tutorialState,
            manualBuildConfiguredStageIds: appendUniqueStageId(
              tutorialState.manualBuildConfiguredStageIds,
              editedStageId,
            ),
          }
          setPersistedBuild(build)
          setTutorialState(nextTutorialState)
          saveSaveGame({
            highestClearedStageIndex,
            stageId,
            build,
            seenEnemyDefinitionIds,
            tutorial: nextTutorialState,
          })
        }}
      />
    )
  }

  return (
    <EncounterScreen
      key={`${stageId}-${encounterInstance}`}
      stage={getStageById(stageId)}
      buildState={persistedBuild}
      unlockedPassiveTalentTier={getPassiveTalentUnlockTierForStage(getStageById(stageId))}
      unlockedActiveSkillIds={getUnlockedActiveSkillIdsForStage(getStageById(stageId))}
      tutorialEnabled={!tutorialState.seenEncounterStageIds.includes(stageId)}
      onTutorialComplete={() => markEncounterTutorialSeen(stageId)}
      onBuildChange={(build) => {
        setPersistedBuild(build)
        saveSaveGame({
          highestClearedStageIndex,
          stageId,
          build,
          seenEnemyDefinitionIds,
          tutorial: tutorialState,
        })
      }}
      onReturnToStageSelect={handleReturnToStageSelect}
      onRetryStage={() => startStage(stageId)}
      onAdvanceStage={handleAdvanceStage}
    />
  )
}

export default App
