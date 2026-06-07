import type {
  BuildIconDefinition,
  DangerLevel,
  EnemyCastBreakRule,
  EnemySkillDamageType,
  StatusKind,
} from '../encounter/encounterTypes'

export type EnemySkillTargetRuleId = 'threatTarget' | 'tankAndParty' | 'party' | 'otherEnemy' | 'self' | 'mostInjured'
export type EnemyThreatLogic = 'normal' | 'irregular' | 'bloodlust'

type RuntimeStatusKind = Exclude<StatusKind, 'neutral'>

export interface EnemyDefinition {
  enemyId: string
  name: string
  baseMaxHp: number
  skillIds: string[]
  skillNames: string[]
  skillCycle: string[]
  threatLogic: EnemyThreatLogic
  counteredDurationMs: number
  isSkull: boolean
}

export interface EnemySkillDefinition {
  skillId: string
  skillName: string
  targetRuleId: EnemySkillTargetRuleId
  castTimeMs: number
  channelingMs: number
  recoveryMs: number
  damageType: EnemySkillDamageType
  playerDamage: number
  partyDamageOnHit: number
  partyDamageOnMiss: number
  pressureOnHit: number
  pressureOnMiss: number
  appliedTargetStatusIds: string[]
  appliedSelfStatusIds: string[]
  castBreakRule: EnemyCastBreakRule
  dangerLevel: DangerLevel
}

export interface EnemyStatusDefinition {
  statusId: string
  statusName: string
  iconId: string
  durationMs: number
  isDispellable: boolean
  description: string
  effectLogicId: string
  valueA?: number
  valueB?: number
  tickIntervalMs?: number
  kind: RuntimeStatusKind
}

export interface EnemyDefinitionWorkbookOverride {
  enemyId: string
  name?: string
  baseMaxHp?: number
  skillIds?: string[]
  skillNames?: string[]
  skillCycle?: string[]
  threatLogic?: EnemyThreatLogic
  counteredDurationMs?: number
  isSkull?: boolean
}

export interface EnemySkillWorkbookOverride {
  skillId: string
  skillName?: string
  targetRuleId?: EnemySkillTargetRuleId
  castTimeMs?: number
  channelingMs?: number
  recoveryMs?: number
  damageType?: EnemySkillDamageType
  playerDamage?: number
  partyDamageOnHit?: number
  partyDamageOnMiss?: number
  pressureOnHit?: number
  pressureOnMiss?: number
  appliedTargetStatusIds?: string[]
  appliedSelfStatusIds?: string[]
  castBreakRule?: EnemyCastBreakRule
  dangerLevel?: DangerLevel
}

export interface EnemyStatusWorkbookOverride {
  statusId: string
  statusName?: string
  iconId?: string
  durationMs?: number
  isDispellable?: boolean
  description?: string
  effectLogicId?: string
  valueA?: number
  valueB?: number
  tickIntervalMs?: number
}

export interface EnemyWorkbookOverrides {
  enemyDefinitions: EnemyDefinitionWorkbookOverride[]
  skillDefinitions: EnemySkillWorkbookOverride[]
  enemyBuffDefinitions: EnemyStatusWorkbookOverride[]
  playerDebuffDefinitions: EnemyStatusWorkbookOverride[]
  partyDebuffDefinitions: EnemyStatusWorkbookOverride[]
  iconDefinitions?: BuildIconDefinition[]
}

function createEnemyDefinition(definition: EnemyDefinition): EnemyDefinition {
  return {
    ...definition,
    skillIds: [...definition.skillIds],
    skillNames: [...definition.skillNames],
    skillCycle: [...definition.skillCycle],
  }
}

function createSkillDefinition(definition: EnemySkillDefinition): EnemySkillDefinition {
  return {
    ...definition,
    appliedTargetStatusIds: [...definition.appliedTargetStatusIds],
    appliedSelfStatusIds: [...definition.appliedSelfStatusIds],
  }
}

function createStatusDefinition(definition: EnemyStatusDefinition): EnemyStatusDefinition {
  return { ...definition }
}

const DEFAULT_ENEMY_DEFINITIONS: EnemyDefinition[] = [
  {
    enemyId: 'harbor_raider',
    name: '娼咕鎵撴墜',
    baseMaxHp: 118,
    skillIds: ['bone-jab', 'reckless-rush'],
    skillNames: ['鐧介鍒哄嚮', '鑾芥挒鍐叉挒'],
    skillCycle: ['bone-jab', 'reckless-rush', 'bone-jab'],
    threatLogic: 'normal',
    counteredDurationMs: 1200,
    isSkull: false,
  },
  {
    enemyId: 'harbor_pyromancer',
    name: '浣欑儸鍜忔疆鑰?',
    baseMaxHp: 96,
    skillIds: ['flame-lance', 'ember-bolt', 'dark-mend', 'staff-smash', 'ember-rush'],
    skillNames: ['鐑堢劙鏋?', '浣欑儸绠?', '鏆楀奖鎰堝悎', '娉曟潠閲嶅嚮', '浣欑儸绐佽'],
    skillCycle: ['flame-lance', 'ember-bolt', 'dark-mend', 'staff-smash', 'ember-rush'],
    threatLogic: 'normal',
    counteredDurationMs: 1400,
    isSkull: false,
  },
  {
    enemyId: 'harbor_stalker',
    name: '闆惧垉娼滅寧鑰?',
    baseMaxHp: 104,
    skillIds: ['feint-slash', 'backstab'],
    skillNames: ['浣敾鏂?', '鑳屽埡'],
    skillCycle: ['feint-slash', 'backstab'],
    threatLogic: 'irregular',
    counteredDurationMs: 1000,
    isSkull: false,
  },
  {
    enemyId: 'harbor_breaker',
    name: '閾侀敋鐮撮樀鍏?',
    baseMaxHp: 156,
    skillIds: ['guard-breaker', 'rampage'],
    skillNames: ['鐮撮槻鐚涘嚮', '鐙傛毚璺佃笍'],
    skillCycle: ['guard-breaker', 'rampage'],
    threatLogic: 'normal',
    counteredDurationMs: 1600,
    isSkull: false,
  },
  {
    enemyId: 'harbor_commander',
    name: '娼咕鐫ｅ啗',
    baseMaxHp: 408,
    skillIds: ['crusher-slam', 'ruin-volley'],
    skillNames: ['绮夌閲嶅嚮', '姣佺伃榻愬皠'],
    skillCycle: ['crusher-slam', 'ruin-volley', 'crusher-slam'],
    threatLogic: 'bloodlust',
    counteredDurationMs: 1800,
    isSkull: true,
  },
  {
    enemyId: 'midland_raider',
    name: '鐏版ˉ鎴樺崚',
    baseMaxHp: 118,
    skillIds: ['bone-jab', 'reckless-rush'],
    skillNames: ['鐧介鍒哄嚮', '鑾芥挒鍐叉挒'],
    skillCycle: ['bone-jab', 'reckless-rush', 'bone-jab'],
    threatLogic: 'normal',
    counteredDurationMs: 1200,
    isSkull: false,
  },
  {
    enemyId: 'midland_pyromancer',
    name: '鐒扮棔鏈＋',
    baseMaxHp: 96,
    skillIds: ['flame-lance', 'ember-bolt', 'dark-mend', 'staff-smash', 'ember-rush'],
    skillNames: ['鐑堢劙鏋?', '浣欑儸绠?', '鏆楀奖鎰堝悎', '娉曟潠閲嶅嚮', '浣欑儸绐佽'],
    skillCycle: ['flame-lance', 'ember-bolt', 'dark-mend', 'staff-smash', 'ember-rush'],
    threatLogic: 'normal',
    counteredDurationMs: 1400,
    isSkull: false,
  },
  {
    enemyId: 'midland_stalker',
    name: '瑁傛棩浼忓叺',
    baseMaxHp: 104,
    skillIds: ['feint-slash', 'backstab'],
    skillNames: ['浣敾鏂?', '鑳屽埡'],
    skillCycle: ['feint-slash', 'backstab'],
    threatLogic: 'irregular',
    counteredDurationMs: 1000,
    isSkull: false,
  },
  {
    enemyId: 'midland_breaker',
    name: '鎶ら樀閲嶅崼',
    baseMaxHp: 156,
    skillIds: ['guard-breaker', 'rampage'],
    skillNames: ['鐮撮槻鐚涘嚮', '鐙傛毚璺佃笍'],
    skillCycle: ['guard-breaker', 'rampage'],
    threatLogic: 'normal',
    counteredDurationMs: 1600,
    isSkull: false,
  },
  {
    enemyId: 'midland_commander',
    name: '涓涵鐩戝啗',
    baseMaxHp: 408,
    skillIds: ['crusher-slam', 'ruin-volley'],
    skillNames: ['绮夌閲嶅嚮', '姣佺伃榻愬皠'],
    skillCycle: ['crusher-slam', 'ruin-volley', 'crusher-slam'],
    threatLogic: 'bloodlust',
    counteredDurationMs: 1800,
    isSkull: true,
  },
  {
    enemyId: 'highland_raider',
    name: '闆峰礀鎴樺叺',
    baseMaxHp: 118,
    skillIds: ['bone-jab', 'reckless-rush'],
    skillNames: ['鐧介鍒哄嚮', '鑾芥挒鍐叉挒'],
    skillCycle: ['bone-jab', 'reckless-rush', 'bone-jab'],
    threatLogic: 'normal',
    counteredDurationMs: 1200,
    isSkull: false,
  },
  {
    enemyId: 'highland_pyromancer',
    name: '鎴樻瓕鍏堢煡',
    baseMaxHp: 96,
    skillIds: ['flame-lance', 'ember-bolt', 'dark-mend', 'staff-smash', 'ember-rush'],
    skillNames: ['鐑堢劙鏋?', '浣欑儸绠?', '鏆楀奖鎰堝悎', '娉曟潠閲嶅嚮', '浣欑儸绐佽'],
    skillCycle: ['flame-lance', 'ember-bolt', 'dark-mend', 'staff-smash', 'ember-rush'],
    threatLogic: 'normal',
    counteredDurationMs: 1400,
    isSkull: false,
  },
  {
    enemyId: 'highland_stalker',
    name: '宀氬垉杩界寧鑰?',
    baseMaxHp: 104,
    skillIds: ['feint-slash', 'backstab'],
    skillNames: ['浣敾鏂?', '鑳屽埡'],
    skillCycle: ['feint-slash', 'backstab'],
    threatLogic: 'irregular',
    counteredDurationMs: 1000,
    isSkull: false,
  },
  {
    enemyId: 'highland_breaker',
    name: '瑁傜敳鎵у崼',
    baseMaxHp: 156,
    skillIds: ['guard-breaker', 'rampage'],
    skillNames: ['鐮撮槻鐚涘嚮', '鐙傛毚璺佃笍'],
    skillCycle: ['guard-breaker', 'rampage'],
    threatLogic: 'normal',
    counteredDurationMs: 1600,
    isSkull: false,
  },
  {
    enemyId: 'highland_commander',
    name: '鐜嬪骇缁熷敖鑰?',
    baseMaxHp: 408,
    skillIds: ['crusher-slam', 'ruin-volley'],
    skillNames: ['绮夌閲嶅嚮', '姣佺伃榻愬皠'],
    skillCycle: ['crusher-slam', 'ruin-volley', 'crusher-slam'],
    threatLogic: 'bloodlust',
    counteredDurationMs: 1800,
    isSkull: true,
  },
]

const DEFAULT_ENEMY_SKILL_DEFINITIONS: EnemySkillDefinition[] = [
  {
    skillId: 'bone-jab',
    skillName: '鐧介鍒哄嚮',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_350,
    channelingMs: 0,
    recoveryMs: 700,
    damageType: 'physical',
    playerDamage: 18,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 0,
    pressureOnHit: 0,
    pressureOnMiss: 6,
    appliedTargetStatusIds: [],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'low',
  },
  {
    skillId: 'reckless-rush',
    skillName: '鑾芥挒鍐叉挒',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_150,
    channelingMs: 0,
    recoveryMs: 850,
    damageType: 'physical',
    playerDamage: 20,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 34,
    pressureOnHit: 2,
    pressureOnMiss: 16,
    appliedTargetStatusIds: ['formation-break'],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'medium',
  },
  {
    skillId: 'flame-lance',
    skillName: '鐑堢劙鏋?',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_900,
    channelingMs: 0,
    recoveryMs: 900,
    damageType: 'magic',
    playerDamage: 32,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 18,
    pressureOnHit: 4,
    pressureOnMiss: 14,
    appliedTargetStatusIds: [],
    appliedSelfStatusIds: [],
    castBreakRule: 'interruptOrControl',
    dangerLevel: 'medium',
  },
  {
    skillId: 'ember-bolt',
    skillName: '浣欑儸绠?',
    targetRuleId: 'party',
    castTimeMs: 1_800,
    channelingMs: 0,
    recoveryMs: 950,
    damageType: 'magic',
    playerDamage: 0,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 52,
    pressureOnHit: 0,
    pressureOnMiss: 16,
    appliedTargetStatusIds: ['suppression'],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'high',
  },
  {
    skillId: 'dark-mend',
    skillName: '鏆楀奖鎰堝悎',
    targetRuleId: 'otherEnemy',
    castTimeMs: 2_100,
    channelingMs: 0,
    recoveryMs: 1_200,
    damageType: 'magic',
    playerDamage: 0,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 0,
    pressureOnHit: 0,
    pressureOnMiss: 0,
    appliedTargetStatusIds: ['fortified'],
    appliedSelfStatusIds: [],
    castBreakRule: 'interruptOrControl',
    dangerLevel: 'medium',
  },
  {
    skillId: 'staff-smash',
    skillName: '娉曟潠閲嶅嚮',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_250,
    channelingMs: 0,
    recoveryMs: 700,
    damageType: 'physical',
    playerDamage: 22,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 0,
    pressureOnHit: 0,
    pressureOnMiss: 7,
    appliedTargetStatusIds: [],
    appliedSelfStatusIds: [],
    castBreakRule: 'unstoppable',
    dangerLevel: 'low',
  },
  {
    skillId: 'ember-rush',
    skillName: '浣欑儸绐佽',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_200,
    channelingMs: 0,
    recoveryMs: 800,
    damageType: 'magic',
    playerDamage: 24,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 40,
    pressureOnHit: 2,
    pressureOnMiss: 14,
    appliedTargetStatusIds: ['suppression'],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'medium',
  },
  {
    skillId: 'feint-slash',
    skillName: '浣敾鏂?',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_000,
    channelingMs: 0,
    recoveryMs: 650,
    damageType: 'physical',
    playerDamage: 30,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 14,
    pressureOnHit: 3,
    pressureOnMiss: 10,
    appliedTargetStatusIds: [],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'medium',
  },
  {
    skillId: 'backstab',
    skillName: '鑳屽埡',
    targetRuleId: 'threatTarget',
    castTimeMs: 950,
    channelingMs: 0,
    recoveryMs: 700,
    damageType: 'physical',
    playerDamage: 36,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 60,
    pressureOnHit: 4,
    pressureOnMiss: 20,
    appliedTargetStatusIds: ['formation-break'],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'high',
  },
  {
    skillId: 'guard-breaker',
    skillName: '鐮撮槻鐚涘嚮',
    targetRuleId: 'threatTarget',
    castTimeMs: 2_250,
    channelingMs: 0,
    recoveryMs: 1_100,
    damageType: 'physical',
    playerDamage: 54,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 20,
    pressureOnHit: 5,
    pressureOnMiss: 14,
    appliedTargetStatusIds: ['sundered'],
    appliedSelfStatusIds: [],
    castBreakRule: 'interruptOrControl',
    dangerLevel: 'medium',
  },
  {
    skillId: 'rampage',
    skillName: '鐙傛毚璺佃笍',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_450,
    channelingMs: 0,
    recoveryMs: 1_050,
    damageType: 'physical',
    playerDamage: 48,
    partyDamageOnHit: 18,
    partyDamageOnMiss: 72,
    pressureOnHit: 8,
    pressureOnMiss: 22,
    appliedTargetStatusIds: ['chaos-volley'],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'high',
  },
  {
    skillId: 'crusher-slam',
    skillName: '绮夌閲嶅嚮',
    targetRuleId: 'threatTarget',
    castTimeMs: 1_900,
    channelingMs: 0,
    recoveryMs: 950,
    damageType: 'physical',
    playerDamage: 88,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 26,
    pressureOnHit: 6,
    pressureOnMiss: 18,
    appliedTargetStatusIds: [],
    appliedSelfStatusIds: [],
    castBreakRule: 'unstoppable',
    dangerLevel: 'high',
  },
  {
    skillId: 'ruin-volley',
    skillName: '姣佺伃榻愬皠',
    targetRuleId: 'party',
    castTimeMs: 1_700,
    channelingMs: 0,
    recoveryMs: 1_050,
    damageType: 'magic',
    playerDamage: 0,
    partyDamageOnHit: 0,
    partyDamageOnMiss: 84,
    pressureOnHit: 0,
    pressureOnMiss: 24,
    appliedTargetStatusIds: ['chaos-volley'],
    appliedSelfStatusIds: [],
    castBreakRule: 'controlOnly',
    dangerLevel: 'high',
  },
]

const DEFAULT_ENEMY_BUFF_DEFINITIONS: EnemyStatusDefinition[] = [
  {
    statusId: 'ember-aegis',
    iconId: 'ember-aegis',
    statusName: '浣欑儸鎶ゅ箷',
    durationMs: 3_800,
    isDispellable: true,
    description: '鏁屼汉缁欒嚜韬淮鎸佺殑鎶ゅ箷鏁堟灉锛岀敤浜庡埗閫犳寔缁帇杩劅銆?',
    effectLogicId: 'none',
    kind: 'enemyBuff',
  },
  {
    statusId: 'haste',
    iconId: 'haste',
    statusName: '鎬ラ€?',
    durationMs: 4_400,
    isDispellable: true,
    description: '鍔犲揩璇绘潯涓庤疆杞紝鐢ㄤ簬琛ㄧ幇鏇撮珮棰戠巼鐨勬柦鍘嬨€?',
    effectLogicId: 'none',
    kind: 'enemyBuff',
  },
  {
    statusId: 'evasion',
    iconId: 'evasion',
    statusName: '闂伩',
    durationMs: 3_900,
    isDispellable: true,
    description: '鏁屼汉杩涘叆杞诲阀鍛ㄦ棆濮挎€侊紝璇绘潯鑺傚鏇村垇閽汇€?',
    effectLogicId: 'none',
    kind: 'enemyBuff',
  },
  {
    statusId: 'guarded',
    iconId: 'guarded',
    statusName: '瀹堝',
    durationMs: 4_800,
    isDispellable: true,
    description: '绋充綇闃电嚎骞舵寔缁粰鍓嶆帓鏂藉帇銆?',
    effectLogicId: 'none',
    kind: 'enemyBuff',
  },
  {
    statusId: 'fortified',
    iconId: 'fortified',
    statusName: '寮哄寲',
    durationMs: 4_000,
    isDispellable: true,
    description: '鑾峰緱寮哄寲骞剁珛鍒诲洖澶嶅皯閲忕敓鍛藉€笺€?',
    effectLogicId: 'enemy_heal_small',
    kind: 'enemyBuff',
  },
  {
    statusId: 'enraged',
    iconId: 'enraged',
    statusName: '鐙傛€?',
    durationMs: 5_200,
    isDispellable: false,
    description: '棣栭杩涘叆鐙傛€掕妭濂忥紝鍚庣画楂樺帇鎶€鑳戒細琛旀帴鏇寸揣銆?',
    effectLogicId: 'none',
    kind: 'enemyBuff',
  },
  {
    statusId: 'enrage-song',
    iconId: 'enrage-song',
    statusName: '鎴樻瓕',
    durationMs: 5_400,
    isDispellable: true,
    description: '楂樺湴鎴樻瓕榧撹垶鍏ㄥ満锛屾樉钁楀己鍖栨晫鏂规敾鍔胯〃鐜般€?',
    effectLogicId: 'none',
    kind: 'enemyBuff',
  },
  {
    statusId: 'countered',
    iconId: 'silenced',
    statusName: '被反制',
    durationMs: 1_400,
    isDispellable: false,
    description: '鏂芥硶琚垚鍔熸墦鏂悗闄峰叆鐭殏鍍电洿锛岀粨鏉熷悗鎵嶄細缁х画鎶€鑳藉惊鐜€?',
    effectLogicId: 'none',
    kind: 'enemyBuff',
  },
]

const DEFAULT_PLAYER_DEBUFF_DEFINITIONS: EnemyStatusDefinition[] = [
  {
    statusId: 'sundered',
    iconId: 'sundered',
    statusName: '鐮寸敳',
    durationMs: 4_000,
    isDispellable: true,
    description: '鐜╁鎶ょ敳琚挄寮€锛岃繛缁壙浼や細鍙樺緱鏇村嵄闄┿€?',
    effectLogicId: 'none',
    kind: 'playerDebuff',
  },
  {
    statusId: 'weakened',
    iconId: 'weakened',
    statusName: '铏氬急',
    durationMs: 4_200,
    isDispellable: true,
    description: '鐜╁闄峰叆铏氬急绐楀彛锛屽悗缁壙鍘嬫洿闅惧鐞嗐€?',
    effectLogicId: 'none',
    kind: 'playerDebuff',
  },
  {
    statusId: 'stunned',
    iconId: 'stunned',
    statusName: '鏄忚糠',
    durationMs: 2_000,
    isDispellable: true,
    description: '鐜╁鐭殏澶卞幓鎿嶄綔鑳藉姏銆?',
    effectLogicId: 'none',
    kind: 'playerDebuff',
  },
  {
    statusId: 'silenced',
    iconId: 'silenced',
    statusName: '娌夐粯',
    durationMs: 2_000,
    isDispellable: true,
    description: '鐩爣鐭椂闂存棤娉曟甯告墽琛屽畬鏁存妧鑳借妭濂忋€?',
    effectLogicId: 'none',
    kind: 'playerDebuff',
  },
  {
    statusId: 'oldGrudged',
    iconId: 'oldGrudged',
    statusName: 'oldGrudged',
    durationMs: 0,
    isDispellable: false,
    description: 'Player starts at 50% max HP and 50 rage.',
    effectLogicId: 'oldGrudged_status',
    kind: 'playerDebuff',
  },
  {
    statusId: 'battleHunger',
    iconId: 'battleHunger',
    statusName: 'battleHunger',
    durationMs: -1,
    isDispellable: false,
    description: 'Player takes physical damage over time until an enemy dies.',
    effectLogicId: 'battleHunger_status',
    kind: 'playerDebuff',
  },
  {
    statusId: 'incorrigibled',
    iconId: 'incorrigibled',
    statusName: 'incorrigibled',
    durationMs: -1,
    isDispellable: false,
    description: 'Player cannot use interrupt or control skills.',
    effectLogicId: 'incorrigibled_status',
    kind: 'playerDebuff',
  },
]

const DEFAULT_PARTY_DEBUFF_DEFINITIONS: EnemyStatusDefinition[] = [
  {
    statusId: 'suppression',
    iconId: 'suppression',
    statusName: '鐏肩儳鍘嬪埗',
    durationMs: 4_200,
    isDispellable: false,
    description: '鏁屾柟杩滅▼鐏姏鍘嬪悜闃熶紞锛屽洟闃熷帇鍔涙樉钁椾笂鍗囥€?',
    effectLogicId: 'none',
    kind: 'partyDebuff',
  },
  {
    statusId: 'formation-break',
    iconId: 'formation-break',
    statusName: '闃靛瀷鍐叉暎',
    durationMs: 3_600,
    isDispellable: false,
    description: '闃熶紞闃靛瀷琚啿鏁ｏ紝鍚庢帓鏇村鏄撹繛缁悆鍒版妧鑳姐€?',
    effectLogicId: 'none',
    kind: 'partyDebuff',
  },
  {
    statusId: 'chaos-volley',
    iconId: 'chaos-volley',
    statusName: '闇囪崱涔辨祦',
    durationMs: 5_000,
    isDispellable: false,
    description: '楂樺帇璺佃笍鎴栭綈灏勪箣鍚庡父瑙佺殑鍥㈤槦鍑忕泭銆?',
    effectLogicId: 'none',
    kind: 'partyDebuff',
  },
  {
    statusId: 'disliked',
    iconId: 'disliked',
    statusName: 'disliked',
    durationMs: -1,
    isDispellable: false,
    description: 'The first three party attacks generate triple threat.',
    effectLogicId: 'disliked_status',
    kind: 'partyDebuff',
  },
  {
    statusId: 'sensitive',
    iconId: 'sensitive',
    statusName: 'sensitive',
    durationMs: -1,
    isDispellable: false,
    description: 'Enemy party hits add pressure.',
    effectLogicId: 'sensitive_status',
    kind: 'partyDebuff',
  },
  {
    statusId: 'sensitive?',
    iconId: 'sensitive?',
    statusName: 'sensitive?',
    durationMs: -1,
    isDispellable: false,
    description: 'Enemy party hits add minor pressure.',
    effectLogicId: 'sensitive?_status',
    kind: 'partyDebuff',
  },
  {
    statusId: 'asHisWish',
    iconId: 'asHisWish',
    statusName: 'asHisWish',
    durationMs: -1,
    isDispellable: false,
    description: 'Party periodically retargets based on player threat.',
    effectLogicId: 'asHisWish_status',
    kind: 'partyDebuff',
  },
]

function toDefinitionRecord<T, K extends keyof T>(
  entries: T[],
  key: K,
  clone: (entry: T) => T,
) {
  const record: Record<string, T> = {}

  for (const entry of entries) {
    record[String(entry[key])] = clone(entry)
  }

  return record
}

const BASE_ENEMY_DEFINITIONS = toDefinitionRecord(DEFAULT_ENEMY_DEFINITIONS, 'enemyId', createEnemyDefinition)
const BASE_ENEMY_SKILL_DEFINITIONS = toDefinitionRecord(
  DEFAULT_ENEMY_SKILL_DEFINITIONS,
  'skillId',
  createSkillDefinition,
)
const BASE_ENEMY_BUFF_DEFINITIONS = toDefinitionRecord(
  DEFAULT_ENEMY_BUFF_DEFINITIONS,
  'statusId',
  createStatusDefinition,
)
const BASE_PLAYER_DEBUFF_DEFINITIONS = toDefinitionRecord(
  DEFAULT_PLAYER_DEBUFF_DEFINITIONS,
  'statusId',
  createStatusDefinition,
)
const BASE_PARTY_DEBUFF_DEFINITIONS = toDefinitionRecord(
  DEFAULT_PARTY_DEBUFF_DEFINITIONS,
  'statusId',
  createStatusDefinition,
)

const DEFAULT_ENEMY_ICON_DEFINITIONS: BuildIconDefinition[] = [
  { iconId: 'stable', iconName: '绋冲畾', assetKey: 'stable', iconType: 'status', enabled: true },
  { iconId: 'enraged', iconName: '鐙傛€?', assetKey: 'enraged', iconType: 'status', enabled: true },
  { iconId: 'fortified', iconName: '寮哄寲', assetKey: 'fortified', iconType: 'status', enabled: true },
  { iconId: 'weakened', iconName: '铏氬急', assetKey: 'weakened', iconType: 'status', enabled: true },
  { iconId: 'lurking', iconName: '娼滀紡', assetKey: 'lurking', iconType: 'status', enabled: true },
  { iconId: 'stunned', iconName: '鏄忚糠', assetKey: 'stunned', iconType: 'status', enabled: true },
  { iconId: 'taunted', iconName: '琚槻璁?', assetKey: 'taunted', iconType: 'status', enabled: true },
  { iconId: 'mass-taunt', iconName: '缇や綋鍢茶', assetKey: 'mass-taunt', iconType: 'status', enabled: true },
  { iconId: 'haste', iconName: '鎬ラ€?', assetKey: 'haste', iconType: 'status', enabled: true },
  { iconId: 'sundered', iconName: '鐮寸敳', assetKey: 'sundered', iconType: 'status', enabled: true },
  { iconId: 'evasion', iconName: '闂伩', assetKey: 'evasion', iconType: 'status', enabled: true },
  { iconId: 'silenced', iconName: '娌夐粯', assetKey: 'silenced', iconType: 'status', enabled: true },
  { iconId: 'guarded', iconName: '瀹堝', assetKey: 'guarded', iconType: 'status', enabled: true },
  { iconId: 'enrage-song', iconName: '鎴樻瓕', assetKey: 'enrage-song', iconType: 'status', enabled: true },
  { iconId: 'snared', iconName: '璇辨崟', assetKey: 'snared', iconType: 'status', enabled: true },
  { iconId: 'shieldWall', iconName: '鐩惧', assetKey: 'shield-wall', iconType: 'status', enabled: true },
  { iconId: 'vanguard-oath', iconName: '鍏堥攱瑾撶害', assetKey: 'vanguard-oath', iconType: 'status', enabled: true },
  { iconId: 'ember-aegis', iconName: '浣欑儸鎶ゅ箷', assetKey: 'ember-aegis', iconType: 'status', enabled: true },
  { iconId: 'heat-haze', iconName: '鐑氮渚佃', assetKey: 'heat-haze', iconType: 'status', enabled: true },
  { iconId: 'battle-seal', iconName: '鎴樻枟鍗拌', assetKey: 'battle-seal', iconType: 'status', enabled: true },
  { iconId: 'suppression', iconName: '鐏肩儳鍘嬪埗', assetKey: 'heat-haze', iconType: 'status', enabled: true },
  { iconId: 'formation-break', iconName: '闃靛瀷鍐叉暎', assetKey: 'sundered', iconType: 'status', enabled: true },
  { iconId: 'chaos-volley', iconName: '闇囪崱涔辨祦', assetKey: 'enrage-song', iconType: 'status', enabled: true },
]

export let ENEMY_DEFINITIONS = Object.fromEntries(
  Object.entries(BASE_ENEMY_DEFINITIONS).map(([enemyId, definition]) => [
    enemyId,
    createEnemyDefinition(definition),
  ]),
) as Record<string, EnemyDefinition>

export let ENEMY_SKILL_DEFINITIONS = Object.fromEntries(
  Object.entries(BASE_ENEMY_SKILL_DEFINITIONS).map(([skillId, definition]) => [
    skillId,
    createSkillDefinition(definition),
  ]),
) as Record<string, EnemySkillDefinition>

export let ENEMY_BUFF_DEFINITIONS = Object.fromEntries(
  Object.entries(BASE_ENEMY_BUFF_DEFINITIONS).map(([statusId, definition]) => [
    statusId,
    createStatusDefinition(definition),
  ]),
) as Record<string, EnemyStatusDefinition>

export let PLAYER_DEBUFF_DEFINITIONS = Object.fromEntries(
  Object.entries(BASE_PLAYER_DEBUFF_DEFINITIONS).map(([statusId, definition]) => [
    statusId,
    createStatusDefinition(definition),
  ]),
) as Record<string, EnemyStatusDefinition>

export let PARTY_DEBUFF_DEFINITIONS = Object.fromEntries(
  Object.entries(BASE_PARTY_DEBUFF_DEFINITIONS).map(([statusId, definition]) => [
    statusId,
    createStatusDefinition(definition),
  ]),
) as Record<string, EnemyStatusDefinition>

export let ENEMY_ICON_DEFINITIONS = DEFAULT_ENEMY_ICON_DEFINITIONS.map((entry) => ({ ...entry }))

function resetEnemyCatalog() {
  ENEMY_DEFINITIONS = Object.fromEntries(
    Object.entries(BASE_ENEMY_DEFINITIONS).map(([enemyId, definition]) => [
      enemyId,
      createEnemyDefinition(definition),
    ]),
  ) as Record<string, EnemyDefinition>

  ENEMY_SKILL_DEFINITIONS = Object.fromEntries(
    Object.entries(BASE_ENEMY_SKILL_DEFINITIONS).map(([skillId, definition]) => [
      skillId,
      createSkillDefinition(definition),
    ]),
  ) as Record<string, EnemySkillDefinition>

  ENEMY_BUFF_DEFINITIONS = Object.fromEntries(
    Object.entries(BASE_ENEMY_BUFF_DEFINITIONS).map(([statusId, definition]) => [
      statusId,
      createStatusDefinition(definition),
    ]),
  ) as Record<string, EnemyStatusDefinition>

  PLAYER_DEBUFF_DEFINITIONS = Object.fromEntries(
    Object.entries(BASE_PLAYER_DEBUFF_DEFINITIONS).map(([statusId, definition]) => [
      statusId,
      createStatusDefinition(definition),
    ]),
  ) as Record<string, EnemyStatusDefinition>

  PARTY_DEBUFF_DEFINITIONS = Object.fromEntries(
    Object.entries(BASE_PARTY_DEBUFF_DEFINITIONS).map(([statusId, definition]) => [
      statusId,
      createStatusDefinition(definition),
    ]),
  ) as Record<string, EnemyStatusDefinition>

  ENEMY_ICON_DEFINITIONS = DEFAULT_ENEMY_ICON_DEFINITIONS.map((entry) => ({ ...entry }))
}

function applyStatusOverrides(
  target: Record<string, EnemyStatusDefinition>,
  overrides: EnemyStatusWorkbookOverride[],
  kind: RuntimeStatusKind,
) {
  for (const override of overrides) {
    const current = target[override.statusId]

    target[override.statusId] = {
      statusId: override.statusId,
      statusName: override.statusName ?? current?.statusName ?? override.statusId,
      iconId: override.iconId ?? current?.iconId ?? '',
      durationMs: override.durationMs ?? current?.durationMs ?? 0,
      isDispellable: override.isDispellable ?? current?.isDispellable ?? false,
      description: override.description ?? current?.description ?? '',
      effectLogicId: override.effectLogicId ?? current?.effectLogicId ?? 'none',
      ...(typeof override.valueA === 'number'
        ? { valueA: override.valueA }
        : typeof current?.valueA === 'number'
          ? { valueA: current.valueA }
          : {}),
      ...(typeof override.valueB === 'number'
        ? { valueB: override.valueB }
        : typeof current?.valueB === 'number'
          ? { valueB: current.valueB }
          : {}),
      ...(typeof override.tickIntervalMs === 'number'
        ? { tickIntervalMs: override.tickIntervalMs }
        : typeof current?.tickIntervalMs === 'number'
          ? { tickIntervalMs: current.tickIntervalMs }
          : {}),
      kind: current?.kind ?? kind,
    }
  }
}

export function applyEnemyWorkbookOverrides(overrides: EnemyWorkbookOverrides) {
  resetEnemyCatalog()

  for (const override of overrides.enemyDefinitions) {
    const current = ENEMY_DEFINITIONS[override.enemyId]

    ENEMY_DEFINITIONS[override.enemyId] = {
      enemyId: override.enemyId,
      name: override.name ?? current?.name ?? override.enemyId,
      baseMaxHp: override.baseMaxHp ?? current?.baseMaxHp ?? 1,
      skillIds: override.skillIds?.length ? [...override.skillIds] : [...(current?.skillIds ?? [])],
      skillNames: override.skillNames?.length ? [...override.skillNames] : [...(current?.skillNames ?? [])],
      skillCycle: override.skillCycle?.length ? [...override.skillCycle] : [...(current?.skillCycle ?? [])],
      threatLogic: override.threatLogic ?? current?.threatLogic ?? 'normal',
      counteredDurationMs: override.counteredDurationMs ?? current?.counteredDurationMs ?? 0,
      isSkull: override.isSkull ?? current?.isSkull ?? false,
    }
  }

  for (const override of overrides.skillDefinitions) {
    const current = ENEMY_SKILL_DEFINITIONS[override.skillId]

    ENEMY_SKILL_DEFINITIONS[override.skillId] = {
      skillId: override.skillId,
      skillName: override.skillName ?? current?.skillName ?? override.skillId,
      targetRuleId: override.targetRuleId ?? current?.targetRuleId ?? 'threatTarget',
      castTimeMs: override.castTimeMs ?? current?.castTimeMs ?? 0,
      channelingMs: override.channelingMs ?? current?.channelingMs ?? 0,
      recoveryMs: override.recoveryMs ?? current?.recoveryMs ?? 0,
      damageType: override.damageType ?? current?.damageType ?? 'physical',
      playerDamage: override.playerDamage ?? current?.playerDamage ?? 0,
      partyDamageOnHit: override.partyDamageOnHit ?? current?.partyDamageOnHit ?? 0,
      partyDamageOnMiss: override.partyDamageOnMiss ?? current?.partyDamageOnMiss ?? 0,
      pressureOnHit: override.pressureOnHit ?? current?.pressureOnHit ?? 0,
      pressureOnMiss: override.pressureOnMiss ?? current?.pressureOnMiss ?? 0,
      appliedTargetStatusIds: override.appliedTargetStatusIds
        ? [...override.appliedTargetStatusIds]
        : [...(current?.appliedTargetStatusIds ?? [])],
      appliedSelfStatusIds: override.appliedSelfStatusIds
        ? [...override.appliedSelfStatusIds]
        : [...(current?.appliedSelfStatusIds ?? [])],
      castBreakRule: override.castBreakRule ?? current?.castBreakRule ?? 'controlOnly',
      dangerLevel: override.dangerLevel ?? current?.dangerLevel ?? 'low',
    }
  }

  applyStatusOverrides(ENEMY_BUFF_DEFINITIONS, overrides.enemyBuffDefinitions, 'enemyBuff')
  applyStatusOverrides(PLAYER_DEBUFF_DEFINITIONS, overrides.playerDebuffDefinitions, 'playerDebuff')
  applyStatusOverrides(PARTY_DEBUFF_DEFINITIONS, overrides.partyDebuffDefinitions, 'partyDebuff')

  const iconDefinitions = overrides.iconDefinitions ?? []
  if (iconDefinitions.length > 0) {
    ENEMY_ICON_DEFINITIONS = iconDefinitions.map((entry) => ({ ...entry }))
  }
}

export function getEnemyDefinition(enemyId: string) {
  return ENEMY_DEFINITIONS[enemyId]
}

export function getEnemySkillDefinition(skillId: string) {
  return ENEMY_SKILL_DEFINITIONS[skillId]
}

export function getEnemyStatusDefinition(statusId: string) {
  return (
    ENEMY_BUFF_DEFINITIONS[statusId] ??
    PLAYER_DEBUFF_DEFINITIONS[statusId] ??
    PARTY_DEBUFF_DEFINITIONS[statusId]
  )
}

export function getEnemyIconDefinitions() {
  return ENEMY_ICON_DEFINITIONS.filter((entry) => entry.enabled).map((entry) => ({ ...entry }))
}

export function getEnemyIconAssetKey(iconId: string) {
  return ENEMY_ICON_DEFINITIONS.find((entry) => entry.iconId === iconId && entry.enabled)?.assetKey
}


