import { getActiveSkillDefinition } from '../data/playerBuildCatalog'
import { getEnemySkillDefinition } from '../data/enemyCatalog'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import { getRemainingBuildPoints } from '../data/playerBuildCatalog'
import type { StageInfo } from '../data/stageTemplates'
import {
  activateSkill,
  createInitialEncounterState,
  getSkillActivationBlockReason,
  selectEnemy,
  tickEncounter,
} from '../encounter/encounterFactory'
import type {
  CombatLogEvent,
  EncounterState,
  EnemyState,
  PersistedBuildState,
  SkillId,
  SkillState,
} from '../encounter/encounterTypes'
import {
  classifyDifficultyFromPassRates,
  type BalanceProfileTier,
  type BalanceScenarioResult,
  type DifficultyRating,
} from './difficultyScoring'
import { generateStageBalanceBuilds, getBuildSignature } from './balanceBuildGenerator'
import {
  estimateEnemyCycleThreat,
  estimateEnemySkillImpact,
} from './staticTacticalAdvice'
import { buildEncounterStats } from '../encounter/combatStats'
import { buildCombatDiagnostics } from '../encounter/combatDiagnostics'
import {
  createDiagnosticScenarioSummary,
  type DiagnosticAttemptSample,
  type DiagnosticScenarioSummary,
} from './diagnosticScenarioSummary'

export interface BalanceOperationProfile {
  id: string
  tier: BalanceProfileTier
  reactionDelayMs: number
  reactionDelayJitterMs?: number
  reactionDelayFastChance?: number
  reactionDelayFastMs?: number
  mistakeRate: number
  forgetSkillRate?: number
  wrongTargetRate?: number
  prioritySlipRate?: number
  decisionIntervalMs: number
  endCastStopWindowMs?: number
  preserveKeyStopSkills?: boolean
  evaluateEnemySkillImpact?: boolean
  preferControlForChanneling?: boolean
  targetPriorityMode?: 'threat_first' | 'kill_high_impact' | 'mechanic_focus'
  irregularThreatPolicy?: 'strict' | 'periodic' | 'allow_leak_when_tank_pressure_high'
  mechanicChainPlan?: 'none' | 'wax_party_then_hoe_party' | 'wax_tank_then_hoe_tank'
  minimumTargetStickMs?: number
  preemptiveDefenseHorizonMs?: number
}

export interface BalanceBuildVariant {
  id: string
  build: PersistedBuildState
}

export type BalanceScoringMode = 'best_build_per_profile'

export interface BestBuildProfileSummary {
  profileId: string
  profileTier: BalanceProfileTier
  buildId: string
  attempts: number
  victories: number
  passRate: number
  loadout: PersistedBuildState['loadout']
  passiveTalentIds: PersistedBuildState['passiveTalentIds']
}

export interface BalanceSharedStrategyScenarioResult {
  strategyId: string
  passRate: number
}

export interface BalanceTraceEvent {
  timeMs: number
  type: 'target-selected' | 'skill-activated' | 'result'
  message: string
}

export interface BalanceAttemptTrace {
  attemptIndex: number
  events: BalanceTraceEvent[]
}

export interface BalanceScenarioDataEstimate {
  attempts: number
  averageDurationSec: number
  playerResourcePerSec: number
  tankDamageTakenPerSec: number
  healingAndAbsorbPerSec: number
  playerSideDamagePerSec: number
  partyPressurePerSec: number
}

export interface TraceableBalanceScenarioResult extends BalanceScenarioResult {
  trace?: BalanceAttemptTrace
  combatLogTrace?: CombatLogEvent[]
  dataEstimate?: BalanceScenarioDataEstimate
  diagnosticSummary?: DiagnosticScenarioSummary
}

export interface RunBalanceScenarioOptions {
  stage: StageInfo
  build: PersistedBuildState
  buildId: string
  profile: BalanceOperationProfile
  attempts: number
  maxDurationMs: number
  tickMs?: number
  initialStateMutator?: (state: EncounterState) => EncounterState
  collectTrace?: boolean
  collectDiagnostics?: boolean
}

export interface StageBalanceAnalysis {
  stageId: string
  scenarios: TraceableBalanceScenarioResult[]
  rating: DifficultyRating
  scoringMode: BalanceScoringMode
  bestBuildsByProfile: BestBuildProfileSummary[]
  analyzedBuilds?: BalanceBuildVariant[]
  buildSearchMode?: 'single_phase' | 'two_phase'
  phaseOneBuildCount?: number
  finalBuildCount?: number
}

export interface RunStageBalanceAnalysisOptions {
  stage: StageInfo
  builds: BalanceBuildVariant[]
  profiles: BalanceOperationProfile[]
  attemptsPerScenario: number
  maxDurationMs: number
  tickMs?: number
  initialStateMutator?: (state: EncounterState) => EncounterState
  collectTrace?: boolean
  collectDiagnostics?: boolean
}

export interface RunTwoPhaseStageBalanceAnalysisOptions extends Omit<RunStageBalanceAnalysisOptions, 'builds'> {
  phaseOneAttemptsPerScenario: number
  phaseOneMaxActiveBuilds?: number
  phaseOneMaxPassiveVariants?: number
  finalBuildCount?: number
  extraBuildCandidates?: BalanceBuildVariant[]
}

export interface BalanceDecisionPriorityOptions {
  profile: BalanceOperationProfile
  castReason: 'generic' | 'dangerous' | 'critical-channeling' | 'high-impact'
  skillMode: 'none' | 'interrupt' | 'control'
  isCoreSkill: boolean
  isChannelingSecondPhase: boolean
}

export interface BalanceTargetPriorityOptions {
  state: EncounterState
  enemy: EnemyState
  profile: BalanceOperationProfile
  lastIrregularMaintainedAtMs?: number
}

const DEFAULT_TICK_MS = 100

type BalanceMistakeKind = 'forget_skill' | 'wrong_target' | 'priority_slip'

interface PlannedCastReaction {
  castKey: string
  enemyId: string
  readyAtMs: number
  mistake: BalanceMistakeKind | null
}

interface BalanceAutomationMemory {
  plannedCastReactions: Map<string, PlannedCastReaction>
  selectedTargetId: string | null
  selectedTargetAtMs: number
  irregularMaintainedAtMs: Map<string, number>
  lockedTargetTickAtMs: number
}

interface BalanceDataEstimateTotals {
  attempts: number
  totalDurationSec: number
  totalResourceGain: number
  totalTankDamageTaken: number
  totalHealingAndAbsorb: number
  totalPlayerSideDamage: number
  totalPartyPressure: number
}

interface BalanceResourceGainCursor {
  lastStateTimeMs: number
  countedEventKeys: Set<string>
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function sumStatRows(rows: readonly { total: number }[]) {
  return rows.reduce((sum, row) => sum + row.total, 0)
}

function createResourceGainCursor(state: EncounterState): BalanceResourceGainCursor {
  return {
    lastStateTimeMs: state.timeMs,
    countedEventKeys: new Set(),
  }
}

function estimatePositiveResourceGain(
  previousState: EncounterState,
  nextState: EncounterState,
  cursor: BalanceResourceGainCursor,
) {
  const eventGain = nextState.runtime.lastProcessedEvents.reduce((sum, event) => {
    if (
      event.type !== 'player/resource-changed' ||
      event.amount <= 0 ||
      event.occurredAtMs < cursor.lastStateTimeMs
    ) {
      return sum
    }
    const eventKey = `${event.occurredAtMs}:${event.type}:${event.amount}:${event.reason}:${event.sourceSkillId ?? ''}`
    if (cursor.countedEventKeys.has(eventKey)) {
      return sum
    }
    cursor.countedEventKeys.add(eventKey)
    return sum + event.amount
  }, 0)
  const netResourceGain = Math.max(0, nextState.player.resource - previousState.player.resource)

  cursor.lastStateTimeMs = nextState.timeMs
  return Math.max(eventGain, netResourceGain)
}

function createDataEstimateTotals(): BalanceDataEstimateTotals {
  return {
    attempts: 0,
    totalDurationSec: 0,
    totalResourceGain: 0,
    totalTankDamageTaken: 0,
    totalHealingAndAbsorb: 0,
    totalPlayerSideDamage: 0,
    totalPartyPressure: 0,
  }
}

function addDataEstimateSample(
  totals: BalanceDataEstimateTotals,
  state: EncounterState,
  resourceGain: number,
) {
  const stats = buildEncounterStats(state)
  const durationSec = Math.max(0.001, stats.durationMs / 1000)

  totals.attempts += 1
  totals.totalDurationSec += durationSec
  totals.totalResourceGain += resourceGain
  totals.totalTankDamageTaken += sumStatRows(stats.tankDamageTaken)
  totals.totalHealingAndAbsorb += sumStatRows(stats.healingAndAbsorb)
  totals.totalPlayerSideDamage += sumStatRows(stats.damageDealt)
  totals.totalPartyPressure += sumStatRows(stats.pressureGained)
}

function finalizeDataEstimate(totals: BalanceDataEstimateTotals): BalanceScenarioDataEstimate {
  const durationSec = Math.max(0.001, totals.totalDurationSec)

  return {
    attempts: totals.attempts,
    averageDurationSec: totals.attempts > 0 ? totals.totalDurationSec / totals.attempts : 0,
    playerResourcePerSec: totals.totalResourceGain / durationSec,
    tankDamageTakenPerSec: totals.totalTankDamageTaken / durationSec,
    healingAndAbsorbPerSec: totals.totalHealingAndAbsorb / durationSec,
    playerSideDamagePerSec: totals.totalPlayerSideDamage / durationSec,
    partyPressurePerSec: totals.totalPartyPressure / durationSec,
  }
}

function createBalanceAutomationMemory(): BalanceAutomationMemory {
  return {
    plannedCastReactions: new Map(),
    selectedTargetId: null,
    selectedTargetAtMs: 0,
    irregularMaintainedAtMs: new Map(),
    lockedTargetTickAtMs: -1,
  }
}

export function sampleProfileReactionDelayMs(
  profile: BalanceOperationProfile,
  random: () => number,
) {
  const fastChance = clamp01(profile.reactionDelayFastChance ?? 0)
  if (fastChance > 0 && random() < fastChance) {
    return Math.max(0, profile.reactionDelayFastMs ?? profile.reactionDelayMs)
  }

  const jitter = Math.max(0, profile.reactionDelayJitterMs ?? 0)
  if (jitter <= 0) {
    return Math.max(0, profile.reactionDelayMs)
  }

  return Math.max(0, Math.round(profile.reactionDelayMs + (random() * 2 - 1) * jitter))
}

export function sampleProfileMistakeKind(
  profile: BalanceOperationProfile,
  random: () => number,
): BalanceMistakeKind | null {
  const forgetSkillRate = clamp01(profile.forgetSkillRate ?? 0)
  const wrongTargetRate = clamp01(profile.wrongTargetRate ?? 0)
  const prioritySlipRate = clamp01(profile.prioritySlipRate ?? 0)
  const configuredSpecificRate = forgetSkillRate + wrongTargetRate + prioritySlipRate
  const roll = random()

  if (configuredSpecificRate <= 0) {
    return roll < clamp01(profile.mistakeRate) ? 'forget_skill' : null
  }

  if (roll < forgetSkillRate) {
    return 'forget_skill'
  }
  if (roll < forgetSkillRate + wrongTargetRate) {
    return 'wrong_target'
  }
  if (roll < forgetSkillRate + wrongTargetRate + prioritySlipRate) {
    return 'priority_slip'
  }

  return null
}

export function getBalanceDecisionPriority(options: BalanceDecisionPriorityOptions) {
  const castReasonPriority =
    options.castReason === 'critical-channeling'
      ? 360
      : options.castReason === 'high-impact'
        ? 280
        : options.castReason === 'dangerous'
          ? 180
          : 0
  const coreSkillPriority = options.isCoreSkill ? 160 : 0
  const channelControlPriority =
    options.isChannelingSecondPhase && options.skillMode === 'control'
      ? 160
      : options.isChannelingSecondPhase && options.skillMode === 'interrupt'
        ? 80
        : 0
  const stopSkillPriority = options.skillMode === 'interrupt' || options.skillMode === 'control' ? 60 : 0

  return castReasonPriority + coreSkillPriority + channelControlPriority + stopSkillPriority
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSeededRandom(seedText: string) {
  let seed = hashSeed(seedText) || 1
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223
    return (seed >>> 0) / 0x100000000
  }
}

function isLivingEnemy(enemy: EnemyState) {
  return enemy.hp > 0
}

function getLivingEnemies(state: EncounterState) {
  return state.enemies.filter(isLivingEnemy)
}

function getCurrentTarget(state: EncounterState) {
  return state.enemies.find((enemy) => enemy.id === state.player.currentTargetId && isLivingEnemy(enemy)) ?? null
}

function getSkillDefinition(skill: SkillState) {
  return getActiveSkillDefinition(skill.id)
}

function canActivate(state: EncounterState, skillId: SkillId) {
  return getSkillActivationBlockReason(state, skillId) === null
}

function sortSkillsForGenericUse(skills: SkillState[]) {
  return [...skills].sort((left, right) => {
    const leftDefinition = getSkillDefinition(left)
    const rightDefinition = getSkillDefinition(right)
    const leftOrder = leftDefinition?.uiOrder ?? 999
    const rightOrder = rightDefinition?.uiOrder ?? 999
    return leftOrder - rightOrder || left.id.localeCompare(right.id)
  })
}

function getCastDangerRank(enemy: EnemyState) {
  if (!enemy.cast) {
    return 0
  }

  if (enemy.cast.dangerLevel === 'high') {
    return 3
  }

  if (enemy.cast.dangerLevel === 'medium') {
    return 2
  }

  return 1
}

function profileUsesStrongCastPlanning(profile: BalanceOperationProfile) {
  return profile.preserveKeyStopSkills ?? true
}

function profileEvaluatesEnemySkillImpact(profile: BalanceOperationProfile) {
  return profile.evaluateEnemySkillImpact ?? true
}

function profilePrefersControlForChanneling(profile: BalanceOperationProfile) {
  return profile.preferControlForChanneling ?? true
}

function isChannelingSecondPhase(enemy: EnemyState) {
  return enemy.cast?.phase === 'channeling'
}

function getEnemyCastImpactScore(enemy: EnemyState) {
  const castId = enemy.cast?.id
  if (!castId) {
    return 0
  }
  const skillDefinition = getEnemySkillDefinition(castId)
  if (!skillDefinition) {
    return 0
  }
  return estimateEnemySkillImpact(castId) + (isChannelingSecondPhase(enemy) ? 20 : 0)
}

function getEnemySkillCycleImpactScore(enemy: EnemyState) {
  return estimateEnemyCycleThreat(enemy)
}

function getIncomingPlayerDamageScore(state: EncounterState, horizonMs: number) {
  return getLivingEnemies(state).reduce((score, enemy) => {
    if (!enemy.cast || enemy.cast.remainingMs > horizonMs) {
      return score
    }

    const skillDefinition = getEnemySkillDefinition(enemy.cast.id)
    if (!skillDefinition) {
      return score
    }

    return score +
      skillDefinition.playerDamage +
      Math.max(skillDefinition.partyDamageOnHit, skillDefinition.partyDamageOnMiss) * 0.25 +
      Math.max(skillDefinition.pressureOnHit, skillDefinition.pressureOnMiss) * 0.12
  }, 0)
}

function getThreatStatePriority(enemy: EnemyState, profile: BalanceOperationProfile) {
  const mode = profile.targetPriorityMode ?? 'threat_first'
  if (enemy.threatState === 'lost') {
    return mode === 'threat_first' ? 220 : 120
  }
  if (enemy.threatState === 'warning') {
    return mode === 'threat_first' ? 90 : 45
  }
  return 0
}

function playerHasStatusEffect(state: EncounterState, effectLogicId: string) {
  return state.player.debuffs.some((status) => status.effectLogicId === effectLogicId && status.remainingMs !== 0)
}

function partyHasStatusEffect(state: EncounterState, effectLogicId: string) {
  return state.party.statuses.some((status) => status.effectLogicId === effectLogicId && status.remainingMs !== 0)
}

function getNextEnemySkillId(enemy: EnemyState) {
  if (enemy.cast) {
    return enemy.cast.id
  }
  if (enemy.pendingRetryCastSkillId) {
    return enemy.pendingRetryCastSkillId
  }
  if (enemy.skillCycle.length === 0) {
    return enemy.skillIds[0] ?? null
  }

  return enemy.skillCycle[enemy.skillCycleIndex] ?? enemy.skillCycle[0] ?? enemy.skillIds[0] ?? null
}

export function getBalanceMechanicThreatPreference(
  state: EncounterState,
  enemy: EnemyState,
  profile?: Pick<BalanceOperationProfile, 'mechanicChainPlan'>,
): EnemyState['target'] | null {
  const skillId = getNextEnemySkillId(enemy)
  if (skillId === 'shadow_hoa') {
    const playerWaxed = playerHasStatusEffect(state, 'waxed_status')
    const partyWaxed = partyHasStatusEffect(state, 'waxed_p_status')

    if (partyWaxed && !playerWaxed) {
      return 'ally'
    }
    if (playerWaxed && !partyWaxed) {
      return 'tank'
    }
  }

  if (skillId === 'wax_figure') {
    if (profile?.mechanicChainPlan === 'wax_party_then_hoe_party') {
      return 'ally'
    }
    if (profile?.mechanicChainPlan === 'wax_tank_then_hoe_tank') {
      return 'tank'
    }

    const playerHpRatio = state.player.maxHp > 0 ? state.player.hp / state.player.maxHp : 1
    const incomingDanger = getIncomingPlayerDamageScore(state, 3000)
    return playerHpRatio <= 0.45 || incomingDanger >= 18 ? 'ally' : 'tank'
  }

  return null
}

function getMechanicThreatPriority(state: EncounterState, enemy: EnemyState, profile: BalanceOperationProfile) {
  if ((profile.targetPriorityMode ?? 'threat_first') !== 'mechanic_focus') {
    return 0
  }

  const preference = getBalanceMechanicThreatPreference(state, enemy, profile)
  if (!preference) {
    return 0
  }

  if (preference === 'ally') {
    return enemy.target === 'ally' ? -80 : -180
  }

  return enemy.target === 'tank' ? 65 : 220
}

function getEnemyKillPriority(enemy: EnemyState, profile: BalanceOperationProfile) {
  const mode = profile.targetPriorityMode ?? 'threat_first'
  if (mode === 'threat_first') {
    return 0
  }

  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
  const currentCastRisk =
    getCastDangerRank(enemy) * 45 +
    (profileEvaluatesEnemySkillImpact(profile) ? getEnemyCastImpactScore(enemy) : 0)
  const cycleRisk = profileEvaluatesEnemySkillImpact(profile) ? getEnemySkillCycleImpactScore(enemy) * 1.4 : 0
  const finisherRisk = hpRatio <= 0.35 ? (1 - hpRatio) * 110 : 0
  const mechanicFocusRisk =
    mode === 'mechanic_focus' &&
    (enemy.threatLogic === 'irregular' ||
      enemy.skillCycle.some((skillId) => /wax|hoe|shadow|figure|mend|heal/i.test(skillId)))
      ? 55
      : 0

  return currentCastRisk + cycleRisk + finisherRisk + mechanicFocusRisk
}

function getIrregularThreatPriority({
  state,
  enemy,
  profile,
  lastIrregularMaintainedAtMs,
}: BalanceTargetPriorityOptions) {
  if (enemy.threatLogic !== 'irregular') {
    return 0
  }

  const policy = profile.irregularThreatPolicy ?? 'periodic'
  if (policy === 'allow_leak_when_tank_pressure_high') {
    const tankHpRatio = state.player.maxHp > 0 ? state.player.hp / state.player.maxHp : 1
    const incomingDanger = getIncomingPlayerDamageScore(state, profile.preemptiveDefenseHorizonMs ?? 2500)
    if (tankHpRatio <= 0.4 || incomingDanger >= 18) {
      return enemy.threatState === 'lost' ? -90 : -35
    }
  }

  if (policy === 'strict') {
    return enemy.threatState === 'lost' ? 110 : 35
  }

  const elapsed = state.timeMs - (lastIrregularMaintainedAtMs ?? Number.NEGATIVE_INFINITY)
  if (enemy.threatState === 'lost' && elapsed >= 7000) {
    return 95
  }
  if (elapsed >= 11_000) {
    return 45
  }

  return 0
}

export function getBalanceTargetPriorityScore(options: BalanceTargetPriorityOptions) {
  const { enemy, profile } = options
  if (!isLivingEnemy(enemy)) {
    return Number.NEGATIVE_INFINITY
  }

  const rowPriority = Math.max(0, 8 - enemy.row * 2 - enemy.col)
  return (
    getThreatStatePriority(enemy, profile) +
    getEnemyKillPriority(enemy, profile) +
    getIrregularThreatPriority(options) +
    getMechanicThreatPriority(options.state, enemy, profile) +
    rowPriority
  )
}

function getCoreCastImpactThreshold() {
  return 30
}

function isCoreCast(enemy: EnemyState) {
  return (
    getCastDangerRank(enemy) >= 3 ||
    isChannelingSecondPhase(enemy) ||
    getEnemyCastImpactScore(enemy) >= getCoreCastImpactThreshold()
  )
}

function getCastReason(
  enemy: EnemyState,
  profile: BalanceOperationProfile,
): BalanceDecisionPriorityOptions['castReason'] {
  if (isChannelingSecondPhase(enemy)) {
    return 'critical-channeling'
  }
  if (profileEvaluatesEnemySkillImpact(profile) && getEnemyCastImpactScore(enemy) >= getCoreCastImpactThreshold()) {
    return 'high-impact'
  }
  if (getCastDangerRank(enemy) >= 2) {
    return 'dangerous'
  }
  return 'generic'
}

function getPreferredStopModeForCast(
  enemy: EnemyState,
  profile: BalanceOperationProfile,
): BalanceDecisionPriorityOptions['skillMode'] {
  if (!enemy.cast || enemy.cast.breakRule === 'unstoppable') {
    return 'none'
  }
  if (enemy.cast.breakRule === 'controlOnly') {
    return 'control'
  }
  if (profilePrefersControlForChanneling(profile) && isChannelingSecondPhase(enemy)) {
    return 'control'
  }
  return 'interrupt'
}

function getCastPlanningScore(enemy: EnemyState, profile: BalanceOperationProfile) {
  return getBalanceDecisionPriority({
    profile,
    castReason: getCastReason(enemy, profile),
    skillMode: getPreferredStopModeForCast(enemy, profile),
    isCoreSkill: isCoreCast(enemy),
    isChannelingSecondPhase: isChannelingSecondPhase(enemy),
  }) + (profileEvaluatesEnemySkillImpact(profile) ? getEnemyCastImpactScore(enemy) : 0)
}

function getEndCastStopWindowMs(enemy: EnemyState, profile: BalanceOperationProfile) {
  if (!enemy.cast) {
    return 0
  }
  if (typeof profile.endCastStopWindowMs === 'number') {
    return Math.max(0, profile.endCastStopWindowMs)
  }
  if (profile.tier === 'expert') {
    return Math.min(650, Math.max(350, Math.round(enemy.cast.totalMs * 0.28)))
  }
  if (profile.tier === 'skilled') {
    return Math.min(800, Math.max(450, Math.round(enemy.cast.totalMs * 0.35)))
  }
  return enemy.cast.totalMs
}

function shouldPlanReactionForCast(enemy: EnemyState) {
  if (!enemy.cast || enemy.cast.breakRule === 'unstoppable') {
    return false
  }

  return getCastDangerRank(enemy) >= 2 || isCoreCast(enemy)
}

function getCastStartMs(state: EncounterState, enemy: EnemyState) {
  if (!enemy.cast) {
    return state.timeMs
  }

  return state.timeMs - (enemy.cast.totalMs - enemy.cast.remainingMs)
}

function getCastKey(state: EncounterState, enemy: EnemyState) {
  if (!enemy.cast) {
    return null
  }

  return [
    enemy.id,
    enemy.cast.id,
    enemy.cast.phase ?? 'casting',
    getCastStartMs(state, enemy),
  ].join(':')
}

function getPlannedReactionReadyAtMs(
  state: EncounterState,
  enemy: EnemyState,
  profile: BalanceOperationProfile,
  reactionDelayMs: number,
) {
  if (!enemy.cast || isChannelingSecondPhase(enemy) || !profileUsesStrongCastPlanning(profile)) {
    return state.timeMs + reactionDelayMs
  }

  const castStartMs = getCastStartMs(state, enemy)
  const preferredWindowStartMs = castStartMs + Math.max(0, enemy.cast.totalMs - getEndCastStopWindowMs(enemy, profile))
  return Math.max(state.timeMs + reactionDelayMs, preferredWindowStartMs)
}

function syncPlannedCastReactions(state: EncounterState, memory: BalanceAutomationMemory) {
  const activeCastKeys = new Set(
    getLivingEnemies(state).flatMap((enemy) => {
      const key = getCastKey(state, enemy)
      const cast = enemy.cast
      return key && cast && cast.remainingMs > 0 ? [key] : []
    }),
  )

  for (const key of memory.plannedCastReactions.keys()) {
    if (!activeCastKeys.has(key)) {
      memory.plannedCastReactions.delete(key)
    }
  }
}

function planCastReactions(
  state: EncounterState,
  profile: BalanceOperationProfile,
  random: () => number,
  memory: BalanceAutomationMemory,
) {
  syncPlannedCastReactions(state, memory)

  const candidates = getLivingEnemies(state)
    .filter(shouldPlanReactionForCast)
    .sort((left, right) => {
      const planningDelta = getCastPlanningScore(right, profile) - getCastPlanningScore(left, profile)
      if (planningDelta !== 0) {
        return planningDelta
      }

      return (left.cast?.remainingMs ?? 0) - (right.cast?.remainingMs ?? 0)
    })

  for (const enemy of candidates) {
    const key = getCastKey(state, enemy)
    if (!key || memory.plannedCastReactions.has(key)) {
      continue
    }
    if (getUsableStopSkillIdsForCast(state, enemy, profile).length === 0) {
      continue
    }

    const reactionDelayMs = sampleProfileReactionDelayMs(profile, random)
    memory.plannedCastReactions.set(key, {
      castKey: key,
      enemyId: enemy.id,
      readyAtMs: getPlannedReactionReadyAtMs(state, enemy, profile, reactionDelayMs),
      mistake: sampleProfileMistakeKind(profile, random),
    })
  }
}

function getDuePlannedCastReactions(state: EncounterState, profile: BalanceOperationProfile, memory: BalanceAutomationMemory) {
  syncPlannedCastReactions(state, memory)

  return [...memory.plannedCastReactions.values()]
    .filter((reaction) => reaction.readyAtMs <= state.timeMs)
    .flatMap((reaction) => {
      const enemy = state.enemies.find((entry) => entry.id === reaction.enemyId)
      if (!enemy || getCastKey(state, enemy) !== reaction.castKey) {
        memory.plannedCastReactions.delete(reaction.castKey)
        return []
      }

      return [{ reaction, enemy }]
    })
    .sort((left, right) => {
      const planningDelta = getCastPlanningScore(right.enemy, profile) - getCastPlanningScore(left.enemy, profile)
      if (planningDelta !== 0) {
        return planningDelta
      }

      return left.reaction.readyAtMs - right.reaction.readyAtMs
    })
}

function executePlannedCastReaction(
  state: EncounterState,
  profile: BalanceOperationProfile,
  random: () => number,
  memory: BalanceAutomationMemory,
  traceEvents?: BalanceTraceEvent[],
) {
  planCastReactions(state, profile, random, memory)
  const dueReactions = getDuePlannedCastReactions(state, profile, memory)
  if (dueReactions.length === 0) {
    return state
  }

  const { reaction, enemy } = dueReactions[0]
  if (reaction.mistake === 'forget_skill') {
    memory.plannedCastReactions.delete(reaction.castKey)
    return state
  }

  const target = reaction.mistake === 'wrong_target'
    ? getWrongTarget(state, enemy.id, random) ?? enemy
    : enemy
  if (reaction.mistake !== 'wrong_target' && getUsableStopSkillIdsForCast(state, enemy, profile).length === 0) {
    return state
  }
  const nextState = maybeSelectEnemy(state, target, traceEvents)
  rememberSelectedTarget(memory, state, target.id)

  if (reaction.mistake === 'priority_slip') {
    const slippedState = tryUseFirstMatchingSkill(nextState, [
      'revenge',
      'shield_slam',
      'thunder',
      'avatar',
      'demoralizing',
    ], traceEvents)
    if (slippedState !== nextState) {
      memory.plannedCastReactions.delete(reaction.castKey)
      return slippedState
    }
  }

  for (const skillId of getUsableStopSkillIdsForCast(nextState, enemy, profile)) {
    if (canActivate(nextState, skillId)) {
      traceEvents?.push({
        timeMs: nextState.timeMs,
        type: 'skill-activated',
        message: `activated ${skillId}`,
      })
      memory.plannedCastReactions.delete(reaction.castKey)
      return activateSkill(nextState, skillId)
    }
  }

  return nextState
}

function getStopSkillIdsForCast(
  state: EncounterState,
  enemy: EnemyState,
  profile: BalanceOperationProfile,
) {
  if (!enemy.cast) {
    return []
  }

  const legalModes = enemy.cast.breakRule === 'controlOnly'
    ? new Set(['control'])
    : enemy.cast.breakRule === 'interruptOrControl'
      ? new Set(['interrupt', 'control'])
      : new Set<string>()

  return sortSkillsForGenericUse(state.skills)
    .filter((skill) => {
      const definition = getSkillDefinition(skill)
      return definition && legalModes.has(definition.castStopMode)
    })
    .sort((left, right) => {
      const leftMode = getSkillDefinition(left)?.castStopMode
      const rightMode = getSkillDefinition(right)?.castStopMode
      const castReason = getCastReason(enemy, profile)
      const leftPriority = getBalanceDecisionPriority({
        profile,
        castReason,
        skillMode: leftMode ?? 'none',
        isCoreSkill: isCoreCast(enemy),
        isChannelingSecondPhase: isChannelingSecondPhase(enemy),
      })
      const rightPriority = getBalanceDecisionPriority({
        profile,
        castReason,
        skillMode: rightMode ?? 'none',
        isCoreSkill: isCoreCast(enemy),
        isChannelingSecondPhase: isChannelingSecondPhase(enemy),
      })
      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority
      }
      if (enemy.cast?.breakRule === 'interruptOrControl' && leftMode !== rightMode) {
        if (profilePrefersControlForChanneling(profile) && isChannelingSecondPhase(enemy)) {
          return leftMode === 'control' ? -1 : 1
        }
        return leftMode === 'interrupt' ? -1 : 1
      }
      return 0
    })
    .map((skill) => skill.id)
}

function canUseStopSkillOnEnemy(state: EncounterState, enemy: EnemyState, skillId: SkillId) {
  const targetState =
    state.player.currentTargetId === enemy.id
      ? state
      : {
          ...state,
          player: {
            ...state.player,
            currentTargetId: enemy.id,
          },
        }

  return canActivate(targetState, skillId)
}

function getUsableStopSkillIdsForCast(
  state: EncounterState,
  enemy: EnemyState,
  profile: BalanceOperationProfile,
) {
  return getStopSkillIdsForCast(state, enemy, profile)
    .filter((skillId) => canUseStopSkillOnEnemy(state, enemy, skillId))
}

function maybeSelectEnemy(
  state: EncounterState,
  enemy: EnemyState,
  traceEvents?: BalanceTraceEvent[],
) {
  if (state.player.currentTargetId === enemy.id) {
    return state
  }

  traceEvents?.push({
    timeMs: state.timeMs,
    type: 'target-selected',
    message: `selected ${enemy.id}`,
  })

  return selectEnemy(state, enemy.id)
}

function rememberSelectedTarget(memory: BalanceAutomationMemory, state: EncounterState, enemyId: string) {
  if (memory.selectedTargetId !== enemyId) {
    memory.selectedTargetId = enemyId
    memory.selectedTargetAtMs = state.timeMs
  }
}

function getWrongTarget(state: EncounterState, intendedEnemyId: string, random: () => number) {
  const candidates = getLivingEnemies(state).filter((enemy) => enemy.id !== intendedEnemyId)
  if (candidates.length === 0) {
    return null
  }

  return candidates[Math.floor(random() * candidates.length)] ?? candidates[0]
}

function skillHasTagOrName(skill: SkillState, values: readonly string[]) {
  const definition = getSkillDefinition(skill)
  const searchable = [
    skill.id,
    skill.name,
    skill.shortName,
    definition?.skillLogicId ?? '',
    ...(definition?.skillTags ?? []),
  ].join(' ').toLowerCase()

  return values.some((value) => searchable.includes(value))
}

function tryUseFirstMatchingSkill(
  state: EncounterState,
  values: readonly string[],
  traceEvents?: BalanceTraceEvent[],
) {
  for (const skill of sortSkillsForGenericUse(state.skills)) {
    if (skillHasTagOrName(skill, values) && canActivate(state, skill.id)) {
      traceEvents?.push({
        timeMs: state.timeMs,
        type: 'skill-activated',
        message: `activated ${skill.id}`,
      })
      return activateSkill(state, skill.id)
    }
  }

  return state
}

function getBestTacticalTarget(
  state: EncounterState,
  profile: BalanceOperationProfile,
  memory: BalanceAutomationMemory,
) {
  return [...getLivingEnemies(state)].sort((left, right) => {
    const leftScore = getBalanceTargetPriorityScore({
      state,
      enemy: left,
      profile,
      lastIrregularMaintainedAtMs: memory.irregularMaintainedAtMs.get(left.id),
    })
    const rightScore = getBalanceTargetPriorityScore({
      state,
      enemy: right,
      profile,
      lastIrregularMaintainedAtMs: memory.irregularMaintainedAtMs.get(right.id),
    })
    if (rightScore !== leftScore) {
      return rightScore - leftScore
    }
    return left.row - right.row || left.col - right.col
  })[0] ?? null
}

function improveTargeting(
  state: EncounterState,
  profile: BalanceOperationProfile,
  memory: BalanceAutomationMemory,
  traceEvents?: BalanceTraceEvent[],
) {
  const currentTarget = getCurrentTarget(state)
  const target = getBestTacticalTarget(state, profile, memory)
  if (!target) {
    return state
  }

  if (currentTarget) {
    const minimumStickMs = Math.max(0, profile.minimumTargetStickMs ?? 900)
    const currentScore = getBalanceTargetPriorityScore({
      state,
      enemy: currentTarget,
      profile,
      lastIrregularMaintainedAtMs: memory.irregularMaintainedAtMs.get(currentTarget.id),
    })
    const targetScore = getBalanceTargetPriorityScore({
      state,
      enemy: target,
      profile,
      lastIrregularMaintainedAtMs: memory.irregularMaintainedAtMs.get(target.id),
    })
    const targetStickElapsedMs =
      memory.selectedTargetId === currentTarget.id
        ? state.timeMs - memory.selectedTargetAtMs
        : Number.POSITIVE_INFINITY

    if (target.id === currentTarget.id || (targetStickElapsedMs < minimumStickMs && targetScore < currentScore + 95)) {
      rememberSelectedTarget(memory, state, currentTarget.id)
      return state
    }
  }

  const nextState = maybeSelectEnemy(state, target, traceEvents)
  rememberSelectedTarget(memory, state, target.id)
  if (target.threatLogic === 'irregular') {
    memory.irregularMaintainedAtMs.set(target.id, state.timeMs)
  }
  memory.lockedTargetTickAtMs = state.timeMs
  return nextState
}

function shouldRetargetForLostThreat(
  state: EncounterState,
  profile: BalanceOperationProfile,
  memory: BalanceAutomationMemory,
  lostThreatTarget: EnemyState,
) {
  if (memory.lockedTargetTickAtMs === state.timeMs) {
    return false
  }

  const bestTarget = getBestTacticalTarget(state, profile, memory)
  if (!bestTarget) {
    return false
  }

  if (bestTarget.id === lostThreatTarget.id) {
    return true
  }

  const bestScore = getBalanceTargetPriorityScore({
    state,
    enemy: bestTarget,
    profile,
    lastIrregularMaintainedAtMs: memory.irregularMaintainedAtMs.get(bestTarget.id),
  })
  const lostScore = getBalanceTargetPriorityScore({
    state,
    enemy: lostThreatTarget,
    profile,
    lastIrregularMaintainedAtMs: memory.irregularMaintainedAtMs.get(lostThreatTarget.id),
  })

  return lostScore >= bestScore - 80
}

function tryUseDefensiveSkill(
  state: EncounterState,
  profile: BalanceOperationProfile,
  random: () => number,
  traceEvents?: BalanceTraceEvent[],
) {
  const activeMitigationId = state.player.mitigation?.id ?? null
  const mistake = sampleProfileMistakeKind(profile, random)
  if (mistake === 'forget_skill') {
    return state
  }
  if (mistake === 'priority_slip') {
    const slippedState = tryUseFirstMatchingSkill(state, [
      'revenge',
      'shield_slam',
      'thunder',
      'avatar',
      'demoralizing',
    ], traceEvents)
    if (slippedState !== state) {
      return slippedState
    }
  }

  return tryUseFirstMatchingSkill(state, [
    'shield_wall',
    'shield_block',
    'ignore_pain',
    'rallying',
  ].filter((skillId) => !(skillId === 'shield_wall' && activeMitigationId === 'shieldWall')), traceEvents)
}

function runAutomatedDecision(
  state: EncounterState,
  profile: BalanceOperationProfile,
  random: () => number,
  memory: BalanceAutomationMemory,
  traceEvents?: BalanceTraceEvent[],
) {
  let nextState = improveTargeting(state, profile, memory, traceEvents)

  const defensiveThreshold =
    profileEvaluatesEnemySkillImpact(profile) && profileUsesStrongCastPlanning(profile)
      ? 0.72
      : 0.42
  const shouldUsePreemptiveDefense =
    profileEvaluatesEnemySkillImpact(profile) &&
    profileUsesStrongCastPlanning(profile) &&
    getIncomingPlayerDamageScore(nextState, 2500) >= 18
  if (nextState.player.hp / nextState.player.maxHp <= defensiveThreshold || shouldUsePreemptiveDefense) {
    const defensiveState = tryUseDefensiveSkill(nextState, profile, random, traceEvents)
    if (defensiveState !== nextState) {
      return defensiveState
    }
  }

  const lostThreatTarget = getLivingEnemies(nextState).find((enemy) => enemy.threatState === 'lost')
  if (lostThreatTarget) {
    if (
      profile.targetPriorityMode === 'mechanic_focus' &&
      getBalanceMechanicThreatPreference(nextState, lostThreatTarget, profile) === 'ally'
    ) {
      return nextState
    }

    if (!shouldRetargetForLostThreat(nextState, profile, memory, lostThreatTarget)) {
      return nextState
    }

    const mistake = sampleProfileMistakeKind(profile, random)
    if (mistake === 'forget_skill') {
      return nextState
    }

    const target = mistake === 'wrong_target'
      ? getWrongTarget(nextState, lostThreatTarget.id, random) ?? lostThreatTarget
      : lostThreatTarget
    nextState = maybeSelectEnemy(nextState, target, traceEvents)
    rememberSelectedTarget(memory, nextState, target.id)
    if (mistake === 'priority_slip') {
      const slippedState = tryUseFirstMatchingSkill(nextState, [
        'revenge',
        'shield_slam',
        'thunder',
        'avatar',
        'demoralizing',
      ], traceEvents)
      if (slippedState !== nextState) {
        return slippedState
      }
    }

    const tauntState = tryUseFirstMatchingSkill(nextState, ['taunt', 'mass_taunt'], traceEvents)
    if (tauntState !== nextState) {
      if (target.threatLogic === 'irregular') {
        memory.irregularMaintainedAtMs.set(target.id, nextState.timeMs)
      }
      memory.lockedTargetTickAtMs = nextState.timeMs
      return tauntState
    }
  }

  const mistake = sampleProfileMistakeKind(profile, random)
  if (mistake === 'forget_skill') {
    return nextState
  }
  if (mistake === 'wrong_target') {
    const target = getWrongTarget(nextState, nextState.player.currentTargetId ?? '', random)
    if (target) {
      nextState = maybeSelectEnemy(nextState, target, traceEvents)
      rememberSelectedTarget(memory, nextState, target.id)
    }
  }

  const skillState = tryUseFirstMatchingSkill(nextState, [
    'revenge',
    'shield_slam',
    'thunder',
    'avatar',
    'demoralizing',
  ], traceEvents)
  if (skillState !== nextState) {
    memory.lockedTargetTickAtMs = nextState.timeMs
  }
  return skillState
}

export function runBalanceScenario(options: RunBalanceScenarioOptions): TraceableBalanceScenarioResult {
  const attempts = Math.max(0, Math.floor(options.attempts))
  let victories = 0
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS
  let trace: BalanceAttemptTrace | undefined
  let combatLogTrace: CombatLogEvent[] | undefined
  const diagnosticSamples: DiagnosticAttemptSample[] = []
  const dataEstimateTotals = createDataEstimateTotals()

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    const random = createSeededRandom(`${options.stage.id}:${options.buildId}:${options.profile.id}:${attemptIndex}`)
    const shouldTraceAttempt = Boolean(options.collectTrace && !trace)
    const traceEvents: BalanceTraceEvent[] | undefined = shouldTraceAttempt ? [] : undefined
    let state = createInitialEncounterState(options.stage, options.build)
    state = options.initialStateMutator ? options.initialStateMutator(state) : state
    const memory = createBalanceAutomationMemory()
    const resourceGainCursor = createResourceGainCursor(state)
    let attemptResourceGain = 0

    let decisionElapsedMs = options.profile.decisionIntervalMs
    while (!state.result && state.timeMs < options.maxDurationMs) {
      let previousState = state
      state = executePlannedCastReaction(state, options.profile, random, memory, traceEvents)
      attemptResourceGain += estimatePositiveResourceGain(previousState, state, resourceGainCursor)
      if (state.result) {
        break
      }

      if (decisionElapsedMs >= options.profile.decisionIntervalMs) {
        previousState = state
        state = runAutomatedDecision(state, options.profile, random, memory, traceEvents)
        attemptResourceGain += estimatePositiveResourceGain(previousState, state, resourceGainCursor)
        decisionElapsedMs = 0
      }

      previousState = state
      state = tickEncounter(state, tickMs)
      attemptResourceGain += estimatePositiveResourceGain(previousState, state, resourceGainCursor)
      decisionElapsedMs += tickMs
    }

    if (state.result?.outcome === 'victory') {
      victories += 1
    }

    if (traceEvents) {
      traceEvents.push({
        timeMs: state.timeMs,
        type: 'result',
        message: state.result ? `${state.result.outcome}: ${state.result.reason}` : 'timeout',
      })
      trace = { attemptIndex, events: traceEvents }
      combatLogTrace = state.runtime.combatLog
    }

    if (options.collectDiagnostics) {
      diagnosticSamples.push({
        outcome: state.result?.outcome ?? 'timeout',
        durationMs: state.timeMs,
        diagnostics: buildCombatDiagnostics(buildEncounterStats(state)),
      })
    }

    addDataEstimateSample(dataEstimateTotals, state, attemptResourceGain)
  }

  return {
    stageId: options.stage.id,
    profileId: options.profile.id,
    profileTier: options.profile.tier,
    buildId: options.buildId,
    attempts,
    victories,
    passRate: attempts > 0 ? victories / attempts : 0,
    dataEstimate: finalizeDataEstimate(dataEstimateTotals),
    ...(trace ? { trace } : {}),
    ...(combatLogTrace ? { combatLogTrace } : {}),
    ...(options.collectDiagnostics
      ? { diagnosticSummary: createDiagnosticScenarioSummary(diagnosticSamples) }
      : {}),
  }
}

function getBestBuildsByProfile(
  scenarios: readonly BalanceScenarioResult[],
  builds: readonly BalanceBuildVariant[],
): BestBuildProfileSummary[] {
  const buildById = new Map(builds.map((variant) => [variant.id, variant.build] as const))
  const bestScenarioByProfile = new Map<string, BalanceScenarioResult>()

  for (const scenario of scenarios) {
    const existing = bestScenarioByProfile.get(scenario.profileId)
    if (
      !existing ||
      scenario.passRate > existing.passRate ||
      (scenario.passRate === existing.passRate && scenario.buildId.localeCompare(existing.buildId) < 0)
    ) {
      bestScenarioByProfile.set(scenario.profileId, scenario)
    }
  }

  return [...bestScenarioByProfile.values()]
    .sort((left, right) => left.profileId.localeCompare(right.profileId))
    .map((scenario) => {
      const build = buildById.get(scenario.buildId)
      if (!build) {
        throw new Error(`Missing build variant for buildId=${scenario.buildId}`)
      }

      return {
        profileId: scenario.profileId,
        profileTier: scenario.profileTier,
        buildId: scenario.buildId,
        attempts: scenario.attempts,
        victories: scenario.victories,
        passRate: scenario.passRate,
        loadout: { ...build.loadout },
        passiveTalentIds: [...build.passiveTalentIds],
      }
    })
}

function getBuildRemainingPoints(stage: StageInfo, builds: readonly BalanceBuildVariant[]) {
  const buildRuleId = getStageBuildRuleId(stage)
  return Object.fromEntries(
    builds.map((variant) => [
      variant.id,
      getRemainingBuildPoints(buildRuleId, variant.build.loadout, variant.build.passiveTalentIds),
    ]),
  )
}

export function runStageBalanceAnalysis(options: RunStageBalanceAnalysisOptions): StageBalanceAnalysis {
  const scenarios = options.builds.flatMap((buildVariant) =>
    options.profiles.map((profile) =>
      runBalanceScenario({
        stage: options.stage,
        build: buildVariant.build,
        buildId: buildVariant.id,
        profile,
        attempts: options.attemptsPerScenario,
        maxDurationMs: options.maxDurationMs,
        tickMs: options.tickMs,
        initialStateMutator: options.initialStateMutator,
        collectTrace: options.collectTrace,
        collectDiagnostics: options.collectDiagnostics,
      }),
    ),
  )

  return {
    stageId: options.stage.id,
    scenarios,
    rating: classifyDifficultyFromPassRates(scenarios, {
      buildRemainingPoints: getBuildRemainingPoints(options.stage, options.builds),
    }),
    scoringMode: 'best_build_per_profile',
    bestBuildsByProfile: getBestBuildsByProfile(scenarios, options.builds),
    analyzedBuilds: options.builds,
    buildSearchMode: 'single_phase',
  }
}

function getBuildSearchScore(result: BalanceScenarioResult) {
  return result.passRate
}

function getBuildCompletenessScore(build: PersistedBuildState) {
  const activeSkillCount = Object.values(build.loadout).filter(Boolean).length
  const passiveTalentCount = build.passiveTalentIds.length
  return activeSkillCount + passiveTalentCount * 0.25
}

export function selectTwoPhaseBalanceBuilds(
  phaseOneScenarios: readonly BalanceScenarioResult[],
  builds: readonly BalanceBuildVariant[],
  finalBuildCount: number,
) {
  const buildById = new Map(builds.map((variant) => [variant.id, variant] as const))
  const selectedIds = new Set<string>()
  const pushBuildId = (buildId: string) => {
    if (selectedIds.size >= finalBuildCount) {
      return
    }
    if (buildById.has(buildId)) {
      selectedIds.add(buildId)
    }
  }

  pushBuildId('default')

  const rankedBuilds = [...buildById.keys()]
    .map((buildId) => {
      const buildScenarios = phaseOneScenarios.filter((scenario) => scenario.buildId === buildId)
      const averagePassRate =
        buildScenarios.length > 0
          ? buildScenarios.reduce((sum, scenario) => sum + getBuildSearchScore(scenario), 0) / buildScenarios.length
          : 0
      const bestPassRate = buildScenarios.reduce((best, scenario) => Math.max(best, getBuildSearchScore(scenario)), 0)
      const completeness = getBuildCompletenessScore(buildById.get(buildId)?.build ?? {
        loadout: {
          '1': null,
          '2': null,
          '3': null,
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: [],
      })

      return { buildId, bestPassRate, averagePassRate, completeness }
    })
    .sort((left, right) =>
      right.averagePassRate - left.averagePassRate ||
      right.bestPassRate - left.bestPassRate ||
      right.completeness - left.completeness ||
      left.buildId.localeCompare(right.buildId),
    )

  for (const rankedBuild of rankedBuilds) {
    pushBuildId(rankedBuild.buildId)
  }

  return [...selectedIds].flatMap((buildId) => {
    const build = buildById.get(buildId)
    return build ? [build] : []
  })
}

export function selectTwoPhaseSharedStrategyIds(
  strategyScenarios: readonly BalanceSharedStrategyScenarioResult[],
  finalStrategyCount: number,
) {
  const grouped = new Map<string, number[]>()
  for (const scenario of strategyScenarios) {
    grouped.set(scenario.strategyId, [...(grouped.get(scenario.strategyId) ?? []), scenario.passRate])
  }

  return [...grouped.entries()]
    .map(([strategyId, passRates]) => ({
      strategyId,
      passRate: passRates.reduce((sum, rate) => sum + rate, 0) / passRates.length,
    }))
    .sort((left, right) => right.passRate - left.passRate || left.strategyId.localeCompare(right.strategyId))
    .slice(0, Math.max(0, Math.floor(finalStrategyCount)))
    .map((entry) => entry.strategyId)
}

export interface SelectLearningBuildCandidatesOptions {
  minBuildCount?: number
  maxBuildCount?: number
  gapThreshold?: number
}

export function selectLearningBuildCandidatesFromFixedAnalysis(
  fixedScenarios: readonly BalanceScenarioResult[],
  builds: readonly BalanceBuildVariant[],
  options: SelectLearningBuildCandidatesOptions = {},
) {
  const minBuildCount = Math.max(1, Math.floor(options.minBuildCount ?? 5))
  const maxBuildCount = Math.max(minBuildCount, Math.floor(options.maxBuildCount ?? 10))
  const gapThreshold = Math.max(0, options.gapThreshold ?? 0.07)
  const buildById = new Map(builds.map((variant) => [variant.id, variant] as const))

  const rankedBuilds = [...buildById.keys()]
    .map((buildId) => {
      const buildScenarios = fixedScenarios.filter((scenario) => scenario.buildId === buildId)
      const bestPassRate = buildScenarios.reduce((best, scenario) => Math.max(best, scenario.passRate), 0)
      const averagePassRate =
        buildScenarios.length > 0
          ? buildScenarios.reduce((sum, scenario) => sum + scenario.passRate, 0) / buildScenarios.length
          : 0
      const completeness = getBuildCompletenessScore(buildById.get(buildId)?.build ?? {
        loadout: {
          '1': null,
          '2': null,
          '3': null,
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        },
        passiveTalentIds: [],
      })

      return { buildId, bestPassRate, averagePassRate, completeness }
    })
    .sort((left, right) =>
      right.bestPassRate - left.bestPassRate ||
      right.averagePassRate - left.averagePassRate ||
      right.completeness - left.completeness ||
      left.buildId.localeCompare(right.buildId),
    )

  let selectedCount = Math.min(maxBuildCount, rankedBuilds.length)
  for (let index = 0; index < Math.min(maxBuildCount - 1, rankedBuilds.length - 1); index += 1) {
    const gap = rankedBuilds[index].bestPassRate - rankedBuilds[index + 1].bestPassRate
    if (gap >= gapThreshold) {
      selectedCount = index + 1
      break
    }
  }

  if (selectedCount < minBuildCount && rankedBuilds.length <= minBuildCount) {
    selectedCount = rankedBuilds.length
  }

  return rankedBuilds
    .slice(0, selectedCount)
    .flatMap((entry) => {
      const build = buildById.get(entry.buildId)
      return build ? [build] : []
    })
}

function prependUniqueBuildVariants(
  preferredBuilds: readonly BalanceBuildVariant[] | undefined,
  generatedBuilds: readonly BalanceBuildVariant[],
) {
  const builds: BalanceBuildVariant[] = []
  const seen = new Set<string>()
  const pushBuild = (build: BalanceBuildVariant) => {
    const signature = getBuildSignature(build.build)
    if (seen.has(signature)) {
      return
    }
    seen.add(signature)
    builds.push(build)
  }

  for (const build of preferredBuilds ?? []) {
    pushBuild(build)
  }
  for (const build of generatedBuilds) {
    pushBuild(build)
  }

  return builds
}

export function runTwoPhaseStageBalanceAnalysis(
  options: RunTwoPhaseStageBalanceAnalysisOptions,
): StageBalanceAnalysis {
  const phaseOneBuilds = prependUniqueBuildVariants(
    options.extraBuildCandidates,
    generateStageBalanceBuilds(options.stage, {
      maxActiveBuilds: options.phaseOneMaxActiveBuilds ?? 18,
      maxPassiveVariants: options.phaseOneMaxPassiveVariants ?? 3,
    }),
  )
  const finalBuildCount = Math.max(1, Math.floor(options.finalBuildCount ?? 6))
  const phaseOneAnalysis = runStageBalanceAnalysis({
    stage: options.stage,
    builds: phaseOneBuilds,
    profiles: options.profiles,
    attemptsPerScenario: options.phaseOneAttemptsPerScenario,
    maxDurationMs: options.maxDurationMs,
    tickMs: options.tickMs,
    initialStateMutator: options.initialStateMutator,
  })
  const selectedBuilds = selectTwoPhaseBalanceBuilds(
    phaseOneAnalysis.scenarios,
    phaseOneBuilds,
    finalBuildCount,
  )
  const finalAnalysis = runStageBalanceAnalysis({
    stage: options.stage,
    builds: selectedBuilds,
    profiles: options.profiles,
    attemptsPerScenario: options.attemptsPerScenario,
    maxDurationMs: options.maxDurationMs,
    tickMs: options.tickMs,
    initialStateMutator: options.initialStateMutator,
    collectTrace: options.collectTrace,
    collectDiagnostics: options.collectDiagnostics,
  })

  return {
    ...finalAnalysis,
    buildSearchMode: 'two_phase',
    phaseOneBuildCount: phaseOneBuilds.length,
    finalBuildCount: selectedBuilds.length,
  }
}
