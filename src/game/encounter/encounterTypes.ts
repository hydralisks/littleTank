export type ThreatState = 'safe' | 'warning' | 'lost'

export type StatusTone = 'neutral' | 'buff' | 'danger'

export type StatusKind = 'enemyBuff' | 'playerBuff' | 'playerDebuff' | 'partyDebuff' | 'neutral'

export type DangerLevel = 'low' | 'medium' | 'high'
export type EnemyThreatLogic = 'normal' | 'irregular' | 'bloodlust'
export type EnemyCastBreakRule = 'interruptOrControl' | 'controlOnly' | 'unstoppable'
export type EnemyCastPhase = 'casting' | 'channeling'
export type EnemySkillDamageType = 'physical' | 'magic'
export type EncounterAffixTargetType = 'enemy' | 'player' | 'party'

export type CombatTarget = 'tank' | 'ally' | 'party' | 'enemy' | 'self'

export type EncounterOutcome = 'victory' | 'defeat'

export type SkillHotkey = '1' | '2' | '3' | '4' | 'Q' | 'E' | 'R' | 'F'

export type SkillId = string
export type PlayerCastStopMode = 'none' | 'interrupt' | 'control'
export type PlayerClassRoleTag = 'tank' | 'healer' | 'dps' | 'support'
export type PlayerClassId = string
export type PlayerClassRuntimeState = Record<string, number>
export type DamageSourceOwnerSide = 'player' | 'party' | 'enemy' | 'neutral'
export type DamageSourceInvalidTargetPolicy = 'pauseReady' | 'retargetLivingEnemy'
export type DamageSourceTargetRule = 'lockedCurrentTarget' | 'randomLivingEnemy' | 'mostInjuredEnemy'
export type DamageSourceDamageMode = 'fixed' | 'randomRange'
export type DamageSourceThreatMode = 'formula' | 'none'
export type DamageSourceThreatSource = 'player' | 'party'

export type PassiveTalentCategory = 'player' | 'skill' | 'party'

export type PassiveTalentId = string
export type BuildInheritancePolicy = 'keep_active_first' | 'keep_balanced' | 'reset_to_default'
export type PlayerBuildStatusCategory = 'playerBuff' | 'enemyDebuff' | 'partyBuff' | 'partyDebuff'

export interface StatusEffect {
  id: string
  iconId?: string
  label: string
  shortLabel: string
  remainingMs: number
  totalMs?: number
  tone: StatusTone
  kind: StatusKind
  effectLogicId?: string
  valueA?: number
  valueB?: number
  tickIntervalMs?: number
  absorbRemaining?: number
  absorbRatio?: number
  damageReductionRatio?: number
  damageReductionTypes?: EnemySkillDamageType[]
  damageMultiplierBonus?: number
  damageTakenMultiplierBonus?: number
  outgoingDamageReductionRatio?: number
  stacks?: number
  maxStacks?: number
  channelSourceSkillId?: string
  combatLogSource?: CombatLogActor
  combatLogAbility?: CombatLogAbility
}

export interface CastState {
  id: string
  name: string
  target: CombatTarget
  lockedEnemyTargetId?: string | null
  remainingMs: number
  totalMs: number
  breakRule: EnemyCastBreakRule
  dangerLevel: DangerLevel
  phase?: EnemyCastPhase
}

export interface EnemyState {
  id: string
  definitionId: string
  name: string
  row: number
  col: number
  hp: number
  maxHp: number
  skillIds: string[]
  skillCycle: string[]
  skillCycleIndex: number
  threatLogic: EnemyThreatLogic
  target: 'tank' | 'ally'
  threatState: ThreatState
  tankThreat: number
  allyThreat: number
  isSkull: boolean
  statuses: StatusEffect[]
  cast: CastState | null
  recoveryRemainingMs: number
  pendingRetryCastSkillId: string | null
}

export type EnemySeed = EnemyState

export interface SkillState {
  id: SkillId
  name: string
  shortName: string
  iconId: string
  hotkey: SkillHotkey
  cooldownMs: number
  remainingCooldownMs: number
  selfCooldownRemainingMs?: number
  resourceCost: number
  gcdMs: number
  maxCharges?: number
  currentCharges?: number
}

export interface ActiveSkillDefinition {
  id: SkillId
  classId?: string
  name: string
  shortName: string
  description: string
  iconId: string
  cooldownMs: number
  initialRemainingCooldownMs: number
  resourceCost: number
  gcdMs: number
  pointCost: number
  targetingType: string
  skillLogicId: string
  castStopMode: PlayerCastStopMode
  canAffectSkull: boolean
  skillTags?: string[]
  uiOrder?: number
  unlockHint?: string
  grantedStatusIds: string[]
  enabled?: boolean
}

export interface PassiveTalentDefinition {
  id: PassiveTalentId
  classId?: string
  name: string
  category: PassiveTalentCategory
  cost: number
  description: string
  iconId: string
  talentLogicId: string
  tier: number
  talentTags?: string[]
  uiOrder?: number
  exclusiveGroup?: string
  grantedStatusIds: string[]
  enabled?: boolean
}

export interface PlayerClassDefinition {
  classId: string
  className: string
  roleTag: PlayerClassRoleTag
  classDescription: string
  recommendedBuildRuleIds: string[]
  enabled: boolean
}

export interface ActiveSkillEffectDefinition {
  skillEffectId: string
  skillId: SkillId
  effectIndex: number
  skillLogicId?: string
  targetSelector: string
  valueA?: number
  valueB?: number
  durationMs?: number
  statusId?: string
  threatDelta?: number
  threatMultiplier?: number
  threatSource?: DamageSourceThreatSource
  notes?: string
  enabled: boolean
}

export interface PassiveTalentEffectDefinition {
  talentEffectId: string
  talentId: PassiveTalentId
  effectIndex: number
  talentLogicId: string
  targetScope: string
  valueA?: number
  valueB?: number
  statusId?: string
  skillId?: SkillId
  notes?: string
  enabled: boolean
}

export interface PassiveTalentModifiers {
  playerMaxHpBonus: number
  playerMaxHpMultiplier: number
  playerMaxResourceBonus: number
  playerResourceRegenMultiplier: number
  playerDamageTakenMultiplier: number
  playerPassiveBuffs: StatusEffect[]
  stunHitsCross: boolean
  interruptIgnoresGcd: boolean
  burstCooldownMultiplier: number
  burstEffectMultiplier: number
  cleaveHitsCross: boolean
  shieldWallDurationMultiplier: number
  shieldWallCooldownMultiplier: number
  shieldWallMaxCharges: number
  partyMaxHpMultiplier: number
  partyMaxPressureBonus: number
  partyMaxPressureMultiplier: number
  partyHpDriftPerSecond: number
  partyPressureDriftPerSecond: number
  partyPressureCanDriftDown: boolean
  partyDamageMultiplier: number
  partyThreatMultiplier: number
  periodicPlayerStunIntervalMs: number
  periodicPlayerStunDurationMs: number
  tauntCooldownMultiplier: number
  massTauntCooldownMultiplier: number
  bonusBuildPoints: number
  playerAutoAttackDamageBonus: number
  playerAutoAttackResourceGainBonus: number
  interruptVulnerabilityDurationMs: number
  interruptVulnerabilityDamageTakenMultiplierBonus: number
  revengeRefundChance: number
  revengeRefundResource: number
  shieldSlamPunishDurationMs: number
  shieldSlamPunishMaxStacks: number
  shieldSlamPunishOutgoingDamageReductionRatio: number
  shieldBlockDurationBonusMs: number
  demoralizingShoutResourceGain: number
  shockwaveUsesMatrix3x3: boolean
  thunderstruckDamageMultiplier: number
  thunderstruckThreatMultiplierOverride: number | null
}

export interface PlayerBuildStatusDefinition {
  statusId: string
  statusName: string
  statusCategory: PlayerBuildStatusCategory
  iconId: string
  durationMs: number
  maxStacks: number
  dispellable: boolean
  description: string
  effectLogicId: string
  enabled: boolean
}

export interface BuildRuleDefinition {
  buildRuleId: string
  classId?: string
  ruleName: string
  description: string
  totalBuildPoints: number
  maxActiveSlots: number
  enabledHotkeys: SkillHotkey[]
  inheritancePolicy: BuildInheritancePolicy
  enabled: boolean
}

export interface BuildPresetActiveEntry {
  presetId: string
  buildRuleId?: string
  classId?: string
  hotkey: SkillHotkey
  skillId: SkillId | null
  priority: number
}

export interface BuildPresetPassiveEntry {
  presetId: string
  buildRuleId?: string
  classId?: string
  talentId: PassiveTalentId
  selected: boolean
  priority: number
}

export interface BuildIconDefinition {
  iconId: string
  iconName: string
  assetKey: string
  iconType: 'skill' | 'talent' | 'status' | 'class' | 'affix' | 'rule'
  enabled: boolean
}

export interface PersistedBuildState {
  loadout: SkillLoadout
  passiveTalentIds: PassiveTalentId[]
}

export interface BuildConflictWarning {
  code:
    | 'removed_skill'
    | 'removed_talent'
    | 'cleared_hotkey'
    | 'removed_for_points'
    | 'reset_default'
  message: string
}

export interface BuildNormalizationResult {
  build: PersistedBuildState
  warnings: BuildConflictWarning[]
}

export type SkillLoadout = Record<SkillHotkey, SkillId | null>

export interface PlayerState {
  classId: PlayerClassId
  hp: number
  maxHp: number
  resource: number
  maxResource: number
  gcdRemainingMs: number
  currentTargetId: string | null
  mitigation: StatusEffect | null
  buffs: StatusEffect[]
  debuffs: StatusEffect[]
}

export interface PartyState {
  hp: number
  maxHp: number
  pressure: number
  maxPressure: number
  currentTargetId: string | null
  statuses: StatusEffect[]
}

export interface EncounterResult {
  outcome: EncounterOutcome
  reason: string
}

export type CombatLogActorKind =
  | 'tank'
  | 'ally'
  | 'player'
  | 'playerAutoAttack'
  | 'party'
  | 'partyAutoAttack'
  | 'partyAutoHeal'
  | 'enemy'
  | 'status'
  | 'affix'
  | 'stageRule'
  | 'talent'

export interface CombatLogActor {
  kind: CombatLogActorKind
  id?: string
  name?: string
}

export type CombatLogAbilityKind =
  | 'playerSkill'
  | 'enemySkill'
  | 'autoAttack'
  | 'autoHeal'
  | 'status'
  | 'affix'
  | 'stageRule'
  | 'talent'

export interface CombatLogAbility {
  kind: CombatLogAbilityKind
  id: string
  name?: string
}

export type CombatLogEventType =
  | 'damage'
  | 'pressure'
  | 'cast-started'
  | 'cast-resolved'
  | 'cast-interrupted'
  | 'cast-controlled'
  | 'healing'
  | 'absorb-created'
  | 'absorb-consumed'

export interface CombatLogEventBase {
  id: string
  occurredAtMs: number
  type: CombatLogEventType
  source: CombatLogActor
  target: CombatLogActor
  ability?: CombatLogAbility
  tags?: string[]
}

export interface CombatDamageEvent extends CombatLogEventBase {
  type: 'damage'
  amount: number
  damageType?: EnemySkillDamageType
}

export interface CombatPressureEvent extends CombatLogEventBase {
  type: 'pressure'
  amount: number
}

export interface CombatCastEvent extends CombatLogEventBase {
  type: 'cast-started' | 'cast-resolved' | 'cast-interrupted' | 'cast-controlled'
  castId?: string
  enemyId: string
  enemySkillId: string
  dangerLevel: DangerLevel
  breakRule: EnemyCastBreakRule
  handlerSkillId?: SkillId
  handlerName?: string
}

export interface CombatHealingEvent extends CombatLogEventBase {
  type: 'healing'
  amount: number
  rawAmount?: number
  overhealAmount?: number
}

export interface CombatAbsorbCreatedEvent extends CombatLogEventBase {
  type: 'absorb-created'
  amount: number
}

export interface CombatAbsorbConsumedEvent extends CombatLogEventBase {
  type: 'absorb-consumed'
  amount: number
}

export type CombatLogEvent =
  | CombatDamageEvent
  | CombatPressureEvent
  | CombatCastEvent
  | CombatHealingEvent
  | CombatAbsorbCreatedEvent
  | CombatAbsorbConsumedEvent

export interface EncounterTuning {
  ambientPressurePerSecond: number
  enemyCastTimeMultiplier: number
  enemyDamageMultiplier: number
  enemyHealingMultiplier: number
  playerResourceRegenMultiplier: number
  warningLabel: string
  victoryReason: string
  defeatPlayerReason: string
  defeatPartyReason: string
  defeatPressureReason: string
}

export interface EncounterAffixDefinition {
  affixId: string
  affixName: string
  iconId: string
  description: string
  delayMs: number
  targetType: EncounterAffixTargetType
  targetSelector: string
  statusId: string
  durationMsOverride?: number
  valueA?: number
  valueB?: number
  tickIntervalMs?: number
  stacks: number
  enabled: boolean
}

export interface EncounterSpecialRuleDefinition {
  ruleId: string
  ruleName: string
  iconId: string
  description: string
  ruleLogicId: string
  grantedStatusIds: string[]
  valueA?: number
  valueB?: number
  tickIntervalMs?: number
  enabled: boolean
}

export interface EncounterStageContext {
  id: string
  areaId: string
  areaTitle: string
  stageNumber: number
  buildRuleId: string
  partyAutoDamageIntervalMs: number
  partyAutoDamageTargetCount: number
  partyAutoDamageMin: number
  partyAutoDamageMax: number
  playerAutoDamage: number
  playerAutoHeal: number
  partyAutoHeal: number
  playerMaxHp: number
  partyMaxHp: number
  partyMaxPressure: number
  damageSources: DamageSourceDefinition[]
  tuning: EncounterTuning
  affixes: EncounterAffixDefinition[]
  specialRules: EncounterSpecialRuleDefinition[]
}

export interface DamageSourceDefinition {
  sourceId: string
  sourceKind: string
  ownerSide: DamageSourceOwnerSide
  sourceTags: string[]
  intervalMs: number
  startReady: boolean
  invalidTargetPolicy: DamageSourceInvalidTargetPolicy
  targetRule: DamageSourceTargetRule
  targetSelector: string
  targetCount: number
  damageMode: DamageSourceDamageMode
  baseDamage: number
  minDamage: number
  maxDamage: number
  threatMode: DamageSourceThreatMode
  threatMultiplier: number
  flatThreat: number
  threatSource: DamageSourceThreatSource
  enabled: boolean
}

export interface DamageSourceRuntime extends DamageSourceDefinition {
  remainingMs: number
  lockedTargetId: string | null
  pausedByStatus?: boolean
}

export interface PendingAffixTrigger {
  id: string
  affixId: string
  remainingMs: number
  targetType: EncounterAffixTargetType
  targetSelector: string
  statusId: string
  durationMsOverride?: number
  valueA?: number
  valueB?: number
  tickIntervalMs?: number
  stacks: number
}

export interface EncounterStageRuleRuntimeEntry {
  initialized: boolean
  timerMs?: number
  hasEnded?: boolean
}

export type EncounterStageRuleRuntime = Record<string, EncounterStageRuleRuntimeEntry>

export interface PartyStatusRuntimeEntry {
  initialized: boolean
  intervalElapsedMs: number
  triggerCount?: number
}

export type PartyStatusRuntime = Record<string, PartyStatusRuntimeEntry>

export type EncounterCommand =
  | {
      type: 'player/select-target'
      submittedAtMs: number
      targetEnemyId: string
    }
  | {
      type: 'player/activate-skill'
      submittedAtMs: number
      skillId: SkillId
    }

export type EncounterEvent =
  | {
      type: 'player/target-selected'
      occurredAtMs: number
      targetEnemyId: string
    }
  | {
      type: 'player/skill-activated'
      occurredAtMs: number
      skillId: SkillId
    }
  | {
      type: 'player/resource-changed'
      occurredAtMs: number
      amount: number
      sourceSkillId?: SkillId
      reason: string
    }
  | {
      type: 'command/rejected'
      occurredAtMs: number
      message: string
      commandType: EncounterCommand['type']
    }
  | {
      type: 'enemy/threat-applied'
      occurredAtMs: number
      enemyId: string
      tankThreatDelta: number
      allyThreatDelta: number
    }
  | {
      type: 'enemy/status-applied'
      occurredAtMs: number
      enemyId: string
      statusId: string
      status: StatusEffect
    }
  | {
      type: 'enemy/damage-applied'
      occurredAtMs: number
      enemyId: string
      amount: number
      sourceSkillId: SkillId
      sourceOwner?: 'player' | 'party'
    }
  | {
      type: 'enemy/cast-interrupted'
      occurredAtMs: number
      enemyId: string
      skillId: string
      sourceSkillId: SkillId
      recoveryRemainingMs: number
      advanceSkillCycle: boolean
    }
  | {
      type: 'enemy/cast-controlled'
      occurredAtMs: number
      enemyId: string
      skillId: string
      sourceSkillId: SkillId
      pendingRetryCastSkillId: string | null
      advanceSkillCycle?: boolean
    }
  | {
      type: 'enemy/died'
      occurredAtMs: number
      enemyId: string
      sourceSkillId: SkillId
    }
  | {
      type: 'player/current-target-cleared'
      occurredAtMs: number
      previousTargetEnemyId: string
    }

export interface EncounterRuntime {
  classRuntime: PlayerClassRuntimeState
  periodicPlayerStunRemainingMs: number
  pendingAffixTriggers: PendingAffixTrigger[]
  stageRuleRuntime: EncounterStageRuleRuntime
  partyStatusRuntime: PartyStatusRuntime
  partyAutoDamageRemainingMs: number
  partyPressureNoGainMs: number
  partyPressureLastValue: number
  damageTakenResourceWindowRemainingMs: number
  damageTakenResourceGainedInWindow: number
  damageSources: DamageSourceRuntime[]
  commandQueue: EncounterCommand[]
  eventQueue: EncounterEvent[]
  combatLog: CombatLogEvent[]
  lastRejectedCommandMessage: string | null
  lastProcessedEvents: EncounterEvent[]
  pauseOverlay: null | 'pause'
}

export interface EncounterState {
  name: string
  stage: EncounterStageContext
  timeMs: number
  player: PlayerState
  party: PartyState
  enemies: EnemyState[]
  skills: SkillState[]
  passiveTalentIds: PassiveTalentId[]
  runtime: EncounterRuntime
  result: EncounterResult | null
}
