import type { CSSProperties } from 'react'
import { useState } from 'react'
import { getStageBuildRuleId } from '../game/data/encounterTemplates'
import {
  ACTIVE_SKILL_POINT_COST,
  SKILL_HOTKEYS,
  canUseSkillInRule,
  canUseTalentInRule,
  getDefaultPersistedBuildForRule,
  getActivePointCost,
  getActiveSkillCatalog,
  getActiveSkillDefinition,
  getBuildRuleDefinition,
  getNextPassiveTalentIdsForToggle,
  getPassivePointCost,
  getPassiveTalentCatalog,
  getPassiveTalentDefinition,
  getPlayerClassCatalog,
  getPlayerClassDefinition,
  getTotalBuildPoints,
  isHotkeyEnabledForRule,
  normalizePersistedBuildForRule,
} from '../game/data/playerBuildCatalog'
import type {
  PassiveTalentId,
  PersistedBuildState,
  PlayerClassId,
  SkillHotkey,
  SkillId,
  SkillLoadout,
} from '../game/encounter/encounterTypes'
import {
  campaignStageAreaOrder,
  campaignStageOrder,
  getStageAreaById,
  getPassiveTalentUnlockTierForStage,
  getStageById,
  getUnlockedActiveSkillIdsForStage,
  stageOrder,
  type StageAreaId,
  type StageId,
  type StageLegendEntry,
  type StageSectionEntry,
  stageCatalog,
} from '../game/data/stageTemplates'
import { buildMonsterCodexEntries } from '../game/data/monsterCodex'
import * as playerClassRuntimeRegistry from '../game/playerClasses/playerClassRuntimeRegistry'
import {
  hasClassVictory,
  type ClassProgressionState,
} from '../game/progression/classProgression'
import {
  getAvailableClassIdsForStage,
  resolveStageClassId,
} from '../game/progression/stageClassAvailability'
import { isChallengeStageOpen } from '../game/progression/classTrialPolicy'
import { getStageNodeLayout } from './stageSelectMapLayout'
import {
  buildStageSelectBuildRuleModal,
  buildStageSelectConflictModal,
  shouldShowBuildConflictButton,
} from './stageSelectViewModel'
import { resolveIconAssetUrl } from './statusIconResolver'
import { MonsterCodexPanel } from './MonsterCodexPanel'
import { PassiveTalentPanel } from './PassiveTalentPanel'
import { SkillConfigPanel } from './SkillConfigPanel'
import { StageClassEntryControl, type StageClassEntryOption } from './StageClassEntryControl'
import { TutorialOverlay } from './TutorialOverlay'
import { getMonsterCodexTutorialScript, getStageSelectTutorialScript } from './tutorialGuide'

interface StageSelectScreenProps extends ClassProgressionState {
  defaultMode?: StageSelectMode
  defaultSelectedStageId: StageId
  highestClearedStageIndex: number
  maxUnlockedStageIndex: number
  partyStageId: StageId
  selectedClassId: PlayerClassId
  buildsByClassId: Record<PlayerClassId, PersistedBuildState>
  seenEnemyDefinitionIds?: readonly string[]
  monsterCodexTutorialSeen?: boolean
  stageSelectTutorialSeenStageIds?: readonly StageId[]
  tutorialReplayVersion?: number
  onSelectClass: (classId: PlayerClassId) => void
  onStartStage: (stageId: StageId, mode: StageSelectMode, classId: PlayerClassId) => void
  onResetTutorials?: () => void
  onMonsterCodexTutorialComplete?: () => void
  onStageSelectTutorialComplete?: (stageId: StageId) => void
  onBuildChange?: (classId: PlayerClassId, build: PersistedBuildState, stageId: StageId) => void
}

const AREA_CAPTIONS: Record<StageAreaId, { x: string; y: string }> = {
  harbor: { x: '12%', y: '24%' },
  midland: { x: '48%', y: '16%' },
  highland: { x: '79%', y: '6%' },
}

const DEFAULT_AREA_CAPTION_IDS = Object.keys(AREA_CAPTIONS) as StageAreaId[]

type StageInfoModal = 'none' | 'rule' | 'conflict' | 'legend' | 'build'
export type StageSelectMode = 'campaign' | 'challenge'

interface StageInfoRow {
  id: string
  iconId?: string
  title: string
  description: string
  meta: string
}

interface ChallengeModeEntry {
  id: string
  stageId: StageId
  title: string
  subtitle: string
  recommendedDifficulty: string
  allowedClasses: string[]
  enemySummary: string
}

function formatClassId(classId: string) {
  if (classId === 'warrior_t') {
    return '战士 T'
  }

  return classId
}

function buildChallengeModeEntries(): ChallengeModeEntry[] {
  return stageOrder
    .filter((stageId) => stageId.startsWith('Challenge-'))
    .map((stageId) => {
      const stage = getStageById(stageId)
      return {
        id: stage.challengeId ?? stage.id,
        stageId: stage.id,
        title: stage.title,
        subtitle: stage.subtitle,
        recommendedDifficulty: stage.recommendedDifficulty ?? 'unrated',
        allowedClasses: (stage.allowedClassIds && stage.allowedClassIds.length > 0
          ? stage.allowedClassIds
          : ['warrior_t']).map(formatClassId),
        enemySummary: stage.enemySummary ?? '',
      }
    })
}

function createStageSectionRows(meta: string, entries: StageSectionEntry[]): StageInfoRow[] {
  return entries.map((entry) => ({
    id: `${meta}-${entry.id}`,
    iconId: entry.iconId,
    title: entry.title,
    description: entry.description,
    meta,
  }))
}

function createStageLegendRows(entries: StageLegendEntry[]): StageInfoRow[] {
  return entries.map((entry) => ({
    id: `legend-${entry.id}`,
    iconId: entry.iconId,
    title: entry.label,
    description: entry.description,
    meta: [entry.source, entry.target].filter(Boolean).join(' / '),
  }))
}

function StageInfoIcon({ iconId, title }: { iconId?: string; title: string }) {
  const iconUrl = iconId ? resolveIconAssetUrl(iconId, 'status') : null
  const fallbackText = title.trim().slice(0, 1) || '?'

  return (
    <span className="stage-brief__row-icon" data-icon-id={iconId ?? ''} aria-hidden="true">
      {iconUrl ? <img src={iconUrl} alt="" /> : <span>{fallbackText}</span>}
    </span>
  )
}

function canAssignSkillToHotkey(
  buildRuleId: string,
  classId: PlayerClassId,
  loadout: SkillLoadout,
  hotkey: SkillHotkey,
  skillId: SkillId,
  remainingBuildPoints: number,
  unlockedActiveSkillIds: readonly SkillId[],
) {
  if (!isHotkeyEnabledForRule(buildRuleId, hotkey) || !canUseSkillInRule(buildRuleId, classId, skillId, unlockedActiveSkillIds)) {
    return false
  }

  const assignedHotkey = SKILL_HOTKEYS.find((entry) => loadout[entry] === skillId)
  const targetSkillId = loadout[hotkey]

  if (assignedHotkey === hotkey) {
    return true
  }

  if (assignedHotkey || targetSkillId) {
    return true
  }

  return remainingBuildPoints >= ACTIVE_SKILL_POINT_COST
}

function assignSkillToHotkey(loadout: SkillLoadout, hotkey: SkillHotkey, skillId: SkillId) {
  const nextLoadout: SkillLoadout = { ...loadout }
  const assignedHotkey = SKILL_HOTKEYS.find((entry) => loadout[entry] === skillId)
  const currentSkill = loadout[hotkey]

  if (assignedHotkey && assignedHotkey !== hotkey) {
    nextLoadout[assignedHotkey] = currentSkill
  }

  nextLoadout[hotkey] = skillId
  return nextLoadout
}

function canTogglePassiveTalent(
  buildRuleId: string,
  passiveTalentId: PassiveTalentId,
  selectedPassiveTalentIds: PassiveTalentId[],
  activePoints: number,
) {
  const nextPassiveTalentIds = getNextPassiveTalentIdsForToggle(passiveTalentId, selectedPassiveTalentIds)

  const nextTotalPoints = getTotalBuildPoints(buildRuleId, nextPassiveTalentIds)
  const nextPassivePoints = getPassivePointCost(nextPassiveTalentIds)
  return nextTotalPoints - activePoints - nextPassivePoints >= 0
}

function getStageAreaCaption(areaId: StageAreaId) {
  const explicitCaption = AREA_CAPTIONS[areaId]
  if (explicitCaption) {
    return explicitCaption
  }

  const areaIndex = campaignStageAreaOrder.indexOf(areaId)
  const fallbackAreaId = DEFAULT_AREA_CAPTION_IDS[Math.max(0, areaIndex) % DEFAULT_AREA_CAPTION_IDS.length] ?? DEFAULT_AREA_CAPTION_IDS[0]
  return AREA_CAPTIONS[fallbackAreaId]
}

const ROUTE_SEGMENTS = [
  'M 10 78 C 12 74, 13 71, 16 68',
  'M 16 68 C 19 68, 21 70, 24 73',
  'M 24 73 C 28 69, 29 64, 30 60',
  'M 30 60 C 28 56, 26 52, 24 49',
  'M 24 49 C 28 47, 32 46, 36 45',
  'M 36 45 C 39 47, 42 51, 44 55',
  'M 44 55 C 47 59, 49 62, 52 63',
  'M 52 63 C 55 61, 57 58, 60 55',
  'M 60 55 C 57 50, 54 46, 52 41',
  'M 52 41 C 56 39, 60 37, 64 36',
  'M 64 36 C 68 38, 70 41, 72 46',
  'M 72 46 C 74 42, 75 37, 76 32',
  'M 76 32 C 79 28, 81 25, 84 24',
  'M 84 24 C 88 26, 90 29, 91 33',
  'M 91 33 C 88 37, 86 41, 84 46',
  'M 84 46 C 88 49, 90 52, 92 56',
  'M 92 56 C 90 61, 88 64, 86 67',
] as const

const ENTER_ACTION_ARROW_START = { x: 50, y: 91.6 } as const

function parseMapPercent(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveExistingStageId(stageId: StageId, fallbackStageId = campaignStageOrder[0] ?? stageOrder[0]) {
  if (stageCatalog[stageId]) {
    return stageId
  }

  if (stageCatalog[fallbackStageId]) {
    return fallbackStageId
  }

  return campaignStageOrder.find((candidateStageId) => Boolean(stageCatalog[candidateStageId]))
    ?? stageOrder.find((candidateStageId) => Boolean(stageCatalog[candidateStageId]))
    ?? stageOrder[0]
}

export function StageSelectScreen({
  defaultMode = 'campaign',
  defaultSelectedStageId,
  highestClearedStageIndex,
  maxUnlockedStageIndex,
  partyStageId,
  selectedClassId,
  buildsByClassId,
  challengeVictoriesByClass,
  campaignVictoriesByClass,
  campaignUnlockedClassIds,
  seenEnemyDefinitionIds = [],
  monsterCodexTutorialSeen = true,
  stageSelectTutorialSeenStageIds = [],
  tutorialReplayVersion = 0,
  onSelectClass,
  onStartStage,
  onResetTutorials,
  onMonsterCodexTutorialComplete,
  onStageSelectTutorialComplete,
  onBuildChange,
}: StageSelectScreenProps) {
  const [selectedStageId, setSelectedStageId] = useState<StageId>(defaultSelectedStageId)
  const [buildInfoModal, setBuildInfoModal] = useState<StageInfoModal>('none')
  const [openBuildPanel, setOpenBuildPanel] = useState<'skills' | 'passives' | null>(null)
  const [isMonsterCodexOpen, setIsMonsterCodexOpen] = useState(false)
  const [selectedConfigHotkey, setSelectedConfigHotkey] = useState<SkillHotkey | null>('1')
  const [stageSelectMode, setStageSelectMode] = useState<StageSelectMode>(defaultMode)
  const challengeModeEntries = buildChallengeModeEntries()
  const fallbackChallengeStageId = campaignStageOrder[0] ?? stageOrder[0]
  const fallbackChallengeStage = getStageById(fallbackChallengeStageId)
  const fallbackChallengeEntry: ChallengeModeEntry = {
    id: fallbackChallengeStage.id,
    stageId: fallbackChallengeStage.id,
    title: fallbackChallengeStage.title,
    subtitle: fallbackChallengeStage.subtitle,
    recommendedDifficulty: 'unrated',
    allowedClasses: ['战士 T'],
    enemySummary: '',
  }
  const [selectedChallengeId, setSelectedChallengeId] = useState(challengeModeEntries[0]?.id ?? fallbackChallengeEntry.id)
  const selectedChallenge = challengeModeEntries.find((entry) => entry.id === selectedChallengeId)
    ?? challengeModeEntries[0]
    ?? fallbackChallengeEntry
  const selectedCampaignStageId = resolveExistingStageId(selectedStageId)
  const selectedChallengeStageId = resolveExistingStageId(selectedChallenge.stageId, fallbackChallengeEntry.stageId)
  const effectiveSelectedStageId = stageSelectMode === 'challenge' ? selectedChallengeStageId : selectedCampaignStageId
  const selectedStage = getStageById(effectiveSelectedStageId)
  const classRuntimeDefinitions = playerClassRuntimeRegistry.getPlayerClassRuntimeDefinitions()
  const enabledClassIds = getPlayerClassCatalog().map((definition) => definition.classId)
  const availableClassIds = getAvailableClassIdsForStage(selectedStage, {
    highestClearedCampaignStageIndex: highestClearedStageIndex,
    challengeVictoriesByClass,
    campaignVictoriesByClass,
    campaignUnlockedClassIds,
    registeredClassIds: classRuntimeDefinitions.map((runtime) => runtime.classId),
    enabledClassIds,
  })
  const effectiveClassId = resolveStageClassId(selectedClassId, availableClassIds)
  const classEntryOptions = classRuntimeDefinitions
    .filter((runtime) => availableClassIds.includes(runtime.classId))
    .map<StageClassEntryOption | null>((runtime) => {
      const classDefinition = getPlayerClassDefinition(runtime.classId)
      if (!classDefinition) {
        return null
      }
      return {
        classId: runtime.classId,
        className: classDefinition.className,
        buttonIconKey: runtime.buttonIconKey,
        cleared: hasClassVictory(
          stageSelectMode === 'challenge' ? challengeVictoriesByClass : campaignVictoriesByClass,
          runtime.classId,
          effectiveSelectedStageId,
        ),
      }
    })
    .filter((option): option is StageClassEntryOption => Boolean(option))
  const tutorialScript = getStageSelectTutorialScript(selectedStage) ?? []
  const shouldShowSelectedStageTutorial = tutorialScript.length > 0 && !stageSelectTutorialSeenStageIds.includes(selectedStageId)
  const [tutorialState, setTutorialState] = useState(() => ({
    stageId: defaultSelectedStageId,
    replayVersion: tutorialReplayVersion,
    stepIndex: shouldShowSelectedStageTutorial || (highestClearedStageIndex >= 1 && !monsterCodexTutorialSeen) ? 0 : -1,
  }))
  const selectedBuildRuleId = getStageBuildRuleId(selectedStage)
  const selectedBuildRule = getBuildRuleDefinition(selectedBuildRuleId)
  const unlockedActiveSkillIds = getUnlockedActiveSkillIdsForStage(selectedStage)
  const selectedBuild = effectiveClassId ? buildsByClassId[effectiveClassId] : undefined
  const persistedBuild = effectiveClassId && selectedBuild
    ? selectedBuild
    : effectiveClassId
      ? getDefaultPersistedBuildForRule(selectedBuildRuleId, effectiveClassId)
      : null
  const buildPreview = persistedBuild && effectiveClassId
    ? normalizePersistedBuildForRule(
        persistedBuild,
        selectedBuildRuleId,
        effectiveClassId,
        getPassiveTalentUnlockTierForStage(selectedStage),
        unlockedActiveSkillIds,
      )
    : {
        build: {
          loadout: Object.fromEntries(SKILL_HOTKEYS.map((hotkey) => [hotkey, null])) as SkillLoadout,
          passiveTalentIds: [],
        },
        warnings: [],
      }
  const selectedStageIndex = campaignStageOrder.indexOf(effectiveSelectedStageId)
  const isMonsterCodexUnlocked = highestClearedStageIndex >= 1
  const monsterCodexTutorialScript = isMonsterCodexUnlocked && !monsterCodexTutorialSeen
    ? getMonsterCodexTutorialScript()
    : []
  const activeTutorialScript = shouldShowSelectedStageTutorial ? tutorialScript : monsterCodexTutorialScript
  const selectedArea = getStageAreaById(selectedStage.areaId)
  const partyStage = getStageById(partyStageId)
  const stageAffixRows = createStageSectionRows('词缀', selectedStage.affixes)
  const stageRuleRows = createStageSectionRows('规则', selectedStage.rules)
  const stageLegendRows = createStageLegendRows(selectedStage.legend)
  const stageBriefRows = [...stageAffixRows, ...stageRuleRows]
  const activePreviewSkills = Object.values(buildPreview.build.loadout)
    .filter((skillId): skillId is string => Boolean(skillId))
    .map((skillId) => getActiveSkillDefinition(skillId)?.shortName ?? skillId)
  const passivePreviewTalents = buildPreview.build.passiveTalentIds.map(
    (talentId) => getPassiveTalentDefinition(talentId)?.name ?? talentId,
  )
  const skillLoadout = buildPreview.build.loadout
  const selectedPassiveTalentIds = buildPreview.build.passiveTalentIds
  const activeSkills = getActiveSkillCatalog()
    .filter((skill) => Boolean(effectiveClassId) && canUseSkillInRule(
      selectedBuildRuleId,
      effectiveClassId!,
      skill.id,
      unlockedActiveSkillIds,
    ))
    .sort((left, right) => (left.uiOrder ?? 999) - (right.uiOrder ?? 999) || left.id.localeCompare(right.id))
  const unlockedPassiveTalentTier = getPassiveTalentUnlockTierForStage(selectedStage)
  const passiveTalents = getPassiveTalentCatalog().filter((talent) =>
    Boolean(effectiveClassId) && canUseTalentInRule(
      selectedBuildRuleId,
      effectiveClassId!,
      talent.id,
      unlockedPassiveTalentTier,
    )
  )
  const activePoints = getActivePointCost(skillLoadout)
  const passivePoints = getPassivePointCost(selectedPassiveTalentIds)
  const totalBuildPoints = getTotalBuildPoints(selectedBuildRuleId, selectedPassiveTalentIds)
  const remainingBuildPoints = totalBuildPoints - activePoints - passivePoints
  const buildWarningMessages = buildPreview.warnings.map((warning) => warning.message)
  const hasBuildConflict = shouldShowBuildConflictButton(buildWarningMessages)
  const buildRuleModal = selectedBuildRule
    ? buildStageSelectBuildRuleModal({
        ruleName: selectedBuildRule.ruleName,
        description: selectedBuildRule.description,
        totalBuildPoints: selectedBuildRule.totalBuildPoints,
        maxActiveSlots: selectedBuildRule.maxActiveSlots,
        enabledHotkeys: selectedBuildRule.enabledHotkeys,
      })
    : null
  const buildConflictModal = buildStageSelectConflictModal(buildWarningMessages)
  const normalizedTutorialStepIndex =
    tutorialState.stageId === effectiveSelectedStageId && tutorialState.replayVersion === tutorialReplayVersion
      ? tutorialState.stepIndex
      : activeTutorialScript.length > 0 ? 0 : -1
  const tutorialStep =
    normalizedTutorialStepIndex >= 0 && normalizedTutorialStepIndex < activeTutorialScript.length
      ? activeTutorialScript[normalizedTutorialStepIndex]
      : null
  const tutorialRequestedBuildModal =
    tutorialStep?.target === '[data-tutorial-id="stage-skill-config-button"]' ||
    tutorialStep?.target === '[data-tutorial-id="stage-passive-config-button"]'
  const effectiveBuildInfoModal = tutorialRequestedBuildModal ? 'build' : buildInfoModal
  const effectiveOpenBuildPanel = tutorialStep?.openPanel ?? openBuildPanel
  const activeBuildModal = effectiveBuildInfoModal === 'rule' ? buildRuleModal : effectiveBuildInfoModal === 'conflict' ? buildConflictModal : null
  const isLegendModalOpen = effectiveBuildInfoModal === 'legend'
  const isBuildMenuOpen = effectiveBuildInfoModal === 'build'
  const selectedNodeLayout = getStageNodeLayout(selectedStage)
  const selectedArrowTarget = {
    x: parseMapPercent(selectedNodeLayout.x),
    y: parseMapPercent(selectedNodeLayout.y),
  }
  const selectedStagePointerStyle = {
    '--arrow-from-x': `${ENTER_ACTION_ARROW_START.x}%`,
    '--arrow-from-y': `${ENTER_ACTION_ARROW_START.y}%`,
    '--arrow-to-x': selectedNodeLayout.x,
    '--arrow-to-y': selectedNodeLayout.y,
    '--selected-accent': selectedArea.accent,
  } as CSSProperties
  const partyMarkerStyle = {
    '--party-x': getStageNodeLayout(partyStage).x,
    '--party-y': getStageNodeLayout(partyStage).y,
    '--party-accent': getStageAreaById(partyStage.areaId).accent,
  } as CSSProperties
  const monsterCodexEntries = buildMonsterCodexEntries(seenEnemyDefinitionIds)

  function commitBuild(nextLoadout: SkillLoadout, nextPassiveTalentIds: PassiveTalentId[]) {
    if (!effectiveClassId) {
      return
    }
    onBuildChange?.(
      effectiveClassId,
      { loadout: nextLoadout, passiveTalentIds: nextPassiveTalentIds },
      effectiveSelectedStageId,
    )
  }

  function advanceTutorial() {
    const next = normalizedTutorialStepIndex + 1
    const hasNextStep = next < activeTutorialScript.length
    if (!hasNextStep) {
      if (shouldShowSelectedStageTutorial) {
        onStageSelectTutorialComplete?.(selectedStageId)
      } else {
        onMonsterCodexTutorialComplete?.()
      }
    }
    setTutorialState({
      stageId: selectedStageId,
      replayVersion: tutorialReplayVersion,
      stepIndex: hasNextStep ? next : -1,
    })
  }

  function skipTutorial() {
    if (shouldShowSelectedStageTutorial) {
      onStageSelectTutorialComplete?.(selectedStageId)
    } else {
      onMonsterCodexTutorialComplete?.()
    }
    setTutorialState({
      stageId: selectedStageId,
      replayVersion: tutorialReplayVersion,
      stepIndex: -1,
    })
  }

  function closeBuildPanel() {
    if (tutorialStep?.openPanel) {
      skipTutorial()
    }
    setOpenBuildPanel(null)
  }

  function handleAssignSkill(skillId: SkillId) {
    if (!selectedConfigHotkey || !effectiveClassId) {
      return
    }

    if (
      !canAssignSkillToHotkey(
        selectedBuildRuleId,
        effectiveClassId,
        skillLoadout,
        selectedConfigHotkey,
        skillId,
        remainingBuildPoints,
        unlockedActiveSkillIds,
      )
    ) {
      return
    }

    commitBuild(assignSkillToHotkey(skillLoadout, selectedConfigHotkey, skillId), selectedPassiveTalentIds)
  }

  function handleClearHotkey(hotkey: SkillHotkey) {
    commitBuild(
      {
        ...skillLoadout,
        [hotkey]: null,
      },
      selectedPassiveTalentIds,
    )
  }

  function handleTogglePassive(talentId: PassiveTalentId) {
    if (!effectiveClassId || !canUseTalentInRule(
      selectedBuildRuleId,
      effectiveClassId,
      talentId,
      unlockedPassiveTalentTier,
    )) {
      return
    }
    if (!canTogglePassiveTalent(selectedBuildRuleId, talentId, selectedPassiveTalentIds, activePoints)) {
      return
    }

    const nextPassiveTalentIds = getNextPassiveTalentIdsForToggle(talentId, selectedPassiveTalentIds)

    commitBuild(skillLoadout, nextPassiveTalentIds)
  }

  return (
    <main className="encounter-shell">
      <div className="encounter-stage stage-select">
        <section className="stage-select__hero">
          {isMonsterCodexUnlocked ? (
            <button
              type="button"
              className="stage-select__codex-button"
              data-tutorial-id="monster-codex-button"
              onClick={() => setIsMonsterCodexOpen(true)}
            >
              怪物图鉴
            </button>
          ) : null}
          <p className="eyebrow">Little Tank 原型</p>
          <h1>战场地图</h1>
          <div className="stage-mode-switch" role="tablist" aria-label="选择玩法模式">
            <button
              type="button"
              className={[
                'stage-mode-switch__button',
                stageSelectMode === 'campaign' ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              aria-selected={stageSelectMode === 'campaign'}
              onClick={() => {
                setStageSelectMode('campaign')
                setBuildInfoModal('none')
                setOpenBuildPanel(null)
              }}
            >
              主线战役
            </button>
            <button
              type="button"
              className={[
                'stage-mode-switch__button',
                stageSelectMode === 'challenge' ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              aria-selected={stageSelectMode === 'challenge'}
              onClick={() => {
                setStageSelectMode('challenge')
                setBuildInfoModal('none')
                setOpenBuildPanel(null)
              }}
            >
              挑战模式
            </button>
          </div>
          {onResetTutorials ? (
            <button type="button" className="stage-select__reset-tutorial" onClick={onResetTutorials}>
              重置教程
            </button>
          ) : null}
        </section>

        <section className="stage-select__layout">
          {stageSelectMode === 'campaign' ? (
          <div className="stage-map" aria-label="关卡地图">
            <div className="stage-map__terrain stage-map__terrain--sea" />
            <div className="stage-map__terrain stage-map__terrain--harbor-main" />
            <div className="stage-map__terrain stage-map__terrain--harbor-ridge" />
            <div className="stage-map__terrain stage-map__terrain--midland-main" />
            <div className="stage-map__terrain stage-map__terrain--midland-ridge" />
            <div className="stage-map__terrain stage-map__terrain--highland-main" />
            <div className="stage-map__terrain stage-map__terrain--highland-ridge" />
            <div className="stage-map__terrain stage-map__terrain--bridge-west" />
            <div className="stage-map__terrain stage-map__terrain--bridge-east" />
            <div className="stage-map__terrain stage-map__terrain--mist" />

            <svg className="stage-map__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {ROUTE_SEGMENTS.map((segment, index) => (
                <g key={segment}>
                  <path d={segment} className="stage-map__route-shadow" />
                  <path
                    d={segment}
                    className={[
                      'stage-map__route-line',
                      index <= highestClearedStageIndex ? 'is-cleared' : index <= maxUnlockedStageIndex ? 'is-open' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                </g>
              ))}
            </svg>

            {campaignStageAreaOrder.map((areaId) => {
              const area = getStageAreaById(areaId)
              const caption = getStageAreaCaption(areaId)
              return (
                <div
                  key={areaId}
                  className="stage-map__caption"
                  style={{ left: caption.x, top: caption.y, '--caption-accent': area.accent } as CSSProperties}
                >
                  <strong>{area.title}</strong>
                  <span>{area.mapLabel}</span>
                </div>
              )
            })}

            <div className="stage-party-marker" style={partyMarkerStyle}>
              <span className="stage-party-marker__flag">队伍</span>
              <span className="stage-party-marker__pole" />
            </div>

            <svg
              className="stage-map__selected-arrow"
              style={selectedStagePointerStyle}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="stage-selected-arrow-head"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path className="stage-map__selected-arrow-head" d="M 0 0 L 8 4 L 0 8 Z" />
                </marker>
              </defs>
              <line
                className="stage-map__selected-arrow-glow"
                x1={ENTER_ACTION_ARROW_START.x}
                y1={ENTER_ACTION_ARROW_START.y}
                x2={selectedArrowTarget.x}
                y2={selectedArrowTarget.y}
              />
              <line
                className="stage-map__selected-arrow-line"
                x1={ENTER_ACTION_ARROW_START.x}
                y1={ENTER_ACTION_ARROW_START.y}
                x2={selectedArrowTarget.x}
                y2={selectedArrowTarget.y}
                markerEnd="url(#stage-selected-arrow-head)"
              />
            </svg>

            {campaignStageOrder.map((stageId, index) => {
              const stage = getStageById(stageId)
              const layout = getStageNodeLayout(stage)
              const area = getStageAreaById(stage.areaId)
              const isSelected = stageId === selectedStageId
              const isCompleted = index <= highestClearedStageIndex
              const isUnlocked = index <= maxUnlockedStageIndex
              const isRecommended = stageId === partyStageId && !isCompleted
              const style = {
                '--node-x': layout.x,
                '--node-y': layout.y,
                '--node-accent': area.accent,
              } as CSSProperties

              return (
                <button
                  key={stageId}
                  type="button"
                  className={[
                    'stage-node',
                    isSelected ? 'is-selected' : '',
                    isCompleted ? 'is-completed' : '',
                    isUnlocked ? 'is-unlocked' : 'is-locked',
                    isRecommended ? 'is-recommended' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={style}
                  disabled={!isUnlocked}
                  onClick={() => {
                    setSelectedStageId(stageId)
                    const nextStage = getStageById(stageId)
                    const nextScript = getStageSelectTutorialScript(nextStage) ?? []
                    const shouldShowTutorial = nextScript.length > 0 && !stageSelectTutorialSeenStageIds.includes(stageId)
                    setTutorialState({
                      stageId,
                      replayVersion: tutorialReplayVersion,
                      stepIndex: shouldShowTutorial ? 0 : -1,
                    })
                    setBuildInfoModal('none')
                    setOpenBuildPanel(null)
                  }}
                >
                  <span className="stage-node__halo" />
                  <span className="stage-node__core">{isCompleted ? '\u2713' : stage.stageNumber}</span>
                  <span className="stage-node__label">
                    <strong>
                      {area.shortTitle}-{stage.stageNumber}
                    </strong>
                    <span>{isCompleted ? '已通关' : isUnlocked ? stage.title : '尚未解锁'}</span>
                  </span>
                </button>
              )
            })}

            <StageClassEntryControl
              classes={classEntryOptions}
              selectedClassId={effectiveClassId ?? selectedClassId}
              disabled={selectedStageIndex > maxUnlockedStageIndex || !effectiveClassId}
              onSelectClass={onSelectClass}
              onEnter={() => {
                if (effectiveClassId) {
                  onStartStage(effectiveSelectedStageId, 'campaign', effectiveClassId)
                }
              }}
            />
          </div>
          ) : (
            <div className="challenge-board" aria-label="挑战模式">
              <div className="challenge-board__header">
                <span className="stage-brief__kicker">挑战模式</span>
                <h2>自由挑战</h2>
                <p>选择一组独立挑战，使用对应构筑规则、词缀和特殊规则进入战斗。</p>
              </div>

              <div className="challenge-list">
                {challengeModeEntries.map((challenge) => {
                  const challengeStageId = resolveExistingStageId(challenge.stageId, fallbackChallengeEntry.stageId)
                  const challengeStage = getStageById(challengeStageId)
                  const isSelectedChallenge = challenge.id === selectedChallenge.id
                  const isOpen = isChallengeStageOpen(challengeStageId, highestClearedStageIndex)

                  return (
                    <button
                      key={challenge.id}
                      type="button"
                      className={[
                        'challenge-card',
                        isSelectedChallenge ? 'is-selected' : '',
                        isOpen ? '' : 'is-locked',
                      ].filter(Boolean).join(' ')}
                      disabled={!isOpen}
                      onClick={() => {
                        if (!isOpen) {
                          return
                        }
                        setSelectedChallengeId(challenge.id)
                        setBuildInfoModal('none')
                        setOpenBuildPanel(null)
                      }}
                    >
                      <span className="challenge-card__meta">
                        {challenge.recommendedDifficulty} / {challengeStage.areaTitle}
                      </span>
                      <strong>{challenge.title}</strong>
                      <span>{challenge.subtitle}</span>
                      <em>{challenge.enemySummary}</em>
                    </button>
                  )
                })}
              </div>

              <StageClassEntryControl
                classes={classEntryOptions}
                selectedClassId={effectiveClassId ?? selectedClassId}
                disabled={!isChallengeStageOpen(selectedChallengeStageId, highestClearedStageIndex) || !effectiveClassId}
                onSelectClass={onSelectClass}
                onEnter={() => {
                  if (effectiveClassId) {
                    onStartStage(effectiveSelectedStageId, 'challenge', effectiveClassId)
                  }
                }}
              />
            </div>
          )}

          <aside className="panel stage-brief">
            <div className="stage-brief__header">
              <span className="stage-brief__index">
                {stageSelectMode === 'challenge'
                  ? selectedChallenge.recommendedDifficulty
                  : `${selectedArea.shortTitle} ${selectedStage.stageNumber} / 6`}
              </span>
              <span
                className={[
                  'stage-brief__region',
                  selectedStageIndex <= highestClearedStageIndex
                    ? 'is-completed'
                    : selectedStageIndex <= maxUnlockedStageIndex
                      ? 'is-unlocked'
                      : 'is-locked',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {stageSelectMode === 'challenge'
                  ? '挑战模式'
                  : selectedStageIndex <= highestClearedStageIndex
                  ? '已通关'
                  : selectedStageIndex <= maxUnlockedStageIndex
                    ? selectedArea.title
                    : '尚未解锁'}
              </span>
            </div>
            <h2>{stageSelectMode === 'challenge' ? selectedChallenge.title : selectedStage.title}</h2>
            {stageSelectMode === 'campaign' ? (
              <>
                <p className="stage-brief__subtitle stage-brief__subtitle--clamp">
                  {selectedStage.subtitle}
                </p>
                <p className="stage-brief__area-summary stage-brief__area-summary--clamp">
                  {selectedArea.description}
                </p>
              </>
            ) : null}

            {stageSelectMode === 'challenge' ? (
              <div className="stage-brief__section">
                <span className="stage-brief__kicker">可选职业</span>
                <div className="stage-brief__focus-list">
                  {selectedChallenge.allowedClasses.map((className) => (
                    <span key={className} className="stage-brief__focus">
                      {className}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="stage-brief__info-list">
              {stageBriefRows.map((entry) => (
                <div key={entry.id} className="stage-brief__info-row">
                  <StageInfoIcon iconId={entry.iconId} title={entry.title} />
                  <span className="stage-brief__row-copy">
                    <strong>{entry.title}</strong>
                    <span>{entry.description}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="stage-brief__action-stack">
              <button
                type="button"
                className="stage-brief__legend-button"
                onClick={() => setBuildInfoModal('legend')}
              >
                <span className="stage-brief__detail-icon stage-brief__detail-icon--rule">{'\u56fe'}</span>
                <span className="stage-brief__detail-copy">
                  <strong>{'\u672c\u5173\u56fe\u4f8b'}</strong>
                  <span>{'\u67e5\u770b\u8bcd\u7f00\u3001\u89c4\u5219\u4e0e\u72b6\u6001\u8bf4\u660e'}</span>
                </span>
              </button>
              {selectedBuildRule ? (
                <button
                  type="button"
                  className="stage-brief__legend-button stage-brief__build-menu-button"
                  data-tutorial-id="stage-build-menu"
                  onClick={() => setBuildInfoModal('build')}
                >
                  <span className="stage-brief__detail-icon stage-brief__detail-icon--rule">{'\u6784'}</span>
                  <span className="stage-brief__detail-copy">
                    <strong>{'\u672c\u5173\u6784\u7b51'}</strong>
                    <span>
                      {hasBuildConflict
                        ? `${buildWarningMessages.length} \u9879\u9700\u8981\u8c03\u6574`
                        : '\u67e5\u770b\u5f53\u524d\u6280\u80fd\u3001\u5929\u8d4b\u4e0e\u89c4\u5219'}
                    </span>
                  </span>
                </button>
              ) : null}
            </div>

            {activeBuildModal ? (
              <div className="stage-brief__modal-backdrop" role="presentation" onClick={() => setBuildInfoModal('none')}>
                <section
                  className="stage-brief__modal"
                  role="dialog"
                  aria-modal="false"
                  aria-label={activeBuildModal.title}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="stage-brief__modal-header">
                    <h3>{activeBuildModal.title}</h3>
                    <button
                      type="button"
                      className="stage-brief__modal-close"
                      aria-label="关闭构筑详情"
                  onClick={() => setBuildInfoModal('none')}
                    >
                      X
                    </button>
                  </div>

                  <div className="stage-brief__modal-body">
                    {'sections' in activeBuildModal ? (
                      <div className="stage-brief__modal-sections">
                        {activeBuildModal.sections.map((section) => (
                          <div key={section.label} className="stage-brief__modal-row">
                            <span>{section.label}</span>
                            <strong>{section.value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="stage-brief__modal-list">
                        {activeBuildModal.items.map((item, index) => (
                          <p key={`${index}-${item}`} className="stage-brief__modal-warning">
                            {item}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {isBuildMenuOpen ? (
              <div className="stage-brief__modal-backdrop" role="presentation" onClick={() => setBuildInfoModal('none')}>
                <section
                  className="stage-brief__modal stage-brief__modal--build"
                  role="dialog"
                  aria-modal="false"
                  aria-label="本关构筑"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="stage-brief__modal-header">
                    <h3>{'\u672c\u5173\u6784\u7b51'}</h3>
                    <button
                      type="button"
                      className="stage-brief__modal-close"
                      aria-label="关闭本关构筑"
                      onClick={() => setBuildInfoModal('none')}
                    >
                      X
                    </button>
                  </div>

                  <div className="stage-brief__modal-body">
                    <div className="stage-brief__build-menu">
                      <span className="stage-brief__kicker">{'\u5f53\u524d\u6784\u7b51'}</span>
                      <div className="stage-brief__focus-list">
                        {activePreviewSkills.map((entry) => (
                          <span key={`skill-${entry}`} className="stage-brief__focus">
                            {entry}
                          </span>
                        ))}
                        {passivePreviewTalents.map((entry) => (
                          <span key={`talent-${entry}`} className="stage-brief__focus">
                            {entry}
                          </span>
                        ))}
                      </div>
                      <div className="stage-brief__build-actions">
                        <button
                          type="button"
                          className="stage-brief__detail-button stage-brief__skill-config-button"
                          data-tutorial-id="stage-skill-config-button"
                          onClick={() => {
          setBuildInfoModal('none')
          setOpenBuildPanel('skills')
                          }}
                        >
                          <span className="stage-brief__detail-icon stage-brief__detail-icon--rule">{'\u6280'}</span>
                          <span className="stage-brief__detail-copy">
                            <strong>{'\u6280\u80fd\u914d\u7f6e'}</strong>
                            <span>{'\u8c03\u6574\u8fdb\u5165\u672c\u5173\u524d\u7684\u4e3b\u52a8\u6280\u80fd'}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="stage-brief__detail-button stage-brief__passive-config-button"
                          data-tutorial-id="stage-passive-config-button"
                          onClick={() => {
                            setBuildInfoModal('none')
                            setOpenBuildPanel('passives')
                          }}
                        >
                          <span className="stage-brief__detail-icon stage-brief__detail-icon--rule">{'\u5929'}</span>
                          <span className="stage-brief__detail-copy">
                            <strong>{'\u88ab\u52a8\u5929\u8d4b'}</strong>
                            <span>{'\u8c03\u6574\u8fdb\u5165\u672c\u5173\u524d\u7684\u88ab\u52a8\u6784\u7b51'}</span>
                          </span>
                        </button>
                      </div>
                      <div className="stage-brief__build-actions">
                        <button
                          type="button"
                          className="stage-brief__detail-button"
                          onClick={() => setBuildInfoModal('rule')}
                        >
                          <span className="stage-brief__detail-icon stage-brief__detail-icon--rule">{'\u6784'}</span>
                          <span className="stage-brief__detail-copy">
                            <strong>{'\u6784\u7b51\u89c4\u5219'}</strong>
                            <span>{'\u67e5\u770b\u672c\u5173\u6784\u7b51\u9650\u5236\u4e0e\u5f00\u653e\u5185\u5bb9'}</span>
                          </span>
                        </button>

                        {hasBuildConflict ? (
                          <button
                            type="button"
                            className="stage-brief__detail-button is-warning"
                            onClick={() => setBuildInfoModal('conflict')}
                          >
                            <span className="stage-brief__detail-icon stage-brief__detail-icon--warning">!</span>
                            <span className="stage-brief__detail-copy">
                              <strong>{'\u5f53\u524d\u6784\u7b51\u51b2\u7a81'}</strong>
                              <span>{buildWarningMessages.length} {'\u9879\u9700\u8981\u8c03\u6574'}</span>
                            </span>
                          </button>
                        ) : (
                          <p className="stage-brief__build-hint">{'\u5f53\u524d\u6784\u7b51\u53ef\u76f4\u63a5\u8fdb\u5165\u672c\u5173\u3002'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {isLegendModalOpen ? (
              <div className="stage-brief__modal-backdrop" role="presentation" onClick={() => setBuildInfoModal('none')}>
                <section
                  className="stage-brief__modal stage-brief__modal--legend"
                  role="dialog"
                  aria-modal="false"
                  aria-label="本关图例"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="stage-brief__modal-header">
                    <h3>{'\u672c\u5173\u56fe\u4f8b'}</h3>
                    <button
                      type="button"
                      className="stage-brief__modal-close"
                      aria-label="关闭图例"
                      onClick={() => setBuildInfoModal('none')}
                    >
                      X
                    </button>
                  </div>

                  <div className="stage-brief__modal-body">
                    <div className="stage-brief__legend-list">
                      {stageLegendRows.map((entry) => (
                        <div key={entry.id} className="stage-brief__legend-row">
                          <StageInfoIcon iconId={entry.iconId} title={entry.title} />
                          <span className="stage-brief__row-copy">
                            <strong>{entry.title}</strong>
                            {entry.meta ? <em>{entry.meta}</em> : null}
                            <span>{entry.description}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </aside>
        </section>
      </div>

      <SkillConfigPanel
        isOpen={effectiveOpenBuildPanel === 'skills'}
        loadout={skillLoadout}
        selectedHotkey={selectedConfigHotkey}
        buildRule={selectedBuildRule}
        activeSkills={activeSkills}
        totalPoints={totalBuildPoints}
        activePoints={activePoints}
        passivePoints={passivePoints}
        remainingPoints={remainingBuildPoints}
        onClose={closeBuildPanel}
        onSelectHotkey={setSelectedConfigHotkey}
        onAssignSkill={handleAssignSkill}
        onClearHotkey={handleClearHotkey}
        canAssignToSelectedHotkey={(skillId) =>
          selectedConfigHotkey && effectiveClassId
            ? canAssignSkillToHotkey(
                selectedBuildRuleId,
                effectiveClassId,
                skillLoadout,
                selectedConfigHotkey,
                skillId,
                remainingBuildPoints,
                unlockedActiveSkillIds,
              )
            : false
        }
      />

      <PassiveTalentPanel
        isOpen={effectiveOpenBuildPanel === 'passives'}
        buildRule={selectedBuildRule}
        talents={passiveTalents}
        selectedPassiveTalentIds={selectedPassiveTalentIds}
        totalPoints={totalBuildPoints}
        activePoints={activePoints}
        passivePoints={passivePoints}
        remainingPoints={remainingBuildPoints}
        onClose={closeBuildPanel}
        onToggleTalent={handleTogglePassive}
        canToggleTalent={(talentId) =>
          Boolean(effectiveClassId) &&
          canUseTalentInRule(selectedBuildRuleId, effectiveClassId!, talentId, unlockedPassiveTalentTier) &&
          canTogglePassiveTalent(selectedBuildRuleId, talentId, selectedPassiveTalentIds, activePoints)
        }
      />

      <TutorialOverlay step={tutorialStep} onNext={advanceTutorial} onSkip={skipTutorial} />
      <MonsterCodexPanel
        isOpen={isMonsterCodexOpen}
        entries={monsterCodexEntries}
        onClose={() => setIsMonsterCodexOpen(false)}
      />
    </main>
  )
}
