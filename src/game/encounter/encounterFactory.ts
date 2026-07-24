import {
  getEnemySkillDefinition,
  getEnemyStatusDefinition,
  type EnemySkillDefinition,
} from '../data/enemyCatalog'
import { createEncounterTemplate } from '../data/encounterTemplates'
import {
  buildSkillsFromLoadout,
  assertBuildMatchesClass,
  getActiveSkillDefinition,
  getPassiveModifiers,
  getPlayerBuildStatusDefinition,
  getStatusesForTalent,
  getTalentEffectsForTalent,
} from '../data/skillTemplates'
import { getPlayerClassRuntimeDefinition } from '../playerClasses/playerClassRuntimeRegistry'
import { flushEncounterCommands } from './encounterCommandSystem'
import { createCombatLogEventId, recordCombatLogEvents } from './combatLog'
import { drainEncounterEvents } from './encounterEventSystems'
import { applyEncounterEventTriggers, type EncounterEventTrigger } from './encounterEventTriggers'
import { enqueueEncounterEvent } from './encounterEvents'
import { createEnemyStatusEffect, createPlayerBuildStatusEffect } from './encounterStatusEffects'
import {
  applyEnemyStatusChannelStopEffects,
  applyEnemyStatusEventEffects,
  applyEnemyStatusOnApply,
  applyEnemyStatusTickEffectsWithApplications,
  getEnemyStatusDamageTakenMultiplier,
  getEnemyStatusOutgoingDamageMultiplier,
  resolveEnemyIncomingDamage,
  type EnemyChannelStopReason,
} from './enemyStatusEffectRegistry'
import { getPartyStatusEffectHandler } from './partyStatusEffectRegistry'
import { reducePartyPressureByEffectiveHealing } from './partyHealingPressure'
import {
  changePlayerResource,
  getDamageTakenResourceGain,
  getPassiveResourceGain,
} from './playerResourceSystem'
import { applyBearRageGain, resolvePlayerSkillRuntime } from './playerSkillRuntimeRegistry'
import {
  createInitialStageRuleRuntimeEntry,
  getStageRuleLogicHandler,
} from './stageRuleLogicRegistry'
import type { StageInfo } from '../data/stageTemplates'
import type {
  CastState,
  DamageSourceDefinition,
  DamageSourceRuntime,
  DangerLevel,
  CombatLogEvent,
  EnemySkillDamageType,
  EncounterResult,
  EncounterState,
  EnemySeed,
  EnemyState,
  PassiveTalentId,
  PersistedBuildState,
  PlayerClassId,
  PlayerState,
  PartyStatusRuntimeEntry,
  SkillId,
  SkillLoadout,
  SkillState,
  StatusEffect,
  ThreatState,
} from './encounterTypes'

const TICK_INTERVAL_MS = 100
const MAX_THREAT = 99_999
const PARTY_PRESSURE_DECAY_DELAY_MS = 10_000
const PARTY_PRESSURE_DECAY_PER_SECOND = 5
const PLAYER_AUTO_ATTACK_SOURCE_ID = 'player_auto_attack'
const PARTY_AMBIENT_SOURCE_ID = 'party_ambient_random'
const DAMAGE_TAKEN_RESOURCE_WINDOW_MS = 1_000
const DAMAGE_TAKEN_RESOURCE_WINDOW_CAP = 10
const NON_GCD_SELF_COOLDOWN_MS = 500

function getBearTalentValue(
  talentId: PassiveTalentId,
  field: 'valueA' | 'valueB',
  fallback: number,
) {
  return getTalentEffectsForTalent(talentId).find((effect) => typeof effect[field] === 'number')?.[field] ?? fallback
}

const VICTORY_CHATTER = [
  '牧师：哇这 boss 给我蓝都熬空了。',
  '战士：五哥牛逼，这波仇恨拉得真稳。',
  '法师：总算能安心读条了，这把打得舒服。',
  '猎人：陷阱一个没白下，终于过了。',
]

const DEFEAT_CHATTER = [
  '盗贼：我都嫁祸 T 了怎么还是 OT 了？',
  '奶德：战士是用屁股接的怪吗？',
  '术士：我糖都发完了，怎么还是倒这么快。',
  '法师：这都能点后排，我闪现都交麻了。',
]

const STABLE_STATUS: StatusEffect = {
  id: 'stable',
  label: '稳定',
  shortLabel: '稳',
  remainingMs: 0,
  totalMs: 0,
  tone: 'neutral',
  kind: 'neutral',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function withStatusTotal(status: StatusEffect): StatusEffect {
  return {
    ...status,
    totalMs: status.totalMs ?? status.remainingMs,
  }
}

function isStatusActive(status: StatusEffect) {
  return (
    status.remainingMs !== 0 ||
    status.kind === 'neutral' ||
    status.effectLogicId === 'hoe_status' ||
    status.effectLogicId === 'hoe_p_status'
  )
}

function getStatusValue(status: StatusEffect | undefined, field: 'valueA' | 'valueB', fallback: number) {
  return typeof status?.[field] === 'number' ? status[field] : fallback
}

function getStatusTickIntervalMs(status: StatusEffect, fallback: number) {
  return Math.max(1, status.tickIntervalMs ?? fallback)
}

function tickStatus(status: StatusEffect, deltaMs: number) {
  if (status.remainingMs <= 0) {
    return withStatusTotal(status)
  }

  return {
    ...withStatusTotal(status),
    remainingMs: Math.max(0, status.remainingMs - deltaMs),
  }
}

function normalizeStatuses(statuses: StatusEffect[]) {
  const activeStatuses = statuses
    .map(withStatusTotal)
    .filter(isStatusActive)
  const nonPlaceholderStatuses = activeStatuses.filter((status) => status.id !== STABLE_STATUS.id)

  return nonPlaceholderStatuses.length > 0 ? nonPlaceholderStatuses : [{ ...STABLE_STATUS }]
}

function tickStatuses(statuses: StatusEffect[], deltaMs: number) {
  return normalizeStatuses(statuses.map((status) => tickStatus(status, deltaMs)))
}

function cloneStatus(status: StatusEffect): StatusEffect {
  return withStatusTotal(status)
}

function cloneCast(cast: CastState | null): CastState | null {
  return cast ? { ...cast } : null
}

function getCastPhase(cast: CastState | null) {
  return cast?.phase ?? 'casting'
}

function getCombatLogTargetForCastTarget(target: CastState['target']) {
  if (target === 'ally') {
    return { kind: 'ally' as const }
  }
  if (target === 'party') {
    return { kind: 'party' as const, id: 'party', name: '队伍' }
  }
  return { kind: 'tank' as const, id: 'tank', name: '坦克' }
}

function getForcedEnemyTargetIdFromStatuses(statuses: StatusEffect[], effectLogicId: string, enemies: EnemyState[]) {
  const status = statuses.find((entry) =>
    entry.effectLogicId === effectLogicId &&
    isStatusActive(entry) &&
    entry.combatLogSource?.kind === 'enemy',
  )
  const sourceEnemyId = status?.combatLogSource?.id

  return sourceEnemyId && enemies.some((enemy) => enemy.id === sourceEnemyId && enemy.hp > 0)
    ? sourceEnemyId
    : null
}

function getForcedPlayerCurrentTargetId(player: PlayerState, enemies: EnemyState[]) {
  return getForcedEnemyTargetIdFromStatuses(player.debuffs, 'trollTaunted_status', enemies)
}

function getForcedPartyCurrentTargetId(party: EncounterState['party'], enemies: EnemyState[]) {
  return getForcedEnemyTargetIdFromStatuses(party.statuses, 'trollTaunted_p_status', enemies)
}

function resolvePlayerCurrentTargetId(player: PlayerState, enemies: EnemyState[]) {
  return getForcedPlayerCurrentTargetId(player, enemies) ??
    normalizeCurrentTargetId(player.currentTargetId, enemies)
}

function resolvePartyCurrentTargetId(party: EncounterState['party'], enemies: EnemyState[]) {
  return getForcedPartyCurrentTargetId(party, enemies) ??
    normalizeCurrentTargetId(party.currentTargetId, enemies)
}

function getStatusCombatLogSource(status: StatusEffect) {
  return status.combatLogSource ?? { kind: 'status' as const, id: status.id, name: status.label }
}

function getStatusCombatLogAbility(status: StatusEffect) {
  return status.combatLogAbility ?? { kind: 'status' as const, id: status.id, name: status.label }
}

function recordStatusPressureGain(
  state: EncounterState,
  status: StatusEffect,
  previousPressure: number,
) {
  const pressureGained = Math.max(0, state.party.pressure - previousPressure)
  if (pressureGained <= 0) {
    return state
  }

  return recordCombatLogEvents(state, [
    {
      id: createCombatLogEventId(state, 'pressure', `${status.id}:party-pressure`),
      occurredAtMs: state.timeMs,
      type: 'pressure',
      source: getStatusCombatLogSource(status),
      target: { kind: 'party', id: 'party', name: '队伍' },
      ability: getStatusCombatLogAbility(status),
      amount: pressureGained,
    },
  ])
}

function createPlayerStatusImmediateEvents(
  occurredAtMs: number,
  eventKey: string,
  status: StatusEffect,
  previousPlayer: PlayerState,
  nextPlayer: PlayerState,
): CombatLogEvent[] {
  const damage = Math.max(0, previousPlayer.hp - nextPlayer.hp)
  if (damage <= 0) {
    return []
  }

  return [
    {
      id: `${occurredAtMs}:damage:${eventKey}:tank-immediate-status`,
      occurredAtMs,
      type: 'damage',
      source: getStatusCombatLogSource(status),
      target: { kind: 'tank', id: 'tank', name: '坦克' },
      ability: getStatusCombatLogAbility(status),
      amount: damage,
    },
  ]
}

function createPartyStatusImmediateEvents(
  occurredAtMs: number,
  eventKey: string,
  status: StatusEffect,
  previousParty: EncounterState['party'],
  nextParty: EncounterState['party'],
): CombatLogEvent[] {
  const events: CombatLogEvent[] = []
  const damage = Math.max(0, previousParty.hp - nextParty.hp)
  const pressure = Math.max(0, nextParty.pressure - previousParty.pressure)

  if (damage > 0) {
    events.push({
      id: `${occurredAtMs}:damage:${eventKey}:party-immediate-status`,
      occurredAtMs,
      type: 'damage',
      source: getStatusCombatLogSource(status),
      target: { kind: 'party', id: 'party', name: '队伍' },
      ability: getStatusCombatLogAbility(status),
      amount: damage,
    })
  }

  if (pressure > 0) {
    events.push({
      id: `${occurredAtMs}:pressure:${eventKey}:party-immediate-status`,
      occurredAtMs,
      type: 'pressure',
      source: getStatusCombatLogSource(status),
      target: { kind: 'party', id: 'party', name: '队伍' },
      ability: getStatusCombatLogAbility(status),
      amount: pressure,
    })
  }

  return events
}

function recordStageRuleTelemetry(
  previousState: EncounterState,
  nextState: EncounterState,
  rule: EncounterState['stage']['specialRules'][number],
) {
  const pressureGained = Math.max(0, nextState.party.pressure - previousState.party.pressure)
  const tankDamage = Math.max(0, previousState.player.hp - nextState.player.hp)
  const events: CombatLogEvent[] = []

  if (pressureGained > 0) {
    events.push({
      id: createCombatLogEventId(nextState, 'pressure', `${rule.ruleId}:party-pressure`),
      occurredAtMs: nextState.timeMs,
      type: 'pressure',
      source: { kind: 'stageRule', id: rule.ruleId, name: rule.ruleName },
      target: { kind: 'party', id: 'party', name: '队伍' },
      ability: { kind: 'stageRule', id: rule.ruleLogicId, name: rule.ruleName },
      amount: pressureGained,
    })
  }

  if (tankDamage > 0) {
    events.push({
      id: createCombatLogEventId(nextState, 'damage', `${rule.ruleId}:tank-damage`),
      occurredAtMs: nextState.timeMs,
      type: 'damage',
      source: { kind: 'stageRule', id: rule.ruleId, name: rule.ruleName },
      target: { kind: 'tank', id: 'tank', name: '坦克' },
      ability: { kind: 'stageRule', id: rule.ruleLogicId, name: rule.ruleName },
      amount: tankDamage,
    })
  }

  return recordCombatLogEvents(nextState, events)
}

function createEnemyStatusHealingEvent(
  occurredAtMs: number,
  enemy: EnemyState,
  status: StatusEffect,
  amount: number,
): CombatLogEvent | null {
  if (amount <= 0) {
    return null
  }

  return {
    id: `${occurredAtMs}:healing:${enemy.id}:${status.id}:enemy-status-healing`,
    occurredAtMs,
    type: 'healing',
    source: { kind: 'enemy', id: enemy.id, name: enemy.name },
    target: { kind: 'enemy', id: enemy.id, name: enemy.name },
    ability: getStatusCombatLogAbility(status),
    amount,
  }
}

function createEnemyStatusDamageEvent(
  occurredAtMs: number,
  enemy: EnemyState,
  status: StatusEffect,
  target: 'tank' | 'party',
  amount: number,
): CombatLogEvent | null {
  if (amount <= 0) {
    return null
  }

  return {
    id: `${occurredAtMs}:damage:${enemy.id}:${status.id}:${target}-status-damage`,
    occurredAtMs,
    type: 'damage',
    source: { kind: 'enemy', id: enemy.id, name: enemy.name },
    target: target === 'tank'
      ? { kind: 'tank', id: 'tank', name: '坦克' }
      : { kind: 'party', id: 'party', name: '队伍' },
    ability: getStatusCombatLogAbility(status),
    amount,
  }
}

function applyEnemyStatusOnApplyWithTelemetry(
  enemy: EnemyState,
  status: StatusEffect,
  effectLogicId: string,
  tuning: EncounterState['stage']['tuning'],
  occurredAtMs: number,
) {
  const effectedEnemy = applyEnemyStatusOnApply(
    effectLogicId,
    enemy,
    status,
    { tuning },
  )
  const healing = Math.max(0, effectedEnemy.hp - enemy.hp)

  return {
    enemy: effectedEnemy,
    combatLogEvents: [
      createEnemyStatusHealingEvent(occurredAtMs, enemy, status, healing),
    ].filter((event): event is CombatLogEvent => Boolean(event)),
  }
}

function applyEnemyDamageWithStatusMitigation(enemy: EnemyState, amount: number) {
  const resolved = resolveEnemyIncomingDamage(enemy, amount)

  return {
    enemy: cleanupDeadEnemy({
      ...resolved.enemy,
      hp: Math.max(0, resolved.enemy.hp - resolved.amount),
    }),
    amount: resolved.amount,
  }
}

function createEnemyStatusTickTelemetry(
  occurredAtMs: number,
  enemy: EnemyState,
  status: StatusEffect,
  previousState: EncounterState,
  nextState: EncounterState,
) {
  return [
    createEnemyStatusDamageEvent(
      occurredAtMs,
      enemy,
      status,
      'tank',
      Math.max(0, previousState.player.hp - nextState.player.hp),
    ),
    createEnemyStatusDamageEvent(
      occurredAtMs,
      enemy,
      status,
      'party',
      Math.max(0, previousState.party.hp - nextState.party.hp),
    ),
  ].filter((event): event is CombatLogEvent => Boolean(event))
}

function clonePendingAffixTrigger(trigger: EncounterState['runtime']['pendingAffixTriggers'][number]) {
  return { ...trigger }
}

function createInitialPartyStatusRuntimeEntry() {
  return {
    initialized: false,
    intervalElapsedMs: 0,
  }
}

function cloneDamageSourceRuntime(source: DamageSourceRuntime): DamageSourceRuntime {
  return {
    ...source,
    sourceTags: [...source.sourceTags],
    ...(source.pausedByStatus ? { pausedByStatus: true } : {}),
  }
}

function createStageRuleRuntime(stage: EncounterState['stage']) {
  return Object.fromEntries(
    stage.specialRules.map((rule) => [rule.ruleLogicId, createInitialStageRuleRuntimeEntry()]),
  )
}

function isEnemyAlive(enemy: EnemyState) {
  return enemy.hp > 0
}

function getLivingEnemies(enemies: EnemyState[]) {
  return enemies.filter(isEnemyAlive)
}

function playerHasDebuff(player: PlayerState, statusId: string) {
  return player.debuffs.some(
    (status) => status.id === statusId && isStatusActive(status),
  )
}

function playerHasDebuffEffect(player: PlayerState, effectLogicId: string) {
  return player.debuffs.some(
    (status) => status.effectLogicId === effectLogicId && isStatusActive(status),
  )
}

function playerHasDebuffId(player: PlayerState, statusId: string) {
  return player.debuffs.some(
    (status) => status.id === statusId && isStatusActive(status),
  )
}

function getPartyHitPressureBonus(party: EncounterState['party']) {
  return party.statuses.reduce((bonus, status) => {
    if (!isStatusActive(status)) {
      return bonus
    }

    if (status.effectLogicId === 'sensitive_status') {
      return bonus + getStatusValue(status, 'valueA', 10)
    }

    if (status.effectLogicId === 'sensitive?_status') {
      return bonus + getStatusValue(status, 'valueA', 1)
    }

    return bonus
  }, 0)
}

function getActivePartyStatusByEffect(
  party: EncounterState['party'],
  effectLogicId: string,
) {
  return party.statuses.find((status) => status.effectLogicId === effectLogicId && isStatusActive(status))
}

function partyHasStatusId(party: EncounterState['party'], statusId: string) {
  return party.statuses.some(
    (status) => status.id === statusId && isStatusActive(status),
  )
}

function getActivePartyStatuses(party: EncounterState['party']) {
  return party.statuses.filter((status) => status.id !== STABLE_STATUS.id && status.effectLogicId)
}

function syncPartyStatusRuntime(state: EncounterState): EncounterState {
  const activeStatuses = getActivePartyStatuses(state.party)
  const nextRuntime = Object.fromEntries(
    activeStatuses.map((status) => [
      status.id,
      state.runtime.partyStatusRuntime[status.id] ?? createInitialPartyStatusRuntimeEntry(),
    ]),
  )

  return {
    ...state,
    runtime: {
      ...state.runtime,
      partyStatusRuntime: nextRuntime,
    },
  }
}

function applyPartyPressureDelta(state: EncounterState, delta: number): EncounterState {
  const modifiers = getPassiveModifiers(state.passiveTalentIds)
  const pressureDelta = delta < 0 && !modifiers.partyPressureCanDriftDown ? 0 : delta

  return {
    ...state,
    party: {
      ...state.party,
      pressure: clamp(state.party.pressure + pressureDelta, 0, state.party.maxPressure),
    },
  }
}

function applyPassivePartyPressureDecay(
  state: EncounterState,
  deltaMs: number,
  modifiers = getPassiveModifiers(state.passiveTalentIds),
): EncounterState {
  const previousPressure = state.runtime.partyPressureLastValue
  const pressureIncreased = state.party.pressure > previousPressure
  const noGainMs = pressureIncreased
    ? deltaMs
    : state.runtime.partyPressureNoGainMs + deltaMs
  const shouldDecay =
    modifiers.partyPressureCanDriftDown &&
    !pressureIncreased &&
    noGainMs > PARTY_PRESSURE_DECAY_DELAY_MS &&
    state.party.pressure > 0
  const decayMs = shouldDecay ? noGainMs - PARTY_PRESSURE_DECAY_DELAY_MS : 0
  const pressure = shouldDecay
    ? clamp(
        state.party.pressure - PARTY_PRESSURE_DECAY_PER_SECOND * (decayMs / 1000),
        0,
        state.party.maxPressure,
      )
    : state.party.pressure

  return {
    ...state,
    party: {
      ...state.party,
      pressure,
    },
    runtime: {
      ...state.runtime,
      partyPressureNoGainMs: shouldDecay ? PARTY_PRESSURE_DECAY_DELAY_MS : noGainMs,
      partyPressureLastValue: pressure,
    },
  }
}

function applyPartyStatusIntervalEffects(
  state: EncounterState,
  deltaMs: number,
): EncounterState {
  let nextState = syncPartyStatusRuntime(state)

  for (const status of getActivePartyStatuses(nextState.party)) {
    const effectLogicId = status.effectLogicId
    if (!effectLogicId) {
      continue
    }

    const handler = getPartyStatusEffectHandler(effectLogicId)
    if (!handler?.intervalMs || !handler.onInterval) {
      continue
    }

    const runtimeEntry =
      nextState.runtime.partyStatusRuntime[status.id] ?? createInitialPartyStatusRuntimeEntry()
    let intervalElapsedMs = runtimeEntry.intervalElapsedMs + deltaMs

    const intervalMs = getStatusTickIntervalMs(status, handler.intervalMs)

    while (intervalElapsedMs >= intervalMs) {
      const previousPressure = nextState.party.pressure
      nextState = handler.onInterval(
        nextState,
        status,
        {
          ...runtimeEntry,
          initialized: true,
          intervalElapsedMs,
        },
        {
          applyPartyPressureDelta,
        },
      )
      nextState = recordStatusPressureGain(nextState, status, previousPressure)
      intervalElapsedMs -= intervalMs
    }

    nextState = {
      ...nextState,
      runtime: {
        ...nextState.runtime,
        partyStatusRuntime: {
          ...nextState.runtime.partyStatusRuntime,
          [status.id]: {
            initialized: true,
            intervalElapsedMs,
          },
        },
      },
    }
  }

  return syncPartyStatusRuntime(nextState)
}

function applyPartyStatusEventEffects(state: EncounterState): EncounterState {
  if (state.runtime.lastProcessedEvents.length === 0) {
    return syncPartyStatusRuntime(state)
  }

  const syncedState = syncPartyStatusRuntime(state)
  const triggers = getActivePartyStatuses(syncedState.party).flatMap((status): EncounterEventTrigger<PartyStatusRuntimeEntry>[] => {
    const effectLogicId = status.effectLogicId
    if (!effectLogicId) {
      return []
    }

    const handler = getPartyStatusEffectHandler(effectLogicId)
    if (!handler?.onEvent) {
      return []
    }

    return [{
      id: `party-status:${status.id}`,
      getRuntime: (currentState) =>
        currentState.runtime.partyStatusRuntime[status.id] ?? createInitialPartyStatusRuntimeEntry(),
      setRuntime: (currentState, runtime) => ({
        ...currentState,
        runtime: {
          ...currentState.runtime,
          partyStatusRuntime: {
            ...currentState.runtime.partyStatusRuntime,
            [status.id]: {
              ...runtime,
              initialized: true,
            },
          },
        },
      }),
      apply: (currentState, event, runtime) => {
        const previousPressure = currentState.party.pressure
        const nextState = handler.onEvent!(
          currentState,
          status,
          runtime,
          event,
          {
            applyPartyPressureDelta,
          },
        )

        return {
          state: recordStatusPressureGain(nextState, status, previousPressure),
          runtime: {
            ...runtime,
            initialized: true,
          },
        }
      },
    }]
  })

  return syncPartyStatusRuntime(
    applyEncounterEventTriggers(syncedState, syncedState.runtime.lastProcessedEvents, triggers),
  )
}

const INITIAL_ENCOUNTER_STAGE_RULE_LOGIC_IDS = new Set(['incorrigible'])

function applyStageSpecialRules(
  state: EncounterState,
  deltaMs: number,
  options: {
    onlyRuleLogicIds?: ReadonlySet<string>
    runTickHandlers?: boolean
  } = {},
): EncounterState {
  let nextState = state

  for (const rule of state.stage.specialRules) {
    if (options.onlyRuleLogicIds && !options.onlyRuleLogicIds.has(rule.ruleLogicId)) {
      continue
    }

    const handler = getStageRuleLogicHandler(rule.ruleLogicId)
    const runtimeEntry = nextState.runtime.stageRuleRuntime[rule.ruleLogicId] ?? createInitialStageRuleRuntimeEntry()

    if (!runtimeEntry.initialized) {
      if (handler?.onEncounterStart) {
        const previousState = nextState
        nextState = handler.onEncounterStart(nextState, rule, {
          appendOrReplaceEnemyStatus,
          appendOrReplacePartyStatus,
          appendOrReplacePlayerDebuff,
          clamp,
          createEnemyStatusEffect,
          createPlayerBuildStatusEffect,
          playerHasDebuff,
          removePlayerDebuff,
        })
        nextState = recordStageRuleTelemetry(previousState, nextState, rule)
      } else {
        nextState = {
          ...nextState,
          runtime: {
            ...nextState.runtime,
            stageRuleRuntime: {
              ...nextState.runtime.stageRuleRuntime,
              [rule.ruleLogicId]: {
                ...runtimeEntry,
                initialized: true,
              },
            },
          },
        }
      }
    }

    if (options.runTickHandlers === false) {
      continue
    }

    const tickHandler = getStageRuleLogicHandler(rule.ruleLogicId)?.onTick
    if (!tickHandler) {
      continue
    }

    const previousState = nextState
    nextState = tickHandler(nextState, rule, deltaMs, {
      appendOrReplaceEnemyStatus,
      appendOrReplacePartyStatus,
      appendOrReplacePlayerDebuff,
      clamp,
      createEnemyStatusEffect,
      createPlayerBuildStatusEffect,
      playerHasDebuff,
      removePlayerDebuff,
    })
    nextState = recordStageRuleTelemetry(previousState, nextState, rule)
  }

  return nextState
}

function createEnemyFromSeed(enemy: EnemySeed): EnemyState {
  return {
    ...enemy,
    skillCycle: [...enemy.skillCycle],
    statuses: normalizeStatuses(enemy.statuses.map(cloneStatus)),
    cast: cloneCast(enemy.cast),
    pendingRetryCastSkillId: enemy.pendingRetryCastSkillId,
  }
}

function hasStatus(enemy: EnemyState, statusId: string) {
  return enemy.statuses.some(
    (status) => status.id === statusId && isStatusActive(status),
  )
}

function isStunned(enemy: EnemyState) {
  return hasStatus(enemy, 'stunned')
}

function withThreatPresentation(enemy: EnemyState, partyAutoDamageMax: number): EnemyState {
  const forcedToTank = hasStatus(enemy, 'taunted') || hasStatus(enemy, 'mass-taunt')
  const target = forcedToTank || enemy.tankThreat >= enemy.allyThreat ? 'tank' : 'ally'
  const threatState: ThreatState =
    enemy.tankThreat < enemy.allyThreat
      ? 'lost'
      : enemy.tankThreat < enemy.allyThreat + partyAutoDamageMax
        ? 'warning'
        : 'safe'

  return {
    ...enemy,
    target,
    threatState,
  }
}

function withBloodlustPresentation(
  enemy: EnemyState,
  player: Pick<PlayerState, 'hp' | 'maxHp'>,
  party: Pick<EncounterState['party'], 'hp' | 'maxHp'>,
): EnemyState {
  const playerRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0
  const partyRatio = party.maxHp > 0 ? party.hp / party.maxHp : 0
  const target: EnemyState['target'] =
    enemy.cast && (enemy.cast.target === 'tank' || enemy.cast.target === 'ally')
      ? enemy.cast.target
      : playerRatio <= partyRatio ? 'tank' : 'ally'
  const threatState: ThreatState = target === 'tank' ? 'safe' : 'lost'

  return {
    ...enemy,
    target,
    threatState,
  }
}

function normalizeEnemyBase(enemy: EnemyState): EnemyState {
  return {
    ...enemy,
    hp: Math.max(0, enemy.hp),
    tankThreat: clamp(enemy.tankThreat, 0, MAX_THREAT),
    allyThreat: clamp(enemy.allyThreat, 0, MAX_THREAT),
    recoveryRemainingMs: Math.max(0, enemy.recoveryRemainingMs),
    statuses: normalizeStatuses(enemy.statuses),
    skillCycleIndex:
      enemy.skillCycle.length > 0
        ? ((enemy.skillCycleIndex % enemy.skillCycle.length) + enemy.skillCycle.length) % enemy.skillCycle.length
        : 0,
  }
}

function normalizeEnemy(
  enemy: EnemyState,
  player?: Pick<PlayerState, 'hp' | 'maxHp'>,
  party?: Pick<EncounterState['party'], 'hp' | 'maxHp'>,
  partyAutoDamageMax = 0,
): EnemyState {
  const base = normalizeEnemyBase(enemy)

  if (base.threatLogic === 'bloodlust' && player && party) {
    return withBloodlustPresentation(base, player, party)
  }

  return withThreatPresentation(base, partyAutoDamageMax)
}

function tickCast(cast: CastState, deltaMs: number): CastState {
  return {
    ...cast,
    remainingMs: Math.max(0, cast.remainingMs - deltaMs),
  }
}

function createCast(
  id: string,
  name: string,
  target: CastState['target'],
  totalMs: number,
  breakRule: CastState['breakRule'],
  dangerLevel: DangerLevel,
  phase: CastState['phase'] = 'casting',
  lockedEnemyTargetId: string | null = null,
): CastState {
  return {
    id,
    name,
    target,
    lockedEnemyTargetId,
    totalMs,
    remainingMs: totalMs,
    breakRule,
    dangerLevel,
    phase,
  }
}

function resolveCastTarget(enemy: EnemyState, skillDefinition: EnemySkillDefinition): CastState['target'] {
  switch (skillDefinition.targetRuleId) {
    case 'tankAndParty':
      return enemy.target === 'ally' ? 'party' : 'tank'
    case 'party':
      return 'party'
    case 'otherEnemy':
      return 'enemy'
    case 'self':
      return 'self'
    case 'mostInjured':
      return 'enemy'
    case 'threatTarget':
    default:
      return enemy.target
  }
}

function resolveLiveThreatTarget(
  enemy: EnemyState,
  player?: Pick<PlayerState, 'hp' | 'maxHp'>,
  party?: Pick<EncounterState['party'], 'hp' | 'maxHp'>,
): EnemyState['target'] {
  if (enemy.threatLogic === 'bloodlust' && player && party) {
    const playerRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0
    const partyRatio = party.maxHp > 0 ? party.hp / party.maxHp : 0
    return playerRatio <= partyRatio ? 'tank' : 'ally'
  }

  return enemy.allyThreat > enemy.tankThreat ? 'ally' : 'tank'
}

function selectNextEnemySkillId(enemy: EnemyState) {
  if (enemy.pendingRetryCastSkillId) {
    return enemy.pendingRetryCastSkillId
  }

  if (enemy.skillCycle.length === 0) {
    return enemy.skillIds[0] ?? null
  }

  const enemySkills = new Set(enemy.skillIds)

  for (let offset = 0; offset < enemy.skillCycle.length; offset += 1) {
    const index = (enemy.skillCycleIndex + offset) % enemy.skillCycle.length
    const skillId = enemy.skillCycle[index]

    if (enemySkills.has(skillId)) {
      return skillId
    }
  }

  return enemy.skillIds[0] ?? null
}

function createNextCast(
  enemy: EnemyState,
  castTimeMultiplier: number,
  player?: Pick<PlayerState, 'hp' | 'maxHp'>,
  party?: Pick<EncounterState['party'], 'hp' | 'maxHp'>,
  enemies?: EnemyState[],
): CastState | null {
  if (!isEnemyAlive(enemy) || isStunned(enemy)) {
    return null
  }

  const nextSkillId = selectNextEnemySkillId(enemy)
  const skillDefinition = nextSkillId ? getEnemySkillDefinition(nextSkillId) : undefined

  if (!skillDefinition) {
    return null
  }

  const totalMs = Math.max(0, Math.round(skillDefinition.castTimeMs * castTimeMultiplier))
  const lockedEnemyTargetId =
    skillDefinition.targetRuleId === 'mostInjured' && enemies
      ? enemies[findEnemyCastTargetIndex(enemies, enemies.findIndex((entry) => entry.id === enemy.id), 'mostInjured')]?.id ?? null
      : null

  return createCast(
    skillDefinition.skillId,
    skillDefinition.skillName,
    resolveCastTarget({
      ...enemy,
      target: resolveLiveThreatTarget(enemy, player, party),
    }, skillDefinition),
    totalMs,
    skillDefinition.castBreakRule,
    skillDefinition.dangerLevel,
    'casting',
    lockedEnemyTargetId,
  )
}

function isControlStatusActive(enemy: EnemyState) {
  return enemy.statuses.some(
    (status) =>
      (status.id === 'stunned' || status.id === 'feared') &&
      isStatusActive(status),
  )
}

function canPlayerSkillAffectEnemy(enemy: EnemyState, skillId: SkillId) {
  const skillDefinition = getActiveSkillDefinition(skillId)

  if (!skillDefinition) {
    return false
  }

  if (enemy.isSkull && !skillDefinition.canAffectSkull) {
    return false
  }

  return true
}

function canStopCast(enemy: EnemyState, skillId: SkillId) {
  const skillDefinition = getActiveSkillDefinition(skillId)

  if (!skillDefinition || !enemy.cast) {
    return false
  }

  if (!canPlayerSkillAffectEnemy(enemy, skillId)) {
    return false
  }

  if (skillDefinition.castStopMode === 'interrupt') {
    return enemy.cast.breakRule === 'interruptOrControl'
  }

  if (skillDefinition.castStopMode === 'control') {
    return (
      enemy.cast.breakRule === 'interruptOrControl' ||
      enemy.cast.breakRule === 'controlOnly'
    )
  }

  return false
}

function replaceStatusList(statuses: StatusEffect[], status: StatusEffect) {
  const filtered = statuses.filter((entry) => entry.id !== status.id && entry.id !== STABLE_STATUS.id)
  return normalizeStatuses([...filtered, withStatusTotal(status)])
}

function appendOrStackStatusList(statuses: StatusEffect[], status: StatusEffect) {
  const existing = statuses.find((entry) => entry.id === status.id)
  if (!existing) {
    return replaceStatusList(statuses, {
      ...status,
      stacks: status.stacks ?? 1,
    })
  }

  const maxStacks = status.maxStacks ?? existing.maxStacks ?? 1
  const nextStatus = {
    ...existing,
    ...status,
    maxStacks,
    stacks: Math.min(maxStacks, (existing.stacks ?? 1) + 1),
  }
  return replaceStatusList(statuses, nextStatus)
}

function appendOrReplaceEnemyStatus(enemy: EnemyState, status: StatusEffect) {
  return {
    ...enemy,
    statuses:
      (status.maxStacks ?? 1) > 1
        ? appendOrStackStatusList(enemy.statuses, status)
        : replaceStatusList(enemy.statuses, status),
  }
}

function cleanupDeadEnemy(enemy: EnemyState): EnemyState {
  if (enemy.hp > 0) {
    return enemy
  }

  return {
    ...enemy,
    hp: 0,
    cast: null,
    recoveryRemainingMs: 0,
    pendingRetryCastSkillId: null,
  }
}

function randomIntInclusive(min: number, max: number) {
  const low = Math.ceil(Math.min(min, max))
  const high = Math.floor(Math.max(min, max))
  return Math.floor(Math.random() * (high - low + 1)) + low
}

function createPlayerAutoAttackDefinition(): DamageSourceDefinition {
  return {
    sourceId: PLAYER_AUTO_ATTACK_SOURCE_ID,
    sourceKind: 'player_auto_attack',
    ownerSide: 'player',
    sourceTags: ['player', 'auto-attack'],
    intervalMs: 1000,
    startReady: true,
    invalidTargetPolicy: 'pauseReady',
    targetRule: 'lockedCurrentTarget',
    targetSelector: 'currentTarget',
    targetCount: 1,
    damageMode: 'fixed',
    baseDamage: 3,
    minDamage: 3,
    maxDamage: 3,
    threatMode: 'formula',
    threatMultiplier: 5,
    flatThreat: 0,
    threatSource: 'player',
    enabled: true,
  }
}

function createPlayerAutoAttackDefinitionForStage(stage: EncounterState['stage']): DamageSourceDefinition {
  return {
    ...createPlayerAutoAttackDefinition(),
    baseDamage: stage.playerAutoDamage,
    minDamage: stage.playerAutoDamage,
    maxDamage: stage.playerAutoDamage,
  }
}
function createLegacyPartyAmbientSource(state: EncounterState['stage']): DamageSourceDefinition | null {
  if (state.partyAutoDamageIntervalMs <= 0 || state.partyAutoDamageTargetCount <= 0) {
    return null
  }

  return {
    sourceId: PARTY_AMBIENT_SOURCE_ID,
    sourceKind: 'party_ambient_random',
    ownerSide: 'party',
    sourceTags: ['party', 'ambient', 'random'],
    intervalMs: state.partyAutoDamageIntervalMs,
    startReady: false,
    invalidTargetPolicy: 'retargetLivingEnemy',
    targetRule: 'randomLivingEnemy',
    targetSelector: 'randomLivingEnemy',
    targetCount: state.partyAutoDamageTargetCount,
    damageMode: 'randomRange',
    baseDamage: 0,
    minDamage: state.partyAutoDamageMin,
    maxDamage: state.partyAutoDamageMax,
    threatMode: 'formula',
    threatMultiplier: 1,
    flatThreat: 0,
    threatSource: 'party',
    enabled: true,
  }
}

function createDamageSourceRuntime(definition: DamageSourceDefinition): DamageSourceRuntime {
  return {
    ...definition,
    sourceTags: [...definition.sourceTags],
    remainingMs: definition.startReady ? 0 : definition.intervalMs,
    lockedTargetId: null,
  }
}

function syncDamageSourceTargets(
  sources: DamageSourceRuntime[],
  playerCurrentTargetId: string | null,
  partyCurrentTargetId: string | null,
): DamageSourceRuntime[] {
  return sources.map((source) =>
    source.targetRule === 'lockedCurrentTarget'
      ? {
          ...source,
          lockedTargetId:
            source.ownerSide === 'party' ? partyCurrentTargetId : playerCurrentTargetId,
        }
      : source,
  )
}

function buildRuntimeDamageSources(
  stage: EncounterState['stage'],
  currentSources: DamageSourceRuntime[],
  playerCurrentTargetId: string | null,
  partyCurrentTargetId: string | null,
) {
  const definitions = new Map<string, DamageSourceDefinition>()

  for (const definition of stage.damageSources) {
    if (definition.enabled) {
      definitions.set(definition.sourceId, {
        ...definition,
        sourceTags: [...definition.sourceTags],
      })
    }
  }

  const legacyPartySource = createLegacyPartyAmbientSource(stage)
  if (legacyPartySource) {
    definitions.set(legacyPartySource.sourceId, legacyPartySource)
  } else {
    definitions.delete(PARTY_AMBIENT_SOURCE_ID)
  }

  const autoAttackSource = createPlayerAutoAttackDefinitionForStage(stage)
  definitions.set(autoAttackSource.sourceId, autoAttackSource)

  const currentById = new Map(
    currentSources.map((source) => [source.sourceId, cloneDamageSourceRuntime(source)]),
  )

  const nextSources = [...definitions.values()].map((definition) => {
    const current = currentById.get(definition.sourceId)
    if (!current) {
      return createDamageSourceRuntime(definition)
    }

    return {
      ...current,
      ...definition,
      sourceTags: [...definition.sourceTags],
    }
  })

  return syncDamageSourceTargets(nextSources, playerCurrentTargetId, partyCurrentTargetId)
}

function isDamageSourcePausedByStatus(
  source: DamageSourceRuntime,
  _player: PlayerState,
  party: EncounterState['party'],
  enemies: EnemyState[],
) {
  if (source.ownerSide === 'party' && partyHasStatusId(party, 'slowDown_p')) {
    return true
  }

  const gotChannel = enemies.find((enemy) =>
    enemy.hp > 0 &&
    enemy.cast?.id === 'get_it！' &&
    getCastPhase(enemy.cast) === 'channeling' &&
    enemy.statuses.some((status) => status.effectLogicId === 'got!_status' && isStatusActive(status)),
  )

  if (!gotChannel) {
    return false
  }

  if (source.ownerSide === 'player') {
    return gotChannel.cast?.target === 'tank'
  }

  if (source.ownerSide === 'party') {
    return gotChannel.cast?.target === 'party' || gotChannel.cast?.target === 'ally'
  }

  return false
}

function getPartyAutoDamageRemainingMs(
  stage: EncounterState['stage'],
  sources: DamageSourceRuntime[],
) {
  return (
    sources.find((source) => source.sourceId === PARTY_AMBIENT_SOURCE_ID)?.remainingMs ??
    Math.max(0, stage.partyAutoDamageIntervalMs)
  )
}

function resolveDamageSourceThreat(
  source: DamageSourceRuntime,
  damage: number,
  modifiers = getPassiveModifiers([]),
) {
  if (source.threatMode !== 'formula') {
    return 0
  }

  const multiplier = source.ownerSide === 'party' ? modifiers.partyThreatMultiplier : 1
  return (damage * source.threatMultiplier + source.flatThreat) * multiplier
}

function applyDamageSourceThreat(
  enemy: EnemyState,
  source: DamageSourceRuntime,
  damage: number,
  modifiers = getPassiveModifiers([]),
) {
  const threatGain = resolveDamageSourceThreat(source, damage, modifiers)
  if (threatGain === 0) {
    return enemy
  }

  return source.threatSource === 'party'
    ? applyThreatGain(enemy, 0, threatGain)
    : applyThreatGain(enemy, threatGain, 0)
}

function applyImmediatePlayerAutoAttack(state: EncounterState, targetEnemyId: string): EncounterState {
  const targetEnemy = state.enemies.find((enemy) => enemy.id === targetEnemyId)
  if (!targetEnemy || targetEnemy.hp <= 0) {
    return state
  }

  const modifiers = getPassiveModifiers(state.passiveTalentIds)
  const autoAttackSource = createPlayerAutoAttackDefinitionForStage(state.stage)
  const autoAttackRuntime = createDamageSourceRuntime(autoAttackSource)
  const rawDamage = resolveDamageSourceDamage(autoAttackRuntime, modifiers) *
    getPlayerOutgoingDamageMultiplier(state.player) *
    getPlayerOutgoingDamageMultiplierFromMurlocWatch(state.enemies) *
    getEnemyDamageTakenMultiplier(targetEnemy)
  const damageResult = applyEnemyDamageWithStatusMitigation(targetEnemy, rawDamage)
  const damage = damageResult.amount
  const nextPlayer = changePlayerResource(state.player, modifiers.playerAutoAttackResourceGainBonus)

  const enemyName = targetEnemy.name
  return finalizeEncounterState(recordCombatLogEvents({
    ...state,
    player: nextPlayer,
    enemies: state.enemies.map((enemy) =>
      enemy.id === targetEnemyId
        ? applyDamageSourceThreat(damageResult.enemy, autoAttackRuntime, damage, modifiers)
        : enemy,
    ),
    runtime: {
      ...state.runtime,
      damageSources: state.runtime.damageSources.map((source) =>
        source.sourceId === PLAYER_AUTO_ATTACK_SOURCE_ID
          ? {
              ...source,
              remainingMs: autoAttackSource.intervalMs,
              lockedTargetId: targetEnemyId,
            }
          : source,
      ),
    },
  }, [
    {
      id: createCombatLogEventId(state, 'damage', `player-auto:${targetEnemyId}`),
      occurredAtMs: state.timeMs,
      type: 'damage',
      source: { kind: 'playerAutoAttack', id: PLAYER_AUTO_ATTACK_SOURCE_ID, name: '玩家自动攻击' },
      target: { kind: 'enemy', id: targetEnemyId, name: enemyName },
      ability: { kind: 'autoAttack', id: PLAYER_AUTO_ATTACK_SOURCE_ID, name: '玩家自动攻击' },
      amount: damage,
    },
  ]))
}

function resolveDamageSourceDamage(source: DamageSourceRuntime, modifiers = getPassiveModifiers([])) {
  const bonusDamage =
    source.sourceKind === 'player_auto_attack' ? modifiers.playerAutoAttackDamageBonus : 0
  const multiplier = source.ownerSide === 'party' ? modifiers.partyDamageMultiplier : 1

  if (source.damageMode === 'randomRange') {
    return (randomIntInclusive(source.minDamage, source.maxDamage) + bonusDamage) * multiplier
  }

  return (source.baseDamage + bonusDamage) * multiplier
}

function getDamageSourceMurlocWatchingMultiplier(
  source: DamageSourceRuntime,
  enemies: EnemyState[],
) {
  if (source.ownerSide === 'player') {
    return getPlayerOutgoingDamageMultiplierFromMurlocWatch(enemies)
  }

  if (source.ownerSide === 'party') {
    return getPartyOutgoingDamageMultiplierFromMurlocWatch(enemies)
  }

  return 1
}

function pickRandomEnemyIds(
  enemies: EnemyState[],
  count: number,
  excludedTargetId?: string | null,
) {
  const livingEnemies = enemies.filter(
    (enemy) => enemy.hp > 0 && (!excludedTargetId || enemy.id !== excludedTargetId),
  )
  const pool = livingEnemies.length >= count ? livingEnemies : enemies.filter((enemy) => enemy.hp > 0)
  const shuffled = [...pool]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled.slice(0, Math.min(count, shuffled.length)).map((enemy) => enemy.id)
}

function isDisgustingEnemy(enemy: EnemyState) {
  return enemy.statuses.some(
    (status) =>
      isStatusActive(status) &&
      (status.id === 'disgusting' || status.effectLogicId === 'disgusting_status'),
  )
}

function resolveDamageSourceTargetIds(
  source: DamageSourceRuntime,
  enemies: EnemyState[],
  playerCurrentTargetId: string | null,
  party: EncounterState['party'],
) {
  if (source.targetRule === 'lockedCurrentTarget') {
    const currentTargetId =
      source.ownerSide === 'party' ? party.currentTargetId : playerCurrentTargetId
    const lockedTargetId = currentTargetId ?? source.lockedTargetId
    if (lockedTargetId && enemies.some((enemy) => enemy.id === lockedTargetId && enemy.hp > 0)) {
      return [lockedTargetId]
    }

    if (source.invalidTargetPolicy === 'retargetLivingEnemy') {
      return getLivingEnemies(enemies)
        .slice(0, Math.max(1, source.targetCount))
        .map((enemy) => enemy.id)
    }

    return []
  }

  const livingEnemies = enemies.filter((enemy) => enemy.hp > 0)
  const preferredEnemies =
    source.ownerSide === 'party'
      ? livingEnemies.filter((enemy) => !isDisgustingEnemy(enemy))
      : livingEnemies
  const partyLockedTargetId =
    source.ownerSide === 'party' &&
    source.targetRule === 'randomLivingEnemy' &&
    source.targetCount > 1 &&
    getActivePartyStatusByEffect(party, 'asHisWish_status') &&
    party.currentTargetId &&
    livingEnemies.some((enemy) => enemy.id === party.currentTargetId)
      ? party.currentTargetId
      : null
  if (partyLockedTargetId) {
    return [
      partyLockedTargetId,
      ...pickRandomEnemyIds(
        preferredEnemies.length > 0 ? preferredEnemies : livingEnemies,
        Math.max(0, source.targetCount - 1),
        partyLockedTargetId,
      ),
    ]
  }

  return pickRandomEnemyIds(
    preferredEnemies.length > 0 ? preferredEnemies : livingEnemies,
    Math.max(1, source.targetCount),
    null,
  )
}

function applyDamageSources(state: EncounterState, deltaMs: number) {
  let nextEnemies = state.enemies.map((enemy) => ({ ...enemy }))
  const combatLogEvents: CombatLogEvent[] = []
  const playerHealingSuppressed = isPlayerHealingSuppressedByMurlocWatch(state.enemies)
  const partyHealingSuppressed = isPartyHealingSuppressedByMurlocWatch(state.enemies)
  let nextPlayer = {
    ...state.player,
    hp: clampSuppressedHealing(
      state.player.hp,
      state.player.hp + state.stage.playerAutoHeal * getPlayerHealingReceivedMultiplier(state.player) * (deltaMs / 1000),
      state.player.maxHp,
      playerHealingSuppressed,
    ),
  }
  let nextParty = {
    ...state.party,
    hp: clampSuppressedHealing(
      state.party.hp,
      state.party.hp + state.stage.partyAutoHeal * getPartyHealingReceivedMultiplier(state.party) * (deltaMs / 1000),
      state.party.maxHp,
      partyHealingSuppressed,
    ),
  }
  const playerAutoHealing = Math.max(0, nextPlayer.hp - state.player.hp)
  const partyAutoHealing = Math.max(0, nextParty.hp - state.party.hp)
  nextParty = reducePartyPressureByEffectiveHealing(nextParty, partyAutoHealing)
  if (playerAutoHealing > 0) {
    combatLogEvents.push({
      id: createCombatLogEventId(state, 'healing', `party-auto-heal:tank:${combatLogEvents.length}`),
      occurredAtMs: state.timeMs,
      type: 'healing',
      source: { kind: 'partyAutoHeal', id: 'party_auto_heal', name: '队伍自动治疗' },
      target: { kind: 'tank', id: 'tank', name: '坦克' },
      ability: { kind: 'autoHeal', id: 'party_auto_heal', name: '队伍自动治疗' },
      amount: playerAutoHealing,
    })
  }
  if (partyAutoHealing > 0) {
    combatLogEvents.push({
      id: createCombatLogEventId(state, 'healing', `party-auto-heal:party:${combatLogEvents.length}`),
      occurredAtMs: state.timeMs,
      type: 'healing',
      source: { kind: 'partyAutoHeal', id: 'party_auto_heal', name: '队伍自动治疗' },
      target: { kind: 'party', id: 'party', name: '队伍' },
      ability: { kind: 'autoHeal', id: 'party_auto_heal', name: '队伍自动治疗' },
      amount: partyAutoHealing,
    })
  }
  const dislikedStatus = getActivePartyStatusByEffect(state.party, 'disliked_status')
  let partyStatusRuntime = { ...state.runtime.partyStatusRuntime }
  const modifiers = getPassiveModifiers(state.passiveTalentIds)
  const effectivePlayerCurrentTargetId = resolvePlayerCurrentTargetId(state.player, nextEnemies)
  const effectivePartyCurrentTargetId = resolvePartyCurrentTargetId(nextParty, nextEnemies)
  nextPlayer = {
    ...nextPlayer,
    currentTargetId: effectivePlayerCurrentTargetId,
  }
  nextParty = {
    ...nextParty,
    currentTargetId: effectivePartyCurrentTargetId,
  }
  const syncedSources = buildRuntimeDamageSources(
    state.stage,
    state.runtime.damageSources,
    effectivePlayerCurrentTargetId,
    effectivePartyCurrentTargetId,
  )

  const nextSources = syncedSources.map((source) => {
    const intervalMs = Math.max(1, source.intervalMs)
    const previousRemainingMs = source.remainingMs
    const pausedByStatus = isDamageSourcePausedByStatus(source, state.player, nextParty, nextEnemies)
    if (pausedByStatus) {
      return {
        ...source,
        remainingMs: Math.max(0, source.remainingMs),
        pausedByStatus: true,
      }
    }

    let nextSource = {
      ...source,
      pausedByStatus: false,
      remainingMs: source.remainingMs - deltaMs,
    }

    while (nextSource.remainingMs < 0 || (nextSource.remainingMs === 0 && previousRemainingMs > 0)) {
      const targetIds = resolveDamageSourceTargetIds(
        nextSource,
        nextEnemies,
        effectivePlayerCurrentTargetId,
        nextParty,
      )

      if (targetIds.length === 0) {
        nextSource = {
          ...nextSource,
          remainingMs: nextSource.invalidTargetPolicy === 'pauseReady' ? 0 : intervalMs,
          lockedTargetId:
            nextSource.targetRule === 'lockedCurrentTarget'
              ? nextSource.ownerSide === 'party'
                ? effectivePartyCurrentTargetId
                : effectivePlayerCurrentTargetId
              : nextSource.lockedTargetId,
        }
        break
      }

      const targetIdSet = new Set(targetIds)
      nextEnemies = nextEnemies.map((enemy) => {
        if (!targetIdSet.has(enemy.id) || enemy.hp <= 0) {
          return cleanupDeadEnemy(enemy)
        }

        const rawDamage =
          resolveDamageSourceDamage(nextSource, modifiers) *
          (nextSource.ownerSide === 'player' ? getPlayerOutgoingDamageMultiplier(nextPlayer) : 1) *
          getDamageSourceMurlocWatchingMultiplier(nextSource, nextEnemies) *
          getEnemyDamageTakenMultiplier(enemy)
        const damageResult = applyEnemyDamageWithStatusMitigation(enemy, rawDamage)
        const damage = damageResult.amount
        let threatSource = nextSource
        if (dislikedStatus && nextSource.threatSource === 'party') {
          const runtimeEntry =
            partyStatusRuntime[dislikedStatus.id] ?? createInitialPartyStatusRuntimeEntry()
          const triggerCount = runtimeEntry.triggerCount ?? 0
          const maxTriggers = Math.max(0, Math.floor(getStatusValue(dislikedStatus, 'valueA', 3)))
          const threatMultiplier = getStatusValue(dislikedStatus, 'valueB', 3)
          if (triggerCount < maxTriggers) {
            threatSource = {
              ...nextSource,
              threatMultiplier: nextSource.threatMultiplier * threatMultiplier,
              flatThreat: nextSource.flatThreat * threatMultiplier,
            }
          }
          partyStatusRuntime = {
            ...partyStatusRuntime,
            [dislikedStatus.id]: {
              ...runtimeEntry,
              initialized: true,
              triggerCount: triggerCount + 1,
            },
          }
          if (triggerCount + 1 >= maxTriggers) {
            nextParty = consumePartyStatus(nextParty, dislikedStatus.id)
          }
        }
        if (nextSource.sourceKind === 'player_auto_attack') {
          nextPlayer = changePlayerResource(nextPlayer, modifiers.playerAutoAttackResourceGainBonus)
        }
        if (nextSource.ownerSide === 'player' || nextSource.ownerSide === 'party') {
          const sourceKind = nextSource.sourceKind === 'player_auto_attack'
            ? 'playerAutoAttack'
            : nextSource.ownerSide === 'party'
              ? 'partyAutoAttack'
              : 'player'
          const sourceName = sourceKind === 'playerAutoAttack'
            ? '玩家自动攻击'
            : sourceKind === 'partyAutoAttack'
              ? '队伍自动攻击'
              : nextSource.sourceId
          combatLogEvents.push({
            id: createCombatLogEventId(state, 'damage', `${nextSource.sourceId}:${enemy.id}:${combatLogEvents.length}`),
            occurredAtMs: state.timeMs,
            type: 'damage',
            source: { kind: sourceKind, id: nextSource.sourceId, name: sourceName },
            target: { kind: 'enemy', id: enemy.id, name: enemy.name },
            ability: { kind: 'autoAttack', id: nextSource.sourceId, name: sourceName },
            amount: damage,
          })
        }
        let nextEnemy = applyDamageSourceThreat(damageResult.enemy, threatSource, damage, modifiers)
        if (
          damage > 0 &&
          (nextSource.ownerSide === 'player' || nextSource.ownerSide === 'party')
        ) {
          const stateBeforeEnemyStatusEvents = {
            ...state,
            player: nextPlayer,
            party: nextParty,
            enemies: nextEnemies.map((entry) => (entry.id === enemy.id ? nextEnemy : entry)),
            runtime: {
              ...state.runtime,
              combatLog: [...state.runtime.combatLog, ...combatLogEvents],
            },
          }
          const combatLogLengthBefore = stateBeforeEnemyStatusEvents.runtime.combatLog.length
          const stateAfterEnemyStatusEvents = applyEnemyStatusEventEffects(
            stateBeforeEnemyStatusEvents,
            {
              type: 'enemy/damage-applied',
              occurredAtMs: state.timeMs,
              enemyId: enemy.id,
              amount: damage,
              sourceSkillId: nextSource.sourceId,
              sourceOwner: nextSource.ownerSide,
            },
          )
          nextPlayer = stateAfterEnemyStatusEvents.player
          nextParty = stateAfterEnemyStatusEvents.party
          combatLogEvents.push(
            ...stateAfterEnemyStatusEvents.runtime.combatLog.slice(combatLogLengthBefore),
          )
          nextEnemy = stateAfterEnemyStatusEvents.enemies.find((entry) => entry.id === enemy.id) ?? nextEnemy
        }
        return nextEnemy
      })

      nextSource = {
        ...nextSource,
        remainingMs: nextSource.remainingMs + intervalMs,
        lockedTargetId:
          nextSource.targetRule === 'lockedCurrentTarget'
            ? nextSource.ownerSide === 'party'
              ? effectivePartyCurrentTargetId
              : effectivePlayerCurrentTargetId
            : nextSource.lockedTargetId,
      }
    }

    return nextSource
  })

  return {
    player: nextPlayer,
    party: nextParty,
    enemies: nextEnemies.map(cleanupDeadEnemy),
    damageSources: syncDamageSourceTargets(
      nextSources,
      effectivePlayerCurrentTargetId,
      effectivePartyCurrentTargetId,
    ),
    partyAutoDamageRemainingMs: getPartyAutoDamageRemainingMs(state.stage, nextSources),
    partyStatusRuntime,
    combatLogEvents,
  }
}

function appendOrReplacePlayerDebuff(
  player: PlayerState,
  status: StatusEffect,
  passiveTalentIds: PassiveTalentId[] = [],
) {
  const controlDurationMultiplier = getPassiveModifiers(passiveTalentIds).bearControlDurationMultiplier
  const isControl = status.id === 'stunned' || status.effectLogicId === 'stunned' || status.effectLogicId === 'slowDown_status'
  const nextStatus = isControl && controlDurationMultiplier < 1
    ? {
        ...status,
        remainingMs: Math.round(status.remainingMs * controlDurationMultiplier),
        totalMs: typeof status.totalMs === 'number'
          ? Math.round(status.totalMs * controlDurationMultiplier)
          : status.totalMs,
      }
    : status
  return applyPlayerDebuffOnApplyEffects({
    ...player,
    debuffs:
      (nextStatus.maxStacks ?? 1) > 1
        ? appendOrStackStatusList(player.debuffs, nextStatus)
        : replaceStatusList(player.debuffs, nextStatus),
  }, nextStatus)
}

function getPlayerBuffDamageMultiplier(player: PlayerState, damageType: EnemySkillDamageType) {
  return player.buffs.reduce((multiplier, status) => {
    if (
      !status.damageReductionRatio ||
      !status.damageReductionTypes?.includes(damageType)
    ) {
      return multiplier
    }

    return multiplier * (1 - status.damageReductionRatio)
  }, 1)
}

function getPlayerOutgoingDamageMultiplier(player: PlayerState) {
  return player.buffs.reduce(
    (multiplier, status) => multiplier * (1 + (status.damageMultiplierBonus ?? 0)),
    1,
  )
}

function getEnemyDamageTakenMultiplier(enemy: EnemyState) {
  return getEnemyStatusDamageTakenMultiplier(enemy)
}

function getEnemyMagicDamageMultiplier(enemy: EnemyState, damageType: EnemySkillDamageType) {
  if (damageType !== 'magic') {
    return 1
  }

  return enemy.statuses.reduce((multiplier, status) => {
    if (status.effectLogicId !== 'challenge_magic_damage_boost_status') {
      return multiplier
    }

    return multiplier * (1 + getStatusValue(status, 'valueA', 0))
  }, 1)
}

function getPlayerDamageTakenMultiplierFromDebuffs(player: PlayerState, damageType: EnemySkillDamageType) {
  return player.debuffs.reduce(
    (multiplier, status) => {
      const soulSensitiveBonus =
        damageType === 'magic' && status.effectLogicId === 'soulSensitive_status'
          ? getStatusValue(status, 'valueA', 50) / 100
          : 0
      const hunterMarkBonus =
        damageType === 'physical' && status.effectLogicId === 'hunter\'sMarked_status'
          ? getStatusValue(status, 'valueA', 25) / 100
          : 0
      const spearBreachBonus =
        damageType === 'physical' && status.effectLogicId === 'challenge_spear_breach_player_status'
          ? getStatusValue(status, 'valueA', 0.12)
          : 0
      return multiplier * (
        1 + ((status.damageTakenMultiplierBonus ?? 0) + hunterMarkBonus + spearBreachBonus + soulSensitiveBonus) * (status.stacks ?? 1)
      )
    },
    1,
  )
}

function getPartyDamageTakenMultiplierFromStatuses(party: EncounterState['party'], damageType: EnemySkillDamageType) {
  return party.statuses.reduce(
    (multiplier, status) => {
      const soulSensitiveBonus =
        damageType === 'magic' && status.effectLogicId === 'soulSensitive_p_status'
          ? getStatusValue(status, 'valueA', 50) / 100
          : 0
      return multiplier * (1 + ((status.damageTakenMultiplierBonus ?? 0) + soulSensitiveBonus) * (status.stacks ?? 1))
    },
    1,
  )
}

function getPlayerHealingReceivedMultiplier(player: PlayerState) {
  return player.debuffs.some((status) => status.effectLogicId === 'trollRuptured_status' && isStatusActive(status))
    ? 0.5
    : 1
}

function getPartyHealingReceivedMultiplier(party: EncounterState['party']) {
  return party.statuses.some((status) => status.effectLogicId === 'trollRuptured_p_status' && isStatusActive(status))
    ? 0
    : 1
}

function isFishEnemy(enemy: EnemyState) {
  return enemy.definitionId.includes('murloc') || enemy.definitionId.includes('Murk-Eye')
}

function appendOrStackPlayerDebuff(player: PlayerState, status: StatusEffect) {
  return {
    ...player,
    debuffs:
      (status.maxStacks ?? 1) > 1
        ? appendOrStackStatusList(player.debuffs, status)
        : replaceStatusList(player.debuffs, status),
  }
}

function appendOrStackPartyStatus(party: EncounterState['party'], status: StatusEffect) {
  return {
    ...party,
    statuses:
      (status.maxStacks ?? 1) > 1
        ? appendOrStackStatusList(party.statuses, status)
        : replaceStatusList(party.statuses, status),
  }
}

function applyTideCommandVulnerabilityToHitTarget(
  enemy: EnemyState,
  player: PlayerState,
  party: EncounterState['party'],
  target: 'tank' | 'party',
) {
  const tideCommand = enemy.statuses.find((status) =>
    status.effectLogicId === 'challenge_tide_command_status' &&
    isStatusActive(status) &&
    (enemy.row >= 3 || isFishEnemy(enemy)),
  )
  if (!tideCommand) {
    return { player, party }
  }

  const damageTakenBonus = getStatusValue(tideCommand, 'valueA', 0.08)
  const maxStacks = Math.max(1, Math.floor(getStatusValue(tideCommand, 'valueB', 5)))
  const baseStatus = {
    id: target === 'tank' ? 'challenge_tidal_vulnerability' : 'challenge_tidal_vulnerability_p',
    iconId: 'challenge_tidal_vulnerability',
    label: '潮汐破绽',
    shortLabel: '破绽',
    remainingMs: 6000,
    totalMs: 6000,
    tone: 'danger' as const,
    kind: target === 'tank' ? 'playerDebuff' as const : 'partyDebuff' as const,
    effectLogicId: target === 'tank'
      ? 'challenge_tidal_vulnerability_status'
      : 'challenge_tidal_vulnerability_p_status',
    valueA: damageTakenBonus,
    valueB: maxStacks,
    damageTakenMultiplierBonus: damageTakenBonus,
    stacks: 1,
    maxStacks,
    combatLogSource: tideCommand.combatLogSource,
    combatLogAbility: tideCommand.combatLogAbility,
  }

  return target === 'tank'
    ? { player: appendOrStackPlayerDebuff(player, baseStatus), party }
    : { player, party: appendOrStackPartyStatus(party, baseStatus) }
}

function applySpearBreachToTankHit(
  enemy: EnemyState,
  player: PlayerState,
  damageType: EnemySkillDamageType,
) {
  if (damageType !== 'physical' || enemy.row < 3) {
    return player
  }

  const spearBreach = enemy.statuses.find((status) =>
    status.effectLogicId === 'challenge_spear_breach_status' &&
    isStatusActive(status),
  )
  if (!spearBreach) {
    return player
  }

  const damageTakenBonus = getStatusValue(spearBreach, 'valueA', 0.12)
  const maxStacks = Math.max(1, Math.floor(getStatusValue(spearBreach, 'valueB', 3)))
  return appendOrStackPlayerDebuff(player, {
    id: 'challenge_spear_breach',
    iconId: 'challenge_spear_breach',
    label: '穿矛破口',
    shortLabel: '破口',
    remainingMs: 6000,
    totalMs: 6000,
    tone: 'danger',
    kind: 'playerDebuff',
    effectLogicId: 'challenge_spear_breach_player_status',
    valueA: damageTakenBonus,
    valueB: maxStacks,
    stacks: 1,
    maxStacks,
    combatLogSource: spearBreach.combatLogSource,
    combatLogAbility: spearBreach.combatLogAbility,
  })
}

interface PlayerAbsorbConsumption {
  statusId: string
  label: string
  amount: number
  fullyConsumed: boolean
}

function applyPlayerDamageWithAbsorbResult(
  player: PlayerState,
  amount: number,
  damageType: EnemySkillDamageType,
  options: { ignoreBuffDamageReduction?: boolean } = {},
) {
  if (amount <= 0) {
    return { player, absorbed: [] as PlayerAbsorbConsumption[] }
  }

  let remainingDamage = amount * (
    options.ignoreBuffDamageReduction ? 1 : getPlayerBuffDamageMultiplier(player, damageType)
  )
  const absorbed: PlayerAbsorbConsumption[] = []
  const nextBuffs = player.buffs.flatMap((status) => {
    if (status.id !== 'ignorePain' || !status.absorbRemaining || !status.absorbRatio) {
      return [status]
    }

    const absorbedAmount = Math.min(status.absorbRemaining, remainingDamage * status.absorbRatio)
    remainingDamage = Math.max(0, remainingDamage - absorbedAmount)
    const absorbRemaining = Math.max(0, status.absorbRemaining - absorbedAmount)

    if (absorbedAmount > 0) {
      absorbed.push({
        statusId: status.id,
        label: status.label,
        amount: absorbedAmount,
        fullyConsumed: absorbRemaining <= 0 && status.remainingMs > 0,
      })
    }

    return absorbRemaining > 0
      ? [
          {
            ...status,
            absorbRemaining,
          },
        ]
      : []
  })

  return {
    player: {
      ...player,
      hp: player.hp - remainingDamage,
      buffs: nextBuffs,
    },
    absorbed,
  }
}

function applyPlayerDamageWithAbsorb(
  player: PlayerState,
  amount: number,
  damageType: EnemySkillDamageType,
  options: { ignoreBuffDamageReduction?: boolean } = {},
) {
  return applyPlayerDamageWithAbsorbResult(player, amount, damageType, options).player
}

function createAbsorbConsumedEvents(
  occurredAtMs: number,
  seed: string,
  absorbed: readonly PlayerAbsorbConsumption[],
): CombatLogEvent[] {
  return absorbed.map((entry, index) => ({
    id: `${occurredAtMs}:absorb-consumed:${seed}:${entry.statusId}:${index}`,
    occurredAtMs,
    type: 'absorb-consumed',
    source: { kind: 'player', id: 'player', name: '玩家' },
    target: { kind: 'tank', id: 'tank', name: '坦克' },
    ability: { kind: 'status', id: entry.statusId, name: entry.label },
    amount: entry.amount,
    fullyConsumed: entry.fullyConsumed,
  }))
}

function applyPlayerDebuffContinuousEffects(
  player: PlayerState,
  deltaMs: number,
  activeStatusSource: PlayerState = player,
) {
  let nextPlayer = player

  if (deltaMs <= 0) {
    return nextPlayer
  }

  const battleHungerStatus = activeStatusSource.debuffs.find(
    (status) => status.effectLogicId === 'battleHunger_status' && isStatusActive(status),
  )
  if (battleHungerStatus) {
    nextPlayer = applyPlayerDamageWithAbsorb(
      nextPlayer,
      nextPlayer.maxHp * getStatusValue(battleHungerStatus, 'valueA', 0.05) * (deltaMs / 1000),
      'physical',
    )
  }

  const waxedStatus = activeStatusSource.debuffs.find(
    (status) => status.effectLogicId === 'waxed_status' && isStatusActive(status),
  )
  if (waxedStatus) {
    nextPlayer = applyPlayerDamageWithAbsorb(
      nextPlayer,
      getStatusValue(waxedStatus, 'valueA', 1) * (deltaMs / 1000),
      'magic',
    )
  }

  const trollRupturedStatus = activeStatusSource.debuffs.find(
    (status) => status.effectLogicId === 'trollRuptured_status' && isStatusActive(status),
  )
  if (trollRupturedStatus) {
    nextPlayer = applyPlayerDamageWithAbsorb(
      nextPlayer,
      getStatusValue(trollRupturedStatus, 'valueA', 3) * (deltaMs / 1000),
      'physical',
    )
  }

  return nextPlayer
}

function getPlayerContinuousDamageStatus(player: PlayerState) {
  return player.debuffs.find((status) =>
    isStatusActive(status) &&
    (
      status.effectLogicId === 'battleHunger_status' ||
      status.effectLogicId === 'waxed_status' ||
      status.effectLogicId === 'trollRuptured_status'
    ),
  )
}

function applyPlayerDebuffImmediateEffects(player: PlayerState) {
  let nextPlayer = player

  const hoeStatus = nextPlayer.debuffs.find((status) => status.effectLogicId === 'hoe_status' && isStatusActive(status))
  if (hoeStatus) {
    const hasWaxed = playerHasDebuffId(nextPlayer, 'waxed')
    nextPlayer = {
      ...(hasWaxed ? nextPlayer : applyPlayerDamageWithAbsorb(nextPlayer, getStatusValue(hoeStatus, 'valueA', 30), 'magic')),
      debuffs: nextPlayer.debuffs.filter((status) => status.id !== 'hoe' && (!hasWaxed || status.id !== 'waxed')),
    }
  }

  const murkEyeStatus = nextPlayer.debuffs.find((status) => status.effectLogicId === 'Murk-Eye_status' && isStatusActive(status))
  if (murkEyeStatus) {
    const fishCount = murkEyeStatus.stacks ?? 0
    nextPlayer = {
      ...applyPlayerDamageWithAbsorb(nextPlayer, fishCount * getStatusValue(murkEyeStatus, 'valueA', 5), 'physical'),
      debuffs: nextPlayer.debuffs.filter((status) => status.id !== 'Murk-Eye'),
    }
  }

  return nextPlayer
}

function applyPlayerDebuffOnApplyEffects(player: PlayerState, status: StatusEffect) {
  if (status.id === 'oldGrudged') {
    return {
      ...player,
      hp: Math.round(player.maxHp * getStatusValue(status, 'valueA', 0.5)),
      resource: Math.round(player.maxResource * getStatusValue(status, 'valueB', 0.5)),
    }
  }

  return player
}

function getPlayerMitigationDamageMultiplier(player: PlayerState, damageType: EnemySkillDamageType) {
  const mitigation = player.mitigation
  if (!mitigation) return 1
  if (typeof mitigation.damageReductionRatio === 'number') {
    return mitigation.damageReductionTypes?.includes(damageType)
      ? 1 - mitigation.damageReductionRatio
      : 1
  }
  return 0.62
}

function getBearTalentPlayerDamageMultiplier(
  passiveTalentIds: PassiveTalentId[],
  damageType: EnemySkillDamageType,
) {
  const modifiers = getPassiveModifiers(passiveTalentIds)
  return damageType === 'physical'
    ? 1 - modifiers.bearPhysicalDamageReduction
    : 1
}

function countElapsedStatusTicks(status: StatusEffect, deltaMs: number, fallbackIntervalMs: number) {
  const interval = status.tickIntervalMs ?? fallbackIntervalMs
  const total = status.totalMs ?? status.remainingMs
  const elapsedBefore = Math.max(0, total - status.remainingMs)
  const elapsedAfter = Math.min(total, elapsedBefore + deltaMs)
  return Math.max(0, Math.floor(elapsedAfter / interval) - Math.floor(elapsedBefore / interval))
}

function applyBearPlayerBuffContinuousEffects(
  player: PlayerState,
  party: EncounterState['party'],
  activeStatusSource: PlayerState,
  enemies: EnemyState[],
  passiveTalentIds: PassiveTalentId[],
  deltaMs: number,
) {
  if (deltaMs <= 0) return { player, party, effectivePlayerHealing: 0 }
  let nextPlayer = player
  let nextParty = party
  let effectivePlayerHealing = 0
  const healingMultiplier = getPlayerHealingReceivedMultiplier(activeStatusSource)
  for (const status of activeStatusSource.buffs) {
    if (!isStatusActive(status)) continue
    const elapsedTicks = countElapsedStatusTicks(status, deltaMs, 2000)
    if (elapsedTicks <= 0) continue
    const ratio = status.id === 'druid_bear_t_lunar_beam' ? 0.03 : status.id === 'druid_bear_t_frenzied_regeneration' ? 0.06 : status.id === 'druid_bear_t_regrowth' ? 0.03 : 0
    if (ratio <= 0) continue
    const amount = nextPlayer.maxHp * ratio * elapsedTicks * healingMultiplier
    const previousHp = nextPlayer.hp
    const nextHp = clampSuppressedHealing(
      previousHp,
      previousHp + amount,
      nextPlayer.maxHp,
      isPlayerHealingSuppressedByMurlocWatch(enemies),
    )
    effectivePlayerHealing += Math.max(0, nextHp - previousHp)
    nextPlayer = { ...nextPlayer, hp: nextHp }

    const regrowthPartyHealing = status.id === 'druid_bear_t_regrowth' && passiveTalentIds.includes('druid_bear_t_regrowth_of_the_pack')
      ? nextPlayer.maxHp * ratio * elapsedTicks * getBearTalentValue('druid_bear_t_regrowth_of_the_pack', 'valueA', 0.25)
      : 0
    const regenerativeBondHealing = status.id === 'druid_bear_t_frenzied_regeneration' &&
      passiveTalentIds.includes('druid_bear_t_regenerative_bond') &&
      status.remainingMs <= deltaMs
      ? getBearTalentValue('druid_bear_t_regenerative_bond', 'valueA', 5)
      : 0
    const rawPartyHealing = regrowthPartyHealing + regenerativeBondHealing
    if (rawPartyHealing > 0) {
      const previousPartyHp = nextParty.hp
      const nextPartyHp = clampSuppressedHealing(
        previousPartyHp,
        previousPartyHp + rawPartyHealing * getPartyHealingReceivedMultiplier(nextParty),
        nextParty.maxHp,
        isPartyHealingSuppressedByMurlocWatch(enemies),
      )
      nextParty = reducePartyPressureByEffectiveHealing(
        { ...nextParty, hp: nextPartyHp },
        Math.max(0, nextPartyHp - previousPartyHp),
      )
    }
  }
  return { player: nextPlayer, party: nextParty, effectivePlayerHealing }
}

function applyBearEnemyDotEffects(enemies: EnemyState[], activeStatusSource: EnemyState[], deltaMs: number) {
  return enemies.map((enemy) => {
    let hp = enemy.hp
    const sourceEnemy = activeStatusSource.find((entry) => entry.id === enemy.id)
    for (const status of sourceEnemy?.statuses ?? []) {
      if (status.id !== 'druid_bear_t_moonfire' || !isStatusActive(status)) continue
      const elapsedTicks = countElapsedStatusTicks(status, deltaMs, 3000)
      hp = Math.max(0, hp - elapsedTicks * getStatusValue(status, 'valueA', 6))
    }
    return { ...enemy, hp }
  })
}

function getBearMaxHpBuffMultiplier(player: PlayerState) {
  return player.buffs
    .filter((entry) => ['druid_bear_t_survival_instincts', 'druid_bear_t_lunar_beam', 'druid_bear_t_incarnation_ursoc', 'druid_bear_t_wild_recovery'].includes(entry.id) && isStatusActive(entry))
    .reduce((multiplier, entry) => multiplier * (1 + (entry.valueA ?? 0)), 1)
}

function applyBearWildRecoveryBuff(player: PlayerState) {
  const maxHpBonus = getBearTalentValue('druid_bear_t_wild_recovery', 'valueA', 0.1)
  const status = createPlayerBuildStatusEffect('druid_bear_t_wild_recovery')
  if (!status || player.buffs.some((entry) => entry.id === status.id && isStatusActive(entry))) return player
  const nextMaxHp = Math.round(player.maxHp * (1 + maxHpBonus))
  return {
    ...player,
    hp: player.maxHp > 0 ? (player.hp / player.maxHp) * nextMaxHp : nextMaxHp,
    maxHp: nextMaxHp,
    buffs: [...player.buffs.filter((entry) => entry.id !== status.id), { ...status, valueA: maxHpBonus }],
  }
}

function syncExpiredBearMaxHpBuffs(previous: PlayerState, current: PlayerState) {
  const previousMultiplier = getBearMaxHpBuffMultiplier(previous)
  const currentMultiplier = getBearMaxHpBuffMultiplier(current)
  if (previousMultiplier === currentMultiplier || previous.maxHp <= 0) return current
  const nextMaxHp = Math.round((previous.maxHp / previousMultiplier) * currentMultiplier)
  return {
    ...current,
    hp: (current.hp / current.maxHp) * nextMaxHp,
    maxHp: nextMaxHp,
  }
}

function applyBearBarkskinDispel(previous: PlayerState, current: PlayerState, passiveTalentIds: PassiveTalentId[]) {
  const expired = previous.buffs.some((status) => status.id === 'druid_bear_t_barkskin' && isStatusActive(status)) &&
    !current.buffs.some((status) => status.id === 'druid_bear_t_barkskin' && isStatusActive(status))
  if (!expired || !passiveTalentIds.includes('druid_bear_t_bark_dispelling')) return current
  return {
    ...current,
    debuffs: current.debuffs.filter((status) => {
      const playerDefinition = getPlayerBuildStatusDefinition(status.id)
      const enemyDefinition = getEnemyStatusDefinition(status.id)
      return !(playerDefinition?.dispellable || enemyDefinition?.isDispellable)
    }),
  }
}

function getEnemyOutgoingDamageMultiplier(enemy: EnemyState) {
  return enemy.statuses.reduce(
    (multiplier, status) => multiplier * (1 - (status.outgoingDamageReductionRatio ?? 0) * (status.stacks ?? 1)),
    getEnemyStatusOutgoingDamageMultiplier(enemy),
  )
}

function getMurlocUpgradedDamageBonus(enemy: EnemyState) {
  return enemy.statuses.reduce(
    (bonus, status) =>
      status.effectLogicId === 'murlocUpgraded_status' && isStatusActive(status)
        ? bonus + (status.stacks ?? 1) * getStatusValue(status, 'valueA', 1)
        : bonus,
    0,
  )
}

function getMarkedPhysicalDamageBonus(player: PlayerState, damageType: EnemySkillDamageType) {
  if (damageType !== 'physical') {
    return 0
  }

  const status = player.debuffs.find((entry) => entry.effectLogicId === 'marked_status' && isStatusActive(entry))
  return getStatusValue(status, 'valueA', status ? 1 : 0)
}

function getMurlocWatchingSuppressedSides(enemies: EnemyState[]) {
  return enemies.reduce(
    (sides, enemy) => {
      if (
        enemy.hp <= 0 ||
        !enemy.statuses.some(
          (status) => status.effectLogicId === 'murlocWatching_status' && isStatusActive(status),
        )
      ) {
        return sides
      }

      if (enemy.cast?.target === 'tank') {
        sides.player = true
      }

      if (enemy.cast?.target === 'party' || enemy.cast?.target === 'ally') {
        sides.party = true
      }

      return sides
    },
    { player: false, party: false },
  )
}

function isPlayerHealingSuppressedByMurlocWatch(enemies: EnemyState[]) {
  return getMurlocWatchingSuppressedSides(enemies).player
}

function isPartyHealingSuppressedByMurlocWatch(enemies: EnemyState[]) {
  return getMurlocWatchingSuppressedSides(enemies).party
}

function getPlayerOutgoingDamageMultiplierFromMurlocWatch(enemies: EnemyState[]) {
  const status = enemies
    .filter((enemy) => enemy.hp > 0 && enemy.cast?.target === 'tank')
    .flatMap((enemy) => enemy.statuses)
    .find((entry) => entry.effectLogicId === 'murlocWatching_status' && isStatusActive(entry))

  return status ? getStatusValue(status, 'valueA', 0.5) : 1
}

function getPartyOutgoingDamageMultiplierFromMurlocWatch(enemies: EnemyState[]) {
  const status = enemies
    .filter((enemy) => enemy.hp > 0 && (enemy.cast?.target === 'party' || enemy.cast?.target === 'ally'))
    .flatMap((enemy) => enemy.statuses)
    .find((entry) => entry.effectLogicId === 'murlocWatching_status' && isStatusActive(entry))

  return status ? getStatusValue(status, 'valueA', 0.5) : 1
}

function clampSuppressedHealing(
  previousHp: number,
  nextHp: number,
  maxHp: number,
  healingSuppressed: boolean,
) {
  const cappedHp = clamp(nextHp, 0, maxHp)
  return healingSuppressed && cappedHp > previousHp ? previousHp : cappedHp
}

function getLivingFishEnemyCount(enemies: EnemyState[]) {
  return enemies.filter(
    (enemy) =>
      enemy.hp > 0 &&
      (enemy.definitionId.startsWith('murloc') || enemy.definitionId.startsWith('coldlight')),
  ).length
}

function applyMurkEyePlayerEffect(player: PlayerState, enemies: EnemyState[]) {
  return applyPlayerDamageWithAbsorb(
    player,
    getLivingFishEnemyCount(enemies) * 5,
    'physical',
  )
}

function applyDamageTakenResourceGain(
  player: PlayerState,
  playerDamage: number,
  damageTakenResourceGainedInWindow: number,
) {
  const remainingWindowCapacity = Math.max(
    0,
    DAMAGE_TAKEN_RESOURCE_WINDOW_CAP - damageTakenResourceGainedInWindow,
  )
  const resourceGain = Math.min(
    remainingWindowCapacity,
    getDamageTakenResourceGain(playerDamage, player.classId),
  )

  return {
    player: changePlayerResource(player, resourceGain),
    damageTakenResourceGainedInWindow: damageTakenResourceGainedInWindow + resourceGain,
  }
}

function applyMurkEyePartyEffect(party: EncounterState['party'], enemies: EnemyState[]) {
  const damageAndPressure = getLivingFishEnemyCount(enemies) * 5
  return {
    ...party,
    hp: Math.max(0, party.hp - damageAndPressure),
    pressure: clamp(party.pressure + damageAndPressure, 0, party.maxPressure),
  }
}

function consumePlayerBuff(player: PlayerState, statusId: string) {
  return {
    ...player,
    buffs: player.buffs.filter((status) => status.id !== statusId),
  }
}

function consumePartyStatus(party: EncounterState['party'], statusId: string) {
  return {
    ...party,
    statuses: party.statuses.filter((status) => status.id !== statusId),
  }
}

function removePlayerDebuff(player: PlayerState, statusId: string) {
  return {
    ...player,
    debuffs: player.debuffs.filter((status) => status.id !== statusId),
  }
}

function appendOrReplacePartyStatus(party: EncounterState['party'], status: StatusEffect) {
  return {
    ...party,
    statuses:
      (status.maxStacks ?? 1) > 1
        ? appendOrStackStatusList(party.statuses, status)
        : replaceStatusList(party.statuses, status),
  }
}

function appendOrReplacePartyStatuses(
  party: EncounterState['party'],
  statuses: StatusEffect[],
) {
  return statuses.reduce((nextParty, status) => appendOrReplacePartyStatus(nextParty, status), party)
}

function applyPartyStatusImmediateEffects(party: EncounterState['party']) {
  let nextParty = party

  const hoeStatus = nextParty.statuses.find((status) => status.effectLogicId === 'hoe_p_status' && isStatusActive(status))
  if (hoeStatus) {
    const hasWaxed = partyHasStatusId(nextParty, 'waxed_p')
    nextParty = {
      ...(hasWaxed
        ? nextParty
        : {
            ...nextParty,
            hp: Math.max(0, nextParty.hp - getStatusValue(hoeStatus, 'valueA', 30)),
          }),
      statuses: nextParty.statuses.filter((status) => status.id !== 'hoe_p' && (!hasWaxed || status.id !== 'waxed_p')),
    }
  }

  const murkEyeStatus = nextParty.statuses.find((status) => status.effectLogicId === 'Murk-Eye_p_status' && isStatusActive(status))
  if (murkEyeStatus) {
    const fishCount = murkEyeStatus.stacks ?? 0
    const damage = fishCount * getStatusValue(murkEyeStatus, 'valueA', 5)
    const pressure = fishCount * getStatusValue(murkEyeStatus, 'valueB', getStatusValue(murkEyeStatus, 'valueA', 5))
    nextParty = {
      ...nextParty,
      hp: Math.max(0, nextParty.hp - damage),
      pressure: clamp(nextParty.pressure + pressure, 0, nextParty.maxPressure),
      statuses: nextParty.statuses.filter((status) => status.id !== 'Murk-Eye_p'),
    }
  }

  return nextParty
}

function applyPartyStatusContinuousEffects(
  party: EncounterState['party'],
  deltaMs: number,
  activeStatusSource: EncounterState['party'] = party,
) {
  const waxedStatus = activeStatusSource.statuses.find(
    (status) => status.effectLogicId === 'waxed_p_status' && isStatusActive(status),
  )
  const trollRupturedStatus = activeStatusSource.statuses.find(
    (status) => status.effectLogicId === 'trollRuptured_p_status' && isStatusActive(status),
  )

  if (deltaMs <= 0) {
    return party
  }

  let nextParty = party
  if (waxedStatus) {
    nextParty = {
      ...nextParty,
      hp: Math.max(0, nextParty.hp - getStatusValue(waxedStatus, 'valueA', 1) * (deltaMs / 1000)),
    }
  }
  if (trollRupturedStatus) {
    nextParty = {
      ...nextParty,
      hp: Math.max(0, nextParty.hp - getStatusValue(trollRupturedStatus, 'valueA', 3) * (deltaMs / 1000)),
    }
  }

  return {
    ...party,
    hp: nextParty.hp,
  }
}

function getPartyContinuousDamageStatus(party: EncounterState['party']) {
  return party.statuses.find((status) =>
    isStatusActive(status) &&
    (status.effectLogicId === 'waxed_p_status' || status.effectLogicId === 'trollRuptured_p_status'),
  )
}

function applyAffixStatusToEnemyTargets(
  enemies: EnemyState[],
  selector: string,
  status: StatusEffect,
) {
  const livingEnemies = enemies.filter((enemy) => enemy.hp > 0)

  if (selector === 'randomOne') {
    const target = livingEnemies[0]
    if (!target) {
      return enemies
    }

    return enemies.map((enemy) =>
      enemy.id === target.id ? appendOrReplaceEnemyStatus(enemy, status) : enemy,
    )
  }

  const targetIds = new Set(
    livingEnemies
      .filter((enemy) => {
        if (selector === 'all') {
          return true
        }
        if (selector === 'frontRow') {
          return enemy.row <= 2
        }
        if (selector === 'backRow') {
          return enemy.row >= 3
        }
        if (selector === 'skullOnly') {
          return enemy.isSkull
        }
        return false
      })
      .map((enemy) => enemy.id),
  )

  return enemies.map((enemy) =>
    targetIds.has(enemy.id) ? appendOrReplaceEnemyStatus(enemy, status) : enemy,
  )
}

function triggerPendingAffixes(
  state: EncounterState,
  deltaMs: number,
) {
  let nextPlayer = { ...state.player }
  let nextParty = { ...state.party }
  let nextEnemies = state.enemies.map((enemy) => ({
    ...enemy,
    skillIds: [...enemy.skillIds],
    skillCycle: [...enemy.skillCycle],
    statuses: enemy.statuses.map(cloneStatus),
    cast: cloneCast(enemy.cast),
    pendingRetryCastSkillId: enemy.pendingRetryCastSkillId,
  }))
  const remainingTriggers = []

  for (const trigger of state.runtime.pendingAffixTriggers) {
    const remainingMs = Math.max(0, trigger.remainingMs - deltaMs)

    if (remainingMs > 0) {
      remainingTriggers.push({
        ...trigger,
        remainingMs,
      })
      continue
    }

    const statusDefinition = buildStatusFromDefinition(trigger.statusId)
    if (!statusDefinition) {
      continue
    }

    const source = {
      kind: 'affix' as const,
      id: trigger.affixId,
      name: state.stage.affixes.find((affix) => affix.affixId === trigger.affixId)?.affixName ?? trigger.affixId,
    }
    const ability = {
      kind: 'affix' as const,
      id: trigger.affixId,
      name: source.name,
    }
    const status = {
      ...statusDefinition.status,
      combatLogSource: source,
      combatLogAbility: ability,
      ...(typeof trigger.valueA === 'number' ? { valueA: trigger.valueA } : {}),
      ...(typeof trigger.valueB === 'number' ? { valueB: trigger.valueB } : {}),
      ...(typeof trigger.tickIntervalMs === 'number' ? { tickIntervalMs: trigger.tickIntervalMs } : {}),
      ...(typeof trigger.durationMsOverride === 'number'
        ? {
            remainingMs: trigger.durationMsOverride,
            totalMs: trigger.durationMsOverride,
          }
        : {}),
    }

    if (trigger.targetType === 'player') {
      if (status.kind === 'enemyBuff') {
        nextPlayer = {
          ...nextPlayer,
          buffs: replaceStatusList(nextPlayer.buffs, {
            ...status,
            tone: 'buff',
            kind: 'neutral',
          }),
        }
      } else {
        nextPlayer = appendOrReplacePlayerDebuff(nextPlayer, status, state.passiveTalentIds)
      }
      continue
    }

    if (trigger.targetType === 'party') {
      nextParty = appendOrReplacePartyStatus(nextParty, status)
      continue
    }

    nextEnemies = applyAffixStatusToEnemyTargets(nextEnemies, trigger.targetSelector, status)
  }

  return {
    player: nextPlayer,
    party: nextParty,
    enemies: nextEnemies,
    pendingAffixTriggers: remainingTriggers,
  }
}

function applyThreatGain(enemy: EnemyState, tankThreatGain: number, allyThreatGain = 0): EnemyState {
  return normalizeEnemyBase({
    ...enemy,
    tankThreat: enemy.tankThreat + tankThreatGain,
    allyThreat: enemy.allyThreat + allyThreatGain,
  })
}

function normalizeCurrentTargetId(currentTargetId: string | null, enemies: EnemyState[]) {
  if (currentTargetId && enemies.some((enemy) => enemy.id === currentTargetId && enemy.hp > 0)) {
    return currentTargetId
  }

  return null
}

function scaleCurrentToNewMax(current: number, previousMax: number, nextMax: number) {
  if (previousMax <= 0) {
    return nextMax
  }

  return (current / previousMax) * nextMax
}

function getPeriodicStunTimer(selectedPassiveTalentIds: PassiveTalentId[], currentTimerMs: number) {
  const modifiers = getPassiveModifiers(selectedPassiveTalentIds)

  if (modifiers.periodicPlayerStunIntervalMs <= 0) {
    return 0
  }

  return currentTimerMs > 0 ? currentTimerMs : modifiers.periodicPlayerStunIntervalMs
}

function buildStatusFromDefinition(statusId: string) {
  const status = createEnemyStatusEffect(statusId)
  const definition = getEnemyStatusDefinition(statusId)

  if (!status || !definition) {
    return null
  }

  return {
    status,
    effectLogicId: definition.effectLogicId,
  }
}

function findEnemyCastTargetIndex(
  enemies: EnemyState[],
  casterIndex: number,
  targetRuleId: string,
  lockedEnemyTargetId: string | null = null,
) {
  if (targetRuleId === 'self') {
    return casterIndex
  }

  if (targetRuleId === 'mostInjured') {
    if (lockedEnemyTargetId) {
      const lockedTargetIndex = enemies.findIndex((enemy) => enemy.id === lockedEnemyTargetId && enemy.hp > 0)
      return lockedTargetIndex
    }

    const candidates = enemies
      .map((enemy, index) => ({ enemy, index }))
      .filter(({ enemy }) => enemy.hp > 0)
      .sort((left, right) => {
        const leftMissing = left.enemy.maxHp - left.enemy.hp
        const rightMissing = right.enemy.maxHp - right.enemy.hp
        return rightMissing - leftMissing || left.enemy.row - right.enemy.row || left.enemy.col - right.enemy.col
      })
    return candidates[0]?.index ?? casterIndex
  }

  if (targetRuleId !== 'otherEnemy') {
    return -1
  }

  if (lockedEnemyTargetId) {
    const lockedTargetIndex = enemies.findIndex((enemy, index) =>
      index !== casterIndex &&
      enemy.id === lockedEnemyTargetId &&
      enemy.hp > 0,
    )
    if (lockedTargetIndex >= 0) {
      return lockedTargetIndex
    }
  }

  const candidateIndex = enemies.findIndex((enemy, index) => index !== casterIndex && enemy.hp > 0)
  return candidateIndex >= 0 ? candidateIndex : casterIndex
}

function stopEnemyChannel(
  enemy: EnemyState,
  skillId: string,
  reason: EnemyChannelStopReason,
): EnemyState {
  const nextEnemy = applyEnemyStatusChannelStopEffects(enemy, { skillId, reason })
  return {
    ...nextEnemy,
    statuses: normalizeStatuses(nextEnemy.statuses),
  }
}

function advanceEnemySkillCycle(enemy: EnemyState) {
  if (enemy.pendingRetryCastSkillId) {
    return {
      ...enemy,
      pendingRetryCastSkillId: null,
    }
  }

  if (enemy.skillCycle.length === 0) {
    return enemy
  }

  const wrapped = enemy.skillCycleIndex + 1 >= enemy.skillCycle.length
  const nextSkillCycleIndex = (enemy.skillCycleIndex + 1) % enemy.skillCycle.length

  if (wrapped && enemy.threatLogic === 'irregular') {
    return {
      ...enemy,
      skillCycleIndex: nextSkillCycleIndex,
      tankThreat: 0,
      allyThreat: 0,
    }
  }

  return {
    ...enemy,
    skillCycleIndex: nextSkillCycleIndex,
  }
}

function resolveCompletedCast(
  enemyIndex: number,
  enemies: EnemyState[],
  player: PlayerState,
  party: EncounterState['party'],
  tuning: EncounterState['stage']['tuning'],
  partyAutoDamageMax: number,
  passiveTalentIds: PassiveTalentId[],
  damageTakenResourceGainedInWindow: number,
  occurredAtMs: number,
) {
  const currentEnemy = enemies[enemyIndex]
  const castId = currentEnemy.cast?.id
  const skillDefinition = castId ? getEnemySkillDefinition(castId) : undefined

  if (!currentEnemy.cast || !skillDefinition) {
    return { enemies, player, party, damageTakenResourceGainedInWindow, combatLogEvents: [] as CombatLogEvent[] }
  }

  const lockedCastTarget = currentEnemy.cast.target
  const castEventBase = {
    source: { kind: 'enemy' as const, id: currentEnemy.id, name: currentEnemy.name },
    ability: { kind: 'enemySkill' as const, id: skillDefinition.skillId, name: skillDefinition.skillName },
    castId: `${currentEnemy.id}:${skillDefinition.skillId}:${occurredAtMs - currentEnemy.cast.totalMs}`,
    enemyId: currentEnemy.id,
    enemySkillId: skillDefinition.skillId,
    dangerLevel: skillDefinition.dangerLevel,
    breakRule: skillDefinition.castBreakRule,
  }
  const combatLogEvents: CombatLogEvent[] = []

  if (getCastPhase(currentEnemy.cast) === 'channeling') {
    const nextEnemies = enemies.map((enemy, index) => {
      if (index !== enemyIndex) {
        return enemy
      }

      return advanceEnemySkillCycle({
        ...stopEnemyChannel(enemy, skillDefinition.skillId, 'completed'),
        cast: null,
        recoveryRemainingMs: skillDefinition.recoveryMs,
        pendingRetryCastSkillId: null,
      })
    })

    return {
      enemies: nextEnemies.map((enemy) => normalizeEnemy(enemy, player, party, partyAutoDamageMax)),
      player,
      party,
      damageTakenResourceGainedInWindow,
      combatLogEvents: [
        {
          id: `${occurredAtMs}:cast-resolved:${currentEnemy.id}:${skillDefinition.skillId}:channel`,
          occurredAtMs,
          type: 'cast-resolved',
          ...castEventBase,
          target: getCombatLogTargetForCastTarget(lockedCastTarget),
        } satisfies CombatLogEvent,
      ],
    }
  }

  const modifiers = getPassiveModifiers(passiveTalentIds)
  const enemyOutgoingDamageMultiplier =
    getEnemyOutgoingDamageMultiplier(currentEnemy) *
    getEnemyMagicDamageMultiplier(currentEnemy, skillDefinition.damageType)
  const damageTakenMultiplier =
    getPlayerMitigationDamageMultiplier(player, skillDefinition.damageType) *
    getBearTalentPlayerDamageMultiplier(passiveTalentIds, skillDefinition.damageType) *
    modifiers.playerDamageTakenMultiplier *
    tuning.enemyDamageMultiplier *
    enemyOutgoingDamageMultiplier *
    getPlayerDamageTakenMultiplierFromDebuffs(player, skillDefinition.damageType)
  const scalePartyDamage = (value: number) =>
    Math.round(
      value *
      tuning.enemyDamageMultiplier *
      enemyOutgoingDamageMultiplier *
      getPartyDamageTakenMultiplierFromStatuses(party, skillDefinition.damageType),
    )
  const scalePressure = (value: number) => Math.round(value * tuning.enemyDamageMultiplier)

  let nextEnemies = enemies.map((enemy, index) =>
    index === enemyIndex
      ? {
          ...enemy,
          cast: null,
          recoveryRemainingMs: skillDefinition.channelingMs > 0 ? 0 : skillDefinition.recoveryMs,
          pendingRetryCastSkillId: null,
          skillCycleIndex: enemy.skillCycleIndex,
        }
      : enemy,
  )
  let nextPlayer: PlayerState = { ...player }
  let nextParty: EncounterState['party'] = { ...party }
  let playerPortionReflected = false

  const appliesTankAndPartyStatuses = skillDefinition.targetRuleId === 'tankAndParty'
  const didHitPlayer =
    (skillDefinition.targetRuleId === 'threatTarget' && lockedCastTarget === 'tank') ||
    (skillDefinition.targetRuleId === 'self' && skillDefinition.playerDamage > 0)
  const partyDamage =
    skillDefinition.targetRuleId === 'threatTarget'
      ? didHitPlayer
        ? skillDefinition.partyDamageOnHit
        : skillDefinition.partyDamageOnMiss
      : skillDefinition.partyDamageOnMiss
  const partyPressure =
    skillDefinition.targetRuleId === 'threatTarget'
      ? didHitPlayer
        ? skillDefinition.pressureOnHit
        : skillDefinition.pressureOnMiss
      : skillDefinition.pressureOnMiss

  if (didHitPlayer && skillDefinition.playerDamage > 0) {
    const previousPlayerHp = nextPlayer.hp
    const reflectedDamage =
      skillDefinition.playerDamage * tuning.enemyDamageMultiplier * enemyOutgoingDamageMultiplier
    const shieldReflection = nextPlayer.buffs.find((status) => status.id === 'shieldReflection')
    const shieldReflectionSkillId = shieldReflection?.combatLogAbility?.kind === 'playerSkill'
      ? shieldReflection.combatLogAbility.id
      : 'warrior_t_shield_reflection'
    const shieldReflectionTags = getActiveSkillDefinition(shieldReflectionSkillId)?.skillTags ?? []
    const canShieldReflectionImmune =
      Boolean(shieldReflection) &&
      skillDefinition.damageType === 'magic' &&
      shieldReflectionTags.includes('immune')
    const canShieldReflectionReflect =
      Boolean(shieldReflection) &&
      skillDefinition.damageType === 'magic' &&
      shieldReflectionTags.includes('reflect')

    const damageTakenResourceResult = applyDamageTakenResourceGain(
      nextPlayer,
      skillDefinition.playerDamage,
      damageTakenResourceGainedInWindow,
    )
    nextPlayer = damageTakenResourceResult.player
    damageTakenResourceGainedInWindow = damageTakenResourceResult.damageTakenResourceGainedInWindow

    if (shieldReflection && (canShieldReflectionImmune || canShieldReflectionReflect)) {
      const reflectionSource = shieldReflection.combatLogSource ?? { kind: 'player' as const, id: 'player', name: '玩家' }
      const reflectionAbility = shieldReflection.combatLogAbility ?? {
        kind: 'playerSkill' as const,
        id: shieldReflectionSkillId,
        name: getActiveSkillDefinition(shieldReflectionSkillId)?.name,
      }
      const actualReflectedDamage = canShieldReflectionReflect
        ? Math.min(currentEnemy.hp, reflectedDamage)
        : 0
      playerPortionReflected = canShieldReflectionImmune
      nextPlayer = consumePlayerBuff(nextPlayer, 'shieldReflection')
      if (canShieldReflectionImmune && reflectedDamage > 0) {
        combatLogEvents.push({
          id: `${occurredAtMs}:absorb-created:${currentEnemy.id}:${skillDefinition.skillId}:shield-reflection`,
          occurredAtMs,
          type: 'absorb-created',
          source: reflectionSource,
          target: { kind: 'tank', id: 'tank', name: '坦克' },
          ability: reflectionAbility,
          amount: reflectedDamage,
        })
      }
      if (canShieldReflectionReflect && actualReflectedDamage > 0) {
        combatLogEvents.push({
          id: `${occurredAtMs}:damage:${currentEnemy.id}:${skillDefinition.skillId}:shield-reflection`,
          occurredAtMs,
          type: 'damage',
          source: reflectionSource,
          target: { kind: 'enemy', id: currentEnemy.id, name: currentEnemy.name },
          ability: reflectionAbility,
          amount: actualReflectedDamage,
          damageType: skillDefinition.damageType,
        })
        nextEnemies = nextEnemies.map((enemy, index) =>
          index === enemyIndex
            ? cleanupDeadEnemy({
                ...enemy,
                hp: Math.max(0, enemy.hp - reflectedDamage),
              })
            : enemy,
        )
      }
    } else {
      const upgradedDamageBonus = getMurlocUpgradedDamageBonus(currentEnemy)
      const markedDamageBonus = getMarkedPhysicalDamageBonus(nextPlayer, skillDefinition.damageType)
      const absorbResult = applyPlayerDamageWithAbsorbResult(
        nextPlayer,
        skillDefinition.playerDamage * damageTakenMultiplier + upgradedDamageBonus + markedDamageBonus,
        skillDefinition.damageType,
      )
      nextPlayer = absorbResult.player
      combatLogEvents.push(
        ...createAbsorbConsumedEvents(
          occurredAtMs,
          `${currentEnemy.id}:${skillDefinition.skillId}:tank`,
          absorbResult.absorbed,
        ),
      )
      const dealtDamage = Math.max(0, previousPlayerHp - nextPlayer.hp)
      if (dealtDamage > 0) {
        const sleeper = nextPlayer.buffs.find((status) => status.id === 'druid_bear_t_rage_of_the_sleeper' && isStatusActive(status))
        if (sleeper) {
          const retaliationDamage = dealtDamage * getStatusValue(sleeper, 'valueB', 0.25)
          nextEnemies = nextEnemies.map((enemy, index) => index === enemyIndex
            ? cleanupDeadEnemy(applyThreatGain({ ...enemy, hp: Math.max(0, enemy.hp - retaliationDamage) }, retaliationDamage * 5))
            : enemy)
          combatLogEvents.push({
            id: `${occurredAtMs}:damage:${currentEnemy.id}:druid_bear_t_rage_of_the_sleeper:retaliation`,
            occurredAtMs,
            type: 'damage',
            source: { kind: 'player', id: 'player', name: '玩家' },
            target: { kind: 'enemy', id: currentEnemy.id, name: currentEnemy.name },
            ability: { kind: 'playerSkill', id: 'druid_bear_t_rage_of_the_sleeper', name: '沉睡者之怒' },
            amount: retaliationDamage,
            damageType: 'physical',
          })
        }
        nextPlayer = applySpearBreachToTankHit(
          currentEnemy,
          nextPlayer,
          skillDefinition.damageType,
        )
        const vulnerabilityResult = applyTideCommandVulnerabilityToHitTarget(
          currentEnemy,
          nextPlayer,
          nextParty,
          'tank',
        )
        nextPlayer = vulnerabilityResult.player
        nextParty = vulnerabilityResult.party
        combatLogEvents.push({
          id: `${occurredAtMs}:damage:${currentEnemy.id}:${skillDefinition.skillId}:tank`,
          occurredAtMs,
          type: 'damage',
          ...castEventBase,
          target: { kind: 'tank', id: 'tank', name: '坦克' },
          amount: dealtDamage,
          damageType: skillDefinition.damageType,
        })
      }
    }
  }

  if (partyDamage > 0 || partyPressure > 0) {
    const previousPartyHp = nextParty.hp
    const previousPressure = nextParty.pressure
    const scaledPartyDamage = scalePartyDamage(partyDamage)
    const intervened = nextParty.statuses.find((status) => status.id === 'intervened')
    const pressureBonus = getPartyHitPressureBonus(nextParty)

    nextParty = {
      ...nextParty,
      hp: clamp(nextParty.hp - (intervened ? 0 : scaledPartyDamage), 0, nextParty.maxHp),
      pressure: clamp(
        nextParty.pressure + scalePressure(partyPressure) + pressureBonus,
        0,
        nextParty.maxPressure,
      ),
    }

    if (intervened && scaledPartyDamage > 0) {
      const absorbResult = applyPlayerDamageWithAbsorbResult(
        nextPlayer,
        scaledPartyDamage,
        skillDefinition.damageType,
        { ignoreBuffDamageReduction: true },
      )
      nextPlayer = absorbResult.player
      combatLogEvents.push(
        ...createAbsorbConsumedEvents(
          occurredAtMs,
          `${currentEnemy.id}:${skillDefinition.skillId}:intervene`,
          absorbResult.absorbed,
        ),
      )
      nextParty = consumePartyStatus(nextParty, 'intervened')
    }
    if (!intervened && scaledPartyDamage > 0) {
      const vulnerabilityResult = applyTideCommandVulnerabilityToHitTarget(
        currentEnemy,
        nextPlayer,
        nextParty,
        'party',
      )
      nextPlayer = vulnerabilityResult.player
      nextParty = vulnerabilityResult.party
    }
    const dealtPartyDamage = Math.max(0, previousPartyHp - nextParty.hp)
    if (dealtPartyDamage > 0) {
      combatLogEvents.push({
        id: `${occurredAtMs}:damage:${currentEnemy.id}:${skillDefinition.skillId}:party`,
        occurredAtMs,
        type: 'damage',
        ...castEventBase,
        target: { kind: 'party', id: 'party', name: '队伍' },
        amount: dealtPartyDamage,
        damageType: skillDefinition.damageType,
      })
    }
    const pressureGained = Math.max(0, nextParty.pressure - previousPressure)
    if (pressureGained > 0) {
      combatLogEvents.push({
        id: `${occurredAtMs}:pressure:${currentEnemy.id}:${skillDefinition.skillId}:party`,
        occurredAtMs,
        type: 'pressure',
        ...castEventBase,
        target: { kind: 'party', id: 'party', name: '队伍' },
        amount: pressureGained,
      })
    }
  }

  for (const statusId of skillDefinition.appliedTargetStatusIds) {
    const resolved = buildStatusFromDefinition(statusId)
    if (!resolved) {
      continue
    }
    const status = {
      ...resolved.status,
      combatLogSource: castEventBase.source,
    }

    if (status.kind === 'playerDebuff' && (didHitPlayer || appliesTankAndPartyStatuses) && !playerPortionReflected) {
      const previousStatusPlayer = nextPlayer
      nextPlayer =
        status.effectLogicId === 'Murk-Eye_status'
          ? applyMurkEyePlayerEffect(nextPlayer, nextEnemies)
          : applyPlayerDebuffImmediateEffects(appendOrReplacePlayerDebuff(nextPlayer, status, passiveTalentIds))
      combatLogEvents.push(
        ...createPlayerStatusImmediateEvents(
          occurredAtMs,
          `${currentEnemy.id}:${skillDefinition.skillId}:${status.id}`,
          status,
          previousStatusPlayer,
          nextPlayer,
        ),
      )
      continue
    }

    if (
      status.kind === 'partyDebuff' &&
      (
        skillDefinition.targetRuleId === 'party' ||
        appliesTankAndPartyStatuses ||
        (skillDefinition.targetRuleId === 'threatTarget' && !didHitPlayer)
      )
    ) {
      const previousStatusParty = nextParty
      nextParty =
        status.effectLogicId === 'Murk-Eye_p_status'
          ? applyMurkEyePartyEffect(nextParty, nextEnemies)
          : applyPartyStatusImmediateEffects(appendOrReplacePartyStatus(nextParty, status))
      combatLogEvents.push(
        ...createPartyStatusImmediateEvents(
          occurredAtMs,
          `${currentEnemy.id}:${skillDefinition.skillId}:${status.id}`,
          status,
          previousStatusParty,
          nextParty,
        ),
      )
      continue
    }

    if (status.kind === 'enemyBuff') {
      const targetIndex = findEnemyCastTargetIndex(
        nextEnemies,
        enemyIndex,
        skillDefinition.targetRuleId,
        currentEnemy.cast.lockedEnemyTargetId ?? null,
      )

      if (targetIndex >= 0) {
        const enemyWithStatus = appendOrReplaceEnemyStatus(nextEnemies[targetIndex], status)
        const statusApplyResult = applyEnemyStatusOnApplyWithTelemetry(
          enemyWithStatus,
          status,
          resolved.effectLogicId,
          tuning,
          occurredAtMs,
        )
        combatLogEvents.push(...statusApplyResult.combatLogEvents)
        nextEnemies = nextEnemies.map((enemy, index) =>
          index === targetIndex
            ? normalizeEnemy(statusApplyResult.enemy, nextPlayer, nextParty, partyAutoDamageMax)
            : enemy,
        )
      }
    }
  }

  for (const statusId of skillDefinition.appliedSelfStatusIds) {
    const resolved = buildStatusFromDefinition(statusId)
    if (!resolved || resolved.status.kind !== 'enemyBuff') {
      continue
    }

    const status =
      skillDefinition.channelingMs > 0
        ? {
            ...resolved.status,
            channelSourceSkillId: skillDefinition.skillId,
            combatLogSource: castEventBase.source,
          }
        : {
            ...resolved.status,
            combatLogSource: castEventBase.source,
          }
    const enemyWithStatus = appendOrReplaceEnemyStatus(nextEnemies[enemyIndex], status)
    const statusApplyResult = applyEnemyStatusOnApplyWithTelemetry(
      enemyWithStatus,
      status,
      resolved.effectLogicId,
      tuning,
      occurredAtMs,
    )
    combatLogEvents.push(...statusApplyResult.combatLogEvents)

    nextEnemies = nextEnemies.map((enemy, index) =>
      index === enemyIndex
        ? normalizeEnemy(statusApplyResult.enemy, nextPlayer, nextParty, partyAutoDamageMax)
        : enemy,
    )
  }

  if (skillDefinition.channelingMs > 0) {
    nextEnemies = nextEnemies.map((enemy, index) =>
      index === enemyIndex
        ? {
            ...enemy,
            cast: createCast(
              skillDefinition.skillId,
              skillDefinition.skillName,
              lockedCastTarget,
              Math.max(0, skillDefinition.channelingMs),
              skillDefinition.castBreakRule,
              skillDefinition.dangerLevel,
              'channeling',
            ),
            recoveryRemainingMs: 0,
            pendingRetryCastSkillId: null,
          }
        : enemy,
    )

    return {
      enemies: nextEnemies.map((enemy) => normalizeEnemy(enemy, nextPlayer, nextParty, partyAutoDamageMax)),
      player: nextPlayer,
      party: nextParty,
      damageTakenResourceGainedInWindow,
      combatLogEvents: [
        ...combatLogEvents,
        {
          id: `${occurredAtMs}:cast-resolved:${currentEnemy.id}:${skillDefinition.skillId}`,
          occurredAtMs,
          type: 'cast-resolved',
          ...castEventBase,
          target: getCombatLogTargetForCastTarget(lockedCastTarget),
        } satisfies CombatLogEvent,
      ],
    }
  }

  nextEnemies = nextEnemies.map((enemy, index) =>
    index === enemyIndex
      ? advanceEnemySkillCycle(enemy)
      : enemy,
  )

  return {
    enemies: nextEnemies.map((enemy) => normalizeEnemy(enemy, nextPlayer, nextParty, partyAutoDamageMax)),
    player: nextPlayer,
    party: nextParty,
    damageTakenResourceGainedInWindow,
    combatLogEvents: [
      ...combatLogEvents,
      {
        id: `${occurredAtMs}:cast-resolved:${currentEnemy.id}:${skillDefinition.skillId}`,
        occurredAtMs,
        type: 'cast-resolved',
        ...castEventBase,
        target: getCombatLogTargetForCastTarget(lockedCastTarget),
      } satisfies CombatLogEvent,
    ],
  }
}

function skillNeedsTarget(skillId: SkillId) {
  const definition = getActiveSkillDefinition(skillId)
  return definition ? playerSkillNeedsEnemyTarget(definition.targetingType) : true
}

export function playerSkillNeedsEnemyTarget(targetingType: string) {
  return (
    targetingType === 'currentEnemy' ||
    targetingType === 'crossEnemy' ||
    targetingType === 'matrix3x3Enemy' ||
    targetingType === 'topLeft2x2Enemy' ||
    targetingType === 'allEnemy'
  )
}

function isAllEnemyInterruptSkill(skillId: SkillId) {
  const definition = getActiveSkillDefinition(skillId)
  return definition?.castStopMode === 'interrupt' && definition.targetingType === 'allEnemy'
}

function getInterruptTargetValidationError(state: EncounterState, skillId: SkillId) {
  const definition = getActiveSkillDefinition(skillId)
  if (!definition || definition.castStopMode !== 'interrupt' || definition.targetingType === 'allEnemy') {
    return null
  }

  if (!state.player.currentTargetId) {
    return '请先选择一个敌方目标。'
  }

  const targetEnemy = state.enemies.find((enemy) => enemy.id === state.player.currentTargetId)
  if (!targetEnemy || targetEnemy.hp <= 0 || !canPlayerSkillAffectEnemy(targetEnemy, skillId)) {
    return '请选择一个有效的敌方目标。'
  }

  return null
}

export function getSkillActivationBlockReason(state: EncounterState, skillId: SkillId) {
  if (state.result) {
    return '战斗已结束，无法继续施放技能。'
  }

  if (state.runtime.pauseOverlay) {
    return '战斗已暂停，无法继续施放技能。'
  }

  if (playerHasDebuff(state.player, 'stunned') && skillId !== 'druid_bear_t_berserk') {
    return '玩家当前处于眩晕状态，无法施放技能。'
  }

  const modifiers = getPassiveModifiers(state.passiveTalentIds)
  const skill = state.skills.find((entry) => entry.id === skillId)
  const skillDefinition = getActiveSkillDefinition(skillId)

  if (!skill || !skillDefinition) {
    return '该技能当前不可用。'
  }

  const interruptTargetError = getInterruptTargetValidationError(state, skillId)
  if (interruptTargetError) {
    return interruptTargetError
  }

  if (skillNeedsTarget(skillId) && !state.player.currentTargetId && !isAllEnemyInterruptSkill(skillId)) {
    return '请先选择一个敌方目标。'
  }

  if ((skill.selfCooldownRemainingMs ?? 0) > 0) {
    return `${skill.name} 仍在冷却中。`
  }

  if ((skill.maxCharges ?? 1) <= 1 && skill.remainingCooldownMs > 0) {
    return `${skill.name} 仍在冷却中。`
  }

  if ((skill.maxCharges ?? 1) > 1 && (skill.currentCharges ?? skill.maxCharges ?? 1) <= 0) {
    return `${skill.name} 仍在冷却中。`
  }

  if (state.player.resource < skill.resourceCost) {
    return `${skill.name} 所需资源不足。`
  }

  if (!modifiers.interruptIgnoresGcd && skill.gcdMs > 0 && state.player.gcdRemainingMs > 0) {
    return '公共冷却中，暂时无法施放该技能。'
  }

  return null
}

function withCurrentTarget(state: EncounterState, mutate: (enemy: EnemyState) => EnemyState) {
  if (!state.player.currentTargetId) {
    return state
  }

  return {
    ...state,
    enemies: state.enemies.map((enemy) =>
      enemy.id === state.player.currentTargetId ? mutate(enemy) : enemy,
    ),
  }
}

function withTargetIds(
  state: EncounterState,
  targetIds: Set<string>,
  mutate: (enemy: EnemyState) => EnemyState,
) {
  return {
    ...state,
    enemies: state.enemies.map((enemy) => (targetIds.has(enemy.id) ? mutate(enemy) : enemy)),
  }
}

function getCrossTargetIds(state: EncounterState) {
  return resolveEnemyTargetIdsBySelector(state, 'cross')
}

function getCurrentTargetEnemy(state: EncounterState) {
  if (!state.player.currentTargetId) {
    return null
  }

  return state.enemies.find((enemy) => enemy.id === state.player.currentTargetId) ?? null
}

function getLivingEnemyByGridPosition(state: EncounterState, row: number, col: number) {
  return state.enemies.find((enemy) => enemy.row === row && enemy.col === col && isEnemyAlive(enemy)) ?? null
}

export function resolveEnemyTargetIdsBySelector(state: EncounterState, selector: string) {
  const currentTarget = getCurrentTargetEnemy(state)
  const livingEnemies = getLivingEnemies(state.enemies)

  if (selector === 'allEnemy') {
    return new Set(livingEnemies.map((enemy) => enemy.id))
  }

  if (!currentTarget || !isEnemyAlive(currentTarget)) {
    return new Set<string>()
  }

  if (selector === 'current') {
    return new Set([currentTarget.id])
  }

  const targetIds = new Set<string>()
  const pushIfLiving = (row: number, col: number) => {
    const enemy = getLivingEnemyByGridPosition(state, row, col)
    if (enemy) {
      targetIds.add(enemy.id)
    }
  }

  if (selector === 'cross') {
    pushIfLiving(currentTarget.row, currentTarget.col)
    pushIfLiving(currentTarget.row - 1, currentTarget.col)
    pushIfLiving(currentTarget.row + 1, currentTarget.col)
    pushIfLiving(currentTarget.row, currentTarget.col - 1)
    pushIfLiving(currentTarget.row, currentTarget.col + 1)
    return targetIds
  }

  if (selector === 'mostInjuredEnemy') {
    const mostInjured = [...livingEnemies].sort((left, right) => {
      const leftMissing = left.maxHp - left.hp
      const rightMissing = right.maxHp - right.hp
      return rightMissing - leftMissing || left.row - right.row || left.col - right.col
    })[0]

    return mostInjured ? new Set([mostInjured.id]) : new Set<string>()
  }

  if (selector === 'adjacent') {
    pushIfLiving(currentTarget.row, currentTarget.col)
    pushIfLiving(currentTarget.row, currentTarget.col - 1)
    pushIfLiving(currentTarget.row, currentTarget.col + 1)
    return targetIds
  }

  if (selector === 'matrix3x3') {
    for (let row = currentTarget.row - 1; row <= currentTarget.row + 1; row += 1) {
      for (let col = currentTarget.col - 1; col <= currentTarget.col + 1; col += 1) {
        pushIfLiving(row, col)
      }
    }
    return targetIds
  }

  if (selector === 'topLeft2x2') {
    for (let row = currentTarget.row; row <= currentTarget.row + 1; row += 1) {
      for (let col = currentTarget.col; col <= currentTarget.col + 1; col += 1) {
        pushIfLiving(row, col)
      }
    }
    return targetIds
  }

  return new Set([currentTarget.id])
}

function getPassivePartyStatuses(passiveTalentIds: PassiveTalentId[]) {
  return passiveTalentIds.flatMap((talentId) =>
    getStatusesForTalent(talentId)
      .filter(
        (definition) =>
          (definition.statusCategory === 'partyBuff' || definition.statusCategory === 'partyDebuff') &&
          !['druid_bear_t_pack_presence', 'druid_bear_t_ursoc_shelter'].includes(definition.statusId),
      )
      .map((definition) => createPlayerBuildStatusEffect(definition.statusId))
      .filter((status): status is StatusEffect => Boolean(status)),
  )
}

export function applyBuildConfiguration(
  state: EncounterState,
  loadout: SkillLoadout,
  passiveTalentIds: PassiveTalentId[],
) {
  const modifiers = getPassiveModifiers(passiveTalentIds)
  const passivePartyStatuses = getPassivePartyStatuses(passiveTalentIds)
  const nextPlayerMaxHp = Math.round(
    state.stage.playerMaxHp * modifiers.playerMaxHpMultiplier + modifiers.playerMaxHpBonus,
  )
  const nextPlayerMaxResource = 100 + modifiers.playerMaxResourceBonus
  const nextPartyMaxHp = Math.round(state.stage.partyMaxHp * modifiers.partyMaxHpMultiplier)
  const nextPartyMaxPressure = Math.round(
    state.stage.partyMaxPressure * modifiers.partyMaxPressureMultiplier + modifiers.partyMaxPressureBonus,
  )
  const nextPartyStatuses = appendOrReplacePartyStatuses(
    {
      ...state.party,
      statuses: state.party.statuses.map(cloneStatus),
    },
    passivePartyStatuses,
  ).statuses

  return finalizeEncounterState({
    ...state,
    passiveTalentIds,
    runtime: {
      ...state.runtime,
      periodicPlayerStunRemainingMs: getPeriodicStunTimer(
        passiveTalentIds,
        state.runtime.periodicPlayerStunRemainingMs,
      ),
      pendingAffixTriggers: state.runtime.pendingAffixTriggers.map(clonePendingAffixTrigger),
      partyAutoDamageRemainingMs: state.runtime.partyAutoDamageRemainingMs,
      partyPressureNoGainMs: state.runtime.partyPressureNoGainMs,
      partyPressureLastValue: Math.min(state.runtime.partyPressureLastValue, nextPartyMaxPressure),
      damageSources: buildRuntimeDamageSources(
        state.stage,
        state.runtime.damageSources,
        state.player.currentTargetId,
        state.party.currentTargetId,
      ),
      pauseOverlay: state.runtime.pauseOverlay,
    },
    player: {
      ...state.player,
      hp: scaleCurrentToNewMax(state.player.hp, state.player.maxHp, nextPlayerMaxHp),
      maxHp: nextPlayerMaxHp,
      resource: scaleCurrentToNewMax(
        state.player.resource,
        state.player.maxResource,
        nextPlayerMaxResource,
      ),
      maxResource: nextPlayerMaxResource,
      buffs: modifiers.playerPassiveBuffs.map(cloneStatus),
    },
    party: {
      ...state.party,
      hp: scaleCurrentToNewMax(state.party.hp, state.party.maxHp, nextPartyMaxHp),
      maxHp: nextPartyMaxHp,
      pressure: scaleCurrentToNewMax(
        state.party.pressure,
        state.party.maxPressure,
        nextPartyMaxPressure,
      ),
      maxPressure: nextPartyMaxPressure,
      statuses: nextPartyStatuses,
    },
    skills: buildSkillsFromLoadout(loadout, passiveTalentIds, state.skills),
  })
}

function syncBearConditionalTalentStatuses(state: EncounterState): EncounterState {
  const hasMoonfire = state.enemies.some((enemy) =>
    enemy.hp > 0 && enemy.statuses.some((status) => status.id === 'druid_bear_t_moonfire' && isStatusActive(status)),
  )
  const moonlit = createPlayerBuildStatusEffect('druid_bear_t_moonlit_resolve')
  const hasPackPresence = state.player.mitigation?.id === 'druid_bear_t_ironfur' &&
    (state.player.mitigation.stacks ?? 0) >= 2
  const packPresence = createPlayerBuildStatusEffect('druid_bear_t_pack_presence')
  const guardianThreshold = getBearTalentValue('druid_bear_t_guardian_of_the_grove', 'valueB', 0.8)
  const hasGuardian = state.player.maxHp > 0 && state.player.hp / state.player.maxHp > guardianThreshold
  const guardian = createPlayerBuildStatusEffect('druid_bear_t_guardian_of_the_grove')
  return {
    ...state,
    player: {
      ...state.player,
      buffs: [
        ...state.player.buffs.filter((status) => status.id !== 'druid_bear_t_moonlit_resolve'),
        ...(hasMoonfire && state.passiveTalentIds.includes('druid_bear_t_moonlit_resolve') && moonlit
          ? [{ ...moonlit, damageReductionRatio: getBearTalentValue('druid_bear_t_moonlit_resolve', 'valueA', 0.05), damageReductionTypes: ['physical', 'magic'] as EnemySkillDamageType[] }]
          : []),
      ],
    },
    party: {
      ...state.party,
      statuses: [
        ...state.party.statuses.filter((status) => !['druid_bear_t_pack_presence', 'druid_bear_t_guardian_of_the_grove'].includes(status.id)),
        ...(hasPackPresence && state.passiveTalentIds.includes('druid_bear_t_pack_presence') && packPresence
          ? [{ ...packPresence, damageTakenMultiplierBonus: -getBearTalentValue('druid_bear_t_pack_presence', 'valueA', 0.08) }]
          : []),
        ...(hasGuardian && state.passiveTalentIds.includes('druid_bear_t_guardian_of_the_grove') && guardian
          ? [{ ...guardian, damageTakenMultiplierBonus: -getBearTalentValue('druid_bear_t_guardian_of_the_grove', 'valueA', 0.06) }]
          : []),
      ],
    },
  }
}

function applyBearLastStand(state: EncounterState): EncounterState {
  if (
    state.player.hp > 0 ||
    !state.passiveTalentIds.includes('druid_bear_t_last_bear_stand') ||
    (state.runtime.classRuntime.lastBearStandUsed ?? 0) > 0
  ) {
    return state
  }
  const ironfur = createPlayerBuildStatusEffect('druid_bear_t_ironfur', 8000)
  return {
    ...state,
    player: {
      ...state.player,
      hp: 1,
      mitigation: ironfur
        ? { ...ironfur, stacks: 1, maxStacks: 3, damageReductionRatio: 0.15, damageReductionTypes: ['physical'] }
        : state.player.mitigation,
    },
    runtime: {
      ...state.runtime,
      classRuntime: { ...state.runtime.classRuntime, lastBearStandUsed: 1 },
    },
    result: null,
  }
}

function finalizeEncounterState(state: EncounterState): EncounterState {
  state = applyBearLastStand(state)
  state = syncBearConditionalTalentStatuses(state)
  const immediatePlayer = applyPlayerDebuffImmediateEffects(state.player)
  const immediateParty = applyPartyStatusImmediateEffects(state.party)
  const nextPlayer = {
    ...immediatePlayer,
    hp: clamp(immediatePlayer.hp, 0, immediatePlayer.maxHp),
    resource: clamp(immediatePlayer.resource, 0, immediatePlayer.maxResource),
    buffs: tickStatuses(immediatePlayer.buffs, 0),
    debuffs: tickStatuses(immediatePlayer.debuffs, 0),
  }
  const nextParty = {
    ...immediateParty,
    hp: clamp(immediateParty.hp, 0, immediateParty.maxHp),
    pressure: clamp(immediateParty.pressure, 0, immediateParty.maxPressure),
    statuses: tickStatuses(immediateParty.statuses, 0),
  }
  const nextEnemies = state.enemies.map((enemy) =>
    normalizeEnemy(cleanupDeadEnemy(enemy), nextPlayer, nextParty, state.stage.partyAutoDamageMax),
  )
  const livingEnemies = getLivingEnemies(nextEnemies)
  const currentTargetId = resolvePlayerCurrentTargetId(nextPlayer, nextEnemies)
  const partyCurrentTargetId = resolvePartyCurrentTargetId(nextParty, nextEnemies)
  nextPlayer.currentTargetId = currentTargetId
  nextParty.currentTargetId = partyCurrentTargetId
  const nextDamageSources = buildRuntimeDamageSources(
    state.stage,
    state.runtime.damageSources,
    currentTargetId,
    partyCurrentTargetId,
  )

  let result: EncounterResult | null = state.result

  if (livingEnemies.length === 0) {
    result = {
      outcome: 'victory',
      reason: state.stage.tuning.victoryReason,
    }
  } else if (nextPlayer.hp <= 0) {
    result = {
      outcome: 'defeat',
      reason: state.stage.tuning.defeatPlayerReason,
    }
  } else if (nextParty.hp <= 0) {
    result = {
      outcome: 'defeat',
      reason: state.stage.tuning.defeatPartyReason,
    }
  } else if (nextParty.pressure >= nextParty.maxPressure) {
    result = {
      outcome: 'defeat',
      reason: state.stage.tuning.defeatPressureReason,
    }
  } else {
    result = null
  }

  return {
    ...state,
    player: nextPlayer,
    party: nextParty,
    enemies: nextEnemies,
    runtime: {
      ...state.runtime,
      damageSources: nextDamageSources,
      partyAutoDamageRemainingMs: getPartyAutoDamageRemainingMs(state.stage, nextDamageSources),
    },
    result,
  }
}

function getDefeatResultForDeadPlayerOrParty(state: EncounterState): EncounterResult | null {
  if (state.player.hp <= 0) {
    return {
      outcome: 'defeat',
      reason: state.stage.tuning.defeatPlayerReason,
    }
  }

  if (state.party.hp <= 0) {
    return {
      outcome: 'defeat',
      reason: state.stage.tuning.defeatPartyReason,
    }
  }

  return null
}

function getInitialTargetIdByGrid(enemies: EnemyState[]) {
  const firstLivingEnemy = [...enemies]
    .filter((enemy) => enemy.hp > 0)
    .sort((left, right) => left.row - right.row || left.col - right.col)

  return firstLivingEnemy[0]?.id ?? null
}

export function createInitialEncounterState(
  stage: StageInfo,
  classId: PlayerClassId,
  buildState: PersistedBuildState,
): EncounterState {
  const classRuntimeDefinition = getPlayerClassRuntimeDefinition(classId)
  assertBuildMatchesClass(classId, buildState)
  const template = createEncounterTemplate(stage)
  let initialEnemies = template.enemies.map((enemySeed) => {
    const enemy = normalizeEnemy(
      createEnemyFromSeed(enemySeed),
      { hp: template.playerHp, maxHp: template.playerMaxHp },
      { hp: template.partyHp, maxHp: template.partyMaxHp },
      template.stage.partyAutoDamageMax,
    )
    return {
      ...enemy,
      cast: enemy.cast ?? (
        enemy.recoveryRemainingMs === 0
          ? createNextCast(
              enemy,
              template.stage.tuning.enemyCastTimeMultiplier,
              { hp: template.playerHp, maxHp: template.playerMaxHp },
              { hp: template.partyHp, maxHp: template.partyMaxHp },
            )
          : null
      ),
    }
  })
  initialEnemies = initialEnemies.map((enemy) => {
    const skillDefinition = enemy.cast ? getEnemySkillDefinition(enemy.cast.id) : undefined
    if (!enemy.cast || skillDefinition?.targetRuleId !== 'mostInjured') {
      return enemy
    }

    const targetIndex = findEnemyCastTargetIndex(
      initialEnemies,
      initialEnemies.findIndex((entry) => entry.id === enemy.id),
      'mostInjured',
    )
    return {
      ...enemy,
      cast: {
        ...enemy.cast,
        lockedEnemyTargetId: initialEnemies[targetIndex]?.id ?? null,
      },
    }
  })
  const currentTargetId = getInitialTargetIdByGrid(initialEnemies)

  const baseState: EncounterState = {
    name: stage.title,
    stage: template.stage,
    timeMs: 0,
    player: {
      classId,
      hp: template.playerHp,
      maxHp: template.playerMaxHp,
      resource: Math.min(template.playerResource, classRuntimeDefinition.primaryResource.maxResource),
      maxResource: classRuntimeDefinition.primaryResource.maxResource,
      gcdRemainingMs: template.playerGcdRemainingMs,
      currentTargetId,
      mitigation: {
        id: 'shieldWall',
        label: '盾墙',
        shortLabel: '盾',
        remainingMs: 2_100,
        totalMs: 2_100,
        tone: 'buff',
        kind: 'neutral',
      },
      buffs: template.playerBuffs.map(cloneStatus),
      debuffs:
        template.playerDebuffs.length > 0
          ? template.playerDebuffs.map(cloneStatus)
          : [{ ...STABLE_STATUS }],
    },
    party: {
      hp: template.partyHp,
      maxHp: template.partyMaxHp,
      pressure: template.partyPressure,
      maxPressure: template.partyMaxPressure,
      currentTargetId,
      statuses:
        template.partyStatuses.length > 0
          ? template.partyStatuses.map(cloneStatus)
          : [{ ...STABLE_STATUS }],
    },
    enemies: initialEnemies,
    skills: [],
    passiveTalentIds: buildState.passiveTalentIds,
    runtime: {
      classRuntime: classRuntimeDefinition.initializeRuntime(),
      periodicPlayerStunRemainingMs: 0,
      pendingAffixTriggers: template.pendingAffixTriggers.map(clonePendingAffixTrigger),
      stageRuleRuntime: createStageRuleRuntime(template.stage),
      partyStatusRuntime: {},
      partyAutoDamageRemainingMs: template.stage.partyAutoDamageIntervalMs,
      partyPressureNoGainMs: 0,
      partyPressureLastValue: template.partyPressure,
      damageTakenResourceWindowRemainingMs: DAMAGE_TAKEN_RESOURCE_WINDOW_MS,
      damageTakenResourceGainedInWindow: 0,
      damageSources: buildRuntimeDamageSources(template.stage, [], currentTargetId, currentTargetId),
      commandQueue: [],
      eventQueue: [],
      combatLog: [],
      lastRejectedCommandMessage: null,
      lastProcessedEvents: [],
      pauseOverlay: null,
    },
    result: null,
  }

  return applyStageSpecialRules(
    applyBuildConfiguration(baseState, buildState.loadout, buildState.passiveTalentIds),
    0,
    {
      onlyRuleLogicIds: INITIAL_ENCOUNTER_STAGE_RULE_LOGIC_IDS,
      runTickHandlers: false,
    },
  )
}

export function tickEncounter(state: EncounterState, deltaMs = TICK_INTERVAL_MS): EncounterState {
  const commandFlushedState = drainEncounterEvents(
    flushEncounterCommands(state),
    {
      finalizeEncounterState,
      applyThreatGain,
      appendOrReplaceEnemyStatus,
      advanceEnemySkillCycle,
    },
  )

  if (commandFlushedState.result || commandFlushedState.runtime.pauseOverlay) {
    if (
      commandFlushedState.result &&
      commandFlushedState.runtime.lastProcessedEvents.some((event) => event.type === 'enemy/died')
    ) {
      const ruleResolvedState = applyStageSpecialRules(commandFlushedState, 0)
      return {
        ...ruleResolvedState,
        result: commandFlushedState.result,
      }
    }

    return commandFlushedState
  }

  const modifiers = getPassiveModifiers(commandFlushedState.passiveTalentIds)
  const skillCooldownDeltaMs = playerHasDebuffEffect(commandFlushedState.player, 'slowDown_status') ? 0 : deltaMs
  const mitigation =
    commandFlushedState.player.mitigation === null
      ? null
      : tickStatus(commandFlushedState.player.mitigation, deltaMs)
  const nextSkills = commandFlushedState.skills.map((skill) => ({
    ...skill,
    remainingCooldownMs: Math.max(0, skill.remainingCooldownMs - skillCooldownDeltaMs),
    selfCooldownRemainingMs: Math.max(0, (skill.selfCooldownRemainingMs ?? 0) - skillCooldownDeltaMs),
  }))
  const nextSkillsWithCharges = nextSkills.map((skill) => {
    if (!skill.maxCharges || skill.maxCharges <= 1) {
      return skill
    }

    let currentCharges = skill.currentCharges ?? skill.maxCharges
    let remainingCooldownMs = skill.remainingCooldownMs
    while (remainingCooldownMs <= 0 && currentCharges < skill.maxCharges) {
      currentCharges += 1
      remainingCooldownMs = currentCharges < skill.maxCharges ? skill.cooldownMs : 0
    }

    return {
      ...skill,
      currentCharges,
      remainingCooldownMs: currentCharges >= skill.maxCharges ? 0 : Math.max(0, remainingCooldownMs),
    }
  })

  let nextPlayer: PlayerState = {
    ...commandFlushedState.player,
    gcdRemainingMs: Math.max(0, commandFlushedState.player.gcdRemainingMs - deltaMs),
    resource: changePlayerResource(
      commandFlushedState.player,
      getPassiveResourceGain(deltaMs, modifiers, state.player.classId),
    ).resource,
    mitigation: mitigation && mitigation.remainingMs > 0 ? mitigation : null,
    buffs: tickStatuses(commandFlushedState.player.buffs, deltaMs),
    debuffs: tickStatuses(commandFlushedState.player.debuffs, deltaMs),
  }
  const previousMitigation = commandFlushedState.player.mitigation
  let nextClassRuntime = {
    ...commandFlushedState.runtime.classRuntime,
    wildRecoveryCooldownMs: Math.max(
      0,
      (commandFlushedState.runtime.classRuntime.wildRecoveryCooldownMs ?? 0) - deltaMs,
    ),
  }
  const bearPeriodicHealing = applyBearPlayerBuffContinuousEffects(
    nextPlayer,
    commandFlushedState.party,
    commandFlushedState.player,
    commandFlushedState.enemies,
    commandFlushedState.passiveTalentIds,
    deltaMs,
  )
  nextPlayer = bearPeriodicHealing.player
  nextPlayer = syncExpiredBearMaxHpBuffs(commandFlushedState.player, nextPlayer)
  nextPlayer = applyBearBarkskinDispel(commandFlushedState.player, nextPlayer, commandFlushedState.passiveTalentIds)
  if (
    bearPeriodicHealing.effectivePlayerHealing > 0 &&
    commandFlushedState.passiveTalentIds.includes('druid_bear_t_wild_recovery') &&
    nextClassRuntime.wildRecoveryCooldownMs <= 0
  ) {
    nextPlayer = applyBearWildRecoveryBuff(nextPlayer)
    nextClassRuntime = {
      ...nextClassRuntime,
      wildRecoveryCooldownMs: getBearTalentValue('druid_bear_t_wild_recovery', 'valueB', 10) * 1000,
    }
  }
  if (
    previousMitigation?.id === 'druid_bear_t_ironfur' &&
    !nextPlayer.mitigation &&
    commandFlushedState.passiveTalentIds.includes('druid_bear_t_ironfur_reserve')
  ) {
    const reserve = createPlayerBuildStatusEffect(
      'druid_bear_t_ironfur_reserve',
      getBearTalentValue('druid_bear_t_ironfur_reserve', 'valueB', 3) * 1000,
    )
    if (reserve) {
      nextPlayer = {
        ...nextPlayer,
        buffs: [...nextPlayer.buffs.filter((status) => status.id !== reserve.id), { ...reserve, damageReductionRatio: getBearTalentValue('druid_bear_t_ironfur_reserve', 'valueA', 0.08), damageReductionTypes: ['physical'] }],
      }
    }
  }

  let periodicPlayerStunRemainingMs =
    modifiers.periodicPlayerStunIntervalMs > 0
      ? commandFlushedState.runtime.periodicPlayerStunRemainingMs - deltaMs
      : 0
  let damageTakenResourceWindowRemainingMs =
    commandFlushedState.runtime.damageTakenResourceWindowRemainingMs - deltaMs
  let damageTakenResourceGainedInWindow =
    commandFlushedState.runtime.damageTakenResourceGainedInWindow

  while (damageTakenResourceWindowRemainingMs <= 0) {
    damageTakenResourceWindowRemainingMs += DAMAGE_TAKEN_RESOURCE_WINDOW_MS
    damageTakenResourceGainedInWindow = 0
  }

  if (modifiers.periodicPlayerStunIntervalMs > 0 && periodicPlayerStunRemainingMs <= 0) {
    nextPlayer = appendOrReplacePlayerDebuff(nextPlayer, {
      id: 'stunned',
      label: '战术眩晕',
      shortLabel: '晕',
      remainingMs: modifiers.periodicPlayerStunDurationMs,
      totalMs: modifiers.periodicPlayerStunDurationMs,
      tone: 'danger',
      kind: 'playerDebuff',
    }, commandFlushedState.passiveTalentIds)
    periodicPlayerStunRemainingMs = modifiers.periodicPlayerStunIntervalMs
  }

  let nextParty = {
    ...bearPeriodicHealing.party,
    pressure: clamp(
      bearPeriodicHealing.party.pressure +
        0,
      0,
      commandFlushedState.party.maxPressure,
    ),
    hp: clampSuppressedHealing(
      commandFlushedState.party.hp,
      bearPeriodicHealing.party.hp + modifiers.partyHpDriftPerSecond * (deltaMs / 1000),
      bearPeriodicHealing.party.maxHp,
      isPartyHealingSuppressedByMurlocWatch(commandFlushedState.enemies),
    ),
    statuses: tickStatuses(bearPeriodicHealing.party.statuses, deltaMs),
  }

  const partyStatusIntervalResolvedState = applyPartyStatusIntervalEffects({
    ...state,
    ...commandFlushedState,
    player: nextPlayer,
    party: nextParty,
    runtime: {
      ...commandFlushedState.runtime,
      classRuntime: nextClassRuntime,
    },
  }, deltaMs)
  nextPlayer = partyStatusIntervalResolvedState.player
  nextParty = partyStatusIntervalResolvedState.party
  const partyStatusEventResolvedState = applyPartyStatusEventEffects({
    ...partyStatusIntervalResolvedState,
    player: nextPlayer,
    party: nextParty,
  })
  nextPlayer = partyStatusEventResolvedState.player
  nextParty = partyStatusEventResolvedState.party

  const stageRuleResolvedState = applyStageSpecialRules(
    {
      ...state,
      ...partyStatusEventResolvedState,
      player: nextPlayer,
      party: nextParty,
    },
    deltaMs,
  )
  nextPlayer = stageRuleResolvedState.player
  nextParty = stageRuleResolvedState.party
  const playerContinuousStatus = getPlayerContinuousDamageStatus(commandFlushedState.player)
  const previousPlayerHpBeforeStatusTick = nextPlayer.hp
  nextPlayer = applyPlayerDebuffContinuousEffects(nextPlayer, deltaMs, commandFlushedState.player)
  const partyContinuousStatus = getPartyContinuousDamageStatus(commandFlushedState.party)
  const previousPartyHpBeforeStatusTick = nextParty.hp
  nextParty = applyPartyStatusContinuousEffects(nextParty, deltaMs, commandFlushedState.party)
  let statusTickState = {
    ...stageRuleResolvedState,
    player: nextPlayer,
    party: nextParty,
  }
  const playerStatusDamage = Math.max(0, previousPlayerHpBeforeStatusTick - nextPlayer.hp)
  if (playerContinuousStatus && playerStatusDamage > 0) {
    statusTickState = recordCombatLogEvents(statusTickState, [
      {
        id: createCombatLogEventId(statusTickState, 'damage', `${playerContinuousStatus.id}:tank-dot`),
        occurredAtMs: statusTickState.timeMs,
        type: 'damage',
        source: getStatusCombatLogSource(playerContinuousStatus),
        target: { kind: 'tank', id: 'tank', name: '坦克' },
        ability: getStatusCombatLogAbility(playerContinuousStatus),
        amount: playerStatusDamage,
      },
    ])
  }
  const partyStatusDamage = Math.max(0, previousPartyHpBeforeStatusTick - nextParty.hp)
  if (partyContinuousStatus && partyStatusDamage > 0) {
    statusTickState = recordCombatLogEvents(statusTickState, [
      {
        id: createCombatLogEventId(statusTickState, 'damage', `${partyContinuousStatus.id}:party-dot`),
        occurredAtMs: statusTickState.timeMs,
        type: 'damage',
        source: getStatusCombatLogSource(partyContinuousStatus),
        target: { kind: 'party', id: 'party', name: '队伍' },
        ability: getStatusCombatLogAbility(partyContinuousStatus),
        amount: partyStatusDamage,
      },
    ])
  }

  const affixResolution = triggerPendingAffixes(
    {
      ...statusTickState,
      player: nextPlayer,
      party: nextParty,
      enemies: statusTickState.enemies,
    },
    deltaMs,
  )
  nextPlayer = affixResolution.player
  nextParty = affixResolution.party
  const pendingAffixTriggers = affixResolution.pendingAffixTriggers.map(clonePendingAffixTrigger)

  const damageSourceResolution = applyDamageSources(
    {
      ...statusTickState,
      player: nextPlayer,
      party: nextParty,
      enemies: affixResolution.enemies,
    },
    deltaMs,
  )
  nextPlayer = damageSourceResolution.player
  nextParty = damageSourceResolution.party
  const combatLogEvents = [...damageSourceResolution.combatLogEvents]

  const finishAfterImmediateDefeat = (
    player: PlayerState,
    party: EncounterState['party'],
    enemies: EnemyState[],
  ) =>
    drainEncounterEvents(
      finalizeEncounterState({
        ...statusTickState,
        timeMs: commandFlushedState.timeMs + deltaMs,
        player,
        party,
        enemies,
        skills: nextSkillsWithCharges,
        runtime: {
          ...statusTickState.runtime,
          periodicPlayerStunRemainingMs: Math.max(0, periodicPlayerStunRemainingMs),
          damageTakenResourceWindowRemainingMs,
          damageTakenResourceGainedInWindow,
          pendingAffixTriggers,
          partyAutoDamageRemainingMs: damageSourceResolution.partyAutoDamageRemainingMs,
          damageSources: damageSourceResolution.damageSources,
          partyStatusRuntime: damageSourceResolution.partyStatusRuntime,
          combatLog: [
            ...statusTickState.runtime.combatLog,
            ...combatLogEvents,
          ],
          pauseOverlay: null,
        },
        result: getDefeatResultForDeadPlayerOrParty({
          ...statusTickState,
          player,
          party,
          enemies,
        }),
      }),
      {
        finalizeEncounterState,
        applyThreatGain,
        appendOrReplaceEnemyStatus,
        advanceEnemySkillCycle,
      },
    )

  let nextEnemies = damageSourceResolution.enemies.map((enemy) =>
    normalizeEnemy({
      ...enemy,
      statuses: tickStatuses(enemy.statuses, deltaMs),
      cast: enemy.cast ? tickCast(enemy.cast, deltaMs) : null,
      recoveryRemainingMs: Math.max(0, enemy.recoveryRemainingMs - deltaMs),
    }, nextPlayer, nextParty, commandFlushedState.stage.partyAutoDamageMax),
  )
  nextEnemies = applyBearEnemyDotEffects(nextEnemies, damageSourceResolution.enemies, deltaMs)

  for (let index = 0; index < nextEnemies.length; index += 1) {
    let nextEnemy = nextEnemies[index]
    const previousEnemy = damageSourceResolution.enemies[index]
    const previousStatusesById = new Map(previousEnemy.statuses.map((status) => [status.id, status]))
    const hadControlStatus = isControlStatusActive(commandFlushedState.enemies[index])

    if (!isEnemyAlive(nextEnemy)) {
      nextEnemies[index] = cleanupDeadEnemy(nextEnemy)
      continue
    }

    if (isStunned(nextEnemy) && nextEnemy.cast) {
      nextEnemy =
        getCastPhase(nextEnemy.cast) === 'channeling'
          ? advanceEnemySkillCycle({
              ...stopEnemyChannel(nextEnemy, nextEnemy.cast.id, 'controlled'),
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            })
          : {
              ...nextEnemy,
              cast: null,
            }
    }

    if (nextEnemy.cast && nextEnemy.cast.remainingMs === 0) {
      const resolved = resolveCompletedCast(
        index,
        nextEnemies,
        nextPlayer,
        nextParty,
        commandFlushedState.stage.tuning,
        commandFlushedState.stage.partyAutoDamageMax,
        commandFlushedState.passiveTalentIds,
        damageTakenResourceGainedInWindow,
        commandFlushedState.timeMs + deltaMs,
      )
      nextEnemies = resolved.enemies
      nextPlayer = resolved.player
      nextParty = resolved.party
      damageTakenResourceGainedInWindow = resolved.damageTakenResourceGainedInWindow
      combatLogEvents.push(...resolved.combatLogEvents)
      if (getDefeatResultForDeadPlayerOrParty({
        ...statusTickState,
        player: nextPlayer,
        party: nextParty,
        enemies: nextEnemies,
      })) {
        return finishAfterImmediateDefeat(nextPlayer, nextParty, nextEnemies)
      }
    }

    const enemyStatusTickResult = applyEnemyStatusTickEffectsWithApplications(
      {
        ...statusTickState,
        player: nextPlayer,
        party: nextParty,
        enemies: nextEnemies,
      },
      nextEnemy,
      previousStatusesById,
      deltaMs,
    )
    const enemyStatusTickResolvedState = enemyStatusTickResult.state
    for (const application of enemyStatusTickResult.applications) {
      combatLogEvents.push(
        ...createEnemyStatusTickTelemetry(
          commandFlushedState.timeMs + deltaMs,
          nextEnemy,
          application.status,
          application.previousState,
          application.nextState,
        ),
      )
    }
    nextPlayer = enemyStatusTickResolvedState.player
    nextParty = enemyStatusTickResolvedState.party
    nextEnemies = enemyStatusTickResolvedState.enemies
    if (getDefeatResultForDeadPlayerOrParty({
      ...statusTickState,
      player: nextPlayer,
      party: nextParty,
      enemies: nextEnemies,
    })) {
      return finishAfterImmediateDefeat(nextPlayer, nextParty, nextEnemies)
    }

    nextEnemy = nextEnemies[index]

    const hasControlStatus = isControlStatusActive(nextEnemy)
    if (
      !nextEnemy.cast &&
      nextEnemy.hp > 0 &&
      nextEnemy.pendingRetryCastSkillId &&
      !hadControlStatus &&
      !hasControlStatus
    ) {
      const retryReadyEnemy = {
        ...nextEnemy,
        pendingRetryCastSkillId: null,
      }
      nextEnemy = {
        ...retryReadyEnemy,
        cast: createNextCast(
          retryReadyEnemy,
          commandFlushedState.stage.tuning.enemyCastTimeMultiplier,
          nextPlayer,
          nextParty,
          nextEnemies,
        ),
        pendingRetryCastSkillId: null,
      }
      if (nextEnemy.cast) {
        combatLogEvents.push({
          id: `${commandFlushedState.timeMs + deltaMs}:cast-started:${nextEnemy.id}:${nextEnemy.cast.id}`,
          occurredAtMs: commandFlushedState.timeMs + deltaMs,
          type: 'cast-started',
          source: { kind: 'enemy', id: nextEnemy.id, name: nextEnemy.name },
          target: getCombatLogTargetForCastTarget(nextEnemy.cast.target),
          ability: { kind: 'enemySkill', id: nextEnemy.cast.id, name: nextEnemy.cast.name },
          castId: `${nextEnemy.id}:${nextEnemy.cast.id}:${commandFlushedState.timeMs + deltaMs}`,
          enemyId: nextEnemy.id,
          enemySkillId: nextEnemy.cast.id,
          dangerLevel: nextEnemy.cast.dangerLevel,
          breakRule: nextEnemy.cast.breakRule,
        })
      }
    }

    if (!nextEnemy.cast && nextEnemy.hp > 0 && nextEnemy.recoveryRemainingMs === 0) {
      const castReadyEnemy =
        nextEnemy.pendingRetryCastSkillId && !hasControlStatus
          ? {
              ...nextEnemy,
              pendingRetryCastSkillId: null,
            }
          : nextEnemy
      nextEnemy = {
        ...castReadyEnemy,
        cast: createNextCast(
          castReadyEnemy,
          commandFlushedState.stage.tuning.enemyCastTimeMultiplier,
          nextPlayer,
          nextParty,
          nextEnemies,
        ),
      }
      if (nextEnemy.cast) {
        combatLogEvents.push({
          id: `${commandFlushedState.timeMs + deltaMs}:cast-started:${nextEnemy.id}:${nextEnemy.cast.id}`,
          occurredAtMs: commandFlushedState.timeMs + deltaMs,
          type: 'cast-started',
          source: { kind: 'enemy', id: nextEnemy.id, name: nextEnemy.name },
          target: getCombatLogTargetForCastTarget(nextEnemy.cast.target),
          ability: { kind: 'enemySkill', id: nextEnemy.cast.id, name: nextEnemy.cast.name },
          castId: `${nextEnemy.id}:${nextEnemy.cast.id}:${commandFlushedState.timeMs + deltaMs}`,
          enemyId: nextEnemy.id,
          enemySkillId: nextEnemy.cast.id,
          dangerLevel: nextEnemy.cast.dangerLevel,
          breakRule: nextEnemy.cast.breakRule,
        })
      }
    }

    nextEnemies[index] = normalizeEnemy(
      nextEnemy,
      nextPlayer,
      nextParty,
      commandFlushedState.stage.partyAutoDamageMax,
    )
  }

  let pressureDecayState = applyPassivePartyPressureDecay(
    {
      ...commandFlushedState,
      player: nextPlayer,
      party: nextParty,
      enemies: nextEnemies,
      runtime: {
        ...statusTickState.runtime,
        periodicPlayerStunRemainingMs: Math.max(0, periodicPlayerStunRemainingMs),
        damageTakenResourceWindowRemainingMs,
        damageTakenResourceGainedInWindow,
        pendingAffixTriggers,
        partyAutoDamageRemainingMs: damageSourceResolution.partyAutoDamageRemainingMs,
        damageSources: damageSourceResolution.damageSources,
        partyStatusRuntime: damageSourceResolution.partyStatusRuntime,
        combatLog: [
          ...statusTickState.runtime.combatLog,
          ...combatLogEvents,
        ],
        pauseOverlay: null,
      },
    },
    deltaMs,
    modifiers,
  )
  nextParty = pressureDecayState.party

  const enqueueBearRage = (amount: number, reason: string) => {
    pressureDecayState = applyBearRageGain(
      pressureDecayState,
      amount,
      undefined,
      reason,
      (currentState, resourceAmount, resourceReason, sourceSkillId) =>
        enqueueEncounterEvent(currentState, {
          type: 'player/resource-changed',
          occurredAtMs: currentState.timeMs,
          amount: resourceAmount,
          sourceSkillId,
          reason: resourceReason,
        }),
    )
  }
  const tookEffectiveDamage = combatLogEvents.some(
    (event) => event.type === 'damage' && event.target.kind === 'tank' && event.amount > 0,
  )
  if (
    tookEffectiveDamage &&
    commandFlushedState.player.buffs.some((status) => status.id === 'druid_bear_t_frenzied_regeneration' && isStatusActive(status)) &&
    commandFlushedState.passiveTalentIds.includes('druid_bear_t_blood_scent') &&
    (pressureDecayState.runtime.classRuntime.bloodScentTriggered ?? 0) <= 0
  ) {
    enqueueBearRage(getBearTalentValue('druid_bear_t_blood_scent', 'valueA', 8), 'bear_blood_scent')
    pressureDecayState = {
      ...pressureDecayState,
      runtime: {
        ...pressureDecayState.runtime,
        classRuntime: { ...pressureDecayState.runtime.classRuntime, bloodScentTriggered: 1 },
      },
    }
  }
  if (
    commandFlushedState.player.classId === 'druid_bear_t' &&
    combatLogEvents.some((event) => event.type === 'absorb-consumed' && event.fullyConsumed) &&
    commandFlushedState.passiveTalentIds.includes('druid_bear_t_broken_bark')
  ) {
    enqueueBearRage(getBearTalentValue('druid_bear_t_broken_bark', 'valueA', 12), 'bear_broken_bark')
  }

  return drainEncounterEvents(
    finalizeEncounterState({
      ...pressureDecayState,
      timeMs: commandFlushedState.timeMs + deltaMs,
      player: pressureDecayState.player,
      party: pressureDecayState.party,
      enemies: nextEnemies,
      skills: nextSkillsWithCharges,
      runtime: {
        ...pressureDecayState.runtime,
      },
    }),
    {
      finalizeEncounterState,
      applyThreatGain,
      appendOrReplaceEnemyStatus,
      advanceEnemySkillCycle,
    },
  )
}

export function selectEnemy(state: EncounterState, enemyId: string): EncounterState {
  if (!state.enemies.some((enemy) => enemy.id === enemyId && enemy.hp > 0)) {
    return state
  }

  const previousTargetId = state.player.currentTargetId
  const targetEnemyId = getForcedPlayerCurrentTargetId(state.player, state.enemies) ?? enemyId
  const selectedState = {
    ...state,
    player: {
      ...state.player,
      currentTargetId: targetEnemyId,
    },
    runtime: {
      ...state.runtime,
      damageSources: buildRuntimeDamageSources(
        state.stage,
        state.runtime.damageSources,
        targetEnemyId,
        state.party.currentTargetId,
      ),
    },
  }

  return previousTargetId ? selectedState : applyImmediatePlayerAutoAttack(selectedState, targetEnemyId)
}

export function cycleEnemyTarget(state: EncounterState, direction: 1 | -1): EncounterState {
  const livingEnemies = getLivingEnemies(state.enemies)

  if (livingEnemies.length === 0) {
    return state
  }

  const currentIndex = livingEnemies.findIndex((enemy) => enemy.id === state.player.currentTargetId)
  const nextIndex =
    currentIndex < 0 ? 0 : (currentIndex + direction + livingEnemies.length) % livingEnemies.length

  return selectEnemy(state, livingEnemies[nextIndex].id)
}

export function openPauseOverlay(state: EncounterState): EncounterState {
  if (state.result) {
    return state
  }

  return {
    ...state,
    runtime: {
      ...state.runtime,
      pauseOverlay: 'pause',
    },
  }
}

export function closePauseOverlay(state: EncounterState): EncounterState {
  if (!state.runtime.pauseOverlay) {
    return state
  }

  return {
    ...state,
    runtime: {
      ...state.runtime,
      pauseOverlay: null,
    },
  }
}

export function activateSkill(state: EncounterState, skillId: SkillId): EncounterState {
  const effectivePlayerCurrentTargetId = resolvePlayerCurrentTargetId(state.player, state.enemies)
  const activationState =
    effectivePlayerCurrentTargetId === state.player.currentTargetId
      ? state
      : {
          ...state,
          player: {
            ...state.player,
            currentTargetId: effectivePlayerCurrentTargetId,
          },
          runtime: {
            ...state.runtime,
            damageSources: buildRuntimeDamageSources(
              state.stage,
              state.runtime.damageSources,
              effectivePlayerCurrentTargetId,
              state.party.currentTargetId,
            ),
          },
        }

  if (getSkillActivationBlockReason(activationState, skillId)) {
    return state
  }

  const modifiers = getPassiveModifiers(activationState.passiveTalentIds)
  const skill = activationState.skills.find((entry) => entry.id === skillId)
  const skillDefinition = getActiveSkillDefinition(skillId)

  if (!skill || !skillDefinition) {
    return activationState
  }

  if (
    getInterruptTargetValidationError(activationState, skillId) ||
    (skillNeedsTarget(skillId) && !activationState.player.currentTargetId && !isAllEnemyInterruptSkill(skillId))
  ) {
    return activationState
  }

  if ((skill.selfCooldownRemainingMs ?? 0) > 0) {
    return activationState
  }

  if ((skill.maxCharges ?? 1) <= 1 && skill.remainingCooldownMs > 0) {
    return activationState
  }

  if ((skill.maxCharges ?? 1) > 1 && (skill.currentCharges ?? skill.maxCharges ?? 1) <= 0) {
    return activationState
  }

  if (activationState.player.resource < skill.resourceCost) {
    return activationState
  }

  if (!modifiers.interruptIgnoresGcd && skill.gcdMs > 0 && activationState.player.gcdRemainingMs > 0) {
    return activationState
  }

  const cooldownMultiplier =
    playerHasDebuffEffect(state.player, 'incorrigibled_status') &&
    (skillDefinition.castStopMode === 'interrupt' || skillDefinition.castStopMode === 'control')
      ? 2
      : 1
  const getNextSkillCooldownMs = (entry: SkillState) => {
    const configuredCooldownMs = entry.cooldownMs * cooldownMultiplier
    if (entry.gcdMs > 0 || (entry.maxCharges && entry.maxCharges > 1)) {
      return configuredCooldownMs
    }

    return Math.max(configuredCooldownMs, NON_GCD_SELF_COOLDOWN_MS)
  }
  const nextSkills = activationState.skills.map((entry) =>
    entry.id === skillId
      ? {
          ...entry,
          remainingCooldownMs: getNextSkillCooldownMs(entry),
          selfCooldownRemainingMs: entry.gcdMs <= 0 ? NON_GCD_SELF_COOLDOWN_MS : 0,
          currentCharges:
            entry.maxCharges && entry.maxCharges > 1
              ? Math.max(0, (entry.currentCharges ?? entry.maxCharges) - 1)
              : entry.currentCharges,
        }
      : entry,
  )

  const nextState: EncounterState = {
    ...activationState,
    skills: nextSkills,
    player: {
      ...activationState.player,
      resource: clamp(
        activationState.player.resource - skill.resourceCost,
        0,
        activationState.player.maxResource,
      ),
      gcdRemainingMs: skill.gcdMs > 0 ? skill.gcdMs : activationState.player.gcdRemainingMs,
    },
  }
  return resolvePlayerSkillRuntime(nextState, skillId, {
    clamp,
    finalizeEncounterState,
    withCurrentTarget,
    withTargetIds,
    getCrossTargetIds,
    getEnemyTargetIdsBySelector: resolveEnemyTargetIdsBySelector,
    applyThreatGain,
    appendOrReplaceEnemyStatus,
    canStopCast,
    canPlayerSkillAffectEnemy,
    advanceEnemySkillCycle,
    changePlayerResource: (currentState, amount, reason, sourceSkillId) =>
      enqueueEncounterEvent(currentState, {
        type: 'player/resource-changed',
        occurredAtMs: currentState.timeMs,
        amount,
        sourceSkillId,
        reason,
      }),
  })
}

export function getEncounterWarning(state: EncounterState) {
  if (state.result) {
    return state.result.reason
  }

  if (playerHasDebuff(state.player, 'stunned')) {
    return '玩家当前被战术眩晕，需等待控制结束。'
  }

  const criticalCast = state.enemies.find(
    (enemy) =>
      enemy.cast?.dangerLevel === 'high' &&
      enemy.cast.remainingMs > 0,
  )

  if (criticalCast?.cast) {
    return `${criticalCast.name} 即将完成 ${criticalCast.cast.name}`
  }

  const lostEnemy = state.enemies.find((enemy) => enemy.target === 'ally')

  if (lostEnemy) {
    return `${lostEnemy.name} 正在逼近后排`
  }

  if (state.player.mitigation) {
    return `减伤 ${state.player.mitigation.label} 生效中`
  }

  return state.stage.tuning.warningLabel
}

export function getEncounterResultChatter(state: EncounterState) {
  if (!state.result) {
    return null
  }

  const pool = state.result.outcome === 'victory' ? VICTORY_CHATTER : DEFEAT_CHATTER
  const seed =
    Math.round(state.timeMs / 100) +
    Math.round(state.player.hp) +
    Math.round(state.party.pressure) +
    Math.round(state.party.hp)

  return pool[Math.abs(seed) % pool.length]
}

