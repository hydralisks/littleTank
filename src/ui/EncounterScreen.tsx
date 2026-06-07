import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
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
  SkillHotkey,
  SkillId,
  SkillLoadout,
} from '../game/encounter/encounterTypes'
import {
  getEncounterScreenKeyboardSkills,
  handleEncounterScreenKeyDown,
  type EncounterScreenPanel,
} from './encounterScreenKeyboard'
import { EnemyRaidFrameList } from './EnemyRaidFrameList'
import { EncounterResultStatsPanel } from './EncounterResultStatsPanel'
import { PassiveTalentPanel } from './PassiveTalentPanel'
import { PlayerStatusPanel } from './PlayerStatusPanel'
import { SkillBar, type SkillBarSlotView } from './SkillBar'
import { SkillConfigPanel } from './SkillConfigPanel'
import { StageStatusPanel } from './StageStatusPanel'
import { TeamStatusPanel } from './TeamStatusPanel'
import { TutorialOverlay } from './TutorialOverlay'
import { getEncounterTutorialScript } from './tutorialGuide'

interface EncounterScreenProps {
  stage: StageInfo
  buildState: PersistedBuildState
  unlockedPassiveTalentTier: number
  unlockedActiveSkillIds: readonly SkillId[]
  tutorialEnabled?: boolean
  onTutorialComplete?: () => void
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
  loadout: SkillLoadout,
  hotkey: SkillHotkey,
  skillId: SkillId,
  remainingBuildPoints: number,
  unlockedActiveSkillIds: readonly SkillId[],
) {
  if (!isHotkeyEnabledForRule(buildRuleId, hotkey) || !canUseSkillInRule(buildRuleId, skillId, unlockedActiveSkillIds)) {
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

export function EncounterScreen({
  stage,
  buildState,
  unlockedPassiveTalentTier,
  unlockedActiveSkillIds,
  tutorialEnabled = true,
  onTutorialComplete,
  onBuildChange,
  onReturnToStageSelect,
  onRetryStage,
}: EncounterScreenProps) {
  const [encounter, setEncounter] = useState<EncounterState>(() => createInitialEncounterState(stage, buildState))
  const [openPanel, setOpenPanel] = useState<EncounterScreenPanel>(null)
  const [selectedConfigHotkey, setSelectedConfigHotkey] = useState<SkillHotkey | null>('1')
  const skillLoadout = buildState.loadout
  const selectedPassiveTalentIds = buildState.passiveTalentIds
  const tutorialScript = getEncounterTutorialScript(stage) ?? []
  const [tutorialStepIndex, setTutorialStepIndex] = useState(() => (tutorialEnabled && tutorialScript.length > 0 ? 0 : -1))
  const buildRuleId = encounter.stage.buildRuleId
  const buildRule = getBuildRuleDefinition(buildRuleId)
  const activeSkills = getActiveSkillCatalog()
    .filter((skill) => canUseSkillInRule(buildRuleId, skill.id, unlockedActiveSkillIds))
    .sort((left, right) => (left.uiOrder ?? 999) - (right.uiOrder ?? 999) || left.id.localeCompare(right.id))
  const passiveTalents = getPassiveTalentCatalog().filter((talent) =>
    canUseTalentInRule(buildRuleId, talent.id, unlockedPassiveTalentTier)
  )
  const pauseVisible = encounter.runtime.pauseOverlay === 'pause' && !encounter.result
  const tutorialStep =
    tutorialStepIndex >= 0 && tutorialStepIndex < tutorialScript.length
      ? tutorialScript[tutorialStepIndex]
      : null
  const tutorialVisible = Boolean(tutorialStep)
  const tutorialVisibleRef = useRef(tutorialVisible)

  useEffect(() => {
    tutorialVisibleRef.current = tutorialVisible
  }, [tutorialVisible])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setEncounter((current) => {
        if (tutorialVisibleRef.current) {
          return current
        }

        return tickEncounter(flushEncounterCommands(current), TICK_INTERVAL_MS)
      })
    }, TICK_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  const tryActivateSkill = useCallback((skillId: SkillId) => {
    setEncounter((current) =>
      dispatchEncounterCommand(current, {
        type: 'player/activate-skill',
        submittedAtMs: current.timeMs,
        skillId,
      }),
    )
  }, [])

  const openPauseMenu = useCallback(() => {
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

  const buildLocked = encounter.result === null
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
    onBuildChange({ loadout: nextLoadout, passiveTalentIds: nextPassiveTalentIds })
    setEncounter((current) => applyBuildConfiguration(current, nextLoadout, nextPassiveTalentIds))
  }

  function handleAssignSkill(skillId: SkillId) {
    if (!selectedConfigHotkey) {
      return
    }

    if (
      !canAssignSkillToHotkey(
        buildRuleId,
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
    if (!canUseTalentInRule(buildRuleId, talentId, unlockedPassiveTalentTier)) {
      return
    }
    if (!canTogglePassiveTalent(buildRuleId, talentId, selectedPassiveTalentIds, activePoints)) {
      return
    }

    const nextPassiveTalentIds = getNextPassiveTalentIdsForToggle(talentId, selectedPassiveTalentIds)

    commitBuild(skillLoadout, nextPassiveTalentIds)
  }

  function advanceTutorial() {
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
    onTutorialComplete?.()
    tutorialVisibleRef.current = false
    setTutorialStepIndex(-1)
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
                className="header-pause-button"
                onClick={openPauseMenu}
                disabled={Boolean(encounter.result)}
              >
                我说停停
              </button>
            </div>
          </div>

          <div className="header-action-row">
            <button
              type="button"
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
              onSelectEnemy={(enemyId) =>
                setEncounter((current) =>
                  dispatchEncounterCommand(current, {
                    type: 'player/select-target',
                    submittedAtMs: current.timeMs,
                    targetEnemyId: enemyId,
                  }),
                )
              }
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
            combatLocked={Boolean(encounter.result)}
            onActivateSkill={tryActivateSkill}
          />
        </section>

        {pauseVisible ? (
          <div className="result-overlay result-overlay--pause">
            <button
              type="button"
              className="result-action result-action--secondary"
              onClick={() => onReturnToStageSelect(encounter.result?.outcome)}
            >
              <span className="result-action__title">算他厉害</span>
            </button>
            <button
              type="button"
              className="result-action result-action--primary"
              onClick={onRetryStage}
            >
              <span className="result-action__title">我不信了</span>
            </button>
            <button
              type="button"
              className="result-action result-action--pause"
              onClick={closePauseMenu}
            >
              <span className="result-action__title">继续继续</span>
            </button>
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
              onReturnToStageSelect={() => onReturnToStageSelect('victory')}
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
          canUseTalentInRule(buildRuleId, talentId, unlockedPassiveTalentTier) &&
          canTogglePassiveTalent(buildRuleId, talentId, selectedPassiveTalentIds, activePoints)
        }
      />

      <StageStatusPanel isOpen={openPanel === 'stage'} stage={stage} encounter={encounter} onClose={() => setOpenPanel(null)} />
    </main>
  )
}
