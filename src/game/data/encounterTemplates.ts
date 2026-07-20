import { getEnemyDefinition, getEnemyStatusDefinition } from './enemyCatalog'
import type { StageId, StageInfo } from './stageTemplates'
import { stageOrder } from './stageTemplates'
import type {
  DamageSourceDefinition,
  EncounterAffixDefinition,
  EncounterSpecialRuleDefinition,
  EncounterStageContext,
  EncounterTuning,
  EnemySeed,
  PendingAffixTrigger,
  StatusEffect,
} from '../encounter/encounterTypes'

interface EncounterTemplate {
  playerHp: number
  playerMaxHp: number
  playerResource: number
  playerGcdRemainingMs: number
  partyHp: number
  partyMaxHp: number
  partyPressure: number
  partyMaxPressure: number
  playerBuffs: StatusEffect[]
  playerDebuffs: StatusEffect[]
  partyStatuses: StatusEffect[]
  pendingAffixTriggers: PendingAffixTrigger[]
  enemies: EnemySeed[]
  stage: EncounterStageContext
}

export interface EncounterOpeningConfig {
  playerHp: number
  playerMaxHp: number
  playerResource: number
  playerGcdRemainingMs: number
  partyHp: number
  partyMaxHp: number
  partyPressure: number
  partyMaxPressure: number
  buildRuleId: string
  partyAutoDamageIntervalMs: number
  partyAutoDamageTargetCount: number
  partyAutoDamageMin: number
  partyAutoDamageMax: number
  playerAutoDamage: number
  playerAutoHeal: number
  partyAutoHeal: number
}

export interface EncounterEnemyPlacement {
  stageId: StageId
  spawnId: string
  enemyId: string
  row: number
  col: number
  nameOverride?: string
  hpOverride?: number
  maxHpOverride?: number
  openingCastSkillNum?: number
  openingTankThreat?: number
  openingAllyThreat?: number
  openingRecoveryRemainingMs?: number
}

export type EncounterOpeningStatusTargetType = 'player' | 'party' | 'enemy'
export type EncounterOpeningStatusSourceType = 'manual' | 'affix' | 'specialRule'

export interface EncounterOpeningStatusEntry {
  stageId: StageId
  targetType: EncounterOpeningStatusTargetType
  targetId?: string
  statusId: string
  durationMsOverride?: number
  stacks?: number
  sourceType: EncounterOpeningStatusSourceType
  sourceId?: string
}

export interface EncounterAffixBinding {
  stageId: StageId
  affixIds: string[]
}

export interface EncounterSpecialRuleBinding {
  stageId: StageId
  ruleIds: string[]
}

export interface EncounterWorkbookOverrides {
  openingOverrides: Partial<Record<StageId, Partial<EncounterOpeningConfig>>>
  placementOverrides: Partial<Record<StageId, EncounterEnemyPlacement[]>>
  openingStatusOverrides: Partial<Record<StageId, EncounterOpeningStatusEntry[]>>
  affixBindings: Partial<Record<StageId, string[]>>
  affixDefinitions: Record<string, EncounterAffixDefinition>
  specialRuleBindings: Partial<Record<StageId, string[]>>
  specialRuleDefinitions: Record<string, EncounterSpecialRuleDefinition>
}

function createDefaultStageDamageSources(opening: EncounterOpeningConfig): DamageSourceDefinition[] {
  if (opening.partyAutoDamageIntervalMs <= 0 || opening.partyAutoDamageTargetCount <= 0) {
    return []
  }

  return [
    {
      sourceId: 'party_ambient_random',
      sourceKind: 'party_ambient_random',
      ownerSide: 'party',
      sourceTags: ['party', 'ambient', 'random'],
      intervalMs: opening.partyAutoDamageIntervalMs,
      startReady: false,
      invalidTargetPolicy: 'retargetLivingEnemy',
      targetRule: 'randomLivingEnemy',
      targetSelector: 'randomLivingEnemy',
      targetCount: opening.partyAutoDamageTargetCount,
      damageMode: 'randomRange',
      baseDamage: 0,
      minDamage: opening.partyAutoDamageMin,
      maxDamage: opening.partyAutoDamageMax,
      threatMode: 'formula',
      threatMultiplier: 1,
      flatThreat: 0,
      threatSource: 'party',
      enabled: true,
    },
  ]
}

function createPlayerAutoDamageDefinition(damage: number): DamageSourceDefinition {
  return {
    sourceId: 'player_auto_attack',
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
    baseDamage: damage,
    minDamage: damage,
    maxDamage: damage,
    threatMode: 'formula',
    threatMultiplier: 5,
    flatThreat: 0,
    threatSource: 'player',
    enabled: true,
  }
}

const BASE_STAGE_LAYOUT_ENEMY_IDS: Record<StageId, string[]> = {
  'harbor-1': ['harbor_raider', 'harbor_pyromancer', 'harbor_raider', 'harbor_breaker', 'harbor_pyromancer', 'harbor_stalker', 'harbor_commander'],
  'harbor-2': ['harbor_raider', 'harbor_pyromancer', 'harbor_pyromancer', 'harbor_raider', 'harbor_breaker', 'harbor_stalker', 'harbor_raider', 'harbor_commander'],
  'harbor-3': ['harbor_stalker', 'harbor_raider', 'harbor_pyromancer', 'harbor_breaker', 'harbor_pyromancer', 'harbor_raider', 'harbor_stalker', 'harbor_commander'],
  'harbor-4': ['harbor_raider', 'harbor_breaker', 'harbor_pyromancer', 'harbor_stalker', 'harbor_pyromancer', 'harbor_raider', 'harbor_breaker', 'harbor_raider', 'harbor_commander'],
  'harbor-5': ['harbor_stalker', 'harbor_pyromancer', 'harbor_raider', 'harbor_breaker', 'harbor_raider', 'harbor_pyromancer', 'harbor_stalker', 'harbor_breaker', 'harbor_raider', 'harbor_commander'],
  'harbor-6': ['harbor_raider', 'harbor_pyromancer', 'harbor_stalker', 'harbor_breaker', 'harbor_pyromancer', 'harbor_raider', 'harbor_breaker', 'harbor_stalker', 'harbor_pyromancer', 'harbor_commander'],
  'midland-1': ['midland_raider', 'midland_pyromancer', 'midland_stalker', 'midland_raider', 'midland_breaker', 'midland_pyromancer', 'midland_stalker', 'midland_commander'],
  'midland-2': ['midland_pyromancer', 'midland_stalker', 'midland_raider', 'midland_breaker', 'midland_pyromancer', 'midland_raider', 'midland_stalker', 'midland_raider', 'midland_commander'],
  'midland-3': ['midland_stalker', 'midland_pyromancer', 'midland_raider', 'midland_breaker', 'midland_stalker', 'midland_pyromancer', 'midland_raider', 'midland_breaker', 'midland_commander'],
  'midland-4': ['midland_raider', 'midland_pyromancer', 'midland_stalker', 'midland_breaker', 'midland_pyromancer', 'midland_raider', 'midland_stalker', 'midland_breaker', 'midland_raider', 'midland_commander'],
  'midland-5': ['midland_pyromancer', 'midland_stalker', 'midland_raider', 'midland_breaker', 'midland_pyromancer', 'midland_stalker', 'midland_raider', 'midland_breaker', 'midland_pyromancer', 'midland_raider', 'midland_commander'],
  'midland-6': ['midland_stalker', 'midland_pyromancer', 'midland_raider', 'midland_breaker', 'midland_stalker', 'midland_pyromancer', 'midland_raider', 'midland_breaker', 'midland_raider', 'midland_pyromancer', 'midland_commander'],
  'highland-1': ['highland_breaker', 'highland_pyromancer', 'highland_raider', 'highland_stalker', 'highland_breaker', 'highland_pyromancer', 'highland_raider', 'highland_commander', 'highland_raider'],
  'highland-2': ['highland_breaker', 'highland_pyromancer', 'highland_stalker', 'highland_raider', 'highland_breaker', 'highland_pyromancer', 'highland_raider', 'highland_commander', 'highland_stalker', 'highland_raider'],
  'highland-3': ['highland_breaker', 'highland_pyromancer', 'highland_stalker', 'highland_raider', 'highland_breaker', 'highland_pyromancer', 'highland_raider', 'highland_commander', 'highland_breaker', 'highland_raider'],
  'highland-4': ['highland_breaker', 'highland_pyromancer', 'highland_stalker', 'highland_raider', 'highland_commander', 'highland_pyromancer', 'highland_breaker', 'highland_raider', 'highland_stalker', 'highland_breaker', 'highland_raider'],
  'highland-5': ['highland_breaker', 'highland_pyromancer', 'highland_stalker', 'highland_raider', 'highland_commander', 'highland_pyromancer', 'highland_breaker', 'highland_raider', 'highland_stalker', 'highland_breaker', 'highland_pyromancer'],
  'highland-6': ['highland_commander', 'highland_breaker', 'highland_pyromancer', 'highland_stalker', 'highland_breaker', 'highland_pyromancer', 'highland_raider', 'highland_commander', 'highland_stalker', 'highland_breaker', 'highland_pyromancer', 'highland_raider'],
}

function createBasePlacements(stageId: StageId, enemyIds: string[]): EncounterEnemyPlacement[] {
  return enemyIds.map((enemyId, index) => ({
    stageId,
    spawnId: `${stageId}-e${String(index + 1).padStart(2, '0')}`,
    enemyId,
    row: Math.floor(index / 5) + 1,
    col: (index % 5) + 1,
  }))
}

const BASE_STAGE_ENEMY_PLACEMENTS: Record<StageId, EncounterEnemyPlacement[]> = Object.fromEntries(
  stageOrder.map((stageId) => [stageId, createBasePlacements(stageId, BASE_STAGE_LAYOUT_ENEMY_IDS[stageId])]),
) as Record<StageId, EncounterEnemyPlacement[]>

const BASE_STAGE_OPENING_OVERRIDES: Partial<Record<StageId, Partial<EncounterOpeningConfig>>> = {
  'harbor-1': {
    playerHp: 900,
    playerMaxHp: 1000,
    playerResource: 56,
    playerGcdRemainingMs: 0,
    partyHp: 930,
    partyMaxHp: 1000,
    partyPressure: 18,
    partyMaxPressure: 100,
    buildRuleId: 'tutorial_2slot',
    partyAutoDamageIntervalMs: 1000,
    partyAutoDamageTargetCount: 1,
    partyAutoDamageMin: 10,
    partyAutoDamageMax: 20,
    playerAutoDamage: 3,
    playerAutoHeal: 0,
    partyAutoHeal: 0,
  },
  'midland-2': {
    playerHp: 884,
    playerMaxHp: 1000,
    playerResource: 46,
    playerGcdRemainingMs: 0,
    partyHp: 912,
    partyMaxHp: 1000,
    partyPressure: 33,
    partyMaxPressure: 100,
    buildRuleId: 'standard_5slot',
    partyAutoDamageIntervalMs: 1000,
    partyAutoDamageTargetCount: 2,
    partyAutoDamageMin: 12,
    partyAutoDamageMax: 24,
    playerAutoDamage: 3,
    playerAutoHeal: 0,
    partyAutoHeal: 0,
  },
  'highland-4': {
    playerHp: 828,
    playerMaxHp: 1000,
    playerResource: 36,
    playerGcdRemainingMs: 0,
    partyHp: 846,
    partyMaxHp: 1000,
    partyPressure: 58,
    partyMaxPressure: 100,
    buildRuleId: 'full_8slot',
    partyAutoDamageIntervalMs: 1000,
    partyAutoDamageTargetCount: 2,
    partyAutoDamageMin: 16,
    partyAutoDamageMax: 30,
    playerAutoDamage: 3,
    playerAutoHeal: 0,
    partyAutoHeal: 0,
  },
}

const BASE_STAGE_OPENING_STATUS_OVERRIDES: Partial<Record<StageId, EncounterOpeningStatusEntry[]>> = {
  'harbor-1': [
    {
      stageId: 'harbor-1',
      targetType: 'enemy',
      targetId: 'harbor-1-e02',
      statusId: 'ember-aegis',
      durationMsOverride: 3800,
      stacks: 1,
      sourceType: 'manual',
    },
  ],
  'midland-2': [
    {
      stageId: 'midland-2',
      targetType: 'party',
      statusId: 'suppression',
      durationMsOverride: 2600,
      stacks: 1,
      sourceType: 'manual',
    },
  ],
  'highland-4': [
    {
      stageId: 'highland-4',
      targetType: 'enemy',
      targetId: 'highland-4-e05',
      statusId: 'enraged',
      durationMsOverride: 5200,
      stacks: 1,
      sourceType: 'manual',
    },
  ],
}

const BASE_AFFIX_DEFINITIONS: Record<string, EncounterAffixDefinition> = {
  harbor_opening_guard: {
    affixId: 'harbor_opening_guard',
    affixName: '港口护幕',
    iconId: 'ember-aegis',
    description: '战斗开始后短时间内为前排施法敌人挂上护幕。',
    delayMs: 1600,
    targetType: 'enemy',
    targetSelector: 'frontRow',
    statusId: 'ember-aegis',
    durationMsOverride: 3600,
    stacks: 1,
    enabled: true,
  },
  midland_pressure_spike: {
    affixId: 'midland_pressure_spike',
    affixName: '腹地压制',
    iconId: 'suppression',
    description: '战斗开始后短时间内直接给队伍挂上压制。',
    delayMs: 2200,
    targetType: 'party',
    targetSelector: 'party',
    statusId: 'suppression',
    durationMsOverride: 3200,
    stacks: 1,
    enabled: true,
  },
  highland_blood_song: {
    affixId: 'highland_blood_song',
    affixName: '高地战歌',
    iconId: 'enrage-song',
    description: '战斗开始后给首领单位挂上战歌或狂怒类强化。',
    delayMs: 2400,
    targetType: 'enemy',
    targetSelector: 'skullOnly',
    statusId: 'enrage-song',
    durationMsOverride: 4200,
    stacks: 1,
    enabled: true,
  },
}

const BASE_STAGE_AFFIX_BINDINGS: Partial<Record<StageId, string[]>> = {
  'harbor-1': ['harbor_opening_guard'],
  'midland-2': ['midland_pressure_spike'],
  'highland-4': ['highland_blood_song'],
}

const BASE_SPECIAL_RULE_DEFINITIONS: Record<string, EncounterSpecialRuleDefinition> = {
  opening_pressure_shift: {
    ruleId: 'opening_pressure_shift',
    ruleName: '开场承压偏移',
    iconId: 'battle-seal',
    description: '战斗开始时一次性提高队伍压力，当前样例为 +8。',
    ruleLogicId: 'opening_pressure_shift',
    grantedStatusIds: ['suppression'],
    enabled: true,
  },
  periodic_reinforcement: {
    ruleId: 'periodic_reinforcement',
    ruleName: '周期强化',
    iconId: 'enrage-song',
    description: '战斗中每隔 3 秒给第一个存活敌人施加战歌。',
    ruleLogicId: 'periodic_reinforcement',
    grantedStatusIds: ['enrage-song'],
    enabled: true,
  },
  player_control_tax: {
    ruleId: 'player_control_tax',
    ruleName: '控制税',
    iconId: 'stunned',
    description: '玩家处于昏迷时，每隔 1 秒提高队伍压力，当前样例为 +6。',
    ruleLogicId: 'player_control_tax',
    grantedStatusIds: ['stunned'],
    enabled: true,
  },
}

const BASE_STAGE_SPECIAL_RULE_BINDINGS: Partial<Record<StageId, string[]>> = {
  'harbor-1': ['opening_pressure_shift'],
  'midland-2': ['periodic_reinforcement'],
  'highland-4': ['player_control_tax'],
}

function cloneStatus(status: StatusEffect): StatusEffect {
  return { ...status }
}

function clonePlacement(placement: EncounterEnemyPlacement): EncounterEnemyPlacement {
  return { ...placement }
}

function cloneAffixDefinition(definition: EncounterAffixDefinition): EncounterAffixDefinition {
  return { ...definition }
}

function cloneSpecialRuleDefinition(definition: EncounterSpecialRuleDefinition): EncounterSpecialRuleDefinition {
  return {
    ...definition,
    grantedStatusIds: [...definition.grantedStatusIds],
  }
}

function cloneOpeningStatusEntry(entry: EncounterOpeningStatusEntry): EncounterOpeningStatusEntry {
  return { ...entry }
}

function clonePendingAffixTrigger(trigger: PendingAffixTrigger): PendingAffixTrigger {
  return { ...trigger }
}

function clonePlacementsRecord(source: Record<StageId, EncounterEnemyPlacement[]>) {
  return Object.fromEntries(
    Object.entries(source).map(([stageId, placements]) => [stageId, placements.map(clonePlacement)]),
  ) as Record<StageId, EncounterEnemyPlacement[]>
}

function cloneOpeningOverrides(
  source: Partial<Record<StageId, Partial<EncounterOpeningConfig>>>,
) {
  return Object.fromEntries(
    Object.entries(source).map(([stageId, opening]) => [stageId, opening ? { ...opening } : undefined]),
  ) as Partial<Record<StageId, Partial<EncounterOpeningConfig>>>
}

function cloneOpeningStatusOverrides(
  source: Partial<Record<StageId, EncounterOpeningStatusEntry[]>>,
) {
  return Object.fromEntries(
    Object.entries(source).map(([stageId, entries]) => [stageId, entries?.map(cloneOpeningStatusEntry) ?? []]),
  ) as Partial<Record<StageId, EncounterOpeningStatusEntry[]>>
}

function cloneStringArrayRecord(source: Partial<Record<StageId, string[]>>) {
  return Object.fromEntries(
    Object.entries(source).map(([stageId, values]) => [stageId, values ? [...values] : []]),
  ) as Partial<Record<StageId, string[]>>
}

function cloneAffixDefinitions(source: Record<string, EncounterAffixDefinition>) {
  return Object.fromEntries(
    Object.entries(source).map(([id, definition]) => [id, cloneAffixDefinition(definition)]),
  ) as Record<string, EncounterAffixDefinition>
}

function cloneSpecialRuleDefinitions(source: Record<string, EncounterSpecialRuleDefinition>) {
  return Object.fromEntries(
    Object.entries(source).map(([id, definition]) => [id, cloneSpecialRuleDefinition(definition)]),
  ) as Record<string, EncounterSpecialRuleDefinition>
}

export let STAGE_OPENING_OVERRIDES = cloneOpeningOverrides(BASE_STAGE_OPENING_OVERRIDES)
export let STAGE_ENEMY_PLACEMENTS = clonePlacementsRecord(BASE_STAGE_ENEMY_PLACEMENTS)
export let STAGE_OPENING_STATUS_OVERRIDES = cloneOpeningStatusOverrides(BASE_STAGE_OPENING_STATUS_OVERRIDES)
export let STAGE_AFFIX_BINDINGS = cloneStringArrayRecord(BASE_STAGE_AFFIX_BINDINGS)
export let AFFIX_DEFINITIONS = cloneAffixDefinitions(BASE_AFFIX_DEFINITIONS)
export let STAGE_SPECIAL_RULE_BINDINGS = cloneStringArrayRecord(BASE_STAGE_SPECIAL_RULE_BINDINGS)
export let SPECIAL_RULE_DEFINITIONS = cloneSpecialRuleDefinitions(BASE_SPECIAL_RULE_DEFINITIONS)

export interface AppendEncounterWorkbookOverridesOptions {
  stageIdPrefix: string
}

function shouldApplyStageOverride(stageId: StageId, stageIdPrefix?: string) {
  return !stageIdPrefix || stageId.startsWith(stageIdPrefix)
}

function applyEncounterOverridesToCurrentCatalog(
  overrides: EncounterWorkbookOverrides,
  stageIdPrefix?: string,
) {
  for (const [stageId, opening] of Object.entries(overrides.openingOverrides) as [
    StageId,
    Partial<EncounterOpeningConfig>,
  ][]) {
    if (!shouldApplyStageOverride(stageId, stageIdPrefix)) {
      continue
    }
    STAGE_OPENING_OVERRIDES[stageId] = {
      ...STAGE_OPENING_OVERRIDES[stageId],
      ...opening,
    }
  }

  for (const [stageId, placements] of Object.entries(overrides.placementOverrides) as [
    StageId,
    EncounterEnemyPlacement[],
  ][]) {
    if (!shouldApplyStageOverride(stageId, stageIdPrefix)) {
      continue
    }
    if (placements.length > 0) {
      STAGE_ENEMY_PLACEMENTS[stageId] = placements.map(clonePlacement)
    }
  }

  for (const [stageId, entries] of Object.entries(overrides.openingStatusOverrides) as [
    StageId,
    EncounterOpeningStatusEntry[],
  ][]) {
    if (!shouldApplyStageOverride(stageId, stageIdPrefix)) {
      continue
    }
    STAGE_OPENING_STATUS_OVERRIDES[stageId] = entries.map(cloneOpeningStatusEntry)
  }

  for (const [stageId, affixIds] of Object.entries(overrides.affixBindings) as [StageId, string[]][]) {
    if (!shouldApplyStageOverride(stageId, stageIdPrefix)) {
      continue
    }
    STAGE_AFFIX_BINDINGS[stageId] = [...affixIds]
  }

  for (const [affixId, definition] of Object.entries(overrides.affixDefinitions)) {
    AFFIX_DEFINITIONS[affixId] = cloneAffixDefinition(definition)
  }

  for (const [stageId, ruleIds] of Object.entries(overrides.specialRuleBindings) as [StageId, string[]][]) {
    if (!shouldApplyStageOverride(stageId, stageIdPrefix)) {
      continue
    }
    STAGE_SPECIAL_RULE_BINDINGS[stageId] = [...ruleIds]
  }

  for (const [ruleId, definition] of Object.entries(overrides.specialRuleDefinitions)) {
    SPECIAL_RULE_DEFINITIONS[ruleId] = cloneSpecialRuleDefinition(definition)
  }
}

export function applyEncounterWorkbookOverrides(overrides: EncounterWorkbookOverrides) {
  STAGE_OPENING_OVERRIDES = cloneOpeningOverrides(BASE_STAGE_OPENING_OVERRIDES)
  STAGE_ENEMY_PLACEMENTS = clonePlacementsRecord(BASE_STAGE_ENEMY_PLACEMENTS)
  STAGE_OPENING_STATUS_OVERRIDES = cloneOpeningStatusOverrides(BASE_STAGE_OPENING_STATUS_OVERRIDES)
  STAGE_AFFIX_BINDINGS = cloneStringArrayRecord(BASE_STAGE_AFFIX_BINDINGS)
  AFFIX_DEFINITIONS = cloneAffixDefinitions(BASE_AFFIX_DEFINITIONS)
  STAGE_SPECIAL_RULE_BINDINGS = cloneStringArrayRecord(BASE_STAGE_SPECIAL_RULE_BINDINGS)
  SPECIAL_RULE_DEFINITIONS = cloneSpecialRuleDefinitions(BASE_SPECIAL_RULE_DEFINITIONS)

  applyEncounterOverridesToCurrentCatalog(overrides)
}

export function appendEncounterWorkbookOverrides(
  overrides: EncounterWorkbookOverrides,
  options: AppendEncounterWorkbookOverridesOptions,
) {
  applyEncounterOverridesToCurrentCatalog(overrides, options.stageIdPrefix)
}

function makeStatus(
  id: string,
  label: string,
  shortLabel: string,
  remainingMs: number,
  tone: StatusEffect['tone'],
  kind: StatusEffect['kind'],
): StatusEffect {
  return {
    id,
    iconId: getEnemyStatusDefinition(id)?.iconId ?? id,
    label,
    shortLabel,
    remainingMs,
    totalMs: remainingMs,
    tone,
    kind,
  }
}

function createConfiguredStatus(statusId: string, durationMsOverride?: number): StatusEffect | null {
  const definition = getEnemyStatusDefinition(statusId)

  if (!definition) {
    return null
  }

  const durationMs = durationMsOverride ?? definition.durationMs
  const tone: StatusEffect['tone'] = definition.kind === 'enemyBuff' ? 'buff' : 'danger'

  return {
    id: definition.statusId,
    iconId: definition.iconId,
    label: definition.statusName,
    shortLabel: definition.statusName.slice(0, 1),
    remainingMs: durationMs,
    totalMs: durationMs,
    tone,
    kind: definition.kind,
    effectLogicId: definition.effectLogicId,
    ...(typeof definition.valueA === 'number' ? { valueA: definition.valueA } : {}),
    ...(typeof definition.valueB === 'number' ? { valueB: definition.valueB } : {}),
    ...(typeof definition.tickIntervalMs === 'number' ? { tickIntervalMs: definition.tickIntervalMs } : {}),
  }
}

function appendOrReplaceStatus(statuses: StatusEffect[], nextStatus: StatusEffect) {
  return [
    ...statuses.filter((status) => status.id !== nextStatus.id),
    cloneStatus(nextStatus),
  ]
}

function createInitialStatuses(
  stage: StageInfo,
  skillCycle: string[],
  threatLogic: EnemySeed['threatLogic'],
  index: number,
): StatusEffect[] {
  const duration = 3_200 + stage.stageNumber * 300
  const hasSkill = (skillId: string) => skillCycle.includes(skillId)

  if (hasSkill('ember-bolt') || hasSkill('dark-mend')) {
    if (stage.areaId === 'harbor') {
      return [makeStatus('ember-aegis', '余烬护幕', '幕', duration, 'buff', 'enemyBuff')]
    }

    if (stage.areaId === 'midland') {
      return [makeStatus('haste', '急速', '急', duration, 'buff', 'enemyBuff')]
    }

    return [makeStatus('enrage-song', '战歌', '歌', duration + 1_000, 'buff', 'enemyBuff')]
  }

  if (hasSkill('backstab')) {
    return [makeStatus('evasion', '闪避', '闪', duration - 200, 'buff', 'enemyBuff')]
  }

  if (hasSkill('guard-breaker') && stage.areaId === 'midland') {
    return [makeStatus('guarded', '守备', '守', duration + 500, 'buff', 'enemyBuff')]
  }

  if (threatLogic === 'bloodlust') {
    return [
      makeStatus('fortified', '强化', '强', duration + 800, 'buff', 'enemyBuff'),
      ...(stage.stageNumber >= 4 || index % 2 === 0
        ? [makeStatus('enraged', '狂怒', '怒', duration + 1_000, 'buff', 'enemyBuff')]
        : []),
    ]
  }

  return []
}

function createBaseStageTuning(stage: StageInfo): EncounterTuning {
  const levelFactor = stage.stageNumber - 1

  switch (stage.areaId) {
    case 'harbor':
      return {
        ambientPressurePerSecond: 0.7 + levelFactor * 0.22,
        enemyCastTimeMultiplier: 1 - levelFactor * 0.01,
        enemyDamageMultiplier: 0.92 + levelFactor * 0.03,
        enemyHealingMultiplier: 1 + levelFactor * 0.03,
        playerResourceRegenMultiplier: 1.08,
        warningLabel: '港区接怪线正在承压。',
        victoryReason: '港区火线已被稳住。',
        defeatPlayerReason: '港区前线坦克倒下，堑口失守。',
        defeatPartyReason: '港区后排被点穿，战线崩溃。',
        defeatPressureReason: '港区后排压力爆表，战线失控。',
      }
    case 'midland':
      return {
        ambientPressurePerSecond: 1.2 + levelFactor * 0.28,
        enemyCastTimeMultiplier: 0.94 - levelFactor * 0.006,
        enemyDamageMultiplier: 1 + levelFactor * 0.035,
        enemyHealingMultiplier: 1.08 + levelFactor * 0.04,
        playerResourceRegenMultiplier: 1,
        warningLabel: '腹地联动条正在快速抬升压力。',
        victoryReason: '腹地联动点已被逐层拆净。',
        defeatPlayerReason: '腹地减伤错位，坦克被连续压穿。',
        defeatPartyReason: '腹地后排在联动点名中被迅速压垮。',
        defeatPressureReason: '腹地联动压力失控，队伍被逼溃散。',
      }
    case 'highland':
      return {
        ambientPressurePerSecond: 1.8 + levelFactor * 0.34,
        enemyCastTimeMultiplier: 0.92 - levelFactor * 0.004,
        enemyDamageMultiplier: 1.12 + levelFactor * 0.04,
        enemyHealingMultiplier: 1.2 + levelFactor * 0.05,
        playerResourceRegenMultiplier: 0.94,
        warningLabel: '高地长线压力正在滚雪球。',
        victoryReason: '高地终局节奏已被彻底顶住。',
        defeatPlayerReason: '高地重击链成型，坦克被直接击穿。',
        defeatPartyReason: '高地后排在长线承压中被拖到崩盘。',
        defeatPressureReason: '高地压力线拉满，整队被迫崩盘。',
      }
    default:
      return {
        ambientPressurePerSecond: 1,
        enemyCastTimeMultiplier: 1,
        enemyDamageMultiplier: 1,
        enemyHealingMultiplier: 1,
        playerResourceRegenMultiplier: 1,
        warningLabel: '战线承压正在升高。',
        victoryReason: '战斗顺利结束。',
        defeatPlayerReason: '坦克倒下，战线崩溃。',
        defeatPartyReason: '队伍血量归零，战斗失败。',
        defeatPressureReason: '后排压力爆表，队伍溃散。',
      }
  }
}

function createStageTuning(stage: StageInfo): EncounterTuning {
  return createBaseStageTuning(stage)
}

function getBaseBuildRuleId(stage: StageInfo) {
  if (stage.areaId === 'harbor') {
    if (stage.stageNumber === 1) {
      return 'tutorial_2slot'
    }
    if (stage.stageNumber === 2) {
      return 'tutorial_3slot'
    }
    if (stage.stageNumber === 3) {
      return 'tutorial_4slot'
    }
    if (stage.stageNumber === 4) {
      return 'tutorial_5slot'
    }
    return 'standard_5slot'
  }

  return stage.areaId === 'highland' ? 'full_8slot' : 'standard_5slot'
}

function createOpeningConfig(stage: StageInfo): EncounterOpeningConfig {
  const isHarbor = stage.areaId === 'harbor'
  const isMidland = stage.areaId === 'midland'
  const isHighland = stage.areaId === 'highland'
  const partyPressureBase = isHarbor ? 18 : isMidland ? 28 : 38
  const playerResourceBase = isHarbor ? 56 : isMidland ? 48 : 42

  const baseOpening: EncounterOpeningConfig = {
    playerHp: 900 - (stage.stageNumber - 1) * (isHighland ? 24 : 16),
    playerMaxHp: 1000,
    playerResource: playerResourceBase - (stage.stageNumber - 1) * 2,
    playerGcdRemainingMs: 0,
    partyHp: 930 - (stage.stageNumber - 1) * (isHighland ? 28 : 18),
    partyMaxHp: 1000,
    partyPressure: partyPressureBase + (stage.stageNumber - 1) * (isHighland ? 8 : 5),
    partyMaxPressure: 100,
    buildRuleId: getBaseBuildRuleId(stage),
    partyAutoDamageIntervalMs: 1000,
    partyAutoDamageTargetCount: stage.stageNumber <= 2 ? 1 : 2,
    partyAutoDamageMin: isHarbor ? 10 : isMidland ? 12 : 16,
    partyAutoDamageMax: isHarbor ? 20 : isMidland ? 24 : 30,
    playerAutoDamage: 3,
    playerAutoHeal: 0,
    partyAutoHeal: 0,
  }

  return {
    ...baseOpening,
    ...STAGE_OPENING_OVERRIDES[stage.id],
  }
}

export function getStageBuildRuleId(stage: StageInfo) {
  return createOpeningConfig(stage).buildRuleId
}

function createEnemySeed(
  stage: StageInfo,
  opening: Pick<EncounterOpeningConfig, 'playerHp' | 'partyHp'>,
  placement: EncounterEnemyPlacement,
  index: number,
): EnemySeed {
  const definition = getEnemyDefinition(placement.enemyId)

  if (!definition) {
    throw new Error(`Unknown enemy definition: ${placement.enemyId}`)
  }

  const baseMaxHp = definition.baseMaxHp
  const maxHp = placement.maxHpOverride ?? baseMaxHp
  const hp = placement.hpOverride ?? maxHp
  const skillCycle = [...definition.skillCycle]
  const threatLogic = definition.threatLogic
  const tankThreat = placement.openingTankThreat ?? 0
  const allyThreat = placement.openingAllyThreat ?? 0
  const target =
    threatLogic === 'bloodlust'
      ? opening.playerHp <= opening.partyHp ? ('tank' as const) : ('ally' as const)
      : allyThreat > tankThreat ? ('ally' as const) : ('tank' as const)
  const threatState = target === 'ally' ? ('lost' as const) : ('warning' as const)
  const openingCastSkillNum = Math.max(1, Math.floor(placement.openingCastSkillNum ?? 1))
  const skillCycleIndex = skillCycle.length > 0
    ? Math.min(skillCycle.length - 1, openingCastSkillNum - 1)
    : 0
  const initialStatuses = createInitialStatuses(
    stage,
    skillCycle,
    threatLogic,
    index,
  )

  return {
    id: placement.spawnId,
    definitionId: definition.enemyId,
    name: placement.nameOverride ?? definition.name,
    row: placement.row,
    col: placement.col,
    hp,
    maxHp,
    skillIds: [...definition.skillIds],
    skillCycle,
    skillCycleIndex,
    threatLogic,
    target,
    threatState,
    tankThreat,
    allyThreat,
    isSkull: definition.isSkull,
    statuses: initialStatuses,
    cast: null,
    recoveryRemainingMs: placement.openingRecoveryRemainingMs ?? 0,
    pendingRetryCastSkillId: null,
  }
}

function applyOpeningStatuses(
  stageId: StageId,
  enemies: EnemySeed[],
) {
  const entries = STAGE_OPENING_STATUS_OVERRIDES[stageId] ?? []
  let nextEnemies = enemies.map((enemy) => ({
    ...enemy,
    skillIds: [...enemy.skillIds],
    skillCycle: [...enemy.skillCycle],
    statuses: enemy.statuses.map(cloneStatus),
    cast: enemy.cast ? { ...enemy.cast } : null,
  }))
  let playerBuffs: StatusEffect[] = []
  let playerDebuffs: StatusEffect[] = []
  let partyStatuses: StatusEffect[] = []

  for (const entry of entries) {
    const status = createConfiguredStatus(entry.statusId, entry.durationMsOverride)

    if (!status) {
      continue
    }

    if (entry.targetType === 'enemy' && entry.targetId) {
      nextEnemies = nextEnemies.map((enemy) =>
        enemy.id === entry.targetId
          ? {
              ...enemy,
              statuses: appendOrReplaceStatus(enemy.statuses, status),
            }
          : enemy,
      )
      continue
    }

    if (entry.targetType === 'player') {
      if (status.kind === 'enemyBuff') {
        playerBuffs = appendOrReplaceStatus(playerBuffs, { ...status, tone: 'buff', kind: 'neutral' })
      } else {
        playerDebuffs = appendOrReplaceStatus(playerDebuffs, status)
      }
      continue
    }

    if (entry.targetType === 'party') {
      partyStatuses = appendOrReplaceStatus(partyStatuses, status)
    }
  }

  return {
    enemies: nextEnemies,
    playerBuffs,
    playerDebuffs,
    partyStatuses,
  }
}

function createPendingAffixTriggers(stageId: StageId): PendingAffixTrigger[] {
  const affixIds = STAGE_AFFIX_BINDINGS[stageId] ?? []

  return affixIds
    .map((affixId) => AFFIX_DEFINITIONS[affixId])
    .filter((definition): definition is EncounterAffixDefinition => Boolean(definition?.enabled))
    .map((definition) => ({
      id: `${stageId}-${definition.affixId}`,
      affixId: definition.affixId,
      remainingMs: definition.delayMs,
      targetType: definition.targetType,
      targetSelector: definition.targetSelector,
      statusId: definition.statusId,
      durationMsOverride: definition.durationMsOverride,
      ...(typeof definition.valueA === 'number' ? { valueA: definition.valueA } : {}),
      ...(typeof definition.valueB === 'number' ? { valueB: definition.valueB } : {}),
      ...(typeof definition.tickIntervalMs === 'number' ? { tickIntervalMs: definition.tickIntervalMs } : {}),
      stacks: definition.stacks,
    }))
}

function getStageAffixDefinitions(stageId: StageId) {
  return (STAGE_AFFIX_BINDINGS[stageId] ?? [])
    .map((affixId) => AFFIX_DEFINITIONS[affixId])
    .filter((definition): definition is EncounterAffixDefinition => Boolean(definition))
    .map(cloneAffixDefinition)
}

function getStageSpecialRuleDefinitions(stageId: StageId) {
  return (STAGE_SPECIAL_RULE_BINDINGS[stageId] ?? [])
    .map((ruleId) => SPECIAL_RULE_DEFINITIONS[ruleId])
    .filter((definition): definition is EncounterSpecialRuleDefinition => Boolean(definition))
    .map(cloneSpecialRuleDefinition)
}

export function createEncounterTemplate(stage: StageInfo): EncounterTemplate {
  const tuning = createStageTuning(stage)
  const opening = createOpeningConfig(stage)
  const placements = STAGE_ENEMY_PLACEMENTS[stage.id] ?? []
  const enemies = placements.map((placement, index) => createEnemySeed(stage, opening, placement, index))
  const openingStatusState = applyOpeningStatuses(stage.id, enemies)
  const stageAffixes = getStageAffixDefinitions(stage.id)
  const stageSpecialRules = getStageSpecialRuleDefinitions(stage.id)

  return {
    ...opening,
    playerBuffs: openingStatusState.playerBuffs,
    playerDebuffs: openingStatusState.playerDebuffs,
    partyStatuses: openingStatusState.partyStatuses,
    pendingAffixTriggers: createPendingAffixTriggers(stage.id).map(clonePendingAffixTrigger),
    enemies: openingStatusState.enemies,
    stage: {
      id: stage.id,
      areaId: stage.areaId,
      areaTitle: stage.areaTitle,
      stageNumber: stage.stageNumber,
      buildRuleId: opening.buildRuleId,
      partyAutoDamageIntervalMs: opening.partyAutoDamageIntervalMs,
      partyAutoDamageTargetCount: opening.partyAutoDamageTargetCount,
      partyAutoDamageMin: opening.partyAutoDamageMin,
      partyAutoDamageMax: opening.partyAutoDamageMax,
      playerAutoDamage: opening.playerAutoDamage,
      playerAutoHeal: opening.playerAutoHeal,
      partyAutoHeal: opening.partyAutoHeal,
      playerMaxHp: opening.playerMaxHp,
      partyMaxHp: opening.partyMaxHp,
      partyMaxPressure: opening.partyMaxPressure,
      damageSources: [
        ...createDefaultStageDamageSources(opening),
        createPlayerAutoDamageDefinition(opening.playerAutoDamage),
      ],
      tuning,
      affixes: stageAffixes,
      specialRules: stageSpecialRules,
    },
  }
}
