import type {
  ActiveSkillDefinition,
  ActiveSkillEffectDefinition,
  BuildConflictWarning,
  BuildIconDefinition,
  BuildNormalizationResult,
  BuildPresetActiveEntry,
  BuildPresetPassiveEntry,
  BuildRuleDefinition,
  PassiveTalentDefinition,
  PassiveTalentEffectDefinition,
  PassiveTalentId,
  PassiveTalentModifiers,
  PersistedBuildState,
  PlayerClassId,
  PlayerClassDefinition,
  PlayerBuildStatusDefinition,
  SkillHotkey,
  SkillId,
  SkillLoadout,
  SkillState,
  StatusEffect,
} from '../encounter/encounterTypes'
import { applySkillTemplateMutation } from './playerSkillLogicRegistry'
import { applyPassiveTalentLogic } from './playerTalentLogicRegistry'
import { WARRIOR_T_CLASS_ID } from '../playerClasses/playerClassRuntimeRegistry'

export const SKILL_HOTKEYS: SkillHotkey[] = ['1', '2', '3', '4', 'Q', 'E', 'R', 'F']
export const ACTIVE_SKILL_POINT_COST = 4

const HOTKEY_ORDER = new Map(SKILL_HOTKEYS.map((hotkey, index) => [hotkey, index]))

interface BuildRuleWorkbookOverride {
  buildRuleId: string
  classId?: string
  ruleName?: string
  description?: string
  totalBuildPoints?: number
  maxActiveSlots?: number
  enabledHotkeys?: SkillHotkey[]
  inheritancePolicy?: BuildRuleDefinition['inheritancePolicy']
  enabled?: boolean
}

interface PlayerClassWorkbookOverride {
  classId: string
  className?: string
  roleTag?: PlayerClassDefinition['roleTag']
  classDescription?: string
  recommendedBuildRuleIds?: string[]
  enabled?: boolean
}

interface ActiveSkillWorkbookOverride {
  skillId: SkillId
  classId?: string
  skillName?: string
  shortName?: string
  description?: string
  iconId?: string
  pointCost?: number
  resourceCost?: number
  cooldownMs?: number
  initialRemainingCooldownMs?: number
  gcdMs?: number
  targetingType?: string
  skillLogicId?: string
  castStopMode?: ActiveSkillDefinition['castStopMode']
  canAffectSkull?: boolean
  skillTags?: string[]
  uiOrder?: number
  unlockHint?: string
  grantedStatusIds?: string[]
  enabled?: boolean
}

interface ActiveSkillEffectWorkbookOverride {
  skillEffectId: string
  skillId?: SkillId
  effectIndex?: number
  skillLogicId?: string
  targetSelector?: string
  valueA?: number
  valueB?: number
  durationMs?: number
  statusId?: string
  threatDelta?: number
  threatMultiplier?: number
  threatSource?: ActiveSkillEffectDefinition['threatSource']
  notes?: string
  enabled?: boolean
}

interface PassiveTalentWorkbookOverride {
  talentId: PassiveTalentId
  classId?: string
  talentName?: string
  category?: PassiveTalentDefinition['category']
  cost?: number
  description?: string
  iconId?: string
  talentLogicId?: string
  tier: number
  talentTags?: string[]
  uiOrder?: number
  exclusiveGroup?: string
  grantedStatusIds?: string[]
  enabled?: boolean
}

interface PassiveTalentEffectWorkbookOverride {
  talentEffectId: string
  talentId?: PassiveTalentId
  effectIndex?: number
  talentLogicId?: string
  targetScope?: string
  valueA?: number
  valueB?: number
  statusId?: string
  skillId?: SkillId
  notes?: string
  enabled?: boolean
}

interface PlayerStatusWorkbookOverride {
  statusId: string
  statusName?: string
  statusCategory?: PlayerBuildStatusDefinition['statusCategory']
  iconId?: string
  durationMs?: number
  maxStacks?: number
  dispellable?: boolean
  description?: string
  effectLogicId?: string
  enabled?: boolean
}

export interface PlayerBuildWorkbookOverrides {
  classDefinitions: PlayerClassWorkbookOverride[]
  buildRuleDefinitions: BuildRuleWorkbookOverride[]
  activeSkillDefinitions: ActiveSkillWorkbookOverride[]
  activeSkillEffectDefinitions: ActiveSkillEffectWorkbookOverride[]
  activeStatusDefinitions: PlayerStatusWorkbookOverride[]
  passiveTalentDefinitions: PassiveTalentWorkbookOverride[]
  passiveTalentEffectDefinitions: PassiveTalentEffectWorkbookOverride[]
  passiveStatusDefinitions: PlayerStatusWorkbookOverride[]
  defaultActiveBuilds: BuildPresetActiveEntry[]
  defaultPassiveBuilds: BuildPresetPassiveEntry[]
  iconDefinitions: BuildIconDefinition[]
}

const VANGUARD_OATH_STATUS: PlayerBuildStatusDefinition = {
  statusId: 'vanguard-oath',
  statusName: '鍏堥攱瑾撶害',
  statusCategory: 'playerBuff',
  iconId: 'vanguard-oath',
  durationMs: 0,
  maxStacks: 1,
  dispellable: false,
  description: 'Permanent damage reduction stance.',
  effectLogicId: 'player_damage_reduction',
  enabled: true,
}

const STEADY_RELIEF_STATUS: PlayerBuildStatusDefinition = {
  statusId: 'steady-relief',
  statusName: '娉勫帇鑺傚',
  statusCategory: 'partyBuff',
  iconId: 'pressureValve',
  durationMs: 0,
  maxStacks: 1,
  dispellable: false,
  description: 'Steadily lowers party pressure.',
  effectLogicId: 'steady_relief',
  enabled: true,
}

const OVERCLOCK_PRESSURE_STATUS: PlayerBuildStatusDefinition = {
  statusId: 'overclock-pressure',
  statusName: '瓒呰浇澧炲帇',
  statusCategory: 'partyDebuff',
  iconId: 'overclockDoctrine',
  durationMs: 0,
  maxStacks: 1,
  dispellable: false,
  description: 'Overclock doctrine steadily raises party pressure.',
  effectLogicId: 'steady_pressure_rise',
  enabled: true,
}

const FIELD_MEDIC_STRAIN_STATUS: PlayerBuildStatusDefinition = {
  statusId: 'field-medic-strain',
  statusName: '鎬ユ晳璐熻嵎',
  statusCategory: 'partyDebuff',
  iconId: 'fieldMedic',
  durationMs: 0,
  maxStacks: 1,
  dispellable: false,
  description: 'Field medic adds a small pressure strain.',
  effectLogicId: 'steady_pressure_rise_small',
  enabled: true,
}

const DEFAULT_BUILD_RULES: Record<string, BuildRuleDefinition> = {
  tutorial_2slot: {
    buildRuleId: 'tutorial_2slot',
    classId: 'warrior_t',
    ruleName: 'Build Rule',
    description: 'Tutorial two-slot active build.',
    totalBuildPoints: 10,
    maxActiveSlots: 2,
    enabledHotkeys: ['1', '2'],
    inheritancePolicy: 'keep_active_first',
    enabled: true,
  },
  tutorial_3slot: {
    buildRuleId: 'tutorial_3slot',
    classId: 'warrior_t',
    ruleName: 'Build Rule',
    description: 'Tutorial three-slot active build.',
    totalBuildPoints: 14,
    maxActiveSlots: 3,
    enabledHotkeys: ['1', '2', '3'],
    inheritancePolicy: 'keep_active_first',
    enabled: true,
  },
  tutorial_4slot: {
    buildRuleId: 'tutorial_4slot',
    classId: 'warrior_t',
    ruleName: 'Build Rule',
    description: 'Tutorial four-slot active build.',
    totalBuildPoints: 18,
    maxActiveSlots: 4,
    enabledHotkeys: ['1', '2', '3', '4'],
    inheritancePolicy: 'keep_active_first',
    enabled: true,
  },
  tutorial_5slot: {
    buildRuleId: 'tutorial_5slot',
    classId: 'warrior_t',
    ruleName: '鏁欑▼鍥涳細浜旀妧鑳藉熀纭€鏋勭瓚',
    description: 'Tutorial five-slot active build.',
    totalBuildPoints: 22,
    maxActiveSlots: 5,
    enabledHotkeys: ['1', '2', '3', '4', 'Q'],
    inheritancePolicy: 'keep_active_first',
    enabled: true,
  },
  standard_5slot: {
    buildRuleId: 'standard_5slot',
    classId: 'warrior_t',
    ruleName: '鏍囧噯浜旈敭鏋勭瓚',
    description: 'Standard five-slot build.',
    totalBuildPoints: 28,
    maxActiveSlots: 5,
    enabledHotkeys: ['1', '2', '3', '4', 'Q'],
    inheritancePolicy: 'keep_active_first',
    enabled: true,
  },
  full_8slot: {
    buildRuleId: 'full_8slot',
    classId: 'warrior_t',
    ruleName: '瀹屾暣鍏敭鏋勭瓚',
    description: 'Designer-facing description.',
    totalBuildPoints: 36,
    maxActiveSlots: 8,
    enabledHotkeys: [...SKILL_HOTKEYS],
    inheritancePolicy: 'keep_active_first',
    enabled: true,
  },
}

const DEFAULT_ACTIVE_SKILLS: Record<SkillId, ActiveSkillDefinition> = {
  taunt: {
    id: 'taunt',
    name: '鍢茶',
    shortName: '鍢茶',
    description: 'Designer-facing description.',
    iconId: 'taunt',
    cooldownMs: 8_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 800,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'currentEnemy',
    skillLogicId: 'taunt_single',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: ['taunted'],
    enabled: true,
  },
  interrupt: {
    id: 'interrupt',
    name: '鎵撴柇',
    shortName: '鎵撴柇',
    description: 'Designer-facing description.',
    iconId: 'interrupt',
    cooldownMs: 12_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 10,
    gcdMs: 800,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'currentEnemy',
    skillLogicId: 'interrupt_cast',
    castStopMode: 'interrupt',
    canAffectSkull: true,
    grantedStatusIds: ['silenced'],
    enabled: true,
  },
  stun: {
    id: 'stun',
    name: '闇囪崱鐚涘嚮',
    shortName: '鐪╂檿',
    description: 'Designer-facing description.',
    iconId: 'stun',
    cooldownMs: 14_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 15,
    gcdMs: 800,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'currentEnemy',
    skillLogicId: 'stun_single',
    castStopMode: 'control',
    canAffectSkull: false,
    grantedStatusIds: ['stunned'],
    enabled: true,
  },
  massTaunt: {
    id: 'massTaunt',
    name: '鎸戞垬鎬掑惣',
    shortName: '缇ゅ槻',
    description: 'Designer-facing description.',
    iconId: 'massTaunt',
    cooldownMs: 30_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 20,
    gcdMs: 800,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'allEnemy',
    skillLogicId: 'mass_taunt',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: ['mass-taunt'],
    enabled: true,
  },
  shieldWall: {
    id: 'shieldWall',
    name: '鐩惧',
    shortName: '鐩惧',
    description: 'Designer-facing description.',
    iconId: 'shieldWall',
    cooldownMs: 28_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 20,
    gcdMs: 0,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'self',
    skillLogicId: 'shield_wall',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: ['shieldWall'],
    enabled: true,
  },
  cleave: {
    id: 'cleave',
    name: '椤哄妶',
    shortName: '椤哄妶',
    description: 'Designer-facing description.',
    iconId: 'cleave',
    cooldownMs: 3_500,
    initialRemainingCooldownMs: 0,
    resourceCost: 15,
    gcdMs: 800,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'currentEnemy',
    skillLogicId: 'cleave_adjacent',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: [],
    enabled: true,
  },
  burst: {
    id: 'burst',
    name: '鐖嗗彂鎵撳嚮',
    shortName: '鐖嗗彂',
    description: 'Designer-facing description.',
    iconId: 'burst',
    cooldownMs: 18_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 30,
    gcdMs: 800,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'currentEnemy',
    skillLogicId: 'burst_single',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: [],
    enabled: true,
  },
  panic: {
    id: 'panic',
    name: 'Skill',
    shortName: '淇濆懡',
    description: 'Designer-facing description.',
    iconId: 'panic',
    cooldownMs: 45_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 0,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'party',
    skillLogicId: 'panic_recovery',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: [],
    enabled: true,
  },
  shieldSlam: {
    id: 'shieldSlam',
    name: '鐩剧墝鐚涘嚮',
    shortName: '鍗曚激',
    description: 'Designer-facing description.',
    iconId: 'shieldSlam',
    cooldownMs: 6_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 1_500,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'currentEnemy',
    skillLogicId: 'shield_slam',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: [],
    enabled: true,
  },
  shieldReflection: {
    id: 'shieldReflection',
    name: '鐩剧墝鍙嶅皠',
    shortName: '鍙嶅脊',
    description: 'Designer-facing description.',
    iconId: 'shieldReflection',
    cooldownMs: 15_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 1_500,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'self',
    skillLogicId: 'shield_reflection',
    castStopMode: 'none',
    canAffectSkull: false,
    grantedStatusIds: ['shieldReflection'],
    enabled: true,
  },
  avatar: {
    id: 'avatar',
    name: '澶╃涓嬪嚒',
    shortName: '鐖嗗彂',
    description: '浜х敓50鎬掓皵锛屽苟鍦?6绉掑唴鎻愬崌50%浼ゅ',
    iconId: 'avatar',
    cooldownMs: 90_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 0,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'self',
    skillLogicId: 'avatar',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: ['avatar'],
    enabled: true,
  },
  shockwave: {
    id: 'shockwave',
    name: 'Skill',
    shortName: '缇や綋鏄忚糠',
    description: 'Designer-facing description.',
    iconId: 'shockwave',
    cooldownMs: 20_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 20,
    gcdMs: 1_500,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'crossEnemy',
    skillLogicId: 'shockwave',
    castStopMode: 'control',
    canAffectSkull: false,
    grantedStatusIds: ['stunned'],
    enabled: true,
  },
  thunderstruck: {
    id: 'thunderstruck',
    name: '闆烽渾鎵撳嚮',
    shortName: 'Skill',
    description: 'Designer-facing description.',
    iconId: 'thunderstruck',
    cooldownMs: 15_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 1_500,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'matrix3x3Enemy',
    skillLogicId: 'thunderstruck',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: [],
    enabled: true,
  },
  rallyingCry: {
    id: 'rallyingCry',
    name: '闆嗙粨鍛愬枈',
    shortName: '闃熶紞鍥炶',
    description: 'Designer-facing description.',
    iconId: 'rallyingCry',
    cooldownMs: 20_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 10,
    gcdMs: 0,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'self',
    skillLogicId: 'rallying_cry',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: [],
    enabled: true,
  },
  intervene: {
    id: 'intervene',
    name: '鎻存姢',
    shortName: '闃熶紞鍑忎激',
    description: '浠ｆ浛闃熶紞鎵垮彈5绉掑唴涓嬫浼ゅ',
    iconId: 'intervene',
    cooldownMs: 10_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 0,
    gcdMs: 0,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'self',
    skillLogicId: 'intervene',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: ['intervened'],
    enabled: true,
  },
  demoralizingShout: {
    id: 'demoralizingShout',
    name: '鎸織鎬掑惣',
    shortName: '闄嶆敾',
    description: '闄嶄綆鎵€鏈夋晫浜?绉掑唴閫犳垚鐨勪激瀹?5%',
    iconId: 'demoralizingShout',
    cooldownMs: 30_000,
    initialRemainingCooldownMs: 0,
    resourceCost: 10,
    gcdMs: 0,
    pointCost: ACTIVE_SKILL_POINT_COST,
    targetingType: 'allEnemy',
    skillLogicId: 'demoralizing_shout',
    castStopMode: 'none',
    canAffectSkull: true,
    grantedStatusIds: ['demoralized'],
    enabled: true,
  },
}

const DEFAULT_ACTIVE_STATUS_DEFINITIONS: Record<string, PlayerBuildStatusDefinition> = {
  taunted: {
    statusId: 'taunted',
    statusName: '被嘲讽',
    statusCategory: 'enemyDebuff',
    iconId: 'taunted',
    durationMs: 3_000,
    maxStacks: 1,
    dispellable: false,
    description: 'Designer-facing description.',
    effectLogicId: 'enemy_taunted',
    enabled: true,
  },
  'mass-taunt': {
    statusId: 'mass-taunt',
    statusName: '群体嘲讽',
    statusCategory: 'enemyDebuff',
    iconId: 'mass-taunt',
    durationMs: 2_000,
    maxStacks: 1,
    dispellable: false,
    description: 'Designer-facing description.',
    effectLogicId: 'enemy_taunted',
    enabled: true,
  },
  stunned: {
    statusId: 'stunned',
    statusName: '昏迷',
    statusCategory: 'enemyDebuff',
    iconId: 'stunned',
    durationMs: 2_000,
    maxStacks: 1,
    dispellable: true,
    description: 'Designer-facing description.',
    effectLogicId: 'enemy_stunned',
    enabled: true,
  },
  silenced: {
    statusId: 'silenced',
    statusName: '娌夐粯',
    statusCategory: 'enemyDebuff',
    iconId: 'silenced',
    durationMs: 2_000,
    maxStacks: 1,
    dispellable: true,
    description: 'Designer-facing description.',
    effectLogicId: 'enemy_damage_down',
    enabled: true,
  },
  shieldWall: {
    statusId: 'shieldWall',
    statusName: '盾墙',
    statusCategory: 'playerBuff',
    iconId: 'shieldWall',
    durationMs: 4_000,
    maxStacks: 1,
    dispellable: false,
    description: 'Designer-facing description.',
    effectLogicId: 'player_damage_reduction',
    enabled: true,
  },
  shieldReflection: {
    statusId: 'shieldReflection',
    statusName: '鐩剧墝鍙嶅皠',
    statusCategory: 'playerBuff',
    iconId: 'shieldReflection',
    durationMs: 1_000,
    maxStacks: 1,
    dispellable: false,
    description: 'Designer-facing description.',
    effectLogicId: 'playerBuff_shieldReflection',
    enabled: true,
  },
  avatar: {
    statusId: 'avatar',
    statusName: '澶╃涓嬪嚒',
    statusCategory: 'playerBuff',
    iconId: 'avatar',
    durationMs: 16_000,
    maxStacks: 1,
    dispellable: false,
    description: 'Designer-facing description.',
    effectLogicId: 'playerBuff_avatar',
    enabled: true,
  },
  intervened: {
    statusId: 'intervened',
    statusName: 'Status',
    statusCategory: 'partyBuff',
    iconId: 'intervened',
    durationMs: 5_000,
    maxStacks: 1,
    dispellable: false,
    description: 'Designer-facing description.',
    effectLogicId: 'partyBuff_intervened',
    enabled: true,
  },
  demoralized: {
    statusId: 'demoralized',
    statusName: 'Status',
    statusCategory: 'enemyDebuff',
    iconId: 'demoralized',
    durationMs: 5_000,
    maxStacks: 1,
    dispellable: false,
    description: 'Designer-facing description.',
    effectLogicId: 'enemyDebuff_demoralized',
    enabled: true,
  },
}

const DEFAULT_PASSIVE_TALENTS: Record<PassiveTalentId, PassiveTalentDefinition> = {
  vitalReserve: {
    id: 'vitalReserve',
    name: '鐢熷懡鍌ㄥ',
    category: 'player',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'vitalReserve',
    talentLogicId: 'player_max_hp_up',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  surgeEngine: {
    id: 'surgeEngine',
    name: '鎬掓皵娑屾祦',
    category: 'player',
    cost: 1,
    description: 'Designer-facing description.',
    iconId: 'surgeEngine',
    talentLogicId: 'resource_regen_up',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  vanguardOath: {
    id: 'vanguardOath',
    name: '鍏堥攱瑾撶害',
    category: 'player',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'vanguardOath',
    talentLogicId: 'grant_permanent_buff',
    tier: 0,
    grantedStatusIds: ['vanguard-oath'],
    enabled: true,
  },
  ironLung: {
    id: 'ironLung',
    name: '娣辨伅鍌ㄨ兘',
    category: 'player',
    cost: 1,
    description: 'Designer-facing description.',
    iconId: 'ironLung',
    talentLogicId: 'player_resource_cap_up',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  shockMatrix: {
    id: 'shockMatrix',
    name: '闇囪崱鐭╅樀',
    category: 'skill',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'shockMatrix',
    talentLogicId: 'stun_hits_cross',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  snapInterrupt: {
    id: 'snapInterrupt',
    name: '鐬柇鎵嬫劅',
    category: 'skill',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'snapInterrupt',
    talentLogicId: 'interrupt_ignore_gcd',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  temperedBurst: {
    id: 'temperedBurst',
    name: '鑺傚埗鐖嗗彂',
    category: 'skill',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'temperedBurst',
    talentLogicId: 'burst_half_cd_lower_effect',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  sweepingCleave: {
    id: 'sweepingCleave',
    name: '瑁傞樀椤哄妶',
    category: 'skill',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'sweepingCleave',
    talentLogicId: 'cleave_hits_cross',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  fortifiedWall: {
    id: 'fortifiedWall',
    name: '鍥哄畧鐩惧',
    category: 'skill',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'fortifiedWall',
    talentLogicId: 'shield_wall_extended',
    tier: 0,
    grantedStatusIds: ['shieldWall'],
    enabled: true,
  },
  rallyingStandard: {
    id: 'rallyingStandard',
    name: '楂樻偓鎴樻棗',
    category: 'party',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'rallyingStandard',
    talentLogicId: 'party_pressure_cap_up',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  pressureValve: {
    id: 'pressureValve',
    name: '娉勫帇鑺傚',
    category: 'party',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'pressureValve',
    talentLogicId: 'party_pressure_drift_down_with_periodic_stun',
    tier: 0,
    grantedStatusIds: ['steady-relief'],
    enabled: true,
  },
  sacrificialFormation: {
    id: 'sacrificialFormation',
    name: '鐗虹壊闃靛瀷',
    category: 'party',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'sacrificialFormation',
    talentLogicId: 'party_hp_half_taunt_cd_down',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  overclockDoctrine: {
    id: 'overclockDoctrine',
    name: '瓒呰浇鎴樻湳',
    category: 'party',
    cost: 1,
    description: 'Designer-facing description.',
    iconId: 'overclockDoctrine',
    talentLogicId: 'bonus_build_points_with_pressure_drift_up',
    tier: 0,
    grantedStatusIds: ['overclock-pressure'],
    enabled: true,
  },
  deepReserve: {
    id: 'deepReserve',
    name: '娣卞眰棰勫',
    category: 'party',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'deepReserve',
    talentLogicId: 'party_pressure_cap_up_large',
    tier: 0,
    grantedStatusIds: [],
    enabled: true,
  },
  fieldMedic: {
    id: 'fieldMedic',
    name: '鎴樺湴鎬ユ晳',
    category: 'party',
    cost: 2,
    description: 'Designer-facing description.',
    iconId: 'fieldMedic',
    talentLogicId: 'party_hp_regen_with_pressure_up',
    tier: 0,
    grantedStatusIds: ['field-medic-strain'],
    enabled: true,
  },
}

const DEFAULT_PASSIVE_STATUS_DEFINITIONS: Record<string, PlayerBuildStatusDefinition> = {
  'vanguard-oath': VANGUARD_OATH_STATUS,
  'steady-relief': STEADY_RELIEF_STATUS,
  'overclock-pressure': OVERCLOCK_PRESSURE_STATUS,
  'field-medic-strain': FIELD_MEDIC_STRAIN_STATUS,
}

const DEFAULT_PLAYER_CLASSES: Record<string, PlayerClassDefinition> = {
  demo0_sample: {
    classId: 'demo0_sample',
    className: 'Demo0 鏍蜂緥',
    roleTag: 'tank',
    classDescription: 'Class description.',
    recommendedBuildRuleIds: [],
    enabled: true,
  },
  warrior_t: {
    classId: 'warrior_t',
    className: '战士T',
    roleTag: 'tank',
    classDescription: 'Class description.',
    recommendedBuildRuleIds: ['tutorial_2slot', 'standard_5slot', 'full_8slot'],
    enabled: true,
  },
}

const WARRIOR_T_SKILL_ID_MAP: Record<string, SkillId> = {
  taunt: 'warrior_t_taunt',
  interrupt: 'warrior_t_interrupt',
  stun: 'warrior_t_stun',
  massTaunt: 'warrior_t_mass_taunt',
  shieldWall: 'warrior_t_shield_wall',
  cleave: 'warrior_t_cleave',
  burst: 'warrior_t_burst',
  panic: 'warrior_t_last_stand',
  shieldSlam: 'warrior_t_shield_slam',
  shieldReflection: 'warrior_t_shield_reflection',
  avatar: 'warrior_t_avatar',
  shockwave: 'warrior_t_shockwave',
  thunderstruck: 'warrior_t_thunderstruck',
  rallyingCry: 'warrior_t_rallying_cry',
  intervene: 'warrior_t_intervene',
  demoralizingShout: 'warrior_t_demoralizing_shout',
}

const DEMO0_TALENT_ID_MAP: Record<string, PassiveTalentId> = {
  vitalReserve: 'demo0_vital_reserve',
  surgeEngine: 'demo0_surge_engine',
  vanguardOath: 'demo0_vanguard_oath',
  ironLung: 'demo0_iron_lung',
  shockMatrix: 'demo0_shock_matrix',
  snapInterrupt: 'demo0_snap_interrupt',
  temperedBurst: 'demo0_tempered_burst',
  sweepingCleave: 'demo0_sweeping_cleave',
  fortifiedWall: 'demo0_fortified_wall',
  rallyingStandard: 'demo0_rallying_standard',
  pressureValve: 'demo0_pressure_valve',
  sacrificialFormation: 'demo0_sacrificial_formation',
  overclockDoctrine: 'demo0_overclock_doctrine',
  deepReserve: 'demo0_deep_reserve',
  fieldMedic: 'demo0_field_medic',
}

const WARRIOR_T_TALENT_ID_MAP: Record<string, PassiveTalentId> = {
  vitalReserve: 'warrior_t_vital_reserve',
  surgeEngine: 'warrior_t_surge_engine',
  vanguardOath: 'warrior_t_vanguard_oath',
  ironLung: 'warrior_t_iron_lung',
  shockMatrix: 'warrior_t_shock_matrix',
  snapInterrupt: 'warrior_t_snap_interrupt',
  temperedBurst: 'warrior_t_tempered_burst',
  sweepingCleave: 'warrior_t_sweeping_cleave',
  fortifiedWall: 'warrior_t_fortified_wall',
  rallyingStandard: 'warrior_t_rallying_standard',
  pressureValve: 'warrior_t_pressure_valve',
  sacrificialFormation: 'warrior_t_sacrificial_formation',
  overclockDoctrine: 'warrior_t_overclock_doctrine',
  deepReserve: 'warrior_t_deep_reserve',
  fieldMedic: 'warrior_t_field_medic',
}

function buildRenamedActiveSkills(
  source: Record<string, ActiveSkillDefinition>,
  idMap: Record<string, SkillId>,
  classId: string,
): Record<SkillId, ActiveSkillDefinition> {
  return Object.fromEntries(
    Object.entries(idMap).map(([legacyId, nextId], index) => {
      const base = source[legacyId]
      return [
        nextId,
        {
          ...base,
          id: nextId,
          classId,
          uiOrder: index + 1,
          skillTags:
            legacyId === 'taunt' || legacyId === 'massTaunt'
              ? ['threat']
              : legacyId === 'shieldWall'
                ? ['survival']
                : legacyId === 'shieldReflection'
                  ? ['survival', 'immune', 'reflect']
                : legacyId === 'interrupt' || legacyId === 'stun'
                  ? ['control']
                  : legacyId === 'cleave' || legacyId === 'burst'
                    ? ['damage']
                    : ['support'],
        },
      ]
    }),
  )
}

function buildRenamedPassiveTalents(
  source: Record<string, PassiveTalentDefinition>,
  idMap: Record<string, PassiveTalentId>,
  classId: string,
): Record<PassiveTalentId, PassiveTalentDefinition> {
  return Object.fromEntries(
    Object.entries(idMap).map(([legacyId, nextId], index) => {
      const base = source[legacyId]
      return [
        nextId,
        {
          ...base,
          id: nextId,
          classId,
          tier:
            base.category === 'player' ? 1 : base.category === 'skill' ? 2 : 3,
          uiOrder: index + 1,
          talentTags: [base.category],
        },
      ]
    }),
  )
}

const BUILTIN_ACTIVE_SKILLS: Record<SkillId, ActiveSkillDefinition> = {
  ...buildRenamedActiveSkills(DEFAULT_ACTIVE_SKILLS, WARRIOR_T_SKILL_ID_MAP, 'warrior_t'),
}

const BUILTIN_PASSIVE_TALENTS: Record<PassiveTalentId, PassiveTalentDefinition> = {
  ...buildRenamedPassiveTalents(DEFAULT_PASSIVE_TALENTS, DEMO0_TALENT_ID_MAP, 'demo0_sample'),
  ...buildRenamedPassiveTalents(DEFAULT_PASSIVE_TALENTS, WARRIOR_T_TALENT_ID_MAP, 'warrior_t'),
}

const DEFAULT_ACTIVE_SKILL_EFFECTS: Record<string, ActiveSkillEffectDefinition> = {
  warrior_t_taunt_main: {
    skillEffectId: 'warrior_t_taunt_main',
    skillId: 'warrior_t_taunt',
    effectIndex: 1,
    targetSelector: 'current',
    threatDelta: 72,
    statusId: 'taunted',
    durationMs: 3000,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_interrupt_main: {
    skillEffectId: 'warrior_t_interrupt_main',
    skillId: 'warrior_t_interrupt',
    effectIndex: 1,
    targetSelector: 'current',
    statusId: 'countered',
    durationMs: 1200,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_stun_main: {
    skillEffectId: 'warrior_t_stun_main',
    skillId: 'warrior_t_stun',
    effectIndex: 1,
    targetSelector: 'current',
    statusId: 'stunned',
    durationMs: 2000,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_shield_wall_main: {
    skillEffectId: 'warrior_t_shield_wall_main',
    skillId: 'warrior_t_shield_wall',
    effectIndex: 1,
    targetSelector: 'self',
    statusId: 'shieldWall',
    durationMs: 4000,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_mass_taunt_main: {
    skillEffectId: 'warrior_t_mass_taunt_main',
    skillId: 'warrior_t_mass_taunt',
    effectIndex: 1,
    targetSelector: 'allEnemy',
    threatDelta: 48,
    statusId: 'mass-taunt',
    durationMs: 2000,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_cleave_main: {
    skillEffectId: 'warrior_t_cleave_main',
    skillId: 'warrior_t_cleave',
    effectIndex: 1,
    targetSelector: 'adjacent',
    valueA: 22,
    valueB: 10,
    threatDelta: 28,
    threatMultiplier: 5,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_burst_main: {
    skillEffectId: 'warrior_t_burst_main',
    skillId: 'warrior_t_burst',
    effectIndex: 1,
    targetSelector: 'current',
    valueA: 48,
    threatDelta: 38,
    threatMultiplier: 5,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_shield_slam_main: {
    skillEffectId: 'warrior_t_shield_slam_main',
    skillId: 'warrior_t_shield_slam',
    effectIndex: 1,
    skillLogicId: 'shield_slam',
    targetSelector: 'current',
    valueA: 15,
    threatDelta: 0,
    threatMultiplier: 5,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_shield_reflection_main: {
    skillEffectId: 'warrior_t_shield_reflection_main',
    skillId: 'warrior_t_shield_reflection',
    effectIndex: 1,
    skillLogicId: 'shield_reflection',
    targetSelector: 'self',
    statusId: 'shieldReflection',
    durationMs: 1000,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_avatar_anger: {
    skillEffectId: 'warrior_t_avatar_anger',
    skillId: 'warrior_t_avatar',
    effectIndex: 1,
    skillLogicId: 'avatar',
    targetSelector: 'self',
    valueA: 50,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_avatar_main: {
    skillEffectId: 'warrior_t_avatar_main',
    skillId: 'warrior_t_avatar',
    effectIndex: 2,
    skillLogicId: 'avatar',
    targetSelector: 'self',
    valueB: 0.5,
    durationMs: 16000,
    statusId: 'avatar',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_shockwave_main: {
    skillEffectId: 'warrior_t_shockwave_main',
    skillId: 'warrior_t_shockwave',
    effectIndex: 1,
    skillLogicId: 'shockwave',
    targetSelector: 'cross',
    valueA: 5,
    durationMs: 2000,
    statusId: 'stunned',
    threatMultiplier: 1,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_thunderstruck_main: {
    skillEffectId: 'warrior_t_thunderstruck_main',
    skillId: 'warrior_t_thunderstruck',
    effectIndex: 1,
    skillLogicId: 'thunderstruck',
    targetSelector: 'matrix3x3',
    valueA: 15,
    threatDelta: 0,
    threatMultiplier: 5,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_rallying_cry_main: {
    skillEffectId: 'warrior_t_rallying_cry_main',
    skillId: 'warrior_t_rallying_cry',
    effectIndex: 1,
    skillLogicId: 'rallying_cry',
    targetSelector: 'self',
    valueB: 0.2,
    threatMultiplier: 1,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_rallying_cry_party: {
    skillEffectId: 'warrior_t_rallying_cry_party',
    skillId: 'warrior_t_rallying_cry',
    effectIndex: 2,
    skillLogicId: 'rallying_cry',
    targetSelector: 'self',
    valueB: 0.2,
    threatMultiplier: 1,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_intervene_main: {
    skillEffectId: 'warrior_t_intervene_main',
    skillId: 'warrior_t_intervene',
    effectIndex: 1,
    skillLogicId: 'intervene',
    targetSelector: 'self',
    durationMs: 5000,
    statusId: 'intervened',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_demoralizing_shout_main: {
    skillEffectId: 'warrior_t_demoralizing_shout_main',
    skillId: 'warrior_t_demoralizing_shout',
    effectIndex: 1,
    skillLogicId: 'demoralizing_shout',
    targetSelector: 'allEnemy',
    valueB: 0.25,
    durationMs: 5000,
    statusId: 'demoralized',
    threatDelta: 20,
    threatMultiplier: 0,
    threatSource: 'player',
    notes: 'Designer note.',
    enabled: true,
  },
}

const DEFAULT_PASSIVE_TALENT_EFFECTS: Record<string, PassiveTalentEffectDefinition> = {
  warrior_t_vital_reserve_main: {
    talentEffectId: 'warrior_t_vital_reserve_main',
    talentId: 'warrior_t_vital_reserve',
    effectIndex: 1,
    talentLogicId: 'player_max_hp_up',
    targetScope: 'player',
    valueA: 180,
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_snap_interrupt_main: {
    talentEffectId: 'warrior_t_snap_interrupt_main',
    talentId: 'warrior_t_snap_interrupt',
    effectIndex: 1,
    talentLogicId: 'interrupt_ignore_gcd',
    targetScope: 'skill',
    skillId: 'warrior_t_interrupt',
    notes: 'Designer note.',
    enabled: true,
  },
  warrior_t_vanguard_oath_main: {
    talentEffectId: 'warrior_t_vanguard_oath_main',
    talentId: 'warrior_t_vanguard_oath',
    effectIndex: 1,
    talentLogicId: 'grant_permanent_buff',
    targetScope: 'player',
    statusId: 'vanguard-oath',
    notes: 'Designer note.',
    enabled: true,
  },
  demo0_vital_reserve_main: {
    talentEffectId: 'demo0_vital_reserve_main',
    talentId: 'demo0_vital_reserve',
    effectIndex: 1,
    talentLogicId: 'player_max_hp_up',
    targetScope: 'player',
    valueA: 180,
    notes: 'Designer note.',
    enabled: true,
  },
}

const DEFAULT_ACTIVE_PRESETS: BuildPresetActiveEntry[] = [
  { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
  { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
  { presetId: 'tutorial_3slot', buildRuleId: 'tutorial_3slot', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
  { presetId: 'tutorial_3slot', buildRuleId: 'tutorial_3slot', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
  { presetId: 'tutorial_3slot', buildRuleId: 'tutorial_3slot', classId: 'warrior_t', hotkey: '3', skillId: 'warrior_t_stun', priority: 3 },
  { presetId: 'tutorial_4slot', buildRuleId: 'tutorial_4slot', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
  { presetId: 'tutorial_4slot', buildRuleId: 'tutorial_4slot', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
  { presetId: 'tutorial_4slot', buildRuleId: 'tutorial_4slot', classId: 'warrior_t', hotkey: '3', skillId: 'warrior_t_stun', priority: 3 },
  { presetId: 'tutorial_4slot', buildRuleId: 'tutorial_4slot', classId: 'warrior_t', hotkey: '4', skillId: 'warrior_t_mass_taunt', priority: 4 },
  { presetId: 'tutorial_5slot', buildRuleId: 'tutorial_5slot', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
  { presetId: 'tutorial_5slot', buildRuleId: 'tutorial_5slot', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
  { presetId: 'tutorial_5slot', buildRuleId: 'tutorial_5slot', classId: 'warrior_t', hotkey: '3', skillId: 'warrior_t_stun', priority: 3 },
  { presetId: 'tutorial_5slot', buildRuleId: 'tutorial_5slot', classId: 'warrior_t', hotkey: '4', skillId: 'warrior_t_mass_taunt', priority: 4 },
  { presetId: 'tutorial_5slot', buildRuleId: 'tutorial_5slot', classId: 'warrior_t', hotkey: 'Q', skillId: 'warrior_t_shield_wall', priority: 5 },
  { presetId: 'default', classId: 'warrior_t', hotkey: '1', skillId: 'warrior_t_taunt', priority: 1 },
  { presetId: 'default', classId: 'warrior_t', hotkey: '2', skillId: 'warrior_t_interrupt', priority: 2 },
  { presetId: 'default', classId: 'warrior_t', hotkey: '3', skillId: 'warrior_t_stun', priority: 3 },
  { presetId: 'default', classId: 'warrior_t', hotkey: '4', skillId: 'warrior_t_mass_taunt', priority: 4 },
  { presetId: 'default', classId: 'warrior_t', hotkey: 'Q', skillId: 'warrior_t_shield_wall', priority: 5 },
  { presetId: 'default', classId: 'warrior_t', hotkey: 'E', skillId: 'warrior_t_cleave', priority: 6 },
]

const DEFAULT_PASSIVE_PRESETS: BuildPresetPassiveEntry[] = [
  { presetId: 'tutorial_2slot', buildRuleId: 'tutorial_2slot', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 },
  { presetId: 'tutorial_3slot', buildRuleId: 'tutorial_3slot', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 },
  { presetId: 'tutorial_3slot', buildRuleId: 'tutorial_3slot', classId: 'warrior_t', talentId: 'warrior_t_snap_interrupt', selected: true, priority: 2 },
  { presetId: 'tutorial_4slot', buildRuleId: 'tutorial_4slot', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 },
  { presetId: 'tutorial_4slot', buildRuleId: 'tutorial_4slot', classId: 'warrior_t', talentId: 'warrior_t_snap_interrupt', selected: true, priority: 2 },
  { presetId: 'tutorial_5slot', buildRuleId: 'tutorial_5slot', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 },
  { presetId: 'tutorial_5slot', buildRuleId: 'tutorial_5slot', classId: 'warrior_t', talentId: 'warrior_t_snap_interrupt', selected: true, priority: 2 },
  { presetId: 'default', classId: 'warrior_t', talentId: 'warrior_t_vital_reserve', selected: true, priority: 1 },
  { presetId: 'default', classId: 'warrior_t', talentId: 'warrior_t_snap_interrupt', selected: true, priority: 2 },
  { presetId: 'default', classId: 'warrior_t', talentId: 'warrior_t_rallying_standard', selected: true, priority: 3 },
]

const DEFAULT_ICON_DEFINITIONS: BuildIconDefinition[] = [
  { iconId: 'taunt', iconName: '鍢茶鍥炬爣', assetKey: 'taunt', iconType: 'skill', enabled: true },
  { iconId: 'interrupt', iconName: '鎵撴柇鍥炬爣', assetKey: 'interrupt', iconType: 'skill', enabled: true },
  { iconId: 'stun', iconName: '鐪╂檿鍥炬爣', assetKey: 'stun', iconType: 'skill', enabled: true },
  { iconId: 'massTaunt', iconName: '缇ゅ槻鍥炬爣', assetKey: 'massTaunt', iconType: 'skill', enabled: true },
  { iconId: 'shieldWall', iconName: '鐩惧鍥炬爣', assetKey: 'shieldWall', iconType: 'skill', enabled: true },
  { iconId: 'cleave', iconName: '椤哄妶鍥炬爣', assetKey: 'cleave', iconType: 'skill', enabled: true },
  { iconId: 'burst', iconName: '鐖嗗彂鍥炬爣', assetKey: 'burst', iconType: 'skill', enabled: true },
  { iconId: 'shieldSlam', iconName: '鐩剧墝鐚涘嚮鍥炬爣', assetKey: 'burst', iconType: 'skill', enabled: true },
  { iconId: 'shieldReflection', iconName: '鐩剧墝鍙嶅皠鍥炬爣', assetKey: 'shieldWall', iconType: 'skill', enabled: true },
  { iconId: 'avatar', iconName: '澶╃涓嬪嚒鍥炬爣', assetKey: 'battle-seal', iconType: 'skill', enabled: true },
  { iconId: 'shockwave', iconName: 'Icon', assetKey: 'stunned', iconType: 'skill', enabled: true },
  { iconId: 'thunderstruck', iconName: '闆烽渾鎵撳嚮鍥炬爣', assetKey: 'sundered', iconType: 'skill', enabled: true },
  { iconId: 'rallyingCry', iconName: '闆嗙粨鍛愬枈鍥炬爣', assetKey: 'guarded', iconType: 'skill', enabled: true },
  { iconId: 'intervene', iconName: '鎻存姢鍥炬爣', assetKey: 'vanguard-oath', iconType: 'skill', enabled: true },
  { iconId: 'demoralizingShout', iconName: '鎸織鎬掑惣鍥炬爣', assetKey: 'taunted', iconType: 'skill', enabled: true },
  { iconId: 'panic', iconName: '淇濆懡鍥炬爣', assetKey: 'panic', iconType: 'skill', enabled: true },
  { iconId: 'vitalReserve', iconName: '鐢熷懡鍌ㄥ鍥炬爣', assetKey: 'guarded', iconType: 'talent', enabled: true },
  { iconId: 'surgeEngine', iconName: '鎬掓皵娑屾祦鍥炬爣', assetKey: 'haste', iconType: 'talent', enabled: true },
  { iconId: 'vanguardOath', iconName: '鍏堥攱瑾撶害鍥炬爣', assetKey: 'vanguard-oath', iconType: 'talent', enabled: true },
  { iconId: 'ironLung', iconName: '娣辨伅鍌ㄨ兘鍥炬爣', assetKey: 'heat-haze', iconType: 'talent', enabled: true },
  { iconId: 'shockMatrix', iconName: '闇囪崱鐭╅樀鍥炬爣', assetKey: 'stunned', iconType: 'talent', enabled: true },
  { iconId: 'snapInterrupt', iconName: '鐬柇鎵嬫劅鍥炬爣', assetKey: 'silenced', iconType: 'talent', enabled: true },
  { iconId: 'temperedBurst', iconName: '鑺傚埗鐖嗗彂鍥炬爣', assetKey: 'battle-seal', iconType: 'talent', enabled: true },
  { iconId: 'sweepingCleave', iconName: '瑁傞樀椤哄妶鍥炬爣', assetKey: 'sundered', iconType: 'talent', enabled: true },
  { iconId: 'fortifiedWall', iconName: '鍥哄畧鐩惧鍥炬爣', assetKey: 'shieldWall', iconType: 'talent', enabled: true },
  { iconId: 'rallyingStandard', iconName: '楂樻偓鎴樻棗鍥炬爣', assetKey: 'battle-seal', iconType: 'talent', enabled: true },
  { iconId: 'pressureValve', iconName: '娉勫帇鑺傚鍥炬爣', assetKey: 'heat-haze', iconType: 'talent', enabled: true },
  { iconId: 'sacrificialFormation', iconName: '鐗虹壊闃靛瀷鍥炬爣', assetKey: 'sundered', iconType: 'talent', enabled: true },
  { iconId: 'overclockDoctrine', iconName: '瓒呰浇鎴樻湳鍥炬爣', assetKey: 'enrage-song', iconType: 'talent', enabled: true },
  { iconId: 'deepReserve', iconName: '娣卞眰棰勫鍥炬爣', assetKey: 'guarded', iconType: 'talent', enabled: true },
  { iconId: 'fieldMedic', iconName: '鎴樺湴鎬ユ晳鍥炬爣', assetKey: 'ember-aegis', iconType: 'talent', enabled: true },
  { iconId: 'taunted', iconName: 'Icon', assetKey: 'taunted', iconType: 'status', enabled: true },
  { iconId: 'mass-taunt', iconName: '缇や綋鍢茶鍥炬爣', assetKey: 'mass-taunt', iconType: 'status', enabled: true },
  { iconId: 'silenced', iconName: '娌夐粯鍥炬爣', assetKey: 'silenced', iconType: 'status', enabled: true },
  { iconId: 'stunned', iconName: '鏄忚糠鍥炬爣', assetKey: 'stunned', iconType: 'status', enabled: true },
  { iconId: 'intervened', iconName: 'Icon', assetKey: 'vanguard-oath', iconType: 'status', enabled: true },
  { iconId: 'demoralized', iconName: 'Icon', assetKey: 'taunted', iconType: 'status', enabled: true },
  { iconId: 'vanguard-oath', iconName: 'Icon', assetKey: 'vanguard-oath', iconType: 'status', enabled: true },
  { iconId: 'locked', iconName: '閿佸畾鍥炬爣', assetKey: 'locked', iconType: 'skill', enabled: true },
]

let classDefinitionsById = Object.fromEntries(
  Object.entries(DEFAULT_PLAYER_CLASSES).map(([classId, definition]) => [
    classId,
    {
      ...definition,
      recommendedBuildRuleIds: [...definition.recommendedBuildRuleIds],
    },
  ]),
) as Record<string, PlayerClassDefinition>
let buildRulesById = cloneBuildRules(DEFAULT_BUILD_RULES)
let activeSkillsById = cloneActiveSkills(BUILTIN_ACTIVE_SKILLS)
let activeStatusesById = cloneStatuses(DEFAULT_ACTIVE_STATUS_DEFINITIONS)
let activeSkillEffectDefinitionsById = Object.fromEntries(
  Object.entries(DEFAULT_ACTIVE_SKILL_EFFECTS).map(([effectId, definition]) => [effectId, { ...definition }]),
) as Record<string, ActiveSkillEffectDefinition>
let passiveTalentsById = clonePassiveTalents(BUILTIN_PASSIVE_TALENTS)
let passiveTalentEffectDefinitionsById = Object.fromEntries(
  Object.entries(DEFAULT_PASSIVE_TALENT_EFFECTS).map(([effectId, definition]) => [effectId, { ...definition }]),
) as Record<string, PassiveTalentEffectDefinition>
let passiveStatusesById = cloneStatuses(DEFAULT_PASSIVE_STATUS_DEFINITIONS)
let defaultActiveBuilds = DEFAULT_ACTIVE_PRESETS.map(cloneActivePreset)
let defaultPassiveBuilds = DEFAULT_PASSIVE_PRESETS.map(clonePassivePreset)
let iconDefinitions = DEFAULT_ICON_DEFINITIONS.map((entry) => ({ ...entry }))
let workbookPassiveCatalogClassIds = new Set<string>()
let workbookPassiveCatalogTalentIds = new Set<PassiveTalentId>()

function clonePlayerClasses(source: Record<string, PlayerClassDefinition>) {
  return Object.fromEntries(
    Object.entries(source).map(([classId, definition]) => [
      classId,
      {
        ...definition,
        recommendedBuildRuleIds: [...definition.recommendedBuildRuleIds],
      },
    ]),
  ) as Record<string, PlayerClassDefinition>
}

function cloneBuildRules(source: Record<string, BuildRuleDefinition>) {
  return Object.fromEntries(
    Object.entries(source).map(([buildRuleId, rule]) => [
      buildRuleId,
      {
        ...rule,
        enabledHotkeys: [...rule.enabledHotkeys],
      },
    ]),
  ) as Record<string, BuildRuleDefinition>
}

function cloneActiveSkills(source: Record<string, ActiveSkillDefinition>) {
  return Object.fromEntries(
    Object.entries(source).map(([skillId, skill]) => [
      skillId,
      {
        ...skill,
        skillTags: skill.skillTags ? [...skill.skillTags] : undefined,
        grantedStatusIds: [...skill.grantedStatusIds],
      },
    ]),
  ) as Record<string, ActiveSkillDefinition>
}

function clonePassiveTalents(source: Record<string, PassiveTalentDefinition>) {
  return Object.fromEntries(
    Object.entries(source).map(([talentId, talent]) => [
      talentId,
      {
        ...talent,
        talentTags: talent.talentTags ? [...talent.talentTags] : undefined,
        grantedStatusIds: [...talent.grantedStatusIds],
      },
    ]),
  ) as Record<string, PassiveTalentDefinition>
}

function cloneStatuses(source: Record<string, PlayerBuildStatusDefinition>) {
  return Object.fromEntries(Object.entries(source).map(([statusId, status]) => [statusId, { ...status }])) as Record<string, PlayerBuildStatusDefinition>
}

function cloneActivePreset(entry: BuildPresetActiveEntry): BuildPresetActiveEntry {
  return { ...entry }
}

function clonePassivePreset(entry: BuildPresetPassiveEntry): BuildPresetPassiveEntry {
  return { ...entry }
}

export function resetPlayerBuildCatalog() {
  classDefinitionsById = clonePlayerClasses(DEFAULT_PLAYER_CLASSES)
  buildRulesById = cloneBuildRules(DEFAULT_BUILD_RULES)
  activeSkillsById = cloneActiveSkills(BUILTIN_ACTIVE_SKILLS)
  activeStatusesById = cloneStatuses(DEFAULT_ACTIVE_STATUS_DEFINITIONS)
  activeSkillEffectDefinitionsById = Object.fromEntries(
    Object.entries(DEFAULT_ACTIVE_SKILL_EFFECTS).map(([effectId, definition]) => [effectId, { ...definition }]),
  ) as Record<string, ActiveSkillEffectDefinition>
  passiveTalentsById = clonePassiveTalents(BUILTIN_PASSIVE_TALENTS)
  passiveTalentEffectDefinitionsById = Object.fromEntries(
    Object.entries(DEFAULT_PASSIVE_TALENT_EFFECTS).map(([effectId, definition]) => [effectId, { ...definition }]),
  ) as Record<string, PassiveTalentEffectDefinition>
  passiveStatusesById = cloneStatuses(DEFAULT_PASSIVE_STATUS_DEFINITIONS)
  defaultActiveBuilds = DEFAULT_ACTIVE_PRESETS.map(cloneActivePreset)
  defaultPassiveBuilds = DEFAULT_PASSIVE_PRESETS.map(clonePassivePreset)
  iconDefinitions = DEFAULT_ICON_DEFINITIONS.map((entry) => ({ ...entry }))
  workbookPassiveCatalogClassIds = new Set<string>()
  workbookPassiveCatalogTalentIds = new Set<PassiveTalentId>()
}

function createEmptyLoadout(): SkillLoadout {
  return {
    '1': null,
    '2': null,
    '3': null,
    '4': null,
    Q: null,
    E: null,
    R: null,
    F: null,
  }
}

function normalizeStatusEffectKind(statusCategory: PlayerBuildStatusDefinition['statusCategory']) {
  if (statusCategory === 'enemyDebuff') {
    return { tone: 'buff' as const, kind: 'playerDebuff' as const }
  }

  if (statusCategory === 'partyBuff') {
    return { tone: 'buff' as const, kind: 'neutral' as const }
  }

  if (statusCategory === 'partyDebuff') {
    return { tone: 'danger' as const, kind: 'partyDebuff' as const }
  }

  return { tone: 'buff' as const, kind: 'playerBuff' as const }
}

export function createStatusEffectFromDefinition(definition: PlayerBuildStatusDefinition): StatusEffect {
  const presentation = normalizeStatusEffectKind(definition.statusCategory)
  const durationMs = definition.durationMs < 0 ? -1 : definition.durationMs

  return {
    id: definition.statusId,
    iconId: definition.iconId,
    label: definition.statusName,
    shortLabel: definition.statusName.slice(0, 1),
    remainingMs: durationMs,
    totalMs: durationMs,
    tone: presentation.tone,
    kind: presentation.kind,
    effectLogicId: definition.effectLogicId,
    maxStacks: definition.maxStacks,
  }
}

function getSkillPointCost(skillId: SkillId | null) {
  return skillId ? activeSkillsById[skillId]?.pointCost ?? ACTIVE_SKILL_POINT_COST : 0
}

function getTalentPointCost(talentId: PassiveTalentId) {
  return passiveTalentsById[talentId]?.cost ?? 0
}

function getRequiredBuildRule(buildRuleId: string) {
  const rule = buildRulesById[buildRuleId]
  if (!rule?.enabled) {
    throw new Error(`Unknown build rule: ${buildRuleId}`)
  }
  return rule
}

function getActivePresetPriority(buildRuleId: string, hotkey: SkillHotkey, skillId: SkillId | null) {
  const entries = defaultActiveBuilds
    .filter((entry) => (entry.buildRuleId ?? 'default') === buildRuleId && entry.hotkey === hotkey && entry.skillId === skillId)
    .concat(defaultActiveBuilds.filter((entry) => !entry.buildRuleId && entry.hotkey === hotkey && entry.skillId === skillId))

  return entries[0]?.priority ?? 999
}

function getPassivePresetPriority(buildRuleId: string, talentId: PassiveTalentId) {
  const entries = defaultPassiveBuilds
    .filter((entry) => (entry.buildRuleId ?? 'default') === buildRuleId && entry.talentId === talentId)
    .concat(defaultPassiveBuilds.filter((entry) => !entry.buildRuleId && entry.talentId === talentId))

  return entries[0]?.priority ?? 999
}

function createWarning(code: BuildConflictWarning['code'], message: string): BuildConflictWarning {
  return { code, message }
}

function isSkillAllowedByRule(
  buildRuleId: string,
  classId: PlayerClassId,
  skillId: SkillId,
  unlockedActiveSkillIds?: readonly SkillId[],
) {
  getRequiredBuildRule(buildRuleId)
  const skill = activeSkillsById[skillId]

  if (!skill?.enabled) {
    return false
  }
  if (unlockedActiveSkillIds && !unlockedActiveSkillIds.includes(skillId)) {
    return false
  }
  if (skill.classId !== classId) {
    return false
  }

  return true
}

function isTalentAllowedByRule(
  buildRuleId: string,
  classId: PlayerClassId,
  talentId: PassiveTalentId,
  maxUnlockedTier = Infinity,
) {
  getRequiredBuildRule(buildRuleId)
  const talent = passiveTalentsById[talentId]

  if (!talent?.enabled) {
    return false
  }
  if (talent.tier > maxUnlockedTier) {
    return false
  }
  if (talent.classId !== classId) {
    return false
  }

  return true
}

export function canUseSkillInRule(
  buildRuleId: string,
  classId: PlayerClassId,
  skillId: SkillId,
  unlockedActiveSkillIds?: readonly SkillId[],
) {
  return isSkillAllowedByRule(buildRuleId, classId, skillId, unlockedActiveSkillIds)
}

export function canUseTalentInRule(
  buildRuleId: string,
  classId: PlayerClassId,
  talentId: PassiveTalentId,
  maxUnlockedTier = Infinity,
) {
  return isTalentAllowedByRule(buildRuleId, classId, talentId, maxUnlockedTier)
}

export function getBuildRuleDefinition(buildRuleId: string) {
  const rule = buildRulesById[buildRuleId]
  return rule && rule.enabled
    ? {
        ...rule,
        enabledHotkeys: [...rule.enabledHotkeys],
      }
    : undefined
}

export function getPlayerClassDefinition(classId: string) {
  const definition = classDefinitionsById[classId]
  return definition?.enabled === false
    ? undefined
    : definition
      ? {
          ...definition,
          recommendedBuildRuleIds: [...definition.recommendedBuildRuleIds],
        }
      : undefined
}

export function getPlayerClassCatalog() {
  return Object.values(classDefinitionsById)
    .filter((definition) => definition.enabled)
    .map((definition) => getPlayerClassDefinition(definition.classId)!)
}

export function getBuildRuleCatalog() {
  return Object.values(buildRulesById)
    .filter((rule) => rule.enabled)
    .map((rule) => getBuildRuleDefinition(rule.buildRuleId)!)
}

export function getActiveSkillDefinition(skillId: SkillId) {
  const definition = activeSkillsById[skillId]
  return definition?.enabled === false
    ? undefined
    : definition
      ? {
          ...definition,
          skillTags: definition.skillTags ? [...definition.skillTags] : undefined,
          grantedStatusIds: [...definition.grantedStatusIds],
        }
      : undefined
}

export function getActiveSkillCatalog() {
  return Object.values(activeSkillsById)
    .filter((skill) => skill.enabled !== false)
    .map((skill) => getActiveSkillDefinition(skill.id)!)
}

export function getPassiveTalentDefinition(talentId: PassiveTalentId) {
  const definition = passiveTalentsById[talentId]
  return definition?.enabled === false
    ? undefined
    : definition
      ? {
          ...definition,
          talentTags: definition.talentTags ? [...definition.talentTags] : undefined,
          grantedStatusIds: [...definition.grantedStatusIds],
        }
      : undefined
}

export function getPassiveTalentCatalog() {
  return Object.values(passiveTalentsById)
    .filter((talent) => {
      if (talent.enabled === false) {
        return false
      }
      if (talent.classId && workbookPassiveCatalogClassIds.has(talent.classId)) {
        return workbookPassiveCatalogTalentIds.has(talent.id)
      }
      return true
    })
    .sort((left, right) => (left.uiOrder ?? 999) - (right.uiOrder ?? 999) || left.id.localeCompare(right.id))
    .map((talent) => getPassiveTalentDefinition(talent.id)!)
}

export function getPlayerBuildStatusDefinition(statusId: string) {
  const definition = activeStatusesById[statusId] ?? passiveStatusesById[statusId]
  return definition?.enabled === false ? undefined : definition ? { ...definition } : undefined
}

export function getStatusesForSkill(skillId: SkillId) {
  return (activeSkillsById[skillId]?.grantedStatusIds ?? [])
    .map((statusId) => getPlayerBuildStatusDefinition(statusId))
    .filter((definition): definition is PlayerBuildStatusDefinition => Boolean(definition))
}

export function getStatusesForTalent(talentId: PassiveTalentId) {
  return (passiveTalentsById[talentId]?.grantedStatusIds ?? [])
    .map((statusId) => getPlayerBuildStatusDefinition(statusId))
    .filter((definition): definition is PlayerBuildStatusDefinition => Boolean(definition))
}

export function getBuildIconDefinitions() {
  return iconDefinitions.filter((entry) => entry.enabled).map((entry) => ({ ...entry }))
}

export function getSkillEffectsForSkill(skillId: SkillId) {
  return Object.values(activeSkillEffectDefinitionsById)
    .filter((definition) => definition.enabled && definition.skillId === skillId)
    .sort((left, right) => left.effectIndex - right.effectIndex)
    .map((definition) => ({ ...definition }))
}

export function getTalentEffectsForTalent(talentId: PassiveTalentId) {
  return Object.values(passiveTalentEffectDefinitionsById)
    .filter((definition) => definition.enabled && definition.talentId === talentId)
    .sort((left, right) => left.effectIndex - right.effectIndex)
    .map((definition) => ({ ...definition }))
}

export function getIconAssetKey(iconId: string) {
  return iconDefinitions.find((entry) => entry.iconId === iconId && entry.enabled)?.assetKey
}

function getDefaultActiveEntries(buildRuleId: string, classId: PlayerClassId) {
  const exact = defaultActiveBuilds.filter(
    (entry) => entry.buildRuleId === buildRuleId && entry.classId === classId,
  )
  const classDefault = defaultActiveBuilds.filter(
    (entry) => !entry.buildRuleId && entry.classId === classId,
  )
  return (exact.length > 0 ? exact : classDefault).sort((left, right) => left.priority - right.priority)
}

export function getDefaultPersistedBuildForRule(
  buildRuleId: string,
  classId: PlayerClassId,
): PersistedBuildState {
  getRequiredBuildRule(buildRuleId)
  const activeEntries = getDefaultActiveEntries(buildRuleId, classId)
  if (activeEntries.length === 0) {
    throw new Error(`Missing default active build for class ${classId} and rule ${buildRuleId}`)
  }
  const loadout = createEmptyLoadout()

  for (const entry of activeEntries) {
    loadout[entry.hotkey] = entry.skillId
  }

  const exactPassives = defaultPassiveBuilds.filter(
    (entry) => entry.selected && entry.buildRuleId === buildRuleId && entry.classId === classId,
  )
  const classPassives = defaultPassiveBuilds.filter(
    (entry) => entry.selected && !entry.buildRuleId && entry.classId === classId,
  )
  const passiveTalentIds = (exactPassives.length > 0 ? exactPassives : classPassives)
    .sort((left, right) => left.priority - right.priority)
    .map((entry) => entry.talentId)

  return { loadout, passiveTalentIds }
}

export const defaultSkillLoadout = getDefaultPersistedBuildForRule('standard_5slot', WARRIOR_T_CLASS_ID).loadout
export const defaultSelectedPassiveTalentIds = getDefaultPersistedBuildForRule(
  'standard_5slot',
  WARRIOR_T_CLASS_ID,
).passiveTalentIds

const emptyModifiers: PassiveTalentModifiers = {
  playerMaxHpBonus: 0,
  playerMaxHpMultiplier: 1,
  playerMaxResourceBonus: 0,
  playerResourceRegenMultiplier: 1,
  playerDamageTakenMultiplier: 1,
  playerPassiveBuffs: [],
  stunHitsCross: false,
  interruptIgnoresGcd: false,
  burstCooldownMultiplier: 1,
  burstEffectMultiplier: 1,
  cleaveHitsCross: false,
  shieldWallDurationMultiplier: 1,
  shieldWallCooldownMultiplier: 1,
  shieldWallMaxCharges: 1,
  partyMaxHpMultiplier: 1,
  partyMaxPressureBonus: 0,
  partyMaxPressureMultiplier: 1,
  partyHpDriftPerSecond: 0,
  partyPressureDriftPerSecond: 0,
  partyPressureCanDriftDown: true,
  partyDamageMultiplier: 1,
  partyThreatMultiplier: 1,
  periodicPlayerStunIntervalMs: 0,
  periodicPlayerStunDurationMs: 0,
  tauntCooldownMultiplier: 1,
  massTauntCooldownMultiplier: 1,
  bonusBuildPoints: 0,
  playerAutoAttackDamageBonus: 0,
  playerAutoAttackResourceGainBonus: 0,
  interruptVulnerabilityDurationMs: 0,
  interruptVulnerabilityDamageTakenMultiplierBonus: 0,
  revengeRefundChance: 0,
  revengeRefundResource: 0,
  shieldSlamPunishDurationMs: 0,
  shieldSlamPunishMaxStacks: 0,
  shieldSlamPunishOutgoingDamageReductionRatio: 0,
  shieldBlockDurationBonusMs: 0,
  demoralizingShoutResourceGain: 0,
  shockwaveUsesMatrix3x3: false,
  thunderstruckDamageMultiplier: 1,
  thunderstruckThreatMultiplierOverride: null,
}

export function getPassiveModifiers(selectedPassiveTalentIds: PassiveTalentId[]) {
  return selectedPassiveTalentIds.reduce<PassiveTalentModifiers>((modifiers, talentId) => {
    const talent = passiveTalentsById[talentId]
    if (!talent || talent.enabled === false) {
      return modifiers
    }

    return applyPassiveTalentLogic(talent, modifiers, {
      resolveStatusDefinition: getPlayerBuildStatusDefinition,
      createStatusEffectFromDefinition,
      resolveTalentEffects: getTalentEffectsForTalent,
    })
  }, emptyModifiers)
}

export function getPassivePointCost(selectedPassiveTalentIds: PassiveTalentId[]) {
  return selectedPassiveTalentIds.reduce((total, talentId) => total + getTalentPointCost(talentId), 0)
}

export function getNextPassiveTalentIdsForToggle(
  passiveTalentId: PassiveTalentId,
  selectedPassiveTalentIds: PassiveTalentId[],
) {
  if (selectedPassiveTalentIds.includes(passiveTalentId)) {
    return selectedPassiveTalentIds.filter((id) => id !== passiveTalentId)
  }

  const nextTalent = passiveTalentsById[passiveTalentId]
  const exclusiveGroup = nextTalent?.exclusiveGroup

  return [
    ...selectedPassiveTalentIds.filter((talentId) => {
      const selectedTalent = passiveTalentsById[talentId]
      return !exclusiveGroup || selectedTalent?.exclusiveGroup !== exclusiveGroup
    }),
    passiveTalentId,
  ]
}

export function getActivePointCost(loadout: SkillLoadout) {
  return SKILL_HOTKEYS.reduce((total, hotkey) => total + getSkillPointCost(loadout[hotkey]), 0)
}

export function getTotalBuildPoints(buildRuleId: string, selectedPassiveTalentIds: PassiveTalentId[]) {
  return getRequiredBuildRule(buildRuleId).totalBuildPoints + getPassiveModifiers(selectedPassiveTalentIds).bonusBuildPoints
}

export function getRemainingBuildPoints(
  buildRuleId: string,
  loadout: SkillLoadout,
  selectedPassiveTalentIds: PassiveTalentId[],
) {
  return getTotalBuildPoints(buildRuleId, selectedPassiveTalentIds) -
    getActivePointCost(loadout) -
    getPassivePointCost(selectedPassiveTalentIds)
}

export function isHotkeyEnabledForRule(buildRuleId: string, hotkey: SkillHotkey) {
  return getRequiredBuildRule(buildRuleId).enabledHotkeys.includes(hotkey)
}

export function normalizePersistedBuildForRule(
  previousBuild: PersistedBuildState | null | undefined,
  buildRuleId: string,
  classId: PlayerClassId,
  maxUnlockedPassiveTalentTier = Infinity,
  unlockedActiveSkillIds?: readonly SkillId[],
  newlyUnlockedActiveSkillIds: readonly SkillId[] = [],
): BuildNormalizationResult {
  const rule = getRequiredBuildRule(buildRuleId)
  if (rule.inheritancePolicy === 'reset_to_default') {
    return {
      build: getDefaultPersistedBuildForRule(buildRuleId, classId),
      warnings: [createWarning('reset_default', `This stage uses ${rule.ruleName}; the build was reset to the rule default.`)],
    }
  }

  const warnings: BuildConflictWarning[] = []
  const nextLoadout = createEmptyLoadout()
  const sourceBuild = previousBuild ?? getDefaultPersistedBuildForRule(buildRuleId, classId)
  const seenSkills = new Set<SkillId>()

  for (const hotkey of SKILL_HOTKEYS) {
    const skillId = sourceBuild.loadout[hotkey]
    if (!skillId) {
      continue
    }

    if (!rule.enabledHotkeys.includes(hotkey)) {
      warnings.push(createWarning('cleared_hotkey', `Hotkey ${hotkey} is not enabled for this stage.`))
      continue
    }
    if (!isSkillAllowedByRule(buildRuleId, classId, skillId, unlockedActiveSkillIds)) {
      warnings.push(createWarning('removed_skill', `Skill ${activeSkillsById[skillId]?.name ?? skillId} is not allowed by this stage build rule.`))
      continue
    }
    if (seenSkills.has(skillId)) {
      warnings.push(createWarning('removed_skill', `Duplicate skill ${activeSkillsById[skillId]?.name ?? skillId} was removed.`))
      continue
    }

    seenSkills.add(skillId)
    nextLoadout[hotkey] = skillId
  }

  let nextPassiveTalentIds = sourceBuild.passiveTalentIds.filter((talentId, index, array) => {
    if (array.indexOf(talentId) !== index) {
      return false
    }
    if (!isTalentAllowedByRule(buildRuleId, classId, talentId, maxUnlockedPassiveTalentTier)) {
      warnings.push(createWarning('removed_talent', `Talent ${passiveTalentsById[talentId]?.name ?? talentId} is not allowed by this stage build rule.`))
      return false
    }

    return true
  })

  const activeHotkeys = SKILL_HOTKEYS.filter((hotkey) => nextLoadout[hotkey])
  if (activeHotkeys.length > rule.maxActiveSlots) {
    const removableHotkeys = activeHotkeys.sort((left, right) => {
      const leftPriority = getActivePresetPriority(buildRuleId, left, nextLoadout[left])
      const rightPriority = getActivePresetPriority(buildRuleId, right, nextLoadout[right])
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }
      return (HOTKEY_ORDER.get(left) ?? 0) - (HOTKEY_ORDER.get(right) ?? 0)
    })

    for (const hotkey of removableHotkeys.slice(rule.maxActiveSlots)) {
      const skillId = nextLoadout[hotkey]
      nextLoadout[hotkey] = null
      if (skillId) {
        warnings.push(createWarning('removed_skill', `This stage allows ${rule.maxActiveSlots} active skills; ${activeSkillsById[skillId]?.name ?? skillId} was removed.`))
      }
    }
  }

  const usableNewSkillIds = newlyUnlockedActiveSkillIds.filter((skillId, index, array) =>
    array.indexOf(skillId) === index &&
    !seenSkills.has(skillId) &&
    isSkillAllowedByRule(buildRuleId, classId, skillId, unlockedActiveSkillIds)
  )
  const autoPlacedNewSkillIds = new Set<SkillId>()

  const getActiveHotkeyCount = () => rule.enabledHotkeys.filter((hotkey) => nextLoadout[hotkey] !== null).length
  const getLastReplaceableHotkeys = () =>
    [...rule.enabledHotkeys]
      .reverse()
      .filter((hotkey) => {
        const skillId = nextLoadout[hotkey]
        return Boolean(skillId && !autoPlacedNewSkillIds.has(skillId))
      })

  const markNewSkillPlaced = (skillId: SkillId, hotkey: SkillHotkey, replacedSkillIds: SkillId[]) => {
    for (const replacedSkillId of replacedSkillIds) {
      seenSkills.delete(replacedSkillId)
    }
    seenSkills.add(skillId)
    autoPlacedNewSkillIds.add(skillId)

    const [directlyReplacedSkillId, ...removedForPointsSkillIds] = replacedSkillIds
    if (directlyReplacedSkillId) {
      warnings.push(createWarning('removed_skill', `Newly unlocked skill ${activeSkillsById[skillId]?.name ?? skillId} was placed in ${hotkey}, replacing ${activeSkillsById[directlyReplacedSkillId]?.name ?? directlyReplacedSkillId}.`))
    }
    for (const removedSkillId of removedForPointsSkillIds) {
      warnings.push(createWarning('removed_for_points', `Not enough build points; skill ${activeSkillsById[removedSkillId]?.name ?? removedSkillId} was removed for newly unlocked skill ${activeSkillsById[skillId]?.name ?? skillId}.`))
    }
  }

  for (const skillId of usableNewSkillIds) {
    const emptyHotkey = getActiveHotkeyCount() < rule.maxActiveSlots
      ? rule.enabledHotkeys.find((hotkey) => nextLoadout[hotkey] === null)
      : undefined

    if (emptyHotkey) {
      nextLoadout[emptyHotkey] = skillId
      if (getRemainingBuildPoints(buildRuleId, nextLoadout, nextPassiveTalentIds) >= 0) {
        markNewSkillPlaced(skillId, emptyHotkey, [])
        continue
      }

      nextLoadout[emptyHotkey] = null
    }

    const originalLoadout = { ...nextLoadout }
    const targetHotkey = getLastReplaceableHotkeys()[0]
    if (!targetHotkey) {
      continue
    }

    const replacedSkillIds: SkillId[] = []
    const replacedSkillId = nextLoadout[targetHotkey]
    if (replacedSkillId) {
      replacedSkillIds.push(replacedSkillId)
    }
    nextLoadout[targetHotkey] = skillId

    while (getRemainingBuildPoints(buildRuleId, nextLoadout, nextPassiveTalentIds) < 0) {
      const removableHotkey = getLastReplaceableHotkeys().find((hotkey) => hotkey !== targetHotkey)
      if (!removableHotkey) {
        break
      }

      const removedSkillId = nextLoadout[removableHotkey]
      nextLoadout[removableHotkey] = null
      if (removedSkillId) {
        replacedSkillIds.push(removedSkillId)
      }
    }

    if (getRemainingBuildPoints(buildRuleId, nextLoadout, nextPassiveTalentIds) >= 0) {
      markNewSkillPlaced(skillId, targetHotkey, replacedSkillIds)
      continue
    }

    for (const hotkey of SKILL_HOTKEYS) {
      nextLoadout[hotkey] = originalLoadout[hotkey]
    }
  }

  while (getRemainingBuildPoints(buildRuleId, nextLoadout, nextPassiveTalentIds) < 0) {
    if (nextPassiveTalentIds.length > 0) {
      const removablePassive = [...nextPassiveTalentIds].sort((left, right) => {
        const leftPriority = getPassivePresetPriority(buildRuleId, left)
        const rightPriority = getPassivePresetPriority(buildRuleId, right)
        if (rule.inheritancePolicy === 'keep_balanced' && getTalentPointCost(left) !== getTalentPointCost(right)) {
          return getTalentPointCost(right) - getTalentPointCost(left)
        }
        return rightPriority - leftPriority
      })[0]

      if (removablePassive) {
        nextPassiveTalentIds = nextPassiveTalentIds.filter((talentId) => talentId !== removablePassive)
        warnings.push(createWarning('removed_for_points', `Not enough build points; talent ${passiveTalentsById[removablePassive]?.name ?? removablePassive} was removed.`))
        continue
      }
    }

    const removableHotkey = [...rule.enabledHotkeys]
      .filter((hotkey) => nextLoadout[hotkey] !== null)
      .sort((left, right) => {
        const leftPriority = getActivePresetPriority(buildRuleId, left, nextLoadout[left])
        const rightPriority = getActivePresetPriority(buildRuleId, right, nextLoadout[right])
        return rightPriority - leftPriority
      })[0]

    if (!removableHotkey) {
      break
    }

    const removedSkillId = nextLoadout[removableHotkey]
    nextLoadout[removableHotkey] = null
    if (removedSkillId) {
      warnings.push(createWarning('removed_for_points', `Not enough build points; skill ${activeSkillsById[removedSkillId]?.name ?? removedSkillId} was removed.`))
    }
  }

  if (!SKILL_HOTKEYS.some((hotkey) => nextLoadout[hotkey])) {
    return {
      build: getDefaultPersistedBuildForRule(buildRuleId, classId),
      warnings: [
        ...warnings,
        createWarning('reset_default', `The inherited build cannot be used in this stage; it was reset to the ${rule.ruleName} default.`),
      ],
    }
  }

  return {
    build: {
      loadout: nextLoadout,
      passiveTalentIds: nextPassiveTalentIds,
    },
    warnings,
  }
}

export function assertBuildMatchesClass(classId: PlayerClassId, build: PersistedBuildState) {
  for (const skillId of Object.values(build.loadout)) {
    if (skillId && activeSkillsById[skillId]?.classId !== classId) {
      throw new Error(`Build for ${classId} contains skill owned by another class: ${skillId}`)
    }
  }

  for (const talentId of build.passiveTalentIds) {
    if (passiveTalentsById[talentId]?.classId !== classId) {
      throw new Error(`Build for ${classId} contains talent owned by another class: ${talentId}`)
    }
  }
}

function getSkillTemplateForBuild(skillId: SkillId, selectedPassiveTalentIds: PassiveTalentId[]) {
  const base = activeSkillsById[skillId]
  const modifiers = getPassiveModifiers(selectedPassiveTalentIds)

  if (!base) {
    throw new Error(`Unknown active skill: ${skillId}`)
  }

  return applySkillTemplateMutation(base, modifiers)
}

function scaleCooldown(previousSkill: SkillState | undefined, nextCooldownMs: number, fallbackRemainingMs: number) {
  if (!previousSkill) {
    return fallbackRemainingMs
  }
  if (previousSkill.cooldownMs <= 0 || previousSkill.remainingCooldownMs <= 0) {
    return 0
  }

  return Math.round(nextCooldownMs * (previousSkill.remainingCooldownMs / previousSkill.cooldownMs))
}

export function buildSkillsFromLoadout(
  loadout: SkillLoadout,
  selectedPassiveTalentIds: PassiveTalentId[],
  previousSkills: SkillState[] = [],
) {
  const previousSkillMap = new Map(previousSkills.map((skill) => [skill.id, skill]))

  return SKILL_HOTKEYS.flatMap((hotkey) => {
    const skillId = loadout[hotkey]
    if (!skillId) {
      return []
    }

    const template = getSkillTemplateForBuild(skillId, selectedPassiveTalentIds)
    const previousSkill = previousSkillMap.get(skillId)

    return [
      {
        id: template.id,
        name: template.name,
        shortName: template.shortName,
        iconId: template.iconId,
        hotkey,
        cooldownMs: template.cooldownMs,
        remainingCooldownMs: scaleCooldown(previousSkill, template.cooldownMs, template.initialRemainingCooldownMs),
        resourceCost: template.resourceCost,
        gcdMs: template.gcdMs,
        ...(() => {
          const modifiers = getPassiveModifiers(selectedPassiveTalentIds)
          if (template.skillLogicId !== 'shield_wall' || modifiers.shieldWallMaxCharges <= 1) {
            return {}
          }

          const previousCurrentCharges = previousSkill?.currentCharges ?? modifiers.shieldWallMaxCharges
          return {
            maxCharges: modifiers.shieldWallMaxCharges,
            currentCharges: Math.min(modifiers.shieldWallMaxCharges, previousCurrentCharges),
          }
        })(),
      },
    ]
  })
}

export const initialSkills: SkillState[] = buildSkillsFromLoadout(defaultSkillLoadout, defaultSelectedPassiveTalentIds)

export function applyPlayerBuildWorkbookOverrides(overrides: PlayerBuildWorkbookOverrides) {
  if (overrides.classDefinitions.length > 0) {
    const nextClasses = clonePlayerClasses(DEFAULT_PLAYER_CLASSES)

    for (const override of overrides.classDefinitions) {
      const base = nextClasses[override.classId] ?? {
        classId: override.classId,
        className: override.classId,
        roleTag: 'tank' as const,
        classDescription: '',
        recommendedBuildRuleIds: [],
        enabled: true,
      }

      nextClasses[override.classId] = {
        ...base,
        ...(override.className ? { className: override.className } : {}),
        ...(override.roleTag ? { roleTag: override.roleTag } : {}),
        ...(override.classDescription ? { classDescription: override.classDescription } : {}),
        ...(override.recommendedBuildRuleIds ? { recommendedBuildRuleIds: [...override.recommendedBuildRuleIds] } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }

    classDefinitionsById = nextClasses
  }

  if (overrides.buildRuleDefinitions.length > 0) {
    const nextRules = cloneBuildRules(DEFAULT_BUILD_RULES)
    for (const override of overrides.buildRuleDefinitions) {
      const base = nextRules[override.buildRuleId] ?? {
        buildRuleId: override.buildRuleId,
        classId: 'warrior_t',
        ruleName: override.buildRuleId,
        description: '',
        totalBuildPoints: 0,
        maxActiveSlots: 0,
        enabledHotkeys: [],
        inheritancePolicy: 'keep_active_first' as const,
        enabled: true,
      }

      nextRules[override.buildRuleId] = {
        ...base,
        ...(override.classId ? { classId: override.classId } : {}),
        ...(override.ruleName ? { ruleName: override.ruleName } : {}),
        ...(override.description ? { description: override.description } : {}),
        ...(typeof override.totalBuildPoints === 'number' ? { totalBuildPoints: override.totalBuildPoints } : {}),
        ...(typeof override.maxActiveSlots === 'number' ? { maxActiveSlots: override.maxActiveSlots } : {}),
        ...(override.enabledHotkeys ? { enabledHotkeys: [...override.enabledHotkeys] } : {}),
        ...(override.inheritancePolicy ? { inheritancePolicy: override.inheritancePolicy } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }
    buildRulesById = nextRules
  }

  if (overrides.activeSkillDefinitions.length > 0) {
    const nextSkills = cloneActiveSkills(BUILTIN_ACTIVE_SKILLS)
    for (const override of overrides.activeSkillDefinitions) {
      const base = nextSkills[override.skillId] ?? {
        id: override.skillId,
        classId: override.classId,
        name: override.skillId,
        shortName: override.skillId,
        description: '',
        iconId: override.skillId,
        cooldownMs: 0,
        initialRemainingCooldownMs: 0,
        resourceCost: 0,
        gcdMs: 0,
        pointCost: ACTIVE_SKILL_POINT_COST,
        targetingType: 'currentEnemy',
        skillLogicId: 'taunt_single',
        castStopMode: 'none' as const,
        canAffectSkull: true,
        skillTags: [],
        uiOrder: 999,
        unlockHint: '',
        grantedStatusIds: [],
        enabled: true,
      }

      nextSkills[override.skillId] = {
        ...base,
        ...(override.classId ? { classId: override.classId } : {}),
        ...(override.skillName ? { name: override.skillName } : {}),
        ...(override.shortName ? { shortName: override.shortName } : {}),
        ...(override.description ? { description: override.description } : {}),
        ...(override.iconId ? { iconId: override.iconId } : {}),
        ...(typeof override.pointCost === 'number' ? { pointCost: override.pointCost } : {}),
        ...(typeof override.resourceCost === 'number' ? { resourceCost: override.resourceCost } : {}),
        ...(typeof override.cooldownMs === 'number' ? { cooldownMs: override.cooldownMs } : {}),
        ...(typeof override.initialRemainingCooldownMs === 'number' ? { initialRemainingCooldownMs: override.initialRemainingCooldownMs } : {}),
        ...(typeof override.gcdMs === 'number' ? { gcdMs: override.gcdMs } : {}),
        ...(override.targetingType ? { targetingType: override.targetingType } : {}),
        ...(override.skillLogicId ? { skillLogicId: override.skillLogicId } : {}),
        ...(override.castStopMode ? { castStopMode: override.castStopMode } : {}),
        ...(typeof override.canAffectSkull === 'boolean' ? { canAffectSkull: override.canAffectSkull } : {}),
        ...(override.skillTags ? { skillTags: [...override.skillTags] } : {}),
        ...(typeof override.uiOrder === 'number' ? { uiOrder: override.uiOrder } : {}),
        ...(override.unlockHint ? { unlockHint: override.unlockHint } : {}),
        ...(override.grantedStatusIds ? { grantedStatusIds: [...override.grantedStatusIds] } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }
    activeSkillsById = nextSkills
  }

  if (overrides.activeSkillEffectDefinitions.length > 0) {
    const nextEffects = Object.fromEntries(
      Object.entries(DEFAULT_ACTIVE_SKILL_EFFECTS).map(([effectId, definition]) => [effectId, { ...definition }]),
    ) as Record<string, ActiveSkillEffectDefinition>

    for (const override of overrides.activeSkillEffectDefinitions) {
      const base = nextEffects[override.skillEffectId] ?? {
        skillEffectId: override.skillEffectId,
        skillId: override.skillId ?? '',
        effectIndex: override.effectIndex ?? 1,
        targetSelector: override.targetSelector ?? 'current',
        enabled: true,
      }

      nextEffects[override.skillEffectId] = {
        ...base,
        ...(override.skillId ? { skillId: override.skillId } : {}),
        ...(typeof override.effectIndex === 'number' ? { effectIndex: override.effectIndex } : {}),
        ...(override.skillLogicId ? { skillLogicId: override.skillLogicId } : {}),
        ...(override.targetSelector ? { targetSelector: override.targetSelector } : {}),
        ...(typeof override.valueA === 'number' ? { valueA: override.valueA } : {}),
        ...(typeof override.valueB === 'number' ? { valueB: override.valueB } : {}),
        ...(typeof override.durationMs === 'number' ? { durationMs: override.durationMs } : {}),
        ...(override.statusId ? { statusId: override.statusId } : {}),
        ...(typeof override.threatDelta === 'number' ? { threatDelta: override.threatDelta } : {}),
        ...(typeof override.threatMultiplier === 'number'
          ? { threatMultiplier: override.threatMultiplier }
          : {}),
        ...(override.threatSource ? { threatSource: override.threatSource } : {}),
        ...(override.notes ? { notes: override.notes } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }

    activeSkillEffectDefinitionsById = nextEffects
  }

  if (overrides.activeStatusDefinitions.length > 0) {
    const nextStatuses = cloneStatuses(DEFAULT_ACTIVE_STATUS_DEFINITIONS)
    for (const override of overrides.activeStatusDefinitions) {
      const base = nextStatuses[override.statusId] ?? {
        statusId: override.statusId,
        statusName: override.statusId,
        statusCategory: 'playerBuff' as const,
        iconId: override.statusId,
        durationMs: 0,
        maxStacks: 1,
        dispellable: false,
        description: '',
        effectLogicId: 'none',
        enabled: true,
      }

      nextStatuses[override.statusId] = {
        ...base,
        ...(override.statusName ? { statusName: override.statusName } : {}),
        ...(override.statusCategory ? { statusCategory: override.statusCategory } : {}),
        ...(override.iconId ? { iconId: override.iconId } : {}),
        ...(typeof override.durationMs === 'number' ? { durationMs: override.durationMs } : {}),
        ...(typeof override.maxStacks === 'number' ? { maxStacks: override.maxStacks } : {}),
        ...(typeof override.dispellable === 'boolean' ? { dispellable: override.dispellable } : {}),
        ...(override.description ? { description: override.description } : {}),
        ...(override.effectLogicId ? { effectLogicId: override.effectLogicId } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }
    activeStatusesById = nextStatuses
  }

  if (overrides.passiveTalentDefinitions.length > 0) {
    const nextTalents = clonePassiveTalents(BUILTIN_PASSIVE_TALENTS)
    workbookPassiveCatalogClassIds = new Set(
      overrides.passiveTalentDefinitions
        .map((override) => override.classId)
        .filter((classId): classId is string => Boolean(classId)),
    )
    workbookPassiveCatalogTalentIds = new Set(overrides.passiveTalentDefinitions.map((override) => override.talentId))

    for (const override of overrides.passiveTalentDefinitions) {
      const base = nextTalents[override.talentId] ?? {
        id: override.talentId,
        classId: override.classId,
        name: override.talentId,
        category: 'player' as const,
        cost: 1,
        description: '',
        iconId: override.talentId,
        talentLogicId: 'player_max_hp_up',
        tier: override.tier,
        talentTags: [],
        uiOrder: 999,
        exclusiveGroup: '',
        grantedStatusIds: [],
        enabled: true,
      }

      nextTalents[override.talentId] = {
        ...base,
        ...(override.classId ? { classId: override.classId } : {}),
        ...(override.talentName ? { name: override.talentName } : {}),
        ...(override.category ? { category: override.category } : {}),
        ...(typeof override.cost === 'number' ? { cost: override.cost } : {}),
        ...(override.description ? { description: override.description } : {}),
        ...(override.iconId ? { iconId: override.iconId } : {}),
        ...(override.talentLogicId ? { talentLogicId: override.talentLogicId } : {}),
        tier: override.tier,
        ...(override.talentTags ? { talentTags: [...override.talentTags] } : {}),
        ...(typeof override.uiOrder === 'number' ? { uiOrder: override.uiOrder } : {}),
        ...(override.exclusiveGroup ? { exclusiveGroup: override.exclusiveGroup } : {}),
        ...(override.grantedStatusIds ? { grantedStatusIds: [...override.grantedStatusIds] } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }
    passiveTalentsById = nextTalents
  }

  if (overrides.passiveTalentEffectDefinitions.length > 0) {
    const nextEffects = Object.fromEntries(
      Object.entries(DEFAULT_PASSIVE_TALENT_EFFECTS).map(([effectId, definition]) => [effectId, { ...definition }]),
    ) as Record<string, PassiveTalentEffectDefinition>

    for (const override of overrides.passiveTalentEffectDefinitions) {
      const base = nextEffects[override.talentEffectId] ?? {
        talentEffectId: override.talentEffectId,
        talentId: override.talentId ?? '',
        effectIndex: override.effectIndex ?? 1,
        talentLogicId: override.talentLogicId ?? '',
        targetScope: override.targetScope ?? 'player',
        enabled: true,
      }

      nextEffects[override.talentEffectId] = {
        ...base,
        ...(override.talentId ? { talentId: override.talentId } : {}),
        ...(typeof override.effectIndex === 'number' ? { effectIndex: override.effectIndex } : {}),
        ...(override.talentLogicId ? { talentLogicId: override.talentLogicId } : {}),
        ...(override.targetScope ? { targetScope: override.targetScope } : {}),
        ...(typeof override.valueA === 'number' ? { valueA: override.valueA } : {}),
        ...(typeof override.valueB === 'number' ? { valueB: override.valueB } : {}),
        ...(override.statusId ? { statusId: override.statusId } : {}),
        ...(override.skillId ? { skillId: override.skillId } : {}),
        ...(override.notes ? { notes: override.notes } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }

    passiveTalentEffectDefinitionsById = nextEffects
  }

  if (overrides.passiveStatusDefinitions.length > 0) {
    const nextStatuses = cloneStatuses(DEFAULT_PASSIVE_STATUS_DEFINITIONS)
    for (const override of overrides.passiveStatusDefinitions) {
      const base = nextStatuses[override.statusId] ?? {
        statusId: override.statusId,
        statusName: override.statusId,
        statusCategory: 'playerBuff' as const,
        iconId: override.statusId,
        durationMs: 0,
        maxStacks: 1,
        dispellable: false,
        description: '',
        effectLogicId: 'none',
        enabled: true,
      }

      nextStatuses[override.statusId] = {
        ...base,
        ...(override.statusName ? { statusName: override.statusName } : {}),
        ...(override.statusCategory ? { statusCategory: override.statusCategory } : {}),
        ...(override.iconId ? { iconId: override.iconId } : {}),
        ...(typeof override.durationMs === 'number' ? { durationMs: override.durationMs } : {}),
        ...(typeof override.maxStacks === 'number' ? { maxStacks: override.maxStacks } : {}),
        ...(typeof override.dispellable === 'boolean' ? { dispellable: override.dispellable } : {}),
        ...(override.description ? { description: override.description } : {}),
        ...(override.effectLogicId ? { effectLogicId: override.effectLogicId } : {}),
        ...(typeof override.enabled === 'boolean' ? { enabled: override.enabled } : {}),
      }
    }
    passiveStatusesById = nextStatuses
  }

  if (overrides.defaultActiveBuilds.length > 0) {
    defaultActiveBuilds = overrides.defaultActiveBuilds.map(cloneActivePreset)
  }

  if (overrides.defaultPassiveBuilds.length > 0) {
    defaultPassiveBuilds = overrides.defaultPassiveBuilds.map(clonePassivePreset)
  }

  if (overrides.iconDefinitions.length > 0) {
    iconDefinitions = overrides.iconDefinitions.map((entry) => ({ ...entry }))
  }
}
