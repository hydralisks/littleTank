import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import type { StageInfo } from '../game/data/stageTemplates'
import {
  ACTIVE_SKILL_POINT_COST,
  SKILL_HOTKEYS,
  canUseSkillInRule,
  canUseTalentInRule,
  getActiveSkillCatalog,
  getActivePointCost,
  getBuildRuleDefinition,
  getNextPassiveTalentIdsForToggle,
  getPassiveTalentCatalog,
  getPassivePointCost,
  getTotalBuildPoints,
  isHotkeyEnabledForRule,
} from '../game/data/skillTemplates'
import { buildEncounterStats } from '../game/encounter/combatStats'
import {
  applyBuildConfiguration,
  closePauseOverlay,
  createInitialEncounterState,
  getEncounterResultChatter,
  getEncounterWarning,
  openPauseOverlay,
  tickEncounter,
} from '../game/encounter/encounterFactory'
import {
  dispatchEncounterCommand,
  flushEncounterCommands,
} from '../game/encounter/encounterCommandSystem'
import type {
  EncounterState,
  PassiveTalentId,
  PersistedBuildState,
  PlayerClassId,
  SkillHotkey,
  SkillId,
  SkillLoadout,
} from '../game/encounter/encounterTypes'
import {
  getEncounterScreenKeyboardSkills,
  handleEncounterScreenKeyDown,
  type EncounterScreenPanel,
} from './encounterScreenKeyboard'
import {
  getInitialEncounterPhase,
  type EncounterEntrySource,
  type EncounterPhase,
} from './encounterPreparation'
import { EnemyRaidFrameList } from './EnemyRaidFrameList'
import { EncounterResultStatsPanel } from './EncounterResultStatsPanel'
import { PassiveTalentPanel } from './PassiveTalentPanel'
import { PlayerStatusPanel } from './PlayerStatusPanel'
import { SkillBar, type SkillBarSlotView } from './SkillBar'
import { SkillConfigPanel } from './SkillConfigPanel'
import { StageStatusPanel } from './StageStatusPanel'
import { TeamStatusPanel } from './TeamStatusPanel'
import { TutorialOverlay } from './TutorialOverlay'
import {
  getEncounterTutorialScript,
  getIconGrammarTutorialScript,
  getPreparationTutorialScript,
} from './tutorialGuide'

interface EncounterScreenProps {
  stage: StageInfo
  classId: PlayerClassId
  buildState: PersistedBuildState
  entrySource?: EncounterEntrySource
  unlockedPassiveTalentTier: number
  unlockedActiveSkillIds: readonly SkillId[]
  tutorialEnabled?: boolean
  preparationTutorialEnabled?: boolean
  iconGrammarTutorialEnabled?: boolean
  onTutorialComplete?: () => void
  onPreparationTutorialComplete?: () => void
  onIconGrammarTutorialComplete?: () => void
  onBuildChange: (build: PersistedBuildState) => void
  onReturnToStageSelect: (outcome?: 'victory' | 'defeat') => void
  onRetryStage: () => void
  onAdvanceStage: () => void
}

const TICK_INTERVAL_MS = 100

function formatEncounterTime(timeMs: number) {
  return `${(timeMs / 1000).toFixed(1)}s`
}

function buildSkillSlots(skills: EncounterState['skills']): SkillBarSlotView[] {
  const skillMap = new Map(skills.map((skill) => [skill.hotkey, skill]))
  return SKILL_HOTKEYS.map((hotkey) => ({
    hotkey,
    skill: skillMap.get(hotkey) ?? null,
  }))
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

function EncounterNavigationControls({
  className = '',
  startDisabled,
  continueDisabled,
  onReturn,
  onStart,
  onContinue,
}: {
  className?: string
  startDisabled: boolean
  continueDisabled: boolean
  onReturn: () => void
  onStart: () => void
  onContinue: () => void
}) {
  return (
    <div className={['encounter-noncombat-controls', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="encounter-noncombat-action encounter-noncombat-action--secondary"
        data-encounter-action="return"
        onClick={onReturn}
      >
        返回
      </button>
      <button
        type="button"
        className="encounter-noncombat-action encounter-noncombat-action--primary"
        data-encounter-action="start"
        data-tutorial-id="encounter-start-battle"
        onClick={onStart}
        disabled={startDisabled}
      >
        开战
      </button>
      <button
        type="button"
        className="encounter-noncombat-action encounter-noncombat-action--continue"
        data-encounter-action="continue"
        onClick={onContinue}
        disabled={continueDisabled}
      >
        继续
      </button>
    </div>
  )
}

export function EncounterScreen({
  stage,
  classId,
  buildState,
  entrySource = 'retry',
  unlockedPassiveTalentTier,
  unlockedActiveSkillIds,
  tutorialEnabled = true,
  preparationTutorialEnabled = false,
  iconGrammarTutorialEnabled = false,
  onTutorialComplete,
  onPreparationTutorialComplete,
  onIconGrammarTutorialComplete,
  onBuildChange,
  onReturnToStageSelect,
  onRetryStage,
  onAdvanceStage,
}: EncounterScreenProps) {
  const [encounter, setEncounter] = useState<EncounterState>(() => createInitialEncounterState(stage, classId, buildState))
  const initialPhase = getInitialEncounterPhase(entrySource)
  const [phase, setPhase] = useState<EncounterPhase>(initialPhase)
  const phaseRef = useRef<EncounterPhase>(initialPhase)
  const latestBuildRef = useRef(buildState)
  const [openPanel, setOpenPanel] = useState<EncounterScreenPanel>(null)
  const [selectedConfigHotkey, setSelectedConfigHotkey] = useState<SkillHotkey | null>('1')
  const skillLoadout = buildState.loadout
  const selectedPassiveTalentIds = buildState.passiveTalentIds
  const tutorialScript = getEncounterTutorialScript(stage) ?? []
  const preparationTutorialScript = getPreparationTutorialScript()
  const iconGrammarTutorialScript = getIconGrammarTutorialScript(classId)
  const iconGrammarMarksSeenRef = useRef(iconGrammarTutorialEnabled)
  const [iconGrammarTutorialStepIndex, setIconGrammarTutorialStepIndex] = useState(() => (
    iconGrammarTutorialEnabled ? 0 : -1
  ))
  const [preparationTutorialStepIndex, setPreparationTutorialStepIndex] = useState(() => (
    initialPhase === 'preparation' && preparationTutorialEnabled ? 0 : -1
  ))
  const [tutorialStepIndex, setTutorialStepIndex] = useState(() => (
    initialPhase === 'active' && tutorialEnabled && tutorialScript.length > 0 ? 0 : -1
  ))
  const buildRuleId = encounter.stage.buildRuleId
  const buildRule = getBuildRuleDefinition(buildRuleId)
  const activeSkills = getActiveSkillCatalog()
    .filter((skill) => canUseSkillInRule(buildRuleId, classId, skill.id, unlockedActiveSkillIds))
    .sort((left, right) => (left.uiOrder ?? 999) - (right.uiOrder ?? 999) || left.id.localeCompare(right.id))
  const passiveTalents = getPassiveTalentCatalog().filter((talent) =>
    canUseTalentInRule(buildRuleId, classId, talent.id, unlockedPassiveTalentTier)
  )
  const pauseVisible = encounter.runtime.pauseOverlay === 'pause' && !encounter.result
  const encounterTutorialStep =
    tutorialStepIndex >= 0 && tutorialStepIndex < tutorialScript.length
      ? tutorialScript[tutorialStepIndex]
      : null
  const preparationTutorialStep =
    preparationTutorialStepIndex >= 0 && preparationTutorialStepIndex < preparationTutorialScript.length
      ? preparationTutorialScript[preparationTutorialStepIndex]
      : null
  const iconGrammarTutorialStep =
    iconGrammarTutorialStepIndex >= 0 && iconGrammarTutorialStepIndex < iconGrammarTutorialScript.length
      ? iconGrammarTutorialScript[iconGrammarTutorialStepIndex]
      : null
  const tutorialStep = iconGrammarTutorialStep
    ?? (phase === 'preparation' ? preparationTutorialStep : encounterTutorialStep)
  const tutorialVisible = Boolean(tutorialStep)
  const tutorialVisibleRef = useRef(tutorialVisible)

  useEffect(() => {
    tutorialVisibleRef.current = tutorialVisible
  }, [tutorialVisible])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setEncounter((current) => {
        if (phaseRef.current !== 'active' || tutorialVisibleRef.current) {
          return current
        }

        return tickEncounter(flushEncounterCommands(current), TICK_INTERVAL_MS)
      })
    }, TICK_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  const tryActivateSkill = useCallback((skillId: SkillId) => {
    if (phaseRef.current !== 'active') {
      return
    }
    setEncounter((current) =>
      dispatchEncounterCommand(current, {
        type: 'player/activate-skill',
        submittedAtMs: current.timeMs,
        skillId,
      }),
    )
  }, [])

  const openPauseMenu = useCallback(() => {
    if (phaseRef.current !== 'active') {
      return
    }
    setEncounter((current) => openPauseOverlay(current))
  }, [])

  const closePauseMenu = useCallback(() => {
    setEncounter((current) => closePauseOverlay(current))
  }, [])

  const handleWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
    handleEncounterScreenKeyDown({
      event,
      openPanel,
      pauseVisible: pauseVisible || tutorialVisible,
      combatLocked: phase === 'preparation',
      skills: getEncounterScreenKeyboardSkills(encounter.skills),
      onClosePanel: () => {
        setOpenPanel(null)
      },
      onOpenPause: openPauseMenu,
      onClosePause: closePauseMenu,
      onCycleTarget: (direction) => {
        setEncounter((current) => {
          const livingEnemies = current.enemies.filter((enemy) => enemy.hp > 0)

          if (livingEnemies.length === 0) {
            return current
          }

          const currentIndex = livingEnemies.findIndex((enemy) => enemy.id === current.player.currentTargetId)
          const nextIndex =
            currentIndex < 0 ? 0 : (currentIndex + direction + livingEnemies.length) % livingEnemies.length

          return dispatchEncounterCommand(current, {
            type: 'player/select-target',
            submittedAtMs: current.timeMs,
            targetEnemyId: livingEnemies[nextIndex].id,
          })
        })
      },
      onActivateSkill: tryActivateSkill,
    })
  })

  useEffect(() => {
    window.addEventListener('keydown', handleWindowKeyDown)

    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [])

  const buildLocked = phase === 'active' && encounter.result === null
  const activeEnemyCount = encounter.enemies.filter((enemy) => enemy.hp > 0).length
  const activePoints = getActivePointCost(skillLoadout)
  const passivePoints = getPassivePointCost(selectedPassiveTalentIds)
  const totalBuildPoints = getTotalBuildPoints(buildRuleId, selectedPassiveTalentIds)
  const remainingBuildPoints = totalBuildPoints - activePoints - passivePoints
  const skillSlots = buildSkillSlots(encounter.skills)
  const resultLabel =
    encounter.result?.outcome === 'victory'
      ? '胜利'
      : encounter.result?.outcome === 'defeat'
        ? '失败'
        : '战斗中'
  const encounterStats = buildEncounterStats(encounter)

  function commitBuild(nextLoadout: SkillLoadout, nextPassiveTalentIds: PassiveTalentId[]) {
    const nextBuild = { loadout: nextLoadout, passiveTalentIds: nextPassiveTalentIds }
    latestBuildRef.current = nextBuild
    onBuildChange(nextBuild)
    setEncounter((current) => applyBuildConfiguration(current, nextLoadout, nextPassiveTalentIds))
  }

  function startBattle() {
    if (tutorialStep) {
      return
    }

    setEncounter((current) => {
      const selectedTargetId = current.player.currentTargetId
      const next = createInitialEncounterState(stage, classId, latestBuildRef.current)
      const selectedTargetIsAvailable = next.enemies.some((enemy) => enemy.id === selectedTargetId && enemy.hp > 0)
      return selectedTargetIsAvailable
        ? {
            ...next,
            player: {
              ...next.player,
              currentTargetId: selectedTargetId,
            },
          }
        : next
    })
    phaseRef.current = 'active'
    setPhase('active')
    const hasEncounterTutorial = tutorialEnabled && tutorialScript.length > 0
    tutorialVisibleRef.current = hasEncounterTutorial
    setTutorialStepIndex(hasEncounterTutorial ? 0 : -1)
  }

  function selectEnemy(enemyId: string) {
    setEncounter((current) => {
      if (phaseRef.current === 'preparation') {
        return {
          ...current,
          player: {
            ...current.player,
            currentTargetId: enemyId,
          },
        }
      }

      return dispatchEncounterCommand(current, {
        type: 'player/select-target',
        submittedAtMs: current.timeMs,
        targetEnemyId: enemyId,
      })
    })
  }

  function handleAssignSkill(skillId: SkillId) {
    if (!selectedConfigHotkey) {
      return
    }

    if (
      !canAssignSkillToHotkey(
        buildRuleId,
        classId,
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
    if (!canUseTalentInRule(buildRuleId, classId, talentId, unlockedPassiveTalentTier)) {
      return
    }
    if (!canTogglePassiveTalent(buildRuleId, talentId, selectedPassiveTalentIds, activePoints)) {
      return
    }

    const nextPassiveTalentIds = getNextPassiveTalentIdsForToggle(talentId, selectedPassiveTalentIds)

    commitBuild(skillLoadout, nextPassiveTalentIds)
  }

  function advanceTutorial() {
    if (iconGrammarTutorialStep) {
      setIconGrammarTutorialStepIndex((current) => {
        const next = current + 1
        const hasNextStep = next < iconGrammarTutorialScript.length
        if (!hasNextStep && iconGrammarMarksSeenRef.current) {
          onIconGrammarTutorialComplete?.()
          iconGrammarMarksSeenRef.current = false
        }
        tutorialVisibleRef.current = hasNextStep
          || Boolean(phaseRef.current === 'preparation' ? preparationTutorialStep : encounterTutorialStep)
        return hasNextStep ? next : -1
      })
      return
    }

    if (phaseRef.current === 'preparation') {
      setPreparationTutorialStepIndex((current) => {
        const next = current + 1
        const hasNextStep = next < preparationTutorialScript.length
        if (!hasNextStep) {
          onPreparationTutorialComplete?.()
        }
        tutorialVisibleRef.current = hasNextStep
        return hasNextStep ? next : -1
      })
      return
    }

    setTutorialStepIndex((current) => {
      const next = current + 1
      const hasNextStep = next < tutorialScript.length
      if (!hasNextStep) {
        onTutorialComplete?.()
      }
      tutorialVisibleRef.current = hasNextStep
      return hasNextStep ? next : -1
    })
  }

  function skipTutorial() {
    if (iconGrammarTutorialStep) {
      if (iconGrammarMarksSeenRef.current) {
        onIconGrammarTutorialComplete?.()
        iconGrammarMarksSeenRef.current = false
      }
      tutorialVisibleRef.current = Boolean(
        phaseRef.current === 'preparation' ? preparationTutorialStep : encounterTutorialStep,
      )
      setIconGrammarTutorialStepIndex(-1)
      return
    }

    if (phaseRef.current === 'preparation') {
      onPreparationTutorialComplete?.()
      tutorialVisibleRef.current = false
      setPreparationTutorialStepIndex(-1)
      return
    }

    onTutorialComplete?.()
    tutorialVisibleRef.current = false
    setTutorialStepIndex(-1)
  }

  function replayIconGrammarTutorial() {
    setOpenPanel(null)
    iconGrammarMarksSeenRef.current = false
    tutorialVisibleRef.current = true
    setIconGrammarTutorialStepIndex(0)
  }

  return (
    <main className="encounter-shell">
      <div className="encounter-stage">
        <section className="encounter-header">
          <div className="encounter-header__title">
            <p className="eyebrow">Little Tank 原型</p>
            <div className="encounter-header__title-row">
              <h1>{stage.title}</h1>
              <button
                type="button"
                className="icon-grammar-help-button"
                onClick={replayIconGrammarTutorial}
                aria-label="图标说明"
                title="图标说明"
              >
                <CircleHelp aria-hidden="true" />
              </button>
              <button
                type="button"
                className="header-pause-button"
                onClick={openPauseMenu}
                disabled={phase === 'preparation' || Boolean(encounter.result)}
              >
                我说停停
              </button>
            </div>
          </div>

          <div className="header-action-row">
            <button
              type="button"
              data-tutorial-id="encounter-skill-config"
              className={['header-action-button', buildLocked ? 'is-blocked' : ''].filter(Boolean).join(' ')}
              onClick={() => {
                if (!buildLocked) {
                  setOpenPanel('skills')
                }
              }}
              disabled={buildLocked}
            >
              技能配置
            </button>
            <button
              type="button"
              data-tutorial-id="encounter-passive-config"
              className={['header-action-button', buildLocked ? 'is-blocked' : ''].filter(Boolean).join(' ')}
              onClick={() => {
                if (!buildLocked) {
                  setOpenPanel('passives')
                }
              }}
              disabled={buildLocked}
            >
              被动天赋
            </button>
            <button type="button" className="header-action-button" onClick={() => setOpenPanel('stage')}>
              本场状态
            </button>
          </div>

          <div className="header-chip-row">
            <span className={`header-chip header-chip--status ${encounter.result ? `is-${encounter.result.outcome}` : ''}`}>
              <span className="header-chip__label">状态</span>
              <span className="header-chip__value header-chip__value--status">{resultLabel}</span>
            </span>
            <span className="header-chip header-chip--time">
              <span className="header-chip__label">时间</span>
              <span className="header-chip__value header-chip__value--time">{formatEncounterTime(encounter.timeMs)}</span>
            </span>
            <span className="header-chip header-chip--count">
              <span className="header-chip__label">目标</span>
              <span className="header-chip__value header-chip__value--count">{activeEnemyCount}</span>
            </span>
            <span className="header-chip header-chip--points">
              <span className="header-chip__label">点数</span>
              <span className="header-chip__value header-chip__value--points">{remainingBuildPoints}</span>
            </span>
            <span className="header-chip header-chip--hint">
              <span className="header-chip__label">操作</span>
              <span className="header-chip__value header-chip__value--hint">Tab</span>
            </span>
          </div>
        </section>

        <section className="encounter-board">
          <div className="encounter-top-row">
            <EnemyRaidFrameList
              enemies={encounter.enemies}
              selectedEnemyId={encounter.player.currentTargetId}
              onSelectEnemy={selectEnemy}
            />

            <TeamStatusPanel
              party={encounter.party}
              warning={encounter.runtime.lastRejectedCommandMessage ?? getEncounterWarning(encounter)}
              result={encounter.result}
              resultChatter={getEncounterResultChatter(encounter)}
            />
          </div>

          <PlayerStatusPanel player={encounter.player} />

          <SkillBar
            slots={skillSlots}
            currentResource={encounter.player.resource}
            gcdRemainingMs={encounter.player.gcdRemainingMs}
            combatLocked={phase === 'preparation' || Boolean(encounter.result)}
            onActivateSkill={tryActivateSkill}
          />
        </section>

        {phase === 'preparation' ? (
          <EncounterNavigationControls
            className="encounter-preparation-controls"
            startDisabled={Boolean(tutorialStep)}
            continueDisabled
            onReturn={() => onReturnToStageSelect()}
            onStart={startBattle}
            onContinue={() => undefined}
          />
        ) : null}

        {pauseVisible ? (
          <div className="result-overlay result-overlay--pause">
            <EncounterNavigationControls
              startDisabled
              continueDisabled={false}
              onReturn={() => onReturnToStageSelect()}
              onStart={() => undefined}
              onContinue={closePauseMenu}
            />
          </div>
        ) : null}

        {encounter.result ? (
          <div className="result-overlay">
            <EncounterResultStatsPanel
              outcome={encounter.result.outcome}
              stageTitle={stage.title}
              reason={encounter.result.reason}
              stats={encounterStats}
              onRetryStage={onRetryStage}
            />
            <EncounterNavigationControls
              startDisabled
              continueDisabled={encounter.result.outcome !== 'victory'}
              onReturn={() => onReturnToStageSelect(encounter.result?.outcome)}
              onStart={() => undefined}
              onContinue={onAdvanceStage}
            />
          </div>
        ) : null}

        <TutorialOverlay step={tutorialStep} onNext={advanceTutorial} onSkip={skipTutorial} />
      </div>

      <SkillConfigPanel
        isOpen={openPanel === 'skills'}
        loadout={skillLoadout}
        selectedHotkey={selectedConfigHotkey}
        buildRule={buildRule}
        activeSkills={activeSkills}
        totalPoints={totalBuildPoints}
        activePoints={activePoints}
        passivePoints={passivePoints}
        remainingPoints={remainingBuildPoints}
        onClose={() => setOpenPanel(null)}
        onSelectHotkey={setSelectedConfigHotkey}
        onAssignSkill={handleAssignSkill}
        onClearHotkey={handleClearHotkey}
        canAssignToSelectedHotkey={(skillId) =>
          selectedConfigHotkey
            ? canAssignSkillToHotkey(
                buildRuleId,
                classId,
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
        isOpen={openPanel === 'passives'}
        buildRule={buildRule}
        talents={passiveTalents}
        selectedPassiveTalentIds={selectedPassiveTalentIds}
        totalPoints={totalBuildPoints}
        activePoints={activePoints}
        passivePoints={passivePoints}
        remainingPoints={remainingBuildPoints}
        onClose={() => setOpenPanel(null)}
        onToggleTalent={handleTogglePassive}
        canToggleTalent={(talentId) =>
          canUseTalentInRule(buildRuleId, classId, talentId, unlockedPassiveTalentTier) &&
          canTogglePassiveTalent(buildRuleId, talentId, selectedPassiveTalentIds, activePoints)
        }
      />

      <StageStatusPanel isOpen={openPanel === 'stage'} stage={stage} encounter={encounter} onClose={() => setOpenPanel(null)} />
    </main>
  )
}
