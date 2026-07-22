import * as XLSX from 'xlsx'
import { hasPlayerSkillRuntime } from '../encounter/playerSkillRuntimeRegistry'
import { CHALLENGE_GROUP_POLICIES } from '../progression/classTrialPolicy'
import { hasPassiveTalentLogic } from './playerTalentLogicRegistry'

export interface DesignerDataWorkbookMap {
  stageContent: XLSX.WorkBook
  encounterBalance: XLSX.WorkBook
  enemyData: XLSX.WorkBook
  playerBuild: XLSX.WorkBook
  challengeStageContent: XLSX.WorkBook
  challengeEncounterBalance: XLSX.WorkBook
}

export type DesignerDataValidationCode =
  | 'missing_sheet'
  | 'missing_header'
  | 'missing_required'
  | 'duplicate_id'
  | 'invalid_enum'
  | 'invalid_number'
  | 'invalid_range'
  | 'invalid_combination'
  | 'unknown_reference'
  | 'stage_without_opening'
  | 'stage_without_placements'
  | 'missing_strategy_tips'

export interface DesignerDataValidationIssue {
  workbook: string
  sheet: string
  row?: number
  field?: string
  code: DesignerDataValidationCode
  message: string
  value?: string
}

export interface DesignerDataValidationResult {
  valid: boolean
  errors: DesignerDataValidationIssue[]
  warnings: DesignerDataValidationIssue[]
  summary: DesignerDataValidationSummary
}

export interface DesignerDataValidationSummary {
  totalStages: number
  totalOpenings: number
  totalPlacements: number
  totalEnemyDefinitions: number
  totalEnemySkills: number
  totalActiveSkills: number
  totalPassiveTalents: number
  issueCountsByCode: Partial<Record<DesignerDataValidationCode, number>>
  warningCountsByCode: Partial<Record<DesignerDataValidationCode, number>>
}

type WorkbookKey = keyof DesignerDataWorkbookMap
type SheetRow = Record<string, string | number | boolean | null | undefined>

interface SheetSpec {
  workbookKey: WorkbookKey
  workbookName: string
  sheetName: string
  requiredHeaders: string[]
}

const WORKBOOK_NAMES: Record<WorkbookKey, string> = {
  stageContent: 'stage_content.xlsx',
  encounterBalance: 'encounter_balance.xlsx',
  enemyData: 'enemy_data.xlsx',
  playerBuild: 'player_build.xlsx',
  challengeStageContent: 'challenge_stage_content.xlsx',
  challengeEncounterBalance: 'challenge_encounter_balance.xlsx',
}

const SHEET_SPECS: SheetSpec[] = [
  {
    workbookKey: 'stageContent',
    workbookName: WORKBOOK_NAMES.stageContent,
    sheetName: '区域',
    requiredHeaders: ['areaId', 'title', 'shortTitle', 'mapLabel', 'description', 'accent'],
  },
  {
    workbookKey: 'stageContent',
    workbookName: WORKBOOK_NAMES.stageContent,
    sheetName: '关卡',
    requiredHeaders: ['stageId', 'areaId', 'order', 'title', 'unlockedActiveSkillIdsCsv'],
  },
  {
    workbookKey: 'stageContent',
    workbookName: WORKBOOK_NAMES.stageContent,
    sheetName: '图例',
    requiredHeaders: ['areaId', 'id', 'iconId', 'label', 'source', 'target', 'description'],
  },
  {
    workbookKey: 'encounterBalance',
    workbookName: WORKBOOK_NAMES.encounterBalance,
    sheetName: '关卡开场',
    requiredHeaders: [
      'stageId',
      'playerHp',
      'playerMaxHp',
      'playerResource',
      'playerGcdRemainingMs',
      'partyHp',
      'partyMaxHp',
      'partyPressure',
      'partyMaxPressure',
      'buildRuleId',
    ],
  },
  {
    workbookKey: 'encounterBalance',
    workbookName: WORKBOOK_NAMES.encounterBalance,
    sheetName: '敌人布置',
    requiredHeaders: ['stageId', 'spawnId', 'enemyId', 'row', 'col'],
  },
  {
    workbookKey: 'encounterBalance',
    workbookName: WORKBOOK_NAMES.encounterBalance,
    sheetName: '开场状态',
    requiredHeaders: ['stageId', 'targetType', 'statusId', 'sourceType'],
  },
  {
    workbookKey: 'encounterBalance',
    workbookName: WORKBOOK_NAMES.encounterBalance,
    sheetName: '关卡词缀绑定',
    requiredHeaders: ['stageId', 'affixIdsCsv'],
  },
  {
    workbookKey: 'encounterBalance',
    workbookName: WORKBOOK_NAMES.encounterBalance,
    sheetName: '词缀定义',
    requiredHeaders: ['affixId', 'affixName', 'iconId', 'description', 'delayMs', 'targetType', 'targetSelector', 'statusId'],
  },
  {
    workbookKey: 'encounterBalance',
    workbookName: WORKBOOK_NAMES.encounterBalance,
    sheetName: '特殊规则绑定',
    requiredHeaders: ['stageId', 'ruleIdsCsv'],
  },
  {
    workbookKey: 'encounterBalance',
    workbookName: WORKBOOK_NAMES.encounterBalance,
    sheetName: '特殊规则定义',
    requiredHeaders: ['ruleId', 'ruleName', 'iconId', 'description', 'ruleLogicId'],
  },
  {
    workbookKey: 'enemyData',
    workbookName: WORKBOOK_NAMES.enemyData,
    sheetName: '敌人定义',
    requiredHeaders: ['enemyId', 'name', 'baseMaxHp', 'skillIdsCsv', 'skillCycleCsv', 'threatLogic'],
  },
  {
    workbookKey: 'enemyData',
    workbookName: WORKBOOK_NAMES.enemyData,
    sheetName: '敌人技能',
    requiredHeaders: ['skillId', 'skillName', 'targetRuleId', 'castTimeMs', 'recoveryMs', 'damageType', 'castBreakRule'],
  },
  {
    workbookKey: 'enemyData',
    workbookName: WORKBOOK_NAMES.enemyData,
    sheetName: '敌方Buff',
    requiredHeaders: ['statusId', 'statusName', 'iconId', 'durationMs', 'isDispellable', 'description', 'effectLogicId'],
  },
  {
    workbookKey: 'enemyData',
    workbookName: WORKBOOK_NAMES.enemyData,
    sheetName: '玩家Debuff',
    requiredHeaders: ['statusId', 'statusName', 'iconId', 'durationMs', 'isDispellable', 'description', 'effectLogicId'],
  },
  {
    workbookKey: 'enemyData',
    workbookName: WORKBOOK_NAMES.enemyData,
    sheetName: '队伍Debuff',
    requiredHeaders: ['statusId', 'statusName', 'iconId', 'durationMs', 'isDispellable', 'description', 'effectLogicId'],
  },
  {
    workbookKey: 'enemyData',
    workbookName: WORKBOOK_NAMES.enemyData,
    sheetName: '图标资源映射',
    requiredHeaders: ['iconId', 'iconName', 'assetKey', 'iconType'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '职业定义',
    requiredHeaders: ['classId', 'className', 'roleTag', 'classDescription'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '构筑规则定义',
    requiredHeaders: ['buildRuleId', 'classId', 'ruleName', 'description', 'totalBuildPoints', 'maxActiveSlots', 'enabledHotkeysCsv', 'inheritancePolicy'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '主动技能定义',
    requiredHeaders: ['skillId', 'classId', 'skillName', 'shortName', 'description', 'iconId', 'pointCost', 'resourceCost', 'cooldownMs', 'gcdMs', 'targetingType', 'skillLogicId', 'castStopMode', 'canAffectSkull'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '主动技能效果',
    requiredHeaders: ['skillEffectId', 'skillId'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '玩家主动状态定义',
    requiredHeaders: ['statusId', 'statusName', 'statusCategory', 'iconId', 'durationMs', 'maxStacks', 'dispellable', 'description', 'effectLogicId'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '被动天赋定义',
    requiredHeaders: ['talentId', 'classId', 'talentName', 'category', 'cost', 'description', 'iconId', 'talentLogicId', 'tier'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '被动天赋效果',
    requiredHeaders: ['talentEffectId', 'talentId'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '玩家被动状态定义',
    requiredHeaders: ['statusId', 'statusName', 'statusCategory', 'iconId', 'durationMs', 'maxStacks', 'dispellable', 'description', 'effectLogicId'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '默认主动构筑',
    requiredHeaders: ['presetId', 'hotkey'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '默认被动构筑',
    requiredHeaders: ['presetId', 'talentId', 'selected'],
  },
  {
    workbookKey: 'playerBuild',
    workbookName: WORKBOOK_NAMES.playerBuild,
    sheetName: '图标资源映射',
    requiredHeaders: ['iconId', 'iconName', 'assetKey', 'iconType'],
  },
  {
    workbookKey: 'challengeStageContent',
    workbookName: WORKBOOK_NAMES.challengeStageContent,
    sheetName: '区域',
    requiredHeaders: ['areaId', 'title', 'shortTitle', 'mapLabel', 'description', 'accent'],
  },
  {
    workbookKey: 'challengeStageContent',
    workbookName: WORKBOOK_NAMES.challengeStageContent,
    sheetName: '关卡',
    requiredHeaders: [
      'stageId',
      'areaId',
      'order',
      'title',
      'unlockedActiveSkillIdsCsv',
      'passiveTalentUnlockTier',
      'challengeId',
      'allowedClassIdsCsv',
      'buildRuleId',
    ],
  },
  {
    workbookKey: 'challengeStageContent',
    workbookName: WORKBOOK_NAMES.challengeStageContent,
    sheetName: '图例',
    requiredHeaders: ['areaId', 'id', 'iconId', 'label', 'source', 'target', 'description'],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '关卡开场',
    requiredHeaders: [
      'stageId',
      'playerHp',
      'playerMaxHp',
      'playerResource',
      'playerGcdRemainingMs',
      'partyHp',
      'partyMaxHp',
      'partyPressure',
      'partyMaxPressure',
      'buildRuleId',
    ],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '敌人布置',
    requiredHeaders: ['stageId', 'spawnId', 'enemyId', 'row', 'col'],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '开场状态',
    requiredHeaders: ['stageId', 'targetType', 'statusId', 'sourceType'],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '关卡词缀绑定',
    requiredHeaders: ['stageId', 'affixIdsCsv'],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '词缀定义',
    requiredHeaders: ['affixId', 'affixName', 'iconId', 'description', 'delayMs', 'targetType', 'targetSelector', 'statusId'],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '特殊规则绑定',
    requiredHeaders: ['stageId', 'ruleIdsCsv'],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '特殊规则定义',
    requiredHeaders: ['ruleId', 'ruleName', 'iconId', 'description', 'ruleLogicId'],
  },
  {
    workbookKey: 'challengeEncounterBalance',
    workbookName: WORKBOOK_NAMES.challengeEncounterBalance,
    sheetName: '图标资源映射',
    requiredHeaders: ['iconId', 'iconName', 'assetKey', 'iconType'],
  },
]

const ENUMS = {
  areaId: ['harbor', 'midland', 'highland'],
  stageId: [
    'harbor-1',
    'harbor-2',
    'harbor-3',
    'harbor-4',
    'harbor-5',
    'harbor-6',
    'midland-1',
    'midland-2',
    'midland-3',
    'midland-4',
    'midland-5',
    'midland-6',
    'highland-1',
    'highland-2',
    'highland-3',
    'highland-4',
    'highland-5',
    'highland-6',
  ],
  skillHotkey: ['1', '2', '3', '4', 'Q', 'E', 'R', 'F'],
  inheritancePolicy: ['keep_active_first', 'keep_balanced', 'reset_to_default'],
  roleTag: ['tank'],
  activeTargetingType: ['currentEnemy', 'crossEnemy', 'matrix3x3Enemy', 'topLeft2x2Enemy', 'allEnemy', 'party', 'self'],
  activeTargetSelector: ['current', 'adjacent', 'cross', 'matrix3x3', 'topLeft2x2', 'allEnemy', 'party', 'self'],
  castStopMode: ['none', 'interrupt', 'control'],
  talentCategory: ['player', 'skill', 'party'],
  talentTargetScope: ['player', 'party', 'skill'],
  playerStatusCategory: ['playerBuff', 'enemyDebuff', 'partyBuff', 'partyDebuff'],
  iconType: ['skill', 'talent', 'status', 'class', 'affix', 'rule'],
  threatSource: ['player', 'party'],
  enemyTargetRuleId: ['threatTarget', 'tankAndParty', 'party', 'otherEnemy', 'self', 'mostInjured'],
  enemyThreatLogic: ['normal', 'irregular', 'bloodlust'],
  enemyTarget: ['tank', 'ally'],
  threatState: ['safe', 'warning', 'lost'],
  damageType: ['physical', 'magic'],
  castBreakRule: ['interruptOrControl', 'controlOnly', 'unstoppable'],
  dangerLevel: ['low', 'medium', 'high'],
  openingStatusTargetType: ['player', 'party', 'enemy'],
  openingStatusSourceType: ['manual', 'affix', 'specialRule'],
  affixTargetType: ['enemy', 'player', 'party'],
}

const BUILTIN_IDS = {
  enemies: [
    'harbor_raider',
    'harbor_pyromancer',
    'harbor_stalker',
    'harbor_breaker',
    'harbor_commander',
    'midland_raider',
    'midland_pyromancer',
    'midland_stalker',
    'midland_breaker',
    'midland_commander',
    'highland_raider',
    'highland_pyromancer',
    'highland_stalker',
    'highland_breaker',
    'highland_commander',
  ],
  enemySkills: [
    'bone-jab',
    'reckless-rush',
    'flame-lance',
    'ember-bolt',
    'dark-mend',
    'staff-smash',
    'ember-rush',
    'feint-slash',
    'backstab',
    'guard-breaker',
    'rampage',
    'crusher-slam',
    'ruin-volley',
  ],
  enemyStatuses: [
    'ember-aegis',
    'haste',
    'evasion',
    'guarded',
    'fortified',
    'enraged',
    'enrage-song',
    'countered',
    'sundered',
    'weakened',
    'stunned',
    'silenced',
    'suppression',
    'formation-break',
    'chaos-volley',
  ],
  playerClasses: ['warrior_t'],
  buildRules: ['tutorial_2slot', 'tutorial_3slot', 'tutorial_4slot', 'tutorial_5slot', 'standard_5slot', 'full_8slot'],
  activeSkills: [
    'taunt',
    'interrupt',
    'stun',
    'massTaunt',
    'shieldWall',
    'cleave',
    'burst',
    'panic',
    'shieldSlam',
    'shieldReflection',
    'avatar',
    'shockwave',
    'thunderstruck',
    'rallyingCry',
    'intervene',
    'demoralizingShout',
    'warrior_t_taunt',
    'warrior_t_interrupt',
    'warrior_t_stun',
    'warrior_t_shield_wall',
    'warrior_t_mass_taunt',
    'warrior_t_cleave',
    'warrior_t_burst',
    'warrior_t_shield_slam',
    'warrior_t_shield_reflection',
    'warrior_t_avatar',
    'warrior_t_shockwave',
    'warrior_t_thunderstruck',
    'warrior_t_rallying_cry',
    'warrior_t_intervene',
    'warrior_t_demoralizing_shout',
  ],
  playerStatuses: [
    'taunted',
    'mass-taunt',
    'stunned',
    'silenced',
    'shieldWall',
    'shieldReflection',
    'avatar',
    'intervened',
    'demoralized',
    'vanguard-oath',
    'steady-relief',
    'overclock-pressure',
    'field-medic-strain',
  ],
  passiveTalents: [
    'vitalReserve',
    'surgeEngine',
    'vanguardOath',
    'ironLung',
    'shockMatrix',
    'snapInterrupt',
    'temperedBurst',
    'sweepingCleave',
    'fortifiedWall',
    'rallyingStandard',
    'pressureValve',
    'sacrificialFormation',
    'overclockDoctrine',
    'deepReserve',
    'fieldMedic',
    'warrior_t_vital_reserve',
    'warrior_t_snap_interrupt',
    'warrior_t_vanguard_oath',
    'warrior_t_rallying_standard',
  ],
  icons: [
    'taunt',
    'interrupt',
    'stun',
    'massTaunt',
    'shieldWall',
    'cleave',
    'burst',
    'shieldSlam',
    'shieldReflection',
    'avatar',
    'shockwave',
    'thunderstruck',
    'rallyingCry',
    'intervene',
    'demoralizingShout',
    'panic',
    'vitalReserve',
    'surgeEngine',
    'vanguardOath',
    'ironLung',
    'shockMatrix',
    'snapInterrupt',
    'temperedBurst',
    'sweepingCleave',
    'fortifiedWall',
    'rallyingStandard',
    'pressureValve',
    'sacrificialFormation',
    'overclockDoctrine',
    'deepReserve',
    'fieldMedic',
    'taunted',
    'mass-taunt',
    'silenced',
    'stunned',
    'intervened',
    'demoralized',
    'vanguard-oath',
    'locked',
    'ember-aegis',
    'battle-seal',
    'guarded',
    'haste',
    'heat-haze',
    'sundered',
    'enrage-song',
  ],
}

type StructuredParameterField = 'valueA' | 'valueB' | 'tickIntervalMs'

const STATUS_EFFECT_PARAMETER_REQUIREMENTS: Record<string, readonly StructuredParameterField[]> = {
  enemy_heal_small: ['valueA'],
  murlocHealing_status: ['valueA'],
  'run!_status': ['valueA', 'tickIntervalMs'],
  'wind_strike!_status': ['valueA', 'tickIntervalMs'],
}

const SPECIAL_RULE_PARAMETER_REQUIREMENTS: Record<string, readonly StructuredParameterField[]> = {
  andThen: ['valueA'],
  periodic_reinforcement: ['tickIntervalMs'],
  player_control_tax: ['valueA', 'tickIntervalMs'],
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function isBlankRow(row: SheetRow) {
  return Object.values(row).every((value) => normalizeText(value) === '')
}

function hasText(row: SheetRow, field: string) {
  return normalizeText(row[field]) !== ''
}

function readRows(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return []
  }

  return XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    defval: '',
    raw: false,
  }).filter((row) => !isBlankRow(row))
}

function getHeaders(workbook: XLSX.WorkBook, sheetName: string): string[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return []
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
  })
  return (rows[0] ?? []).map((header) => normalizeText(header)).filter(Boolean)
}

function parseCsv(value: unknown) {
  return normalizeText(value)
    .split(/[,，]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function rowNumber(index: number) {
  return index + 2
}

function issue(input: Omit<DesignerDataValidationIssue, 'message'> & { message?: string }): DesignerDataValidationIssue {
  return {
    ...input,
    message:
      input.message ??
      [
        input.workbook,
        input.sheet,
        input.row ? `row ${input.row}` : undefined,
        input.field,
        input.code,
        input.value ? `value=${input.value}` : undefined,
      ].filter(Boolean).join(' | '),
  }
}

function countIssuesByCode(issues: DesignerDataValidationIssue[]) {
  return issues.reduce<Partial<Record<DesignerDataValidationCode, number>>>((counts, current) => {
    counts[current.code] = (counts[current.code] ?? 0) + 1
    return counts
  }, {})
}

function addWarning(
  warnings: DesignerDataValidationIssue[],
  input: Omit<DesignerDataValidationIssue, 'message'> & { message?: string },
) {
  warnings.push(issue(input))
}

function addStageCoverageWarnings(
  warnings: DesignerDataValidationIssue[],
  rows: ReturnType<typeof collectSheetRows>,
) {
  const openingStageIds = new Set(rows.openings.map((row) => normalizeText(row.stageId)).filter(Boolean))
  const placementStageIds = new Set(rows.placements.map((row) => normalizeText(row.stageId)).filter(Boolean))

  rows.stages.forEach((row, index) => {
    const stageId = normalizeText(row.stageId)
    if (!stageId) {
      return
    }

    if (!openingStageIds.has(stageId)) {
      addWarning(warnings, {
        workbook: WORKBOOK_NAMES.encounterBalance,
        sheet: '关卡开场',
        field: 'stageId',
        code: 'stage_without_opening',
        value: stageId,
      })
    }

    if (!normalizeText(row.strategyTips)) {
      addWarning(warnings, {
        workbook: WORKBOOK_NAMES.stageContent,
        sheet: '关卡',
        row: rowNumber(index),
        field: 'stageId',
        code: 'missing_strategy_tips',
        value: stageId,
      })
    }
  })

  rows.openings.forEach((row, index) => {
    const stageId = normalizeText(row.stageId)
    if (stageId && !placementStageIds.has(stageId)) {
      addWarning(warnings, {
        workbook: WORKBOOK_NAMES.encounterBalance,
        sheet: '敌人布置',
        row: rowNumber(index),
        field: 'stageId',
        code: 'stage_without_placements',
        value: stageId,
      })
    }
  })
}

function buildValidationSummary(
  rows: ReturnType<typeof collectSheetRows>,
  errors: DesignerDataValidationIssue[],
  warnings: DesignerDataValidationIssue[],
): DesignerDataValidationSummary {
  return {
    totalStages: rows.stages.filter((row) => hasText(row, 'stageId')).length,
    totalOpenings: rows.openings.filter((row) => hasText(row, 'stageId')).length,
    totalPlacements: rows.placements.filter((row) => hasText(row, 'stageId') || hasText(row, 'enemyId')).length,
    totalEnemyDefinitions: rows.enemyDefinitions.filter((row) => hasText(row, 'enemyId')).length,
    totalEnemySkills: rows.enemySkills.filter((row) => hasText(row, 'skillId')).length,
    totalActiveSkills: rows.activeSkills.filter((row) => hasText(row, 'skillId')).length,
    totalPassiveTalents: rows.passiveTalents.filter((row) => hasText(row, 'talentId')).length,
    issueCountsByCode: countIssuesByCode(errors),
    warningCountsByCode: countIssuesByCode(warnings),
  }
}

function addMissingSheetAndHeaderIssues(workbooks: DesignerDataWorkbookMap, errors: DesignerDataValidationIssue[]) {
  for (const spec of SHEET_SPECS) {
    const workbook = workbooks[spec.workbookKey]
    if (!workbook.Sheets[spec.sheetName]) {
      errors.push(issue({
        workbook: spec.workbookName,
        sheet: spec.sheetName,
        code: 'missing_sheet',
      }))
      continue
    }

    const headers = new Set(getHeaders(workbook, spec.sheetName))
    for (const header of spec.requiredHeaders) {
      if (!headers.has(header)) {
        errors.push(issue({
          workbook: spec.workbookName,
          sheet: spec.sheetName,
          field: header,
          code: 'missing_header',
        }))
      }
    }
  }
}

function requireText(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  row: SheetRow,
  rowIndex: number,
  field: string,
) {
  const value = normalizeText(row[field])
  if (!value) {
    errors.push(issue({
      workbook,
      sheet,
      row: rowNumber(rowIndex),
      field,
      code: 'missing_required',
    }))
  }

  return value
}

function optionalText(row: SheetRow, field: string) {
  return normalizeText(row[field])
}

function validateNumber(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  row: SheetRow,
  rowIndex: number,
  field: string,
  options: { required?: boolean; min?: number; max?: number; integer?: boolean } = {},
) {
  const text = normalizeText(row[field])
  if (!text) {
    if (options.required) {
      errors.push(issue({ workbook, sheet, row: rowNumber(rowIndex), field, code: 'missing_required' }))
    }
    return undefined
  }

  const number = Number(text)
  if (!Number.isFinite(number) || (options.integer && !Number.isInteger(number))) {
    errors.push(issue({
      workbook,
      sheet,
      row: rowNumber(rowIndex),
      field,
      code: 'invalid_number',
      value: text,
    }))
    return undefined
  }

  if ((typeof options.min === 'number' && number < options.min) || (typeof options.max === 'number' && number > options.max)) {
    errors.push(issue({
      workbook,
      sheet,
      row: rowNumber(rowIndex),
      field,
      code: 'invalid_range',
      value: text,
    }))
  }

  return number
}

function validateStructuredParameterFields(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  row: SheetRow,
  rowIndex: number,
) {
  validateNumber(errors, workbook, sheet, row, rowIndex, 'valueA')
  validateNumber(errors, workbook, sheet, row, rowIndex, 'valueB')
  validateNumber(errors, workbook, sheet, row, rowIndex, 'tickIntervalMs', { min: 0 })
}

function addInvalidCombinationIssue(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  rowIndex: number,
  field: string,
  value: string,
) {
  errors.push(issue({
    workbook,
    sheet,
    row: rowNumber(rowIndex),
    field,
    code: 'invalid_combination',
    value,
  }))
}

function validateRequiredStructuredParameters(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  row: SheetRow,
  rowIndex: number,
  logicId: string,
  requirements: Record<string, readonly StructuredParameterField[]>,
) {
  for (const field of requirements[logicId] ?? []) {
    if (!optionalText(row, field)) {
      errors.push(issue({
        workbook,
        sheet,
        row: rowNumber(rowIndex),
        field,
        code: 'missing_required',
        value: `${logicId} requires ${field}`,
      }))
    }
  }
}

function validateEnum(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  row: SheetRow,
  rowIndex: number,
  field: string,
  allowedValues: readonly string[],
  options: { required?: boolean } = {},
) {
  const value = normalizeText(row[field])
  if (!value) {
    if (options.required) {
      errors.push(issue({ workbook, sheet, row: rowNumber(rowIndex), field, code: 'missing_required' }))
    }
    return
  }

  if (!allowedValues.includes(value)) {
    errors.push(issue({
      workbook,
      sheet,
      row: rowNumber(rowIndex),
      field,
      code: 'invalid_enum',
      value,
    }))
  }
}

function validateCsvEnum(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  row: SheetRow,
  rowIndex: number,
  field: string,
  allowedValues: readonly string[],
) {
  for (const value of parseCsv(row[field])) {
    if (!allowedValues.includes(value)) {
      errors.push(issue({
        workbook,
        sheet,
        row: rowNumber(rowIndex),
        field,
        code: 'invalid_enum',
        value,
      }))
    }
  }
}

function validateReference(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  rowIndex: number,
  field: string,
  value: string,
  validIds: ReadonlySet<string>,
) {
  if (value && !validIds.has(value)) {
    errors.push(issue({
      workbook,
      sheet,
      row: rowNumber(rowIndex),
      field,
      code: 'unknown_reference',
      value,
    }))
  }
}

function validateCsvReferences(
  errors: DesignerDataValidationIssue[],
  workbook: string,
  sheet: string,
  row: SheetRow,
  rowIndex: number,
  field: string,
  validIds: ReadonlySet<string>,
) {
  for (const value of parseCsv(row[field])) {
    validateReference(errors, workbook, sheet, rowIndex, field, value, validIds)
  }
}

function collectIds(
  errors: DesignerDataValidationIssue[],
  rows: SheetRow[],
  workbook: string,
  sheet: string,
  field: string,
  options: { required?: boolean } = { required: true },
) {
  const ids = new Set<string>()

  rows.forEach((row, index) => {
    const id = normalizeText(row[field])
    if (!id) {
      if (options.required) {
        errors.push(issue({ workbook, sheet, row: rowNumber(index), field, code: 'missing_required' }))
      }
      return
    }

    if (ids.has(id)) {
      errors.push(issue({
        workbook,
        sheet,
        row: rowNumber(index),
        field,
        code: 'duplicate_id',
        value: id,
      }))
      return
    }

    ids.add(id)
  })

  return ids
}

function isEnabledRow(row: SheetRow) {
  return optionalText(row, 'enabled').toLowerCase() !== 'false'
}

function getPrefixedStatusOwner(statusId: string, classIds: ReadonlySet<string>) {
  const knownClassIds = new Set([
    ...classIds,
    ...CHALLENGE_GROUP_POLICIES.flatMap((group) => group.trialClassId ? [group.trialClassId] : []),
  ])
  return [...knownClassIds]
    .sort((left, right) => right.length - left.length)
    .find((classId) => statusId.startsWith(`${classId}_`))
}

function addClassOwnershipIssues(
  errors: DesignerDataValidationIssue[],
  rows: ReturnType<typeof collectSheetRows>,
  classIds: ReadonlySet<string>,
) {
  const activeSkillClassById = new Map(
    rows.activeSkills.map((row) => [optionalText(row, 'skillId'), optionalText(row, 'classId')]),
  )
  const passiveTalentClassById = new Map(
    rows.passiveTalents.map((row) => [optionalText(row, 'talentId'), optionalText(row, 'classId')]),
  )

  rows.activeSkills.forEach((row, index) => {
    const skillId = optionalText(row, 'skillId')
    const classId = optionalText(row, 'classId')
    if (skillId && classId && !skillId.startsWith(`${classId}_`)) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', index, 'skillId', skillId)
    }
    const skillLogicId = optionalText(row, 'skillLogicId')
    if (isEnabledRow(row) && skillLogicId && !hasPlayerSkillRuntime(skillLogicId)) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.playerBuild,
        '主动技能定义',
        index,
        'skillLogicId',
        skillLogicId,
      )
    }
  })

  rows.passiveTalents.forEach((row, index) => {
    const talentId = optionalText(row, 'talentId')
    const classId = optionalText(row, 'classId')
    if (talentId && classId && !talentId.startsWith(`${classId}_`)) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', index, 'talentId', talentId)
    }
    const talentLogicId = optionalText(row, 'talentLogicId')
    if (isEnabledRow(row) && talentLogicId && !hasPassiveTalentLogic(talentLogicId)) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.playerBuild,
        '被动天赋定义',
        index,
        'talentLogicId',
        talentLogicId,
      )
    }
  })

  rows.defaultActiveBuilds.forEach((row, index) => {
    const classId = optionalText(row, 'classId')
    const skillId = optionalText(row, 'skillId')
    if (classId && skillId && activeSkillClassById.get(skillId) !== classId) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '默认主动构筑', index, 'skillId', skillId)
    }
  })

  rows.defaultPassiveBuilds.forEach((row, index) => {
    const classId = optionalText(row, 'classId')
    const talentId = optionalText(row, 'talentId')
    if (classId && talentId && passiveTalentClassById.get(talentId) !== classId) {
      addInvalidCombinationIssue(errors, WORKBOOK_NAMES.playerBuild, '默认被动构筑', index, 'talentId', talentId)
    }
  })

  const validateStatusOwner = (
    sheet: string,
    rowIndex: number,
    statusId: string,
    ownerClassId: string | undefined,
  ) => {
    const statusOwnerClassId = getPrefixedStatusOwner(statusId, classIds)
    if (statusOwnerClassId && ownerClassId && statusOwnerClassId !== ownerClassId) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.playerBuild,
        sheet,
        rowIndex,
        'statusId',
        `${statusId} belongs to ${statusOwnerClassId}, not ${ownerClassId}`,
      )
    }
  }

  rows.activeSkillEffects.forEach((row, index) => {
    validateStatusOwner(
      '主动技能效果',
      index,
      optionalText(row, 'statusId'),
      activeSkillClassById.get(optionalText(row, 'skillId')),
    )
  })

  rows.passiveTalents.forEach((row, index) => {
    const ownerClassId = optionalText(row, 'classId')
    for (const statusId of parseCsv(row.grantedStatusIdsCsv)) {
      validateStatusOwner('被动天赋定义', index, statusId, ownerClassId)
    }
  })

  rows.passiveTalentEffects.forEach((row, index) => {
    const ownerClassId = passiveTalentClassById.get(optionalText(row, 'talentId'))
    validateStatusOwner('被动天赋效果', index, optionalText(row, 'statusId'), ownerClassId)

    const skillId = optionalText(row, 'skillId')
    const skillClassId = activeSkillClassById.get(skillId)
    if (skillId && ownerClassId && skillClassId && skillClassId !== ownerClassId) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.playerBuild,
        '被动天赋效果',
        index,
        'skillId',
        `${skillId} belongs to ${skillClassId}, not ${ownerClassId}`,
      )
    }
  })
}

function addChallengeConsistencyIssues(
  errors: DesignerDataValidationIssue[],
  rows: ReturnType<typeof collectSheetRows>,
  classIds: ReadonlySet<string>,
  buildRuleIds: ReadonlySet<string>,
  activeSkillClassById: ReadonlyMap<string, string>,
) {
  const enabledChallengeStages = rows.challengeStages.filter(isEnabledRow)
  const enabledStagesById = new Map<string, SheetRow[]>()
  for (const stage of enabledChallengeStages) {
    const stageId = optionalText(stage, 'stageId')
    const entries = enabledStagesById.get(stageId) ?? []
    entries.push(stage)
    enabledStagesById.set(stageId, entries)
  }

  const expectedStageIds = new Set(CHALLENGE_GROUP_POLICIES.flatMap((group) => [...group.challengeIds]))
  for (const stageId of expectedStageIds) {
    if ((enabledStagesById.get(stageId) ?? []).length !== 1) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.challengeStageContent,
        '关卡',
        0,
        'stageId',
        `${stageId} requires exactly one enabled row`,
      )
    }
  }

  const challengeStageIds = new Set(
    rows.challengeStages.map((row) => optionalText(row, 'stageId')).filter(Boolean),
  )
  rows.challengeOpenings.forEach((row, index) => {
    const stageId = requireText(
      errors,
      WORKBOOK_NAMES.challengeEncounterBalance,
      '关卡开场',
      row,
      index,
      'stageId',
    )
    validateReference(
      errors,
      WORKBOOK_NAMES.challengeEncounterBalance,
      '关卡开场',
      index,
      'stageId',
      stageId,
      challengeStageIds,
    )
    validateReference(
      errors,
      WORKBOOK_NAMES.challengeEncounterBalance,
      '关卡开场',
      index,
      'buildRuleId',
      requireText(errors, WORKBOOK_NAMES.challengeEncounterBalance, '关卡开场', row, index, 'buildRuleId'),
      buildRuleIds,
    )
    for (const field of [
      'playerHp',
      'playerMaxHp',
      'playerResource',
      'playerGcdRemainingMs',
      'partyHp',
      'partyMaxHp',
      'partyPressure',
      'partyMaxPressure',
    ]) {
      validateNumber(errors, WORKBOOK_NAMES.challengeEncounterBalance, '关卡开场', row, index, field, {
        required: true,
      })
    }
  })

  enabledChallengeStages.forEach((stage, index) => {
    const stageId = requireText(
      errors,
      WORKBOOK_NAMES.challengeStageContent,
      '关卡',
      stage,
      index,
      'stageId',
    )
    validateReference(
      errors,
      WORKBOOK_NAMES.challengeStageContent,
      '关卡',
      index,
      'stageId',
      stageId,
      expectedStageIds,
    )
    validateNumber(errors, WORKBOOK_NAMES.challengeStageContent, '关卡', stage, index, 'order', {
      required: true,
      min: 1,
      max: 9,
      integer: true,
    })
    validateNumber(errors, WORKBOOK_NAMES.challengeStageContent, '关卡', stage, index, 'passiveTalentUnlockTier', {
      required: true,
      min: 0,
      integer: true,
    })
    const stageRuleId = requireText(
      errors,
      WORKBOOK_NAMES.challengeStageContent,
      '关卡',
      stage,
      index,
      'buildRuleId',
    )
    validateReference(
      errors,
      WORKBOOK_NAMES.challengeStageContent,
      '关卡',
      index,
      'buildRuleId',
      stageRuleId,
      buildRuleIds,
    )

    const allowedClassIds = parseCsv(stage.allowedClassIdsCsv)
    for (const classId of allowedClassIds) {
      validateReference(
        errors,
        WORKBOOK_NAMES.challengeStageContent,
        '关卡',
        index,
        'allowedClassIdsCsv',
        classId,
        classIds,
      )
    }
    for (const skillId of parseCsv(stage.unlockedActiveSkillIdsCsv)) {
      const ownerClassId = activeSkillClassById.get(skillId)
      if (!ownerClassId || !allowedClassIds.includes(ownerClassId)) {
        addInvalidCombinationIssue(
          errors,
          WORKBOOK_NAMES.challengeStageContent,
          '关卡',
          index,
          'unlockedActiveSkillIdsCsv',
          skillId,
        )
      }
    }

    const openings = rows.challengeOpenings.filter((row) => optionalText(row, 'stageId') === stageId)
    if (openings.length !== 1) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.challengeEncounterBalance,
        '关卡开场',
        index,
        'stageId',
        `${stageId} requires exactly one opening`,
      )
    } else {
      const openingRuleId = optionalText(openings[0], 'buildRuleId')
      if (stageRuleId !== openingRuleId) {
        addInvalidCombinationIssue(
          errors,
          WORKBOOK_NAMES.challengeEncounterBalance,
          '关卡开场',
          index,
          'buildRuleId',
          openingRuleId,
        )
      }
    }
  })

  const enabledClassIds = new Set(
    rows.playerClasses
      .filter(isEnabledRow)
      .map((row) => optionalText(row, 'classId'))
      .filter(Boolean),
  )
  CHALLENGE_GROUP_POLICIES.forEach((group, groupIndex) => {
    const trialClassId = group.trialClassId
    if (!trialClassId || !enabledClassIds.has(trialClassId)) {
      return
    }
    for (const requiredGroup of CHALLENGE_GROUP_POLICIES.slice(groupIndex)) {
      for (const stageId of requiredGroup.challengeIds) {
        const stage = (enabledStagesById.get(stageId) ?? [])[0]
        if (stage && !parseCsv(stage.allowedClassIdsCsv).includes(trialClassId)) {
          const rowIndex = enabledChallengeStages.indexOf(stage)
          addInvalidCombinationIssue(
            errors,
            WORKBOOK_NAMES.challengeStageContent,
            '关卡',
            rowIndex,
            'allowedClassIdsCsv',
            `${trialClassId} is required by trial policy`,
          )
        }
      }
    }
  })
}

function collectSheetRows(workbooks: DesignerDataWorkbookMap) {
  return {
    stageAreas: readRows(workbooks.stageContent, '区域'),
    stages: readRows(workbooks.stageContent, '关卡'),
    legends: readRows(workbooks.stageContent, '图例'),
    openings: readRows(workbooks.encounterBalance, '关卡开场'),
    placements: readRows(workbooks.encounterBalance, '敌人布置'),
    openingStatuses: readRows(workbooks.encounterBalance, '开场状态'),
    affixBindings: readRows(workbooks.encounterBalance, '关卡词缀绑定'),
    affixDefinitions: readRows(workbooks.encounterBalance, '词缀定义'),
    specialRuleBindings: readRows(workbooks.encounterBalance, '特殊规则绑定'),
    specialRuleDefinitions: readRows(workbooks.encounterBalance, '特殊规则定义'),
    enemyDefinitions: readRows(workbooks.enemyData, '敌人定义'),
    enemySkills: readRows(workbooks.enemyData, '敌人技能'),
    enemyBuffs: readRows(workbooks.enemyData, '敌方Buff'),
    playerDebuffs: readRows(workbooks.enemyData, '玩家Debuff'),
    partyDebuffs: readRows(workbooks.enemyData, '队伍Debuff'),
    enemyIcons: readRows(workbooks.enemyData, '图标资源映射'),
    playerClasses: readRows(workbooks.playerBuild, '职业定义'),
    buildRules: readRows(workbooks.playerBuild, '构筑规则定义'),
    activeSkills: readRows(workbooks.playerBuild, '主动技能定义'),
    activeSkillEffects: readRows(workbooks.playerBuild, '主动技能效果'),
    activeStatuses: readRows(workbooks.playerBuild, '玩家主动状态定义'),
    passiveTalents: readRows(workbooks.playerBuild, '被动天赋定义'),
    passiveTalentEffects: readRows(workbooks.playerBuild, '被动天赋效果'),
    passiveStatuses: readRows(workbooks.playerBuild, '玩家被动状态定义'),
    defaultActiveBuilds: readRows(workbooks.playerBuild, '默认主动构筑'),
    defaultPassiveBuilds: readRows(workbooks.playerBuild, '默认被动构筑'),
    icons: readRows(workbooks.playerBuild, '图标资源映射'),
    challengeAreas: readRows(workbooks.challengeStageContent, '区域'),
    challengeStages: readRows(workbooks.challengeStageContent, '关卡'),
    challengeLegends: readRows(workbooks.challengeStageContent, '图例'),
    challengeOpenings: readRows(workbooks.challengeEncounterBalance, '关卡开场'),
    challengePlacements: readRows(workbooks.challengeEncounterBalance, '敌人布置'),
    challengeOpeningStatuses: readRows(workbooks.challengeEncounterBalance, '开场状态'),
    challengeAffixBindings: readRows(workbooks.challengeEncounterBalance, '关卡词缀绑定'),
    challengeAffixDefinitions: readRows(workbooks.challengeEncounterBalance, '词缀定义'),
    challengeDamageSourceDefinitions: readRows(workbooks.challengeEncounterBalance, '伤害来源定义'),
    challengeDamageSourceBindings: readRows(workbooks.challengeEncounterBalance, '关卡伤害来源绑定'),
    challengeSpecialRuleBindings: readRows(workbooks.challengeEncounterBalance, '特殊规则绑定'),
    challengeSpecialRuleDefinitions: readRows(workbooks.challengeEncounterBalance, '特殊规则定义'),
    challengeIcons: readRows(workbooks.challengeEncounterBalance, '图标资源映射'),
  }
}

export function validateDesignerDataWorkbooks(workbooks: DesignerDataWorkbookMap): DesignerDataValidationResult {
  const errors: DesignerDataValidationIssue[] = []
  const warnings: DesignerDataValidationIssue[] = []
  addMissingSheetAndHeaderIssues(workbooks, errors)

  const rows = collectSheetRows(workbooks)
  const areaIds = collectIds(errors, rows.stageAreas, WORKBOOK_NAMES.stageContent, '区域', 'areaId')
  const stageIds = collectIds(errors, rows.stages, WORKBOOK_NAMES.stageContent, '关卡', 'stageId')
  collectIds(errors, rows.challengeAreas, WORKBOOK_NAMES.challengeStageContent, '区域', 'areaId')
  collectIds(errors, rows.challengeStages, WORKBOOK_NAMES.challengeStageContent, '关卡', 'stageId')
  collectIds(errors, rows.challengeStages, WORKBOOK_NAMES.challengeStageContent, '关卡', 'challengeId')
  collectIds(errors, rows.challengeOpenings, WORKBOOK_NAMES.challengeEncounterBalance, '关卡开场', 'stageId')
  const affixIds = collectIds(errors, rows.affixDefinitions, WORKBOOK_NAMES.encounterBalance, '词缀定义', 'affixId')
  const specialRuleIds = collectIds(errors, rows.specialRuleDefinitions, WORKBOOK_NAMES.encounterBalance, '特殊规则定义', 'ruleId')
  const enemyIds = new Set([
    ...BUILTIN_IDS.enemies,
    ...collectIds(errors, rows.enemyDefinitions, WORKBOOK_NAMES.enemyData, '敌人定义', 'enemyId'),
  ])
  const enemySkillIds = new Set([
    ...BUILTIN_IDS.enemySkills,
    ...collectIds(errors, rows.enemySkills, WORKBOOK_NAMES.enemyData, '敌人技能', 'skillId'),
  ])
  const enemyStatusIds = new Set([
    ...BUILTIN_IDS.enemyStatuses,
    ...collectIds(errors, rows.enemyBuffs, WORKBOOK_NAMES.enemyData, '敌方Buff', 'statusId'),
    ...collectIds(errors, rows.playerDebuffs, WORKBOOK_NAMES.enemyData, '玩家Debuff', 'statusId'),
    ...collectIds(errors, rows.partyDebuffs, WORKBOOK_NAMES.enemyData, '队伍Debuff', 'statusId'),
  ])
  const classIds = new Set([
    ...BUILTIN_IDS.playerClasses,
    ...collectIds(errors, rows.playerClasses, WORKBOOK_NAMES.playerBuild, '职业定义', 'classId'),
  ])
  const buildRuleIds = new Set([
    ...BUILTIN_IDS.buildRules,
    ...collectIds(errors, rows.buildRules, WORKBOOK_NAMES.playerBuild, '构筑规则定义', 'buildRuleId'),
  ])
  const activeSkillIds = new Set([
    ...BUILTIN_IDS.activeSkills,
    ...collectIds(errors, rows.activeSkills, WORKBOOK_NAMES.playerBuild, '主动技能定义', 'skillId'),
  ])
  const activeStatusIds = collectIds(errors, rows.activeStatuses, WORKBOOK_NAMES.playerBuild, '玩家主动状态定义', 'statusId')
  for (const statusId of BUILTIN_IDS.playerStatuses) {
    activeStatusIds.add(statusId)
  }

  const passiveTalentIds = new Set([
    ...BUILTIN_IDS.passiveTalents,
    ...collectIds(errors, rows.passiveTalents, WORKBOOK_NAMES.playerBuild, '被动天赋定义', 'talentId'),
  ])
  const passiveStatusIds = collectIds(errors, rows.passiveStatuses, WORKBOOK_NAMES.playerBuild, '玩家被动状态定义', 'statusId')
  for (const statusId of BUILTIN_IDS.playerStatuses) {
    passiveStatusIds.add(statusId)
  }

  const iconIds = new Set([
    ...BUILTIN_IDS.icons,
    ...collectIds(errors, rows.icons, WORKBOOK_NAMES.playerBuild, '图标资源映射', 'iconId'),
    ...collectIds(errors, rows.enemyIcons, WORKBOOK_NAMES.enemyData, '图标资源映射', 'iconId'),
  ])
  const allPlayerStatusIds = new Set([...activeStatusIds, ...passiveStatusIds])
  const enemySkillAppliedStatusIds = new Set(
    rows.enemySkills.flatMap((row) => [
      ...parseCsv(row.appliedTargetStatusIdsCsv),
      ...parseCsv(row.appliedSelfStatusIdsCsv),
    ]),
  )
  const activeSkillClassById = new Map(
    rows.activeSkills.map((row) => [optionalText(row, 'skillId'), optionalText(row, 'classId')]),
  )

  addClassOwnershipIssues(errors, rows, classIds)
  addChallengeConsistencyIssues(errors, rows, classIds, buildRuleIds, activeSkillClassById)

  rows.stageAreas.forEach((row, index) => requireText(errors, WORKBOOK_NAMES.stageContent, '区域', row, index, 'areaId'))
  const stageOrdersByArea = new Map<string, Set<number>>()
  rows.stages.forEach((row, index) => {
    requireText(errors, WORKBOOK_NAMES.stageContent, '关卡', row, index, 'stageId')
    const areaId = requireText(errors, WORKBOOK_NAMES.stageContent, '关卡', row, index, 'areaId')
    validateReference(errors, WORKBOOK_NAMES.stageContent, '关卡', index, 'areaId', areaId, areaIds)
    const order = validateNumber(errors, WORKBOOK_NAMES.stageContent, '关卡', row, index, 'order', { required: true, min: 1, max: 6, integer: true })
    validateCsvReferences(errors, WORKBOOK_NAMES.stageContent, '关卡', row, index, 'unlockedActiveSkillIdsCsv', activeSkillIds)

    if (areaId && typeof order === 'number' && order >= 1 && order <= 6 && Number.isInteger(order)) {
      const orders = stageOrdersByArea.get(areaId) ?? new Set<number>()
      if (orders.has(order)) {
        errors.push(issue({
          workbook: WORKBOOK_NAMES.stageContent,
          sheet: '关卡',
          row: rowNumber(index),
          field: 'order',
          code: 'duplicate_id',
          value: `${areaId}:${order}`,
        }))
      }
      orders.add(order)
      stageOrdersByArea.set(areaId, orders)
    }
  })
  for (const areaId of areaIds) {
    const orders = stageOrdersByArea.get(areaId) ?? new Set<number>()
    for (let order = 1; order <= 6; order += 1) {
      if (!orders.has(order)) {
        errors.push(issue({
          workbook: WORKBOOK_NAMES.stageContent,
          sheet: '关卡',
          field: 'order',
          code: 'unknown_reference',
          value: `${areaId}:${order}`,
        }))
      }
    }
  }
  rows.legends.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.stageContent, '图例', index, 'areaId', requireText(errors, WORKBOOK_NAMES.stageContent, '图例', row, index, 'areaId'), areaIds)
    validateReference(errors, WORKBOOK_NAMES.stageContent, '图例', index, 'iconId', requireText(errors, WORKBOOK_NAMES.stageContent, '图例', row, index, 'iconId'), iconIds)
  })

  rows.openings.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '关卡开场', index, 'stageId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '关卡开场', row, index, 'stageId'), stageIds)
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '关卡开场', index, 'buildRuleId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '关卡开场', row, index, 'buildRuleId'), buildRuleIds)
    for (const field of [
      'playerHp',
      'playerMaxHp',
      'playerResource',
      'playerGcdRemainingMs',
      'partyHp',
      'partyMaxHp',
      'partyPressure',
      'partyMaxPressure',
    ]) {
      validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '关卡开场', row, index, field, { required: true })
    }
    for (const field of ['partyAutoDamageIntervalMs', 'partyAutoDamageTargetCount', 'partyAutoDamageMin', 'partyAutoDamageMax', 'playerAutoDamage', 'playerAutoHeal', 'partyAutoHeal']) {
      validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '关卡开场', row, index, field, { min: 0 })
    }
  })

  const spawnIdsByStage = new Map<string, Set<string>>()
  rows.placements.forEach((row, index) => {
    if (!optionalText(row, 'enemyId') && !optionalText(row, 'row') && !optionalText(row, 'col')) {
      return
    }

    const stageId = requireText(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'stageId')
    const spawnId = requireText(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'spawnId')
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', index, 'stageId', stageId, stageIds)
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', index, 'enemyId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'enemyId'), enemyIds)
    validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'row', { required: true, min: 1, max: 5, integer: true })
    validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'col', { required: true, min: 1, max: 5, integer: true })
    validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'openingCastSkillNum', { min: 1, integer: true })
    validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'openingTankThreat', { min: 0 })
    validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'openingAllyThreat', { min: 0 })
    validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '敌人布置', row, index, 'openingRecoveryRemainingMs', { min: 0 })

    if (stageId && spawnId) {
      const spawnIds = spawnIdsByStage.get(stageId) ?? new Set<string>()
      if (spawnIds.has(spawnId)) {
        errors.push(issue({
          workbook: WORKBOOK_NAMES.encounterBalance,
          sheet: '敌人布置',
          row: rowNumber(index),
          field: 'spawnId',
          code: 'duplicate_id',
          value: spawnId,
        }))
      }
      spawnIds.add(spawnId)
      spawnIdsByStage.set(stageId, spawnIds)
    }
  })

  rows.openingStatuses.forEach((row, index) => {
    const stageId = requireText(errors, WORKBOOK_NAMES.encounterBalance, '开场状态', row, index, 'stageId')
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '开场状态', index, 'stageId', stageId, stageIds)
    validateEnum(errors, WORKBOOK_NAMES.encounterBalance, '开场状态', row, index, 'targetType', ENUMS.openingStatusTargetType, { required: true })
    validateEnum(errors, WORKBOOK_NAMES.encounterBalance, '开场状态', row, index, 'sourceType', ENUMS.openingStatusSourceType, { required: true })
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '开场状态', index, 'statusId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '开场状态', row, index, 'statusId'), new Set([...enemyStatusIds, ...allPlayerStatusIds]))
    const targetId = optionalText(row, 'targetId')
    if (targetId && stageId) {
      validateReference(errors, WORKBOOK_NAMES.encounterBalance, '开场状态', index, 'targetId', targetId, spawnIdsByStage.get(stageId) ?? new Set())
    }
  })

  rows.affixBindings.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '关卡词缀绑定', index, 'stageId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '关卡词缀绑定', row, index, 'stageId'), stageIds)
    validateCsvReferences(errors, WORKBOOK_NAMES.encounterBalance, '关卡词缀绑定', row, index, 'affixIdsCsv', affixIds)
  })
  rows.affixDefinitions.forEach((row, index) => {
    validateEnum(errors, WORKBOOK_NAMES.encounterBalance, '词缀定义', row, index, 'targetType', ENUMS.affixTargetType, { required: true })
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '词缀定义', index, 'iconId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '词缀定义', row, index, 'iconId'), iconIds)
    requireText(errors, WORKBOOK_NAMES.encounterBalance, '词缀定义', row, index, 'targetSelector')
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '词缀定义', index, 'statusId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '词缀定义', row, index, 'statusId'), new Set([...enemyStatusIds, ...allPlayerStatusIds]))
    validateNumber(errors, WORKBOOK_NAMES.encounterBalance, '词缀定义', row, index, 'delayMs', { required: true, min: 0 })
    validateStructuredParameterFields(errors, WORKBOOK_NAMES.encounterBalance, 'affixDefinitions', row, index)
  })
  rows.specialRuleBindings.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '特殊规则绑定', index, 'stageId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '特殊规则绑定', row, index, 'stageId'), stageIds)
    validateCsvReferences(errors, WORKBOOK_NAMES.encounterBalance, '特殊规则绑定', row, index, 'ruleIdsCsv', specialRuleIds)
  })
  rows.specialRuleDefinitions.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.encounterBalance, '特殊规则定义', index, 'iconId', requireText(errors, WORKBOOK_NAMES.encounterBalance, '特殊规则定义', row, index, 'iconId'), iconIds)
    const ruleLogicId = requireText(errors, WORKBOOK_NAMES.encounterBalance, '特殊规则定义', row, index, 'ruleLogicId')
    validateCsvReferences(errors, WORKBOOK_NAMES.encounterBalance, '特殊规则定义', row, index, 'grantedStatusIdsCsv', new Set([...enemyStatusIds, ...allPlayerStatusIds]))
    validateStructuredParameterFields(errors, WORKBOOK_NAMES.encounterBalance, 'specialRuleDefinitions', row, index)
    validateRequiredStructuredParameters(
      errors,
      WORKBOOK_NAMES.encounterBalance,
      '特殊规则定义',
      row,
      index,
      ruleLogicId,
      SPECIAL_RULE_PARAMETER_REQUIREMENTS,
    )
  })

  rows.enemyDefinitions.forEach((row, index) => {
    const hasAnySkills = Boolean(optionalText(row, 'skillIdsCsv') || optionalText(row, 'skillCycleCsv'))
    validateCsvReferences(errors, WORKBOOK_NAMES.enemyData, '敌人定义', row, index, 'skillIdsCsv', enemySkillIds)
    validateCsvReferences(errors, WORKBOOK_NAMES.enemyData, '敌人定义', row, index, 'skillCycleCsv', enemySkillIds)
    validateEnum(errors, WORKBOOK_NAMES.enemyData, '敌人定义', row, index, 'threatLogic', ENUMS.enemyThreatLogic, { required: hasAnySkills })
    validateNumber(errors, WORKBOOK_NAMES.enemyData, '敌人定义', row, index, 'baseMaxHp', { required: true, min: 1 })
  })
  rows.enemySkills.forEach((row, index) => {
    validateEnum(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'targetRuleId', ENUMS.enemyTargetRuleId, { required: true })
    validateEnum(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'damageType', ENUMS.damageType, { required: true })
    validateEnum(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'castBreakRule', ENUMS.castBreakRule, { required: true })
    validateEnum(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'dangerLevel', ENUMS.dangerLevel)
    validateCsvReferences(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'appliedTargetStatusIdsCsv', enemyStatusIds)
    validateCsvReferences(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'appliedSelfStatusIdsCsv', enemyStatusIds)
    const castTimeMs = validateNumber(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'castTimeMs', { required: true, min: 0 })
    const channelingMs = validateNumber(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'channelingMs', { min: 0 })
    validateNumber(errors, WORKBOOK_NAMES.enemyData, '敌人技能', row, index, 'recoveryMs', { required: true, min: 0 })

    const castBreakRule = optionalText(row, 'castBreakRule')
    if (
      castBreakRule &&
      castBreakRule !== 'unstoppable' &&
      typeof castTimeMs === 'number' &&
      (typeof channelingMs === 'number' || !optionalText(row, 'channelingMs')) &&
      castTimeMs + (channelingMs ?? 0) <= 0
    ) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.enemyData,
        '敌人技能',
        index,
        'castBreakRule',
        `${castBreakRule} requires castTimeMs or channelingMs`,
      )
    }
  })
  for (const [sheet, statusRows] of [
    ['敌方Buff', rows.enemyBuffs],
    ['玩家Debuff', rows.playerDebuffs],
    ['队伍Debuff', rows.partyDebuffs],
  ] as const) {
    statusRows.forEach((row, index) => {
      const statusId = optionalText(row, 'statusId')
      validateReference(
        errors,
        WORKBOOK_NAMES.enemyData,
        sheet,
        index,
        'iconId',
        requireText(errors, WORKBOOK_NAMES.enemyData, sheet, row, index, 'iconId'),
        iconIds,
      )
      const durationMs = validateNumber(errors, WORKBOOK_NAMES.enemyData, sheet, row, index, 'durationMs', { min: -1 })
      const effectLogicId = optionalText(row, 'effectLogicId')
      validateRequiredStructuredParameters(
        errors,
        WORKBOOK_NAMES.enemyData,
        sheet,
        row,
        index,
        effectLogicId,
        STATUS_EFFECT_PARAMETER_REQUIREMENTS,
      )
      if (
        statusId &&
        enemySkillAppliedStatusIds.has(statusId) &&
        durationMs === 0 &&
        (!effectLogicId || effectLogicId === 'none')
      ) {
        addInvalidCombinationIssue(
          errors,
          WORKBOOK_NAMES.enemyData,
          sheet,
          index,
          'durationMs',
          'status used by enemy skill requires durationMs',
        )
      }
      validateStructuredParameterFields(errors, WORKBOOK_NAMES.enemyData, sheet, row, index)
    })
  }

  rows.playerClasses.forEach((row, index) => {
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '职业定义', row, index, 'roleTag', ENUMS.roleTag, { required: true })
    validateCsvReferences(errors, WORKBOOK_NAMES.playerBuild, '职业定义', row, index, 'recommendedBuildRuleIdsCsv', buildRuleIds)
  })
  rows.buildRules.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', index, 'classId', optionalText(row, 'classId'), classIds)
    validateCsvEnum(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'enabledHotkeysCsv', ENUMS.skillHotkey)
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'inheritancePolicy', ENUMS.inheritancePolicy, { required: true })
    validateNumber(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'totalBuildPoints', { required: true, min: 0 })
    validateNumber(errors, WORKBOOK_NAMES.playerBuild, '构筑规则定义', row, index, 'maxActiveSlots', { required: true, min: 0, max: 8, integer: true })
  })
  rows.activeSkills.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', index, 'classId', requireText(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', row, index, 'classId'), classIds)
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', index, 'iconId', requireText(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', row, index, 'iconId'), iconIds)
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', row, index, 'targetingType', ENUMS.activeTargetingType, { required: true })
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', row, index, 'castStopMode', ENUMS.castStopMode, { required: true })
    for (const field of ['pointCost', 'resourceCost', 'cooldownMs', 'gcdMs']) {
      validateNumber(errors, WORKBOOK_NAMES.playerBuild, '主动技能定义', row, index, field, { required: true, min: 0 })
    }
  })
  rows.activeSkillEffects.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '主动技能效果', index, 'skillId', requireText(errors, WORKBOOK_NAMES.playerBuild, '主动技能效果', row, index, 'skillId'), activeSkillIds)
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '主动技能效果', row, index, 'targetSelector', ENUMS.activeTargetSelector)
    const statusId = optionalText(row, 'statusId')
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '主动技能效果', index, 'statusId', statusId, allPlayerStatusIds)
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '主动技能效果', row, index, 'threatSource', ENUMS.threatSource)
    const durationMs = validateNumber(errors, WORKBOOK_NAMES.playerBuild, '主动技能效果', row, index, 'durationMs', { min: 0 })
    if (
      statusId &&
      (durationMs ?? 0) <= 0
    ) {
      addInvalidCombinationIssue(
        errors,
        WORKBOOK_NAMES.playerBuild,
        '主动技能效果',
        index,
        'durationMs',
        'status effect requires positive durationMs',
      )
    }
  })
  rows.activeStatuses.forEach((row, index) => {
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '玩家主动状态定义', row, index, 'statusCategory', ENUMS.playerStatusCategory, { required: true })
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '玩家主动状态定义', index, 'iconId', requireText(errors, WORKBOOK_NAMES.playerBuild, '玩家主动状态定义', row, index, 'iconId'), iconIds)
    validateNumber(errors, WORKBOOK_NAMES.playerBuild, '玩家主动状态定义', row, index, 'durationMs', { required: true, min: -1 })
    validateRequiredStructuredParameters(
      errors,
      WORKBOOK_NAMES.playerBuild,
      '玩家主动状态定义',
      row,
      index,
      optionalText(row, 'effectLogicId'),
      STATUS_EFFECT_PARAMETER_REQUIREMENTS,
    )
  })
  rows.passiveTalents.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', index, 'classId', requireText(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', row, index, 'classId'), classIds)
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', index, 'iconId', requireText(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', row, index, 'iconId'), iconIds)
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', row, index, 'category', ENUMS.talentCategory, { required: true })
    validateNumber(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', row, index, 'tier', { required: true, min: 0, integer: true })
    validateCsvReferences(errors, WORKBOOK_NAMES.playerBuild, '被动天赋定义', row, index, 'grantedStatusIdsCsv', allPlayerStatusIds)
  })
  rows.passiveTalentEffects.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '被动天赋效果', index, 'talentId', requireText(errors, WORKBOOK_NAMES.playerBuild, '被动天赋效果', row, index, 'talentId'), passiveTalentIds)
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '被动天赋效果', row, index, 'targetScope', ENUMS.talentTargetScope)
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '被动天赋效果', index, 'statusId', optionalText(row, 'statusId'), allPlayerStatusIds)
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '被动天赋效果', index, 'skillId', optionalText(row, 'skillId'), activeSkillIds)
  })
  rows.passiveStatuses.forEach((row, index) => {
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '玩家被动状态定义', row, index, 'statusCategory', ENUMS.playerStatusCategory, { required: true })
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '玩家被动状态定义', index, 'iconId', requireText(errors, WORKBOOK_NAMES.playerBuild, '玩家被动状态定义', row, index, 'iconId'), iconIds)
    validateNumber(errors, WORKBOOK_NAMES.playerBuild, '玩家被动状态定义', row, index, 'durationMs', { required: true, min: -1 })
    validateRequiredStructuredParameters(
      errors,
      WORKBOOK_NAMES.playerBuild,
      '玩家被动状态定义',
      row,
      index,
      optionalText(row, 'effectLogicId'),
      STATUS_EFFECT_PARAMETER_REQUIREMENTS,
    )
  })
  rows.defaultActiveBuilds.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '默认主动构筑', index, 'buildRuleId', optionalText(row, 'buildRuleId'), buildRuleIds)
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '默认主动构筑', index, 'classId', optionalText(row, 'classId'), classIds)
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '默认主动构筑', row, index, 'hotkey', ENUMS.skillHotkey, { required: true })
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '默认主动构筑', index, 'skillId', optionalText(row, 'skillId'), activeSkillIds)
  })
  rows.defaultPassiveBuilds.forEach((row, index) => {
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '默认被动构筑', index, 'buildRuleId', optionalText(row, 'buildRuleId'), buildRuleIds)
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '默认被动构筑', index, 'classId', optionalText(row, 'classId'), classIds)
    validateReference(errors, WORKBOOK_NAMES.playerBuild, '默认被动构筑', index, 'talentId', requireText(errors, WORKBOOK_NAMES.playerBuild, '默认被动构筑', row, index, 'talentId'), passiveTalentIds)
  })
  rows.icons.forEach((row, index) => {
    validateEnum(errors, WORKBOOK_NAMES.playerBuild, '图标资源映射', row, index, 'iconType', ENUMS.iconType, { required: true })
  })
  rows.enemyIcons.forEach((row, index) => {
    validateEnum(errors, WORKBOOK_NAMES.enemyData, '图标资源映射', row, index, 'iconType', ENUMS.iconType, { required: true })
  })

  addStageCoverageWarnings(warnings, rows)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: buildValidationSummary(rows, errors, warnings),
  }
}
