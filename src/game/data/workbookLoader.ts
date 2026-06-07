import * as XLSX from 'xlsx'
import {
  applyEncounterWorkbookOverrides,
  type EncounterEnemyPlacement,
  type EncounterOpeningConfig,
  type EncounterOpeningStatusEntry,
  type EncounterWorkbookOverrides,
} from './encounterTemplates'
import {
  applyEnemyWorkbookOverrides,
  type EnemyDefinitionWorkbookOverride,
  type EnemySkillTargetRuleId,
  type EnemyThreatLogic,
  type EnemySkillWorkbookOverride,
  type EnemyStatusWorkbookOverride,
  type EnemyWorkbookOverrides,
} from './enemyCatalog'
import {
  applyPlayerBuildWorkbookOverrides,
  type PlayerBuildWorkbookOverrides,
} from './playerBuildCatalog'
import {
  applyStageWorkbookOverrides,
  type StageAreaId,
  type StageAreaWorkbookOverride,
  type StageId,
  type StageLegendWorkbookOverride,
  type StageWorkbookOverride,
  type StageWorkbookOverrides,
} from './stageTemplates'
import type {
  BuildIconDefinition,
  DangerLevel,
  EnemyCastBreakRule,
  EncounterAffixDefinition,
  EncounterSpecialRuleDefinition,
  PlayerCastStopMode,
  SkillHotkey,
} from '../encounter/encounterTypes'

const DESIGNER_DATA_BASE_URL = '/designer-data'
const STAGE_WORKBOOK_PATH = `${DESIGNER_DATA_BASE_URL}/stage_content.xlsx`
const ENCOUNTER_WORKBOOK_PATH = `${DESIGNER_DATA_BASE_URL}/encounter_balance.xlsx`
const ENEMY_WORKBOOK_PATH = `${DESIGNER_DATA_BASE_URL}/enemy_data.xlsx`
const PLAYER_BUILD_WORKBOOK_PATH = `${DESIGNER_DATA_BASE_URL}/player_build.xlsx`
const DESKTOP_DATA_PACK_FILES = [
  'stage_content.xlsx',
  'encounter_balance.xlsx',
  'enemy_data.xlsx',
  'player_build.xlsx',
] as const

type CellValue = string | number | boolean | null | undefined
type SheetRow = Record<string, CellValue>
type DesktopDataPackFileName = typeof DESKTOP_DATA_PACK_FILES[number]
type DesktopDataPackFile = {
  name: DesktopDataPackFileName
  bytesBase64: string
}

function isDesktopRuntime() {
  return Boolean((globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

function decodeBase64Workbook(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function readDesktopDataPackFile(fileName: DesktopDataPackFileName) {
  const { invoke } = await import('@tauri-apps/api/core')
  const result = await invoke<DesktopDataPackFile>('read_desktop_data_file', { fileName })
  if (!result || result.name !== fileName) {
    throw new Error(`Unexpected desktop data response for ${fileName}`)
  }

  return XLSX.read(decodeBase64Workbook(result.bytesBase64), { type: 'array' })
}

function normalizeText(value: CellValue) {
  return String(value ?? '').trim()
}

function readOptionalText(value: CellValue) {
  const text = normalizeText(value)
  return text === '' ? undefined : text
}

function readRequiredText(value: CellValue) {
  const text = normalizeText(value)
  return text === '' ? null : text
}

function readOptionalNumber(value: CellValue) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  const text = normalizeText(value)
  if (text === '') {
    return undefined
  }

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readOptionalBoolean(value: CellValue) {
  if (typeof value === 'boolean') {
    return value
  }

  const text = normalizeText(value).toLowerCase()
  if (text === '') {
    return undefined
  }

  if (['true', '1', 'yes', 'y', '是'].includes(text)) {
    return true
  }

  if (['false', '0', 'no', 'n', '否'].includes(text)) {
    return false
  }

  return undefined
}

function normalizePassiveTalentCategory(value: CellValue) {
  const category = readOptionalText(value)
  if (category === 'team') {
    return 'party'
  }

  return category
}

function parseCsvList<T extends string>(value: CellValue) {
  const text = normalizeText(value)
  if (!text) {
    return []
  }

  return text
    .split(/[，,]/)
    .map((entry) => entry.trim())
    .filter(Boolean) as T[]
}

function readSheetRows<T extends SheetRow>(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return [] as T[]
  }

  return XLSX.utils.sheet_to_json<T>(sheet, {
    defval: '',
    raw: false,
  })
}

async function fetchWorkbook(path: string) {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`无法读取工作簿 ${path}`)
  }

  const buffer = await response.arrayBuffer()
  return XLSX.read(buffer, { type: 'array' })
}

export function resolveDesignerDataSource(useDesktopRuntimeFlag = isDesktopRuntime()) {
  return useDesktopRuntimeFlag ? 'desktop' : 'web'
}

export function parseStageWorkbook(workbook: XLSX.WorkBook): StageWorkbookOverrides {
  const areaRows = readSheetRows<SheetRow>(workbook, '区域')
  const stageRows = readSheetRows<SheetRow>(workbook, '关卡')
  const legendRows = readSheetRows<SheetRow>(workbook, '图例')

  const areaOverrides: StageAreaWorkbookOverride[] = []
  for (const row of areaRows) {
    const areaId = readRequiredText(row.areaId) as StageAreaId | null
    if (!areaId) {
      continue
    }

    areaOverrides.push({
      areaId,
      title: readOptionalText(row.title),
      shortTitle: readOptionalText(row.shortTitle),
      mapLabel: readOptionalText(row.mapLabel),
      description: readOptionalText(row.description),
      accent: readOptionalText(row.accent),
    })
  }

  const stageOverrides: StageWorkbookOverride[] = []
  for (const row of stageRows) {
    const stageId = readRequiredText(row.stageId) as StageId | null
    if (!stageId) {
      continue
    }

    stageOverrides.push({
      stageId,
      areaId: readOptionalText(row.areaId) as StageAreaId | undefined,
      order: readOptionalNumber(row.order) as StageWorkbookOverride['order'],
      title: readOptionalText(row.title),
      subtitle: readOptionalText(row.subtitle),
      strategyTips: readOptionalText(row.strategyTips),
      affix1Title: readOptionalText(row.affix1Title),
      affix1Description: readOptionalText(row.affix1Description),
      affix1IconId: readOptionalText(row.affix1IconId),
      affix2Title: readOptionalText(row.affix2Title),
      affix2Description: readOptionalText(row.affix2Description),
      affix2IconId: readOptionalText(row.affix2IconId),
      rule1Title: readOptionalText(row.rule1Title),
      rule1Description: readOptionalText(row.rule1Description),
      rule1IconId: readOptionalText(row.rule1IconId),
      rule2Title: readOptionalText(row.rule2Title),
      rule2Description: readOptionalText(row.rule2Description),
      rule2IconId: readOptionalText(row.rule2IconId),
      unlockedActiveSkillIds: parseCsvList<string>(row.unlockedActiveSkillIdsCsv),
    })
  }

  const legendOverrides: StageLegendWorkbookOverride[] = []
  for (const row of legendRows) {
    const areaId = readRequiredText(row.areaId) as StageAreaId | null
    const id = readRequiredText(row.id)
    if (!areaId || !id) {
      continue
    }

    legendOverrides.push({
      areaId,
      id,
      iconId: readOptionalText(row.iconId),
      label: readOptionalText(row.label),
      source: readOptionalText(row.source),
      target: readOptionalText(row.target),
      description: readOptionalText(row.description),
    })
  }

  return {
    areaOverrides,
    stageOverrides,
    legendOverrides,
  }
}

export function parseEncounterWorkbook(workbook: XLSX.WorkBook): EncounterWorkbookOverrides {
  const openingRows = readSheetRows<SheetRow>(workbook, '关卡开场')
  const placementRows = readSheetRows<SheetRow>(workbook, '敌人布置')
  const openingStatusRows = readSheetRows<SheetRow>(workbook, '开场状态')
  const affixBindingRows = readSheetRows<SheetRow>(workbook, '关卡词缀绑定')
  const affixDefinitionRows = readSheetRows<SheetRow>(workbook, '词缀定义')
  const specialRuleBindingRows = readSheetRows<SheetRow>(workbook, '特殊规则绑定')
  const specialRuleDefinitionRows = readSheetRows<SheetRow>(workbook, '特殊规则定义')

  const openingOverrides: Partial<Record<StageId, Partial<EncounterOpeningConfig>>> = {}
  for (const row of openingRows) {
    const stageId = readRequiredText(row.stageId) as StageId | null
    if (!stageId) {
      continue
    }

    openingOverrides[stageId] = {
      ...(typeof readOptionalNumber(row.playerHp) === 'number' ? { playerHp: readOptionalNumber(row.playerHp)! } : {}),
      ...(typeof readOptionalNumber(row.playerMaxHp) === 'number'
        ? { playerMaxHp: readOptionalNumber(row.playerMaxHp)! }
        : {}),
      ...(typeof readOptionalNumber(row.playerResource) === 'number'
        ? { playerResource: readOptionalNumber(row.playerResource)! }
        : {}),
      ...(typeof readOptionalNumber(row.playerGcdRemainingMs) === 'number'
        ? { playerGcdRemainingMs: readOptionalNumber(row.playerGcdRemainingMs)! }
        : {}),
      ...(typeof readOptionalNumber(row.partyHp) === 'number' ? { partyHp: readOptionalNumber(row.partyHp)! } : {}),
      ...(typeof readOptionalNumber(row.partyMaxHp) === 'number' ? { partyMaxHp: readOptionalNumber(row.partyMaxHp)! } : {}),
      ...(typeof readOptionalNumber(row.partyPressure) === 'number'
        ? { partyPressure: readOptionalNumber(row.partyPressure)! }
        : {}),
      ...(typeof readOptionalNumber(row.partyMaxPressure) === 'number'
        ? { partyMaxPressure: readOptionalNumber(row.partyMaxPressure)! }
        : {}),
      ...(readOptionalText(row.buildRuleId) ? { buildRuleId: readOptionalText(row.buildRuleId)! } : {}),
      ...(typeof readOptionalNumber(row.partyAutoDamageIntervalMs) === 'number'
        ? { partyAutoDamageIntervalMs: readOptionalNumber(row.partyAutoDamageIntervalMs)! }
        : {}),
      ...(typeof readOptionalNumber(row.partyAutoDamageTargetCount) === 'number'
        ? { partyAutoDamageTargetCount: readOptionalNumber(row.partyAutoDamageTargetCount)! }
        : {}),
      ...(typeof readOptionalNumber(row.partyAutoDamageMin) === 'number'
        ? { partyAutoDamageMin: readOptionalNumber(row.partyAutoDamageMin)! }
        : {}),
      ...(typeof readOptionalNumber(row.partyAutoDamageMax) === 'number'
        ? { partyAutoDamageMax: readOptionalNumber(row.partyAutoDamageMax)! }
        : {}),
      ...(typeof readOptionalNumber(row.playerAutoDamage) === 'number'
        ? { playerAutoDamage: readOptionalNumber(row.playerAutoDamage)! }
        : {}),
      ...(typeof readOptionalNumber(row.playerAutoHeal) === 'number'
        ? { playerAutoHeal: readOptionalNumber(row.playerAutoHeal)! }
        : {}),
      ...(typeof readOptionalNumber(row.partyAutoHeal) === 'number'
        ? { partyAutoHeal: readOptionalNumber(row.partyAutoHeal)! }
        : {}),
    }
  }

  const placementOverrides: Partial<Record<StageId, EncounterEnemyPlacement[]>> = {}
  for (const row of placementRows) {
    const stageId = readRequiredText(row.stageId) as StageId | null
    const spawnId = readRequiredText(row.spawnId)
    const enemyId = readRequiredText(row.enemyId)
    const rowNumber = readOptionalNumber(row.row)
    const colNumber = readOptionalNumber(row.col)

    if (!stageId || !spawnId || !enemyId || typeof rowNumber !== 'number' || typeof colNumber !== 'number') {
      continue
    }

    const placement: EncounterEnemyPlacement = {
      stageId,
      spawnId,
      enemyId,
      row: rowNumber,
      col: colNumber,
      ...(readOptionalText(row.nameOverride) ? { nameOverride: readOptionalText(row.nameOverride)! } : {}),
      ...(typeof readOptionalNumber(row.hpOverride) === 'number'
        ? { hpOverride: readOptionalNumber(row.hpOverride)! }
        : {}),
      ...(typeof readOptionalNumber(row.maxHpOverride) === 'number'
        ? { maxHpOverride: readOptionalNumber(row.maxHpOverride)! }
        : {}),
      ...(typeof readOptionalNumber(row.openingCastSkillNum) === 'number'
        ? { openingCastSkillNum: readOptionalNumber(row.openingCastSkillNum)! }
        : {}),
      ...(typeof readOptionalNumber(row.openingTankThreat) === 'number'
        ? { openingTankThreat: readOptionalNumber(row.openingTankThreat)! }
        : {}),
      ...(typeof readOptionalNumber(row.openingAllyThreat) === 'number'
        ? { openingAllyThreat: readOptionalNumber(row.openingAllyThreat)! }
        : {}),
      ...(typeof readOptionalNumber(row.openingRecoveryRemainingMs) === 'number'
        ? { openingRecoveryRemainingMs: readOptionalNumber(row.openingRecoveryRemainingMs)! }
        : {}),
    }

    placementOverrides[stageId] = [...(placementOverrides[stageId] ?? []), placement]
  }

  const openingStatusOverrides: Partial<Record<StageId, EncounterOpeningStatusEntry[]>> = {}
  for (const row of openingStatusRows) {
    const stageId = readRequiredText(row.stageId) as StageId | null
    const targetType = readRequiredText(row.targetType) as EncounterOpeningStatusEntry['targetType'] | null
    const statusId = readRequiredText(row.statusId)
    const sourceType = readRequiredText(row.sourceType) as EncounterOpeningStatusEntry['sourceType'] | null

    if (!stageId || !targetType || !statusId || !sourceType) {
      continue
    }

    const entry: EncounterOpeningStatusEntry = {
      stageId,
      targetType,
      statusId,
      sourceType,
      ...(readOptionalText(row.targetId) ? { targetId: readOptionalText(row.targetId)! } : {}),
      ...(typeof readOptionalNumber(row.durationMsOverride) === 'number'
        ? { durationMsOverride: readOptionalNumber(row.durationMsOverride)! }
        : {}),
      ...(typeof readOptionalNumber(row.stacks) === 'number' ? { stacks: readOptionalNumber(row.stacks)! } : {}),
      ...(readOptionalText(row.sourceId) ? { sourceId: readOptionalText(row.sourceId)! } : {}),
    }

    openingStatusOverrides[stageId] = [...(openingStatusOverrides[stageId] ?? []), entry]
  }

  const affixBindings: Partial<Record<StageId, string[]>> = {}
  for (const row of affixBindingRows) {
    const stageId = readRequiredText(row.stageId) as StageId | null
    if (!stageId) {
      continue
    }

    affixBindings[stageId] = parseCsvList<string>(row.affixIdsCsv)
  }

  const affixDefinitions: Record<string, EncounterAffixDefinition> = {}
  for (const row of affixDefinitionRows) {
    const affixId = readRequiredText(row.affixId)
    const affixName = readRequiredText(row.affixName)
    const iconId = readRequiredText(row.iconId)
    const description = readRequiredText(row.description)
    const delayMs = readOptionalNumber(row.delayMs)
    const targetType = readRequiredText(row.targetType) as EncounterAffixDefinition['targetType'] | null
    const targetSelector = readRequiredText(row.targetSelector)
    const statusId = readRequiredText(row.statusId)

    if (
      !affixId ||
      !affixName ||
      !iconId ||
      !description ||
      typeof delayMs !== 'number' ||
      !targetType ||
      !targetSelector ||
      !statusId
    ) {
      continue
    }

    affixDefinitions[affixId] = {
      affixId,
      affixName,
      iconId,
      description,
      delayMs,
      targetType,
      targetSelector,
      statusId,
      ...(typeof readOptionalNumber(row.durationMsOverride) === 'number'
        ? { durationMsOverride: readOptionalNumber(row.durationMsOverride)! }
        : {}),
      ...(typeof readOptionalNumber(row.valueA) === 'number' ? { valueA: readOptionalNumber(row.valueA)! } : {}),
      ...(typeof readOptionalNumber(row.valueB) === 'number' ? { valueB: readOptionalNumber(row.valueB)! } : {}),
      ...(typeof readOptionalNumber(row.tickIntervalMs) === 'number'
        ? { tickIntervalMs: readOptionalNumber(row.tickIntervalMs)! }
        : {}),
      stacks: readOptionalNumber(row.stacks) ?? 1,
      enabled: readOptionalBoolean(row.enabled) ?? true,
    }
  }

  const specialRuleBindings: Partial<Record<StageId, string[]>> = {}
  for (const row of specialRuleBindingRows) {
    const stageId = readRequiredText(row.stageId) as StageId | null
    if (!stageId) {
      continue
    }

    specialRuleBindings[stageId] = parseCsvList<string>(row.ruleIdsCsv)
  }

  const specialRuleDefinitions: Record<string, EncounterSpecialRuleDefinition> = {}
  for (const row of specialRuleDefinitionRows) {
    const ruleId = readRequiredText(row.ruleId)
    const ruleName = readRequiredText(row.ruleName)
    const iconId = readRequiredText(row.iconId)
    const description = readRequiredText(row.description)
    const ruleLogicId = readRequiredText(row.ruleLogicId)

    if (!ruleId || !ruleName || !iconId || !description || !ruleLogicId) {
      continue
    }

    specialRuleDefinitions[ruleId] = {
      ruleId,
      ruleName,
      iconId,
      description,
      ruleLogicId,
      grantedStatusIds: parseCsvList<string>(row.grantedStatusIdsCsv),
      ...(typeof readOptionalNumber(row.valueA) === 'number' ? { valueA: readOptionalNumber(row.valueA)! } : {}),
      ...(typeof readOptionalNumber(row.valueB) === 'number' ? { valueB: readOptionalNumber(row.valueB)! } : {}),
      ...(typeof readOptionalNumber(row.tickIntervalMs) === 'number'
        ? { tickIntervalMs: readOptionalNumber(row.tickIntervalMs)! }
        : {}),
      enabled: readOptionalBoolean(row.enabled) ?? true,
    }
  }

  return {
    openingOverrides,
    placementOverrides,
    openingStatusOverrides,
    affixBindings,
    affixDefinitions,
    specialRuleBindings,
    specialRuleDefinitions,
  }
}

function parseIconDefinitions(workbook: XLSX.WorkBook) {
  const iconRows = readSheetRows<SheetRow>(workbook, '图标资源映射')

  return iconRows.flatMap((row) => {
    const iconId = readRequiredText(row.iconId)
    const iconName = readRequiredText(row.iconName)
    const assetKey = readRequiredText(row.assetKey)
    const iconType = readRequiredText(row.iconType) as BuildIconDefinition['iconType'] | null
    if (!iconId || !iconName || !assetKey || !iconType) {
      return []
    }

    return [{
      iconId,
      iconName,
      assetKey,
      iconType,
      enabled: readOptionalBoolean(row.enabled) ?? true,
    }]
  })
}

function parseStatusSheet(workbook: XLSX.WorkBook, sheetName: string) {
  const rows = readSheetRows<SheetRow>(workbook, sheetName)
  const definitions: EnemyStatusWorkbookOverride[] = []

  for (const row of rows) {
    const statusId = readRequiredText(row.statusId)
    if (!statusId) {
      continue
    }

    definitions.push({
      statusId,
      statusName: readOptionalText(row.statusName),
      iconId: readOptionalText(row.iconId),
      durationMs: readOptionalNumber(row.durationMs),
      isDispellable: readOptionalBoolean(row.isDispellable),
      description: readOptionalText(row.description),
      effectLogicId: readOptionalText(row.effectLogicId),
      ...(typeof readOptionalNumber(row.valueA) === 'number' ? { valueA: readOptionalNumber(row.valueA)! } : {}),
      ...(typeof readOptionalNumber(row.valueB) === 'number' ? { valueB: readOptionalNumber(row.valueB)! } : {}),
      ...(typeof readOptionalNumber(row.tickIntervalMs) === 'number'
        ? { tickIntervalMs: readOptionalNumber(row.tickIntervalMs)! }
        : {}),
    })
  }

  return definitions
}

export function parseEnemyWorkbook(workbook: XLSX.WorkBook): EnemyWorkbookOverrides {
  const enemyRows = readSheetRows<SheetRow>(workbook, '敌人定义')
  const skillRows = readSheetRows<SheetRow>(workbook, '敌人技能')

  const enemyDefinitions: EnemyDefinitionWorkbookOverride[] = []
  for (const row of enemyRows) {
    const enemyId = readRequiredText(row.enemyId)
    if (!enemyId) {
      continue
    }

    enemyDefinitions.push({
      enemyId,
      name: readOptionalText(row.name),
      baseMaxHp: readOptionalNumber(row.baseMaxHp),
      skillIds: parseCsvList<string>(row.skillIdsCsv),
      skillNames: parseCsvList<string>(row.skillNamesCsv),
      skillCycle: parseCsvList<string>(row.skillCycleCsv),
      threatLogic: readOptionalText(row.threatLogic) as EnemyThreatLogic | undefined,
      counteredDurationMs: readOptionalNumber(row.counteredDurationMs),
      isSkull: readOptionalBoolean(row.isSkull),
    })
  }

  const skillDefinitions: EnemySkillWorkbookOverride[] = []
  for (const row of skillRows) {
    const skillId = readRequiredText(row.skillId)
    if (!skillId) {
      continue
    }

    skillDefinitions.push({
      skillId,
      skillName: readOptionalText(row.skillName),
      targetRuleId: readOptionalText(row.targetRuleId) as EnemySkillTargetRuleId | undefined,
      castTimeMs: readOptionalNumber(row.castTimeMs),
      channelingMs: readOptionalNumber(row.channelingMs),
      recoveryMs: readOptionalNumber(row.recoveryMs),
      damageType: readOptionalText(row.damageType) as EnemySkillWorkbookOverride['damageType'],
      playerDamage: readOptionalNumber(row.playerDamage),
      partyDamageOnHit: readOptionalNumber(row.partyDamageOnHit),
      partyDamageOnMiss: readOptionalNumber(row.partyDamageOnMiss),
      pressureOnHit: readOptionalNumber(row.pressureOnHit),
      pressureOnMiss: readOptionalNumber(row.pressureOnMiss),
      appliedTargetStatusIds: parseCsvList<string>(row.appliedTargetStatusIdsCsv),
      appliedSelfStatusIds: parseCsvList<string>(row.appliedSelfStatusIdsCsv),
      castBreakRule: readOptionalText(row.castBreakRule) as EnemyCastBreakRule | undefined,
      dangerLevel: readOptionalText(row.dangerLevel) as DangerLevel | undefined,
    })
  }

  return {
    enemyDefinitions,
    skillDefinitions,
    enemyBuffDefinitions: parseStatusSheet(workbook, '敌方Buff'),
    playerDebuffDefinitions: parseStatusSheet(workbook, '玩家Debuff'),
    partyDebuffDefinitions: parseStatusSheet(workbook, '队伍Debuff'),
    iconDefinitions: parseIconDefinitions(workbook),
  }
}

export function parsePlayerBuildWorkbook(workbook: XLSX.WorkBook): PlayerBuildWorkbookOverrides {
  const classRows = readSheetRows<SheetRow>(workbook, '职业定义')
  const buildRuleRows = readSheetRows<SheetRow>(workbook, '构筑规则定义')
  const activeSkillRows = readSheetRows<SheetRow>(workbook, '主动技能定义')
  const activeSkillEffectRows = readSheetRows<SheetRow>(workbook, '主动技能效果')
  const activeStatusRows = readSheetRows<SheetRow>(workbook, '玩家主动状态定义')
  const passiveTalentRows = readSheetRows<SheetRow>(workbook, '被动天赋定义')
  const passiveTalentEffectRows = readSheetRows<SheetRow>(workbook, '被动天赋效果')
  const passiveStatusRows = readSheetRows<SheetRow>(workbook, '玩家被动状态定义')
  const defaultActiveRows = readSheetRows<SheetRow>(workbook, '默认主动构筑')
  const defaultPassiveRows = readSheetRows<SheetRow>(workbook, '默认被动构筑')

  return {
    classDefinitions: classRows.flatMap((row) => {
      const classId = readRequiredText(row.classId)
      if (!classId) {
        return []
      }

      return [{
        classId,
        className: readOptionalText(row.className),
        roleTag: readOptionalText(row.roleTag) as PlayerBuildWorkbookOverrides['classDefinitions'][number]['roleTag'],
        classDescription: readOptionalText(row.classDescription),
        recommendedBuildRuleIds: parseCsvList<string>(row.recommendedBuildRuleIdsCsv),
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    buildRuleDefinitions: buildRuleRows.flatMap((row) => {
      const buildRuleId = readRequiredText(row.buildRuleId)
      if (!buildRuleId) {
        return []
      }

      return [{
        buildRuleId,
        classId: readOptionalText(row.classId),
        ruleName: readOptionalText(row.ruleName),
        description: readOptionalText(row.description),
        totalBuildPoints: readOptionalNumber(row.totalBuildPoints),
        maxActiveSlots: readOptionalNumber(row.maxActiveSlots),
        enabledHotkeys: parseCsvList<string>(row.enabledHotkeysCsv) as SkillHotkey[],
        inheritancePolicy: readOptionalText(row.inheritancePolicy) as PlayerBuildWorkbookOverrides['buildRuleDefinitions'][number]['inheritancePolicy'],
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    activeSkillDefinitions: activeSkillRows.flatMap((row) => {
      const skillId = readRequiredText(row.skillId)
      if (!skillId) {
        return []
      }

      return [{
        skillId,
        classId: readOptionalText(row.classId),
        skillName: readOptionalText(row.skillName),
        shortName: readOptionalText(row.shortName),
        description: readOptionalText(row.description),
        iconId: readOptionalText(row.iconId),
        pointCost: readOptionalNumber(row.pointCost),
        resourceCost: readOptionalNumber(row.resourceCost),
        cooldownMs: readOptionalNumber(row.cooldownMs),
        initialRemainingCooldownMs: readOptionalNumber(row.initialRemainingCooldownMs),
        gcdMs: readOptionalNumber(row.gcdMs),
        targetingType: readOptionalText(row.targetingType),
        skillLogicId: readOptionalText(row.skillLogicId),
        castStopMode: readOptionalText(row.castStopMode) as PlayerCastStopMode | undefined,
        canAffectSkull: readOptionalBoolean(row.canAffectSkull),
        skillTags: parseCsvList<string>(row.skillTagsCsv),
        uiOrder: readOptionalNumber(row.uiOrder),
        unlockHint: readOptionalText(row.unlockHint),
        grantedStatusIds: parseCsvList<string>(row.grantedStatusIdsCsv),
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    activeSkillEffectDefinitions: activeSkillEffectRows.flatMap((row) => {
      const skillEffectId = readRequiredText(row.skillEffectId)
      if (!skillEffectId) {
        return []
      }

      return [{
        skillEffectId,
        skillId: readOptionalText(row.skillId),
        effectIndex: readOptionalNumber(row.effectIndex),
        skillLogicId: readOptionalText(row.skillLogicId),
        targetSelector: readOptionalText(row.targetSelector),
        valueA: readOptionalNumber(row.valueA),
        valueB: readOptionalNumber(row.valueB),
        durationMs: readOptionalNumber(row.durationMs),
        statusId: readOptionalText(row.statusId),
        threatDelta: readOptionalNumber(row.threatDelta),
        threatMultiplier: readOptionalNumber(row.threatMultiplier),
        threatSource: readOptionalText(row.threatSource) as
          | PlayerBuildWorkbookOverrides['activeSkillEffectDefinitions'][number]['threatSource']
          | undefined,
        notes: readOptionalText(row.notes),
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    activeStatusDefinitions: activeStatusRows.flatMap((row) => {
      const statusId = readRequiredText(row.statusId)
      if (!statusId) {
        return []
      }

      return [{
        statusId,
        statusName: readOptionalText(row.statusName),
        statusCategory: readOptionalText(row.statusCategory) as PlayerBuildWorkbookOverrides['activeStatusDefinitions'][number]['statusCategory'],
        iconId: readOptionalText(row.iconId),
        durationMs: readOptionalNumber(row.durationMs),
        maxStacks: readOptionalNumber(row.maxStacks),
        dispellable: readOptionalBoolean(row.dispellable),
        description: readOptionalText(row.description),
        effectLogicId: readOptionalText(row.effectLogicId),
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    passiveTalentDefinitions: passiveTalentRows.flatMap((row) => {
      const talentId = readRequiredText(row.talentId)
      const tier = readOptionalNumber(row.tier)
      if (!talentId || typeof tier !== 'number') {
        return []
      }

      return [{
        talentId,
        classId: readOptionalText(row.classId),
        talentName: readOptionalText(row.talentName),
        category: normalizePassiveTalentCategory(row.category) as PlayerBuildWorkbookOverrides['passiveTalentDefinitions'][number]['category'],
        cost: readOptionalNumber(row.cost),
        description: readOptionalText(row.description),
        iconId: readOptionalText(row.iconId),
        talentLogicId: readOptionalText(row.talentLogicId),
        tier,
        talentTags: parseCsvList<string>(row.talentTagsCsv),
        uiOrder: readOptionalNumber(row.uiOrder),
        exclusiveGroup: readOptionalText(row.exclusiveGroup),
        grantedStatusIds: parseCsvList<string>(row.grantedStatusIdsCsv),
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    passiveTalentEffectDefinitions: passiveTalentEffectRows.flatMap((row) => {
      const talentEffectId = readRequiredText(row.talentEffectId)
      if (!talentEffectId) {
        return []
      }

      return [{
        talentEffectId,
        talentId: readOptionalText(row.talentId),
        effectIndex: readOptionalNumber(row.effectIndex),
        talentLogicId: readOptionalText(row.talentLogicId),
        targetScope: readOptionalText(row.targetScope),
        valueA: readOptionalNumber(row.valueA),
        valueB: readOptionalNumber(row.valueB),
        statusId: readOptionalText(row.statusId),
        skillId: readOptionalText(row.skillId),
        notes: readOptionalText(row.notes),
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    passiveStatusDefinitions: passiveStatusRows.flatMap((row) => {
      const statusId = readRequiredText(row.statusId)
      if (!statusId) {
        return []
      }

      return [{
        statusId,
        statusName: readOptionalText(row.statusName),
        statusCategory: readOptionalText(row.statusCategory) as PlayerBuildWorkbookOverrides['passiveStatusDefinitions'][number]['statusCategory'],
        iconId: readOptionalText(row.iconId),
        durationMs: readOptionalNumber(row.durationMs),
        maxStacks: readOptionalNumber(row.maxStacks),
        dispellable: readOptionalBoolean(row.dispellable),
        description: readOptionalText(row.description),
        effectLogicId: readOptionalText(row.effectLogicId),
        enabled: readOptionalBoolean(row.enabled),
      }]
    }),
    defaultActiveBuilds: defaultActiveRows.flatMap((row) => {
      const presetId = readRequiredText(row.presetId)
      const hotkey = readRequiredText(row.hotkey) as SkillHotkey | null
      if (!presetId || !hotkey) {
        return []
      }

      return [{
        presetId,
        buildRuleId: readOptionalText(row.buildRuleId),
        classId: readOptionalText(row.classId),
        hotkey,
        skillId: readOptionalText(row.skillId) ?? null,
        priority: readOptionalNumber(row.priority) ?? 999,
      }]
    }),
    defaultPassiveBuilds: defaultPassiveRows.flatMap((row) => {
      const presetId = readRequiredText(row.presetId)
      const talentId = readRequiredText(row.talentId)
      if (!presetId || !talentId) {
        return []
      }

      return [{
        presetId,
        buildRuleId: readOptionalText(row.buildRuleId),
        classId: readOptionalText(row.classId),
        talentId,
        selected: readOptionalBoolean(row.selected) ?? false,
        priority: readOptionalNumber(row.priority) ?? 999,
      }]
    }),
    iconDefinitions: parseIconDefinitions(workbook),
  }
}

export async function loadDesignerWorkbooks() {
  try {
    const source = resolveDesignerDataSource()
    const [stageWorkbook, encounterWorkbook, enemyWorkbook, playerBuildWorkbook] = source === 'desktop'
      ? await Promise.all(DESKTOP_DATA_PACK_FILES.map((fileName) => readDesktopDataPackFile(fileName)))
      : await Promise.all([
          fetchWorkbook(STAGE_WORKBOOK_PATH),
          fetchWorkbook(ENCOUNTER_WORKBOOK_PATH),
          fetchWorkbook(ENEMY_WORKBOOK_PATH),
          fetchWorkbook(PLAYER_BUILD_WORKBOOK_PATH),
        ])

    applyStageWorkbookOverrides(parseStageWorkbook(stageWorkbook))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(encounterWorkbook))
    applyEnemyWorkbookOverrides(parseEnemyWorkbook(enemyWorkbook))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(playerBuildWorkbook))
  } catch (error) {
    console.warn('设计表读取失败，已回退到内置数据。', error)
  }
}
